/**
 * AI Follow-Up Survey Recommendation & Mission Prioritization Types
 * SIH 2026 Problem Statement 26057
 * 
 * Strongly-typed decision-support models for recommending targeted follow-up survey
 * passes, visual ROV inspections, specialist consultations, and coverage re-assessments.
 * 
 * IMPORTANT CONSTRAINTS:
 * 1. DECISION-SUPPORT ONLY: Does NOT generate autonomous navigation, ROV piloting,
 *    or vehicle control commands.
 * 2. EXPLICIT SEPARATION: Hazard Risk Score (0-100), Temporal Change Score (0-100),
 *    and Follow-Up Priority Score (0-100) are strictly separate metrics.
 * 3. PROVENANCE TRANSPARENCY: Marked DERIVED or SIMULATED.
 */

import { RiskLevel, SurveyRiskContext } from './risk';
import { TemporalChangeType } from './temporal';

export type FollowUpUrgency = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type RecommendationType =
  | 'ADDITIONAL_SONAR_PASS'
  | 'CLOSER_TARGET_INSPECTION'
  | 'ROV_VISUAL_INSPECTION'
  | 'SPECIALIST_ASSESSMENT'
  | 'INFRASTRUCTURE_INSPECTION'
  | 'REASSESS_SURVEY_COVERAGE'
  | 'OPERATOR_REVIEW';

export type FollowUpProvenance = 'DERIVED' | 'SIMULATED';

export type FollowUpFilterType =
  | 'ALL'
  | 'FOLLOW_UP_REQUIRED'
  | 'CRITICAL'
  | 'HIGH'
  | 'MODERATE'
  | 'LOW';

export interface FollowUpWeightConfig {
  hazardRisk: number;
  temporalChange: number;
  uncertainty: number;
  spatialConcentration: number;
  evidenceQuality: number;
  coverageGap: number;
  contextualExposure: number;
}

export const DEFAULT_FOLLOW_UP_WEIGHTS: FollowUpWeightConfig = {
  hazardRisk: 0.30,
  temporalChange: 0.20,
  uncertainty: 0.15,
  spatialConcentration: 0.15,
  evidenceQuality: 0.10,
  coverageGap: 0.05,
  contextualExposure: 0.05,
};

export interface FollowUpOperatorOverride {
  priorityScore?: number;
  urgency?: FollowUpUrgency;
  recommendationType?: RecommendationType;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface FollowUpRecommendation {
  id: string;
  rank: number;

  targetIds: string[];
  hotspotId?: string;

  centerLatitude: number;
  centerLongitude: number;

  priorityScore: number; // 0 - 100 normalized
  urgency: FollowUpUrgency;

  recommendationType: RecommendationType;

  reasons: string[];
  evidence: string[];
  uncertainty: string[];

  expectedBenefit: string;

  relatedRiskLevel: RiskLevel;
  relatedChangeType?: TemporalChangeType;

  provenance: FollowUpProvenance;
  generatedAt: string;

  // Optional area metadata when recommendation groups multiple targets
  areaName?: string;
  targetCount?: number;

  // Operator lifecycle
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  operatorNote?: string;

  operatorOverride?: FollowUpOperatorOverride;
}

export interface FollowUpMissionSummary {
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  topAction: RecommendationType | null;
  acknowledgedCount: number;
  overriddenCount: number;
  generatedAt: string;
  provenance: FollowUpProvenance;
}

export interface FollowUpRecommendationResult {
  recommendations: FollowUpRecommendation[];
  summary: FollowUpMissionSummary;
  generatedAt: string;
  provenance: FollowUpProvenance;
}
