/**
 * Unified Backend Storage Service (PostgreSQL + PostGIS with Development Fallback)
 * SIH 2026 Problem Statement 26057
 *
 * Implements full domain persistence for:
 * - Sonar Surveys, Transects & Pings
 * - Detected Targets / Debris with PostGIS Point geometry & spatial indexes
 * - Target classifications, acoustic metrics, hazard risk assessments
 * - Follow-up survey recommendations & mission queue
 * - Operator acknowledgements & overrides
 * - Full audit provenance
 *
 * Automatically delegates to PostgreSQL + PostGIS when connected, or to
 * Development Fallback Store when offline.
 */

import { db } from './connection';
import { fallbackStore } from './fallbackStore';
import { Target, DebrisCategory, VerificationStatus } from '../../types/target';
import { FollowUpRecommendation, FollowUpOperatorOverride } from '../../types/followUp';
import { AuditEvent } from '../../types/audit';
import { Survey, SurveyTransect } from '../../types/survey';
import { RiskLevel } from '../../types/risk';
import { MOCK_TARGETS } from '../../data/mockTargets';

export interface StorageStatus {
  storageMode: 'POSTGRESQL_POSTGIS' | 'DEVELOPMENT_FALLBACK';
  connected: boolean;
  database: string;
  postgisAvailable: boolean;
  postgisVersion: string | null;
  targetCount: number;
  recommendationCount: number;
  auditCount: number;
}

export interface NearbyTargetResult {
  target: Target;
  distanceMeters: number;
}

export class StorageService {
  /**
   * Returns current storage mode and telemetry
   */
  async getStatus(): Promise<StorageStatus> {
    const health = await db.getHealth();
    if (health.connected) {
      const targetCountRes = await db.query('SELECT COUNT(*) as count FROM targets;');
      const recCountRes = await db.query('SELECT COUNT(*) as count FROM follow_up_recommendations;');
      const auditCountRes = await db.query('SELECT COUNT(*) as count FROM audit_events;');

      return {
        storageMode: 'POSTGRESQL_POSTGIS',
        connected: true,
        database: health.database,
        postgisAvailable: health.postgisAvailable,
        postgisVersion: health.postgisVersion,
        targetCount: parseInt(targetCountRes?.rows[0]?.count || '0', 10),
        recommendationCount: parseInt(recCountRes?.rows[0]?.count || '0', 10),
        auditCount: parseInt(auditCountRes?.rows[0]?.count || '0', 10),
      };
    }

    const fallbackStats = fallbackStore.getStats();
    return {
      storageMode: 'DEVELOPMENT_FALLBACK',
      connected: false,
      database: health.database,
      postgisAvailable: false,
      postgisVersion: null,
      targetCount: fallbackStats.targetCount,
      recommendationCount: fallbackStats.recommendationCount,
      auditCount: fallbackStats.auditCount,
    };
  }

  // ============================================================================
  // SURVEYS & TRANSECTS
  // ============================================================================

  async getSurvey(surveyId: string): Promise<Survey | null> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query('SELECT * FROM surveys WHERE id = $1;', [surveyId]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          code: row.code,
          name: row.name,
          locationName: row.location_name,
          crs: row.crs,
          sonarEquipment: row.sonar_equipment,
          operatingFrequency: row.operating_frequency,
          surveyVessel: row.survey_vessel,
          vehicleType: row.vehicle_type,
          chiefHydrographer: row.chief_hydrographer,
          date: row.date,
          totalAreaSqKm: row.total_area_sq_km,
          totalPings: Number(row.total_pings),
          totalDetections: row.total_detections,
          pendingReviews: row.pending_reviews,
          swathRangePerChannelM: row.swath_range_per_channel_m,
        };
      }
    }
    return fallbackStore.getSurvey(surveyId);
  }

  async getTransects(surveyId: string): Promise<SurveyTransect[]> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query(
        'SELECT * FROM transects WHERE survey_id = $1 ORDER BY id ASC;',
        [surveyId]
      );
      if (res && res.rows.length > 0) {
        return res.rows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          bearingDeg: row.planned_heading_deg,
          lengthMeters: row.length_meters,
          startCoord: [79.1824, 9.2415] as [number, number],
          endCoord: [79.1865, 9.2458] as [number, number],
          pingStart: 1,
          pingEnd: row.ping_count || 18500,
          swathWidthMeters: 150,
        }));
      }
    }
    return fallbackStore.getTransects(surveyId);
  }

  // ============================================================================
  // TARGETS & POSTGIS SPATIAL QUERIES
  // ============================================================================

  async getTargets(filter?: {
    surveyId?: string;
    classification?: string;
    severity?: string;
    status?: string;
  }): Promise<Target[]> {
    const health = await db.getHealth();
    if (health.connected) {
      let query = 'SELECT * FROM targets WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (filter?.surveyId) {
        query += ` AND survey_id = $${idx++}`;
        params.push(filter.surveyId);
      }
      if (filter?.classification) {
        query += ` AND classification = $${idx++}`;
        params.push(filter.classification);
      }
      if (filter?.severity) {
        query += ` AND severity = $${idx++}`;
        params.push(filter.severity);
      }
      if (filter?.status) {
        query += ` AND verification_status = $${idx++}`;
        params.push(filter.status);
      }

      query += ' ORDER BY ping_number ASC;';
      const res = await db.query(query, params);
      if (res) {
        return res.rows.map((row) => this.rowToTarget(row));
      }
    }
    return fallbackStore.getTargets(filter);
  }

  async getTargetById(id: string): Promise<Target | null> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query('SELECT * FROM targets WHERE id = $1;', [id]);
      if (res && res.rows.length > 0) {
        return this.rowToTarget(res.rows[0]);
      }
      return null;
    }
    return fallbackStore.getTargetById(id);
  }

  /**
   * PostGIS Native Spatial Distance Query (ST_DWithin & ST_Distance)
   */
  async findNearbyTargets(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<NearbyTargetResult[]> {
    const health = await db.getHealth();
    if (health.connected && health.postgisAvailable) {
      const sql = `
        SELECT *,
          ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::numeric, 1) AS distance_meters
        FROM targets
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ORDER BY distance_meters ASC;
      `;
      const res = await db.query(sql, [lat, lng, radiusMeters]);
      if (res) {
        return res.rows.map((row) => ({
          target: this.rowToTarget(row),
          distanceMeters: parseFloat(row.distance_meters),
        }));
      }
    }
    return fallbackStore.findNearbyTargets({ lat, lng, radiusMeters });
  }

  /**
   * PostGIS Native Bounding Box Query
   */
  async findTargetsInBoundingBox(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  ): Promise<Target[]> {
    const health = await db.getHealth();
    if (health.connected && health.postgisAvailable) {
      const sql = `
        SELECT * FROM targets
        WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        ORDER BY ping_number ASC;
      `;
      const res = await db.query(sql, [minLng, minLat, maxLng, maxLat]);
      if (res) {
        return res.rows.map((row) => this.rowToTarget(row));
      }
    }
    return fallbackStore.findTargetsInBoundingBox({ minLat, maxLat, minLng, maxLng });
  }

  /**
   * Ingest or Upsert a Target with PostGIS Point
   */
  async upsertTarget(target: Target, operator = 'SYSTEM'): Promise<Target> {
    const health = await db.getHealth();
    if (health.connected) {
      const sql = `
        INSERT INTO targets (
          id, survey_id, transect_id, ping_number, channel,
          classification, category_label, confidence,
          latitude, longitude, geom, depth,
          slant_range, ground_range, towfish_altitude,
          estimated_length, estimated_width, shadow_length, shadow_height,
          backscatter, severity, verification_status, operator_notes,
          detected_at, verified_at, verified_by,
          risk_assessment, operator_risk_level, operator_override_reason,
          sonar_evidence_reference, model_metadata, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326), $11,
          $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25,
          $26, $27, $28,
          $29, $30, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          classification = EXCLUDED.classification,
          category_label = EXCLUDED.category_label,
          confidence = EXCLUDED.confidence,
          severity = EXCLUDED.severity,
          verification_status = EXCLUDED.verification_status,
          operator_notes = EXCLUDED.operator_notes,
          verified_at = EXCLUDED.verified_at,
          verified_by = EXCLUDED.verified_by,
          risk_assessment = EXCLUDED.risk_assessment,
          operator_risk_level = EXCLUDED.operator_risk_level,
          operator_override_reason = EXCLUDED.operator_override_reason,
          updated_at = NOW()
        RETURNING *;
      `;
      const res = await db.query(sql, [
        target.id,
        target.surveyId || 'MIS-2026-INDO-04B',
        target.transectId || 'TRX-01',
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
        target.estimatedLength || null,
        target.estimatedWidth || null,
        target.shadowLength || null,
        target.shadowHeight || null,
        target.backscatter || null,
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
      ]);

      if (res && res.rows.length > 0) {
        return this.rowToTarget(res.rows[0]);
      }
    }

    return fallbackStore.upsertTarget(target);
  }

  async updateTarget(
    id: string,
    changes: Partial<Target>,
    operator = 'Hydrographer'
  ): Promise<{ target: Target; audit: AuditEvent } | null> {
    const existing = await this.getTargetById(id);
    if (!existing) return null;

    const updated: Target = {
      ...existing,
      ...changes,
      id, // protect identifier
    };

    const saved = await this.upsertTarget(updated, operator);

    const audit: AuditEvent = {
      id: `AUD-TRG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_UPDATED',
      title: 'Target Record Updated',
      previousValue: existing.verificationStatus,
      newValue: saved.verificationStatus,
      operator,
      description: `Target ${id} updated by ${operator}.`,
      metadata: { changes },
    };

    await this.addAuditEvent(audit);
    return { target: saved, audit };
  }

  /**
   * Replaces all active targets with an imported target dataset
   */
  async replaceTargets(targets: Target[], operator = 'CSV_IMPORT'): Promise<Target[]> {
    const health = await db.getHealth();
    if (health.connected) {
      await db.query('DELETE FROM targets;');
      for (const t of targets) {
        await this.upsertTarget(t, operator);
      }
      return targets;
    }
    return fallbackStore.replaceTargets(targets);
  }

  /**
   * Resets active targets to the baseline demo dataset
   */
  async resetToDemo(): Promise<Target[]> {
    const health = await db.getHealth();
    if (health.connected) {
      await db.query('DELETE FROM targets;');
      for (const t of MOCK_TARGETS) {
        await this.upsertTarget(t, 'SYSTEM_DEMO_SEED');
      }
      return MOCK_TARGETS;
    }
    return fallbackStore.resetToDemo();
  }

  // ============================================================================
  // FOLLOW-UP RECOMMENDATIONS & MISSION QUEUE
  // ============================================================================

  async getRecommendations(): Promise<FollowUpRecommendation[]> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query(
        'SELECT * FROM follow_up_recommendations ORDER BY rank ASC, priority_score DESC;'
      );
      if (res && res.rows.length > 0) {
        return res.rows.map((row) => this.rowToRecommendation(row));
      }
    }
    return fallbackStore.getRecommendations();
  }

  async getRecommendationById(id: string): Promise<FollowUpRecommendation | null> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query(
        'SELECT * FROM follow_up_recommendations WHERE id = $1;',
        [id]
      );
      if (res && res.rows.length > 0) {
        return this.rowToRecommendation(res.rows[0]);
      }
      return null;
    }
    return fallbackStore.getRecommendationById(id);
  }

  async syncRecommendations(recs: FollowUpRecommendation[]): Promise<void> {
    const health = await db.getHealth();
    if (health.connected) {
      for (const rec of recs) {
        const sql = `
          INSERT INTO follow_up_recommendations (
            id, rank, target_ids, hotspot_id,
            center_latitude, center_longitude, geom,
            priority_score, urgency, recommendation_type,
            reasons, evidence, uncertainty, expected_benefit,
            related_risk_level, related_change_type, provenance,
            area_name, target_count, acknowledged, operator_override, generated_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326),
            $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19, $20, $21, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            rank = EXCLUDED.rank,
            priority_score = CASE WHEN follow_up_recommendations.operator_override IS NOT NULL 
                                  THEN follow_up_recommendations.priority_score 
                                  ELSE EXCLUDED.priority_score END,
            urgency = CASE WHEN follow_up_recommendations.operator_override IS NOT NULL 
                           THEN follow_up_recommendations.urgency 
                           ELSE EXCLUDED.urgency END,
            recommendation_type = CASE WHEN follow_up_recommendations.operator_override IS NOT NULL 
                                       THEN follow_up_recommendations.recommendation_type 
                                       ELSE EXCLUDED.recommendation_type END,
            reasons = EXCLUDED.reasons,
            evidence = EXCLUDED.evidence,
            uncertainty = EXCLUDED.uncertainty,
            expected_benefit = EXCLUDED.expected_benefit,
            updated_at = NOW();
        `;
        await db.query(sql, [
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
        ]);
      }
    }

    fallbackStore.upsertRecommendations(recs);
  }

  async acknowledgeRecommendation(
    id: string,
    ack: { acknowledgedAt: string; acknowledgedBy: string; operatorNote?: string }
  ): Promise<FollowUpRecommendation | null> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query(
        `UPDATE follow_up_recommendations
         SET acknowledged = TRUE,
             acknowledged_at = $2,
             acknowledged_by = $3,
             operator_note = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [id, ack.acknowledgedAt, ack.acknowledgedBy, ack.operatorNote || null]
      );
      if (res && res.rows.length > 0) {
        return this.rowToRecommendation(res.rows[0]);
      }
    }
    return fallbackStore.acknowledgeRecommendation(id, ack);
  }

  async overrideRecommendation(
    id: string,
    override: FollowUpOperatorOverride
  ): Promise<FollowUpRecommendation | null> {
    const health = await db.getHealth();
    if (health.connected) {
      const res = await db.query(
        `UPDATE follow_up_recommendations
         SET operator_override = $2,
             priority_score = COALESCE($3, priority_score),
             urgency = COALESCE($4, urgency),
             recommendation_type = COALESCE($5, recommendation_type),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [
          id,
          JSON.stringify(override),
          override.priorityScore || null,
          override.urgency || null,
          override.recommendationType || null,
        ]
      );
      if (res && res.rows.length > 0) {
        return this.rowToRecommendation(res.rows[0]);
      }
    }
    return fallbackStore.overrideRecommendation(id, override);
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  async getAuditEvents(targetId?: string): Promise<AuditEvent[]> {
    const health = await db.getHealth();
    if (health.connected) {
      let sql = 'SELECT * FROM audit_events';
      const params: any[] = [];
      if (targetId) {
        sql += ' WHERE target_id = $1';
        params.push(targetId);
      }
      sql += ' ORDER BY timestamp DESC;';
      const res = await db.query(sql, params);
      if (res) {
        return res.rows.map((row) => ({
          id: row.id,
          targetId: row.target_id,
          timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date(row.timestamp).toISOString(),
          actionType: row.action_type,
          title: row.title,
          previousValue: row.previous_value,
          newValue: row.new_value,
          operator: row.operator,
          description: row.description,
          metadata: row.metadata,
        }));
      }
    }
    return fallbackStore.getAuditEvents(targetId);
  }

  async addAuditEvent(audit: AuditEvent): Promise<void> {
    const health = await db.getHealth();
    if (health.connected) {
      await db.query(
        `INSERT INTO audit_events (
          id, target_id, timestamp, action_type, title,
          previous_value, new_value, operator, description, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;`,
        [
          audit.id,
          audit.targetId,
          audit.timestamp,
          audit.actionType,
          audit.title,
          audit.previousValue || null,
          audit.newValue || null,
          audit.operator,
          audit.description,
          JSON.stringify(audit.metadata || null),
        ]
      );
    }
    fallbackStore.addAuditEvent(audit);
  }

  // ============================================================================
  // SONAR PINGS (Raw / Processed)
  // ============================================================================

  async recordSonarPing(ping: {
    surveyId: string;
    transectId: string;
    pingNumber: number;
    timestamp: string;
    latitude: number;
    longitude: number;
    altitudeMeters?: number;
    depthMeters?: number;
    headingDeg?: number;
    frequencyKhz?: number;
    qualityScore?: number;
    processingStatus?: string;
    candidateCount?: number;
    rawPayload?: any;
  }): Promise<boolean> {
    const health = await db.getHealth();
    if (health.connected) {
      await db.query(
        `INSERT INTO sonar_pings (
          survey_id, transect_id, ping_number, timestamp,
          latitude, longitude, geom, altitude_meters, depth_meters,
          heading_deg, frequency_khz, quality_score, processing_status,
          candidate_count, raw_payload
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326), $7, $8,
          $9, $10, $11, $12,
          $13, $14
        );`,
        [
          ping.surveyId,
          ping.transectId,
          ping.pingNumber,
          ping.timestamp,
          ping.latitude,
          ping.longitude,
          ping.altitudeMeters || null,
          ping.depthMeters || null,
          ping.headingDeg || null,
          ping.frequencyKhz || 410,
          ping.qualityScore || null,
          ping.processingStatus || 'READY',
          ping.candidateCount || 0,
          ping.rawPayload ? JSON.stringify(ping.rawPayload) : null,
        ]
      );
      return true;
    }
    return fallbackStore.recordSonarPing(ping);
  }

  // ============================================================================
  // ROW CONVERTERS
  // ============================================================================

  private rowToTarget(row: any): Target {
    return {
      id: row.id,
      surveyId: row.survey_id,
      transectId: row.transect_id,
      pingNumber: row.ping_number,
      channel: row.channel,
      classification: row.classification as DebrisCategory,
      categoryLabel: row.category_label,
      confidence: row.confidence,
      latitude: row.latitude,
      longitude: row.longitude,
      coordinateReferenceSystem: row.coordinate_reference_system,
      utmZone: row.utm_zone,
      utmEasting: row.utm_easting,
      utmNorthing: row.utm_northing,
      depth: row.depth,
      slantRange: row.slant_range,
      groundRange: row.ground_range,
      towfishAltitude: row.towfish_altitude,
      estimatedLength: row.estimated_length,
      estimatedWidth: row.estimated_width,
      shadowLength: row.shadow_length,
      shadowHeight: row.shadow_height,
      backscatter: row.backscatter,
      severity: row.severity,
      verificationStatus: row.verification_status as VerificationStatus,
      operatorNotes: row.operator_notes,
      detectedAt: typeof row.detected_at === 'string' ? row.detected_at : new Date(row.detected_at).toISOString(),
      verifiedAt: row.verified_at ? (typeof row.verified_at === 'string' ? row.verified_at : new Date(row.verified_at).toISOString()) : undefined,
      verifiedBy: row.verified_by || undefined,
      riskAssessment: row.risk_assessment,
      operatorRiskLevel: row.operator_risk_level as RiskLevel,
      operatorOverrideReason: row.operator_override_reason,
      sonarEvidenceReference: row.sonar_evidence_reference || {
        pingOffset: row.ping_number,
        rangeMeters: row.slant_range,
        waterfallBox: { x: 50, y: 50, width: 10, height: 10 },
      },
      modelMetadata: row.model_metadata || {
        modelName: 'yolov8x-sonar-debris-quantized',
        featureExtractor: 'ONNX Swath Tensor [1, 2, 1024]',
        snrDb: -3.5,
        shadowContrastRatio: 1.85,
      },

      // Backwards compatibility aliases
      transectLine: row.transect_id,
      category: row.classification as DebrisCategory,
      timestamp: typeof row.detected_at === 'string' ? row.detected_at : new Date(row.detected_at).toISOString(),
      slantRangeMeters: row.slant_range || 35.0,
      groundRangeMeters: row.ground_range || 30.0,
      towfishAltitudeMeters: row.towfish_altitude || 14.5,
      shadowLengthMeters: row.shadow_length || 6.0,
      estimatedTargetHeightMeters: row.shadow_height || 1.8,
      estimatedLengthMeters: row.estimated_length || 2.5,
      estimatedWidthMeters: row.estimated_width || 1.2,
      backscatterDb: row.backscatter || -4.2,
      coordinates: {
        lat: row.latitude,
        lng: row.longitude,
        utmZone: row.utm_zone || '44N',
        utmEasting: row.utm_easting || 410500.0,
        utmNorthing: row.utm_northing || 1022100.0,
        depthMeters: row.depth || 28.5,
      },
      waterfallBox: row.sonar_evidence_reference?.waterfallBox || { x: 50, y: 50, width: 10, height: 10 },
    };
  }

  // Alias methods for pipeline convenience
  async saveTarget(target: Target, operator = 'SYSTEM'): Promise<Target> {
    return this.upsertTarget(target, operator);
  }

  async saveRecommendations(recs: FollowUpRecommendation[]): Promise<void> {
    return this.syncRecommendations(recs);
  }

  private rowToRecommendation(row: any): FollowUpRecommendation {
    return {
      id: row.id,
      rank: row.rank,
      targetIds: typeof row.target_ids === 'string' ? JSON.parse(row.target_ids) : row.target_ids,
      hotspotId: row.hotspot_id,
      centerLatitude: row.center_latitude,
      centerLongitude: row.center_longitude,
      priorityScore: row.priority_score,
      urgency: row.urgency,
      recommendationType: row.recommendation_type,
      reasons: typeof row.reasons === 'string' ? JSON.parse(row.reasons) : row.reasons,
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence,
      uncertainty: typeof row.uncertainty === 'string' ? JSON.parse(row.uncertainty) : row.uncertainty,
      expectedBenefit: row.expected_benefit,
      relatedRiskLevel: row.related_risk_level,
      relatedChangeType: row.related_change_type,
      provenance: row.provenance,
      areaName: row.area_name,
      targetCount: row.target_count,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : undefined,
      acknowledgedBy: row.acknowledged_by,
      operatorNote: row.operator_note,
      operatorOverride: typeof row.operator_override === 'string' ? JSON.parse(row.operator_override) : row.operator_override,
      generatedAt: typeof row.generated_at === 'string' ? row.generated_at : new Date(row.generated_at).toISOString(),
    };
  }
}

export const storageService = new StorageService();
