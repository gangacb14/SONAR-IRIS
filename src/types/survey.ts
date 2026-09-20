import { Target } from './target';

export interface SurveyTransect {
  id: string;
  name: string;
  bearingDeg: number;
  lengthMeters: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED';
  startCoord: [number, number]; // [lng, lat]
  endCoord: [number, number];
  pingStart: number;
  pingEnd: number;
  swathWidthMeters: number;
}

export interface Survey {
  id: string;
  code: string;
  name: string;
  locationName: string;
  crs: string;
  sonarEquipment: string;
  operatingFrequency: string;
  surveyVessel: string;
  vehicleType: string;
  chiefHydrographer: string;
  date: string;
  totalAreaSqKm: number;
  totalPings: number;
  totalDetections: number;
  pendingReviews: number;
  swathRangePerChannelM: number;
}

/**
 * Backwards compatibility alias for SurveyMission
 */
export type SurveyMission = Survey;

export interface SurveyReportSummary {
  surveyId: string;
  surveyCode: string;
  generatedAt: string;
  chiefHydrographer: string;
  ihoStandard: string;
  totalTargets: number;
  criticalHazardsCount: number;
  highPriorityCount: number;
  confirmedDebrisCount: number;
  geologicalAnomaliesCount: number;
  falsePositivesCount: number;
  pendingReviewsCount: number;
  totalAreaSqKm: number;
  swathWidthMeters: number;
}

export interface SurveyReport {
  summary: SurveyReportSummary;
  survey: Survey;
  targets: Target[];
  transects: SurveyTransect[];
  recommendations: string[];
}
