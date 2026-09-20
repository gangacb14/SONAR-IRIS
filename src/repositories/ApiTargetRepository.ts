/**
 * API-Connected Target Repository (with Local Fallback)
 * SIH 2026 Problem Statement 26057
 *
 * Interacts with the backend PostgreSQL + PostGIS REST API endpoints.
 * If the network/server is unavailable, gracefully falls back to the in-memory
 * MockTargetRepository so the client application never crashes.
 */

import { ITargetRepository, RepositoryResult } from './types';
import { Target, DebrisCategory } from '../types/target';
import { RiskLevel } from '../types/risk';
import { AuditEvent } from '../types/audit';
import { MockTargetRepository } from './MockTargetRepository';

export class ApiTargetRepository implements ITargetRepository {
  private fallback = new MockTargetRepository();

  private async fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
      const res = await fetch(path, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...options,
      });
      if (!res.ok) {
        return null;
      }
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch {
      return null;
    }
  }

  async getTargets(surveyId?: string): Promise<RepositoryResult<Target[]>> {
    const query = surveyId ? `?surveyId=${encodeURIComponent(surveyId)}` : '';
    const data = await this.fetchApi<Target[]>(`/api/targets${query}`);
    if (data && Array.isArray(data)) {
      return { success: true, data };
    }
    return this.fallback.getTargets(surveyId);
  }

  async getTargetById(id: string): Promise<RepositoryResult<Target>> {
    const data = await this.fetchApi<Target>(`/api/targets/${encodeURIComponent(id)}`);
    if (data) {
      return { success: true, data };
    }
    return this.fallback.getTargetById(id);
  }

  async createTarget(
    target: Target,
    operator: string = 'AI-EDGE-INFERENCE'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<Target>('/api/targets', {
      method: 'POST',
      body: JSON.stringify({ ...target, operator }),
    });
    if (data) {
      const audit: AuditEvent = {
        id: `AUD-API-${Date.now()}`,
        targetId: data.id,
        timestamp: new Date().toISOString(),
        actionType: 'TARGET_CREATED',
        title: 'TARGET RECORD CREATED',
        newValue: data.categoryLabel,
        operator,
        description: `Target ${data.id} saved in backend database.`,
      };
      return { success: true, data: { target: data, audit } };
    }
    return this.fallback.createTarget(target, operator);
  }

  async updateTarget(
    id: string,
    changes: Partial<Target>,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<{ target: Target; audit: AuditEvent }>(
      `/api/targets/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ ...changes, operator }),
      }
    );
    if (data && data.target) {
      return { success: true, data };
    }
    return this.fallback.updateTarget(id, changes, operator);
  }

  async confirmTarget(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<{ target: Target; audit: AuditEvent }>(
      `/api/targets/${encodeURIComponent(id)}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ notes, operator }),
      }
    );
    if (data && data.target) {
      return { success: true, data };
    }
    return this.fallback.confirmTarget(id, notes, operator);
  }

  async rejectTarget(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<{ target: Target; audit: AuditEvent }>(
      `/api/targets/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ notes, operator }),
      }
    );
    if (data && data.target) {
      return { success: true, data };
    }
    return this.fallback.rejectTarget(id, notes, operator);
  }

  async reclassifyTarget(
    id: string,
    classification: DebrisCategory,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<{ target: Target; audit: AuditEvent }>(
      `/api/targets/${encodeURIComponent(id)}/reclassify`,
      {
        method: 'POST',
        body: JSON.stringify({ classification, notes, operator }),
      }
    );
    if (data && data.target) {
      return { success: true, data };
    }
    return this.fallback.reclassifyTarget(id, classification, notes, operator);
  }

  async markTargetUnknown(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    return this.reclassifyTarget(id, 'UNKNOWN_ANOMALY', notes, operator);
  }

  async addOperatorNote(
    id: string,
    note: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    return this.updateTarget(id, { operatorNotes: note }, operator);
  }

  async overrideTargetRisk(
    id: string,
    operatorRiskLevel: RiskLevel,
    reason: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const data = await this.fetchApi<{ target: Target; audit: AuditEvent }>(
      `/api/targets/${encodeURIComponent(id)}/risk-override`,
      {
        method: 'POST',
        body: JSON.stringify({ operatorRiskLevel, reason, operator }),
      }
    );
    if (data && data.target) {
      return { success: true, data };
    }
    return this.fallback.overrideTargetRisk(id, operatorRiskLevel, reason, operator);
  }

  async acknowledgeTargetRisk(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    return this.fallback.acknowledgeTargetRisk(id, notes, operator);
  }

  // PostGIS Spatial Distance Query
  async findNearbyTargets(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<RepositoryResult<{ target: Target; distanceMeters: number }[]>> {
    const data = await this.fetchApi<{ target: Target; distanceMeters: number }[]>(
      `/api/targets/nearby?lat=${lat}&lng=${lng}&radiusMeters=${radiusMeters}`
    );
    if (data) {
      return { success: true, data };
    }
    return { success: true, data: [] };
  }

  async replaceTargets(
    targets: Target[],
    operator: string = 'CSV_IMPORT'
  ): Promise<RepositoryResult<Target[]>> {
    const data = await this.fetchApi<Target[]>('/api/targets/replace', {
      method: 'POST',
      body: JSON.stringify({ targets, operator }),
    });
    if (data && Array.isArray(data)) {
      this.fallback.replaceTargets(targets, operator);
      return { success: true, data };
    }
    return this.fallback.replaceTargets(targets, operator);
  }

  async resetToDemo(): Promise<RepositoryResult<Target[]>> {
    await this.fetchApi('/api/targets/reset-demo', { method: 'POST' });
    return this.fallback.resetToDemo();
  }
}
