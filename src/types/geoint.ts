/**
 * Geospatial Intelligence & Hazard Hotspot Analysis Types
 * SIH 2026 Problem Statement 26057
 * 
 * Decision-support models aggregating georeferenced targets and risk assessments
 * into spatial intelligence, hazard density distributions, and prioritized clusters.
 * 
 * NOTE: Decision-support feature. Does NOT claim to represent legally surveyed
 * exclusion zones or certified hazard boundaries.
 */

import { RiskCategory, RiskLevel, KnownInfrastructureFeature } from './risk';

export type GeoIntProvenance = 'DERIVED' | 'SIMULATED';

export type GeoIntFilterType = 'ALL' | 'HOTSPOTS_ONLY' | 'CRITICAL' | 'HIGH_RISK' | 'UNCLUSTERED';

export interface GeoIntConfig {
  /** Maximum distance in meters between neighboring targets to merge into a cluster */
  hotspotRadiusMeters: number;
  /** Minimum number of targets required to constitute a spatial hotspot */
  minimumTargetsPerHotspot: number;
  /** Score threshold to qualify as a High-Risk target */
  highRiskThreshold: number;
  /** Score threshold to qualify as a Critical-Risk target */
  criticalRiskThreshold: number;
  /** Grid cell dimension for deterministic 2D spatial density calculations */
  densityCellSizeMeters: number;
  /** Buffer zone distance around known infrastructure features (fairways, cables, pipes) */
  infrastructureBufferMeters: number;
}

export const DEFAULT_GEOINT_CONFIG: GeoIntConfig = {
  hotspotRadiusMeters: 140.0,
  minimumTargetsPerHotspot: 2,
  highRiskThreshold: 50,
  criticalRiskThreshold: 75,
  densityCellSizeMeters: 100.0,
  infrastructureBufferMeters: 250.0,
};

export interface Hotspot {
  id: string;

  centerLatitude: number;
  centerLongitude: number;

  radiusMeters: number;

  targetIds: string[];
  targetCount: number;

  highRiskTargetCount: number;
  criticalTargetCount: number;

  aggregateRiskScore: number;
  averageRiskScore: number;
  maximumRiskScore: number;

  dominantCategories: RiskCategory[];

  densityScore: number;
  priorityScore: number;

  rank: number;
  riskLevel: RiskLevel;

  reasons: string[];

  contextualOverlaps: string[];

  provenance: GeoIntProvenance;
}

export interface DensityCell {
  cellId: string;
  centerLat: number;
  centerLng: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  targetIds: string[];
  targetCount: number;
  criticalCount: number;
  highCount: number;
  weightedRiskScore: number;
  intensity: number; // 0.0 - 1.0 normalized
}

export interface HighRiskZone {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  reason: string;
  targetIds: string[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export interface GeoIntelligenceSummary {
  totalTargets: number;
  totalHotspots: number;
  criticalHotspots: number;
  highRiskHotspots: number;
  moderateHotspots: number;
  lowRiskHotspots: number;
  unclusteredTargets: number;
  isolatedCriticalTargets: number;
  highestPriorityHotspotId: string | null;
  generatedAt: string;
  provenance: GeoIntProvenance;
}

export interface GeospatialIntelligenceResult {
  hotspots: Hotspot[];
  densityCells: DensityCell[];
  highRiskZones: HighRiskZone[];
  unclusteredTargetIds: string[];
  summary: GeoIntelligenceSummary;
  generatedAt: string;
  provenance: GeoIntProvenance;
}
