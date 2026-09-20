/**
 * Master AI Sonar Detection & Anomaly Intelligence Pipeline
 * SIH 2026 Problem Statement 26057
 * 
 * Orchestrates the full AI inference flow:
 * Normalized Frame -> Quality Gate -> Engine -> False-Positive Filter ->
 * Geological Discrimination -> Multi-Ping Track Association -> Hazard Prioritization ->
 * Explainable Evidence -> Target Candidate
 */

import { 
  ISonarInferenceEngine, 
  InferenceResult, 
  CandidateDetection,
  MultiPingTrack
} from '../../types/aiInference';
import { NormalizedSonarFrame } from '../../types/sonarFrame';
import { QualityGate } from './qualityGate';
import { FalsePositiveFilter } from './falsePositiveFilter';
import { MultiPingTracker } from './multiPingTracker';
import { HazardScorer } from './hazardScoring';
import { EvidenceBuilder } from './evidenceBuilder';
import { MockInferenceEngine } from './MockInferenceEngine';

export interface PipelineExecutionResult {
  inferenceResult: InferenceResult;
  acceptedCandidates: CandidateDetection[];
  associatedTracks: MultiPingTrack[];
  executionTimeMs: number;
}

export class InferencePipeline {
  private engine: ISonarInferenceEngine;
  private tracker: MultiPingTracker;

  constructor(engine?: ISonarInferenceEngine) {
    this.engine = engine || new MockInferenceEngine();
    this.tracker = new MultiPingTracker();
  }

  /**
   * Replace active inference engine (e.g. swap Mock with Onnx)
   */
  public setEngine(newEngine: ISonarInferenceEngine): void {
    this.engine = newEngine;
  }

  public getEngine(): ISonarInferenceEngine {
    return this.engine;
  }

  /**
   * Returns active multi-ping tracking tracks
   */
  public getActiveTracks(): MultiPingTrack[] {
    return this.tracker.getActiveTracks();
  }

  /**
   * Resets temporal multi-ping track memory
   */
  public resetTracking(): void {
    this.tracker.reset();
  }

  /**
   * Executes the full pipeline on a processed sonar frame
   */
  public async processFrame(frame: NormalizedSonarFrame): Promise<PipelineExecutionResult> {
    const pipelineStartTime = performance.now();

    // 1. Quality Gating
    const qualityGateResult = QualityGate.evaluate(frame);
    if (qualityGateResult.status === 'INFERENCE_SKIPPED') {
      const elapsed = performance.now() - pipelineStartTime;
      return {
        inferenceResult: {
          inferenceId: `SKP-${frame.frameId}`,
          frameId: frame.frameId,
          pingNumber: frame.pingNumber,
          timestamp: new Date().toISOString(),
          modelVersion: this.engine.modelVersion,
          inferenceMode: this.engine.inferenceMode,
          processingTimeMs: Math.round(elapsed * 10) / 10,
          qualityGate: 'INFERENCE_SKIPPED',
          skipReason: qualityGateResult.skipReason,
          detections: [],
          warnings: qualityGateResult.warnings,
          executionDevice: 'QualityGate Bypassed',
        },
        acceptedCandidates: [],
        associatedTracks: this.tracker.getActiveTracks(),
        executionTimeMs: elapsed,
      };
    }

    // 2. AI Inference Engine
    const rawInference = await this.engine.infer(frame);
    const acceptedCandidates: CandidateDetection[] = [];

    // 3. Post-Processing & Discrimination per detection
    for (const rawDet of rawInference.detections) {
      // 3a. False-Positive Filtering & Geological Discrimination
      const filterResult = FalsePositiveFilter.evaluateCandidate(rawDet, frame);
      if (!filterResult.isAccepted) {
        // Drop candidate flagged as false positive by heuristic check
        continue;
      }

      // Update confidence and geological classification
      rawDet.confidence = filterResult.adjustedConfidence;
      rawDet.geologicalAffinity = filterResult.geologicalAffinity;

      // 3b. Temporal / Multi-Ping Consistency Track Association
      const association = this.tracker.associate(rawDet);
      const detectionWithTrack = association.candidate;

      // 3c. Hazard Prioritization Scoring
      const hazard = HazardScorer.assessHazard(detectionWithTrack);
      detectionWithTrack.hazardSeverity = hazard.severity;

      // 3d. Explainable AI Evidence Generation
      const evidence = EvidenceBuilder.buildEvidence(
        detectionWithTrack,
        frame,
        filterResult.appliedFilters,
        filterResult.geologicalReasoning,
        filterResult.geologicalAffinity
      );
      detectionWithTrack.evidenceReference = evidence;

      acceptedCandidates.push(detectionWithTrack);
    }

    const totalElapsed = performance.now() - pipelineStartTime;

    return {
      inferenceResult: {
        ...rawInference,
        detections: acceptedCandidates,
        processingTimeMs: Math.max(rawInference.processingTimeMs, Math.round(totalElapsed * 10) / 10),
      },
      acceptedCandidates,
      associatedTracks: this.tracker.getActiveTracks(),
      executionTimeMs: totalElapsed,
    };
  }
}
