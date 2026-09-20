/**
 * Explainable AI Evidence Generator
 * SIH 2026 Problem Statement 26057
 * 
 * Generates factual, acoustic-grounded evidence explaining why an anomaly was flagged.
 * Strictly adheres to measured and derived signals without generative hallucination.
 */

import { CandidateDetection, DetectionEvidence } from '../../types/aiInference';
import { NormalizedSonarFrame } from '../../types/sonarFrame';
import { SONAR_TAXONOMY } from './taxonomy';

export class EvidenceBuilder {
  /**
   * Constructs an evidence record for an anomaly detection candidate
   */
  public static buildEvidence(
    candidate: Partial<CandidateDetection> & {
      classification: any;
      confidence: number;
      backscatterDb: number;
      shadowLength: number;
      estimatedHeight: number;
      estimatedGroundRange: number;
      channel: 'PORT' | 'STARBOARD';
    },
    frame: NormalizedSonarFrame,
    filtersApplied: string[],
    geologicalReasoning: string,
    geologicalAffinity: any
  ): DetectionEvidence {
    const whyFlagged: string[] = [];
    const classificationSignals: string[] = [];

    // 1. Backscatter reflection highlight
    if (candidate.backscatterDb >= -3.0) {
      whyFlagged.push(`Specular acoustic highlight: peak backscatter return of ${candidate.backscatterDb.toFixed(1)} dB`);
      classificationSignals.push('Strong reflective surface (rigid material/metallic/dense substrate)');
    } else if (candidate.backscatterDb >= -7.0) {
      whyFlagged.push(`Distinct acoustic highlight: backscatter return of ${candidate.backscatterDb.toFixed(1)} dB`);
      classificationSignals.push('Moderate reflective contrast against background seabed');
    } else {
      whyFlagged.push(`Diffuse backscatter anomaly: ${candidate.backscatterDb.toFixed(1)} dB`);
      classificationSignals.push('Textured or porous acoustic reflectance profile');
    }

    // 2. Acoustic shadow mensuration
    if (candidate.shadowLength > 0.4) {
      whyFlagged.push(`Persistent acoustic shadow: measured length of ${candidate.shadowLength.toFixed(2)} m`);
      whyFlagged.push(`Estimated target relief: ${candidate.estimatedHeight.toFixed(2)} m above seabed [H = (Ls × H_alt) / Rs]`);
    } else {
      whyFlagged.push('Minimal acoustic shadow: low-profile seabed obstruction');
    }

    // 3. Ground range and swath position
    whyFlagged.push(`Swath position: ${candidate.channel} channel at ${candidate.estimatedGroundRange.toFixed(1)} m ground range`);

    // 4. Model classification & confidence
    const meta = SONAR_TAXONOMY[candidate.classification];
    if (meta) {
      whyFlagged.push(`Class match: ${meta.label} (${Math.round(candidate.confidence * 100)}% confidence)`);
      classificationSignals.push(meta.acousticSignature);
    } else {
      whyFlagged.push(`Classification confidence: ${Math.round(candidate.confidence * 100)}%`);
    }

    // 5. Geological discrimination
    whyFlagged.push(`Geological discrimination: ${geologicalAffinity} (${geologicalReasoning})`);

    // 6. Frame quality context
    whyFlagged.push(`Sonar frame quality: ${frame.quality.status} (${frame.quality.score}/100)`);

    return {
      whyFlagged,
      peakBackscatterDb: candidate.backscatterDb,
      shadowLengthMeters: candidate.shadowLength,
      estimatedReliefMeters: candidate.estimatedHeight,
      classificationSignals,
      geologicalAffinity,
      geologicalReasoning,
      heuristicFiltersApplied: filtersApplied,
      frameQualityScore: frame.quality.score,
      frameQualityStatus: frame.quality.status,
    };
  }
}
