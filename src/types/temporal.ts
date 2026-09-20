/**
 * Repeat-Survey Temporal Change Detection Types
 * SIH 2026 Problem Statement 26057
 *
 * Strongly-typed decision-support models comparing baseline and repeat hydrographic surveys
 * to identify newly detected, persistent, changed, and unobserved seabed anomalies.
 * 
 * Key Principles:
 * 1. Explicit provenance (DERIVED / SIMULATED) without claiming unwarranted scientific certainty.
 * 2. Coverage-aware evaluation: distinguishes REMOVED vs NOT_REASSESSED vs UNCERTAIN.
 * 3. Strict separation of operational Hazard Risk (riskScore) and Temporal Change Magnitude (changeScore).
 * 4. Human-readable, transparent change rationale for every anomaly.
 */

import { Target, DebrisCategory } from './target';
import { RiskLevel } from './risk';

export type TemporalChangeType =
  | 'NEW'
  | 'PERSISTENT'
  | 'CHANGED'
  | 'REMOVED'
  | 'NOT_REASSESSED'
  | 'UNCERTAIN';

export type TemporalProvenance = 'DERIVED' | 'SIMULATED';

export interface TemporalMatchConfig {
  /** Maximum geographic distance in meters to consider candidates a potential match */
  maximumDistanceMeters: number;
  /** Acceptable ratio threshold for length/width changes */
  sizeToleranceRatio: number;
  /** Minimum overall matching score (0-1) to confirm identity */
  confidenceThreshold: number;
  /** Shifting distance in meters beyond positioning error to flag physical movement */
  significantShiftDistanceMeters: number;
  /** Footprint ratio delta to flag meaningful dimensional change */
  significantFootprintRatio: number;
  /** Risk score point delta to flag meaningful risk change */
  significantRiskChangeDelta: number;
  /** Survey coverage boundary buffer in meters */
  coverageBufferMeters: number;
}

export const DEFAULT_TEMPORAL_MATCH_CONFIG: TemporalMatchConfig = {
  maximumDistanceMeters: 45.0,
  sizeToleranceRatio: 1.8,
  confidenceThreshold: 0.48,
  significantShiftDistanceMeters: 12.0,
  significantFootprintRatio: 1.4,
  significantRiskChangeDelta: 15,
  coverageBufferMeters: 60.0,
};

export interface TargetMatch {
  currentDetectionId?: string;
  previousDetectionId?: string;
  distanceMeters: number;
  spatialConfidence: number; // 0 - 1
  attributeConfidence: number; // 0 - 1
  overallMatchScore: number; // 0 - 1
}

export interface HistoricalSurvey {
  id: string;
  code: string;
  name: string;
  date: string;
  vessel: string;
  sensor: string;
  coverageBounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  targets: Target[];
  provenance: TemporalProvenance;
  isBaseline?: boolean;
}

export interface FootprintChangeMetrics {
  previousLengthM: number;
  previousWidthM: number;
  currentLengthM: number;
  currentWidthM: number;
  deltaLengthM: number;
  deltaWidthM: number;
  lengthRatio: number;
}

export interface TemporalTargetChange {
  id: string;
  targetId: string; // Current target ID or previous target ID if removed/not-reassessed
  changeType: TemporalChangeType;
  previousTarget?: Target | null;
  currentTarget?: Target | null;
  
  /** Magnitude of temporal change (0 - 100). Kept strictly separate from riskScore! */
  changeScore: number;
  /** Operational hazard score (0 - 100) from RiskAssessment engine */
  riskScore: number;
  /** Operational risk level ('CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW') */
  riskLevel: RiskLevel;
  /** Combined temporal investigation/remediation priority */
  temporalPriority: RiskLevel;

  reasons: string[];
  surveyCoverageStatus: 'COVERED' | 'UNCOVERED' | 'MARGINAL';

  positionShiftMeters?: number;
  footprintChange?: FootprintChangeMetrics;
  classificationChanged?: boolean;
  riskLevelChanged?: boolean;
  confidenceChange?: number;
}

export interface ChangeArea {
  id: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;

  newTargetCount: number;
  changedTargetCount: number;
  persistentTargetCount: number;

  changeScore: number;
  priority: RiskLevel;

  targetIds: string[];
  reasons: string[];
}

export interface ChangeSummary {
  totalPreviousTargets: number;
  totalCurrentTargets: number;
  newTargets: number;
  persistentTargets: number;
  changedTargets: number;
  removedTargets: number;
  notReassessedTargets: number;
  uncertainTargets: number;
  highPriorityChanges: number;
}

export interface SurveyComparison {
  previousSurveyId: string;
  currentSurveyId: string;
  previousSurveyName: string;
  currentSurveyName: string;
  previousSurveyDate: string;
  currentSurveyDate: string;

  matchedTargets: TargetMatch[];
  newTargets: TemporalTargetChange[];
  persistentTargets: TemporalTargetChange[];
  changedTargets: TemporalTargetChange[];
  removedTargets: TemporalTargetChange[];
  notReassessedTargets: TemporalTargetChange[];
  uncertainTargets: TemporalTargetChange[];
  allChanges: TemporalTargetChange[];

  changedAreas: ChangeArea[];
  summary: ChangeSummary;
  provenance: TemporalProvenance;
}
