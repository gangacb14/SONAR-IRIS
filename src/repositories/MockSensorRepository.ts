import { ISensorRepository, RepositoryResult } from './types';
import { SensorState } from '../types/sensor';
import { INITIAL_SENSOR_STATE, simulateTelemetryStep } from '../data/mockSensors';

export class MockSensorRepository implements ISensorRepository {
  private currentTelemetry: SensorState = { ...INITIAL_SENSOR_STATE };

  async getLatestTelemetry(): Promise<RepositoryResult<SensorState>> {
    return { success: true, data: { ...this.currentTelemetry } };
  }

  subscribeTelemetry(onUpdate: (state: SensorState) => void, intervalMs: number = 600): () => void {
    const timer = setInterval(() => {
      this.currentTelemetry = simulateTelemetryStep(this.currentTelemetry);
      onUpdate({ ...this.currentTelemetry });
    }, intervalMs);

    return () => clearInterval(timer);
  }
}
