/**
 * Pre-Inference Quality Gate
 * SIH 2026 Problem Statement 26057
 * 
 * Verifies that a normalized sonar frame possesses sufficient acoustic signal-to-noise
 * ratio, valid navigation metadata, and absence of receiver saturation before permitting
 * inference. Prevents generating false detections on corrupted or invalid packets.
 */

import { NormalizedSonarFrame } from '../../types/sonarFrame';
import { QualityGateStatus, QualityGateSkipReason } from '../../types/aiInference';

export interface QualityGateEvaluation {
  status: QualityGateStatus;
  skipReason?: QualityGateSkipReason;
  warnings: string[];
  evaluatedScore: number;
  message: string;
}

export class QualityGate {
  /**
   * Evaluates processed acoustic frame against operational quality thresholds
   */
  public static evaluate(frame: NormalizedSonarFrame): QualityGateEvaluation {
    const warnings: string[] = [];

    // Check 1: Structural & channel integrity
    const port = frame?.portProcessedSamples || frame?.portRawSamples;
    const stbd = frame?.starboardProcessedSamples || frame?.starboardRawSamples;

    if (!frame || !port || !stbd) {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'MISSING_CHANNEL',
        warnings: ['One or both acoustic channels missing in frame.'],
        evaluatedScore: 0,
        message: 'Acoustic swath payload incomplete; port/starboard sample arrays not present.',
      };
    }

    if (port.length === 0 || stbd.length === 0) {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'MISSING_CHANNEL',
        warnings: ['Empty sample arrays in frame.'],
        evaluatedScore: 0,
        message: 'Acoustic swath payload has zero samples.',
      };
    }

    // Check 2: Metadata sanity
    if (
      isNaN(frame.latitude) || 
      isNaN(frame.longitude) || 
      frame.rangeMeters <= 0 || 
      frame.altitudeMeters < 0
    ) {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'INVALID_METADATA',
        warnings: ['Invalid geographic coordinates or zero range in sonar frame.'],
        evaluatedScore: frame.quality?.score || 0,
        message: 'Hydrographic navigation coordinates or range parameters violate physics bounds.',
      };
    }

    // Check 3: Corrupted or marked invalid by preprocessing
    if (frame.processingStatus === 'FAILED' || frame.quality?.status === 'INVALID') {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'CORRUPTED_FRAME',
        warnings: [frame.processingError || 'Frame marked invalid or failed by preprocessing pipeline.'],
        evaluatedScore: frame.quality?.score || 0,
        message: 'Upstream preprocessing pipeline flagged packet as corrupted or unrecoverable.',
      };
    }

    // Check 4: Receiver saturation threshold (> 40% saturated)
    const saturation = frame.quality?.saturationPercentage ?? 0;
    if (saturation > 40) {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'EXCESSIVE_SATURATION',
        warnings: [`Acoustic receiver saturation is ${saturation}%, exceeding the 40% operational ceiling.`],
        evaluatedScore: frame.quality?.score || 10,
        message: 'Extreme acoustic transducer saturation detected; shadow contrast is washed out.',
      };
    }

    // Check 5: Minimal SNR / Quality score threshold (< 30/100)
    const score = frame.quality?.score ?? 50;
    if (score < 30) {
      return {
        status: 'INFERENCE_SKIPPED',
        skipReason: 'LOW_SIGNAL_QUALITY',
        warnings: [`Acoustic quality score is ${score}/100, below minimum inference threshold of 30.`],
        evaluatedScore: score,
        message: 'Acoustic signal-to-noise ratio is too low for reliable target extraction.',
      };
    }

    // Usable frame — add warnings if slightly degraded
    if (frame.processingStatus === 'DEGRADED') {
      warnings.push('Acoustic swath is moderately degraded; operating with heightened false-positive filter.');
    }
    if (saturation > 20) {
      warnings.push(`Mild acoustic saturation present (${saturation}%).`);
    }

    return {
      status: 'INFERENCE_ALLOWED',
      warnings,
      evaluatedScore: score,
      message: 'Quality gate verified: acoustic frame conforms to signal-to-noise and geometry criteria.',
    };
  }
}
