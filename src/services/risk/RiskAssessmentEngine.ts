/**
 * Central Risk & Hazard Prioritization Assessment Engine
 * SIH 2026 Problem Statement 26057
 * 
 * Provides deterministic, explainable risk calculations for hydrographic
 * survey decision-support.
 * 
 * Principles:
 * 1. Independent of React components (pure business logic)
 * 2. Deterministic & fully explainable (transparent scoring + human-readable reasons)
 * 3. AI Confidence != Hazard Severity (strictly decoupled)
 * 4. Geological vs Anthropogenic distinction respected (geology is not an artificial hazard)
 * 5. Unknown anomalies receive dedicated investigation pathways
 * 6. Supports Operator Risk Overrides with full provenance preservation
 */

import { Target, DebrisCategory } from '../../types/target';
import {
  RiskAssessment,
  RiskCategory,
  RiskLevel,
  RiskWeightConfig,
  DEFAULT_RISK_WEIGHTS,
  RISK_THRESHOLDS,
  SurveyRiskContext,
  RiskSummaryCounts,
} from '../../types/risk';

export class RiskAssessmentEngine {
  public static readonly VERSION = 'SIH-2026-v1.0';

  /**
   * Deterministically evaluates a target's risk profile against survey context.
   */
  public static assessTargetRisk(
    target: Target,
    surveyContext?: SurveyRiskContext,
    weights: RiskWeightConfig = DEFAULT_RISK_WEIGHTS
  ): RiskAssessment {
    const reasons: string[] = [];

    // 1. Determine Primary Risk Category & Base Severity
    const { primaryCategory, baseSeverity, categoryReason, recommendedAction } =
      this.evaluateCategoryBaseline(target);
    reasons.push(categoryReason);

    // 2. Size & Vertical Relief Contribution (0 - 100)
    const length = target.estimatedLength || target.estimatedLengthMeters || 1.0;
    const width = target.estimatedWidth || target.estimatedWidthMeters || 1.0;
    const height = target.shadowHeight || target.estimatedTargetHeightMeters || 0.5;
    const footprintArea = length * width;

    let sizeContribution = Math.min(100, Math.round(footprintArea * 3.5 + height * 15));
    if (footprintArea >= 12.0) {
      reasons.push(`Large estimated target footprint (${length.toFixed(1)}m × ${width.toFixed(1)}m, ${footprintArea.toFixed(1)}m²)`);
    } else if (footprintArea >= 4.0) {
      reasons.push(`Moderate benthic footprint (${length.toFixed(1)}m × ${width.toFixed(1)}m)`);
    }

    if (height >= 1.8) {
      reasons.push(`Elevated vertical relief (${height.toFixed(1)}m) creates shallow draft navigational hazard`);
      sizeContribution = Math.min(100, sizeContribution + 20);
    } else if (height >= 0.8) {
      reasons.push(`Substantial acoustic shadow relief (${height.toFixed(1)}m above seabed)`);
    }

    // 3. Acoustic Evidence Quality & AI Confidence Contribution (0 - 100)
    // Note: AI Confidence is treated strictly as evidence reliability, NOT hazard severity.
    const confidenceScore = Math.min(100, Math.max(0, Math.round((target.confidence ?? 0.5) * 100)));
    if (confidenceScore >= 80) {
      reasons.push(`High AI classification confidence (${confidenceScore}%) based on acoustic specular highlights`);
    } else if (confidenceScore >= 60) {
      reasons.push(`Reliable acoustic feature confidence (${confidenceScore}%)`);
    } else {
      reasons.push(`Moderate confidence (${confidenceScore}%); acoustic re-inspection suggested`);
    }

    const backscatter = target.backscatter ?? target.backscatterDb ?? -15.0;
    if (backscatter > -5.0) {
      reasons.push(`Strong acoustic specular backscatter (${backscatter.toFixed(1)} dB)`);
    }

    const shadowLength = target.shadowLength || target.shadowLengthMeters || 0;
    if (shadowLength >= 2.5) {
      reasons.push(`Prominent acoustic shadow signature (${shadowLength.toFixed(1)}m shadow length)`);
    }

    // 4. Proximity to Survey Transect / Vessel Track (0 - 100)
    const groundRange = target.groundRange || target.groundRangeMeters || 30.0;
    // Closer to vessel track / nadir fairway means higher operational relevance
    let proximityScore = 50;
    if (groundRange <= 20.0) {
      proximityScore = 85;
      reasons.push(`Located close to survey vessel track (${groundRange.toFixed(1)}m ground range)`);
    } else if (groundRange <= 45.0) {
      proximityScore = 65;
      reasons.push(`Mid-swath corridor location (${groundRange.toFixed(1)}m range)`);
    } else {
      proximityScore = 40;
    }

    // 5. Contextual Exposure (Infrastructure / Shipping Fairway Proximity) (0 - 100)
    let contextualExposure = 35; // default ambient
    if (surveyContext?.knownInfrastructure && surveyContext.knownInfrastructure.length > 0) {
      for (const feat of surveyContext.knownInfrastructure) {
        const dLat = Math.abs(target.latitude - feat.centerCoord[1]);
        const dLng = Math.abs(target.longitude - feat.centerCoord[0]);
        // Approx distance in meters (~111,000m per degree lat)
        const approxDistM = Math.hypot(dLat * 111000, dLng * 111000 * Math.cos((target.latitude * Math.PI) / 180));
        if (approxDistM <= feat.radiusMeters) {
          if (feat.type === 'PIPELINE' || feat.type === 'SUBSEA_CABLE') {
            contextualExposure = Math.max(contextualExposure, 85);
            reasons.push(`Potential interaction with known infrastructure corridor (${feat.name})`);
          } else if (feat.type === 'SHIPPING_FAIRWAY') {
            contextualExposure = Math.max(contextualExposure, 75);
            reasons.push(`Located inside or adjacent to shipping fairway buffer (${feat.name})`);
          } else if (feat.type === 'ECOLOGICAL_ZONE') {
            contextualExposure = Math.max(contextualExposure, 70);
            reasons.push(`Proximity to sensitive marine habitat / ecological zone (${feat.name})`);
          }
        }
      }
    } else {
      // Default contextual check from coordinates if demo dataset
      if (surveyContext?.isDemoReplay ?? true) {
        // Standard Gulf of Mannar fairway buffer zone
        contextualExposure = 60;
        reasons.push('Located within Gulf of Mannar commercial fairway buffer zone (DEMO REPLAY)');
      }
    }

    // 6. Uncertainty & Ambiguity Contribution (0 - 100)
    let uncertaintyContribution = 20;
    const cat = String(target.category || target.classification || '');
    if (cat === 'UNKNOWN_ANOMALY' || target.verificationStatus === 'PENDING_REVIEW') {
      uncertaintyContribution = 75;
      reasons.push('Target classification requires hydrographer verification review');
    }
    if (confidenceScore < 60) {
      uncertaintyContribution = Math.max(uncertaintyContribution, 70);
    }

    // 7. Weighted Normalization
    let rawScore =
      weights.hazardSeverity * baseSeverity +
      weights.contextualExposure * contextualExposure +
      weights.size * sizeContribution +
      weights.proximity * proximityScore +
      weights.evidenceQuality * confidenceScore +
      weights.uncertainty * uncertaintyContribution;

    // Strict Rule 4: Geological vs Man-Made Distinction
    // Geological features must NOT be converted into artificial hazards because of high AI confidence.
    if (primaryCategory === 'GEOLOGICAL') {
      // Hard clamp for natural geology: Maximum score 24 (LOW)
      rawScore = Math.min(24, Math.round(rawScore * 0.35));
    }

    // Possible UXO rule: strictly maintain high baseline
    if (cat === 'ORDNANCE_UXO' || cat === 'POSSIBLE_UXO') {
      rawScore = Math.max(78, rawScore);
    }

    // Pipeline exposure rule: maintain critical baseline for exposed subsea infrastructure
    if (cat === 'PIPELINE_EXPOSURE' || cat === 'PIPELINE_OR_CABLE') {
      rawScore = Math.max(76, rawScore);
    }

    // Investigation category rule: unverified anomalies maintain measured moderate priority
    if (primaryCategory === 'INVESTIGATION') {
      rawScore = Math.min(48, rawScore);
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const calculatedRiskLevel = this.scoreToRiskLevel(finalScore);

    const assessedAt = new Date().toISOString();

    return {
      targetId: target.id,
      riskLevel: target.operatorRiskLevel || calculatedRiskLevel,
      riskScore: finalScore,
      primaryCategory,
      severityScore: baseSeverity,
      confidenceContribution: confidenceScore,
      proximityScore,
      sizeContribution,
      uncertaintyContribution,
      contextualExposure,
      priorityRank: 0, // Assigned by assessAndRankTargets
      reasons,
      recommendedAction,
      assessedAt,
      assessmentVersion: this.VERSION,
      dataProvenance: surveyContext?.isDemoReplay ?? true ? 'SIMULATED' : 'DERIVED',
      operatorRiskLevel: target.operatorRiskLevel,
      operatorOverrideReason: target.operatorOverrideReason,
    };
  }

  /**
   * Assesses an array of targets and assigns relative priority ranks (1 = highest risk).
   */
  public static assessAndRankTargets(
    targets: Target[],
    surveyContext?: SurveyRiskContext,
    weights: RiskWeightConfig = DEFAULT_RISK_WEIGHTS
  ): Target[] {
    if (!targets || targets.length === 0) return [];

    // Assess individual risks
    const assessedTargets = targets.map((t) => {
      const assessment = this.assessTargetRisk(t, surveyContext, weights);
      return {
        ...t,
        riskAssessment: assessment,
      };
    });

    // Sort by effective risk score descending to compute priorityRank
    // For sorting: operator override risk level gets high priority, then numerical riskScore
    const priorityWeight: Record<RiskLevel, number> = {
      CRITICAL: 4000,
      HIGH: 3000,
      MODERATE: 2000,
      LOW: 1000,
    };

    const sortedByRisk = [...assessedTargets].sort((a, b) => {
      const aLevel = a.riskAssessment?.operatorRiskLevel || a.riskAssessment?.riskLevel || 'LOW';
      const bLevel = b.riskAssessment?.operatorRiskLevel || b.riskAssessment?.riskLevel || 'LOW';
      const aEffectiveScore = (priorityWeight[aLevel] || 0) + (a.riskAssessment?.riskScore || 0);
      const bEffectiveScore = (priorityWeight[bLevel] || 0) + (b.riskAssessment?.riskScore || 0);
      if (bEffectiveScore !== aEffectiveScore) {
        return bEffectiveScore - aEffectiveScore;
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });

    // Create rank mapping
    const rankMap = new Map<string, number>();
    sortedByRisk.forEach((t, idx) => {
      rankMap.set(t.id, idx + 1);
    });

    // Return in original order with priorityRank populated in riskAssessment
    return assessedTargets.map((t) => {
      const rank = rankMap.get(t.id) || 1;
      return {
        ...t,
        riskAssessment: {
          ...t.riskAssessment!,
          priorityRank: rank,
        },
      };
    });
  }

  /**
   * Maps numerical score (0 - 100) to RiskLevel.
   */
  public static scoreToRiskLevel(score: number): RiskLevel {
    if (score >= RISK_THRESHOLDS.CRITICAL_MIN) return 'CRITICAL';
    if (score > RISK_THRESHOLDS.MODERATE_MAX) return 'HIGH';
    if (score > RISK_THRESHOLDS.LOW_MAX) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Summarizes risk counts across a collection of assessed targets or assessments.
   */
  public static summarizeRisk(targets: Array<Target | RiskAssessment>): RiskSummaryCounts {
    let critical = 0;
    let high = 0;
    let moderate = 0;
    let low = 0;

    for (const item of targets) {
      const riskLevel: RiskLevel | undefined =
        'riskLevel' in item && typeof (item as any).riskLevel === 'string'
          ? (item as RiskAssessment).operatorRiskLevel || (item as RiskAssessment).riskLevel
          : (item as Target).riskAssessment?.operatorRiskLevel || (item as Target).riskAssessment?.riskLevel;

      if (riskLevel === 'CRITICAL') critical++;
      else if (riskLevel === 'HIGH') high++;
      else if (riskLevel === 'MODERATE') moderate++;
      else if (riskLevel === 'LOW') low++;
    }

    return {
      critical,
      high,
      moderate,
      low,
      totalAssessed: targets.length,
    };
  }

  // Instance wrappers for flexible OOP or dependency-injected usage
  public assessTarget(
    target: Target,
    surveyContext?: SurveyRiskContext,
    weights?: RiskWeightConfig
  ): RiskAssessment {
    return RiskAssessmentEngine.assessTargetRisk(target, surveyContext, weights);
  }

  public assessAllTargets(
    targets: Target[],
    surveyContext?: SurveyRiskContext,
    weights?: RiskWeightConfig
  ): Target[] {
    return RiskAssessmentEngine.assessAndRankTargets(targets, surveyContext, weights);
  }

  public summarizeRisk(targets: Array<Target | RiskAssessment>): RiskSummaryCounts {
    return RiskAssessmentEngine.summarizeRisk(targets);
  }

  /**
   * Evaluates category-specific baseline hazard severity and operational recommendations.
   */
  private static evaluateCategoryBaseline(target: Target): {
    primaryCategory: RiskCategory;
    baseSeverity: number;
    categoryReason: string;
    recommendedAction: string;
  } {
    const rawCategory = String(target.category || target.classification || '').toUpperCase();
    const label = String(target.categoryLabel || '').toLowerCase();

    // 1. POSSIBLE_UXO / ORDNANCE_UXO
    if (rawCategory === 'ORDNANCE_UXO' || rawCategory === 'POSSIBLE_UXO' || label.includes('uxo')) {
      return {
        primaryCategory: 'SAFETY',
        baseSeverity: 95,
        categoryReason: 'Safety hazard: Possible UXO / unexploded munition acoustic signature (detonation risk)',
        recommendedAction: 'Escalate for specialist assessment before physical intervention',
      };
    }

    // 2. METALLIC_DRUM / DRUM_OR_CONTAINER
    if (
      rawCategory === 'METALLIC_DRUM' ||
      rawCategory === 'DRUM_OR_CONTAINER' ||
      label.includes('drum') ||
      label.includes('container')
    ) {
      return {
        primaryCategory: 'ENVIRONMENTAL',
        baseSeverity: 78,
        categoryReason: 'Environmental & safety risk: Possible chemical or petroleum container breach',
        recommendedAction: 'Prioritize hazardous-object inspection and environmental assessment',
      };
    }

    // 3. GHOST_NET
    if (rawCategory === 'GHOST_NET' || label.includes('net') || label.includes('ghost')) {
      return {
        primaryCategory: 'ENVIRONMENTAL',
        baseSeverity: 72,
        categoryReason: 'Environmental risk: Lost synthetic fishing gear posing marine entanglement threat',
        recommendedAction: 'Prioritize ROV visual inspection / recovery assessment',
      };
    }

    // 4. PIPELINE_EXPOSURE / PIPELINE_OR_CABLE
    if (
      rawCategory === 'PIPELINE_EXPOSURE' ||
      rawCategory === 'PIPELINE_OR_CABLE' ||
      label.includes('pipeline') ||
      label.includes('cable')
    ) {
      return {
        primaryCategory: 'INFRASTRUCTURE',
        baseSeverity: 88,
        categoryReason: 'Infrastructure hazard: Exposed subsea utility pipeline/cable asset with free-span hazard',
        recommendedAction: 'Prioritize infrastructure inspection and notification',
      };
    }

    // 5. WRECKAGE_DEBRIS / WRECKAGE
    if (rawCategory === 'WRECKAGE_DEBRIS' || rawCategory === 'WRECKAGE' || label.includes('wreck')) {
      return {
        primaryCategory: 'NAVIGATION',
        baseSeverity: 68,
        categoryReason: 'Navigational & investigation risk: Submerged vessel wreckage structure',
        recommendedAction: 'Conduct detailed target investigation',
      };
    }

    // 6. MARINE_DEBRIS / PLASTIC_AGGREGATE
    if (
      rawCategory === 'MARINE_DEBRIS' ||
      rawCategory === 'PLASTIC_AGGREGATE' ||
      label.includes('debris') ||
      label.includes('plastic')
    ) {
      return {
        primaryCategory: 'ENVIRONMENTAL',
        baseSeverity: 52,
        categoryReason: 'Environmental & navigation risk: Anthropogenic benthic debris accumulation',
        recommendedAction: 'Log for cleanup / survey corridor clearance',
      };
    }

    // 7. TIRE_CLUSTER
    if (rawCategory === 'TIRE_CLUSTER' || label.includes('tire')) {
      return {
        primaryCategory: 'ENVIRONMENTAL',
        baseSeverity: 36,
        categoryReason: 'Environmental risk: Submerged tire cluster on seafloor',
        recommendedAction: 'Log as low-priority benthic debris',
      };
    }

    // 8. METAL_OBJECT
    if (rawCategory === 'METAL_OBJECT' || label.includes('metal')) {
      return {
        primaryCategory: 'INVESTIGATION',
        baseSeverity: 48,
        categoryReason: 'Investigation risk: High-reflectance metallic target requiring identification',
        recommendedAction: 'Acoustic re-acquisition or visual inspection',
      };
    }

    // 9. GEOLOGICAL_FEATURE / ROCK_OR_GEOLOGICAL
    if (
      rawCategory === 'GEOLOGICAL_FEATURE' ||
      rawCategory === 'ROCK_OR_GEOLOGICAL' ||
      label.includes('geolog') ||
      label.includes('rock')
    ) {
      return {
        primaryCategory: 'GEOLOGICAL',
        baseSeverity: 10,
        categoryReason: 'Geological category: Natural seabed morphology / rock outcrop (non-hazard)',
        recommendedAction: 'No immediate hazard action; retain as geological reference',
      };
    }

    // 10. UNKNOWN_ANOMALY (Default / Fallback)
    return {
      primaryCategory: 'INVESTIGATION',
      baseSeverity: 46,
      categoryReason: 'Investigation risk: Unresolved acoustic anomaly requiring hydrographer review',
      recommendedAction: 'Acquire additional sonar coverage / operator review',
    };
  }
}
