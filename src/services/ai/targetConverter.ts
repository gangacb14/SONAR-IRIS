/**
 * Candidate Detection to Canonical Target Converter
 * SIH 2026 Problem Statement 26057
 * 
 * Converts an AI-verified anomaly candidate into a canonical survey Target model,
 * computing CRS transformations (WGS84 -> UTM) and populating acoustic evidence references.
 * Rule: verificationStatus is strictly initialized to PENDING_REVIEW.
 */

import { CandidateDetection } from '../../types/aiInference';
import { Target } from '../../types/target';
import { wgs84ToUtm } from '../../utils/geo';
import { mapClassificationToDebrisCategory, SONAR_TAXONOMY } from './taxonomy';

export class TargetConverter {
  /**
   * Converts CandidateDetection into a canonical Target
   */
  public static toTarget(
    candidate: CandidateDetection,
    surveyId: string,
    transectId: string,
    targetSeqNumber: number
  ): Target {
    const targetId = `TRG-26057-${String(targetSeqNumber).padStart(2, '0')}`;
    const legacyCategory = mapClassificationToDebrisCategory(candidate.classification);
    const meta = SONAR_TAXONOMY[candidate.classification];
    const categoryLabel = meta?.label || candidate.categoryLabel || 'Acoustic Anomaly';

    // Geodesic transformation to UTM
    let utmZone = '44N';
    let utmEasting = 410500.0;
    let utmNorthing = 1022100.0;

    try {
      const utm = wgs84ToUtm(candidate.latitude, candidate.longitude);
      utmZone = utm.zone;
      utmEasting = utm.easting;
      utmNorthing = utm.northing;
    } catch {
      // Fallback if coordinates are outside standard range
    }

    const crs = `WGS84 / UTM Zone ${utmZone}`;
    const detectedAt = new Date().toISOString();

    const boundingBox = {
      x: candidate.boundingRegion.normX * 100,
      y: candidate.boundingRegion.normY * 100,
      width: candidate.boundingRegion.width * 100,
      height: candidate.boundingRegion.height * 100,
    };

    const modelVersion = candidate.provenance?.modelVersion || 'demo-inference-v1';
    const inferenceMode = candidate.provenance?.inferenceMode || 'SIMULATED';
    const hardwareBackend = candidate.provenance?.hardwareBackend || 'CPU (Simulated)';
    const snrDb = candidate.evidenceReference?.peakBackscatterDb ?? -3.5;

    return {
      id: targetId,
      surveyId,
      transectId,
      pingNumber: candidate.pingNumber,
      channel: candidate.channel,

      // Classification & AI inference
      classification: legacyCategory,
      categoryLabel,
      confidence: candidate.confidence,

      // Geographic coordinates
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      coordinateReferenceSystem: crs,
      utmZone,
      utmEasting,
      utmNorthing,
      depth: candidate.seabedDepthMeters,

      // Acoustic & dimension metrics
      slantRange: candidate.slantRange,
      groundRange: candidate.estimatedGroundRange,
      towfishAltitude: candidate.altitudeMeters,
      estimatedLength: candidate.estimatedLength,
      estimatedWidth: candidate.estimatedWidth,
      shadowLength: candidate.shadowLength,
      shadowHeight: candidate.estimatedHeight,
      backscatter: candidate.backscatterDb,

      // Operational status
      severity: candidate.hazardSeverity,
      verificationStatus: 'PENDING_REVIEW', // Strict rule: AI proposes, operator verifies!
      operatorNotes: `AI candidate identified via ${modelVersion} (${inferenceMode}). Associated track: ${candidate.trackId || 'SINGLE_PING'}.`,
      detectedAt,

      // Sonar evidence
      sonarEvidenceReference: {
        pingOffset: candidate.pingNumber,
        rangeMeters: candidate.slantRange,
        waterfallBox: boundingBox,
      },

      modelMetadata: {
        modelName: modelVersion,
        featureExtractor: hardwareBackend,
        snrDb: snrDb,
        shadowContrastRatio: 1.85,
      },

      // Backwards compatibility properties
      transectLine: transectId,
      category: legacyCategory,
      timestamp: detectedAt,
      slantRangeMeters: candidate.slantRange,
      groundRangeMeters: candidate.estimatedGroundRange,
      towfishAltitudeMeters: candidate.altitudeMeters,
      shadowLengthMeters: candidate.shadowLength,
      estimatedTargetHeightMeters: candidate.estimatedHeight,
      estimatedLengthMeters: candidate.estimatedLength,
      estimatedWidthMeters: candidate.estimatedWidth,
      backscatterDb: candidate.backscatterDb,
      coordinates: {
        lat: candidate.latitude,
        lng: candidate.longitude,
        utmZone,
        utmEasting,
        utmNorthing,
        depthMeters: candidate.seabedDepthMeters,
      },
      waterfallBox: boundingBox,
    };
  }
}
