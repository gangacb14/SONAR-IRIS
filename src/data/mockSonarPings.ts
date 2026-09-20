/**
 * Mock Sonar Ping Dataset for DEMO_REPLAY Mode
 * SIH 2026 Problem Statement 26057
 * 
 * Generates realistic acoustic backscatter profiles for sequential ping replay:
 * - Acoustic water column nadir blanking gap
 * - First seabed bottom interface bounce
 * - Geometric transmission decay & seabed texture
 * - Acoustic highlights & acoustic shadows corresponding to registered survey targets
 */

import { RawSonarPingInput } from '../types/sonarFrame';

const SAMPLE_COUNT = 512;
const RANGE_METERS = 75.0;
const ALTITUDE_NOMINAL = 14.6;

/**
 * Procedurally generates a realistic acoustic side-scan ping line.
 */
function generatePingLine(
  pingNumber: number,
  lat: number,
  lng: number,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
  altitude: number,
  depth: number
): RawSonarPingInput {
  const portSamples = new Array<number>(SAMPLE_COUNT);
  const stbdSamples = new Array<number>(SAMPLE_COUNT);

  // Nadir water column cutoff (sample index where seabed first return hits)
  const nadirSampleCutoff = Math.floor((altitude / RANGE_METERS) * SAMPLE_COUNT);

  // Target injection signatures based on registered survey targets:
  // TRG-01: Ghost Net (Ping 42055, Port, 38.4m slant range -> sample ~262)
  const isNetPing = Math.abs(pingNumber - 42055) <= 4;
  // TRG-02: Drum (Ping 42104, Stbd, 45.2m slant range -> sample ~308)
  const isDrumPing = Math.abs(pingNumber - 42104) <= 3;
  // TRG-03: Projectile (Ping 42130, Stbd, 28.1m slant range -> sample ~192)
  const isProjPing = Math.abs(pingNumber - 42130) <= 2;
  // TRG-04: Anchor (Ping 42168, Port, 55.7m slant range -> sample ~380)
  const isAnchorPing = Math.abs(pingNumber - 42168) <= 4;
  // TRG-05: Container (Ping 42195, Stbd, 51.3m slant range -> sample ~350)
  const isContainerPing = Math.abs(pingNumber - 42195) <= 6;
  // TRG-06: Plastic Field (Ping 42208, Port, 32.5m slant range -> sample ~222)
  const isPlasticsPing = Math.abs(pingNumber - 42208) <= 5;

  // Intentional test degraded ping at #42180 (simulates acoustic thruster cavitation noise burst)
  const isDegradedPing = pingNumber === 42180;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    // 1. Nadir water column (r < altitude)
    if (i < nadirSampleCutoff) {
      // Extremely low acoustic return (water particle reverberation only)
      const waterNoise = (Math.sin(i * 12.3 + pingNumber) * 0.5 + 0.5) * 0.04;
      portSamples[i] = waterNoise;
      stbdSamples[i] = waterNoise * 1.1;
      continue;
    }

    // 2. Seabed first return pulse (bright interface transition)
    if (i >= nadirSampleCutoff && i <= nadirSampleCutoff + 6) {
      const bottomBounce = 0.75 + Math.random() * 0.15;
      portSamples[i] = bottomBounce;
      stbdSamples[i] = bottomBounce * 0.95;
      continue;
    }

    // 3. Ambient seabed acoustic backscatter decay
    const rangeFraction = (i - nadirSampleCutoff) / (SAMPLE_COUNT - nadirSampleCutoff);
    const rangeDecay = Math.pow(1.0 - rangeFraction * 0.55, 1.4);
    
    // Natural acoustic seabed grain texture (sand waves & shell fragments)
    const microTexture = (Math.sin(i * 0.45 + pingNumber * 0.8) * 0.08 + (Math.random() - 0.5) * 0.07);
    let portVal = (0.32 + microTexture) * rangeDecay;
    let stbdVal = (0.33 + microTexture * 0.9) * rangeDecay;

    // 4. Inject target acoustic highlights and acoustic shadows
    // Port: Ghost Net (sample 250 - 275)
    if (isNetPing) {
      const dist = Math.abs(i - 262);
      if (dist < 7) {
        portVal += 0.55 * (1 - dist / 7); // High backscatter tangle highlight
      } else if (i >= 269 && i <= 295) {
        portVal *= 0.1; // Dark acoustic shadow behind target
      }
    }

    // Stbd: Chemical Drum (sample 302 - 325)
    if (isDrumPing) {
      const dist = Math.abs(i - 308);
      if (dist < 4) {
        stbdVal += 0.65 * (1 - dist / 4); // Bright metallic specular highlight
      } else if (i >= 312 && i <= 338) {
        stbdVal *= 0.08; // Sharp cylindrical shadow
      }
    }

    // Stbd: Cylindrical Projectile (sample 188 - 204)
    if (isProjPing) {
      const dist = Math.abs(i - 192);
      if (dist < 3) {
        stbdVal += 0.58 * (1 - dist / 3);
      } else if (i >= 195 && i <= 212) {
        stbdVal *= 0.12;
      }
    }

    // Port: Admiralty Pattern Anchor (sample 372 - 395)
    if (isAnchorPing) {
      const dist = Math.abs(i - 380);
      if (dist < 5) {
        portVal += 0.62 * (1 - dist / 5);
      } else if (i >= 385 && i <= 415) {
        portVal *= 0.08;
      }
    }

    // Stbd: ISO Shipping Container (sample 340 - 395)
    if (isContainerPing) {
      const dist = Math.abs(i - 350);
      if (dist < 10) {
        stbdVal += 0.7 * (1 - dist / 10);
      } else if (i >= 360 && i <= 430) {
        stbdVal *= 0.06; // Long distinctive box shadow
      }
    }

    // Port: Plastic Debris Field (sample 215 - 238)
    if (isPlasticsPing) {
      const dist = Math.abs(i - 222);
      if (dist < 8) {
        portVal += (0.35 + (Math.sin(i * 3.2) * 0.2)) * (1 - dist / 8);
      } else if (i >= 230 && i <= 248) {
        portVal *= 0.2;
      }
    }

    // Degraded ping test injection (high noise saturation)
    if (isDegradedPing) {
      portVal = Math.min(1.0, portVal + 0.65 + Math.random() * 0.3);
      stbdVal = Math.min(1.0, stbdVal + 0.65 + Math.random() * 0.3);
    }

    portSamples[i] = Math.max(0, Math.min(1.0, portVal));
    stbdSamples[i] = Math.max(0, Math.min(1.0, stbdVal));
  }

  const timestamp = new Date(1772870400000 + (pingNumber - 42040) * 66).toISOString();

  return {
    surveyId: 'SRV-2026-GOM-01',
    transectId: 'TRX-01',
    pingNumber,
    timestamp,
    channel: 'DUAL',
    sampleCount: SAMPLE_COUNT,
    rangeMeters: RANGE_METERS,
    samplingIntervalUsec: 97.4, // ~0.146m resolution at 1500m/s
    frequencyKhz: 410,
    altitudeMeters: altitude,
    depthMeters: depth,
    headingDeg: headingDeg,
    latitude: lat,
    longitude: lng,
    pitchDeg,
    rollDeg,
    speedKts: 3.4,
    portSamples,
    starboardSamples: stbdSamples,
    packetFormat: 'MOCK_REPLAY',
  };
}

// Generate an operational sequential track of 180 pings
export const MOCK_SONAR_PINGS: RawSonarPingInput[] = (() => {
  const pings: RawSonarPingInput[] = [];
  const startPing = 42040;
  const count = 180;
  const baseLat = 9.24158;
  const baseLng = 79.18244;

  for (let idx = 0; idx < count; idx++) {
    const pingNumber = startPing + idx;
    // Advance survey towfish northeast along track
    const lat = baseLat + idx * 0.000015;
    const lng = baseLng + idx * 0.000012;
    const headingDeg = 42.5 + Math.sin(idx * 0.08) * 0.8;
    const pitchDeg = Math.sin(idx * 0.12) * 0.4;
    const rollDeg = Math.cos(idx * 0.15) * 0.6;
    const altitude = ALTITUDE_NOMINAL + Math.sin(idx * 0.05) * 0.25;
    const depth = 28.4 + Math.sin(idx * 0.03) * 0.2;

    pings.push(
      generatePingLine(
        pingNumber,
        lat,
        lng,
        headingDeg,
        pitchDeg,
        rollDeg,
        altitude,
        depth
      )
    );
  }

  return pings;
})();
