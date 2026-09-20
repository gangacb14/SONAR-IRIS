/**
 * AI Sonar Detection & Anomaly Intelligence Layer Type Definitions
 * SIH 2026 Problem Statement 26057
 */

import { SeverityLevel } from './target';
import { NormalizedSonarFrame } from './sonarFrame';

/**
 * Controlled classification taxonomy for underwater sonar anomaly analysis.
 */
export type SonarClassification =
  | 'GHOST_NET'
  | 'MARINE_DEBRIS'
  | 'TIRE_CLUSTER'
  | 'METAL_OBJECT'
  | 'DRUM_OR_CONTAINER'
  | 'WRECKAGE'
  | 'PIPELINE_OR_CABLE'
  | 'ROCK_OR_GEOLOGICAL'
  | 'POSSIBLE_UXO'
  | 'UNKNOWN_ANOMALY';

/**
 * Pre-inference quality gate decision
 */
export type QualityGateStatus = 'INFERENCE_ALLOWED' | 'INFERENCE_SKIPPED';

export type QualityGateSkipReason =
  | 'LOW_SIGNAL_QUALITY'
  | 'EXCESSIVE_SATURATION'
  | 'MISSING_CHANNEL'
  | 'INVALID_METADATA'
  | 'CORRUPTED_FRAME'
  | 'SYSTEM_PAUSED';

/**
 * Geological discrimination classification
 */
export type GeologicalAffinity = 'LIKELY_MAN_MADE' | 'LIKELY_GEOLOGICAL' | 'AMBIGUOUS';

/**
 * Quality rating of detection signal
 */
export type DetectionQuality = 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGRADED';

/**
 * Normalized 2D bounding region
 */
export interface BoundingRegion {
  xMin: number; // 0.0 to 1.0 across channel width
  xMax: number;
  yMin: number; // ping lines
  yMax: number;
  normX: number; // center X (0.0 to 1.0)
  normY: number; // center Y
  width: number;
  height: number;
}

/**
 * Transparent scientific provenance record
 */
export interface InferenceProvenance {
  modelVersion: string;
  inferenceMode: 'SIMULATED' | 'ONNX' | 'TENSORRT';
  preprocessingVersion: string;
  hardwareBackend: string;
  measuredLatencyMs: number;
  isSimulatedTiming: boolean;
  timestamp: string;
}

/**
 * Evidence record explaining why an anomaly was flagged
 */
export interface DetectionEvidence {
  whyFlagged: string[];
  peakBackscatterDb: number;
  shadowLengthMeters: number;
  estimatedReliefMeters: number;
  classificationSignals: string[];
  geologicalAffinity: GeologicalAffinity;
  geologicalReasoning: string;
  heuristicFiltersApplied: string[];
  acousticCutoutRef?: string;
  frameQualityScore: number;
  frameQualityStatus: string;
}

/**
 * AI Candidate Detection (Produced by Inference Engine before Target Conversion)
 */
export interface CandidateDetection {
  detectionId: string;
  trackId?: string; // Multi-ping temporal association track ID (e.g. TRK-26057-009)
  classId: number;
  classification: SonarClassification;
  categoryLabel: string;
  confidence: number; // 0.0 to 1.0 (AI confidence is separate from verification)
  boundingRegion: BoundingRegion;
  channel: 'PORT' | 'STARBOARD';
  slantRange: number; // meters
  estimatedGroundRange: number; // meters
  estimatedLength: number; // meters
  estimatedWidth: number; // meters
  shadowLength: number; // meters
  estimatedHeight: number; // meters
  backscatterDb: number; // dB
  detectionQuality: DetectionQuality;
  geologicalAffinity: GeologicalAffinity;
  hazardSeverity: SeverityLevel;
  evidenceReference: DetectionEvidence;
  provenance: InferenceProvenance;
  frameId: string;
  pingNumber: number;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  seabedDepthMeters: number;
}

/**
 * Complete Inference Result produced per sonar frame
 */
export interface InferenceResult {
  inferenceId: string;
  frameId: string;
  pingNumber: number;
  timestamp: string;
  modelVersion: string;
  inferenceMode: 'SIMULATED' | 'ONNX' | 'TENSORRT';
  processingTimeMs: number;
  qualityGate: QualityGateStatus;
  skipReason?: QualityGateSkipReason;
  detections: CandidateDetection[];
  warnings: string[];
  executionDevice: string;
}

/**
 * Multi-ping acoustic track association record
 */
export interface MultiPingTrack {
  trackId: string; // e.g. TRK-26057-009
  targetId?: string; // bound to canonical Target ID (e.g. TRG-26057-01)
  firstPing: number;
  lastPing: number;
  pingCount: number;
  classification: SonarClassification;
  channel: 'PORT' | 'STARBOARD';
  meanGroundRangeMeters: number;
  meanSlantRangeMeters: number;
  totalAlongTrackLengthMeters: number;
  maxEstimatedWidthMeters: number;
  maxEstimatedHeightMeters: number;
  maxConfidence: number;
  latitude: number;
  longitude: number;
  lastSeenTimestamp: string;
}

/**
 * Operational runtime status of the inference engine.
 * Distinguishes genuine loaded ONNX model inference from development fallback or failure.
 */
export type ModelRuntimeStatus = 'ONNX_ACTIVE' | 'FALLBACK_SIMULATED' | 'UNAVAILABLE';

export interface ModelRuntimeInfo {
  status: ModelRuntimeStatus;
  modelPath: string;
  modelVersion: string;
  hardwareBackend: string;
  isRealOnnxLoaded: boolean;
  loadError?: string;
  lastInferenceMs: number;
}

/**
 * Replaceable Sonar Inference Engine Interface
 */
export interface ISonarInferenceEngine {
  readonly engineId: string;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly inferenceMode: 'SIMULATED' | 'ONNX' | 'TENSORRT';
  readonly isReady: boolean;
  getRuntimeInfo?(): ModelRuntimeInfo;

  /**
   * Initializes model weights or session runtime
   */
  initialize(): Promise<boolean>;

  /**
   * Evaluates processed sonar frame and generates candidate detections
   */
  infer(frame: NormalizedSonarFrame): Promise<InferenceResult>;
}
