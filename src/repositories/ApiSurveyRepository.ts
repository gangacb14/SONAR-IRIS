/**
 * API-Connected Survey Repository (with Local Fallback)
 * SIH 2026 Problem Statement 26057
 */

import { ISurveyRepository, RepositoryResult } from './types';
import { Survey, SurveyTransect } from '../types/survey';
import { MockSurveyRepository } from './MockSurveyRepository';

export class ApiSurveyRepository implements ISurveyRepository {
  private fallback = new MockSurveyRepository();

  private async fetchApi<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    } catch {
      return null;
    }
  }

  async getSurvey(surveyId: string): Promise<RepositoryResult<Survey>> {
    const data = await this.fetchApi<{ survey: Survey; transects: SurveyTransect[] }>(
      `/api/surveys/${encodeURIComponent(surveyId)}`
    );
    if (data && data.survey) {
      return { success: true, data: data.survey };
    }
    return this.fallback.getSurvey(surveyId);
  }

  async getTransects(surveyId: string): Promise<RepositoryResult<SurveyTransect[]>> {
    const data = await this.fetchApi<{ survey: Survey; transects: SurveyTransect[] }>(
      `/api/surveys/${encodeURIComponent(surveyId)}`
    );
    if (data && data.transects) {
      return { success: true, data: data.transects };
    }
    return this.fallback.getTransects(surveyId);
  }

  async updateSurveyMetadata(surveyId: string, changes: Partial<Survey>): Promise<RepositoryResult<Survey>> {
    return this.fallback.updateSurveyMetadata(surveyId, changes);
  }
}
