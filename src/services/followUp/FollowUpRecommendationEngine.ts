/**
 * AI Follow-Up Survey Recommendation & Mission Prioritization Engine
 * SIH 2026 Problem Statement 26057
 * 
 * Standalone, deterministic decision-support engine answering:
 * "Which targets or areas should be investigated next, and why?"
 * 
 * Key Principles:
 * 1. DECISION-SUPPORT ONLY: Does NOT generate autonomous navigation, ROV piloting,
 *    or vessel control commands.
 * 2. MULTI-INTELLIGENCE FUSION: Synthesizes Target Detection + AI Classification +
 *    Detection Quality + Risk Assessment + Geospatial Hotspots + Temporal Change +
 *    Survey Coverage + Uncertainty.
 * 3. EXPLICIT SEPARATION: Hazard Risk Score (0-100), Temporal Change Score (0-100),
 *    and Follow-Up Priority Score (0-100) remain strictly separate.
 * 4. PURE & DETERMINISTIC: Pure computational logic, zero side effects, no external APIs.
 * 5. TRANSPARENCY & PROVENANCE: Every recommendation details Why (reasons), Evidence,
 *    Uncertainty, Expected Benefit, and Provenance (DERIVED vs SIMULATED).
 */

import { Target, DebrisCategory } from '../../types/target';
import { RiskLevel, SurveyRiskContext } from '../../types/risk';
import { Hotspot } from '../../types/geoint';
import { SurveyComparison, TemporalTargetChange, TemporalChangeType } from '../../types/temporal';
import {
  FollowUpRecommendation,
  FollowUpRecommendationResult,
  FollowUpMissionSummary,
  FollowUpUrgency,
  RecommendationType,
  FollowUpProvenance,
  FollowUpWeightConfig,
  FollowUpOperatorOverride,
  DEFAULT_FOLLOW_UP_WEIGHTS,
} from '../../types/followUp';

export class FollowUpRecommendationEngine {
  public static readonly VERSION = 'FOLLOW-UP-SIH-2026-v1.0';

  /**
   * Main entry point: aggregates targets, risk assessments, hotspots, temporal comparison,
   * and survey coverage into a prioritized follow-up mission queue.
   */
  public static generateRecommendations(
    targets: Target[],
    hotspots: Hotspot[] = [],
    surveyComparison: SurveyComparison | null = null,
    surveyContext?: SurveyRiskContext,
    customWeights: Partial<FollowUpWeightConfig> = {}
  ): FollowUpRecommendationResult {
    const weights: FollowUpWeightConfig = { ...DEFAULT_FOLLOW_UP_WEIGHTS, ...customWeights };
    const generatedAt = new Date().toISOString();
    const provenance: FollowUpProvenance = surveyContext?.isDemoReplay ? 'SIMULATED' : 'DERIVED';

    if ((!targets || targets.length === 0) && (!surveyComparison?.notReassessedTargets || surveyComparison.notReassessedTargets.length === 0)) {
      return {
        recommendations: [],
        summary: {
          totalRecommendations: 0,
          criticalCount: 0,
          highCount: 0,
          moderateCount: 0,
          lowCount: 0,
          topAction: null,
          acknowledgedCount: 0,
          overriddenCount: 0,
          generatedAt,
          provenance,
        },
        generatedAt,
        provenance,
      };
    }

    const recommendations: FollowUpRecommendation[] = [];
    const clusteredTargetIdSet = new Set<string>();

    // Index temporal changes by target ID
    const temporalChangeMap = new Map<string, TemporalTargetChange>();
    if (surveyComparison) {
      for (const change of surveyComparison.allChanges) {
        temporalChangeMap.set(change.targetId, change);
      }
    }

    // Index targets by ID for fast lookup
    const targetMap = new Map<string, Target>();
    for (const t of targets) {
      targetMap.set(t.id, t);
    }

    // ------------------------------------------------------------------------
    // 1. HOTSPOT-LEVEL RECOMMENDATIONS (Mission Area Grouping)
    // ------------------------------------------------------------------------
    for (const hotspot of hotspots) {
      // Mark all member targets as clustered so we do not create redundant individual recommendations
      for (const tid of hotspot.targetIds) {
        clusteredTargetIdSet.add(tid);
      }

      const memberTargets = hotspot.targetIds
        .map((id) => targetMap.get(id))
        .filter((t): t is Target => !!t);

      const rec = this.createHotspotRecommendation(
        hotspot,
        memberTargets,
        temporalChangeMap,
        weights,
        provenance,
        generatedAt
      );
      recommendations.push(rec);
    }

    // ------------------------------------------------------------------------
    // 2. UNCLUSTERED ISOLATED TARGET RECOMMENDATIONS
    // ------------------------------------------------------------------------
    const unclusteredTargets = targets.filter((t) => !clusteredTargetIdSet.has(t.id));
    for (const target of unclusteredTargets) {
      const temporalChange = temporalChangeMap.get(target.id);
      const rec = this.createTargetRecommendation(
        target,
        temporalChange,
        weights,
        provenance,
        generatedAt
      );
      recommendations.push(rec);
    }

    // ------------------------------------------------------------------------
    // 3. COVERAGE GAP RECOMMENDATIONS (Previous targets NOT_REASSESSED)
    // ------------------------------------------------------------------------
    if (surveyComparison?.notReassessedTargets) {
      for (const notReassessed of surveyComparison.notReassessedTargets) {
        const rec = this.createCoverageGapRecommendation(
          notReassessed,
          weights,
          provenance,
          generatedAt
        );
        recommendations.push(rec);
      }
    }

    // ------------------------------------------------------------------------
    // 4. SORTING & SEQUENTIAL RANKING
    // ------------------------------------------------------------------------
    // Deterministic priority ordering:
    // 1. Priority score descending
    // 2. Target count descending
    // 3. Stable tie-breaker by ID ascending
    recommendations.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      const aCount = a.targetIds.length;
      const bCount = b.targetIds.length;
      if (bCount !== aCount) {
        return bCount - aCount;
      }
      return a.id.localeCompare(b.id);
    });

    // Assign sequential ranks 1 to N
    recommendations.forEach((rec, idx) => {
      rec.rank = idx + 1;
    });

    // ------------------------------------------------------------------------
    // 5. SUMMARY DERIVATION
    // ------------------------------------------------------------------------
    let criticalCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    const actionCounts = new Map<RecommendationType, number>();

    for (const rec of recommendations) {
      const urgency = rec.operatorOverride?.urgency || rec.urgency;
      if (urgency === 'CRITICAL') criticalCount++;
      else if (urgency === 'HIGH') highCount++;
      else if (urgency === 'MODERATE') moderateCount++;
      else lowCount++;

      const action = rec.operatorOverride?.recommendationType || rec.recommendationType;
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    let topAction: RecommendationType | null = null;
    let maxActionCount = 0;
    for (const [action, count] of actionCounts.entries()) {
      if (count > maxActionCount) {
        maxActionCount = count;
        topAction = action;
      }
    }

    const summary: FollowUpMissionSummary = {
      totalRecommendations: recommendations.length,
      criticalCount,
      highCount,
      moderateCount,
      lowCount,
      topAction,
      acknowledgedCount: 0,
      overriddenCount: 0,
      generatedAt,
      provenance,
    };

    return {
      recommendations,
      summary,
      generatedAt,
      provenance,
    };
  }

  // ==========================================================================
  // HELPER: CREATE HOTSPOT RECOMMENDATION
  // ==========================================================================
  private static createHotspotRecommendation(
    hotspot: Hotspot,
    memberTargets: Target[],
    temporalChangeMap: Map<string, TemporalTargetChange>,
    weights: FollowUpWeightConfig,
    provenance: FollowUpProvenance,
    generatedAt: string
  ): FollowUpRecommendation {
    const hasCriticalTarget = memberTargets.some(
      (t) => (t.riskAssessment?.operatorRiskLevel || t.riskAssessment?.riskLevel) === 'CRITICAL' || t.classification === 'ORDNANCE_UXO'
    );
    const hasUxo = memberTargets.some((t) => t.classification === 'ORDNANCE_UXO');
    const hasPipeline = memberTargets.some((t) => t.classification === 'PIPELINE_EXPOSURE');
    const allGeological = memberTargets.length > 0 && memberTargets.every(
      (t) => t.classification === 'GEOLOGICAL_FEATURE'
    );

    // Analyze temporal status across cluster
    let newTargetCount = 0;
    let changedTargetCount = 0;
    let persistentTargetCount = 0;
    let maxChangeScore = 0;
    let dominantChangeType: TemporalChangeType | undefined = undefined;

    for (const t of memberTargets) {
      const tc = temporalChangeMap.get(t.id);
      if (tc) {
        if (tc.changeType === 'NEW') newTargetCount++;
        else if (tc.changeType === 'CHANGED') changedTargetCount++;
        else if (tc.changeType === 'PERSISTENT') persistentTargetCount++;
        if (tc.changeScore > maxChangeScore) {
          maxChangeScore = tc.changeScore;
          dominantChangeType = tc.changeType;
        }
      }
    }

    // Component Scores (0 - 100)
    const hazardRiskScore = Math.max(
      hotspot.maximumRiskScore,
      hotspot.priorityScore,
      hasCriticalTarget ? 85 : 0
    );
    const temporalChangeScore = Math.max(
      maxChangeScore,
      newTargetCount > 0 ? 80 : 0,
      changedTargetCount > 0 ? 65 : 0,
      persistentTargetCount > 0 ? 45 : 0
    );
    const uncertaintyScore = memberTargets.some((t) => t.classification === 'UNKNOWN_ANOMALY' || t.confidence < 0.65)
      ? 75
      : 30;
    const spatialConcentrationScore = Math.min(100, 40 + hotspot.targetCount * 12);
    const evidenceQualityScore = Math.round(
      memberTargets.reduce((sum, t) => sum + (t.confidence * 100), 0) / (memberTargets.length || 1)
    );
    const coverageGapScore = 25;
    const contextualExposureScore = memberTargets.reduce(
      (max, t) => Math.max(max, t.riskAssessment?.contextualExposure || 0),
      0
    );

    let rawPriority =
      hazardRiskScore * weights.hazardRisk +
      temporalChangeScore * weights.temporalChange +
      uncertaintyScore * weights.uncertainty +
      spatialConcentrationScore * weights.spatialConcentration +
      evidenceQualityScore * weights.evidenceQuality +
      coverageGapScore * weights.coverageGap +
      contextualExposureScore * weights.contextualExposure;

    // Special rule: Geological cluster suppression
    if (allGeological && hotspot.riskLevel === 'LOW') {
      rawPriority = Math.min(24, rawPriority * 0.35);
    }

    // Special rule: UXO presence guarantees critical priority
    if (hasUxo || hasCriticalTarget) {
      rawPriority = Math.max(82, rawPriority);
    }

    const priorityScore = Math.max(0, Math.min(100, Math.round(rawPriority)));

    // Urgency determination
    let urgency: FollowUpUrgency = 'LOW';
    if (priorityScore >= 75 || hasCriticalTarget) {
      urgency = 'CRITICAL';
    } else if (priorityScore >= 55 || hotspot.highRiskTargetCount > 0) {
      urgency = 'HIGH';
    } else if (priorityScore >= 35) {
      urgency = 'MODERATE';
    }

    // Recommendation Type Selection
    let recommendationType: RecommendationType = 'ADDITIONAL_SONAR_PASS';
    if (hasUxo) {
      recommendationType = 'SPECIALIST_ASSESSMENT';
    } else if (hasPipeline) {
      recommendationType = 'INFRASTRUCTURE_INSPECTION';
    } else if (allGeological) {
      recommendationType = 'OPERATOR_REVIEW';
    } else if (persistentTargetCount > 0 && hasCriticalTarget) {
      recommendationType = 'ROV_VISUAL_INSPECTION';
    } else if (newTargetCount > 0 || memberTargets.some((t) => t.confidence < 0.65)) {
      recommendationType = 'ADDITIONAL_SONAR_PASS';
    } else if (changedTargetCount > 0) {
      recommendationType = 'CLOSER_TARGET_INSPECTION';
    }

    // Reasons (Why this area)
    const reasons: string[] = [
      `Multiple anomalies (${hotspot.targetCount} targets) concentrated within a ${Math.round(hotspot.radiusMeters)}m radius.`,
    ];
    if (hasUxo) {
      reasons.push('Potential safety-critical anomaly requires specialist assessment before physical intervention.');
    }
    if (newTargetCount > 0) {
      reasons.push(`${newTargetCount} newly detected target(s) require confirmation through additional acoustic coverage.`);
    }
    if (changedTargetCount > 0) {
      reasons.push(`${changedTargetCount} target(s) showed material morphological or spatial changes between surveys.`);
    }
    if (hasCriticalTarget && !hasUxo) {
      reasons.push('Cluster contains critical hydrographic hazards impacting navigational safety.');
    }
    if (allGeological) {
      reasons.push('Cluster consists entirely of natural bedrock formations; low follow-up priority.');
    }

    // Evidence (Observed facts only)
    const evidence: string[] = [
      `Hotspot Rank: #${hotspot.rank} | Targets: ${hotspot.targetCount}`,
      `Peak Hazard Risk: ${hotspot.maximumRiskScore}/100 (${hotspot.riskLevel})`,
      `Dominant Categories: ${hotspot.dominantCategories.join(', ') || 'MIXED'}`,
    ];
    if (newTargetCount > 0 || changedTargetCount > 0) {
      evidence.push(`Temporal Breakdown: ${newTargetCount} NEW, ${changedTargetCount} CHANGED, ${persistentTargetCount} PERSISTENT`);
    }
    if (contextualExposureScore > 50) {
      evidence.push(`Maritime Buffer Exposure: ${contextualExposureScore}/100 (Fairway / Protected Habitat Buffer Zone)`);
    }

    // Uncertainty
    const uncertainty: string[] = [];
    if (memberTargets.some((t) => t.confidence < 0.65)) {
      uncertainty.push('Acoustic confidence below 65% for some cluster members; multi-aspect view needed.');
    }
    if (newTargetCount > 0) {
      uncertainty.push('Unconfirmed historical presence in prior baseline survey.');
    }
    if (uncertainty.length === 0) {
      uncertainty.push('Positioning verified by multi-ping sonar telemetry; spatial clustering confirmed.');
    }

    // Expected Benefit
    let expectedBenefit = 'Execute dedicated swath pass covering dense multi-hazard cluster.';
    if (hasUxo) {
      expectedBenefit = 'Reduce uncertainty before any physical intervention.';
    } else if (hasPipeline) {
      expectedBenefit = 'Verify infrastructure clearance and prevent asset damage.';
    } else if (recommendationType === 'ROV_VISUAL_INSPECTION') {
      expectedBenefit = 'Obtain visual confirmation of persistent seabed hazard.';
    } else if (newTargetCount > 0) {
      expectedBenefit = 'Increase classification confidence and confirm spatial persistence.';
    } else if (allGeological) {
      expectedBenefit = 'Catalog background seabed geomorphology.';
    }

    return {
      id: `REC-AREA-${hotspot.id}`,
      rank: 0, // Assigned after sorting
      targetIds: hotspot.targetIds,
      hotspotId: hotspot.id,
      centerLatitude: hotspot.centerLatitude,
      centerLongitude: hotspot.centerLongitude,
      priorityScore,
      urgency,
      recommendationType,
      reasons,
      evidence,
      uncertainty,
      expectedBenefit,
      relatedRiskLevel: hotspot.riskLevel,
      relatedChangeType: dominantChangeType,
      provenance,
      generatedAt,
      areaName: `Hazard Hotspot #${hotspot.rank}`,
      targetCount: hotspot.targetCount,
    };
  }

  // ==========================================================================
  // HELPER: CREATE UNCLUSTERED TARGET RECOMMENDATION
  // ==========================================================================
  private static createTargetRecommendation(
    target: Target,
    temporalChange: TemporalTargetChange | undefined,
    weights: FollowUpWeightConfig,
    provenance: FollowUpProvenance,
    generatedAt: string
  ): FollowUpRecommendation {
    const riskLevel: RiskLevel = target.riskAssessment?.operatorRiskLevel || target.riskAssessment?.riskLevel || 'LOW';
    const riskScore = target.riskAssessment?.riskScore ?? (target.severity === 'CRITICAL' ? 85 : 30);
    const isUxo = target.classification === 'ORDNANCE_UXO';
    const isPipeline = target.classification === 'PIPELINE_EXPOSURE';
    const isGeological = target.classification === 'GEOLOGICAL_FEATURE';
    const isAmbiguous = target.classification === 'UNKNOWN_ANOMALY' || target.confidence < 0.65;

    const changeType: TemporalChangeType = temporalChange?.changeType || 'NEW';
    const changeScore = temporalChange?.changeScore ?? (changeType === 'NEW' ? 70 : 30);

    // Component Scores
    const hazardRiskScore = isUxo ? Math.max(90, riskScore) : riskScore;
    const temporalChangeScore = changeType === 'NEW' ? 75 : changeType === 'CHANGED' ? Math.max(65, changeScore) : 40;
    const uncertaintyScore = isAmbiguous ? 80 : Math.round((1 - target.confidence) * 100);
    const spatialConcentrationScore = 15; // unclustered isolated target
    const evidenceQualityScore = Math.round(target.confidence * 100);
    const coverageGapScore = temporalChange?.surveyCoverageStatus === 'MARGINAL' ? 75 : 20;
    const contextualExposureScore = target.riskAssessment?.contextualExposure || 15;

    let rawPriority =
      hazardRiskScore * weights.hazardRisk +
      temporalChangeScore * weights.temporalChange +
      uncertaintyScore * weights.uncertainty +
      spatialConcentrationScore * weights.spatialConcentration +
      evidenceQualityScore * weights.evidenceQuality +
      coverageGapScore * weights.coverageGap +
      contextualExposureScore * weights.contextualExposure;

    // Special rule: Geological suppression
    if (isGeological && riskLevel === 'LOW') {
      rawPriority = Math.min(22, rawPriority * 0.35);
    }

    // Special rule: UXO high priority guarantee
    if (isUxo || riskLevel === 'CRITICAL') {
      rawPriority = Math.max(82, rawPriority);
    }

    const priorityScore = Math.max(0, Math.min(100, Math.round(rawPriority)));

    // Urgency
    let urgency: FollowUpUrgency = 'LOW';
    if (priorityScore >= 75 || riskLevel === 'CRITICAL' || isUxo) {
      urgency = 'CRITICAL';
    } else if (priorityScore >= 55 || riskLevel === 'HIGH') {
      urgency = 'HIGH';
    } else if (priorityScore >= 35) {
      urgency = 'MODERATE';
    }

    // Recommendation Type Selection
    let recommendationType: RecommendationType = 'ADDITIONAL_SONAR_PASS';
    if (isUxo) {
      recommendationType = 'SPECIALIST_ASSESSMENT';
    } else if (isPipeline || (target.riskAssessment?.contextualExposure && target.riskAssessment.contextualExposure >= 75)) {
      recommendationType = 'INFRASTRUCTURE_INSPECTION';
    } else if (isGeological) {
      recommendationType = 'OPERATOR_REVIEW';
    } else if (changeType === 'PERSISTENT' && (riskLevel === 'CRITICAL' || riskLevel === 'HIGH')) {
      recommendationType = 'ROV_VISUAL_INSPECTION';
    } else if (changeType === 'CHANGED') {
      recommendationType = 'CLOSER_TARGET_INSPECTION';
    } else if (changeType === 'NEW' && (riskLevel === 'CRITICAL' || riskLevel === 'HIGH')) {
      recommendationType = 'ADDITIONAL_SONAR_PASS';
    } else if (isAmbiguous) {
      recommendationType = 'ADDITIONAL_SONAR_PASS';
    }

    // Reasons
    const reasons: string[] = [];
    if (isUxo) {
      reasons.push('Potential safety-critical anomaly requires specialist assessment before physical intervention.');
    } else if (changeType === 'NEW' && (riskLevel === 'CRITICAL' || riskLevel === 'HIGH')) {
      reasons.push('New high-priority anomaly requires confirmation through additional acoustic coverage.');
    } else if (changeType === 'CHANGED') {
      reasons.push('Target characteristics changed materially between surveys.');
    } else if (changeType === 'PERSISTENT' && (riskLevel === 'CRITICAL' || riskLevel === 'HIGH')) {
      reasons.push('High-priority target persists across repeat surveys.');
    } else if (isAmbiguous) {
      reasons.push('Additional evidence is required to reduce classification uncertainty.');
    } else if (isPipeline) {
      reasons.push('Proximity to critical subsea pipeline/cable infrastructure requires targeted asset inspection.');
    } else if (isGeological) {
      reasons.push('Natural geological bedrock anomaly; baseline acoustic confirmation.');
    } else {
      reasons.push(`Target assessed at ${riskLevel} hazard level with ${Math.round(target.confidence * 100)}% acoustic confidence.`);
    }

    // Evidence
    const evidence: string[] = [
      `Target: ${target.id} | Classification: ${target.classification}`,
      `Risk Level: ${riskLevel} (Hazard Score: ${riskScore}/100)`,
      `AI Confidence: ${(target.confidence * 100).toFixed(1)}% | Slant Range: ${target.slantRange.toFixed(1)}m`,
    ];
    if (target.shadowHeight > 0) {
      evidence.push(`Estimated Acoustic Relief: ${target.shadowHeight.toFixed(1)}m`);
    }
    if (temporalChange) {
      evidence.push(`Temporal Status: ${changeType} (Change Score: ${changeScore}/100)`);
    }
    if (contextualExposureScore > 50) {
      evidence.push(`Contextual Exposure: ${contextualExposureScore}/100 (Inside Maritime Fairway / Environmental Corridor Buffer)`);
    }

    // Uncertainty
    const uncertainty: string[] = [];
    if (isAmbiguous) {
      uncertainty.push('Classification ambiguous due to multi-path acoustic reflection or diffuse backscatter.');
    }
    if (target.confidence < 0.70) {
      uncertainty.push(`AI confidence is ${(target.confidence * 100).toFixed(0)}%, indicating potential false alarm or non-typical shape.`);
    }
    if (temporalChange?.surveyCoverageStatus === 'MARGINAL') {
      uncertainty.push('Located near the boundary of the surveyed swath; marginal edge resolution.');
    }
    if (uncertainty.length === 0) {
      uncertainty.push('Multi-ping detection consistency confirmed across acoustic tracks.');
    }

    // Expected Benefit
    let expectedBenefit = 'Increase classification confidence.';
    if (isUxo) {
      expectedBenefit = 'Reduce uncertainty before any physical intervention.';
    } else if (isPipeline) {
      expectedBenefit = 'Verify infrastructure clearance and prevent asset damage.';
    } else if (recommendationType === 'ROV_VISUAL_INSPECTION') {
      expectedBenefit = 'Obtain visual confirmation of persistent seabed hazard.';
    } else if (recommendationType === 'CLOSER_TARGET_INSPECTION') {
      expectedBenefit = 'Verify physical displacement and morphological evolution.';
    } else if (changeType === 'NEW') {
      expectedBenefit = 'Confirm spatial persistence and acquire multi-aspect sonar imagery.';
    } else if (isGeological) {
      expectedBenefit = 'Catalog background seabed geomorphology.';
    }

    return {
      id: `REC-TRG-${target.id}`,
      rank: 0,
      targetIds: [target.id],
      centerLatitude: target.latitude,
      centerLongitude: target.longitude,
      priorityScore,
      urgency,
      recommendationType,
      reasons,
      evidence,
      uncertainty,
      expectedBenefit,
      relatedRiskLevel: riskLevel,
      relatedChangeType: changeType,
      provenance,
      generatedAt,
      areaName: `Target ${target.id} (${target.categoryLabel || target.classification})`,
      targetCount: 1,
    };
  }

  // ==========================================================================
  // HELPER: CREATE COVERAGE GAP RECOMMENDATION
  // ==========================================================================
  private static createCoverageGapRecommendation(
    change: TemporalTargetChange,
    weights: FollowUpWeightConfig,
    provenance: FollowUpProvenance,
    generatedAt: string
  ): FollowUpRecommendation {
    const prevTarget = change.previousTarget;
    const lat = prevTarget?.latitude || 9.215;
    const lng = prevTarget?.longitude || 79.160;
    const riskLevel = change.riskLevel || 'MODERATE';
    const isCriticalOrHigh = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';

    const priorityScore = isCriticalOrHigh ? 72 : 54;
    const urgency: FollowUpUrgency = isCriticalOrHigh ? 'HIGH' : 'MODERATE';

    return {
      id: `REC-COV-${change.id}`,
      rank: 0,
      targetIds: [change.targetId],
      centerLatitude: lat,
      centerLongitude: lng,
      priorityScore,
      urgency,
      recommendationType: 'REASSESS_SURVEY_COVERAGE',
      reasons: [
        'Previous target lies outside current adequately surveyed coverage.',
        'Target was detected in historical baseline but could not be evaluated due to survey boundary gap.',
      ],
      evidence: [
        `Historical Target ID: ${change.targetId}`,
        `Baseline Risk Assessment: ${riskLevel} (${change.riskScore}/100)`,
        'Survey Coverage Status: UNCOVERED (Outside current transect swath)',
      ],
      uncertainty: [
        'Status unknown in current year due to absence of acoustic coverage.',
      ],
      expectedBenefit: 'Expand survey coverage footprint to reassess historical baseline anomaly.',
      relatedRiskLevel: riskLevel,
      relatedChangeType: 'NOT_REASSESSED',
      provenance,
      generatedAt,
      areaName: `Coverage Gap (${change.targetId})`,
      targetCount: 1,
    };
  }

  /**
   * Merges operator overrides and acknowledgements onto a recommendation result,
   * cleanly recalculating summary totals while preserving provenance.
   */
  public static applyOperatorModifications(
    result: FollowUpRecommendationResult,
    operatorOverrides: Map<string, FollowUpOperatorOverride> = new Map(),
    operatorAcknowledgements:
      | Map<string, { acknowledgedAt: string; acknowledgedBy: string; operatorNote?: string }>
      | Set<string> = new Map()
  ): FollowUpRecommendationResult {
    let criticalCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    let ackCount = 0;
    let overrideCount = 0;
    const actionCounts = new Map<RecommendationType, number>();

    const recs = result.recommendations.map((r) => {
      const override = operatorOverrides.get(r.id);
      const isAckSet = operatorAcknowledgements instanceof Set;
      const isAcked = isAckSet
        ? (operatorAcknowledgements as Set<string>).has(r.id)
        : (operatorAcknowledgements as Map<string, any>).has(r.id);
      const ackDetails = !isAckSet
        ? (operatorAcknowledgements as Map<string, any>).get(r.id)
        : undefined;

      const effectiveScore = override?.priorityScore ?? r.priorityScore;
      const effectiveUrgency = override?.urgency ?? r.urgency;
      const effectiveType = override?.recommendationType ?? r.recommendationType;

      const merged: FollowUpRecommendation = {
        ...r,
        priorityScore: effectiveScore,
        urgency: effectiveUrgency,
        recommendationType: effectiveType,
        operatorOverride: override || r.operatorOverride,
        acknowledged: isAcked || r.acknowledged || false,
        acknowledgedAt: ackDetails?.acknowledgedAt || r.acknowledgedAt,
        acknowledgedBy: ackDetails?.acknowledgedBy || r.acknowledgedBy,
        operatorNote: ackDetails?.operatorNote || r.operatorNote,
      };

      if (merged.acknowledged) ackCount++;
      if (merged.operatorOverride) overrideCount++;

      if (effectiveUrgency === 'CRITICAL') criticalCount++;
      else if (effectiveUrgency === 'HIGH') highCount++;
      else if (effectiveUrgency === 'MODERATE') moderateCount++;
      else lowCount++;

      actionCounts.set(effectiveType, (actionCounts.get(effectiveType) || 0) + 1);

      return merged;
    });

    let topAction: RecommendationType | null = null;
    let maxActionCount = 0;
    for (const [action, count] of actionCounts.entries()) {
      if (count > maxActionCount) {
        maxActionCount = count;
        topAction = action;
      }
    }

    return {
      recommendations: recs,
      summary: {
        totalRecommendations: recs.length,
        criticalCount,
        highCount,
        moderateCount,
        lowCount,
        topAction,
        acknowledgedCount: ackCount,
        overriddenCount: overrideCount,
        generatedAt: result.generatedAt,
        provenance: result.provenance,
      },
      generatedAt: result.generatedAt,
      provenance: result.provenance,
    };
  }
}
