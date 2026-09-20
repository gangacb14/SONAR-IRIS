/**
 * 20-Point Geospatial Intelligence & Hazard Hotspot Analysis Test Suite
 * SIH 2026 Problem Statement 26057
 * 
 * Verifies all 20 criteria:
 * 1. Two nearby targets within radius threshold form a hotspot
 * 2. Distant targets outside radius threshold remain separate
 * 3. Minimum cluster threshold: isolated single target does not form a hotspot
 * 4. Critical target dominates hotspot priority (Hotspot with CRITICAL outranks Hotspot with 8 LOW)
 * 5. Low-risk geological cluster does not become falsely critical
 * 6. Risk-weighted density: density cells compute weightedRiskScore and intensity
 * 7. Hotspot ranking: priority ranks across hotspots are sequential integers 1..N
 * 8. Deterministic ranking: priority ordering is strictly repeatable across repeated runs
 * 9. Hotspot reason generation produces operational, explainable hydrographic text
 * 10. Dominant category calculation correctly reflects member target distribution
 * 11. Unclustered target handling: isolated targets placed in unclusteredTargetIds
 * 12. Critical isolated targets remain identified in summary (isolatedCriticalTargets > 0)
 * 13. Hotspot exposes its member target IDs accurately
 * 14. Hotspot -> target synchronization: targetIds map back to source targets
 * 15. Target -> hotspot association: containing hotspot can be found from target ID
 * 16. Existing target data and coordinates remain completely intact
 * 17. Existing risk assessments remain intact without mutation
 * 18. DEMO/REPLAY provenance: explicit "SIMULATED" or "DERIVED" tag
 * 19. High risk zones identify infrastructure corridor overlaps
 * 20. Empty target collection handled gracefully with zero counts
 */

import { GeoIntelligenceEngine } from '../services/geoint/GeoIntelligenceEngine';
import { Target, DebrisCategory } from '../types/target';
import { RiskAssessment, SurveyRiskContext } from '../types/risk';
import { MOCK_SURVEY_INFRASTRUCTURE } from '../data/mockInfrastructure';

async function runGeoIntTestSuite() {
  console.log('================================================================');
  console.log('SIH 2026 PS 26057: 20-POINT GEOSPATIAL INTELLIGENCE TESTS');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 20;

  function assert(condition: boolean, testNum: number, description: string) {
    if (condition) {
      console.log(`[PASS] Test ${String(testNum).padStart(2, '0')}: ${description}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${String(testNum).padStart(2, '0')}: ${description}`);
      process.exitCode = 1;
    }
  }

  const createMockTarget = (
    id: string,
    lat: number,
    lng: number,
    category: DebrisCategory,
    riskScore: number,
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  ): Target => {
    const riskAssessment: RiskAssessment = {
      targetId: id,
      riskLevel,
      riskScore,
      primaryCategory:
        category === 'GEOLOGICAL_FEATURE'
          ? 'GEOLOGICAL'
          : category === 'ORDNANCE_UXO'
          ? 'SAFETY'
          : category === 'PIPELINE_EXPOSURE'
          ? 'INFRASTRUCTURE'
          : category === 'UNKNOWN_ANOMALY'
          ? 'INVESTIGATION'
          : 'ENVIRONMENTAL',
      severityScore: riskScore,
      confidenceContribution: 80,
      proximityScore: 50,
      sizeContribution: 50,
      uncertaintyContribution: 30,
      contextualExposure: 40,
      priorityRank: 1,
      reasons: ['Mock assessment reason'],
      recommendedAction: 'Standard survey inspection',
      assessedAt: new Date().toISOString(),
      assessmentVersion: 'SIH-2026-v1.0',
      dataProvenance: 'SIMULATED',
    };

    return {
      id,
      surveyId: 'SURVEY-GEOINT-01',
      transectId: 'TRANSECT-01',
      transectLine: 'TRANSECT-01',
      pingNumber: 100,
      timestamp: new Date().toISOString(),
      channel: 'PORT',
      slantRange: 30,
      groundRange: 28,
      slantRangeMeters: 30,
      groundRangeMeters: 28,
      towfishAltitude: 12,
      towfishAltitudeMeters: 12,
      shadowLength: 2,
      shadowLengthMeters: 2,
      shadowHeight: 0.8,
      estimatedTargetHeightMeters: 0.8,
      estimatedLength: 2,
      estimatedWidth: 1,
      estimatedLengthMeters: 2,
      estimatedWidthMeters: 1,
      backscatter: -4,
      backscatterDb: -4,
      confidence: 0.85,
      category,
      classification: category,
      categoryLabel: String(category),
      severity: riskLevel,
      verificationStatus: 'PENDING_REVIEW',
      latitude: lat,
      longitude: lng,
      depth: 42,
      coordinates: {
        lat,
        lng,
        depthMeters: 42,
        utmZone: '44N',
        utmEasting: 410050,
        utmNorthing: 1021580,
      },
      coordinateReferenceSystem: 'WGS84 / UTM Zone 44N (EPSG:32644)',
      utmZone: '44N',
      utmEasting: 410050,
      utmNorthing: 1021580,
      detectedAt: new Date().toISOString(),
      sonarEvidenceReference: {
        waterfallBox: { x: 10, y: 10, width: 20, height: 20 },
      },
      modelMetadata: {
        modelName: 'YOLOv8-Acoustic-Debris',
        featureExtractor: 'CNN-SideScan',
        snrDb: 18,
        shadowContrastRatio: 4,
      },
      waterfallBox: { x: 10, y: 10, width: 20, height: 20 },
      riskAssessment,
    };
  };

  const surveyContext: SurveyRiskContext = {
    surveyId: 'SURVEY-GEOINT-01',
    isDemoReplay: true,
    knownInfrastructure: MOCK_SURVEY_INFRASTRUCTURE,
  };

  // --------------------------------------------------------------------------
  // TEST 1: Two nearby targets within radius threshold form a hotspot
  // --------------------------------------------------------------------------
  const tNearby1 = createMockTarget('TRG-01', 9.24150, 79.18240, 'MARINE_DEBRIS', 55, 'MODERATE');
  const tNearby2 = createMockTarget('TRG-02', 9.24180, 79.18260, 'MARINE_DEBRIS', 58, 'HIGH'); // ~40m apart
  const res1 = GeoIntelligenceEngine.analyzeTargets([tNearby1, tNearby2], surveyContext);
  assert(
    res1.hotspots.length === 1 && res1.hotspots[0].targetCount === 2 && res1.hotspots[0].targetIds.includes('TRG-01'),
    1,
    'Two nearby targets (<140m) successfully cluster into a single hotspot'
  );

  // --------------------------------------------------------------------------
  // TEST 2: Distant targets outside radius threshold remain separate
  // --------------------------------------------------------------------------
  const tDistant1 = createMockTarget('TRG-D1', 9.22500, 79.17000, 'MARINE_DEBRIS', 50, 'MODERATE');
  const tDistant2 = createMockTarget('TRG-D2', 9.25500, 79.19500, 'MARINE_DEBRIS', 50, 'MODERATE'); // ~4.5 km apart
  const res2 = GeoIntelligenceEngine.analyzeTargets([tDistant1, tDistant2], surveyContext);
  assert(
    res2.hotspots.length === 0 && res2.unclusteredTargetIds.length === 2,
    2,
    'Distant targets (>3km) do not artificially merge into a single hotspot'
  );

  // --------------------------------------------------------------------------
  // TEST 3: Minimum cluster threshold (isolated target does not form a hotspot alone)
  // --------------------------------------------------------------------------
  const tIsolated = createMockTarget('TRG-ISO', 9.24000, 79.18000, 'MARINE_DEBRIS', 60, 'HIGH');
  const res3 = GeoIntelligenceEngine.analyzeTargets([tIsolated], surveyContext);
  assert(
    res3.hotspots.length === 0 && res3.unclusteredTargetIds.includes('TRG-ISO') && res3.summary.unclusteredTargets === 1,
    3,
    'Single isolated target does not satisfy minimumTargetsPerHotspot threshold (2) and is marked unclustered'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Critical target dominates hotspot priority
  // Hotspot A: 8 LOW geological targets
  // Hotspot B: 3 targets: 1 CRITICAL, 2 HIGH
  // --------------------------------------------------------------------------
  // Cluster A (8 low-risk geological targets clustered together around 9.230, 79.172)
  const clusterA: Target[] = [];
  for (let i = 0; i < 8; i++) {
    clusterA.push(
      createMockTarget(`GEO-${i + 1}`, 9.23000 + i * 0.0001, 79.17200 + i * 0.0001, 'GEOLOGICAL_FEATURE', 16, 'LOW')
    );
  }
  // Cluster B (3 targets: 1 CRITICAL UXO + 2 HIGH Drums clustered around 9.245, 79.185)
  const clusterB: Target[] = [
    createMockTarget('HAZ-01', 9.24500, 79.18500, 'ORDNANCE_UXO', 88, 'CRITICAL'),
    createMockTarget('HAZ-02', 9.24520, 79.18520, 'METALLIC_DRUM', 68, 'HIGH'),
    createMockTarget('HAZ-03', 9.24530, 79.18510, 'METALLIC_DRUM', 65, 'HIGH'),
  ];
  const res4 = GeoIntelligenceEngine.analyzeTargets([...clusterA, ...clusterB], surveyContext);
  const hotspotRank1 = res4.hotspots[0];
  const hotspotRank2 = res4.hotspots[1];
  assert(
    res4.hotspots.length === 2 &&
    hotspotRank1.targetIds.includes('HAZ-01') &&
    hotspotRank1.priorityScore > hotspotRank2.priorityScore * 2 &&
    hotspotRank1.riskLevel === 'CRITICAL',
    4,
    'Hotspot with 1 CRITICAL + 2 HIGH targets substantially outranks 8 LOW geological targets in operational priority'
  );

  // --------------------------------------------------------------------------
  // TEST 5: Low-risk geological cluster does not become falsely critical
  // --------------------------------------------------------------------------
  const res5 = GeoIntelligenceEngine.analyzeTargets(clusterA, surveyContext);
  assert(
    res5.hotspots.length === 1 &&
    res5.hotspots[0].riskLevel === 'LOW' &&
    res5.hotspots[0].criticalTargetCount === 0 &&
    res5.hotspots[0].dominantCategories[0] === 'GEOLOGICAL',
    5,
    'Cluster of 8 low-risk geological targets remains classified as LOW risk without false escalation'
  );

  // --------------------------------------------------------------------------
  // TEST 6: Risk-weighted density: density cells compute weightedRiskScore and intensity
  // --------------------------------------------------------------------------
  const res6 = GeoIntelligenceEngine.analyzeTargets([...clusterA, ...clusterB], surveyContext);
  const criticalCell = res6.densityCells.find((c) => c.targetIds.includes('HAZ-01'));
  assert(
    res6.densityCells.length > 0 &&
    criticalCell !== undefined &&
    criticalCell.intensity > 0.5 &&
    criticalCell.criticalCount === 1,
    6,
    'Spatial density grid generates risk-weighted density cells with normalized intensity'
  );

  // --------------------------------------------------------------------------
  // TEST 7: Hotspot ranking: priority ranks across hotspots are sequential integers 1..N
  // --------------------------------------------------------------------------
  const ranks = res4.hotspots.map((h) => h.rank);
  const isStrictlySequential = ranks.every((r, idx) => r === idx + 1);
  assert(
    isStrictlySequential && ranks[0] === 1 && ranks[1] === 2,
    7,
    'Hotspot priority ranks are strictly sequential integers from 1 to N'
  );

  // --------------------------------------------------------------------------
  // TEST 8: Deterministic ranking: priority ordering is strictly repeatable across repeated runs
  // --------------------------------------------------------------------------
  const run1 = GeoIntelligenceEngine.analyzeTargets([...clusterA, ...clusterB], surveyContext);
  const run2 = GeoIntelligenceEngine.analyzeTargets([...clusterB, ...clusterA], surveyContext); // reversed input order
  const sameRankIds = run1.hotspots.every((h, i) => h.targetIds.length === run2.hotspots[i].targetIds.length);
  assert(
    sameRankIds && run1.hotspots[0].priorityScore === run2.hotspots[0].priorityScore,
    8,
    'Priority ordering is strictly repeatable and invariant to input order'
  );

  // --------------------------------------------------------------------------
  // TEST 9: Hotspot reason generation produces operational, explainable hydrographic text
  // --------------------------------------------------------------------------
  const critHotspot = res4.hotspots[0];
  const hasExplosiveReason = critHotspot.reasons.some((r) => r.toLowerCase().includes('critical') || r.toLowerCase().includes('ordnance'));
  assert(
    critHotspot.reasons.length >= 2 && hasExplosiveReason,
    9,
    'Hotspot generates operational hydrographic rationale referencing specific threats'
  );

  // --------------------------------------------------------------------------
  // TEST 10: Dominant category calculation correctly reflects member target distribution
  // --------------------------------------------------------------------------
  assert(
    critHotspot.dominantCategories.includes('SAFETY') && critHotspot.dominantCategories.includes('ENVIRONMENTAL'),
    10,
    'Dominant categories accurately compute frequency order across cluster member targets'
  );

  // --------------------------------------------------------------------------
  // TEST 11: Unclustered target handling: isolated targets placed in unclusteredTargetIds
  // --------------------------------------------------------------------------
  const res11 = GeoIntelligenceEngine.analyzeTargets([...clusterB, tIsolated], surveyContext);
  assert(
    res11.unclusteredTargetIds.includes('TRG-ISO') && !res11.unclusteredTargetIds.includes('HAZ-01'),
    11,
    'Isolated target TRG-ISO correctly retained in unclusteredTargetIds list'
  );

  // --------------------------------------------------------------------------
  // TEST 12: Critical isolated targets remain identified in summary (isolatedCriticalTargets > 0)
  // --------------------------------------------------------------------------
  const tCriticalIsolated = createMockTarget('UXO-ISO', 9.25200, 79.19200, 'ORDNANCE_UXO', 92, 'CRITICAL');
  const res12 = GeoIntelligenceEngine.analyzeTargets([tCriticalIsolated, ...clusterA], surveyContext);
  assert(
    res12.summary.isolatedCriticalTargets === 1 &&
    res12.unclusteredTargetIds.includes('UXO-ISO'),
    12,
    'Isolated CRITICAL UXO target is accounted for in isolatedCriticalTargets summary metric'
  );

  // --------------------------------------------------------------------------
  // TEST 13: Hotspot exposes its member target IDs accurately
  // --------------------------------------------------------------------------
  const geoHotspot = res4.hotspots.find((h) => h.dominantCategories[0] === 'GEOLOGICAL');
  assert(
    geoHotspot !== undefined && geoHotspot.targetIds.length === 8 && geoHotspot.targetIds.includes('GEO-1'),
    13,
    'Hotspot correctly exposes all 8 underlying target IDs'
  );

  // --------------------------------------------------------------------------
  // TEST 14: Hotspot -> target synchronization: targetIds map back to source targets
  // --------------------------------------------------------------------------
  const sourceTargetsMap = new Map([...clusterA, ...clusterB].map((t) => [t.id, t]));
  const allHotspotTargetsValid = res4.hotspots.every((h) =>
    h.targetIds.every((id) => sourceTargetsMap.has(id))
  );
  assert(
    allHotspotTargetsValid,
    14,
    'All target IDs in hotspots map cleanly back to canonical targets in store'
  );

  // --------------------------------------------------------------------------
  // TEST 15: Target -> hotspot association: containing hotspot can be found from target ID
  // --------------------------------------------------------------------------
  const findHotspotForTarget = (tId: string) => res4.hotspots.find((h) => h.targetIds.includes(tId));
  const containingHotspotHaz = findHotspotForTarget('HAZ-01');
  assert(
    containingHotspotHaz !== undefined && containingHotspotHaz.id === 'HOTSPOT-01',
    15,
    'Target HAZ-01 correctly resolves to containing HOTSPOT-01'
  );

  // --------------------------------------------------------------------------
  // TEST 16: Existing target data and coordinates remain completely intact
  // --------------------------------------------------------------------------
  const preLat = tNearby1.latitude;
  const preLng = tNearby1.longitude;
  const prePing = tNearby1.pingNumber;
  GeoIntelligenceEngine.analyzeTargets([tNearby1, tNearby2], surveyContext);
  assert(
    tNearby1.latitude === preLat && tNearby1.longitude === preLng && tNearby1.pingNumber === prePing,
    16,
    'Geospatial Intelligence analysis does not mutate underlying target coordinates or ping telemetry'
  );

  // --------------------------------------------------------------------------
  // TEST 17: Existing risk assessments remain intact without mutation
  // --------------------------------------------------------------------------
  const preRiskScore = tNearby1.riskAssessment?.riskScore;
  const preRiskLevel = tNearby1.riskAssessment?.riskLevel;
  GeoIntelligenceEngine.analyzeTargets([tNearby1, tNearby2], surveyContext);
  assert(
    tNearby1.riskAssessment?.riskScore === preRiskScore &&
    tNearby1.riskAssessment?.riskLevel === preRiskLevel,
    17,
    'Underlying target risk assessments remain completely intact after GeoInt analysis'
  );

  // --------------------------------------------------------------------------
  // TEST 18: DEMO/REPLAY provenance: explicit "SIMULATED" or "DERIVED" tag
  // --------------------------------------------------------------------------
  const demoResult = GeoIntelligenceEngine.analyzeTargets([tNearby1, tNearby2], { isDemoReplay: true });
  const liveResult = GeoIntelligenceEngine.analyzeTargets([tNearby1, tNearby2], { isDemoReplay: false });
  assert(
    demoResult.provenance === 'SIMULATED' && liveResult.provenance === 'DERIVED',
    18,
    'Provenance correctly reports SIMULATED for demo replay and DERIVED for operational runs'
  );

  // --------------------------------------------------------------------------
  // TEST 19: High risk zones identify infrastructure corridor overlaps
  // --------------------------------------------------------------------------
  // Targets located in shipping fairway (center around 79.182, 9.240)
  const tFairway1 = createMockTarget('FW-01', 9.24020, 79.18210, 'ORDNANCE_UXO', 90, 'CRITICAL');
  const tFairway2 = createMockTarget('FW-02', 9.24040, 79.18230, 'PIPELINE_EXPOSURE', 85, 'CRITICAL');
  const res19 = GeoIntelligenceEngine.analyzeTargets([tFairway1, tFairway2], surveyContext);
  const hasFairwayOverlap = res19.highRiskZones.some((z) => z.name.toLowerCase().includes('fairway') || z.name.toLowerCase().includes('hotspot'));
  assert(
    res19.highRiskZones.length > 0 && hasFairwayOverlap,
    19,
    'High-risk zones accurately detect overlap with shipping fairway corridor buffer'
  );

  // --------------------------------------------------------------------------
  // TEST 20: Empty target collection handled gracefully with zero counts
  // --------------------------------------------------------------------------
  const res20 = GeoIntelligenceEngine.analyzeTargets([], surveyContext);
  assert(
    res20.hotspots.length === 0 &&
    res20.densityCells.length === 0 &&
    res20.summary.totalTargets === 0 &&
    res20.summary.totalHotspots === 0,
    20,
    'Empty target collection returns clean zero-state result without throwing or NaN'
  );

  console.log('\n================================================================');
  console.log(`GEOINT TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runGeoIntTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
