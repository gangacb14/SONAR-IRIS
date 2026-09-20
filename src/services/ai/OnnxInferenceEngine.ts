/**
 * Architecture-Ready ONNX / TensorRT Edge Inference Engine
 * SIH 2026 Problem Statement 26057
 * 
 * Powered by ONNXInferenceService with ONNX Runtime Web.
 * Gracefully delegates to MockInferenceEngine in DEMO_REPLAY when no local model
 * binary or GPU execution provider is present.
 */

import { 
  ISonarInferenceEngine, 
  InferenceResult, 
  CandidateDetection,
  ModelRuntimeInfo
} from '../../types/aiInference';
import { NormalizedSonarFrame } from '../../types/sonarFrame';
import { ONNXInferenceService, ONNXServiceConfig } from './ONNXInferenceService';

export type OnnxEngineConfig = ONNXServiceConfig;

export class OnnxInferenceEngine implements ISonarInferenceEngine {
  public readonly engineId = 'onnx-sonar-inference-engine';
  public readonly modelName = 'yolov8x-sonar-debris-quantized';
  public readonly modelVersion = 'onnx-trt-edge-v2.4';
  public readonly inferenceMode: 'ONNX' = 'ONNX';
  
  private service: ONNXInferenceService;

  constructor(config: OnnxEngineConfig = {}) {
    this.service = new ONNXInferenceService(config);
  }

  public get isReady(): boolean {
    return this.service.isReady;
  }

  public getRuntimeInfo(): ModelRuntimeInfo {
    return this.service.getRuntimeInfo();
  }

  public async initialize(): Promise<boolean> {
    return this.service.initialize();
  }

  public async infer(frame: NormalizedSonarFrame): Promise<InferenceResult> {
    return this.service.infer(frame);
  }

  public getUnderlyingService(): ONNXInferenceService {
    return this.service;
  }
}

