/**
 * Sonar Ingestion Service & Replay Engine
 * SIH 2026 Problem Statement 26057
 * 
 * Provides an asynchronous, decoupled ingestion layer:
 * - Ping ingestion abstraction (Mock Replay, Image Upload, Stream, JSF/XTF)
 * - Validation & Preprocessing pipeline execution
 * - Sequential ping replay engine with variable playback speeds
 * - Error isolation and fallback management
 */

import { 
  NormalizedSonarFrame, 
  PreprocessingConfig, 
  RawSonarPingInput, 
  ValidationResult 
} from '../../types/sonarFrame';
import { MOCK_SONAR_PINGS } from '../../data/mockSonarPings';
import { SonarInputValidator } from './validation';
import { SonarPreprocessingPipeline } from './pipeline';

export interface ISonarDataRepository {
  getTotalPingsCount(): number;
  getPingByIndex(index: number): RawSonarPingInput | null;
  getPingByNumber(pingNumber: number): RawSonarPingInput | null;
  validatePing(rawPing: RawSonarPingInput): ValidationResult;
  processPing(rawPing: RawSonarPingInput, config: PreprocessingConfig, lastValidFrameId?: string): NormalizedSonarFrame;
}

export class MockSonarDataRepository implements ISonarDataRepository {
  private pings: RawSonarPingInput[];

  constructor(pings: RawSonarPingInput[] = MOCK_SONAR_PINGS) {
    this.pings = pings;
  }

  public getTotalPingsCount(): number {
    return this.pings.length;
  }

  public getPingByIndex(index: number): RawSonarPingInput | null {
    if (index < 0 || index >= this.pings.length) return null;
    return this.pings[index];
  }

  public getPingByNumber(pingNumber: number): RawSonarPingInput | null {
    return this.pings.find((p) => p.pingNumber === pingNumber) ?? null;
  }

  public validatePing(rawPing: RawSonarPingInput): ValidationResult {
    return SonarInputValidator.validate(rawPing);
  }

  public processPing(
    rawPing: RawSonarPingInput, 
    config: PreprocessingConfig,
    lastValidFrameId?: string
  ): NormalizedSonarFrame {
    return SonarPreprocessingPipeline.processFrame(rawPing, config, lastValidFrameId);
  }
}

export class SonarIngestionService {
  private repository: ISonarDataRepository;
  private currentPingIndex: number = 0;
  private lastValidFrame: NormalizedSonarFrame | null = null;
  private preprocessedHistory: NormalizedSonarFrame[] = [];
  private readonly maxHistoryLength: number = 80;

  constructor(repository: ISonarDataRepository = new MockSonarDataRepository()) {
    this.repository = repository;
  }

  /**
   * Sets the active data repository (enables swapping to Live or XTF ingestion).
   */
  public setRepository(repository: ISonarDataRepository): void {
    this.repository = repository;
    this.currentPingIndex = 0;
  }

  public getTotalPings(): number {
    return this.repository.getTotalPingsCount();
  }

  public getCurrentIndex(): number {
    return this.currentPingIndex;
  }

  public seekToIndex(index: number): void {
    const total = this.repository.getTotalPingsCount();
    if (total === 0) return;
    this.currentPingIndex = Math.max(0, Math.min(total - 1, index));
  }

  public stepNext(): void {
    const total = this.repository.getTotalPingsCount();
    if (total === 0) return;
    this.currentPingIndex = (this.currentPingIndex + 1) % total;
  }

  public stepPrev(): void {
    const total = this.repository.getTotalPingsCount();
    if (total === 0) return;
    this.currentPingIndex = (this.currentPingIndex - 1 + total) % total;
  }

  public resetToStart(): void {
    this.currentPingIndex = 0;
  }

  /**
   * Retrieves and preprocesses the current frame in the replay sequence.
   */
  public getCurrentProcessedFrame(config: PreprocessingConfig): NormalizedSonarFrame {
    const raw = this.repository.getPingByIndex(this.currentPingIndex);

    if (!raw) {
      // Fallback empty frame
      return this.generateFallbackFrame(config, 'No ping data available at current replay index');
    }

    try {
      const frame = this.repository.processPing(
        raw, 
        config, 
        this.lastValidFrame ? this.lastValidFrame.frameId : undefined
      );

      if (frame.processingStatus === 'READY' || frame.processingStatus === 'DEGRADED') {
        this.lastValidFrame = frame;
      }

      // Maintain rolling history
      this.preprocessedHistory.push(frame);
      if (this.preprocessedHistory.length > this.maxHistoryLength) {
        this.preprocessedHistory.shift();
      }

      return frame;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown preprocessing exception';
      return this.generateFallbackFrame(config, errorMsg);
    }
  }

  /**
   * Returns recent preprocessed frame history for waterfall rendering buffer.
   */
  public getFrameHistory(): NormalizedSonarFrame[] {
    return [...this.preprocessedHistory];
  }

  public getLastValidFrame(): NormalizedSonarFrame | null {
    return this.lastValidFrame;
  }

  /**
   * Ingests an arbitrary raw ping (e.g. from an image upload or live telemetry socket).
   */
  public ingestExternalPing(raw: RawSonarPingInput, config: PreprocessingConfig): NormalizedSonarFrame {
    return this.repository.processPing(
      raw, 
      config, 
      this.lastValidFrame ? this.lastValidFrame.frameId : undefined
    );
  }

  private generateFallbackFrame(config: PreprocessingConfig, reason: string): NormalizedSonarFrame {
    const lastId = this.lastValidFrame ? this.lastValidFrame.frameId : 'NONE';
    return {
      frameId: `FRM-ERR-${Date.now()}`,
      surveyId: 'SRV-2026-GOM-01',
      transectId: 'TRX-01',
      pingNumber: 0,
      timestamp: new Date().toISOString(),
      channel: 'DUAL',
      sampleCount: 512,
      rangeMeters: 75.0,
      samplingIntervalUsec: 97.4,
      frequencyKhz: 410,
      gain: config.gain,
      tvg: config.tvg,
      contrast: config.contrast,
      isSlantRangeCorrected: config.isSlantRangeCorrected,
      altitudeMeters: 14.6,
      depthMeters: 28.4,
      headingDeg: 42.5,
      latitude: 9.24158,
      longitude: 79.18244,
      pitchDeg: 0,
      rollDeg: 0,
      speedKts: 3.4,
      dataOrigin: {
        acousticSamples: 'UNKNOWN',
        navigationCoordinates: 'UNKNOWN',
        altitudeDepth: 'UNKNOWN',
        slantRangeCorrection: 'UNKNOWN',
        tvgCompensation: 'UNKNOWN',
      },
      portRawSamples: [],
      starboardRawSamples: [],
      portProcessedSamples: [],
      starboardProcessedSamples: [],
      quality: {
        score: 0,
        status: 'INVALID',
        flags: [reason],
        dynamicRangeDb: 0,
        noiseFloorEstimate: 0,
        saturationPercentage: 0,
        channelCompleteness: { port: false, starboard: false },
      },
      processingStatus: 'DEGRADED',
      processingError: reason,
      processingTimeMs: 0,
      lastValidFrameId: lastId,
    };
  }
}

// Singleton export
export const defaultSonarIngestionService = new SonarIngestionService();
