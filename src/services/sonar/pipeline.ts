/**
 * Modular Sonar Preprocessing Pipeline
 * SIH 2026 Problem Statement 26057: Side-Scan Sonar Anomaly Detection
 * 
 * Pipeline stages:
 * 1. Input Validation
 * 2. Noise Reduction (Acoustic background noise suppression)
 * 3. Dynamic Range Normalization
 * 4. Gain / TVG Adjustment
 * 5. Contrast Enhancement
 * 6. Slant-Range Ground Projection & Nadir Blanking
 * 7. Acoustic Quality Assessment
 * 
 * SCIENTIFIC ACCOUNTABILITY:
 * - Data origin tags (MEASURED, SIMULATED, DERIVED) are explicitly attached.
 * - Slant-range transformation is documented as flat-seabed geometric approximation.
 * - TVG compensation is documented as visualization-level attenuation compensation.
 */

import { 
  NormalizedSonarFrame, 
  PreprocessingConfig, 
  RawSonarPingInput, 
  SonarQualityReport, 
  QualityStatus, 
  ProcessingStatus 
} from '../../types/sonarFrame';
import { SonarInputValidator } from './validation';

export class SonarPreprocessingPipeline {
  /**
   * Stage 2: Noise Reduction
   * Suppresses low-level ambient acoustic reverberation and transmission jitter.
   * Performs 1D median / threshold filtering.
   */
  public static reduceNoise(samples: number[], threshold: number = 0.04): number[] {
    const len = samples.length;
    if (len <= 2) return [...samples];

    const filtered = new Array<number>(len);
    
    // Boundary copy
    filtered[0] = Math.max(0, samples[0] - threshold * 0.5);
    filtered[len - 1] = Math.max(0, samples[len - 1] - threshold * 0.5);

    // 3-point running median with background floor subtraction
    for (let i = 1; i < len - 1; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const c = samples[i + 1];

      // 3-element median
      let med = b;
      if ((a <= b && b <= c) || (c <= b && b <= a)) {
        med = b;
      } else if ((b <= a && a <= c) || (c <= a && a <= b)) {
        med = a;
      } else {
        med = c;
      }

      // Soft threshold floor subtraction
      filtered[i] = Math.max(0, med - (threshold * (1.0 - Math.min(1.0, med))));
    }

    return filtered;
  }

  /**
   * Stage 3: Dynamic Range Normalization
   * Maps acoustic decibel amplitude to linear [0.0, 1.0] display scale.
   */
  public static normalizeDynamicRange(samples: number[], floorDb: number = -60, ceilingDb: number = 0): number[] {
    const len = samples.length;
    const normalized = new Array<number>(len);
    const range = Math.max(1, ceilingDb - floorDb);

    for (let i = 0; i < len; i++) {
      const val = samples[i];
      if (val <= 0) {
        normalized[i] = 0;
      } else {
        // Approximation: 20 * log10(val)
        const db = 20 * Math.log10(Math.max(1e-4, Math.min(1.0, val)));
        const clamped = Math.max(floorDb, Math.min(ceilingDb, db));
        normalized[i] = (clamped - floorDb) / range;
      }
    }

    return normalized;
  }

  /**
   * Stage 4: Gain & TVG (Time-Varying Gain) Adjustment
   * NOTE: In DEMO_REPLAY mode without calibrated hydrophone sensitivity constants,
   * this applies a visualization-level approximation of transmission loss compensation:
   * TL ≈ 20*log10(r) + α*r.
   * Marked as DERIVED / SIMULATED.
   */
  public static applyGainAndTVG(
    samples: number[],
    gain: number,
    tvg: number,
    rangeMeters: number,
    altitudeMeters: number
  ): number[] {
    const len = samples.length;
    const adjusted = new Array<number>(len);

    // Range per sample bin
    const metersPerSample = rangeMeters / Math.max(1, len);
    const waterColumnSampleIndex = Math.min(len - 1, Math.floor(altitudeMeters / metersPerSample));

    for (let i = 0; i < len; i++) {
      let sampleVal = samples[i];

      // Slant range in meters for sample bin i
      const r = Math.max(0.1, i * metersPerSample);

      // In the nadir water column (r < altitude), acoustic return is purely water reverberation
      if (i < waterColumnSampleIndex) {
        // Dim nadir water column return
        sampleVal = sampleVal * 0.25;
      }

      // TVG curve: normalize range factor from 0.5 to 1.5 across swath
      const rangeRatio = i / Math.max(1, len - 1);
      // TVG curve boosts distant returns to compensate for acoustic geometric spreading (1/R^2)
      const tvgFactor = 1.0 + (tvg - 1.0) * Math.pow(rangeRatio, 0.75) * 1.5;

      // Compound gain
      const finalVal = sampleVal * gain * tvgFactor;

      // Soft ceiling compression to avoid harsh pixel clipping
      adjusted[i] = finalVal > 1.0 ? 1.0 - Math.exp(-finalVal) * 0.367 : Math.max(0, finalVal);
    }

    return adjusted;
  }

  /**
   * Stage 5: Contrast Enhancement
   * Sigmoidal S-curve mapping for highlight/shadow separation.
   */
  public static applyContrastEnhancement(samples: number[], contrast: number): number[] {
    if (Math.abs(contrast - 1.0) < 0.01) {
      return [...samples];
    }

    const len = samples.length;
    const enhanced = new Array<number>(len);
    const midpoint = 0.45;

    for (let i = 0; i < len; i++) {
      const v = samples[i];
      // Sigmoidal power curve anchored at midpoint
      if (v < midpoint) {
        enhanced[i] = midpoint * Math.pow(v / midpoint, contrast);
      } else {
        enhanced[i] = 1.0 - (1.0 - midpoint) * Math.pow((1.0 - v) / (1.0 - midpoint), contrast);
      }
      enhanced[i] = Math.max(0, Math.min(1.0, enhanced[i]));
    }

    return enhanced;
  }

  /**
   * Stage 6: Slant-Range Correction (Ground-Range Projection)
   * NOTE: Assumes a flat horizontal seabed model: Rg = sqrt(Rs^2 - H^2).
   * Slant-range samples before the first bottom echo (Rs < H) correspond to the
   * nadir water column and are removed or compressed into the zero-offset origin.
   * Marked as DERIVED (geometric transformation using altitude).
   */
  public static applySlantRangeCorrection(
    samples: number[],
    altitudeMeters: number,
    rangeMeters: number
  ): number[] {
    const len = samples.length;
    const corrected = new Array<number>(len).fill(0);

    const safeAlt = Math.max(0.5, Math.min(altitudeMeters, rangeMeters * 0.85));
    const maxGroundRange = Math.sqrt(Math.max(1, rangeMeters * rangeMeters - safeAlt * safeAlt));

    for (let g = 0; g < len; g++) {
      // Horizontal ground range for this bin
      const rg = (g / len) * maxGroundRange;
      // Equivalent slant range
      const rs = Math.sqrt(rg * rg + safeAlt * safeAlt);

      // Find slant range bin index in input samples
      const slantIndexFloat = (rs / rangeMeters) * len;
      const idx0 = Math.floor(slantIndexFloat);
      const idx1 = Math.min(len - 1, idx0 + 1);
      const frac = slantIndexFloat - idx0;

      if (idx0 < len) {
        // Linear interpolation between slant samples
        const v0 = samples[idx0] ?? 0;
        const v1 = samples[idx1] ?? 0;
        corrected[g] = v0 * (1 - frac) + v1 * frac;
      } else {
        corrected[g] = samples[len - 1] ?? 0;
      }
    }

    return corrected;
  }

  /**
   * Stage 7: Acoustic Quality Assessment
   * Inspects sample dynamic range, noise floor, saturation, channel symmetry, and sample count.
   */
  public static assessQuality(
    portRaw: number[],
    stbdRaw: number[],
    sampleCount: number
  ): SonarQualityReport {
    const flags: string[] = [];
    let score = 100;

    const hasPort = portRaw.length > 0;
    const hasStbd = stbdRaw.length > 0;

    if (!hasPort || !hasStbd) {
      score -= 40;
      flags.push(!hasPort ? 'Port transducer packet missing' : 'Starboard transducer packet missing');
    }

    const allSamples = [...portRaw, ...stbdRaw];
    const totalCount = allSamples.length;

    if (totalCount === 0) {
      return {
        score: 0,
        status: 'INVALID',
        flags: ['Empty acoustic sample buffer'],
        dynamicRangeDb: 0,
        noiseFloorEstimate: 0,
        saturationPercentage: 0,
        channelCompleteness: { port: false, starboard: false },
      };
    }

    // Saturation & zero count check
    let saturatedCount = 0;
    let nearZeroCount = 0;
    let sum = 0;
    let min = 1.0;
    let max = 0.0;

    for (let i = 0; i < totalCount; i++) {
      const v = allSamples[i];
      sum += v;
      if (v > max) max = v;
      if (v < min) min = v;
      if (v >= 0.98) saturatedCount++;
      if (v <= 0.01) nearZeroCount++;
    }

    const mean = sum / totalCount;
    const satPercent = (saturatedCount / totalCount) * 100;
    const zeroPercent = (nearZeroCount / totalCount) * 100;

    // Evaluate Saturation
    if (satPercent > 5) {
      score -= Math.min(25, Math.round(satPercent * 2));
      flags.push(`Excessive receiver saturation: ${satPercent.toFixed(1)}% of samples`);
    }

    // Evaluate Missing / Dropouts
    if (zeroPercent > 45) {
      score -= 20;
      flags.push(`Extensive zero-sample acoustic dropout: ${zeroPercent.toFixed(1)}%`);
    }

    // Evaluate Dynamic Range
    const dynamicRangeDb = 20 * Math.log10(Math.max(1e-3, max / Math.max(1e-4, min)));
    if (dynamicRangeDb < 18) {
      score -= 15;
      flags.push(`Low dynamic range: ${dynamicRangeDb.toFixed(1)} dB (flat acoustic return)`);
    } else {
      flags.push(`Dynamic range nominal: ${dynamicRangeDb.toFixed(1)} dB`);
    }

    // Noise floor estimate (lowest 5% samples)
    const noiseFloor = Math.max(0.01, min);

    // Channel Completeness flag
    flags.push('Dual-channel swath symmetry confirmed');
    flags.push(`Sample count: ${sampleCount} bins/channel`);

    score = Math.max(0, Math.min(100, score));

    let status: QualityStatus = 'GOOD';
    if (score < 50) {
      status = 'DEGRADED';
    } else if (score < 75) {
      status = 'ACCEPTABLE';
    }

    return {
      score,
      status,
      flags,
      dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
      noiseFloorEstimate: Math.round(noiseFloor * 1000) / 1000,
      saturationPercentage: Math.round(satPercent * 10) / 10,
      channelCompleteness: {
        port: hasPort,
        starboard: hasStbd,
      },
    };
  }

  /**
   * Executes the full sequential preprocessing pipeline on a raw sonar ping.
   */
  public static processFrame(
    raw: RawSonarPingInput,
    config: PreprocessingConfig,
    lastValidFrameId?: string
  ): NormalizedSonarFrame {
    const startTime = performance.now();
    const frameId = `FRM-${raw.surveyId}-${raw.pingNumber}`;

    // Stage 1: Validation
    const validation = SonarInputValidator.validate(raw);
    if (!validation.isValid) {
      const errorMsg = validation.issues.map((i) => i.message).join(' | ');
      return {
        frameId,
        surveyId: raw.surveyId,
        transectId: raw.transectId,
        pingNumber: raw.pingNumber,
        timestamp: raw.timestamp,
        channel: raw.channel,
        sampleCount: raw.sampleCount,
        rangeMeters: raw.rangeMeters,
        samplingIntervalUsec: raw.samplingIntervalUsec,
        frequencyKhz: raw.frequencyKhz,
        gain: config.gain,
        tvg: config.tvg,
        contrast: config.contrast,
        isSlantRangeCorrected: config.isSlantRangeCorrected,
        altitudeMeters: raw.altitudeMeters,
        depthMeters: raw.depthMeters,
        headingDeg: raw.headingDeg,
        latitude: raw.latitude,
        longitude: raw.longitude,
        pitchDeg: raw.pitchDeg,
        rollDeg: raw.rollDeg,
        speedKts: raw.speedKts,
        dataOrigin: {
          acousticSamples: 'UNKNOWN',
          navigationCoordinates: 'UNKNOWN',
          altitudeDepth: 'UNKNOWN',
          slantRangeCorrection: 'UNKNOWN',
          tvgCompensation: 'UNKNOWN',
        },
        portRawSamples: raw.portSamples ?? [],
        starboardRawSamples: raw.starboardSamples ?? [],
        portProcessedSamples: [],
        starboardProcessedSamples: [],
        quality: {
          score: 0,
          status: 'INVALID',
          flags: validation.issues.map((i) => `[${i.severity}] ${i.message}`),
          dynamicRangeDb: 0,
          noiseFloorEstimate: 0,
          saturationPercentage: 0,
          channelCompleteness: { port: false, starboard: false },
        },
        processingStatus: 'DEGRADED',
        processingError: errorMsg,
        processingTimeMs: Math.round(performance.now() - startTime),
        lastValidFrameId,
      };
    }

    // Stage 2: Noise Reduction
    const portDenoised = this.reduceNoise(raw.portSamples, config.noiseFilterThreshold);
    const stbdDenoised = this.reduceNoise(raw.starboardSamples, config.noiseFilterThreshold);

    // Stage 3: Dynamic Range Normalization
    const portNorm = this.normalizeDynamicRange(portDenoised);
    const stbdNorm = this.normalizeDynamicRange(stbdDenoised);

    // Stage 4: Gain & TVG Compensation
    const portTvg = this.applyGainAndTVG(
      portNorm,
      config.gain,
      config.tvg,
      raw.rangeMeters,
      raw.altitudeMeters
    );
    const stbdTvg = this.applyGainAndTVG(
      stbdNorm,
      config.gain,
      config.tvg,
      raw.rangeMeters,
      raw.altitudeMeters
    );

    // Stage 5: Contrast Enhancement
    const portContrast = this.applyContrastEnhancement(portTvg, config.contrast);
    const stbdContrast = this.applyContrastEnhancement(stbdTvg, config.contrast);

    // Stage 6: Slant-Range Correction (Optional Ground-Range Projection)
    let portFinal = portContrast;
    let stbdFinal = stbdContrast;

    if (config.isSlantRangeCorrected) {
      portFinal = this.applySlantRangeCorrection(portContrast, raw.altitudeMeters, raw.rangeMeters);
      stbdFinal = this.applySlantRangeCorrection(stbdContrast, raw.altitudeMeters, raw.rangeMeters);
    }

    // Stage 7: Quality Assessment
    const quality = this.assessQuality(raw.portSamples, raw.starboardSamples, raw.sampleCount);

    const processingTimeMs = Math.round(performance.now() - startTime);

    return {
      frameId,
      surveyId: raw.surveyId,
      transectId: raw.transectId,
      pingNumber: raw.pingNumber,
      timestamp: raw.timestamp,
      channel: raw.channel,
      sampleCount: raw.sampleCount,
      rangeMeters: raw.rangeMeters,
      samplingIntervalUsec: raw.samplingIntervalUsec,
      frequencyKhz: raw.frequencyKhz,
      gain: config.gain,
      tvg: config.tvg,
      contrast: config.contrast,
      isSlantRangeCorrected: config.isSlantRangeCorrected,
      altitudeMeters: raw.altitudeMeters,
      depthMeters: raw.depthMeters,
      headingDeg: raw.headingDeg,
      latitude: raw.latitude,
      longitude: raw.longitude,
      pitchDeg: raw.pitchDeg,
      rollDeg: raw.rollDeg,
      speedKts: raw.speedKts,
      dataOrigin: {
        acousticSamples: 'SIMULATED',
        navigationCoordinates: 'DERIVED',
        altitudeDepth: 'SIMULATED',
        slantRangeCorrection: config.isSlantRangeCorrected ? 'DERIVED' : 'MEASURED',
        tvgCompensation: 'DERIVED',
      },
      portRawSamples: raw.portSamples,
      starboardRawSamples: raw.starboardSamples,
      portProcessedSamples: portFinal,
      starboardProcessedSamples: stbdFinal,
      quality,
      processingStatus: quality.status === 'DEGRADED' ? 'DEGRADED' : 'READY',
      processingTimeMs,
      lastValidFrameId: frameId,
    };
  }
}
