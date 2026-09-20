import { RiskAssessment, RiskLevel } from './risk';

export type DebrisCategory =
  | 'GHOST_NET'
  | 'METALLIC_DRUM'
  | 'PLASTIC_AGGREGATE'
  | 'WRECKAGE_DEBRIS'
  | 'TIRE_CLUSTER'
  | 'PIPELINE_EXPOSURE'
  | 'ORDNANCE_UXO'
  | 'GEOLOGICAL_FEATURE'
  | 'MARINE_DEBRIS'
  | 'UNKNOWN_ANOMALY';

export type VerificationStatus =
  | 'PENDING_REVIEW'
  | 'CONFIRMED_DEBRIS'
  | 'GEOLOGICAL_ANOMALY'
  | 'FALSE_POSITIVE'
  | 'ESCALATED_HAZARD';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFORMATIONAL';

export type ChannelType = 'PORT' | 'STARBOARD';

export interface BoundingBox {
  x: number; // percentage (0-100) or pixel
  y: number;
  width: number;
  height: number;
}

export interface SonarEvidenceReference {
  cutoutUrl?: string;
  acousticCutoutUrl?: string;
  pingOffset?: number;
  pingNumber?: number;
  channel?: string;
  pixelX?: number;
  pixelY?: number;
  rangeMeters?: number;
  waterfallBox?: BoundingBox;
  boundingBox?: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  };
}

export interface TargetModelMetadata {
  modelName?: string;
  modelVersion?: string;
  inferenceTimestamp?: string;
  featureExtractor?: string;
  featureVectorSize?: number;
  onnxEngineVersion?: string;
  executionTimeMs?: number;
  snrDb?: number;
  shadowContrastRatio?: number;
}

/**
 * Canonical Target Data Model for SIH 2026 Problem Statement 26057.
 * Conforms to both the centralized specification and maintains
 * compatibility with existing sonar detection displays.
 */
export interface Target {
  // Required central identifiers
  id: string;
  surveyId: string;
  transectId: string; // canonical transect identifier
  pingNumber: number;
  channel: ChannelType;

  // Classification & AI inference
  classification: DebrisCategory;
  categoryLabel: string;
  confidence: number; // 0.0 - 1.0

  // Geographic coordinates (canonical: WGS84 lat/lng)
  latitude: number;
  longitude: number;
  coordinateReferenceSystem: string; // e.g. "WGS84 / UTM Zone 44N (EPSG:32644)"
  utmZone: string;
  utmEasting: number;
  utmNorthing: number;
  depth: number; // seabed depth in meters

  // Acoustic & dimension metrics
  slantRange: number; // meters
  groundRange: number; // meters
  towfishAltitude: number; // meters
  estimatedLength: number; // meters
  estimatedWidth: number; // meters
  shadowLength: number; // meters
  shadowHeight: number; // estimated target height in meters: (shadowLength * towfishAltitude) / slantRange
  backscatter: number; // dB

  // Operational status
  severity: SeverityLevel;
  verificationStatus: VerificationStatus;
  operatorNotes?: string;
  detectedAt: string; // ISO timestamp
  verifiedAt?: string; // ISO timestamp
  verifiedBy?: string;

  // Decision-support Risk & Hazard Prioritization
  riskAssessment?: RiskAssessment;
  operatorRiskLevel?: RiskLevel;
  operatorOverrideReason?: string;

  // Sonar evidence
  sonarEvidenceReference: SonarEvidenceReference;
  modelMetadata: TargetModelMetadata;

  // -------------------------------------------------------------
  // Backwards compatibility properties matching SonarDetection
  // -------------------------------------------------------------
  transectLine?: string; // alias to transectId
  category?: DebrisCategory; // alias to classification
  timestamp?: string; // alias to detectedAt
  slantRangeMeters?: number; // alias to slantRange
  groundRangeMeters?: number; // alias to groundRange
  towfishAltitudeMeters?: number; // alias to towfishAltitude
  shadowLengthMeters?: number; // alias to shadowLength
  estimatedTargetHeightMeters?: number; // alias to shadowHeight
  estimatedLengthMeters?: number; // alias to estimatedLength
  estimatedWidthMeters?: number; // alias to estimatedWidth
  backscatterDb?: number; // alias to backscatter
  coordinates?: {
    lat: number;
    lng: number;
    utmZone: string;
    utmEasting: number;
    utmNorthing: number;
    depthMeters: number;
  };
  waterfallBox?: BoundingBox;
}

/**
 * Type alias for backward compatibility with existing components
 */
export type SonarDetection = Target;
