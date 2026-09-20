/**
 * Sonar Input Validation Module
 * SIH 2026 Problem Statement 26057
 * 
 * Performs structural, physical, and numerical integrity checks on incoming
 * raw sonar pings prior to preprocessing and normalization.
 */

import { RawSonarPingInput, ValidationIssue, ValidationResult } from '../../types/sonarFrame';

export class SonarInputValidator {
  /**
   * Validates a raw sonar ping against physical and acoustic integrity rules.
   */
  public static validate(raw: RawSonarPingInput): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Structural Checks
    if (!raw) {
      return {
        isValid: false,
        status: 'INVALID',
        issues: [{
          field: 'payload',
          message: 'Empty or null sonar ping payload received.',
          severity: 'ERROR',
        }],
      };
    }

    if (!raw.surveyId || typeof raw.surveyId !== 'string') {
      issues.push({
        field: 'surveyId',
        message: 'Missing or invalid survey identifier.',
        severity: 'ERROR',
      });
    }

    if (raw.pingNumber === undefined || raw.pingNumber === null || raw.pingNumber < 0 || !Number.isInteger(raw.pingNumber)) {
      issues.push({
        field: 'pingNumber',
        message: `Invalid ping sequence number: ${raw.pingNumber}. Must be a non-negative integer.`,
        severity: 'ERROR',
      });
    }

    // 2. Channel Availability & Dimensions
    if (!['PORT', 'STARBOARD', 'DUAL'].includes(raw.channel)) {
      issues.push({
        field: 'channel',
        message: `Unsupported acoustic channel configuration '${raw.channel}'. Expected PORT, STARBOARD, or DUAL.`,
        severity: 'ERROR',
      });
    }

    if (raw.sampleCount <= 0 || !Number.isInteger(raw.sampleCount)) {
      issues.push({
        field: 'sampleCount',
        message: `Invalid sample count: ${raw.sampleCount}. Expected positive integer.`,
        severity: 'ERROR',
      });
    }

    // 3. Acoustic Samples Integrity
    const hasPort = raw.channel === 'PORT' || raw.channel === 'DUAL';
    const hasStbd = raw.channel === 'STARBOARD' || raw.channel === 'DUAL';

    if (hasPort) {
      if (!Array.isArray(raw.portSamples) || raw.portSamples.length === 0) {
        issues.push({
          field: 'portSamples',
          message: 'Port channel selected but port acoustic sample buffer is missing or empty.',
          severity: 'ERROR',
        });
      } else if (raw.portSamples.length !== raw.sampleCount) {
        issues.push({
          field: 'portSamples',
          message: `Port sample buffer length (${raw.portSamples.length}) does not match declared sampleCount (${raw.sampleCount}).`,
          severity: 'WARNING',
        });
      } else {
        // Inspect for NaN or Inf
        let invalidSampleCount = 0;
        for (let i = 0; i < raw.portSamples.length; i++) {
          const val = raw.portSamples[i];
          if (!Number.isFinite(val) || val < 0) {
            invalidSampleCount++;
          }
        }
        if (invalidSampleCount > 0) {
          issues.push({
            field: 'portSamples',
            message: `Found ${invalidSampleCount} non-finite or negative acoustic samples in Port channel.`,
            severity: 'ERROR',
          });
        }
      }
    }

    if (hasStbd) {
      if (!Array.isArray(raw.starboardSamples) || raw.starboardSamples.length === 0) {
        issues.push({
          field: 'starboardSamples',
          message: 'Starboard channel selected but starboard acoustic sample buffer is missing or empty.',
          severity: 'ERROR',
        });
      } else if (raw.starboardSamples.length !== raw.sampleCount) {
        issues.push({
          field: 'starboardSamples',
          message: `Starboard sample buffer length (${raw.starboardSamples.length}) does not match declared sampleCount (${raw.sampleCount}).`,
          severity: 'WARNING',
        });
      } else {
        // Inspect for NaN or Inf
        let invalidSampleCount = 0;
        for (let i = 0; i < raw.starboardSamples.length; i++) {
          const val = raw.starboardSamples[i];
          if (!Number.isFinite(val) || val < 0) {
            invalidSampleCount++;
          }
        }
        if (invalidSampleCount > 0) {
          issues.push({
            field: 'starboardSamples',
            message: `Found ${invalidSampleCount} non-finite or negative acoustic samples in Starboard channel.`,
            severity: 'ERROR',
          });
        }
      }
    }

    // 4. Acoustic Geometry & Physical Range
    if (raw.rangeMeters <= 0 || raw.rangeMeters > 3000) {
      issues.push({
        field: 'rangeMeters',
        message: `Slant range (${raw.rangeMeters} m) out of operational envelope (0m - 3000m).`,
        severity: 'ERROR',
      });
    }

    if (raw.frequencyKhz <= 0 || raw.frequencyKhz > 2000) {
      issues.push({
        field: 'frequencyKhz',
        message: `Sonar frequency (${raw.frequencyKhz} kHz) outside expected marine acoustic bounds (10kHz - 2000kHz).`,
        severity: 'WARNING',
      });
    }

    // 5. Hydrographic Vehicle Navigation Values
    if (raw.latitude < -90 || raw.latitude > 90) {
      issues.push({
        field: 'latitude',
        message: `Geodetic latitude ${raw.latitude}° is out of WGS84 range [-90, +90].`,
        severity: 'ERROR',
      });
    }

    if (raw.longitude < -180 || raw.longitude > 180) {
      issues.push({
        field: 'longitude',
        message: `Geodetic longitude ${raw.longitude}° is out of WGS84 range [-180, +180].`,
        severity: 'ERROR',
      });
    }

    if (raw.altitudeMeters < 0 || raw.altitudeMeters > 500) {
      issues.push({
        field: 'altitudeMeters',
        message: `Towfish altitude (${raw.altitudeMeters} m) is physically improbable (< 0 or > 500m).`,
        severity: 'WARNING',
      });
    }

    if (raw.depthMeters < 0 || raw.depthMeters > 11000) {
      issues.push({
        field: 'depthMeters',
        message: `Towfish depth (${raw.depthMeters} m) is out of oceanographic bounds.`,
        severity: 'ERROR',
      });
    }

    if (raw.speedKts < 0 || raw.speedKts > 30) {
      issues.push({
        field: 'speedKts',
        message: `Towfish speed (${raw.speedKts} kts) exceeds operational survey towing envelope.`,
        severity: 'WARNING',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      isValid: !hasErrors,
      status: hasErrors ? 'INVALID' : 'VALID',
      issues,
    };
  }
}
