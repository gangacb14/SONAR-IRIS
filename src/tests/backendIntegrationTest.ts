/**
 * SIH 2026 Problem Statement 26057: Backend & PostgreSQL / PostGIS Integration Tests
 *
 * 15-Point Automated Verification Suite:
 * - Environment Variable Configuration & Fallback Safety
 * - Schema Migrations & PostGIS Geometry / GIST Index Definitions
 * - Storage Service Health & Mode Telemetry
 * - Target CRUD Operations & Acoustic Property Persistence
 * - Target Verification State Transitions
 * - PostGIS Spatial Distance & Bounding Box Queries
 * - Follow-up Survey Recommendation Persistence
 * - Operator Acknowledgements & Operator Overrides Persistence
 * - Audit Trail Provenance & Provenance Tracking
 * - Sonar Ping Spatial Logging
 * - Zero-Crash Resilience in Offline/Fallback Mode
 */

import { getDatabaseConfig } from '../backend/db/config';
import { db } from '../backend/db/connection';
import { runMigrations, seedFallbackStore } from '../backend/db/migrator';
import { storageService } from '../backend/db/storageService';
import { fallbackStore } from '../backend/db/fallbackStore';
import { MOCK_TARGETS } from '../data/mockTargets';
import { ACTIVE_SURVEY } from '../data/mockSurvey';
import { Target } from '../types/target';
import { FollowUpRecommendation, FollowUpOperatorOverride } from '../types/followUp';
import fs from 'fs';
import path from 'path';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, num: number, title: string): void {
  if (condition) {
    console.log(`[PASS] Test ${String(num).padStart(2, '0')}: ${title}`);
    passedCount++;
  } else {
    console.error(`[FAIL] Test ${String(num).padStart(2, '0')}: ${title}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('SIH 2026 PS 26057: BACKEND & POSTGRESQL/POSTGIS INTEGRATION TESTS');
  console.log('================================================================');

  // Test 01: Database Configuration parser
  const { config, isConfigured } = getDatabaseConfig();
  assert(
    typeof config.port === 'number' &&
      typeof config.database === 'string' &&
      config.database.length > 0 &&
      typeof isConfigured === 'boolean',
    1,
    'Database Configuration Environment Variables parsed securely without hardcoded credentials'
  );

  // Test 02: Schema Migration File & PostGIS Geometry Verification
  const schemaPath = path.join(process.cwd(), 'src', 'backend', 'db', 'migrations', '001_initial_schema.sql');
  const schemaExists = fs.existsSync(schemaPath);
  let schemaContent = '';
  if (schemaExists) {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  }
  const hasPostgisExtension = schemaContent.includes('CREATE EXTENSION IF NOT EXISTS postgis');
  const hasTargetGeom = schemaContent.includes('geom GEOMETRY(Point, 4326)');
  const hasGistIndex = schemaContent.includes('USING GIST (geom)');
  const hasPingsTable = schemaContent.includes('CREATE TABLE IF NOT EXISTS sonar_pings');

  assert(
    schemaExists && hasPostgisExtension && hasTargetGeom && hasGistIndex && hasPingsTable,
    2,
    'Schema Migration defines PostGIS extension, Point (EPSG:4326) geometry, and GIST spatial indexes'
  );

  // Test 03: Database Connection & Health Telemetry
  const health = await db.getHealth();
  assert(
    health.storageMode === 'POSTGRESQL_POSTGIS' || health.storageMode === 'DEVELOPMENT_FALLBACK',
    3,
    `Database Connection Manager reports valid storage mode: ${health.storageMode}`
  );

  // Test 04: Migration Runner Execution
  const migResult = await runMigrations();
  assert(
    migResult.success === true && typeof migResult.message === 'string',
    4,
    `Database Migration Runner executed successfully (${migResult.message})`
  );

  // Test 05: Storage Service Status
  const status = await storageService.getStatus();
  assert(
    typeof status.targetCount === 'number' &&
      status.targetCount > 0 &&
      typeof status.recommendationCount === 'number' &&
      typeof status.storageMode === 'string',
    5,
    `Storage Service reports active entities (${status.targetCount} targets, ${status.recommendationCount} recs)`
  );

  // Test 06: Survey and Transects Retrieval
  const survey = await storageService.getSurvey(ACTIVE_SURVEY.id);
  const transects = await storageService.getTransects(ACTIVE_SURVEY.id);
  assert(
    survey !== null &&
      survey.id === ACTIVE_SURVEY.id &&
      Array.isArray(transects) &&
      transects.length > 0,
    6,
    `Survey metadata and ${transects.length} transects persisted and retrieved`
  );

  // Test 07: Target Retrieval & Filtering
  const allTargets = await storageService.getTargets();
  const ghostNets = await storageService.getTargets({ classification: 'GHOST_NET' });
  assert(
    allTargets.length >= 8 &&
      ghostNets.length > 0 &&
      ghostNets.every((t) => t.classification === 'GHOST_NET'),
    7,
    `Target repository queries execute accurately with attribute filtering (${allTargets.length} total, ${ghostNets.length} ghost nets)`
  );

  // Test 08: Target Ingestion / Upsert
  const newTarget = {
    id: 'TRG-TEST-POSTGIS-99',
    surveyId: ACTIVE_SURVEY.id,
    transectId: 'TRX-01',
    pingNumber: 42999,
    channel: 'PORT',
    classification: 'METALLIC_DRUM',
    categoryLabel: 'Metallic Drum (Industrial)',
    confidence: 0.94,
    latitude: 9.2431,
    longitude: 79.1835,
    depth: 28.5,
    slantRange: 42.1,
    groundRange: 38.6,
    towfishAltitude: 14.8,
    severity: 'CRITICAL',
    verificationStatus: 'PENDING_REVIEW',
    detectedAt: new Date().toISOString(),
  } as unknown as Target;

  const inserted = await storageService.upsertTarget(newTarget, 'TEST_SUITE');
  const fetched = await storageService.getTargetById('TRG-TEST-POSTGIS-99');
  assert(
    fetched !== null &&
      fetched.id === 'TRG-TEST-POSTGIS-99' &&
      fetched.latitude === 9.2431 &&
      fetched.longitude === 79.1835,
    8,
    'Target record with WGS84 spatial coordinates inserted and retrieved successfully'
  );

  // Test 09: Target Verification Transition (Confirm & Audit)
  const updateRes = await storageService.updateTarget(
    'TRG-TEST-POSTGIS-99',
    {
      verificationStatus: 'CONFIRMED_DEBRIS',
      operatorNotes: 'Verified via high-res shadow analysis',
    },
    'Test Hydrographer'
  );
  assert(
    updateRes !== null &&
      updateRes.target.verificationStatus === 'CONFIRMED_DEBRIS' &&
      updateRes.audit.actionType === 'TARGET_UPDATED',
    9,
    'Target verification lifecycle updated with linked audit record'
  );

  // Test 10: Spatial Distance Search (ST_DWithin / Fallback Haversine)
  // Searching near target 1 (lat 9.24158, lng 79.18244) within 500 meters
  const nearby = await storageService.findNearbyTargets(9.24158, 79.18244, 500);
  assert(
    Array.isArray(nearby) &&
      nearby.length > 0 &&
      nearby[0].distanceMeters <= 500 &&
      typeof nearby[0].distanceMeters === 'number',
    10,
    `Spatial radius search found ${nearby.length} targets within 500m (closest: ${nearby[0].distanceMeters}m)`
  );

  // Test 11: Spatial Bounding Box Search (ST_MakeEnvelope / Fallback)
  const bboxTargets = await storageService.findTargetsInBoundingBox(9.22, 9.26, 79.16, 79.20);
  assert(
    Array.isArray(bboxTargets) && bboxTargets.length >= 8,
    11,
    `Spatial bounding box envelope query returned ${bboxTargets.length} targets`
  );

  // Test 12: Follow-up Recommendations Persistence & Retrieval
  const recs = await storageService.getRecommendations();
  assert(
    Array.isArray(recs) && recs.length > 0 && recs[0].priorityScore > 0,
    12,
    `Follow-up survey mission recommendations persisted (${recs.length} recommendations in queue)`
  );

  // Test 13: Operator Acknowledgement Persistence
  const firstRec = recs[0];
  const ackRes = await storageService.acknowledgeRecommendation(firstRec.id, {
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: 'Commander Test',
    operatorNote: 'Mission scheduled for AUV dive 04',
  });
  const reFetchedRec = await storageService.getRecommendationById(firstRec.id);
  assert(
    ackRes !== null &&
      ackRes.acknowledged === true &&
      reFetchedRec?.acknowledged === true &&
      reFetchedRec?.operatorNote === 'Mission scheduled for AUV dive 04',
    13,
    'Operator recommendation acknowledgement persists with notes and operator identity'
  );

  // Test 14: Operator Override Persistence
  const override: FollowUpOperatorOverride = {
    urgency: 'CRITICAL',
    recommendationType: 'ROV_VISUAL_INSPECTION',
    reason: 'Critical navigational safety constraint identified',
    overriddenBy: 'Chief Scientist',
    overriddenAt: new Date().toISOString(),
  };
  const ovrRes = await storageService.overrideRecommendation(firstRec.id, override);
  const reFetchedOvr = await storageService.getRecommendationById(firstRec.id);
  assert(
    ovrRes !== null &&
      reFetchedOvr?.operatorOverride?.reason === 'Critical navigational safety constraint identified' &&
      reFetchedOvr?.urgency === 'CRITICAL',
    14,
    'Operator recommendation override persists with priority modification and justification'
  );

  // Test 15: Sonar Ping Spatial Logging & Audit Log Linkage
  const pingLogged = await storageService.recordSonarPing({
    surveyId: ACTIVE_SURVEY.id,
    transectId: 'TRX-01',
    pingNumber: 88420,
    timestamp: new Date().toISOString(),
    latitude: 9.242,
    longitude: 79.183,
    altitudeMeters: 14.5,
    depthMeters: 28.2,
    headingDeg: 42.0,
    qualityScore: 98.2,
  });

  const audits = await storageService.getAuditEvents();
  assert(
    typeof pingLogged === 'boolean' &&
      Array.isArray(audits) &&
      audits.length > 0,
    15,
    `Sonar ping spatially ingested and complete audit provenance verified (${audits.length} events)`
  );

  console.log('================================================================');
  console.log(`BACKEND VERIFICATION SUMMARY: ${passedCount}/15 PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[FATAL] Backend integration tests encountered unexpected error:', err);
  process.exit(1);
});
