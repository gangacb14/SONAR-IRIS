import { ISurveyRepository, ITargetRepository, ISensorRepository } from './types';
import { MockSurveyRepository } from './MockSurveyRepository';
import { MockTargetRepository } from './MockTargetRepository';
import { MockSensorRepository } from './MockSensorRepository';
import { ApiTargetRepository } from './ApiTargetRepository';
import { ApiSurveyRepository } from './ApiSurveyRepository';

export * from './types';
export * from './MockSurveyRepository';
export * from './MockTargetRepository';
export * from './MockSensorRepository';
export * from './ApiTargetRepository';
export * from './ApiSurveyRepository';

// Single source of truth repository singletons with live API integration and resilient local fallback
export const surveyRepository: ISurveyRepository = new ApiSurveyRepository();
export const targetRepository: ITargetRepository = new ApiTargetRepository();
export const sensorRepository: ISensorRepository = new MockSensorRepository();

