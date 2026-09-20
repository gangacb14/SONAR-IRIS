/**
 * Hazard Prioritization & Risk Scoring Layer
 * SIH 2026 Problem Statement 26057
 * 
 * Computes navigational and environmental risk independently from AI model confidence.
 * Labeled as a transparent rule-based prototype risk model.
 */

import { CandidateDetection } from '../../types/aiInference';
import { SeverityLevel } from '../../types/target';

export interface HazardAssessment {
  severity: SeverityLevel;
  riskScore: number; // 0 to 100
  factors: string[];
  justification: string;
}

export class HazardScorer {
  /**
   * Evaluates anomaly candidate attributes and computes hazard severity
   */
  public static assessHazard(candidate: CandidateDetection): HazardAssessment {
    let score = 20; // Baseline ambient seabed score
    const factors: string[] = [];

    // Factor 1: High-consequence classifications
    if (candidate.classification === 'POSSIBLE_UXO') {
      score += 65;
      factors.push('CRITICAL HAZARD: Historical Munitions / UXO Classification');
    } else if (candidate.classification === 'DRUM_OR_CONTAINER') {
      score += 45;
      factors.push('HAZMAT RISK: Chemical/Oil Drum Containment Breach Potential');
    } else if (candidate.classification === 'PIPELINE_OR_CABLE') {
      score += 40;
      factors.push('INFRASTRUCTURE: Subsea Transmission Cable / Pipeline Proximity');
    } else if (candidate.classification === 'GHOST_NET') {
      score += 35;
      factors.push('ENTANGLEMENT HAZARD: Synthetic Netting Threat to Divers & Marine Life');
    } else if (candidate.classification === 'WRECKAGE') {
      score += 35;
      factors.push('NAVIGATIONAL HAZARD: Submerged Hull Structure Obstruction');
    } else if (candidate.classification === 'TIRE_CLUSTER') {
      score += 20;
      factors.push('BENTHIC DEBRIS: Commercial Tire Cluster');
    } else if (candidate.classification === 'ROCK_OR_GEOLOGICAL') {
      score -= 10;
      factors.push('NATURAL MORPHOLOGY: Geological Feature (Low Anthropogenic Risk)');
    }

    // Factor 2: Vertical relief / target height above seabed
    // Vertical relief > 2.0m presents shallow draft navigation risk
    if (candidate.estimatedHeight >= 2.5) {
      score += 25;
      factors.push(`VERTICAL OBSTRUCTION: High target relief (${candidate.estimatedHeight.toFixed(1)}m) above seabed`);
    } else if (candidate.estimatedHeight >= 1.5) {
      score += 15;
      factors.push(`MODERATE RELIEF: Target height ${candidate.estimatedHeight.toFixed(1)}m`);
    }

    // Factor 3: Target physical footprint / size
    if (candidate.estimatedLength >= 15.0) {
      score += 15;
      factors.push(`EXTENDED DIMENSIONS: Anomaly span exceeds 15.0m (${candidate.estimatedLength.toFixed(1)}m)`);
    }

    // Factor 4: Shallow water amplification
    // If seabed depth is shallow (< 20m), any vertical structure is more dangerous to vessels
    if (candidate.seabedDepthMeters < 20.0 && candidate.estimatedHeight >= 1.0) {
      score += 15;
      factors.push(`SHALLOW WATER VULNERABILITY: Depth ${candidate.seabedDepthMeters.toFixed(1)}m amplifies keel strike risk`);
    }

    // Clamp score to [0, 100]
    const finalScore = Math.max(0, Math.min(100, score));

    // Map score to SeverityLevel
    let severity: SeverityLevel = 'LOW';
    if (finalScore >= 75 || candidate.classification === 'POSSIBLE_UXO') {
      severity = 'CRITICAL';
    } else if (finalScore >= 55) {
      severity = 'HIGH';
    } else if (finalScore >= 35) {
      severity = 'MODERATE';
    } else {
      severity = 'LOW';
    }

    return {
      severity,
      riskScore: finalScore,
      factors,
      justification: `Prototype rule-based risk evaluation evaluated ${factors.length} spatial/acoustic factors.`,
    };
  }
}
