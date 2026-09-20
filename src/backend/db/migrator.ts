/**
 * Database Migrations & Initial Seed Runner
 * SIH 2026 Problem Statement 26057
 *
 * Runs database schema migrations including PostGIS extensions, creates
 * spatial indices, and seeds default surveys, targets, and recommendations
 * if tables are unpopulated. Preserves existing user data.
 */

import fs from 'fs';
import path from 'path';
import { db } from './connection';
import { ACTIVE_SURVEY, MOCK_TRANSECTS } from '../../data/mockSurvey';
import { MOCK_TARGETS } from '../../data/mockTargets';
import { FollowUpRecommendationEngine } from '../../services/followUp/FollowUpRecommendationEngine';
import { RiskAssessmentEngine } from '../../services/risk/RiskAssessmentEngine';
import { GeoIntelligenceEngine } from '../../services/geoint/GeoIntelligenceEngine';
import { TemporalChangeEngine } from '../../services/temporal/TemporalChangeEngine';
import { HISTORICAL_SURVEYS } from '../../data/mockHistoricalSurveys';
import { fallbackStore } from './fallbackStore';

export interface MigrationResult {
  success: boolean;
  migrationsApplied: string[];
  message: string;
  postgisActive: boolean;
  seeded: boolean;
}

export async function runMigrations(): Promise<MigrationResult> {
  const health = await db.getHealth();

  if (!health.connected) {
    // Seed fallback store for local development
    seedFallbackStore();
    return {
      success: true,
      migrationsApplied: [],
      message: 'PostgreSQL not connected. Running in DEVELOPMENT_FALLBACK mode (In-Memory/Local Storage).',
      postgisActive: false,
      seeded: true,
    };
  }

  const pool = await db.getPool();
  if (!pool) {
    seedFallbackStore();
    return {
      success: false,
      migrationsApplied: [],
      message: 'Failed to obtain database pool.',
      postgisActive: false,
      seeded: false,
    };
  }

  const client = await pool.connect();
  const appliedMigrations: string[] = [];

  try {
    await client.query('BEGIN;');

    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Read existing migrations
    const existing = await client.query<{ name: string }>('SELECT name FROM migrations;');
    const appliedSet = new Set(existing.rows.map((r) => r.name));

    // 3. Apply 001_initial_schema.sql if not applied
    const migrationName = '001_initial_schema.sql';
    if (!appliedSet.has(migrationName)) {
      const sqlFilePath = path.join(process.cwd(), 'src', 'backend', 'db', 'migrations', migrationName);
      let sqlContent = '';
      if (fs.existsSync(sqlFilePath)) {
        sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
      } else {
        // Fallback embedded schema
        sqlContent = getEmbeddedInitialSchema();
      }

      await client.query(sqlContent);
      await client.query('INSERT INTO migrations (name) VALUES ($1);', [migrationName]);
      appliedMigrations.push(migrationName);
    }

    await client.query('COMMIT;');

    // 4. Verify PostGIS extension
    let postgisActive = false;
    try {
      const gisCheck = await client.query('SELECT PostGIS_Version();');
      postgisActive = gisCheck.rows.length > 0;
    } catch {
      postgisActive = false;
    }

    // 5. Seed default demo data if targets table is empty
    const seeded = await seedDatabaseIfEmpty(client);

    return {
      success: true,
      migrationsApplied: appliedMigrations,
      message: appliedMigrations.length > 0
        ? `Applied migrations: ${appliedMigrations.join(', ')}`
        : 'Database schema is up to date.',
      postgisActive,
      seeded,
    };
  } catch (err: any) {
    await client.query('ROLLBACK;');
    console.error('[Migrations] Execution failed:', err);
    return {
      success: false,
      migrationsApplied: appliedMigrations,
      message: `Migration failed: ${err.message}`,
      postgisActive: false,
      seeded: false,
    };
  } finally {
    client.release();
  }
}

/**
 * Seeds PostgreSQL tables if empty, without overwriting existing data
 */
async function seedDatabaseIfEmpty(client: any): Promise<boolean> {
  const targetCountRes = await client.query('SELECT COUNT(*) as count FROM targets;');
  const count = parseInt(targetCountRes.rows[0]?.count || '0', 10);

  if (count > 0) {
    return false; // already populated
  }

  // Insert Active Survey
  await client.query(
    `INSERT INTO surveys (
      id, code, name, location_name, crs, sonar_equipment, operating_frequency,
      survey_vessel, vehicle_type, chief_hydrographer, date, total_area_sq_km,
      total_pings, total_detections, pending_reviews, swath_range_per_channel_m
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO NOTHING;`,
    [
      ACTIVE_SURVEY.id,
      ACTIVE_SURVEY.code,
      ACTIVE_SURVEY.name,
      ACTIVE_SURVEY.locationName,
      ACTIVE_SURVEY.crs,
      ACTIVE_SURVEY.sonarEquipment,
      ACTIVE_SURVEY.operatingFrequency,
      ACTIVE_SURVEY.surveyVessel,
      ACTIVE_SURVEY.vehicleType,
      ACTIVE_SURVEY.chiefHydrographer,
      ACTIVE_SURVEY.date,
      ACTIVE_SURVEY.totalAreaSqKm,
      ACTIVE_SURVEY.totalPings,
      ACTIVE_SURVEY.totalDetections,
      ACTIVE_SURVEY.pendingReviews,
      ACTIVE_SURVEY.swathRangePerChannelM,
    ]
  );

  // Insert Transects
  for (const transect of MOCK_TRANSECTS) {
    await client.query(
      `INSERT INTO transects (id, survey_id, name, status, planned_heading_deg, length_meters, ping_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING;`,
      [
        transect.id,
        ACTIVE_SURVEY.id,
        transect.name,
        transect.status,
        transect.bearingDeg,
        transect.lengthMeters,
        (transect.pingEnd || 18500) - (transect.pingStart || 1),
      ]
    );
  }

  // Insert Targets with PostGIS Geometry Point
  for (const target of MOCK_TARGETS) {
    await client.query(
      `INSERT INTO targets (
        id, survey_id, transect_id, ping_number, channel,
        classification, category_label, confidence,
        latitude, longitude, geom, depth,
        slant_range, ground_range, towfish_altitude,
        estimated_length, estimated_width, shadow_length, shadow_height,
        backscatter, severity, verification_status, operator_notes,
        detected_at, verified_at, verified_by,
        risk_assessment, operator_risk_level, operator_override_reason,
        sonar_evidence_reference, model_metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326), $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        $29, $30
      ) ON CONFLICT (id) DO NOTHING;`,
      [
        target.id,
        target.surveyId,
        target.transectId,
        target.pingNumber,
        target.channel,
        target.classification,
        target.categoryLabel,
        target.confidence,
        target.latitude,
        target.longitude,
        target.depth,
        target.slantRange,
        target.groundRange,
        target.towfishAltitude,
        target.estimatedLength,
        target.estimatedWidth,
        target.shadowLength,
        target.shadowHeight,
        target.backscatter,
        target.severity,
        target.verificationStatus,
        target.operatorNotes || null,
        target.detectedAt,
        target.verifiedAt || null,
        target.verifiedBy || null,
        JSON.stringify(target.riskAssessment || null),
        target.operatorRiskLevel || null,
        target.operatorOverrideReason || null,
        JSON.stringify(target.sonarEvidenceReference || null),
        JSON.stringify(target.modelMetadata || null),
      ]
    );

    // Initial audit event
    await client.query(
      `INSERT INTO audit_events (
        id, target_id, timestamp, action_type, title,
        previous_value, new_value, operator, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;`,
      [
        `AUD-INIT-${target.id}`,
        target.id,
        target.detectedAt,
        'TARGET_CREATED',
        'AI ANOMALY CANDIDATE DETECTED',
        null,
        target.categoryLabel,
        'AI-EDGE-INFERENCE',
        `Target ${target.id} flagged as ${target.categoryLabel} with confidence ${(target.confidence * 100).toFixed(1)}%.`,
        JSON.stringify({ severity: target.severity, channel: target.channel }),
      ]
    );
  }

  // Generate initial recommendations using the existing verified recommendation engine
  const context = { surveyId: ACTIVE_SURVEY.id, isDemoReplay: true };
  const assessed = RiskAssessmentEngine.assessAndRankTargets(MOCK_TARGETS, context);
  const geoint = GeoIntelligenceEngine.analyzeTargets(assessed, context);
  const baseline = HISTORICAL_SURVEYS[0];
  const temporal = TemporalChangeEngine.compareSurveys(
    baseline,
    ACTIVE_SURVEY.id,
    ACTIVE_SURVEY.name,
    ACTIVE_SURVEY.date,
    assessed,
    undefined,
    context
  );

  const initialRecResult = FollowUpRecommendationEngine.generateRecommendations(
    assessed,
    geoint.hotspots,
    temporal,
    context
  );

  // Insert initial recommendations with PostGIS geom
  for (const rec of initialRecResult.recommendations) {
    await client.query(
      `INSERT INTO follow_up_recommendations (
        id, rank, target_ids, hotspot_id,
        center_latitude, center_longitude, geom,
        priority_score, urgency, recommendation_type,
        reasons, evidence, uncertainty, expected_benefit,
        related_risk_level, related_change_type, provenance,
        area_name, target_count, acknowledged, operator_override, generated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326),
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20, $21
      ) ON CONFLICT (id) DO NOTHING;`,
      [
        rec.id,
        rec.rank,
        JSON.stringify(rec.targetIds),
        rec.hotspotId || null,
        rec.centerLatitude,
        rec.centerLongitude,
        rec.priorityScore,
        rec.urgency,
        rec.recommendationType,
        JSON.stringify(rec.reasons),
        JSON.stringify(rec.evidence),
        JSON.stringify(rec.uncertainty),
        rec.expectedBenefit,
        rec.relatedRiskLevel,
        rec.relatedChangeType || null,
        rec.provenance,
        rec.areaName || null,
        rec.targetCount,
        rec.acknowledged ?? false,
        rec.operatorOverride ? JSON.stringify(rec.operatorOverride) : null,
        rec.generatedAt,
      ]
    );
  }

  return true;
}

/**
 * Seeds in-memory fallbackStore with initial data
 */
export function seedFallbackStore(): void {
  for (const target of MOCK_TARGETS) {
    fallbackStore.upsertTarget(target);
  }

  const context = { surveyId: ACTIVE_SURVEY.id, isDemoReplay: true };
  const assessed = RiskAssessmentEngine.assessAndRankTargets(MOCK_TARGETS, context);
  const geoint = GeoIntelligenceEngine.analyzeTargets(assessed, context);
  const baseline = HISTORICAL_SURVEYS[0];
  const temporal = TemporalChangeEngine.compareSurveys(
    baseline,
    ACTIVE_SURVEY.id,
    ACTIVE_SURVEY.name,
    ACTIVE_SURVEY.date,
    assessed,
    undefined,
    context
  );

  const recResult = FollowUpRecommendationEngine.generateRecommendations(
    assessed,
    geoint.hotspots,
    temporal,
    context
  );

  fallbackStore.upsertRecommendations(recResult.recommendations);
}

function getEmbeddedInitialSchema(): string {
  return `
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}
