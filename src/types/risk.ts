/**
 * Central Risk & Hazard Prioritization Data Models
 * SIH 2026 Problem Statement 26057
 * 
 * Decision-support models transforming detected side-scan sonar targets into
 * operationally prioritized hydrographic hazards.
 * Strictly decoupled: AI Confidence != Hazard Severity.
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type RiskCategory =
  | 'ENVIRONMENTAL'
  | 'NAVIGATION'
  | 'INFRASTRUCTURE'
  | 'SAFETY'
  | 'INVESTIGATION'
  | 'GEOLOGICAL'
  | 'UNKNOWN';

export interface RiskAssessment {
  targetId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100 normalized
  primaryCategory: RiskCategory;

  severityScore: number;
  confidenceContribution: number;
  proximityScore: number;
  sizeContribution: number;
  uncertaintyContribution: number;
  contextualExposure: number;

  priorityRank: number; // 1 = Highest priority

  reasons: string[];
  recommendedAction: string;

  assessedAt: string;
  assessmentVersion: string;
  dataProvenance: 'DERIVED' | 'SIMULATED';

  // Operator override capability
  operatorRiskLevel?: RiskLevel;
  operatorOverrideReason?: string;
  operatorOverriddenAt?: string;
  operatorOverriddenBy?: string;
}

export interface RiskWeightConfig {
  hazardSeverity: number;
  contextualExposure: number;
  size: number;
  proximity: number;
  evidenceQuality: number;
  uncertainty: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeightConfig = {
  hazardSeverity: 0.35,
  contextualExposure: 0.20,
  size: 0.15,
  proximity: 0.10,
  evidenceQuality: 0.10,
  uncertainty: 0.10,
};

export const RISK_THRESHOLDS = {
  LOW_MAX: 24,
  MODERATE_MAX: 49,
  HIGH_MAX: 74,
  CRITICAL_MIN: 75,
} as const;

export interface KnownInfrastructureFeature {
  name: string;
  type: 'PIPELINE' | 'SUBSEA_CABLE' | 'SHIPPING_FAIRWAY' | 'ECOLOGICAL_ZONE';
  centerCoord: [number, number]; // [lng, lat]
  radiusMeters: number;
}

export interface SurveyRiskContext {
  surveyId?: string;
  isDemoReplay?: boolean;
  knownInfrastructure?: KnownInfrastructureFeature[];
  activeTransectId?: string;
}

export interface RiskSummaryCounts {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  totalAssessed: number;
}
