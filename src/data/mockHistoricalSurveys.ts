/**
 * Historical Survey Data & Demonstration Datasets
 * SIH 2026 Problem Statement 26057: Repeat-Survey Temporal Change Detection
 *
 * Provides realistic, deterministic repeat-survey baselines for temporal comparison.
 * Explicitly tagged as SIMULATED / DEMO REPLAY.
 */

import { HistoricalSurvey } from '../types/temporal';
import { Target } from '../types/target';
import { wgs84ToUtm } from '../utils/geo';

function buildHistoricalTarget(
  id: string,
  surveyId: string,
  transectId: string,
  pingNumber: number,
  channel: 'PORT' | 'STARBOARD',
  classification: Target['classification'],
  categoryLabel: string,
  confidence: number,
  lat: number,
  lng: number,
  depth: number,
  length: number,
  width: number,
  shadowLength: number,
  severity: Target['severity'],
  notes: string,
  detectedAt: string
): Target {
  const utm = wgs84ToUtm(lat, lng);
  const towfishAltitude = 14.5;
  const slantRange = 35.0;
  const shadowHeight = Math.round(((shadowLength * towfishAltitude) / slantRange) * 100) / 100;

  return {
    id,
    surveyId,
    transectId,
    pingNumber,
    channel,
    classification,
    categoryLabel,
    confidence,
    latitude: lat,
    longitude: lng,
    coordinateReferenceSystem: 'WGS84 / UTM Zone 44N (EPSG:32644)',
    utmZone: utm.zone,
    utmEasting: utm.easting,
    utmNorthing: utm.northing,
    depth,
    slantRange,
    groundRange: 32.0,
    towfishAltitude,
    estimatedLength: length,
    estimatedWidth: width,
    shadowLength,
    shadowHeight,
    backscatter: -12.0,
    severity,
    verificationStatus: 'CONFIRMED_DEBRIS',
    operatorNotes: notes,
    detectedAt,
    sonarEvidenceReference: {
      waterfallBox: { x: 30, y: 40, width: 12, height: 14 },
      rangeMeters: slantRange,
      pingOffset: pingNumber,
    },
    modelMetadata: {
      modelName: 'YOLOv8-Marine-SSS-Chirp v2.1 (Baseline)',
      featureExtractor: 'Baseline Multi-Spectral SSS Model',
      snrDb: 22.0,
      shadowContrastRatio: 4.5,
    },
    // Backwards compatibility mappings
    transectLine: transectId,
    category: classification,
    timestamp: detectedAt,
    slantRangeMeters: slantRange,
    groundRangeMeters: 32.0,
    towfishAltitudeMeters: towfishAltitude,
    shadowLengthMeters: shadowLength,
    estimatedTargetHeightMeters: shadowHeight,
    estimatedLengthMeters: length,
    estimatedWidthMeters: width,
    backscatterDb: -12.0,
    coordinates: {
      lat,
      lng,
      utmZone: utm.zone,
      utmEasting: utm.easting,
      utmNorthing: utm.northing,
      depthMeters: depth,
    },
    waterfallBox: { x: 30, y: 40, width: 12, height: 14 },
  };
}

/**
 * Baseline historical targets recorded during the 2025 Gulf of Mannar survey campaign.
 */
const BASELINE_2025_TARGETS: Target[] = [
  // 1. Matched to TRG-26057-01 (Ghost Net) -> PERSISTENT (stable)
  buildHistoricalTarget(
    'TRG-2025-01',
    'SURVEY-2025-BASE-01',
    'TRX-03',
    38410,
    'PORT',
    'GHOST_NET',
    'Derelict Monofilament Gillnet & Buoy Cluster',
    0.942,
    9.24080,
    79.18185,
    49.8,
    18.5,
    4.2,
    6.2,
    'CRITICAL',
    'Submerged nylon gillnet entangled on reef outcropping. Observed during 2025 baseline survey.',
    '2025-08-14T10:14:22Z'
  ),

  // 2. Matched to TRG-26057-02 (Metallic Drum) -> CHANGED (reclassified, risk increased, position shifted 16m)
  buildHistoricalTarget(
    'TRG-2025-02',
    'SURVEY-2025-BASE-01',
    'TRX-03',
    38490,
    'STARBOARD',
    'UNKNOWN_ANOMALY',
    'Unidentified Compact Specular Anomaly',
    0.710,
    9.24172,
    79.18302,
    51.0,
    0.85,
    0.55,
    1.9,
    'MODERATE',
    'Partially buried compact echo return. Weak acoustic shadow; flagged for follow-up investigation.',
    '2025-08-14T10:16:05Z'
  ),

  // 3. Matched to TRG-26057-03 (Wreckage) -> CHANGED (footprint expanded +64% from 7.8m to 12.8m)
  buildHistoricalTarget(
    'TRG-2025-03',
    'SURVEY-2025-BASE-01',
    'TRX-02',
    24120,
    'PORT',
    'WRECKAGE_DEBRIS',
    'Sunken Vessel Timber/Frame Section',
    0.945,
    9.23652,
    79.17840,
    54.2,
    7.8,
    4.1,
    7.2,
    'HIGH',
    'Exposed wooden hull timbers protruding 1.8m above sediment. Majority of structure buried in silt.',
    '2025-08-14T09:48:10Z'
  ),

  // 4. Matched to TRG-26057-04 (Tire Cluster) -> PERSISTENT (stable)
  buildHistoricalTarget(
    'TRG-2025-04',
    'SURVEY-2025-BASE-01',
    'TRX-03',
    38380,
    'STARBOARD',
    'TIRE_CLUSTER',
    'Commercial Heavy Vehicle Tire Cluster (5 units)',
    0.875,
    9.23990,
    79.18123,
    48.1,
    4.5,
    3.0,
    2.0,
    'MODERATE',
    'Five discarded toroidal tire echoes clustered together.',
    '2025-08-14T10:12:40Z'
  ),

  // 5. Matched to TRG-26057-07 (Geological Feature) -> PERSISTENT (natural bedrock)
  buildHistoricalTarget(
    'TRG-2025-07',
    'SURVEY-2025-BASE-01',
    'TRX-03',
    38450,
    'PORT',
    'GEOLOGICAL_FEATURE',
    'Natural Calcareous Sandstone Ridge',
    0.920,
    9.24116,
    79.18088,
    50.0,
    14.0,
    3.7,
    5.4,
    'INFORMATIONAL',
    'Natural bedrock ridge on western edge of swath.',
    '2025-08-14T10:15:18Z'
  ),

  // 6. Present in 2025 within covered current swath, NOT detected in 2026 -> REMOVED
  buildHistoricalTarget(
    'TRG-2025-REM-05',
    'SURVEY-2025-BASE-01',
    'TRX-02',
    25400,
    'STARBOARD',
    'PLASTIC_AGGREGATE',
    'Synthetic Rope & Net Bundle',
    0.880,
    9.23850,
    79.17980,
    48.5,
    2.4,
    1.8,
    1.6,
    'MODERATE',
    'Loose synthetic rope cluster located in mid-channel. Not detected during 2026 repeat survey.',
    '2025-08-14T09:55:33Z'
  ),

  // 7. Located outside 2026 survey coverage bounds -> NOT_REASSESSED
  buildHistoricalTarget(
    'TRG-2025-OUT-06',
    'SURVEY-2025-BASE-01',
    'TRX-EXT',
    8920,
    'PORT',
    'METALLIC_DRUM',
    'Industrial Container (Outer Coastal Sector)',
    0.895,
    9.21500,
    79.16000, // Southwest of survey bounds (current bounds ~ 9.228 to 9.248, 79.172 to 79.188)
    42.0,
    1.2,
    0.7,
    2.2,
    'HIGH',
    'Metallic cylinder detected on peripheral reconnaissance line. Outside Sector Charlie boundary.',
    '2025-08-14T08:12:00Z'
  ),

  // 8. Located on outer swath edge with marginal coverage/quality -> UNCERTAIN
  buildHistoricalTarget(
    'TRG-2025-UNC-07',
    'SURVEY-2025-BASE-01',
    'TRX-03',
    39100,
    'STARBOARD',
    'UNKNOWN_ANOMALY',
    'Faint Peripheral Acoustic Highlight',
    0.620,
    9.24720,
    79.18780, // Far northeast peripheral margin
    53.5,
    2.8,
    1.4,
    1.2,
    'LOW',
    'Marginal confidence anomaly near outer swath turnaround limit. Ambiguous acoustic contrast.',
    '2025-08-14T10:30:10Z'
  ),
];

/**
 * Historical Survey Catalog for Repeat-Survey Comparison.
 */
export const HISTORICAL_SURVEYS: HistoricalSurvey[] = [
  {
    id: 'SURVEY-2025-BASE-01',
    code: 'SIH-26057-BASE-2025',
    name: 'Gulf of Mannar Baseline Pre-Monsoon Survey',
    date: '2025-08-14',
    vessel: 'ORV Sagar Kanya / NIOT AUV-1',
    sensor: 'EdgeTech 4200 Dual-Freq Chirp (120/410 kHz)',
    coverageBounds: {
      minLat: 9.210,
      maxLat: 9.255,
      minLng: 79.155,
      maxLng: 79.195,
    },
    targets: BASELINE_2025_TARGETS,
    provenance: 'SIMULATED',
    isBaseline: true,
  },
  {
    id: 'SURVEY-2024-RECON-01',
    code: 'SIH-26057-RECON-2024',
    name: 'Gulf of Mannar Hydrographic Reconnaissance 2024',
    date: '2024-09-12',
    vessel: 'INS Investigator / Hydrographic Survey Ship',
    sensor: 'Klein 3900 High-Resolution Side-Scan Sonar',
    coverageBounds: {
      minLat: 9.220,
      maxLat: 9.250,
      minLng: 79.165,
      maxLng: 79.190,
    },
    targets: [
      BASELINE_2025_TARGETS[0], // Net
      BASELINE_2025_TARGETS[2], // Wreckage
      BASELINE_2025_TARGETS[4], // Bedrock
    ],
    provenance: 'SIMULATED',
    isBaseline: false,
  },
];
