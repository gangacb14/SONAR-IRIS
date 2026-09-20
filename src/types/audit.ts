import { DebrisCategory, VerificationStatus } from './target';

export type AuditActionType =
  | 'TARGET_CREATED'
  | 'TARGET_VERIFIED'
  | 'TARGET_RECLASSIFIED'
  | 'TARGET_NOTE_ADDED'
  | 'TARGET_UPDATED'
  | 'TARGET_UNKNOWN_FLAGGED'
  | 'TARGET_SELECTED'
  | 'RISK_ACKNOWLEDGED'
  | 'RISK_OVERRIDE'
  | 'RISK_NOTE_ADDED'
  | 'FOLLOW_UP_RECOMMENDATION_ACKNOWLEDGED'
  | 'FOLLOW_UP_RECOMMENDATION_OVERRIDDEN'
  | 'FOLLOW_UP_RECOMMENDATION_NOTE_ADDED'
  | 'VIDEO_UPLOADED'
  | 'CSV_UPLOADED'
  | 'VIDEO_DETECTION_LOGGED'
  | 'REGION_CHANGED'
  | 'SENSOR_STREAM_SWITCHED'
  | 'FREQUENCY_TOGGLED'
  | 'PLAYBACK_TOGGLED'
  | 'REPORT_EXPORTED';

export interface AuditEvent {
  id: string;
  targetId: string;
  timestamp: string; // ISO string
  actionType: AuditActionType;
  title: string;
  previousValue?: string;
  newValue?: string;
  operator: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface OperatorVerification {
  id: string;
  targetId: string;
  operator: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  previousCategory?: DebrisCategory;
  newCategory?: DebrisCategory;
  notes?: string;
  timestamp: string;
}
