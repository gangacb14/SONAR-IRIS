// Backward-compatible aggregator re-exporting from dedicated mock data layer
import { ACTIVE_SURVEY, MOCK_TRANSECTS } from './mockSurvey';
import { MOCK_TARGETS, CATEGORY_LABELS } from './mockTargets';
import { INITIAL_SENSOR_STATE } from './mockSensors';

export const ACTIVE_MISSION = ACTIVE_SURVEY;
export const SURVEY_TRANSECTS = MOCK_TRANSECTS;
export const INITIAL_DETECTIONS = MOCK_TARGETS;
export const INITIAL_TELEMETRY = INITIAL_SENSOR_STATE;
export { CATEGORY_LABELS };
