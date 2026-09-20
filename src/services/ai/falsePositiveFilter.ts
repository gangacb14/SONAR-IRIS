/**
 * False-Positive Reduction & Geological Discrimination Layer
 * SIH 2026 Problem Statement 26057
 * 
 * Note: Labeled as "heuristic post-processing" pending future learned deep-learning filters.
 */

import { CandidateDetection, GeologicalAffinity } from '../../types/aiInference';
import { NormalizedSonarFrame } from '../../types/sonarFrame';

export interface FilterResult {
  isAccepted: boolean;
  rejectionReason?: string;
  geologicalAffinity: GeologicalAffinity;
  geologicalReasoning: string;
  appliedFilters: string[];
  adjustedConfidence: number;
}

export class FalsePositiveFilter {
  /**
   * Applies heuristic post-processing checks and geological discrimination
   */
  public static evaluateCandidate(
    detection: CandidateDetection,
    frame: NormalizedSonarFrame
  ): FilterResult {
    const appliedFilters: string[] = [];
    let adjustedConfidence = detection.confidence;

    // Check 1: Nadir Proximity Check
    // Echoes within 2.0m of the nadir line are often towfish altitude crosstalk or water-column boundary leakage
    if (detection.estimatedGroundRange < 2.0) {
      return {
        isAccepted: false,
        rejectionReason: 'Nadir proximity artifact: object within 2.0m of nadir centerline.',
        geologicalAffinity: 'AMBIGUOUS',
        geologicalReasoning: 'Signal located within nadir water column boundary reflection zone.',
        appliedFilters: ['HEURISTIC: NADIR_PROXIMITY_GATE'],
        adjustedConfidence: 0.1,
      };
    }
    appliedFilters.push('HEURISTIC: NADIR_CLEARANCE_CHECK');

    // Check 2: Physical Dimension Bounds Check
    if (detection.estimatedLength < 0.25) {
      return {
        isAccepted: false,
        rejectionReason: 'Sub-acoustic resolution: estimated length < 0.25m is below 410 kHz chirp resolution limit.',
        geologicalAffinity: 'AMBIGUOUS',
        geologicalReasoning: 'Single isolated speckle pixel return.',
        appliedFilters: ['HEURISTIC: MIN_DIMENSION_GATE'],
        adjustedConfidence: 0.15,
      };
    }

    if (detection.estimatedLength > 80.0 && detection.classification !== 'PIPELINE_OR_CABLE') {
      return {
        isAccepted: false,
        rejectionReason: 'Excessive dimension: non-pipeline anomaly > 80m length exceeds realistic single debris bounds.',
        geologicalAffinity: 'LIKELY_GEOLOGICAL',
        geologicalReasoning: 'Large continuous seabed morphological trend or sand dune ridge.',
        appliedFilters: ['HEURISTIC: MAX_DIMENSION_GATE'],
        adjustedConfidence: 0.2,
      };
    }
    appliedFilters.push('HEURISTIC: PHYSICAL_DIMENSIONS_CHECK');

    // Check 3: Shadow Plausibility Check
    // If estimated relief is substantial (> 1.5m) but shadow is nonexistent (< 0.2m), shadow geometry is physically implausible
    if (detection.estimatedHeight > 1.8 && detection.shadowLength < 0.3) {
      // Demote confidence and penalize
      adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.25);
      appliedFilters.push('HEURISTIC: SHADOW_GEOMETRY_PENALTY');
    } else {
      appliedFilters.push('HEURISTIC: ACOUSTIC_SHADOW_CONFIRMED');
    }

    // Check 4: Geological Discrimination
    const geologicalResult = this.discriminateGeology(detection, frame);
    appliedFilters.push(`GEOLOGY_DISCRIMINATOR: ${geologicalResult.affinity}`);

    // If clearly natural bedrock or sand ridge, and originally classified as generic debris, normalize to ROCK_OR_GEOLOGICAL
    if (geologicalResult.affinity === 'LIKELY_GEOLOGICAL') {
      if (detection.classification === 'MARINE_DEBRIS' || detection.classification === 'METAL_OBJECT') {
        detection.classification = 'ROCK_OR_GEOLOGICAL';
        detection.categoryLabel = 'Natural Bedrock / Geological Feature';
        adjustedConfidence = Math.min(0.85, adjustedConfidence * 0.9);
      }
    }

    // Check 5: Ambiguous / Low Evidence check
    // If evidence is weak and doesn't clearly match a known class, preserve as UNKNOWN_ANOMALY rather than hallucinating
    if (geologicalResult.affinity === 'AMBIGUOUS' && adjustedConfidence < 0.75) {
      if (detection.classification !== 'ROCK_OR_GEOLOGICAL' && detection.classification !== 'PIPELINE_OR_CABLE') {
        detection.classification = 'UNKNOWN_ANOMALY';
        detection.categoryLabel = 'Unknown Acoustic Anomaly';
      }
    }

    return {
      isAccepted: true,
      geologicalAffinity: geologicalResult.affinity,
      geologicalReasoning: geologicalResult.reasoning,
      appliedFilters,
      adjustedConfidence,
    };
  }

  /**
   * Discriminate between man-made objects and natural geological structures
   */
  private static discriminateGeology(
    detection: CandidateDetection,
    frame: NormalizedSonarFrame
  ): { affinity: GeologicalAffinity; reasoning: string } {
    // 1. Man-made signatures:
    // Compact shape, specular peak backscatter (>= -4 dB), sharp well-delineated acoustic shadow
    const isHighBackscatter = detection.backscatterDb >= -4.5;
    const hasDefinedShadow = detection.shadowLength >= 0.8;
    const isCompact = (detection.estimatedLength / Math.max(0.5, detection.estimatedWidth)) <= 4.5;

    if (
      (detection.classification === 'METAL_OBJECT' || 
       detection.classification === 'DRUM_OR_CONTAINER' || 
       detection.classification === 'TIRE_CLUSTER' ||
       detection.classification === 'POSSIBLE_UXO') &&
      isHighBackscatter && hasDefinedShadow
    ) {
      return {
        affinity: 'LIKELY_MAN_MADE',
        reasoning: 'Specular acoustic highlight with hard shadow boundary; characteristic of rigid anthropogenic material.',
      };
    }

    if (detection.classification === 'PIPELINE_OR_CABLE') {
      return {
        affinity: 'LIKELY_MAN_MADE',
        reasoning: 'Continuous linear trajectory with constant diameter free-span shadow across acoustic swath.',
      };
    }

    if (detection.classification === 'GHOST_NET') {
      return {
        affinity: 'LIKELY_MAN_MADE',
        reasoning: 'Diffuse billowy texture with rope/mesh acoustic backscatter distinct from ambient sediment bed.',
      };
    }

    // 2. Geological signatures:
    // Soft gradients, textured backscatter, elongated irregular shape, natural outcrop profile
    if (
      detection.classification === 'ROCK_OR_GEOLOGICAL' ||
      (detection.estimatedLength > 12.0 && detection.backscatterDb < -8.0) ||
      (!hasDefinedShadow && detection.estimatedLength > 5.0)
    ) {
      return {
        affinity: 'LIKELY_GEOLOGICAL',
        reasoning: 'Diffuse acoustic boundary with gradual relief transition consistent with natural seabed morphology.',
      };
    }

    // 3. Ambiguous signatures:
    return {
      affinity: 'AMBIGUOUS',
      reasoning: 'Moderate acoustic response with intermediate shadow contrast; insufficient spectral evidence to confirm anthropogenic origin.',
    };
  }
}
