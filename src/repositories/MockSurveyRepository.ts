import { ISurveyRepository, RepositoryResult } from './types';
import { Survey, SurveyTransect } from '../types/survey';
import { ACTIVE_SURVEY, MOCK_TRANSECTS } from '../data/mockSurvey';

export class MockSurveyRepository implements ISurveyRepository {
  private survey: Survey = { ...ACTIVE_SURVEY };
  private transects: SurveyTransect[] = [...MOCK_TRANSECTS];

  async getSurvey(surveyId: string): Promise<RepositoryResult<Survey>> {
    // Simulated async network resolution
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { success: true, data: { ...this.survey } };
  }

  async getTransects(surveyId: string): Promise<RepositoryResult<SurveyTransect[]>> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { success: true, data: [...this.transects] };
  }

  async updateSurveyMetadata(surveyId: string, changes: Partial<Survey>): Promise<RepositoryResult<Survey>> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.survey = { ...this.survey, ...changes };
    return { success: true, data: { ...this.survey } };
  }
}
