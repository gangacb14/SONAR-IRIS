/**
 * Strongly Typed Normalized Sonar Frame & Preprocessing Models
 * SIH 2026 Problem Statement 26057: Side-Scan Sonar Anomaly Detection
 */

export type DataOrigin = 'MEASURED' | 'SIMULATED' | 'DERIVED' | 'UNKNOWN';

export type ProcessingStatus = 
  | 'QUEUED' 
  | 'VALIDATING' 
  | 'PREPROCESSING' 
  | 'READY' 
  | 'DEGRADED' 
  | 'FAILED';

export type QualityStatus = 'GOOD' | 'ACCEPTABLE' | 'DEGRADED' | 'INVALID';

export interface SonarQualityReport {
  score: number; // 0–100 integer scale
  status: QualityStatus;
  flags: string[];
  dynamicRangeDb: number;
  noiseFloorEstimate: number;
  saturationPercentage: number;
  channelCompleteness: {
    port: boolean;
    starboard: boolean;
  };
}

export interface PreprocessingConfig {
  gain: number;               // 0.5x to 2.0x linear display gain
  tvg: number;                // 1.0x to 2.0x time-varying gain compensation slope
  contrast: number;           // 0.8x to 1.5x contrast adjustment
  isSlantRangeCorrected: boolean; // Geometric ground-range correction
  noiseFilterThreshold: number; // Low-level reverberation cut threshold (0.0 to 0.1)
}

export interface RawSonarPingInput {
  surveyId: string;
  transectId: string;
  pingNumber: number;
  timestamp: string;
  channel: 'PORT' | 'STARBOARD' | 'DUAL';
  sampleCount: number;
  rangeMeters: number;
  samplingIntervalUsec: number;
  frequencyKhz: number;
  
  // Navigation & INS telemetry at ping transmission time
  altitudeMeters: number;
  depthMeters: number;
  headingDeg: number;
  latitude: number;
  longitude: number;
  pitchDeg: number;
  rollDeg: number;
  speedKts: number;

  // Unprocessed acoustic samples (amplitude 0.0 - 1.0 or raw ADC counts)
  portSamples: number[];
  starboardSamples: number[];

  // Optional file/packet source metadata
  sourceFile?: string;
  packetFormat?: 'MOCK_REPLAY' | 'JSF_SIMULATED' | 'XTF_SIMULATED' | 'IMAGE_INGEST';
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID';
  issues: ValidationIssue[];
}

export interface NormalizedSonarFrame {
  frameId: string;
  surveyId: string;
  transectId: string;
  pingNumber: number;
  timestamp: string;
  channel: 'PORT' | 'STARBOARD' | 'DUAL';
  sampleCount: number;
  rangeMeters: number;
  samplingIntervalUsec: number;
  frequencyKhz: number;

  // Preprocessing parameters applied to this frame
  gain: number;
  tvg: number;
  contrast: number;
  isSlantRangeCorrected: boolean;

  // Navigation & Hydrographic Position
  altitudeMeters: number;
  depthMeters: number;
  headingDeg: number;
  latitude: number;
  longitude: number;
  pitchDeg: number;
  rollDeg: number;
  speedKts: number;

  // Scientific Data Origin Accounting
  dataOrigin: {
    acousticSamples: DataOrigin;
    navigationCoordinates: DataOrigin;
    altitudeDepth: DataOrigin;
    slantRangeCorrection: DataOrigin;
    tvgCompensation: DataOrigin;
  };

  // Acoustic intensity sample arrays (normalized 0.0 to 1.0)
  portRawSamples: number[];
  starboardRawSamples: number[];
  portProcessedSamples: number[];
  starboardProcessedSamples: number[];

  // Processing metrics & Quality Assessment
  quality: SonarQualityReport;
  processingStatus: ProcessingStatus;
  processingError?: string;
  processingTimeMs: number;
  lastValidFrameId?: string;
}
