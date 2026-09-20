/**
 * Future AI Detection & Classification Inference Engine Contract
 * SIH 2026 Problem Statement 26057
 * 
 * Defines the contract between the Sonar Ingestion Preprocessing Pipeline
 * and the future Deep Learning / Edge AI inference engine.
 */

import { NormalizedSonarFrame } from '../../types/sonarFrame';
import { DebrisCategory, SeverityLevel } from '../../types/target';

export interface BoundingBox2D {
  x: number;      // Horizontal sample index (0 to total width - 1)
  y: number;      // Vertical ping line index in waterfall buffer
  width: number;  // Bounding width in acoustic samples
  height: number; // Bounding height in ping lines
}

export interface AcousticEvidenceReference {
  frameId: string;
  pingNumber: number;
  channel: 'PORT' | 'STARBOARD';
  slantRangeMeters: number;
  highlightIntensityDb: number;
  shadowLengthMeters: number;
  estimatedTargetHeightMeters: number;
  calculatedGroundRangeMeters: number;
}

export interface InferenceCandidate {
  id: string;
  classification: DebrisCategory;
  categoryLabel: string;
  confidence: number; // 0.0 to 1.0
  severity: SeverityLevel;
  channel: 'PORT' | 'STARBOARD';
  boundingBox: BoundingBox2D;
  acousticEvidence: AcousticEvidenceReference;
  estimatedLengthMeters: number;
  estimatedWidthMeters: number;
}

export interface InferenceResult {
  frameId: string;
  pingNumber: number;
  timestamp: string;
  inferenceTimeMs: number;
  modelVersion: string;
  hardwareBackend: 'CPU_SIMULATED' | 'EDGE_TPU' | 'ONNX_RUNTIME' | 'CUDA_WASM';
  detections: InferenceCandidate[];
  modelConfidenceThreshold: number;
}

export interface ISonarInferenceEngine {
  readonly modelName: string;
  readonly modelVersion: string;
  readonly isInitialized: boolean;

  /**
   * Initializes model weights and execution provider
   */
  initialize(): Promise<boolean>;

  /**
   * Evaluates normalized acoustic frame and generates detection candidates
   */
  detectAnomalies(frame: NormalizedSonarFrame): Promise<InferenceResult>;
}
