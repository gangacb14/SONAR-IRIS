/**
 * End-to-End Sonar File Ingestion & Mission Prioritization Pipeline
 * SIH 2026 Problem Statement 26057
 * 
 * Flow:
 * SONAR FILE (.json, .csv, .geojson)
 *   ↓ File Validation (extension, size, security, schema)
 *   ↓ Sonar Record Parsing (resilient partial processing)
 *   ↓ Feature Extraction & Acoustic Preprocessing
 *   ↓ ONNX Inference (swath tensor [1, 2, 1024])
 *   ↓ Multi-Ping Acoustic Track Association
 *   ↓ Target Candidate Generation & Spatial Attribution
 *   ↓ Existing Decision-Support & Follow-Up Recommendation Engine
 *   ↓ Mission Prioritization
 *   ↓ PostgreSQL / PostGIS Persistence & Audit Logging
 *   ↓ Telemetry & Status Reporting
 */

import { RawSonarPingInput, PreprocessingConfig } from '../../types/sonarFrame';
import { Target } from '../../types/target';
import { FollowUpRecommendation } from '../../types/followUp';
import { AuditEvent } from '../../types/audit';
import { SurveyRiskContext } from '../../types/risk';
import { FileIngestionReport, IngestionStatus, IngestionStatistics } from '../../types/ingestion';

import { SonarFileParser } from './fileParser';
import { SonarPreprocessingPipeline } from './pipeline';
import { InferencePipeline } from '../ai/InferencePipeline';
import { OnnxInferenceEngine } from '../ai/OnnxInferenceEngine';
import { TargetConverter } from '../ai/targetConverter';
import { storageService } from '../../backend/db/storageService';
import { RiskAssessmentEngine } from '../risk/RiskAssessmentEngine';
import { GeoIntelligenceEngine } from '../geoint/GeoIntelligenceEngine';
import { TemporalChangeEngine } from '../temporal/TemporalChangeEngine';
import { FollowUpRecommendationEngine } from '../followUp/FollowUpRecommendationEngine';
import { HISTORICAL_SURVEYS } from '../../data/mockHistoricalSurveys';
import { MOCK_SURVEY_INFRASTRUCTURE } from '../../data/mockInfrastructure';

export class FileIngestionPipeline {
  private static defaultPreprocessingConfig: PreprocessingConfig = {
    gain: 1.1,
    tvg: 1.3,
    contrast: 1.2,
    isSlantRangeCorrected: false,
    noiseFilterThreshold: 0.04,
  };

  /**
   * Processes an uploaded sonar file end-to-end.
   */
  public static async processUploadedFile(
    rawFilename: string,
    fileBuffer: string | any,
    customConfig?: Partial<PreprocessingConfig>
  ): Promise<FileIngestionReport> {
    const startTime = Date.now();
    const jobId = `JOB-INGEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const config: PreprocessingConfig = {
      ...this.defaultPreprocessingConfig,
      ...customConfig,
    };

    const getBufferByteLength = (buf: any): number => {
      if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
        try {
          return Buffer.byteLength(buf);
        } catch {
          // fallback
        }
      }
      if (typeof buf === 'string') {
        return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(buf).length : buf.length;
      }
      if (buf && typeof buf.length === 'number') {
        return buf.length;
      }
      if (buf && typeof buf.byteLength === 'number') {
        return buf.byteLength;
      }
      return 0;
    };

    // 1. Parse & Validate File
    let parseResult;
    try {
      parseResult = SonarFileParser.parseFile(rawFilename, fileBuffer);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const stats = await storageService.getStatus();
      return {
        jobId,
        filename: SonarFileParser.sanitizeFilename(rawFilename),
        format: 'JSON',
        fileSizeBytes: getBufferByteLength(fileBuffer),
        status: 'Failed',
        statistics: {
          recordsReceived: 0,
          recordsProcessed: 0,
          recordsRejected: 0,
          targetsDetected: 0,
          recommendationsGenerated: 0,
          missionsCreated: 0,
          multiPingTracksActive: 0,
        },
        rejectedRecords: [{
          recordIndex: 0,
          reason: err.message || 'File parsing or validation failed',
        }],
        detectedTargets: [],
        recommendations: [],
        storageMode: stats.storageMode,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        error: err.message,
      };
    }

    const { format, sanitizedFilename, fileSizeBytes, validPings, rejectedRecords, totalRecordsFound } = parseResult;

    // 2. Initialize Inference Pipeline with ONNX Engine and Tracking
    const onnxEngine = new OnnxInferenceEngine();
    const inferencePipeline = new InferencePipeline(onnxEngine);

    // Retrieve existing targets to support sequential de-duplication
    const existingTargets = await storageService.getTargets();
    const allWorkingTargets = [...existingTargets];
    const newlyDetectedTargets: Target[] = [];

    // Ingest pre-parsed targets from CSV / GeoJSON / JSON file if present
    if (parseResult.detectedTargets && parseResult.detectedTargets.length > 0) {
      // Replace existing backend targets with the uploaded targets dataset
      await storageService.replaceTargets(parseResult.detectedTargets, 'CSV_INGESTION');
      allWorkingTargets.length = 0; // Isolate active working set to imported targets
      for (const target of parseResult.detectedTargets) {
        allWorkingTargets.push(target);
        newlyDetectedTargets.push(target);
      }
    }

    let currentSeqMax = existingTargets.reduce((max, t) => {
      const match = t.id.match(/(?:TRG-26057-|TRG-)(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    // 3. Sequential Record Preprocessing & AI Swath Inference
    for (let i = 0; i < validPings.length; i++) {
      const rawPing = validPings[i];

      // 3a. Preprocessing & Intensity Normalization
      const normalizedFrame = SonarPreprocessingPipeline.processFrame(rawPing, config);

      // 3b. ONNX Inference & Multi-Ping Tracking
      const pipelineResult = await inferencePipeline.processFrame(normalizedFrame);

      // 3c. Record Ping in PostGIS / Database
      await storageService.recordSonarPing({
        surveyId: rawPing.surveyId,
        transectId: rawPing.transectId,
        pingNumber: rawPing.pingNumber,
        timestamp: rawPing.timestamp,
        latitude: rawPing.latitude,
        longitude: rawPing.longitude,
        altitudeMeters: rawPing.altitudeMeters,
        depthMeters: rawPing.depthMeters,
        headingDeg: rawPing.headingDeg,
        frequencyKhz: rawPing.frequencyKhz,
        qualityScore: normalizedFrame.quality.score,
        processingStatus: normalizedFrame.processingStatus,
        candidateCount: pipelineResult.acceptedCandidates.length,
      });

      // 3d. Check detection candidates and convert to Target
      for (const candidate of pipelineResult.acceptedCandidates) {
        const isDuplicate = allWorkingTargets.some((t) => {
          if (candidate.trackId && t.operatorNotes?.includes(candidate.trackId)) {
            return true;
          }
          const dLat = Math.abs(t.latitude - candidate.latitude);
          const dLng = Math.abs(t.longitude - candidate.longitude);
          return (dLat < 0.00015 && dLng < 0.00015) || t.pingNumber === candidate.pingNumber;
        });

        if (!isDuplicate) {
          currentSeqMax += 1;
          const target = TargetConverter.toTarget(
            candidate,
            rawPing.surveyId,
            rawPing.transectId,
            currentSeqMax
          );

          // Persist target in PostgreSQL / PostGIS
          const saved = await storageService.saveTarget(target, 'FILE_INGESTION_AGENT');
          allWorkingTargets.push(saved);
          newlyDetectedTargets.push(saved);
        }
      }
    }

    // When raw pings produce newly detected targets from an ingested dataset,
    // synchronize active database targets to the newly detected targets
    if ((!parseResult.detectedTargets || parseResult.detectedTargets.length === 0) && newlyDetectedTargets.length > 0) {
      await storageService.replaceTargets(newlyDetectedTargets, 'SONAR_DATASET_INGESTION');
    }

    // 4. Decision Support & Follow-up Recommendation Generation
    // Context for risk scoring & operational exposure
    const surveyRiskContext: SurveyRiskContext = {
      surveyId: validPings[0]?.surveyId || 'SRV-2026-GOM-01',
      isDemoReplay: false,
      knownInfrastructure: MOCK_SURVEY_INFRASTRUCTURE,
    };

    // Evaluate all targets through the verified decision-support engine
    const assessedTargets = RiskAssessmentEngine.assessAndRankTargets(allWorkingTargets, surveyRiskContext);
    const geointResult = GeoIntelligenceEngine.analyzeTargets(assessedTargets, surveyRiskContext);

    // Temporal baseline comparison
    const surveyComparison = TemporalChangeEngine.compareSurveys(
      HISTORICAL_SURVEYS[0],
      surveyRiskContext.surveyId,
      'Operational Survey',
      new Date().toISOString().split('T')[0],
      assessedTargets,
      [],
      surveyRiskContext
    );

    // Call the verified FollowUpRecommendationEngine without modifying its logic
    const recommendationResult = FollowUpRecommendationEngine.generateRecommendations(
      assessedTargets,
      geointResult.hotspots,
      surveyComparison,
      surveyRiskContext
    );

    // 5. Persist Recommendations into Database
    if (recommendationResult.recommendations.length > 0) {
      await storageService.saveRecommendations(recommendationResult.recommendations);
    }

    // 6. Record Audit Event for Provenance
    const auditEvent: AuditEvent = {
      id: `AUD-INGEST-${jobId}`,
      targetId: newlyDetectedTargets[0]?.id || 'SYSTEM',
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_CREATED',
      title: `Sonar File Ingested: ${sanitizedFilename}`,
      previousValue: undefined,
      newValue: `Status: ${validPings.length > 0 ? (rejectedRecords.length > 0 ? 'PARTIALLY_PROCESSED' : 'COMPLETED') : 'FAILED'}`,
      operator: 'SONAR-FILE-INGESTION-SERVICE',
      description: `Ingested ${validPings.length} pings from ${sanitizedFilename} (${rejectedRecords.length} rejected). Detected ${newlyDetectedTargets.length} new targets, generated ${recommendationResult.recommendations.length} follow-up recommendations.`,
      metadata: {
        jobId,
        filename: sanitizedFilename,
        format,
        recordsReceived: totalRecordsFound,
        recordsProcessed: validPings.length,
        recordsRejected: rejectedRecords.length,
        targetsDetected: newlyDetectedTargets.length,
        recommendationsGenerated: recommendationResult.recommendations.length,
      },
    };
    await storageService.addAuditEvent(auditEvent);

    // 7. Compute Final Status & Statistics
    let status: IngestionStatus = 'Completed';
    if (validPings.length === 0) {
      status = 'Failed';
    } else if (rejectedRecords.length > 0) {
      status = 'Partially Processed';
    }

    const uniqueMissionTypes = new Set(recommendationResult.recommendations.map((r) => r.recommendationType));

    const statistics: IngestionStatistics = {
      recordsReceived: totalRecordsFound,
      recordsProcessed: validPings.length,
      recordsRejected: rejectedRecords.length,
      targetsDetected: newlyDetectedTargets.length,
      recommendationsGenerated: recommendationResult.recommendations.length,
      missionsCreated: uniqueMissionTypes.size,
      multiPingTracksActive: inferencePipeline.getActiveTracks().length,
    };

    const durationMs = Date.now() - startTime;
    const dbHealth = await storageService.getStatus();

    return {
      jobId,
      filename: sanitizedFilename,
      format,
      fileSizeBytes,
      status,
      statistics,
      rejectedRecords,
      detectedTargets: newlyDetectedTargets,
      recommendations: recommendationResult.recommendations,
      storageMode: dbHealth.storageMode,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
