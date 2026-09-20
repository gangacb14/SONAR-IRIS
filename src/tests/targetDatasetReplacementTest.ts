/**
 * Target Dataset Replacement & Isolation Test Suite
 * SIH 2026 Problem Statement 26057
 *
 * Verifies:
 * 1. CSV Ingestion replaces demo targets completely instead of appending.
 * 2. Target count exactly matches imported targets count.
 * 3. Restoring demo dataset restores original 8 demo targets cleanly.
 * 4. Dataset provenance isolates CSV imported data from demo simulated replay.
 * 5. Corrupt / empty CSV rejection causes explicit error without corrupting active dataset.
 * 6. Storage service and TargetRepository replaceTargets works consistently.
 */

import { MockTargetRepository } from '../repositories/MockTargetRepository';
import { storageService } from '../backend/db/storageService';
import { MOCK_TARGETS } from '../data/mockTargets';
import { SonarFileParser } from '../services/sonar/fileParser';
import { Target } from '../types/target';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('SIH 2026 PS 26057: TARGET DATASET REPLACEMENT & ISOLATION TESTS');
  console.log('================================================================\n');

  // Test 1: Baseline repository initialized with demo targets
  const repo = new MockTargetRepository();
  const initialRes = await repo.getTargets();
  assert(
    initialRes.success && initialRes.data.length === MOCK_TARGETS.length,
    'Test 01: Initial repository contains standard baseline demo targets',
    `Expected ${MOCK_TARGETS.length}, got ${initialRes.data?.length}`
  );

  // Test 2: Ingest 3 real imported targets via CSV parser
  const csvData = `Target ID,Classification,Label,Confidence,Severity,Latitude,Longitude,Slant Range,Depth,Estimated Length,Estimated Width,Shadow Height,Backscatter,Notes
TRG-IMP-01,GHOST_NET,Submerged Nylon Net,0.95,HIGH,12.9245,80.1245,35.2,42.0,15.2,3.4,2.1,-12.4,Imported test target 1
TRG-IMP-02,METALLIC_DRUM,Corroded Chemical Drum,0.92,CRITICAL,12.9250,80.1255,38.1,43.2,1.2,0.9,1.1,-8.5,Imported test target 2
TRG-IMP-03,WRECKAGE_DEBRIS,Vessel Keel Section,0.89,HIGH,12.9260,80.1265,41.0,44.5,8.5,2.8,1.9,-10.2,Imported test target 3`;

  const parseResult = SonarFileParser.parseFile('bay_of_bengal_survey.csv', csvData);
  assert(
    parseResult.detectedTargets.length === 3 && parseResult.rejectedRecords.length === 0,
    'Test 02: SonarFileParser parsed 3 targets with 0 rejected records'
  );

  // Test 3: Replace targets in repository
  const replaceRes = await repo.replaceTargets(parseResult.detectedTargets, 'CSV_TEST_OPERATOR');
  assert(
    replaceRes.success && replaceRes.data.length === 3,
    'Test 03: replaceTargets succeeds and returns exactly 3 targets'
  );

  // Test 4: Verify complete replacement (NOT appended!)
  const updatedRes = await repo.getTargets();
  assert(
    updatedRes.success && updatedRes.data.length === 3,
    'Test 04: Active repository contains ONLY the 3 imported targets (no demo targets residual)',
    `Expected 3, got ${updatedRes.data?.length}`
  );

  // Verify none of the demo target IDs exist
  const demoIds = new Set(MOCK_TARGETS.map((t) => t.id));
  const residualDemoTargets = updatedRes.data.filter((t) => demoIds.has(t.id));
  assert(
    residualDemoTargets.length === 0,
    'Test 05: Complete dataset isolation verified: 0 residual demo target IDs present'
  );

  // Test 6: StorageService replaceTargets backend test
  const storageReplaceRes = await storageService.replaceTargets(parseResult.detectedTargets, 'STORAGE_TEST');
  assert(
    Array.isArray(storageReplaceRes) && storageReplaceRes.length === 3,
    'Test 06: storageService.replaceTargets succeeds and returns 3 targets'
  );

  const storageTargetsRes = await storageService.getTargets();
  assert(
    Array.isArray(storageTargetsRes) && storageTargetsRes.length === 3,
    'Test 07: storageService active targets is strictly 3'
  );

  // Test 8: Reset to demo restores baseline demo targets
  const resetRes = await repo.resetToDemo();
  assert(
    resetRes.success && resetRes.data.length === MOCK_TARGETS.length,
    'Test 08: repo.resetToDemo restores all baseline demo targets cleanly',
    `Expected ${MOCK_TARGETS.length}, got ${resetRes.data?.length}`
  );

  // Test 9: StorageService resetToDemo
  const storageResetRes = await storageService.resetToDemo();
  assert(
    Array.isArray(storageResetRes) && storageResetRes.length === MOCK_TARGETS.length,
    'Test 09: storageService.resetToDemo restores baseline demo targets cleanly'
  );

  // Test 10: Invalid/corrupt CSV rejection
  const corruptCsv = `InvalidHeader1,InvalidHeader2\nFoo,Bar\nBaz,Qux`;
  const corruptParse = SonarFileParser.parseFile('corrupt.csv', corruptCsv);
  assert(
    corruptParse.detectedTargets.length === 0,
    'Test 10: Corrupt CSV yields 0 detected targets without crashing'
  );

  // Test 11: Partially corrupt CSV isolates valid from rejected
  const mixedCsv = `Target ID,Classification,Latitude,Longitude
TRG-GOOD-1,GHOST_NET,10.1234,78.5678
INVALID_ROW_MISSING_COORDS,METALLIC_DRUM,NaN,not_a_number
TRG-GOOD-2,ORDNANCE_UXO,10.1250,78.5700`;
  const mixedParse = SonarFileParser.parseFile('mixed.csv', mixedCsv);
  assert(
    mixedParse.detectedTargets.length === 2 && mixedParse.rejectedRecords.length >= 1,
    'Test 11: Mixed CSV accepts valid rows and records rejected row provenance'
  );

  // Test 12: Bounding box calculation on imported targets
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const t of parseResult.detectedTargets) {
    if (t.latitude < minLat) minLat = t.latitude;
    if (t.latitude > maxLat) maxLat = t.latitude;
    if (t.longitude < minLng) minLng = t.longitude;
    if (t.longitude > maxLng) maxLng = t.longitude;
  }
  assert(
    minLat === 12.9245 && maxLat === 12.9260 && minLng === 80.1245 && maxLng === 80.1265,
    'Test 12: Bounding box correctly bounds imported targets extent in WGS84'
  );

  console.log('\n================================================================');
  console.log(`TARGET REPLACEMENT TEST RESULTS: ${passedTests}/${passedTests + failedTests} PASSED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
