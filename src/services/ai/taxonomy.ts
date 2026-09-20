/**
 * Classification Taxonomy for Underwater Sonar Anomaly Analysis
 * SIH 2026 Problem Statement 26057
 */

import { SonarClassification } from '../../types/aiInference';
import { DebrisCategory, SeverityLevel } from '../../types/target';

export interface TaxonomyMeta {
  classification: SonarClassification;
  classId: number;
  label: string;
  description: string;
  defaultSeverity: SeverityLevel;
  typicalLengthMeters: [number, number]; // [min, max]
  typicalWidthMeters: [number, number];
  acousticSignature: string;
  requiresReviewReason?: string;
}

export const SONAR_TAXONOMY: Record<SonarClassification, TaxonomyMeta> = {
  GHOST_NET: {
    classification: 'GHOST_NET',
    classId: 1,
    label: 'Derelict Fishing Net / Gear',
    description: 'Entangled monofilament netting, trawl remnants, or synthetic ropes draping the seabed.',
    defaultSeverity: 'HIGH',
    typicalLengthMeters: [3.0, 35.0],
    typicalWidthMeters: [1.5, 15.0],
    acousticSignature: 'Diffuse, billowy high-frequency backscatter with fragmented, porous shadow contours.',
    requiresReviewReason: 'Entanglement risk to benthic marine life and ROV thrusters.',
  },
  MARINE_DEBRIS: {
    classification: 'MARINE_DEBRIS',
    classId: 2,
    label: 'General Anthropogenic Debris',
    description: 'Unclassified solid waste, non-metallic refuse, or discarded maritime equipment.',
    defaultSeverity: 'MODERATE',
    typicalLengthMeters: [0.8, 6.0],
    typicalWidthMeters: [0.5, 4.0],
    acousticSignature: 'Discrete localized highlight with moderate acoustic shadow.',
  },
  TIRE_CLUSTER: {
    classification: 'TIRE_CLUSTER',
    classId: 3,
    label: 'Commercial Tire Cluster',
    description: 'Group of discarded vehicle or vessel bumper tires arranged in linear or stacked clusters.',
    defaultSeverity: 'MODERATE',
    typicalLengthMeters: [1.2, 8.0],
    typicalWidthMeters: [0.8, 3.5],
    acousticSignature: 'Periodic circular/toroidal acoustic highlights with rhythmic crescent shadows.',
  },
  METAL_OBJECT: {
    classification: 'METAL_OBJECT',
    classId: 4,
    label: 'Metallic Structure / Scrap',
    description: 'Rigid metallic wreckage piece, steel plate, beam, or industrial mooring hardware.',
    defaultSeverity: 'MODERATE',
    typicalLengthMeters: [1.5, 12.0],
    typicalWidthMeters: [0.6, 5.0],
    acousticSignature: 'Very sharp high-amplitude specular highlight with dense, well-defined acoustic shadow.',
  },
  DRUM_OR_CONTAINER: {
    classification: 'DRUM_OR_CONTAINER',
    classId: 5,
    label: 'Industrial Drum / Chemical Container',
    description: '55-gallon oil/chemical drum, intermediate bulk container (IBC), or cylindrical storage vessel.',
    defaultSeverity: 'HIGH',
    typicalLengthMeters: [0.9, 2.5],
    typicalWidthMeters: [0.6, 1.8],
    acousticSignature: 'Cylindrical or rectangular high-intensity reflection with sharp, straight-edged shadow.',
    requiresReviewReason: 'Potential hazardous material containment breach risk.',
  },
  WRECKAGE: {
    classification: 'WRECKAGE',
    classId: 6,
    label: 'Vessel Wreckage / Hull Scrap',
    description: 'Sunken vessel keel, cabin structure, barge remains, or collapsed offshore framework.',
    defaultSeverity: 'HIGH',
    typicalLengthMeters: [8.0, 65.0],
    typicalWidthMeters: [3.0, 20.0],
    acousticSignature: 'Extensive complex acoustic highlights, ribs, internal compartments, and prolonged shadow.',
    requiresReviewReason: 'Major navigational obstruction and potential cultural heritage site.',
  },
  PIPELINE_OR_CABLE: {
    classification: 'PIPELINE_OR_CABLE',
    classId: 7,
    label: 'Pipeline Free-Span / Subsea Cable',
    description: 'Exposed subsea transmission cable, oil/gas pipeline free-span, or communication line.',
    defaultSeverity: 'HIGH',
    typicalLengthMeters: [15.0, 150.0],
    typicalWidthMeters: [0.3, 2.0],
    acousticSignature: 'Continuous linear feature crossing multiple swaths with parallel continuous shadow.',
    requiresReviewReason: 'Critical subsea infrastructure integrity concern.',
  },
  ROCK_OR_GEOLOGICAL: {
    classification: 'ROCK_OR_GEOLOGICAL',
    classId: 8,
    label: 'Natural Bedrock / Geological Feature',
    description: 'Natural seabed boulder, rock outcropping, sand ripple crest, or coral head.',
    defaultSeverity: 'LOW',
    typicalLengthMeters: [1.0, 25.0],
    typicalWidthMeters: [1.0, 20.0],
    acousticSignature: 'Irregular, textured highlight blending into ambient seabed with soft shadow gradient.',
  },
  POSSIBLE_UXO: {
    classification: 'POSSIBLE_UXO',
    classId: 9,
    label: 'Possible Munitions / UXO Hazard',
    description: 'Unexploded historical ordnance, naval shell, aerial bomb, or metallic projectile casing.',
    defaultSeverity: 'CRITICAL',
    typicalLengthMeters: [0.5, 3.0],
    typicalWidthMeters: [0.2, 1.2],
    acousticSignature: 'High-contrast cylindrical specular highlight with tapered conical acoustic shadow.',
    requiresReviewReason: 'Immediate explosive hazard. Mandatory standoff distance protocol.',
  },
  UNKNOWN_ANOMALY: {
    classification: 'UNKNOWN_ANOMALY',
    classId: 10,
    label: 'Unknown Acoustic Anomaly',
    description: 'Unresolved seabed anomaly displaying prominent acoustic highlight or shadow but insufficient class evidence.',
    defaultSeverity: 'MODERATE',
    typicalLengthMeters: [0.5, 30.0],
    typicalWidthMeters: [0.5, 20.0],
    acousticSignature: 'Prominent highlight/shadow pair lacking characteristic features of specific object classes.',
    requiresReviewReason: 'Strong acoustic response but insufficient class evidence; requires human hydrographer inspection.',
  },
};

/**
 * Maps SonarClassification to legacy DebrisCategory
 */
export function mapClassificationToDebrisCategory(cls: SonarClassification): DebrisCategory {
  switch (cls) {
    case 'GHOST_NET':
      return 'GHOST_NET';
    case 'DRUM_OR_CONTAINER':
      return 'METALLIC_DRUM';
    case 'MARINE_DEBRIS':
      return 'PLASTIC_AGGREGATE';
    case 'WRECKAGE':
      return 'WRECKAGE_DEBRIS';
    case 'TIRE_CLUSTER':
      return 'TIRE_CLUSTER';
    case 'PIPELINE_OR_CABLE':
      return 'PIPELINE_EXPOSURE';
    case 'POSSIBLE_UXO':
      return 'ORDNANCE_UXO';
    case 'ROCK_OR_GEOLOGICAL':
      return 'GEOLOGICAL_FEATURE';
    case 'METAL_OBJECT':
      return 'METALLIC_DRUM';
    case 'UNKNOWN_ANOMALY':
    default:
      return 'UNKNOWN_ANOMALY';
  }
}

/**
 * Maps DebrisCategory to SonarClassification
 */
export function mapDebrisCategoryToClassification(cat: DebrisCategory): SonarClassification {
  switch (cat) {
    case 'GHOST_NET':
      return 'GHOST_NET';
    case 'METALLIC_DRUM':
      return 'DRUM_OR_CONTAINER';
    case 'PLASTIC_AGGREGATE':
      return 'MARINE_DEBRIS';
    case 'WRECKAGE_DEBRIS':
      return 'WRECKAGE';
    case 'TIRE_CLUSTER':
      return 'TIRE_CLUSTER';
    case 'PIPELINE_EXPOSURE':
      return 'PIPELINE_OR_CABLE';
    case 'ORDNANCE_UXO':
      return 'POSSIBLE_UXO';
    case 'GEOLOGICAL_FEATURE':
      return 'ROCK_OR_GEOLOGICAL';
    case 'MARINE_DEBRIS':
      return 'MARINE_DEBRIS';
    case 'UNKNOWN_ANOMALY':
    default:
      return 'UNKNOWN_ANOMALY';
  }
}
