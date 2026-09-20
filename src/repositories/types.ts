import { Target, DebrisCategory, VerificationStatus } from '../types/target';
import { RiskLevel } from '../types/risk';
import { Survey, SurveyTransect } from '../types/survey';
import { SensorState } from '../types/sensor';
import { AuditEvent } from '../types/audit';

export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ISurveyRepository {
  getSurvey(surveyId: string): Promise<RepositoryResult<Survey>>;
  getTransects(surveyId: string): Promise<RepositoryResult<SurveyTransect[]>>;
  updateSurveyMetadata(surveyId: string, changes: Partial<Survey>): Promise<RepositoryResult<Survey>>;
}

export interface ITargetRepository {
  getTargets(surveyId?: string): Promise<RepositoryResult<Target[]>>;
  getTargetById(id: string): Promise<RepositoryResult<Target>>;
  createTarget(target: Target, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  updateTarget(id: string, changes: Partial<Target>, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  confirmTarget(id: string, notes?: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  rejectTarget(id: string, notes?: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  reclassifyTarget(id: string, classification: DebrisCategory, notes?: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  markTargetUnknown(id: string, notes?: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  addOperatorNote(id: string, note: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  overrideTargetRisk(id: string, operatorRiskLevel: RiskLevel, reason: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  acknowledgeTargetRisk(id: string, notes?: string, operator?: string): Promise<RepositoryResult<{ target: Target; audit: AuditEvent }>>;
  replaceTargets?(targets: Target[], operator?: string): Promise<RepositoryResult<Target[]>>;
  resetToDemo?(): Promise<RepositoryResult<Target[]>>;
}

export interface ISensorRepository {
  getLatestTelemetry(): Promise<RepositoryResult<SensorState>>;
  subscribeTelemetry(onUpdate: (state: SensorState) => void, intervalMs?: number): () => void;
}
