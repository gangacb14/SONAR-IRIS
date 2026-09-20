export type SonarPalette = 'AMBER' | 'GRAYSCALE' | 'OCEAN' | 'COPPER_INVERTED';

export interface SensorState {
  timestamp: string;
  pingId: number;
  lat: number;
  lng: number;
  altitude: number; // meters from seabed
  depth: number; // meters from surface
  speedKnots: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  soundVelocity: number; // m/s (e.g. 1514.2)
  transducerTempC: number;
  frequencyKhz: number; // 410 or 120
  snr: number;
}

/**
 * Backwards compatibility alias for TowfishTelemetry
 */
export type TowfishTelemetry = SensorState;

export interface SonarPing {
  pingId: number;
  timestamp: string;
  transectId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  depth: number;
  speedKnots: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  frequencyKhz: number;
  samplesPerChannel: number;
  rangeMeters: number;
}
