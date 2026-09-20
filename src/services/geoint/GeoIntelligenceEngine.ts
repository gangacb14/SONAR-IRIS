/**
 * Geospatial Intelligence & Hazard Hotspot Analysis Engine
 * SIH 2026 Problem Statement 26057
 * 
 * Standalone, deterministic decision-support engine aggregating georeferenced
 * sonar targets and risk assessments into spatial intelligence, prioritized hazard
 * clusters (hotspots), and hazard density distributions.
 * 
 * Key Principles:
 * 1. Independent of React components (pure computational business logic).
 * 2. Strictly deterministic and repeatable across survey passes.
 * 3. Risk-weighted clustering: high-hazard targets heavily dominate over raw count.
 * 4. Transparent human-readable operational explanations for every hotspot.
 * 5. Explicit provenance tracking: DERIVED / SIMULATED.
 * 6. Isolated critical targets are preserved and surfaced in unclustered analysis.
 */

import { Target } from '../../types/target';
import { RiskCategory, RiskLevel, SurveyRiskContext } from '../../types/risk';
import {
  Hotspot,
  DensityCell,
  HighRiskZone,
  GeoIntelligenceSummary,
  GeospatialIntelligenceResult,
  GeoIntConfig,
  DEFAULT_GEOINT_CONFIG,
  GeoIntProvenance,
} from '../../types/geoint';

export class GeoIntelligenceEngine {
  public static readonly VERSION = 'GEOINT-SIH-2026-v1.0';

  /**
   * Main entry point: aggregates targets and survey context into GeospatialIntelligenceResult.
   */
  public static analyzeTargets(
    targets: Target[],
    surveyContext?: SurveyRiskContext,
    customConfig: Partial<GeoIntConfig> = {}
  ): GeospatialIntelligenceResult {
    const config: GeoIntConfig = { ...DEFAULT_GEOINT_CONFIG, ...customConfig };
    const generatedAt = new Date().toISOString();
    const provenance: GeoIntProvenance = surveyContext?.isDemoReplay ? 'SIMULATED' : 'DERIVED';

    if (!targets || targets.length === 0) {
      return {
        hotspots: [],
        densityCells: [],
        highRiskZones: [],
        unclusteredTargetIds: [],
        summary: {
          totalTargets: 0,
          totalHotspots: 0,
          criticalHotspots: 0,
          highRiskHotspots: 0,
          moderateHotspots: 0,
          lowRiskHotspots: 0,
          unclusteredTargets: 0,
          isolatedCriticalTargets: 0,
          highestPriorityHotspotId: null,
          generatedAt,
          provenance,
        },
        generatedAt,
        provenance,
      };
    }

    // 1. Sort targets deterministically by ID for reproducible clustering
    const sortedTargets = [...targets].sort((a, b) => a.id.localeCompare(b.id));

    // 2. Perform distance-threshold graph clustering
    const clusters = this.clusterTargetsByDistance(sortedTargets, config.hotspotRadiusMeters);

    const validClusters: Target[][] = [];
    const unclusteredTargetIds: string[] = [];

    for (const cluster of clusters) {
      if (cluster.length >= config.minimumTargetsPerHotspot) {
        validClusters.push(cluster);
      } else {
        for (const t of cluster) {
          unclusteredTargetIds.push(t.id);
        }
      }
    }

    // 3. Build Hotspot models from valid clusters
    const unrankedHotspots: Hotspot[] = validClusters.map((clusterTargets, idx) => {
      return this.buildHotspot(
        `HOTSPOT-${String(idx + 1).padStart(2, '0')}`,
        clusterTargets,
        config,
        provenance,
        surveyContext
      );
    });

    // 4. Deterministic Ranking: Sort hotspots by priorityScore descending, with tie-breakers
    const rankedHotspots = this.rankHotspots(unrankedHotspots);

    // 5. Compute deterministic 2D Spatial Density Grid (Density Cells)
    const densityCells = this.computeDensityGrid(sortedTargets, config);

    // 6. Identify High-Risk Zones intersecting known infrastructure
    const highRiskZones = this.identifyHighRiskZones(rankedHotspots, sortedTargets, surveyContext);

    // 7. Calculate Summary Statistics
    let criticalHotspots = 0;
    let highRiskHotspots = 0;
    let moderateHotspots = 0;
    let lowRiskHotspots = 0;

    for (const h of rankedHotspots) {
      if (h.riskLevel === 'CRITICAL') criticalHotspots++;
      else if (h.riskLevel === 'HIGH') highRiskHotspots++;
      else if (h.riskLevel === 'MODERATE') moderateHotspots++;
      else lowRiskHotspots++;
    }

    // Count unclustered critical targets to ensure they are never obscured
    let isolatedCriticalTargets = 0;
    for (const tId of unclusteredTargetIds) {
      const t = sortedTargets.find((item) => item.id === tId);
      const level = t?.riskAssessment?.operatorRiskLevel || t?.riskAssessment?.riskLevel;
      if (level === 'CRITICAL' || (t?.riskAssessment?.riskScore || 0) >= config.criticalRiskThreshold) {
        isolatedCriticalTargets++;
      }
    }

    const summary: GeoIntelligenceSummary = {
      totalTargets: sortedTargets.length,
      totalHotspots: rankedHotspots.length,
      criticalHotspots,
      highRiskHotspots,
      moderateHotspots,
      lowRiskHotspots,
      unclusteredTargets: unclusteredTargetIds.length,
      isolatedCriticalTargets,
      highestPriorityHotspotId: rankedHotspots.length > 0 ? rankedHotspots[0].id : null,
      generatedAt,
      provenance,
    };

    return {
      hotspots: rankedHotspots,
      densityCells,
      highRiskZones,
      unclusteredTargetIds,
      summary,
      generatedAt,
      provenance,
    };
  }

  /**
   * Deterministic spatial clustering using distance threshold (Single Linkage / Connected Components).
   */
  private static clusterTargetsByDistance(targets: Target[], radiusMeters: number): Target[][] {
    const n = targets.length;
    const visited = new Uint8Array(n);
    const clusters: Target[][] = [];

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      const currentCluster: Target[] = [];
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const u = queue.shift()!;
        currentCluster.push(targets[u]);
        const uLat = targets[u].latitude ?? targets[u].coordinates?.lat;
        const uLng = targets[u].longitude ?? targets[u].coordinates?.lng;

        for (let v = 0; v < n; v++) {
          if (!visited[v]) {
            const vLat = targets[v].latitude ?? targets[v].coordinates?.lat;
            const vLng = targets[v].longitude ?? targets[v].coordinates?.lng;
            const dist = this.haversineMeters(uLat, uLng, vLat, vLng);

            if (dist <= radiusMeters) {
              visited[v] = 1;
              queue.push(v);
            }
          }
        }
      }

      clusters.push(currentCluster);
    }

    return clusters;
  }

  /**
   * Constructs a strongly-typed Hotspot model with risk-weighted priority and explainable rationale.
   */
  private static buildHotspot(
    id: string,
    clusterTargets: Target[],
    config: GeoIntConfig,
    provenance: GeoIntProvenance,
    surveyContext?: SurveyRiskContext
  ): Hotspot {
    const targetCount = clusterTargets.length;
    const targetIds = clusterTargets.map((t) => t.id);

    // Compute Center (Centroid)
    let sumLat = 0;
    let sumLng = 0;
    for (const t of clusterTargets) {
      sumLat += t.latitude ?? t.coordinates?.lat ?? 0;
      sumLng += t.longitude ?? t.coordinates?.lng ?? 0;
    }
    const centerLatitude = sumLat / targetCount;
    const centerLongitude = sumLng / targetCount;

    // Compute Radius: maximum distance to any member target + buffer margin
    let maxDist = 0;
    for (const t of clusterTargets) {
      const lat = t.latitude ?? t.coordinates?.lat ?? 0;
      const lng = t.longitude ?? t.coordinates?.lng ?? 0;
      const d = this.haversineMeters(centerLatitude, centerLongitude, lat, lng);
      if (d > maxDist) maxDist = d;
    }
    const radiusMeters = Math.max(config.hotspotRadiusMeters * 0.5, Math.round(maxDist + 25));

    // Risk and Target Metrics
    let aggregateRiskScore = 0;
    let maximumRiskScore = 0;
    let criticalTargetCount = 0;
    let highRiskTargetCount = 0;
    const categoryCounts: Record<string, number> = {};

    for (const t of clusterTargets) {
      const effectiveRiskScore = t.riskAssessment?.riskScore ?? (t.severity === 'CRITICAL' ? 85 : t.severity === 'HIGH' ? 65 : 30);
      const effectiveRiskLevel = t.riskAssessment?.operatorRiskLevel || t.riskAssessment?.riskLevel || (
        effectiveRiskScore >= config.criticalRiskThreshold ? 'CRITICAL' :
        effectiveRiskScore >= config.highRiskThreshold ? 'HIGH' :
        effectiveRiskScore >= 25 ? 'MODERATE' : 'LOW'
      );

      aggregateRiskScore += effectiveRiskScore;
      if (effectiveRiskScore > maximumRiskScore) {
        maximumRiskScore = effectiveRiskScore;
      }

      if (effectiveRiskLevel === 'CRITICAL' || effectiveRiskScore >= config.criticalRiskThreshold) {
        criticalTargetCount++;
      } else if (effectiveRiskLevel === 'HIGH' || effectiveRiskScore >= config.highRiskThreshold) {
        highRiskTargetCount++;
      }

      const cat: RiskCategory = t.riskAssessment?.primaryCategory || (
        t.category === 'GEOLOGICAL_FEATURE' ? 'GEOLOGICAL' :
        t.category === 'UNKNOWN_ANOMALY' ? 'INVESTIGATION' :
        t.category === 'ORDNANCE_UXO' ? 'SAFETY' :
        t.category === 'PIPELINE_EXPOSURE' ? 'INFRASTRUCTURE' :
        'ENVIRONMENTAL'
      );
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const averageRiskScore = Math.round(aggregateRiskScore / targetCount);

    // Dominant Categories sorted by frequency
    const dominantCategories = (Object.keys(categoryCounts) as RiskCategory[]).sort(
      (a, b) => categoryCounts[b] - categoryCounts[a]
    );

    // Contextual Overlaps
    const contextualOverlaps: string[] = [];
    if (surveyContext?.knownInfrastructure) {
      for (const feat of surveyContext.knownInfrastructure) {
        const featLng = feat.centerCoord[0];
        const featLat = feat.centerCoord[1];
        const d = this.haversineMeters(centerLatitude, centerLongitude, featLat, featLng);
        if (d <= feat.radiusMeters + radiusMeters + config.infrastructureBufferMeters) {
          contextualOverlaps.push(feat.name);
        }
      }
    }

    // Spatial Density Score (targets per unit footprint)
    const areaSqKm = (Math.PI * Math.pow(radiusMeters, 2)) / 1_000_000;
    const densityScore = Math.min(100, Math.round((targetCount / Math.max(0.01, areaSqKm)) * 0.8));

    // Operational Priority Score Calculation (Risk-Weighted)
    // CRITICAL: A cluster with high/critical hazards must substantially outrank low-risk geological clusters
    const baseRiskWeight = maximumRiskScore * 0.45 + averageRiskScore * 0.35;
    const criticalBonus = criticalTargetCount * 40;
    const highBonus = highRiskTargetCount * 18;
    const densityBonus = Math.min(15, Math.round(targetCount * 2.0));
    const contextBonus = contextualOverlaps.length > 0 ? 15 : 0;

    const priorityScore = Math.round(baseRiskWeight + criticalBonus + highBonus + densityBonus + contextBonus);

    // Determine Overall Hotspot Risk Level
    // Low-risk geological formations must never escalate to MODERATE/HIGH/CRITICAL purely based on count
    let riskLevel: RiskLevel;
    if (criticalTargetCount > 0 || maximumRiskScore >= config.criticalRiskThreshold || (priorityScore >= 100 && maximumRiskScore >= 40)) {
      riskLevel = 'CRITICAL';
    } else if (highRiskTargetCount > 0 || maximumRiskScore >= config.highRiskThreshold || (priorityScore >= 65 && maximumRiskScore >= 30)) {
      riskLevel = 'HIGH';
    } else if (maximumRiskScore >= 25 || (priorityScore >= 35 && maximumRiskScore >= 20 && dominantCategories[0] !== 'GEOLOGICAL')) {
      riskLevel = 'MODERATE';
    } else {
      riskLevel = 'LOW';
    }

    // Generate Operational Explanations
    const reasons = this.generateHotspotReasons({
      targetCount,
      criticalTargetCount,
      highRiskTargetCount,
      dominantCategories,
      contextualOverlaps,
      radiusMeters,
      riskLevel,
    });

    return {
      id,
      centerLatitude,
      centerLongitude,
      radiusMeters,
      targetIds,
      targetCount,
      highRiskTargetCount,
      criticalTargetCount,
      aggregateRiskScore,
      averageRiskScore,
      maximumRiskScore,
      dominantCategories,
      densityScore,
      priorityScore,
      rank: 0, // Assigned during ranking
      riskLevel,
      reasons,
      contextualOverlaps,
      provenance,
    };
  }

  /**
   * Sorts and assigns sequential 1..N ranks to hotspots deterministically.
   */
  private static rankHotspots(hotspots: Hotspot[]): Hotspot[] {
    const sorted = [...hotspots].sort((a, b) => {
      // Primary: Priority Score descending
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // Secondary: Maximum Risk Score descending
      if (b.maximumRiskScore !== a.maximumRiskScore) {
        return b.maximumRiskScore - a.maximumRiskScore;
      }
      // Tertiary: Critical count descending
      if (b.criticalTargetCount !== a.criticalTargetCount) {
        return b.criticalTargetCount - a.criticalTargetCount;
      }
      // Deterministic tie-breaker: ID ascending
      return a.id.localeCompare(b.id);
    });

    return sorted.map((h, index) => ({
      ...h,
      id: `HOTSPOT-${String(index + 1).padStart(2, '0')}`,
      rank: index + 1,
    }));
  }

  /**
   * Generates objective, operational human-readable rationale for a hotspot.
   */
  private static generateHotspotReasons(params: {
    targetCount: number;
    criticalTargetCount: number;
    highRiskTargetCount: number;
    dominantCategories: RiskCategory[];
    contextualOverlaps: string[];
    radiusMeters: number;
    riskLevel: RiskLevel;
  }): string[] {
    const reasons: string[] = [];

    // Critical or High target alert
    if (params.criticalTargetCount > 0) {
      reasons.push(
        `Critical hazard anomaly detected within cluster (${params.criticalTargetCount} critical ${
          params.criticalTargetCount === 1 ? 'target' : 'targets'
        })`
      );
    }

    if (params.highRiskTargetCount > 0) {
      reasons.push(
        `Multiple high-priority targets concentrated within survey corridor (${params.highRiskTargetCount} high-hazard)`
      );
    }

    // Category-specific rationale
    const primaryCat = params.dominantCategories[0];
    if (primaryCat === 'SAFETY') {
      reasons.push(`Dominant ordnance / explosive safety risk signatures requiring hydrographic avoidance`);
    } else if (primaryCat === 'INFRASTRUCTURE') {
      reasons.push(`Multiple infrastructure-related anomalies detected requiring pipeline/cable clearance`);
    } else if (primaryCat === 'ENVIRONMENTAL') {
      reasons.push(`High concentration of anthropogenic marine debris targets (${params.targetCount} items)`);
    } else if (primaryCat === 'INVESTIGATION') {
      reasons.push(`Mixed anomaly field with ambiguous classifications requiring hydrographer review`);
    } else if (primaryCat === 'GEOLOGICAL') {
      reasons.push(`Natural geological seabed morphology / bedrock outcropping cluster (non-anthropogenic)`);
    }

    // Target concentration statement
    reasons.push(
      `Spatial clustering of ${params.targetCount} targets within ${params.radiusMeters}m radius corridor`
    );

    // Infrastructure proximity statement
    if (params.contextualOverlaps.length > 0) {
      const featList = params.contextualOverlaps.slice(0, 2).join(', ');
      reasons.push(`Proximity overlap: ${featList}`);
    }

    return reasons;
  }

  /**
   * Computes a deterministic 2D regular grid for risk-weighted hazard density heatmap.
   */
  private static computeDensityGrid(targets: Target[], config: GeoIntConfig): DensityCell[] {
    if (targets.length === 0) return [];

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const t of targets) {
      const lat = t.latitude ?? t.coordinates?.lat ?? 0;
      const lng = t.longitude ?? t.coordinates?.lng ?? 0;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    // Cell size in degrees (approx 100m at equator is ~0.0009 deg)
    const latStep = (config.densityCellSizeMeters / 111_000);
    const lngStep = (config.densityCellSizeMeters / (111_000 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))));

    const grid = new Map<string, {
      cellId: string;
      row: number;
      col: number;
      centerLat: number;
      centerLng: number;
      bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
      targetIds: string[];
      targetCount: number;
      criticalCount: number;
      highCount: number;
      weightedRiskScore: number;
    }>();

    for (const t of targets) {
      const lat = t.latitude ?? t.coordinates?.lat ?? 0;
      const lng = t.longitude ?? t.coordinates?.lng ?? 0;
      const row = Math.floor((lat - minLat) / latStep);
      const col = Math.floor((lng - minLng) / lngStep);
      const key = `${row}_${col}`;

      const cellMinLat = minLat + row * latStep;
      const cellMaxLat = cellMinLat + latStep;
      const cellMinLng = minLng + col * lngStep;
      const cellMaxLng = cellMinLng + lngStep;

      if (!grid.has(key)) {
        grid.set(key, {
          cellId: `CELL-${row}-${col}`,
          row,
          col,
          centerLat: (cellMinLat + cellMaxLat) / 2,
          centerLng: (cellMinLng + cellMaxLng) / 2,
          bounds: {
            minLat: cellMinLat,
            maxLat: cellMaxLat,
            minLng: cellMinLng,
            maxLng: cellMaxLng,
          },
          targetIds: [],
          targetCount: 0,
          criticalCount: 0,
          highCount: 0,
          weightedRiskScore: 0,
        });
      }

      const cell = grid.get(key)!;
      cell.targetIds.push(t.id);
      cell.targetCount++;

      const riskScore = t.riskAssessment?.riskScore ?? (t.severity === 'CRITICAL' ? 85 : 40);
      const riskLevel = t.riskAssessment?.operatorRiskLevel || t.riskAssessment?.riskLevel;
      if (riskLevel === 'CRITICAL' || riskScore >= config.criticalRiskThreshold) {
        cell.criticalCount++;
        cell.weightedRiskScore += riskScore * 1.5;
      } else if (riskLevel === 'HIGH' || riskScore >= config.highRiskThreshold) {
        cell.highCount++;
        cell.weightedRiskScore += riskScore * 1.2;
      } else {
        cell.weightedRiskScore += riskScore * 0.8;
      }
    }

    // Normalize intensity 0.0 - 1.0 across cells
    let maxWeighted = 1;
    for (const c of grid.values()) {
      if (c.weightedRiskScore > maxWeighted) maxWeighted = c.weightedRiskScore;
    }

    const cells: DensityCell[] = [];
    for (const c of grid.values()) {
      cells.push({
        cellId: c.cellId,
        centerLat: c.centerLat,
        centerLng: c.centerLng,
        bounds: c.bounds,
        targetIds: c.targetIds,
        targetCount: c.targetCount,
        criticalCount: c.criticalCount,
        highCount: c.highCount,
        weightedRiskScore: Math.round(c.weightedRiskScore),
        intensity: Math.min(1.0, Math.max(0.1, Math.round((c.weightedRiskScore / maxWeighted) * 100) / 100)),
      });
    }

    // Sort cells deterministically
    return cells.sort((a, b) => b.weightedRiskScore - a.weightedRiskScore);
  }

  /**
   * Identifies prominent high risk zones intersecting infrastructure or clustered high hazard targets.
   */
  private static identifyHighRiskZones(
    hotspots: Hotspot[],
    allTargets: Target[],
    surveyContext?: SurveyRiskContext
  ): HighRiskZone[] {
    const zones: HighRiskZone[] = [];

    // Check critical or high-risk hotspots
    for (const h of hotspots) {
      if (h.riskLevel === 'CRITICAL' || h.riskLevel === 'HIGH') {
        zones.push({
          id: `ZONE-${h.id}`,
          name: `High Hazard Cluster ${h.id} (${h.riskLevel})`,
          riskLevel: h.riskLevel,
          reason: h.reasons[0] || 'Concentrated hazard targets',
          targetIds: h.targetIds,
          bounds: {
            minLat: h.centerLatitude - 0.001,
            maxLat: h.centerLatitude + 0.001,
            minLng: h.centerLongitude - 0.001,
            maxLng: h.centerLongitude + 0.001,
          },
        });
      }
    }

    // Check infrastructure overlaps from known survey context
    if (surveyContext?.knownInfrastructure) {
      for (const feat of surveyContext.knownInfrastructure) {
        const featLng = feat.centerCoord[0];
        const featLat = feat.centerCoord[1];
        const nearbyTargets: string[] = [];
        let hasCritical = false;
        let hasHigh = false;

        for (const t of allTargets) {
          const tLat = t.latitude ?? t.coordinates?.lat ?? 0;
          const tLng = t.longitude ?? t.coordinates?.lng ?? 0;
          const d = this.haversineMeters(featLat, featLng, tLat, tLng);

          if (d <= feat.radiusMeters) {
            nearbyTargets.push(t.id);
            const level = t.riskAssessment?.operatorRiskLevel || t.riskAssessment?.riskLevel;
            if (level === 'CRITICAL') hasCritical = true;
            if (level === 'HIGH') hasHigh = true;
          }
        }

        if (nearbyTargets.length > 0) {
          const zoneRiskLevel: RiskLevel = hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'MODERATE';
          zones.push({
            id: `ZONE-INFRA-${feat.type}`,
            name: `${feat.name} Corridor Buffer`,
            riskLevel: zoneRiskLevel,
            reason: `${nearbyTargets.length} acoustic targets located within infrastructure buffer zone`,
            targetIds: nearbyTargets,
          });
        }
      }
    }

    return zones;
  }

  /**
   * Great-circle distance between two WGS84 coordinate pairs in meters.
   */
  public static haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's mean radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
