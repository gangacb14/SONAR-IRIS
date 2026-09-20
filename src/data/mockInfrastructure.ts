/**
 * Survey Context Infrastructure Data (DEMO REPLAY)
 * SIH 2026 Problem Statement 26057
 * 
 * Defines documented subsea infrastructure corridors and shipping fairways
 * in the survey operating area for contextual risk exposure assessment.
 * Note: Clearly flagged as SIMULATED / DEMO REPLAY.
 */

import { KnownInfrastructureFeature } from '../types/risk';

export const MOCK_SURVEY_INFRASTRUCTURE: KnownInfrastructureFeature[] = [
  {
    name: 'India-Sri Lanka Subsea Optical Fiber Interconnector',
    type: 'SUBSEA_CABLE',
    centerCoord: [79.178, 9.236], // [lng, lat]
    radiusMeters: 800,
  },
  {
    name: 'Gulf of Mannar Deepwater Shipping Fairway Buffer',
    type: 'SHIPPING_FAIRWAY',
    centerCoord: [79.182, 9.240],
    radiusMeters: 1400,
  },
  {
    name: 'Mandapam Coastal Petroleum Pipeline Right-of-Way',
    type: 'PIPELINE',
    centerCoord: [79.174, 9.230],
    radiusMeters: 650,
  },
  {
    name: 'Coral Reef Marine Biosphere Protection Zone',
    type: 'ECOLOGICAL_ZONE',
    centerCoord: [79.185, 9.245],
    radiusMeters: 900,
  },
];
