/**
 * Production ONNX Inference Service & Pipeline Verification Test Suite
 * SIH 2026 Problem Statement 26057
 * 
 * Tests:
 * 1. Model loading & fallback lifecycle (ONNX_ACTIVE vs FALLBACK_SIMULATED vs UNAVAILABLE)
 * 2. Input feature schema & validation
 * 3. Preprocessing pipeline & tensor shape [1, 2, 1024]
 * 4. Model output adapter & taxonomy mapping
 * 5. Scientific accountability & provenance tracking
 * 6. InferencePipeline integration
 */

import * as ort from 'onnxruntime-web';
import { 
  ONNXInferenceService, 
  SONAR_ONNX_FEATURE_SCHEMA 
} from '../services/ai/ONNXInferenceService';
import { OnnxInferenceEngine } from '../services/ai/OnnxInferenceEngine';
import { InferencePipeline } from '../services/ai/InferencePipeline';
import { NormalizedSonarFrame } from '../types/sonarFrame';

function createMockSonarFrame(overrides: Partial<NormalizedSonarFrame> = {}): NormalizedSonarFrame {
  const portSamples: number[] = [];
  const stbdSamples: number[] = [];
  for (let i = 0; i < 1000; i++) {
    portSamples.push(0.05 + 0.02 * Math.sin(i / 20));
    stbdSamples.push(0.05 + 0.02 * Math.cos(i / 20));
  }
  // Inject target return on port channel
  for (let i = 400; i < 440; i++) {
    portSamples[i] = 0.85;
  }
  // Shadow
  for (let i = 440; i < 480; i++) {
    portSamples[i] = 0.01;
  }

  return {
    frameId: 'FRAME-TST-101',
    surveyId: 'SURVEY-2026-CH01',
    transectId: 'TR-01',
    pingNumber: 101,
    timestamp: new Date().toISOString(),
    channel: 'DUAL',
    sampleCount: 1000,
    samplingIntervalUsec: 32,
    frequencyKhz: 450,
    rangeMeters: 50.0,
    gain: 1.1,
    tvg: 1.3,
    contrast: 1.2,
    isSlantRangeCorrected: false,
    altitudeMeters: 12.0,
    depthMeters: 48.0,
    headingDeg: 88.5,
    pitchDeg: 0.2,
    rollDeg: -0.1,
    speedKts: 3.5,
    latitude: 13.0827,
    longitude: 80.2707,
    dataOrigin: {
      acousticSamples: 'MEASURED',
      navigationCoordinates: 'MEASURED',
      altitudeDepth: 'MEASURED',
      slantRangeCorrection: 'DERIVED',
      tvgCompensation: 'DERIVED',
    },
    portRawSamples: portSamples,
    starboardRawSamples: stbdSamples,
    portProcessedSamples: portSamples,
    starboardProcessedSamples: stbdSamples,
    quality: {
      score: 92,
      status: 'GOOD',
      flags: [],
      dynamicRangeDb: 48,
      noiseFloorEstimate: 0.04,
      saturationPercentage: 0.01,
      channelCompleteness: {
        port: true,
        starboard: true,
      },
    },
    processingStatus: 'READY',
    processingTimeMs: 12.0,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testNum: number, description: string): void {
  const testId = testNum < 10 ? `0${testNum}` : `${testNum}`;
  if (condition) {
    console.log(`[PASS] Test ${testId}: ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] Test ${testId}: ${description}`);
    failed++;
  }
}

export async function runONNXInferenceTests(): Promise<void> {
  console.log('================================================================');
  console.log('SIH 2026 PS 26057: 25-POINT ONNX INFERENCE SERVICE TEST SUITE');
  console.log('================================================================');

  const nominalFrame = createMockSonarFrame();

  // Test 1: Configurable model path resolution
  const customPathService = new ONNXInferenceService({
    modelPath: '/custom/models/sonar_v2.onnx',
  });
  const info1 = customPathService.getRuntimeInfo();
  assert(
    info1.modelPath === '/custom/models/sonar_v2.onnx',
    1,
    'Configurable model path resolution respects explicit constructor configuration'
  );

  // Test 2: Graceful fallback when model artifact is absent
  const service = new ONNXInferenceService({
    modelPath: '/nonexistent/model.onnx',
    allowFallback: true,
  });
  const initSuccess = await service.initialize();
  assert(
    initSuccess === true,
    2,
    'Graceful initialization succeeds via deterministic fallback when .onnx artifact absent'
  );

  // Test 3: isReady flag is true after fallback initialization
  assert(
    service.isReady === true,
    3,
    'Service isReady state is true after initialization with fallback engine'
  );

  // Test 4: Status is strictly FALLBACK_SIMULATED when artifact absent, never falsely ONNX_ACTIVE
  const runtimeInfo = service.getRuntimeInfo();
  assert(
    runtimeInfo.status === 'FALLBACK_SIMULATED' && runtimeInfo.isRealOnnxLoaded === false,
    4,
    'Runtime status is strictly FALLBACK_SIMULATED and isRealOnnxLoaded is false when binary absent'
  );

  // Test 5: allowFallback: false sets status to UNAVAILABLE and returns false when file absent
  const strictService = new ONNXInferenceService({
    modelPath: '/nonexistent/strictly_required.onnx',
    allowFallback: false,
  });
  const strictInit = await strictService.initialize();
  const strictInfo = strictService.getRuntimeInfo();
  assert(
    strictInit === false && strictInfo.status === 'UNAVAILABLE' && strictService.isReady === false,
    5,
    'allowFallback: false transitions status to UNAVAILABLE and fails initialization safely'
  );

  // Test 6: getRuntimeInfo returns structured metadata including load error
  assert(
    typeof runtimeInfo.loadError === 'string' && runtimeInfo.loadError.length > 0,
    6,
    'getRuntimeInfo returns descriptive loadError detailing missing or unparsed model file'
  );

  // Test 7: Feature schema specifies expected shape [1, 2, 1024] with float32 datatype
  assert(
    SONAR_ONNX_FEATURE_SCHEMA.expectedShape[0] === 1 &&
    SONAR_ONNX_FEATURE_SCHEMA.expectedShape[1] === 2 &&
    SONAR_ONNX_FEATURE_SCHEMA.expectedShape[2] === 1024 &&
    SONAR_ONNX_FEATURE_SCHEMA.dataType === 'float32',
    7,
    'Feature schema specifies standard tensor dimensions [1, 2, 1024] and float32 precision'
  );

  // Test 8: Valid normalized sonar frame passes feature validation with zero issues
  const valResult = service.validateInputFeatures(nominalFrame);
  assert(
    valResult.isValid === true && valResult.issues.length === 0,
    8,
    'Valid normalized sonar frame passes feature validation without warnings or errors'
  );

  // Test 9: Null or undefined frame fails validation with descriptive issue message
  const nullVal = service.validateInputFeatures(null as any);
  assert(
    nullVal.isValid === false && nullVal.issues.some(i => i.includes('null or undefined')),
    9,
    'Null frame fails feature validation gracefully with descriptive issue notice'
  );

  // Test 10: Frame with missing port and starboard sample channels fails validation
  const emptyFrame = createMockSonarFrame({
    portProcessedSamples: [],
    portRawSamples: [],
    starboardProcessedSamples: [],
    starboardRawSamples: [],
  });
  const emptyVal = service.validateInputFeatures(emptyFrame);
  assert(
    emptyVal.isValid === false && emptyVal.issues.some(i => i.includes('empty')),
    10,
    'Frame with completely empty acoustic swath channels fails feature validation'
  );

  // Test 11: Frame with non-positive slant range fails validation
  const zeroRangeFrame = createMockSonarFrame({ rangeMeters: 0 });
  const zeroRangeVal = service.validateInputFeatures(zeroRangeFrame);
  assert(
    zeroRangeVal.isValid === false && zeroRangeVal.issues.some(i => i.includes('range')),
    11,
    'Frame with non-positive slant range fails feature validation'
  );

  // Test 12: Preprocesses nominal frame into ort.Tensor with dims [1, 2, 1024]
  const tensor = service.preprocessFrameToTensor(nominalFrame);
  assert(
    tensor instanceof ort.Tensor &&
    tensor.dims[0] === 1 &&
    tensor.dims[1] === 2 &&
    tensor.dims[2] === 1024,
    12,
    'preprocessFrameToTensor creates valid ort.Tensor with exact dimensions [1, 2, 1024]'
  );

  // Test 13: Output tensor data type is strictly float32
  assert(
    tensor.type === 'float32',
    13,
    'Output tensor data type is strictly float32 for edge model input'
  );

  // Test 14: Output tensor total element count is exactly 2048 (2 * 1024)
  const tensorBuffer = tensor.data as Float32Array;
  assert(
    tensorBuffer.length === 2048,
    14,
    'Output tensor total element count equals 2048 across dual-channel swath'
  );

  // Test 15: Normalized sample values in tensor are bounded within [0.0, 1.0]
  let allBounded = true;
  for (let i = 0; i < tensorBuffer.length; i++) {
    const val = tensorBuffer[i];
    if (val < 0.0 || val > 1.0 || isNaN(val)) {
      allBounded = false;
      break;
    }
  }
  assert(
    allBounded === true,
    15,
    'All preprocessed tensor sample values are strictly bounded within [0.0, 1.0]'
  );

  // Test 16: Missing channel samples are imputed safely with acoustic noise floor
  const missingStbdFrame = createMockSonarFrame({
    starboardProcessedSamples: [],
    starboardRawSamples: [],
  });
  const tensorMissing = service.preprocessFrameToTensor(missingStbdFrame);
  const stbdPart = (tensorMissing.data as Float32Array).slice(1024, 2048);
  const stbdImputed = stbdPart.every(v => v > 0 && v <= 0.05);
  assert(
    stbdImputed === true,
    16,
    'Missing starboard channel is imputed safely with baseline acoustic noise floor'
  );

  // Test 17: Truncates/interpolates varying input swath resolutions cleanly to 1024 bins
  const highResFrame = createMockSonarFrame({
    portProcessedSamples: new Array(2500).fill(0.42),
    starboardProcessedSamples: new Array(2500).fill(0.42),
  });
  const tensorHighRes = service.preprocessFrameToTensor(highResFrame);
  assert(
    tensorHighRes.dims[2] === 1024 && tensorHighRes.data.length === 2048,
    17,
    'Non-standard input swath array size (2500 samples) resamples cleanly to 1024 bins'
  );

  // Test 18: Adapts raw tensor output into canonical CandidateDetection[]
  const mockOutputData = new Float32Array([
    // xNorm, yNorm, wNorm, hNorm, conf, classId, channel
    0.45, 0.50, 0.08, 0.06, 0.92, 0, 0, // Ghost net on port
    0.65, 0.50, 0.05, 0.04, 0.88, 4, 1, // Drum/container on stbd
  ]);
  const mockOutputs: Record<string, ort.Tensor> = {
    output0: new ort.Tensor('float32', mockOutputData, [1, 2, 7]),
  };
  const detections = service.adaptModelOutputs(mockOutputs, nominalFrame, 18.2);
  assert(
    detections.length === 2,
    18,
    'adaptModelOutputs successfully extracts 2 candidate detections from raw tensor'
  );

  // Test 19: Bounding region coordinates are bounded within [0.0, 1.0]
  const d0 = detections[0];
  assert(
    d0.boundingRegion.xMin >= 0 && d0.boundingRegion.xMax <= 1 &&
    d0.boundingRegion.yMin >= 0 && d0.boundingRegion.yMax <= 1,
    19,
    'Bounding region normalized coordinates are strictly contained within [0.0, 1.0]'
  );

  // Test 20: Acoustic metrics (slant range, ground range, shadow length, height)
  assert(
    d0.slantRange > 0 && d0.estimatedGroundRange >= 0 && d0.estimatedHeight > 0,
    20,
    'Acoustic metrics correctly compute slant range, ground range, and target relief height'
  );

  // Test 21: Correctly maps predicted class indices to canonical SonarClassification
  assert(
    detections[0].classification === 'GHOST_NET' &&
    detections[1].classification === 'DRUM_OR_CONTAINER',
    21,
    'Model output adapter maps class index 0 to GHOST_NET and index 4 to DRUM_OR_CONTAINER'
  );

  // Test 22: Filters out candidate detections below configured confidence threshold
  const lowConfOutputData = new Float32Array([
    0.50, 0.50, 0.05, 0.05, 0.20, 1, 0, // conf 0.20 < 0.45 threshold
  ]);
  const lowConfOutputs: Record<string, ort.Tensor> = {
    output0: new ort.Tensor('float32', lowConfOutputData, [1, 1, 7]),
  };
  const lowConfDetections = service.adaptModelOutputs(lowConfOutputs, nominalFrame, 15.0);
  assert(
    lowConfDetections.length === 0,
    22,
    'Candidates with confidence score below threshold (0.20 < 0.45) are suppressed'
  );

  // Test 23: OnnxInferenceEngine successfully wraps ONNXInferenceService
  const engineWrapper = new OnnxInferenceEngine();
  const wrapperInfo = engineWrapper.getRuntimeInfo();
  assert(
    engineWrapper.engineId === 'onnx-sonar-inference-engine' &&
    wrapperInfo.status === 'FALLBACK_SIMULATED',
    23,
    'OnnxInferenceEngine delegates cleanly to ONNXInferenceService with accurate runtime info'
  );

  // Test 24: InferencePipeline integrates with OnnxInferenceEngine end-to-end
  const pipeline = new InferencePipeline(engineWrapper);
  const pipelineRes = await pipeline.processFrame(nominalFrame);
  assert(
    pipelineRes.inferenceResult.qualityGate === 'INFERENCE_ALLOWED' &&
    pipelineRes.inferenceResult.frameId === nominalFrame.frameId,
    24,
    'InferencePipeline executes complete processing cycle with OnnxInferenceEngine'
  );

  // Test 25: Scientific accountability: reports fallback mode without false claims
  assert(
    pipelineRes.inferenceResult.inferenceMode === 'SIMULATED' &&
    pipelineRes.inferenceResult.warnings.some(w => w.includes('fallback') || w.includes('ONNX')),
    25,
    'Scientific accountability tags reflect development fallback without claiming fake ONNX activation'
  );

  console.log('================================================================');
  console.log(`ONNX INFERENCE TEST RESULTS: ${passed}/${passed + failed} PASSED (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run when executed directly via tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('onnxInferenceTest')) {
  runONNXInferenceTests().catch((err) => {
    console.error('Test execution failed with unhandled exception:', err);
    process.exit(1);
  });
}
