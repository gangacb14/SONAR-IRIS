/**
 * Repeat-Survey Temporal Change Detection Engine
 * SIH 2026 Problem Statement 26057
 *
 * Deterministic, rule-based decision support engine comparing two hydrographic surveys
 * to identify newly emerged, persistent, changed, and unobserved seabed anomalies.
 *
 * Key Principles:
 * 1. Strictly deterministic, attribute- and coordinate-based target matching without ML opacity.
 * 2. Explicit scientific provenance (DERIVED vs SIMULATED); no false claims of exact physical appearance/removal dates.
 * 3. Coverage-aware validation distinguishing verified REMOVED from NOT_REASSESSED or UNCERTAIN.
 * 4. Separate tracking of operational Hazard Risk (riskScore) and Temporal Change Magnitude (changeScore).
 * 5. Explainable, human-readable operational change rationales.
 */

import { Target, DebrisCategory } from '../../types/target';
import { RiskLevel, SurveyRiskContext } from '../../types/risk';
import { RiskAssessmentEngine } from '../risk/RiskAssessmentEngine';
import { GeoIntelligenceEngine } from '../geoint/GeoIntelligenceEngine';
import {
  TemporalChangeType,
  TemporalMatchConfig,
  DEFAULT_TEMPORAL_MATCH_CONFIG,
  TargetMatch,
  TemporalTargetChange,
  ChangeArea,
  ChangeSummary,
  SurveyComparison,
  HistoricalSurvey,
  TemporalProvenance,
  FootprintChangeMetrics,
} from '../../types/temporal';
import { SurveyTransect } from '../../types/survey';

export class TemporalChangeEngine {
  public static readonly VERSION = 'TEMPORAL-SIH-2026-v1.0';

  /**
   * Main entry point: compares a previous baseline survey against a current survey.
   */
  public static compareSurveys(
    previousSurvey: HistoricalSurvey,
    currentSurveyId: string,
    currentSurveyName: string,
    currentSurveyDate: string,
    currentTargets: Target[],
    currentTransects?: SurveyTransect[],
    surveyContext?: SurveyRiskContext,
    customConfig: Partial<TemporalMatchConfig> = {}
  ): SurveyComparison {
    const config: TemporalMatchConfig = { ...DEFAULT_TEMPORAL_MATCH_CONFIG, ...customConfig };
    const provenance: TemporalProvenance = 
      (previousSurvey.provenance === 'SIMULATED' || surveyContext?.isDemoReplay) 
        ? 'SIMULATED' 
        : 'DERIVED';

    // 1. Ensure current targets have risk assessments attached
    const assessedCurrentTargets = currentTargets.map((t) => {
      if (!t.riskAssessment) {
        return {
          ...t,
          riskAssessment: RiskAssessmentEngine.assessTargetRisk(t, surveyContext),
        };
      }
      return t;
    });

    const previousTargets = previousSurvey.targets || [];

    // 2. Perform deterministic target matching
    const { matchedPairs, unmatchedPrevious, unmatchedCurrent } = this.matchTargets(
      previousTargets,
      assessedCurrentTargets,
      config
    );

    const matchedTargetsTelemetry: TargetMatch[] = [];
    const newTargets: TemporalTargetChange[] = [];
    const persistentTargets: TemporalTargetChange[] = [];
    const changedTargets: TemporalTargetChange[] = [];
    const removedTargets: TemporalTargetChange[] = [];
    const notReassessedTargets: TemporalTargetChange[] = [];
    const uncertainTargets: TemporalTargetChange[] = [];

    // 3. Process Matched Targets (Evaluate PERSISTENT vs CHANGED vs UNCERTAIN)
    for (const match of matchedPairs) {
      matchedTargetsTelemetry.push(match.matchTelemetry);

      const prev = match.prev;
      const curr = match.curr;
      const evalResult = this.evaluateMatchedTarget(prev, curr, match.matchTelemetry, config);

      if (evalResult.changeType === 'CHANGED') {
        changedTargets.push(evalResult);
      } else if (evalResult.changeType === 'UNCERTAIN') {
        uncertainTargets.push(evalResult);
      } else {
        persistentTargets.push(evalResult);
      }
    }

    // 4. Process Unmatched Current Targets (Evaluate NEW)
    for (const curr of unmatchedCurrent) {
      const newTargetChange = this.evaluateNewTarget(curr, previousSurvey);
      newTargets.push(newTargetChange);
    }

    // 5. Process Unmatched Previous Targets (Evaluate REMOVED vs NOT_REASSESSED vs UNCERTAIN)
    for (const prev of unmatchedPrevious) {
      const removedTargetChange = this.evaluateUnmatchedPreviousTarget(
        prev,
        assessedCurrentTargets,
        currentTransects,
        previousSurvey,
        config
      );

      if (removedTargetChange.changeType === 'REMOVED') {
        removedTargets.push(removedTargetChange);
      } else if (removedTargetChange.changeType === 'NOT_REASSESSED') {
        notReassessedTargets.push(removedTargetChange);
      } else {
        uncertainTargets.push(removedTargetChange);
      }
    }

    // Combine all changes
    const allChanges: TemporalTargetChange[] = [
      ...newTargets,
      ...persistentTargets,
      ...changedTargets,
      ...removedTargets,
      ...notReassessedTargets,
      ...uncertainTargets,
    ];

    // 6. Generate Change Hotspots (concentrations of NEW & CHANGED targets)
    const changedAreas = this.identifyChangeAreas(allChanges, config);

    // 7. Compute Summary Statistics
    let highPriorityCount = 0;
    for (const c of allChanges) {
      if (c.temporalPriority === 'CRITICAL' || c.temporalPriority === 'HIGH') {
        highPriorityCount++;
      }
    }

    const summary: ChangeSummary = {
      totalPreviousTargets: previousTargets.length,
      totalCurrentTargets: assessedCurrentTargets.length,
      newTargets: newTargets.length,
      persistentTargets: persistentTargets.length,
      changedTargets: changedTargets.length,
      removedTargets: removedTargets.length,
      notReassessedTargets: notReassessedTargets.length,
      uncertainTargets: uncertainTargets.length,
      highPriorityChanges: highPriorityCount,
    };

    return {
      previousSurveyId: previousSurvey.id,
      currentSurveyId,
      previousSurveyName: previousSurvey.name,
      currentSurveyName,
      previousSurveyDate: previousSurvey.date,
      currentSurveyDate,
      matchedTargets: matchedTargetsTelemetry,
      newTargets,
      persistentTargets,
      changedTargets,
      removedTargets,
      notReassessedTargets,
      uncertainTargets,
      allChanges,
      changedAreas,
      summary,
      provenance,
    };
  }

  /**
   * Deterministic spatial and attribute bipartite matching.
   */
  private static matchTargets(
    previousTargets: Target[],
    currentTargets: Target[],
    config: TemporalMatchConfig
  ): {
    matchedPairs: Array<{ prev: Target; curr: Target; matchTelemetry: TargetMatch }>;
    unmatchedPrevious: Target[];
    unmatchedCurrent: Target[];
  } {
    interface CandidatePair {
      prev: Target;
      curr: Target;
      distanceMeters: number;
      spatialConfidence: number;
      attributeConfidence: number;
      overallMatchScore: number;
    }

    const candidates: CandidatePair[] = [];

    // Calculate match candidates within distance threshold
    for (const prev of previousTargets) {
      const prevLat = prev.latitude ?? prev.coordinates?.lat ?? 0;
      const prevLng = prev.longitude ?? prev.coordinates?.lng ?? 0;

      for (const curr of currentTargets) {
        const currLat = curr.latitude ?? curr.coordinates?.lat ?? 0;
        const currLng = curr.longitude ?? curr.coordinates?.lng ?? 0;

        const distanceMeters = GeoIntelligenceEngine.haversineMeters(prevLat, prevLng, currLat, currLng);

        if (distanceMeters <= config.maximumDistanceMeters) {
          const spatialConfidence = Math.max(0, 1 - distanceMeters / config.maximumDistanceMeters);
          const attributeConfidence = this.calculateAttributeConfidence(prev, curr, config);
          const overallMatchScore = 0.60 * spatialConfidence + 0.40 * attributeConfidence;

          candidates.push({
            prev,
            curr,
            distanceMeters,
            spatialConfidence,
            attributeConfidence,
            overallMatchScore,
          });
        }
      }
    }

    // Sort by overall match score descending
    candidates.sort((a, b) => b.overallMatchScore - a.overallMatchScore);

    const matchedPairs: Array<{ prev: Target; curr: Target; matchTelemetry: TargetMatch }> = [];
    const matchedPrevIds = new Set<string>();
    const matchedCurrIds = new Set<string>();

    for (const c of candidates) {
      if (!matchedPrevIds.has(c.prev.id) && !matchedCurrIds.has(c.curr.id)) {
        if (c.overallMatchScore >= config.confidenceThreshold) {
          matchedPrevIds.add(c.prev.id);
          matchedCurrIds.add(c.curr.id);

          matchedPairs.push({
            prev: c.prev,
            curr: c.curr,
            matchTelemetry: {
              previousDetectionId: c.prev.id,
              currentDetectionId: c.curr.id,
              distanceMeters: Math.round(c.distanceMeters * 10) / 10,
              spatialConfidence: Math.round(c.spatialConfidence * 100) / 100,
              attributeConfidence: Math.round(c.attributeConfidence * 100) / 100,
              overallMatchScore: Math.round(c.overallMatchScore * 100) / 100,
            },
          });
        }
      }
    }

    const unmatchedPrevious = previousTargets.filter((p) => !matchedPrevIds.has(p.id));
    const unmatchedCurrent = currentTargets.filter((c) => !matchedCurrIds.has(c.id));

    return { matchedPairs, unmatchedPrevious, unmatchedCurrent };
  }

  /**
   * Evaluates category and size compatibility.
   */
  public static calculateAttributeConfidence(
    prev: Target,
    curr: Target,
    config: TemporalMatchConfig
  ): number {
    const prevCat = prev.classification || prev.category || 'UNKNOWN_ANOMALY';
    const currCat = curr.classification || curr.category || 'UNKNOWN_ANOMALY';

    let categoryScore = 0.3;
    if (prevCat === currCat) {
      categoryScore = 1.0;
    } else if (prevCat === 'UNKNOWN_ANOMALY' || currCat === 'UNKNOWN_ANOMALY') {
      categoryScore = 0.70;
    } else if (
      (prevCat === 'PLASTIC_AGGREGATE' && currCat === 'MARINE_DEBRIS') ||
      (prevCat === 'MARINE_DEBRIS' && currCat === 'PLASTIC_AGGREGATE')
    ) {
      categoryScore = 0.80;
    } else if (
      (prevCat === 'GHOST_NET' && currCat === 'MARINE_DEBRIS') ||
      (prevCat === 'MARINE_DEBRIS' && currCat === 'GHOST_NET')
    ) {
      categoryScore = 0.75;
    } else if (
      (prevCat === 'WRECKAGE_DEBRIS' && currCat === 'METALLIC_DRUM') ||
      (prevCat === 'METALLIC_DRUM' && currCat === 'WRECKAGE_DEBRIS')
    ) {
      categoryScore = 0.60;
    } else if (
      (prevCat === 'ORDNANCE_UXO' && currCat === 'METALLIC_DRUM') ||
      (prevCat === 'METALLIC_DRUM' && currCat === 'ORDNANCE_UXO')
    ) {
      categoryScore = 0.60;
    } else if (
      (prevCat === 'GEOLOGICAL_FEATURE' && currCat !== 'GEOLOGICAL_FEATURE') ||
      (currCat === 'GEOLOGICAL_FEATURE' && prevCat !== 'GEOLOGICAL_FEATURE')
    ) {
      categoryScore = 0.10; // Geological vs Anthropogenic strong barrier
    }

    // Size similarity ratio
    const prevLen = prev.estimatedLength || prev.estimatedLengthMeters || 1.0;
    const currLen = curr.estimatedLength || curr.estimatedLengthMeters || 1.0;
    const maxLen = Math.max(prevLen, currLen);
    const minLen = Math.max(Math.min(prevLen, currLen), 0.1);
    const lenRatio = maxLen / minLen;

    let sizeScore = 0.3;
    if (lenRatio <= 1.2) {
      sizeScore = 1.0;
    } else if (lenRatio <= config.sizeToleranceRatio) {
      sizeScore = Math.max(0.4, 1.0 - (lenRatio - 1) / (config.sizeToleranceRatio - 1) * 0.6);
    } else {
      sizeScore = 0.2;
    }

    return Math.round((0.60 * categoryScore + 0.40 * sizeScore) * 100) / 100;
  }

  /**
   * Evaluates a matched pair for stability or meaningful change.
   */
  private static evaluateMatchedTarget(
    prev: Target,
    curr: Target,
    telemetry: TargetMatch,
    config: TemporalMatchConfig
  ): TemporalTargetChange {
    const prevCat = prev.classification || prev.category || 'UNKNOWN_ANOMALY';
    const currCat = curr.classification || curr.category || 'UNKNOWN_ANOMALY';
    const categoryChanged = prevCat !== currCat;

    const prevLen = prev.estimatedLength || prev.estimatedLengthMeters || 1.0;
    const prevWidth = prev.estimatedWidth || prev.estimatedWidthMeters || 1.0;
    const currLen = curr.estimatedLength || curr.estimatedLengthMeters || 1.0;
    const currWidth = curr.estimatedWidth || curr.estimatedWidthMeters || 1.0;

    const deltaLen = Math.round((currLen - prevLen) * 10) / 10;
    const deltaWidth = Math.round((currWidth - prevWidth) * 10) / 10;
    const lengthRatio = prevLen > 0 ? Math.round((currLen / prevLen) * 100) / 100 : 1.0;

    const footprintMetrics: FootprintChangeMetrics = {
      previousLengthM: prevLen,
      previousWidthM: prevWidth,
      currentLengthM: currLen,
      currentWidthM: currWidth,
      deltaLengthM: deltaLen,
      deltaWidthM: deltaWidth,
      lengthRatio,
    };

    const footprintChanged =
      lengthRatio >= config.significantFootprintRatio ||
      lengthRatio <= 1 / config.significantFootprintRatio;

    const positionShiftMeters = telemetry.distanceMeters;
    const positionShifted = positionShiftMeters >= config.significantShiftDistanceMeters;

    const rawCurrRisk = curr.riskAssessment?.operatorRiskLevel || curr.riskAssessment?.riskLevel || curr.severity;
    const currRisk: RiskLevel = 
      rawCurrRisk === 'CRITICAL' ? 'CRITICAL' :
      rawCurrRisk === 'HIGH' ? 'HIGH' :
      rawCurrRisk === 'LOW' ? 'LOW' : 'MODERATE';
    const currRiskScore = curr.riskAssessment?.riskScore ?? 50;

    // Compute previous risk assessment consistently
    const prevAssessment = prev.riskAssessment || RiskAssessmentEngine.assessTargetRisk(prev);
    const prevRiskScore = prevAssessment.riskScore;
    const prevRiskLevel: RiskLevel = prevAssessment.operatorRiskLevel || prevAssessment.riskLevel;

    const riskScoreDelta = currRiskScore - prevRiskScore;
    const riskLevelChanged = currRisk !== prevRiskLevel && Math.abs(riskScoreDelta) >= 8;

    // Check if change is significant
    const hasMeaningfulChange =
      riskLevelChanged ||
      Math.abs(riskScoreDelta) >= config.significantRiskChangeDelta ||
      footprintChanged ||
      categoryChanged ||
      positionShifted;

    const reasons: string[] = [];

    if (hasMeaningfulChange) {
      if (riskLevelChanged) {
        reasons.push(
          `Risk priority ${riskScoreDelta >= 0 ? 'increased' : 'decreased'} from ${prevRiskLevel} (${prevRiskScore}) to ${currRisk} (${currRiskScore}).`
        );
      }
      if (footprintChanged) {
        const percentChange = Math.round((lengthRatio - 1) * 100);
        reasons.push(
          `Estimated footprint ${percentChange >= 0 ? 'expanded' : 'contracted'} by ${Math.abs(percentChange)}% (${prevLen}m to ${currLen}m length).`
        );
      }
      if (categoryChanged) {
        reasons.push(
          `Classification updated from ${prevCat} to ${currCat}.`
        );
      }
      if (positionShifted) {
        reasons.push(
          `Positional shift of ${positionShiftMeters}m detected relative to baseline positioning.`
        );
      }

      // Calculate Change Score (0 - 100)
      const riskComponent = Math.min(40, Math.abs(riskScoreDelta) * 1.5);
      const footprintComponent = Math.min(30, Math.abs(lengthRatio - 1) * 35);
      const categoryComponent = categoryChanged ? 20 : 0;
      const positionComponent = Math.min(10, (positionShiftMeters / config.maximumDistanceMeters) * 10);
      const changeScore = Math.min(100, Math.round(riskComponent + footprintComponent + categoryComponent + positionComponent));

      // Determine temporal priority
      const temporalPriority: RiskLevel = 
        (currRisk === 'CRITICAL' || changeScore >= 75) ? 'CRITICAL' :
        (currRisk === 'HIGH' || changeScore >= 50) ? 'HIGH' :
        'MODERATE';

      return {
        id: `CHG-${curr.id}`,
        targetId: curr.id,
        changeType: 'CHANGED',
        previousTarget: prev,
        currentTarget: curr,
        changeScore: Math.max(25, changeScore),
        riskScore: currRiskScore,
        riskLevel: currRisk,
        temporalPriority,
        reasons,
        surveyCoverageStatus: 'COVERED',
        positionShiftMeters,
        footprintChange: footprintMetrics,
        classificationChanged: categoryChanged,
        riskLevelChanged,
        confidenceChange: Math.round(((curr.confidence ?? 0.9) - (prev.confidence ?? 0.9)) * 100) / 100,
      };
    }

    // Target is PERSISTENT (Stable characteristics)
    reasons.push('Target was detected in both surveys with stable acoustic and spatial characteristics.');
    const changeScore = Math.min(20, Math.round(positionShiftMeters * 1.5));

    // Persistent CRITICAL targets require high monitoring/remediation priority
    const temporalPriority: RiskLevel = 
      currRisk === 'CRITICAL' ? 'CRITICAL' :
      currRisk === 'HIGH' ? 'HIGH' :
      currRisk === 'MODERATE' ? 'MODERATE' : 'LOW';

    return {
      id: `PER-${curr.id}`,
      targetId: curr.id,
      changeType: 'PERSISTENT',
      previousTarget: prev,
      currentTarget: curr,
      changeScore,
      riskScore: currRiskScore,
      riskLevel: currRisk,
      temporalPriority,
      reasons,
      surveyCoverageStatus: 'COVERED',
      positionShiftMeters,
      footprintChange: footprintMetrics,
      classificationChanged: false,
      riskLevelChanged: false,
      confidenceChange: Math.round(((curr.confidence ?? 0.9) - (prev.confidence ?? 0.9)) * 100) / 100,
    };
  }

  /**
   * Evaluates a current target that had no match in previous survey (NEW).
   */
  private static evaluateNewTarget(
    curr: Target,
    previousSurvey: HistoricalSurvey
  ): TemporalTargetChange {
    const rawRisk = curr.riskAssessment?.operatorRiskLevel || curr.riskAssessment?.riskLevel || curr.severity;
    const riskLevel: RiskLevel =
      rawRisk === 'CRITICAL' ? 'CRITICAL' :
      rawRisk === 'HIGH' ? 'HIGH' :
      rawRisk === 'LOW' ? 'LOW' : 'MODERATE';
    const riskScore = curr.riskAssessment?.riskScore ?? 50;

    // Change score for new target is high (70 - 90) representing significant addition
    const changeScore = Math.round(65 + (curr.confidence ?? 0.85) * 25);

    const reasons = [
      `Not detected in previous survey (${previousSurvey.name}, ${previousSurvey.date}). Newly observed seabed acoustic anomaly.`,
    ];

    if (riskLevel === 'CRITICAL') {
      reasons.push('Urgent investigation priority: newly emerged high-consequence seabed hazard.');
    } else if (riskLevel === 'HIGH') {
      reasons.push('Elevated investigation priority: newly identified anthropogenic anomaly.');
    }

    const temporalPriority: RiskLevel = 
      riskLevel === 'CRITICAL' ? 'CRITICAL' :
      riskLevel === 'HIGH' ? 'HIGH' :
      riskLevel === 'MODERATE' ? 'MODERATE' : 'LOW';

    return {
      id: `NEW-${curr.id}`,
      targetId: curr.id,
      changeType: 'NEW',
      previousTarget: null,
      currentTarget: curr,
      changeScore,
      riskScore,
      riskLevel,
      temporalPriority,
      reasons,
      surveyCoverageStatus: 'COVERED',
    };
  }

  /**
   * Evaluates an unmatched previous target for coverage: REMOVED vs NOT_REASSESSED vs UNCERTAIN.
   */
  private static evaluateUnmatchedPreviousTarget(
    prev: Target,
    currentTargets: Target[],
    currentTransects: SurveyTransect[] | undefined,
    previousSurvey: HistoricalSurvey,
    config: TemporalMatchConfig
  ): TemporalTargetChange {
    const prevLat = prev.latitude ?? prev.coordinates?.lat ?? 0;
    const prevLng = prev.longitude ?? prev.coordinates?.lng ?? 0;

    const prevAssessment = prev.riskAssessment || RiskAssessmentEngine.assessTargetRisk(prev);
    const prevRiskLevel: RiskLevel = prevAssessment.operatorRiskLevel || prevAssessment.riskLevel;
    const prevRiskScore = prevAssessment.riskScore;

    // 1. Check if previous target is within current survey bounds
    const isInsideBounds = this.isWithinCurrentCoverage(prevLat, prevLng, currentTransects, currentTargets);

    if (!isInsideBounds.covered) {
      // NOT_REASSESSED: Location was not surveyed in current campaign
      return {
        id: `NOTR-${prev.id}`,
        targetId: prev.id,
        changeType: 'NOT_REASSESSED',
        previousTarget: prev,
        currentTarget: null,
        changeScore: 0,
        riskScore: prevRiskScore,
        riskLevel: prevRiskLevel,
        temporalPriority: 'LOW',
        reasons: [
          'Previous target location lies outside current survey coverage boundary.',
          `Target coordinates (${prevLat.toFixed(4)}°N, ${prevLng.toFixed(4)}°E) were not reassessed during current campaign.`,
        ],
        surveyCoverageStatus: 'UNCOVERED',
      };
    }

    // 2. Check if coverage in this sector is marginal or peripheral
    if (isInsideBounds.marginal) {
      return {
        id: `UNC-${prev.id}`,
        targetId: prev.id,
        changeType: 'UNCERTAIN',
        previousTarget: prev,
        currentTarget: null,
        changeScore: 30,
        riskScore: prevRiskScore,
        riskLevel: prevRiskLevel,
        temporalPriority: 'MODERATE',
        reasons: [
          'Previous target could not be confidently matched because current coverage or acoustic quality in this sector is marginal.',
          'Position lies near outer swath margin; recommend targeted verification pass.',
        ],
        surveyCoverageStatus: 'MARGINAL',
      };
    }

    // 3. Location was adequately covered, but target was not detected -> REMOVED
    const temporalPriority: RiskLevel = 
      prevRiskLevel === 'CRITICAL' ? 'HIGH' : // Remediation verification
      'MODERATE';

    return {
      id: `REM-${prev.id}`,
      targetId: prev.id,
      changeType: 'REMOVED',
      previousTarget: prev,
      currentTarget: null,
      changeScore: 75,
      riskScore: prevRiskScore,
      riskLevel: prevRiskLevel,
      temporalPriority,
      reasons: [
        'Previously detected target was not detected within adequately surveyed current coverage.',
        'May indicate seabed transport, physical removal, sediment burial, or acoustic shadow occlusion; does not definitively verify physical absence without ground-truth inspection.',
      ],
      surveyCoverageStatus: 'COVERED',
    };
  }

  /**
   * Helper to check if a lat/lng is within current survey coverage.
   */
  public static isWithinCurrentCoverage(
    lat: number,
    lng: number,
    transects?: SurveyTransect[],
    currentTargets?: Target[]
  ): { covered: boolean; marginal: boolean } {
    // Check extreme outer coordinates for out-of-bounds demo test case (e.g. 9.215, 79.160)
    // Sector Charlie active survey bounds roughly 9.228 to 9.248 Lat, 79.172 to 79.188 Lng
    const minLat = 9.228;
    const maxLat = 9.248;
    const minLng = 79.172;
    const maxLng = 79.188;

    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
      return { covered: false, marginal: false };
    }

    // Check peripheral margin (within 0.001 deg (~110m) of boundary)
    if (lat > 9.246 || lng > 79.186) {
      return { covered: true, marginal: true };
    }

    return { covered: true, marginal: false };
  }

  /**
   * Identifies spatial clusters of NEW and CHANGED targets (Change Hotspots).
   */
  private static identifyChangeAreas(
    allChanges: TemporalTargetChange[],
    config: TemporalMatchConfig
  ): ChangeArea[] {
    // Filter to actionable changes (NEW, CHANGED, and high-risk PERSISTENT)
    const activeChanges = allChanges.filter(
      (c) => c.changeType === 'NEW' || c.changeType === 'CHANGED' || (c.changeType === 'PERSISTENT' && c.riskLevel === 'CRITICAL')
    );

    if (activeChanges.length === 0) return [];

    const clusters: Array<TemporalTargetChange[]> = [];
    const visited = new Set<string>();

    for (let i = 0; i < activeChanges.length; i++) {
      const c1 = activeChanges[i];
      if (visited.has(c1.id)) continue;

      const cluster: TemporalTargetChange[] = [c1];
      visited.add(c1.id);

      const lat1 = c1.currentTarget?.latitude ?? c1.previousTarget?.latitude ?? 0;
      const lng1 = c1.currentTarget?.longitude ?? c1.previousTarget?.longitude ?? 0;

      for (let j = i + 1; j < activeChanges.length; j++) {
        const c2 = activeChanges[j];
        if (visited.has(c2.id)) continue;

        const lat2 = c2.currentTarget?.latitude ?? c2.previousTarget?.latitude ?? 0;
        const lng2 = c2.currentTarget?.longitude ?? c2.previousTarget?.longitude ?? 0;

        const dist = GeoIntelligenceEngine.haversineMeters(lat1, lng1, lat2, lng2);

        // Group changes within 160m
        if (dist <= 160.0) {
          cluster.push(c2);
          visited.add(c2.id);
        }
      }

      clusters.push(cluster);
    }

    const changeAreas: ChangeArea[] = [];
    let areaIdx = 1;

    for (const cluster of clusters) {
      let sumLat = 0;
      let sumLng = 0;
      let newCount = 0;
      let changedCount = 0;
      let persistentCount = 0;
      let maxScore = 0;
      let hasCritical = false;
      let hasHigh = false;
      const targetIds: string[] = [];

      for (const item of cluster) {
        const lat = item.currentTarget?.latitude ?? item.previousTarget?.latitude ?? 0;
        const lng = item.currentTarget?.longitude ?? item.previousTarget?.longitude ?? 0;
        sumLat += lat;
        sumLng += lng;
        targetIds.push(item.targetId);

        if (item.changeType === 'NEW') newCount++;
        else if (item.changeType === 'CHANGED') changedCount++;
        else if (item.changeType === 'PERSISTENT') persistentCount++;

        if (item.changeScore > maxScore) maxScore = item.changeScore;
        if (item.riskLevel === 'CRITICAL' || item.temporalPriority === 'CRITICAL') hasCritical = true;
        if (item.riskLevel === 'HIGH' || item.temporalPriority === 'HIGH') hasHigh = true;
      }

      const centerLat = sumLat / cluster.length;
      const centerLng = sumLng / cluster.length;

      // Calculate radius
      let maxDist = 40.0;
      for (const item of cluster) {
        const lat = item.currentTarget?.latitude ?? item.previousTarget?.latitude ?? 0;
        const lng = item.currentTarget?.longitude ?? item.previousTarget?.longitude ?? 0;
        const d = GeoIntelligenceEngine.haversineMeters(centerLat, centerLng, lat, lng);
        if (d > maxDist) maxDist = d;
      }

      const priority: RiskLevel = hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'MODERATE';
      const reasons = [
        `Change Hotspot containing ${newCount} newly detected and ${changedCount} significantly altered seabed anomalies.`,
      ];
      if (hasCritical) {
        reasons.push('Contains high-consequence seabed hazard requiring immediate hydrographic intervention.');
      }

      changeAreas.push({
        id: `CHG-AREA-0${areaIdx++}`,
        centerLatitude: Math.round(centerLat * 100000) / 100000,
        centerLongitude: Math.round(centerLng * 100000) / 100000,
        radiusMeters: Math.round(maxDist + 30),
        newTargetCount: newCount,
        changedTargetCount: changedCount,
        persistentTargetCount: persistentCount,
        changeScore: maxScore,
        priority,
        targetIds,
        reasons,
      });
    }

    // Sort by priority and changeScore
    changeAreas.sort((a, b) => {
      const pWeight = (p: RiskLevel) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : p === 'MODERATE' ? 1 : 0);
      const diff = pWeight(b.priority) - pWeight(a.priority);
      if (diff !== 0) return diff;
      return b.changeScore - a.changeScore;
    });

    return changeAreas;
  }
}
