/**
 * In-Memory Development Fallback Store
 * SIH 2026 Problem Statement 26057
 *
 * Provides a clean development/local storage fallback when PostgreSQL + PostGIS
 * is not configured. Implements identical domain operations including spherical
 * spatial distance queries (Haversine formula), bounding box filtering,
 * recommendations, overrides, and audit trails.
 *
 * Clearly labeled as DEVELOPMENT_FALLBACK in status queries and response headers.
 */

import { Target, DebrisCategory, VerificationStatus } from '../../types/target';
import { FollowUpRecommendation, FollowUpOperatorOverride } from '../../types/followUp';
import { AuditEvent } from '../../types/audit';
import { Survey, SurveyTransect } from '../../types/survey';
import { RiskLevel } from '../../types/risk';
import { MOCK_TARGETS } from '../../data/mockTargets';

export interface SpatialQueryOptions {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface BoundingBoxOptions {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Calculates spherical distance in meters between two WGS84 coordinates using Haversine
 */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class FallbackStore {
  private surveys: Map<string, Survey> = new Map();
  private transects: Map<string, SurveyTransect[]> = new Map();
  private targets: Map<string, Target> = new Map();
  private recommendations: Map<string, FollowUpRecommendation> = new Map();
  private auditEvents: AuditEvent[] = [];

  constructor() {
    this.initDefaultSurvey();
  }

  private initDefaultSurvey() {
    const survey: Survey = {
      id: 'MIS-2026-INDO-04B',
      code: 'TRANSECT-04B',
      name: 'Gulf of Mannar Seabed Debris & Anomaly Assessment',
      locationName: 'Gulf of Mannar - Sector Charlie (Shipping Fairway Buffer)',
      crs: 'WGS84 / UTM Zone 44N (EPSG:32644)',
      sonarEquipment: 'EdgeTech 4200-MP Chirp Side-Scan (120/410 kHz Dual)',
      operatingFrequency: '410 kHz High-Res Pulse Mode',
      surveyVessel: 'ORV Sagar Nidhi / AUV HUGIN 6000',
      vehicleType: 'Subsea Autonomous Underwater Vehicle (AUV)',
      chiefHydrographer: 'Cmdr. R. V. Kulkarni / Dr. S. Ananth (NIOT)',
      date: '2026-09-07',
      totalAreaSqKm: 4.86,
      totalPings: 84210,
      totalDetections: 8,
      pendingReviews: 3,
      swathRangePerChannelM: 75,
    };
    this.surveys.set(survey.id, survey);

    this.transects.set(survey.id, [
      {
        id: 'TRX-01',
        name: 'Transect Line 01 (Northbound)',
        bearingDeg: 42.0,
        lengthMeters: 2400,
        status: 'COMPLETED',
        startCoord: [79.172, 9.228],
        endCoord: [79.184, 9.245],
        pingStart: 1,
        pingEnd: 18500,
        swathWidthMeters: 150,
      },
      {
        id: 'TRX-02',
        name: 'Transect Line 02 (Southbound)',
        bearingDeg: 222.0,
        lengthMeters: 2400,
        status: 'COMPLETED',
        startCoord: [79.186, 9.246],
        endCoord: [79.174, 9.229],
        pingStart: 18501,
        pingEnd: 37200,
        swathWidthMeters: 150,
      },
    ]);
  }

  // Survey
  getSurvey(id: string): Survey | null {
    return this.surveys.get(id) || null;
  }

  getTransects(surveyId: string): SurveyTransect[] {
    return this.transects.get(surveyId) || [];
  }

  // Targets
  getTargets(filter?: { surveyId?: string; classification?: string; severity?: string; status?: string }): Target[] {
    let list = Array.from(this.targets.values());
    if (filter?.surveyId) {
      list = list.filter((t) => t.surveyId === filter.surveyId);
    }
    if (filter?.classification) {
      list = list.filter((t) => t.classification === filter.classification);
    }
    if (filter?.severity) {
      list = list.filter((t) => t.severity === filter.severity);
    }
    if (filter?.status) {
      list = list.filter((t) => t.verificationStatus === filter.status);
    }
    return list;
  }

  getTargetById(id: string): Target | null {
    return this.targets.get(id) || null;
  }

  upsertTarget(target: Target): Target {
    this.targets.set(target.id, { ...target });
    return this.targets.get(target.id)!;
  }

  updateTarget(id: string, patch: Partial<Target>): Target | null {
    const existing = this.targets.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.targets.set(id, updated);
    return updated;
  }

  replaceTargets(targets: Target[]): Target[] {
    this.targets.clear();
    for (const t of targets) {
      this.targets.set(t.id, { ...t });
    }
    return Array.from(this.targets.values());
  }

  resetToDemo(): Target[] {
    this.targets.clear();
    for (const t of MOCK_TARGETS) {
      this.targets.set(t.id, { ...t });
    }
    return Array.from(this.targets.values());
  }

  // Spatial queries (equivalent to PostGIS ST_DWithin and ST_Distance)
  findNearbyTargets(options: SpatialQueryOptions): { target: Target; distanceMeters: number }[] {
    const results: { target: Target; distanceMeters: number }[] = [];
    for (const target of this.targets.values()) {
      const dist = haversineDistanceMeters(options.lat, options.lng, target.latitude, target.longitude);
      if (dist <= options.radiusMeters) {
        results.push({ target: { ...target }, distanceMeters: Math.round(dist * 10) / 10 });
      }
    }
    results.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return results;
  }

  findTargetsInBoundingBox(box: BoundingBoxOptions): Target[] {
    const results: Target[] = [];
    for (const target of this.targets.values()) {
      if (
        target.latitude >= box.minLat &&
        target.latitude <= box.maxLat &&
        target.longitude >= box.minLng &&
        target.longitude <= box.maxLng
      ) {
        results.push({ ...target });
      }
    }
    return results;
  }

  // Recommendations
  getRecommendations(): FollowUpRecommendation[] {
    const list = Array.from(this.recommendations.values());
    list.sort((a, b) => a.rank - b.rank);
    return list;
  }

  getRecommendationById(id: string): FollowUpRecommendation | null {
    return this.recommendations.get(id) || null;
  }

  upsertRecommendations(recs: FollowUpRecommendation[]): void {
    for (const rec of recs) {
      const existing = this.recommendations.get(rec.id);
      if (existing) {
        // preserve operator acknowledgements or overrides if present
        this.recommendations.set(rec.id, {
          ...rec,
          acknowledged: existing.acknowledged ?? rec.acknowledged,
          acknowledgedAt: existing.acknowledgedAt ?? rec.acknowledgedAt,
          acknowledgedBy: existing.acknowledgedBy ?? rec.acknowledgedBy,
          operatorNote: existing.operatorNote ?? rec.operatorNote,
          operatorOverride: existing.operatorOverride ?? rec.operatorOverride,
        });
      } else {
        this.recommendations.set(rec.id, { ...rec });
      }
    }
  }

  acknowledgeRecommendation(
    id: string,
    ack: { acknowledgedAt: string; acknowledgedBy: string; operatorNote?: string }
  ): FollowUpRecommendation | null {
    const rec = this.recommendations.get(id);
    if (!rec) return null;
    const updated: FollowUpRecommendation = {
      ...rec,
      acknowledged: true,
      acknowledgedAt: ack.acknowledgedAt,
      acknowledgedBy: ack.acknowledgedBy,
      operatorNote: ack.operatorNote,
    };
    this.recommendations.set(id, updated);
    return updated;
  }

  overrideRecommendation(
    id: string,
    override: FollowUpOperatorOverride
  ): FollowUpRecommendation | null {
    const rec = this.recommendations.get(id);
    if (!rec) return null;
    const updated: FollowUpRecommendation = {
      ...rec,
      operatorOverride: override,
      priorityScore: override.priorityScore ?? rec.priorityScore,
      urgency: override.urgency ?? rec.urgency,
      recommendationType: override.recommendationType ?? rec.recommendationType,
    };
    this.recommendations.set(id, updated);
    return updated;
  }

  // Audit Events
  getAuditEvents(targetId?: string): AuditEvent[] {
    if (targetId) {
      return this.auditEvents.filter((a) => a.targetId === targetId);
    }
    return [...this.auditEvents];
  }

  addAuditEvent(audit: AuditEvent): void {
    this.auditEvents.unshift(audit);
  }

  // Sonar Pings
  private sonarPings: any[] = [];

  recordSonarPing(ping: any): boolean {
    this.sonarPings.push({
      id: this.sonarPings.length + 1,
      ...ping,
      created_at: new Date().toISOString(),
    });
    return true;
  }

  getSonarPings(limit: number = 100): any[] {
    return this.sonarPings.slice(-limit);
  }

  // Stats
  getStats() {
    return {
      targetCount: this.targets.size,
      recommendationCount: this.recommendations.size,
      auditCount: this.auditEvents.length,
      sonarPingCount: this.sonarPings.length,
    };
  }
}

export const fallbackStore = new FallbackStore();
