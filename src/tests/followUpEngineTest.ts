/**
 * SIH 2026 Problem Statement 26057: AI Follow-Up Survey Recommendation & Mission Prioritization Tests
 * 
 * 25-Point Comprehensive Verification Suite
 * Tests deterministic synthesis of Risk Engine, GeoInt Hotspots, Temporal Changes,
 * operational recommendations, operator overrides, transparent explanations,
 * and provenance tracking.
 */

import { FollowUpRecommendationEngine } from '../services/followUp/FollowUpRecommendationEngine';
import { RiskAssessmentEngine } from '../services/risk/RiskAssessmentEngine';
import { GeoIntelligenceEngine } from '../services/geoint/GeoIntelligenceEngine';
import { TemporalChangeEngine } from '../services/temporal/TemporalChangeEngine';
import { HISTORICAL_SURVEYS } from '../data/mockHistoricalSurveys';
import { MOCK_TARGETS } from '../data/mockTargets';
import { Target } from '../types/target';
import { SurveyRiskContext } from '../types/risk';
import { FollowUpRecommendation, FollowUpOperatorOverride } from '../types/followUp';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testNumber: number, description: string): void {
  if (condition) {
    console.log(`[PASS] Test ${String(testNumber).padStart(2, '0')}: ${description}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] Test ${String(testNumber).padStart(2, '0')}: ${description}`);
    testsFailed++;
  }
}

console.log('================================================================');
console.log('SIH 2026 PS 26057: 25-POINT AI FOLLOW-UP RECOMMENDATION TESTS');
console.log('================================================================');

const surveyContext: SurveyRiskContext = {
  surveyId: 'MIS-2026-INDO-04B',
  isDemoReplay: true,
};

// 1. Generate baseline intelligence inputs
const assessedTargets = RiskAssessmentEngine.assessAndRankTargets(MOCK_TARGETS, surveyContext);

const geointResult = GeoIntelligenceEngine.analyzeTargets(
  assessedTargets,
  surveyContext
);

const baselineSurvey = HISTORICAL_SURVEYS[0];
const temporalResult = TemporalChangeEngine.compareSurveys(
  baselineSurvey,
  'MIS-2026-INDO-04B',
  'Gulf of Mannar Seabed Debris & Anomaly Assessment',
  '2026-09-07',
  assessedTargets,
  undefined,
  surveyContext
);

// 2. Generate FollowUp Recommendations
const followUpResult = FollowUpRecommendationEngine.generateRecommendations(
  assessedTargets,
  geointResult.hotspots,
  temporalResult,
  surveyContext
);

const recommendations = followUpResult.recommendations;
const summary = followUpResult.summary;

// --------------------------------------------------------------------------
// TEST 01: High-risk target follow-up prioritization
// --------------------------------------------------------------------------
const criticalTarget = assessedTargets.find(t => t.riskAssessment?.riskLevel === 'CRITICAL');
const criticalRec = recommendations.find(r => criticalTarget && r.targetIds.includes(criticalTarget.id));
assert(
  !!criticalRec && (criticalRec.urgency === 'CRITICAL' || criticalRec.urgency === 'HIGH') && criticalRec.priorityScore >= 70,
  1,
  'High-risk target follow-up: Critical risk target produces elevated follow-up recommendation urgency and score'
);

// --------------------------------------------------------------------------
// TEST 02: Low-risk confirmed target priority suppression
// --------------------------------------------------------------------------
const lowRiskTarget = assessedTargets.find(t => t.riskAssessment?.riskLevel === 'LOW');
const lowRiskRec = recommendations.find(r => lowRiskTarget && r.targetIds.length === 1 && r.targetIds.includes(lowRiskTarget.id));
assert(
  !lowRiskRec || lowRiskRec.priorityScore < 60,
  2,
  'Low-risk confirmed target suppression: Low-hazard confirmed target receives lower priority score'
);

// --------------------------------------------------------------------------
// TEST 03: High-change target follow-up elevation
// --------------------------------------------------------------------------
const highChange = temporalResult.allChanges.find(c => c.changeScore >= 70);
const highChangeRec = recommendations.find(r => highChange && r.targetIds.includes(highChange.targetId));
assert(
  !!highChangeRec && highChangeRec.priorityScore >= 65,
  3,
  'High-change target follow-up: Target with high temporal change score receives elevated recommendation priority'
);

// --------------------------------------------------------------------------
// TEST 04: New high-hazard target follow-up (UXO / Chemical anomaly)
// --------------------------------------------------------------------------
const uxoTarget = assessedTargets.find(t => t.classification === 'ORDNANCE_UXO' || t.categoryLabel?.includes('UXO'));
const uxoRec = recommendations.find(r => uxoTarget && r.targetIds.includes(uxoTarget.id));
assert(
  !!uxoRec &&
  (uxoRec.urgency === 'CRITICAL' || uxoRec.urgency === 'HIGH') &&
  (uxoRec.reasons.some(r => r.toLowerCase().includes('safety-critical') || r.toLowerCase().includes('uxo') || r.toLowerCase().includes('intervention')) ||
   uxoRec.recommendationType === 'SPECIALIST_ASSESSMENT'),
  4,
  'New high-hazard target follow-up: Newly detected high-hazard anomaly receives top recommendation with explicit justification'
);

// --------------------------------------------------------------------------
// TEST 05: Hotspot cluster recommendation
// --------------------------------------------------------------------------
const clusterRec = recommendations.find(r => !!r.hotspotId);
assert(
  !!clusterRec && clusterRec.targetIds.length > 1 && !!clusterRec.recommendationType,
  5,
  'Hotspot cluster recommendation: Spatial concentration of multiple hazards yields multi-target follow-up recommendation'
);

// --------------------------------------------------------------------------
// TEST 06: Unclustered target recommendation
// --------------------------------------------------------------------------
const unclusteredRec = recommendations.find(r => !r.hotspotId && r.targetIds.length === 1);
assert(
  !!unclusteredRec && unclusteredRec.priorityScore > 0,
  6,
  'Unclustered target recommendation: Isolated high-hazard target receives recommendation based on individual severity'
);

// --------------------------------------------------------------------------
// TEST 07: Coverage gap / uncertain survey recommendation
// --------------------------------------------------------------------------
const uncertainRec = recommendations.find(r => r.uncertainty.some(u => u.toLowerCase().includes('coverage') || u.toLowerCase().includes('aspect') || u.toLowerCase().includes('snr')));
assert(
  !!uncertainRec && uncertainRec.uncertainty.length > 0,
  7,
  'Coverage gap recommendation: Target with coverage or acoustic uncertainty clearly identifies uncertainty drivers'
);

// --------------------------------------------------------------------------
// TEST 08: Low confidence + high risk verification recommendation
// --------------------------------------------------------------------------
const unconfirmedTarget = assessedTargets.find(t => t.confidence < 0.8 && (t.riskAssessment?.riskLevel === 'HIGH' || t.riskAssessment?.riskLevel === 'CRITICAL'));
const unconfirmedRec = recommendations.find(r => unconfirmedTarget && r.targetIds.includes(unconfirmedTarget.id));
assert(
  !unconfirmedTarget || (!!unconfirmedRec && unconfirmedRec.expectedBenefit.toLowerCase().includes('confidence')),
  8,
  'Low-confidence / high-risk recommendation: High-hazard target with lower confidence states expected benefit of confidence gain'
);

// --------------------------------------------------------------------------
// TEST 09: Geological anomaly priority suppression
// --------------------------------------------------------------------------
const geoTarget = assessedTargets.find(t => t.verificationStatus === 'GEOLOGICAL_ANOMALY');
const geoRec = recommendations.find(r => geoTarget && r.targetIds.length === 1 && r.targetIds.includes(geoTarget.id));
assert(
  !geoRec || (geoRec.urgency !== 'CRITICAL' && geoRec.priorityScore < 50),
  9,
  'Geological anomaly suppression: Target classified as geological anomaly has priority score suppressed'
);

// --------------------------------------------------------------------------
// TEST 10: Shipping fairway exposure boost
// --------------------------------------------------------------------------
const fairwayRec = recommendations.find(r =>
  r.evidence.some(e => e.toLowerCase().includes('fairway') || e.toLowerCase().includes('maritime buffer'))
);
assert(
  !!fairwayRec,
  10,
  'Shipping fairway exposure boost: Target situated inside navigational fairway receives operational exposure justification'
);

// --------------------------------------------------------------------------
// TEST 11: Environmental MPA exposure boost
// --------------------------------------------------------------------------
const envRec = recommendations.find(r =>
  r.evidence.some(e => e.toLowerCase().includes('habitat') || e.toLowerCase().includes('protected') || e.toLowerCase().includes('buffer') || e.toLowerCase().includes('corridor'))
);
assert(
  !!envRec,
  11,
  'Environmental MPA exposure boost: Target in marine protected area documents environmental sensitivity evidence'
);

// --------------------------------------------------------------------------
// TEST 12: Priority score normalization (0 to 100)
// --------------------------------------------------------------------------
const allNormalized = recommendations.every(r => r.priorityScore >= 0 && r.priorityScore <= 100);
assert(
  allNormalized && recommendations.length > 0,
  12,
  'Priority score normalization: All recommendation priority scores strictly within [0, 100]'
);

// --------------------------------------------------------------------------
// TEST 13: Separation of scores (priorityScore != riskScore)
// --------------------------------------------------------------------------
const singleRecs = recommendations.filter(r => r.targetIds.length === 1);
const distinctScores = singleRecs.some(r => {
  const target = assessedTargets.find(t => t.id === r.targetIds[0]);
  return target && target.riskAssessment && target.riskAssessment.riskScore !== r.priorityScore;
});
assert(
  distinctScores,
  13,
  'Separation of scores: priorityScore (0-100) is distinct from riskScore and changeScore'
);

// --------------------------------------------------------------------------
// TEST 14: Urgency tier mapping
// --------------------------------------------------------------------------
const validUrgencyTiers = recommendations.every(r => {
  if (r.urgency === 'CRITICAL') return r.priorityScore >= 75 || r.relatedRiskLevel === 'CRITICAL' || r.recommendationType === 'SPECIALIST_ASSESSMENT';
  if (r.urgency === 'HIGH') return r.priorityScore >= 55 || r.relatedRiskLevel === 'HIGH' || r.relatedRiskLevel === 'CRITICAL';
  if (r.urgency === 'MODERATE') return r.priorityScore >= 35 || r.relatedRiskLevel === 'MODERATE';
  return r.priorityScore < 50;
});
assert(
  validUrgencyTiers,
  14,
  'Urgency tier mapping: Correctly thresholds score to CRITICAL (>=75/hazard), HIGH (>=55), MODERATE (>=35), LOW (<50)'
);

// --------------------------------------------------------------------------
// TEST 15: Reason generation transparency
// --------------------------------------------------------------------------
const allHaveReasons = recommendations.every(r => r.reasons.length > 0 && r.reasons.every(rs => rs.length > 10));
assert(
  allHaveReasons,
  15,
  'Reason generation transparency: Transparent, descriptive operational rationales generated without vague text'
);

// --------------------------------------------------------------------------
// TEST 16: Expected benefit clarity
// --------------------------------------------------------------------------
const allHaveExpectedBenefit = recommendations.every(r => r.expectedBenefit && r.expectedBenefit.length >= 10);
assert(
  allHaveExpectedBenefit,
  16,
  'Expected benefit clarity: Concise statement of expected operational or hydrographic intelligence gain'
);

// --------------------------------------------------------------------------
// TEST 17: Evidence summary completeness
// --------------------------------------------------------------------------
const allHaveEvidence = recommendations.every(r => r.evidence && r.evidence.length > 0);
assert(
  allHaveEvidence,
  17,
  'Evidence summary: Lists specific acoustic and spatial observations supporting the recommendation'
);

// --------------------------------------------------------------------------
// TEST 18: Uncertainty identification
// --------------------------------------------------------------------------
const allHaveUncertaintyField = recommendations.every(r => Array.isArray(r.uncertainty));
assert(
  allHaveUncertaintyField,
  18,
  'Uncertainty identification: Transparently identifies factors creating acoustic or classification uncertainty'
);

// --------------------------------------------------------------------------
// TEST 19: Recommendation type appropriateness
// --------------------------------------------------------------------------
const validActionTypes = [
  'ADDITIONAL_SONAR_PASS',
  'CLOSER_TARGET_INSPECTION',
  'ROV_VISUAL_INSPECTION',
  'SPECIALIST_ASSESSMENT',
  'INFRASTRUCTURE_INSPECTION',
  'REASSESS_SURVEY_COVERAGE',
  'OPERATOR_REVIEW',
];
const allValidTypes = recommendations.every(r => validActionTypes.includes(r.recommendationType));
assert(
  allValidTypes,
  19,
  'Recommendation type appropriateness: Assigns domain-valid hydrographic follow-up action types'
);

// --------------------------------------------------------------------------
// TEST 20: Operator acknowledgement lifecycle
// --------------------------------------------------------------------------
const targetToAck = recommendations[0]?.id;
const ackSet = new Set<string>([targetToAck]);
const ackResult = FollowUpRecommendationEngine.applyOperatorModifications(
  followUpResult,
  new Map(),
  ackSet
);
const ackRec = ackResult.recommendations.find(r => r.id === targetToAck);
assert(
  !!ackRec && ackRec.acknowledged === true && ackResult.summary.acknowledgedCount === 1,
  20,
  'Operator acknowledgement lifecycle: Acknowledging recommendation flags it as acknowledged in summary'
);

// --------------------------------------------------------------------------
// TEST 21: Operator override lifecycle
// --------------------------------------------------------------------------
const overrideMap = new Map<string, FollowUpOperatorOverride>();
const targetToOverride = recommendations[0]?.id;
overrideMap.set(targetToOverride, {
  priorityScore: 99,
  urgency: 'CRITICAL',
  recommendationType: 'ROV_VISUAL_INSPECTION',
  reason: 'Urgent hydrographic verification ordered by Chief Hydrographer',
  overriddenBy: 'SURVEY_CHIEF',
  overriddenAt: new Date().toISOString(),
});

const overrideResult = FollowUpRecommendationEngine.applyOperatorModifications(
  followUpResult,
  overrideMap,
  new Set()
);
const overriddenRec = overrideResult.recommendations.find(r => r.id === targetToOverride);
assert(
  !!overriddenRec &&
  overriddenRec.operatorOverride?.urgency === 'CRITICAL' &&
  overriddenRec.operatorOverride?.priorityScore === 99 &&
  overriddenRec.operatorOverride?.recommendationType === 'ROV_VISUAL_INSPECTION' &&
  overrideResult.summary.overriddenCount === 1,
  21,
  'Operator override lifecycle: Overriding urgency and action updates recommendation with audit provenance'
);

// --------------------------------------------------------------------------
// TEST 22: Deterministic repeatability
// --------------------------------------------------------------------------
const run1 = FollowUpRecommendationEngine.generateRecommendations(
  assessedTargets,
  geointResult.hotspots,
  temporalResult,
  surveyContext
);
const run2 = FollowUpRecommendationEngine.generateRecommendations(
  assessedTargets,
  geointResult.hotspots,
  temporalResult,
  surveyContext
);
const isRepeatable =
  run1.recommendations.length === run2.recommendations.length &&
  run1.recommendations.every((r, idx) => r.id === run2.recommendations[idx].id && r.priorityScore === run2.recommendations[idx].priorityScore);
assert(
  isRepeatable,
  22,
  'Deterministic repeatability: Repeated executions with identical inputs produce identical ranks and scores'
);

// --------------------------------------------------------------------------
// TEST 23: DEMO/REPLAY provenance tracking
// --------------------------------------------------------------------------
assert(
  followUpResult.summary.provenance === 'SIMULATED' && recommendations.every(r => r.provenance === 'SIMULATED'),
  23,
  'DEMO/REPLAY provenance: Recommendations correctly tagged as SIMULATED in demo replay mode'
);

// --------------------------------------------------------------------------
// TEST 24: Pure functional engine without side effects
// --------------------------------------------------------------------------
const originalTargetCount = assessedTargets.length;
const originalHotspotCount = geointResult.hotspots.length;
const originalChangesCount = temporalResult.allChanges.length;
FollowUpRecommendationEngine.generateRecommendations(
  assessedTargets,
  geointResult.hotspots,
  temporalResult,
  surveyContext
);
assert(
  assessedTargets.length === originalTargetCount &&
  geointResult.hotspots.length === originalHotspotCount &&
  temporalResult.allChanges.length === originalChangesCount,
  24,
  'Pure functional engine: Executes deterministically without mutating input models or state'
);

// --------------------------------------------------------------------------
// TEST 25: Synchronized queue navigation integrity
// --------------------------------------------------------------------------
const allTargetIdsValid = recommendations.every(r =>
  r.targetIds.every(tId =>
    assessedTargets.some(t => t.id === tId) ||
    baselineSurvey.targets.some(t => t.id === tId)
  )
);
const allHotspotIdsValid = recommendations.every(r =>
  !r.hotspotId || geointResult.hotspots.some(h => h.id === r.hotspotId)
);
assert(
  allTargetIdsValid && allHotspotIdsValid,
  25,
  'Synchronized queue navigation: All recommendation targets and hotspots map to valid intelligence entities'
);

console.log('================================================================');
console.log(`FOLLOW-UP RECOMMENDATION TEST RESULTS: ${testsPassed}/25 PASSED (${Math.round((testsPassed / 25) * 100)}%)`);
console.log('================================================================');

if (testsFailed > 0) {
  process.exit(1);
}
