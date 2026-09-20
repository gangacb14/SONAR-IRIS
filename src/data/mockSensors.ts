import { SensorState } from '../types/sensor';

export const INITIAL_SENSOR_STATE: SensorState = {
  timestamp: '2026-09-07T16:14:02.481Z',
  pingId: 42180,
  lat: 9.24158,
  lng: 79.18244,
  altitude: 14.6, // meters from seabed
  depth: 48.2, // meters from water surface
  speedKnots: 3.4,
  headingDeg: 42.6,
  pitchDeg: -0.3,
  rollDeg: 1.2,
  soundVelocity: 1514.8, // m/s
  transducerTempC: 18.4,
  frequencyKhz: 410,
  snr: 28.4,
};

/**
 * Generates an incremented telemetry state simulating realistic AUV towfish dynamics
 */
export function simulateTelemetryStep(prev: SensorState): SensorState {
  const pingId = prev.pingId + 1;
  const pitchDelta = (Math.random() - 0.5) * 0.1;
  const rollDelta = (Math.random() - 0.5) * 0.15;
  const latDelta = 0.000008; // gradual transit along transect line
  const lngDelta = 0.000007;

  return {
    ...prev,
    pingId,
    timestamp: new Date().toISOString(),
    lat: prev.lat + latDelta,
    lng: prev.lng + lngDelta,
    pitchDeg: Math.max(-2, Math.min(2, prev.pitchDeg + pitchDelta)),
    rollDeg: Math.max(-3, Math.min(3, prev.rollDeg + rollDelta)),
    altitude: 14.6 + Math.sin(pingId * 0.05) * 0.3,
  };
}
