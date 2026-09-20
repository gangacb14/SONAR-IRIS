/**
 * Client-side Sonar File Ingestion & API Service
 * SIH 2026 Problem Statement 26057
 *
 * Handles file uploads via multipart/form-data to /api/sonar/upload,
 * status tracking, and sample dataset retrieval.
 */

import { FileIngestionReport } from '../../types/ingestion';
import { RawSonarPingInput } from '../../types/sonarFrame';
import { FileIngestionPipeline } from './fileIngestionPipeline';

export class FileUploadService {
  /**
   * Uploads a sonar file (.json, .csv, .geojson) to the backend API.
   * If running entirely client-side or offline, falls back to direct client-side FileIngestionPipeline execution.
   */
  public static async uploadFile(file: File): Promise<FileIngestionReport> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/sonar/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result && result.data) {
        return result.data as FileIngestionReport;
      }
      if (result && result.error) {
        throw new Error(result.error);
      }
    } catch (networkErr: any) {
      console.warn('Backend API upload unreachable, utilizing client-side fallback pipeline:', networkErr);
    }

    // Client-side fallback pipeline execution
    const content = await file.text();
    return await FileIngestionPipeline.processUploadedFile(file.name, content);
  }

  /**
   * Ingests an array of raw pings or text content directly.
   */
  public static async uploadRawContent(
    filename: string,
    content: string | RawSonarPingInput[]
  ): Promise<FileIngestionReport> {
    try {
      const response = await fetch('/api/sonar/upload-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Array.isArray(content)
            ? { filename, pings: content }
            : { filename, content }
        ),
      });

      const result = await response.json();
      if (result && result.data) {
        return result.data as FileIngestionReport;
      }
      if (result && result.error) {
        throw new Error(result.error);
      }
    } catch (networkErr: any) {
      console.warn('Backend API upload-raw unreachable, executing client fallback:', networkErr);
    }

    const payload = Array.isArray(content) ? JSON.stringify(content) : content;
    return await FileIngestionPipeline.processUploadedFile(filename, payload);
  }

  /**
   * Downloads a realistic hydrographic sample file from the backend API.
   */
  public static async fetchSampleFile(format: 'json' | 'csv' | 'geojson'): Promise<{ filename: string; content: string }> {
    try {
      const response = await fetch(`/api/sonar/samples/${format}`);
      if (response.ok) {
        const text = await response.text();
        return {
          filename: `sample_sonar_transect.${format}`,
          content: text,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch sample from API:', err);
    }

    // Fallback sample generation
    return {
      filename: `sample_sonar_transect.${format}`,
      content: format === 'csv'
        ? 'surveyId,transectId,pingNumber,timestamp,channel,sampleCount,rangeMeters,altitudeMeters,depthMeters,headingDeg,latitude,longitude,speedKts,frequencyKhz\nSRV-2026-GOM-01,TRX-01,42300,2026-09-08T12:00:00Z,DUAL,512,75,14.5,28.5,42.5,9.24350,79.18420,3.4,410'
        : '[]',
    };
  }
}
