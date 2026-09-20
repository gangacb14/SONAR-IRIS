import { ITargetRepository, RepositoryResult } from './types';
import { Target, DebrisCategory, VerificationStatus } from '../types/target';
import { RiskLevel } from '../types/risk';
import { AuditEvent } from '../types/audit';
import { MOCK_TARGETS, CATEGORY_LABELS } from '../data/mockTargets';
import { isValidWgs84, wgs84ToUtm } from '../utils/geo';

const VALID_CATEGORIES: DebrisCategory[] = [
  'GHOST_NET',
  'METALLIC_DRUM',
  'PLASTIC_AGGREGATE',
  'WRECKAGE_DEBRIS',
  'TIRE_CLUSTER',
  'PIPELINE_EXPOSURE',
  'ORDNANCE_UXO',
  'GEOLOGICAL_FEATURE',
  'MARINE_DEBRIS',
  'UNKNOWN_ANOMALY',
];

export class MockTargetRepository implements ITargetRepository {
  private targets: Target[] = MOCK_TARGETS.map((t) => ({ ...t }));
  private auditLog: AuditEvent[] = [];

  getAuditTrail(targetId?: string): AuditEvent[] {
    if (targetId) {
      return this.auditLog.filter((a) => a.targetId === targetId);
    }
    return [...this.auditLog];
  }

  async getTargets(surveyId?: string): Promise<RepositoryResult<Target[]>> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { success: true, data: [...this.targets] };
  }

  async getTargetById(id: string): Promise<RepositoryResult<Target>> {
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Target ID must be a non-empty string' };
    }
    const target = this.targets.find((t) => t.id === id);
    if (!target) {
      return { success: false, error: `Target with ID '${id}' not found in registry` };
    }
    return { success: true, data: { ...target } };
  }

  async createTarget(
    target: Target,
    operator: string = 'AI-EDGE-INFERENCE'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    if (!target || !target.id) {
      return { success: false, error: 'Invalid target: Missing identifier' };
    }

    const existingIndex = this.targets.findIndex((t) => t.id === target.id);
    if (existingIndex >= 0) {
      this.targets[existingIndex] = { ...target };
    } else {
      this.targets.push({ ...target });
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: target.id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_CREATED',
      title: 'AI ANOMALY CANDIDATE DETECTED',
      newValue: target.categoryLabel,
      operator,
      description: `Target ${target.id} flagged as ${target.categoryLabel} (Confidence: ${Math.round(target.confidence * 100)}%). Initial status: PENDING_REVIEW.`,
    };

    this.auditLog.push(audit);
    return { success: true, data: { target, audit } };
  }

  async updateTarget(
    id: string,
    changes: Partial<Target>,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    if (!id) {
      return { success: false, error: 'Operational Error: Missing target identifier' };
    }

    const index = this.targets.findIndex((t) => t.id === id);
    if (index === -1) {
      return { success: false, error: `Operational Error: Target '${id}' not found` };
    }

    const existing = this.targets[index];

    // Validation: Confidence
    if (changes.confidence !== undefined) {
      if (typeof changes.confidence !== 'number' || changes.confidence < 0 || changes.confidence > 1) {
        return { success: false, error: 'Validation Error: Confidence value must be between 0.0 and 1.0' };
      }
    }

    // Validation: Coordinates
    const targetLat = changes.latitude !== undefined ? changes.latitude : existing.latitude;
    const targetLng = changes.longitude !== undefined ? changes.longitude : existing.longitude;
    if (!isValidWgs84(targetLat, targetLng)) {
      return {
        success: false,
        error: `Validation Error: Invalid coordinates (${targetLat}, ${targetLng}). Lat must be [-90, 90], Lng [-180, 180].`,
      };
    }

    // Validation: Classification
    if (changes.classification !== undefined) {
      if (!VALID_CATEGORIES.includes(changes.classification)) {
        return { success: false, error: `Validation Error: Unrecognized classification '${changes.classification}'` };
      }
    }

    // Derive UTM coordinates if lat/lng changed
    const utm = wgs84ToUtm(targetLat, targetLng);

    // Compute updated height if slant range or shadow changed
    const slantRange = changes.slantRange ?? existing.slantRange;
    const shadowLength = changes.shadowLength ?? existing.shadowLength;
    const towfishAltitude = changes.towfishAltitude ?? existing.towfishAltitude;
    const shadowHeight =
      slantRange > 0 ? Math.round(((shadowLength * towfishAltitude) / slantRange) * 100) / 100 : existing.shadowHeight;

    const updatedCategory = changes.classification || existing.classification;
    const categoryLabel =
      changes.categoryLabel ||
      (changes.classification ? CATEGORY_LABELS[changes.classification]?.label : existing.categoryLabel);

    const updatedTarget: Target = {
      ...existing,
      ...changes,
      latitude: targetLat,
      longitude: targetLng,
      utmZone: utm.zone,
      utmEasting: utm.easting,
      utmNorthing: utm.northing,
      slantRange,
      shadowLength,
      towfishAltitude,
      shadowHeight,
      classification: updatedCategory,
      categoryLabel: categoryLabel || existing.categoryLabel,

      // Synced backward-compatibility properties
      category: updatedCategory,
      slantRangeMeters: slantRange,
      shadowLengthMeters: shadowLength,
      towfishAltitudeMeters: towfishAltitude,
      estimatedTargetHeightMeters: shadowHeight,
      estimatedLengthMeters: changes.estimatedLength ?? existing.estimatedLength,
      estimatedWidthMeters: changes.estimatedWidth ?? existing.estimatedWidth,
      backscatterDb: changes.backscatter ?? existing.backscatter,
      coordinates: {
        lat: targetLat,
        lng: targetLng,
        utmZone: utm.zone,
        utmEasting: utm.easting,
        utmNorthing: utm.northing,
        depthMeters: changes.depth ?? existing.depth,
      },
    };

    this.targets[index] = updatedTarget;

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_UPDATED',
      title: 'TARGET PARAMETERS MODIFIED',
      operator,
      description: `Target ${id} updated with new operational parameters.`,
    };

    return { success: true, data: { target: updatedTarget, audit } };
  }

  async confirmTarget(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const previousStatus = prev.verificationStatus;
    const newStatus: VerificationStatus = 'CONFIRMED_DEBRIS';
    const verifiedAt = new Date().toISOString();

    const updateRes = await this.updateTarget(
      id,
      {
        verificationStatus: newStatus,
        verifiedAt,
        verifiedBy: operator,
        operatorNotes: notes !== undefined ? notes : prev.operatorNotes,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: verifiedAt,
      actionType: 'TARGET_VERIFIED',
      title: 'TARGET CONFIRMED DEBRIS',
      previousValue: previousStatus,
      newValue: newStatus,
      operator,
      description: `Target ${id} status changed from ${previousStatus} to ${newStatus}.${notes ? ` Note: "${notes}"` : ''}`,
    };

    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async rejectTarget(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const previousStatus = prev.verificationStatus;
    const newStatus: VerificationStatus = 'FALSE_POSITIVE';
    const verifiedAt = new Date().toISOString();

    const updateRes = await this.updateTarget(
      id,
      {
        verificationStatus: newStatus,
        verifiedAt,
        verifiedBy: operator,
        operatorNotes: notes !== undefined ? notes : prev.operatorNotes,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: verifiedAt,
      actionType: 'TARGET_VERIFIED',
      title: 'TARGET MARKED FALSE ALARM',
      previousValue: previousStatus,
      newValue: newStatus,
      operator,
      description: `Target ${id} marked as FALSE_POSITIVE acoustic artifact.${notes ? ` Note: "${notes}"` : ''}`,
    };

    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async reclassifyTarget(
    id: string,
    classification: DebrisCategory,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    if (!VALID_CATEGORIES.includes(classification)) {
      return { success: false, error: `Invalid category classification '${classification}'` };
    }

    const prevCategory = prev.classification;
    const categoryInfo = CATEGORY_LABELS[classification];

    const updateRes = await this.updateTarget(
      id,
      {
        classification,
        categoryLabel: categoryInfo?.label || classification,
        operatorNotes: notes !== undefined ? notes : prev.operatorNotes,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_RECLASSIFIED',
      title: 'TARGET RECLASSIFIED',
      previousValue: prevCategory,
      newValue: classification,
      operator,
      description: `Target ${id} reclassified from ${prevCategory} to ${classification}.`,
    };

    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async markTargetUnknown(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const previousStatus = prev.verificationStatus;
    const newStatus: VerificationStatus = 'GEOLOGICAL_ANOMALY';
    const verifiedAt = new Date().toISOString();

    const updateRes = await this.updateTarget(
      id,
      {
        verificationStatus: newStatus,
        verifiedAt,
        verifiedBy: operator,
        operatorNotes: notes !== undefined ? notes : prev.operatorNotes,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: verifiedAt,
      actionType: 'TARGET_UNKNOWN_FLAGGED',
      title: 'TARGET CLASSIFIED GEOLOGICAL ANOMALY',
      previousValue: previousStatus,
      newValue: newStatus,
      operator,
      description: `Target ${id} flagged as natural seabed anomaly/geology.${notes ? ` Note: "${notes}"` : ''}`,
    };

    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async addOperatorNote(
    id: string,
    note: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const updateRes = await this.updateTarget(
      id,
      {
        operatorNotes: note,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_NOTE_ADDED',
      title: 'OPERATOR NOTE RECORDED',
      operator,
      description: `Added log note: "${note.length > 50 ? note.slice(0, 47) + '...' : note}"`,
    };

    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async overrideTargetRisk(
    id: string,
    operatorRiskLevel: RiskLevel,
    reason: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const previousLevel = prev.operatorRiskLevel || prev.riskAssessment?.riskLevel || 'UNASSESSED';
    const overriddenAt = new Date().toISOString();

    const updatedRiskAssessment = prev.riskAssessment
      ? {
          ...prev.riskAssessment,
          operatorRiskLevel,
          operatorOverrideReason: reason,
          operatorOverriddenAt: overriddenAt,
          operatorOverriddenBy: operator,
        }
      : undefined;

    const updateRes = await this.updateTarget(
      id,
      {
        operatorRiskLevel,
        operatorOverrideReason: reason,
        riskAssessment: updatedRiskAssessment,
      },
      operator
    );

    if (!updateRes.success || !updateRes.data) {
      return updateRes;
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: overriddenAt,
      actionType: 'RISK_OVERRIDE',
      title: 'OPERATOR RISK OVERRIDE',
      previousValue: previousLevel,
      newValue: operatorRiskLevel,
      operator,
      description: `Risk level manually overridden to ${operatorRiskLevel}. Reason: "${reason}"`,
      metadata: { reason, previousLevel, newLevel: operatorRiskLevel },
    };

    this.auditLog.push(audit);
    return { success: true, data: { target: updateRes.data.target, audit } };
  }

  async acknowledgeTargetRisk(
    id: string,
    notes?: string,
    operator: string = 'Hydrographer'
  ): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>> {
    const prev = this.targets.find((t) => t.id === id);
    if (!prev) {
      return { success: false, error: `Target '${id}' not found` };
    }

    const audit: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: id,
      timestamp: new Date().toISOString(),
      actionType: 'RISK_ACKNOWLEDGED',
      title: 'RISK ASSESSMENT ACKNOWLEDGED',
      operator,
      description: `Operator acknowledged risk profile for target ${id}.${notes ? ` Note: "${notes}"` : ''}`,
      metadata: { notes, riskLevel: prev.operatorRiskLevel || prev.riskAssessment?.riskLevel || 'UNASSESSED' },
    };

    this.auditLog.push(audit);
    return { success: true, data: { target: prev, audit } };
  }

  async replaceTargets(
    targets: Target[],
    operator: string = 'CSV_IMPORT'
  ): Promise<RepositoryResult<Target[]>> {
    this.targets = targets.map((t) => ({ ...t }));
    const audit: AuditEvent = {
      id: `audit-${Date.now()}-replace`,
      targetId: targets[0]?.id || 'SYSTEM',
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_CREATED',
      title: 'DATASET REPLACED FROM IMPORT',
      newValue: `${targets.length} targets imported`,
      operator,
      description: `Active dataset replaced with ${targets.length} imported targets.`,
    };
    this.auditLog.push(audit);
    return { success: true, data: [...this.targets] };
  }

  async resetToDemo(): Promise<RepositoryResult<Target[]>> {
    this.targets = MOCK_TARGETS.map((t) => ({ ...t }));
    return { success: true, data: [...this.targets] };
  }
}
