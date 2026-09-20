/**
 * Strongly-Typed Models for Real Sonar File Ingestion
 * SIH 2026 Problem Statement 26057
 */

import { Target } from './target';
import { FollowUpRecommendation } from './followUp';

export type SupportedSonarFormat = 'JSON' | 'CSV' | 'GEOJSON';

export type DataSource = 'DEMO' | 'CSV_IMPORT' | 'LIVE_SONAR';

export interface DatasetProvenance {
  dataSource: DataSource;
  sourceFilename?: string;
  ingestionTimestamp: string;
  totalRecordsParsed: number;
  validTargetsCount: number;
  rejectedRowsCount: number;
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  crs?: string;
}

export type IngestionStatus =
  | 'Uploaded'
  | 'Processing'
  | 'Completed'
  | 'Partially Processed'
  | 'Failed';

export interface IngestionStatistics {
  recordsReceived: number;
  recordsProcessed: number;
  recordsRejected: number;
  targetsDetected: number;
  recommendationsGenerated: number;
  missionsCreated: number;
  multiPingTracksActive: number;
}

export interface IngestionRejection {
  recordIndex: number;
  pingNumber?: number;
  field?: string;
  reason: string;
}

export interface FileIngestionReport {
  jobId: string;
  filename: string;
  format: SupportedSonarFormat;
  fileSizeBytes: number;
  status: IngestionStatus;
  statistics: IngestionStatistics;
  rejectedRecords: IngestionRejection[];
  detectedTargets: Target[];
  recommendations: FollowUpRecommendation[];
  storageMode: 'POSTGRESQL_POSTGIS' | 'DEVELOPMENT_FALLBACK';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}
