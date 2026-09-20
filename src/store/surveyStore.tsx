import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Target, DebrisCategory, VerificationStatus } from '../types/target';
import { Survey, SurveyTransect, SurveyReport } from '../types/survey';
import { SensorState } from '../types/sensor';
import { AuditEvent } from '../types/audit';
import { 
  NormalizedSonarFrame, 
  ProcessingStatus, 
  SonarQualityReport, 
  PreprocessingConfig,
  RawSonarPingInput 
} from '../types/sonarFrame';
import { surveyRepository, targetRepository, sensorRepository } from '../repositories';
import { defaultSonarIngestionService, SonarIngestionService, SonarPreprocessingPipeline } from '../services/sonar';
import { SonarFileParser } from '../services/sonar/fileParser';
import { FileIngestionPipeline } from '../services/sonar/fileIngestionPipeline';
import { 
  InferenceResult, 
  CandidateDetection, 
  InferencePipeline, 
  OnnxInferenceEngine,
  ModelRuntimeInfo,
  TargetConverter 
} from '../services/ai';
import { RiskAssessment, RiskLevel, RiskSummaryCounts, SurveyRiskContext } from '../types/risk';
import { RiskAssessmentEngine } from '../services/risk/RiskAssessmentEngine';
import { 
  GeospatialIntelligenceResult, 
  Hotspot, 
  GeoIntFilterType 
} from '../types/geoint';
import { GeoIntelligenceEngine } from '../services/geoint/GeoIntelligenceEngine';
import { MOCK_SURVEY_INFRASTRUCTURE } from '../data/mockInfrastructure';
import { ToastMessage } from '../components/NotificationToast';
import { 
  HistoricalSurvey, 
  SurveyComparison, 
  TemporalChangeType, 
  ChangeArea, 
  TemporalTargetChange 
} from '../types/temporal';
import { HISTORICAL_SURVEYS } from '../data/mockHistoricalSurveys';
import { TemporalChangeEngine } from '../services/temporal/TemporalChangeEngine';
import { 
  FollowUpRecommendation, 
  FollowUpRecommendationResult, 
  FollowUpMissionSummary, 
  FollowUpUrgency, 
  RecommendationType, 
  FollowUpFilterType, 
  FollowUpOperatorOverride 
} from '../types/followUp';
import { FollowUpRecommendationEngine } from '../services/followUp/FollowUpRecommendationEngine';
import { DataSource, DatasetProvenance } from '../types/ingestion';
import { MOCK_TARGETS } from '../data/mockTargets';
import { 
  INDIAN_SURVEY_REGIONS, 
  IndianSurveyRegion, 
  getSurveyRegionById 
} from '../data/indianSurveyRegions';

export type AppMode = 'DEMO_REPLAY' | 'LIVE_FEED' | 'PAUSED';

export interface BackendStorageInfo {
  storageMode: 'POSTGRESQL_POSTGIS' | 'DEVELOPMENT_FALLBACK';
  connected: boolean;
  database: string;
  postgisAvailable: boolean;
  postgisVersion: string | null;
  targetCount: number;
  recommendationCount: number;
  auditCount: number;
  lastChecked?: string;
}

interface SurveyStoreContextType {
  // Indian Waters Survey Regions
  activeRegionId: string;
  activeRegion: IndianSurveyRegion;
  availableRegions: IndianSurveyRegion[];
  switchSurveyRegion: (regionId: string) => void;

  // Data Source & Provenance Isolation
  dataSource: DataSource;
  datasetProvenance: DatasetProvenance;
  resetToDemo: () => Promise<void>;

  // Survey & Mission
  survey: Survey;
  transects: SurveyTransect[];

  // Targets (Single Source of Truth)
  targets: Target[];
  activeTargetId: string | null;
  activeTarget: Target | null;

  // Telemetry & Hardware Simulation
  telemetry: SensorState;
  appMode: AppMode;
  isPlaying: boolean;
  frequencyKhz: number;

  // Sonar Ingestion & Preprocessing State
  currentSonarFrame: NormalizedSonarFrame | null;
  sonarFramesHistory: NormalizedSonarFrame[];
  sonarProcessingStatus: ProcessingStatus;
  sonarProcessingError: string | null;
  sonarQuality: SonarQualityReport | null;
  lastValidFrameId: string | null;
  playbackSpeed: number;

  // AI Sonar Detection & Anomaly Intelligence Layer
  latestInferenceResult: InferenceResult | null;
  activeCandidateDetections: CandidateDetection[];
  aiEngineStatus: 'READY' | 'PROCESSING' | 'DEGRADED' | 'UNAVAILABLE';
  modelRuntimeInfo: ModelRuntimeInfo;
  lastInferenceDurationMs: number;
  triggerInference: (frame?: NormalizedSonarFrame) => Promise<InferenceResult | null>;

  // Display Calibration Controls (Bound to Preprocessing Pipeline)
  gain: number;
  tvg: number;
  contrast: number;
  isSlantRangeCorrected: boolean;

  // Audit Events
  auditTrail: AuditEvent[];
  activeTargetAuditTrail: AuditEvent[];
  addAuditEvent: (eventData: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;

  // Toast Notifications
  toasts: ToastMessage[];
  addToast: (type: 'SUCCESS' | 'WARNING' | 'INFO', title: string, message?: string) => void;
  dismissToast: (id: string) => void;

  // Actions
  selectTarget: (id: string | null) => void;
  updateTarget: (id: string, changes: Partial<Target>) => Promise<boolean>;
  confirmTarget: (id: string, notes?: string) => Promise<boolean>;
  rejectTarget: (id: string, notes?: string) => Promise<boolean>;
  reclassifyTarget: (id: string, classification: DebrisCategory, notes?: string) => Promise<boolean>;
  markTargetUnknown: (id: string, notes?: string) => Promise<boolean>;
  addOperatorNote: (id: string, note: string) => Promise<boolean>;
  overrideTargetRisk: (id: string, operatorRiskLevel: RiskLevel, reason: string) => Promise<boolean>;
  acknowledgeTargetRisk: (id: string, notes?: string) => Promise<boolean>;
  riskSummary: RiskSummaryCounts;

  // Geospatial Intelligence & Hazard Hotspot Analysis
  geointResult: GeospatialIntelligenceResult;
  selectedHotspotId: string | null;
  selectedHotspot: Hotspot | null;
  activeTargetHotspot: Hotspot | null;
  selectHotspot: (id: string | null) => void;
  geointFilter: GeoIntFilterType;
  setGeointFilter: (filter: GeoIntFilterType) => void;

  // Repeat-Survey Temporal Change Detection Layer
  historicalSurveys: HistoricalSurvey[];
  selectedHistoricalSurveyId: string | null;
  selectHistoricalSurvey: (id: string | null) => void;
  surveyComparison: SurveyComparison | null;
  temporalFilter: TemporalChangeType | 'ALL';
  setTemporalFilter: (filter: TemporalChangeType | 'ALL') => void;
  selectedChangeAreaId: string | null;
  selectedChangeArea: ChangeArea | null;
  selectChangeArea: (id: string | null) => void;
  activeTargetTemporalChange: TemporalTargetChange | null;

  // AI Follow-Up Survey Recommendation & Mission Prioritization
  followUpResult: FollowUpRecommendationResult;
  followUpRecommendations: FollowUpRecommendation[];
  followUpSummary: FollowUpMissionSummary;
  selectedRecommendationId: string | null;
  selectedRecommendation: FollowUpRecommendation | null;
  activeTargetRecommendation: FollowUpRecommendation | null;
  followUpFilter: FollowUpFilterType;
  setFollowUpFilter: (filter: FollowUpFilterType) => void;
  selectRecommendation: (id: string | null) => void;
  acknowledgeRecommendation: (id: string, operatorNote?: string, operatorId?: string) => Promise<boolean>;
  overrideRecommendation: (
    id: string,
    override: {
      priorityScore?: number;
      urgency?: FollowUpUrgency;
      recommendationType?: RecommendationType;
      reason: string;
    },
    operatorId?: string
  ) => Promise<boolean>;

  // Controls & Preprocessing Calibration
  setAppMode: (mode: AppMode) => void;
  togglePlay: () => void;
  setFrequencyKhz: (freq: number) => void;
  toggleFrequency: () => void;
  setGain: (gain: number) => void;
  setTvg: (tvg: number) => void;
  setContrast: (contrast: number) => void;
  setSlantRangeCorrected: (enabled: boolean) => void;

  // Replay Engine Controls
  stepNextPing: () => void;
  stepPrevPing: () => void;
  stopReplay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  reprocessCurrentFrame: () => void;
  ingestCustomPing: (raw: RawSonarPingInput) => void;

  // Report Generator
  generateReport: () => SurveyReport;

  // Backend Storage & PostGIS Telemetry
  storageInfo: BackendStorageInfo;
  refreshStorageInfo: () => Promise<void>;
  reloadTargets: () => Promise<void>;
  ingestTargetsFromCsv: (csvContent: string, filename?: string) => Promise<{ count: number; targets: Target[] }>;
  logVideoTarget: (targetData: Partial<Target>) => Promise<Target>;
}

const SurveyStoreContext = createContext<SurveyStoreContextType | null>(null);

export const SurveyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Service instance ref
  const ingestionServiceRef = useRef<SonarIngestionService>(defaultSonarIngestionService);

  // Survey & Targets State
  const [survey, setSurvey] = useState<Survey>({
    id: 'MIS-2026-INDO-04B',
    code: 'TRX-04B',
    name: 'Gulf of Mannar Seabed Debris & Anomaly Assessment',
    locationName: 'Gulf of Mannar - Sector Charlie (Shipping Fairway Buffer)',
    crs: 'WGS84 / UTM Zone 44N (EPSG:32644)',
    sonarEquipment: 'EdgeTech 4200-MP Chirp Side-Scan (120/410 kHz Dual)',
    operatingFrequency: '410 kHz High-Res Pulse Mode',
    surveyVessel: 'ORV Sagar Nidhi / AUV HUGIN 6000',
    vehicleType: 'Subsea Autonomous Underwater Vehicle (AUV)',
    chiefHydrographer: 'Cmdr. R. V. Kulkarni / Dr. S. Ananth (NIOT)',
    date: '2026-09-07',
    totalAreaSqKm: 4.86,
    totalPings: 84210,
    totalDetections: 8,
    pendingReviews: 3,
    swathRangePerChannelM: 75,
  });

  const [activeRegionId, setActiveRegionId] = useState<string>('gulf-of-mannar');
  const activeRegion = useMemo(() => getSurveyRegionById(activeRegionId), [activeRegionId]);
  const availableRegions = INDIAN_SURVEY_REGIONS;

  const [transects, setTransects] = useState<SurveyTransect[]>(INDIAN_SURVEY_REGIONS[0].transects);
  const [targets, setTargets] = useState<Target[]>(INDIAN_SURVEY_REGIONS[0].targets);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(INDIAN_SURVEY_REGIONS[0].targets[0]?.id || null);
  const [telemetry, setTelemetry] = useState<SensorState>({
    timestamp: new Date().toISOString(),
    pingId: 42040,
    lat: 9.24158,
    lng: 79.18244,
    altitude: 14.6,
    depth: 28.4,
    speedKnots: 3.4,
    headingDeg: 42.5,
    pitchDeg: 0,
    rollDeg: 0,
    soundVelocity: 1514.8,
    transducerTempC: 18.4,
    frequencyKhz: 410,
    snr: 28.4,
  });

  const [appMode, setAppMode] = useState<AppMode>('DEMO_REPLAY');
  const [dataSource, setDataSource] = useState<DataSource>('DEMO');
  const [datasetProvenance, setDatasetProvenance] = useState<DatasetProvenance>({
    dataSource: 'DEMO',
    sourceFilename: 'mockTargets.ts (Gulf of Mannar Demo)',
    ingestionTimestamp: new Date().toISOString(),
    totalRecordsParsed: 8,
    validTargetsCount: 8,
    rejectedRowsCount: 0,
    boundingBox: {
      minLat: 9.2365,
      maxLat: 9.2465,
      minLng: 79.1784,
      maxLng: 79.1865,
    },
    crs: 'WGS84 / UTM Zone 44N (EPSG:32644)',
  });
  const [frequencyKhz, setFrequencyKhz] = useState<number>(410);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Preprocessing Parameters (Driven by Waterfall Controls)
  const [gain, setGainState] = useState<number>(1.1);
  const [tvg, setTvgState] = useState<number>(1.3);
  const [contrast, setContrastState] = useState<number>(1.2);
  const [isSlantRangeCorrected, setSlantRangeCorrectedState] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);

  // Sonar Ingestion & Preprocessed Frame State
  const [currentSonarFrame, setCurrentSonarFrame] = useState<NormalizedSonarFrame | null>(null);
  const [sonarFramesHistory, setSonarFramesHistory] = useState<NormalizedSonarFrame[]>([]);
  const [sonarProcessingStatus, setSonarProcessingStatus] = useState<ProcessingStatus>('READY');
  const [sonarProcessingError, setSonarProcessingError] = useState<string | null>(null);
  const [sonarQuality, setSonarQuality] = useState<SonarQualityReport | null>(null);
  const [lastValidFrameId, setLastValidFrameId] = useState<string | null>(null);

  // AI Sonar Detection & Anomaly Intelligence State
  const aiPipelineRef = useRef<InferencePipeline>(new InferencePipeline(new OnnxInferenceEngine()));
  const [latestInferenceResult, setLatestInferenceResult] = useState<InferenceResult | null>(null);
  const [activeCandidateDetections, setActiveCandidateDetections] = useState<CandidateDetection[]>([]);
  const [aiEngineStatus, setAiEngineStatus] = useState<'READY' | 'PROCESSING' | 'DEGRADED' | 'UNAVAILABLE'>('READY');
  const [lastInferenceDurationMs, setLastInferenceDurationMs] = useState<number>(18.5);
  const [modelRuntimeInfo, setModelRuntimeInfo] = useState<ModelRuntimeInfo>(() => {
    const engine = aiPipelineRef.current.getEngine();
    return engine.getRuntimeInfo ? engine.getRuntimeInfo() : {
      status: 'FALLBACK_SIMULATED',
      modelPath: 'None configured (awaiting model artifact)',
      modelVersion: 'onnx-trt-edge-v2.4',
      hardwareBackend: 'CPU (Deterministic Fallback Engine)',
      isRealOnnxLoaded: false,
      lastInferenceMs: 18.5,
    };
  });

  // Backend Storage Status (PostgreSQL + PostGIS vs Resilient Fallback)
  const [storageInfo, setStorageInfo] = useState<BackendStorageInfo>({
    storageMode: 'DEVELOPMENT_FALLBACK',
    connected: false,
    database: 'sonar_geoint_db',
    postgisAvailable: false,
    postgisVersion: null,
    targetCount: 8,
    recommendationCount: 5,
    auditCount: 8,
  });

  const refreshStorageInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setStorageInfo(json.data);
        }
      }
    } catch {
      // offline / client-only
    }
  }, []);

  const reloadTargets = useCallback(async () => {
    const targetsRes = await targetRepository.getTargets();
    if (targetsRes.success && targetsRes.data) {
      targetsRef.current = targetsRes.data;
      const maxId = targetsRes.data.reduce((max, t) => {
        const match = t.id.match(/(?:TRG-26057-|TRG-|T-|TRG-IMPORT-|TRG-VIDEO-)(\d+)/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      maxTargetSeqRef.current = Math.max(maxTargetSeqRef.current, maxId, targetsRes.data.length);
      setTargets(targetsRes.data);
    }
  }, []);

  useEffect(() => {
    refreshStorageInfo();
    const interval = setInterval(refreshStorageInfo, 10000);
    return () => clearInterval(interval);
  }, [refreshStorageInfo]);

  // Initialize inference engine on startup
  useEffect(() => {
    let isMounted = true;
    const initEngine = async () => {
      try {
        const engine = aiPipelineRef.current.getEngine();
        await engine.initialize();
        if (isMounted && engine.getRuntimeInfo) {
          setModelRuntimeInfo(engine.getRuntimeInfo());
        }
      } catch (err) {
        console.warn('Inference engine initialization exception:', err);
      }
    };
    initEngine();
    return () => {
      isMounted = false;
    };
  }, []);

  // References to decouple state setters and avoid re-render feedback loops
  const currentSonarFrameRef = useRef<NormalizedSonarFrame | null>(null);
  const targetsRef = useRef<Target[]>([]);
  const maxTargetSeqRef = useRef<number>(8);
  const surveyIdRef = useRef<string>(survey.id);
  const isInferringRef = useRef<boolean>(false);
  const preprocessingParamsRef = useRef<PreprocessingConfig>({
    gain: 1.1,
    tvg: 1.3,
    contrast: 1.2,
    isSlantRangeCorrected: false,
    noiseFilterThreshold: 0.04,
  });

  useEffect(() => {
    surveyIdRef.current = survey.id;
  }, [survey.id]);

  useEffect(() => {
    preprocessingParamsRef.current = {
      gain,
      tvg,
      contrast,
      isSlantRangeCorrected,
      noiseFilterThreshold: 0.04,
    };
  }, [gain, tvg, contrast, isSlantRangeCorrected]);

  const addToast = useCallback((type: 'SUCCESS' | 'WARNING' | 'INFO', title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
    };
    setToasts((prev) => [...prev.slice(-3), newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Switch active Indian survey region and update all targets, transects, coordinates, and survey metadata
  const switchSurveyRegion = useCallback((regionId: string) => {
    const region = getSurveyRegionById(regionId);
    setActiveRegionId(region.id);
    setSurvey(region.survey);
    surveyIdRef.current = region.survey.id;
    setTransects(region.transects);
    setTargets(region.targets);
    targetsRef.current = region.targets;

    const maxId = region.targets.reduce((max, t) => {
      const match = t.id.match(/(?:TRG-26057-|TRG-|T-|TRG-IMPORT-|TRG-VIDEO-)(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    maxTargetSeqRef.current = Math.max(maxId, region.targets.length);

    if (region.targets.length > 0) {
      setActiveTargetId(region.targets[0].id);
    } else {
      setActiveTargetId(null);
    }

    setTelemetry(region.initialTelemetry);
    setDataSource('DEMO');
    setDatasetProvenance({
      dataSource: 'DEMO',
      sourceFilename: `${region.name.replace(/\s+/g, '_')}_Acoustic_Survey.csv`,
      ingestionTimestamp: new Date().toISOString(),
      totalRecordsParsed: region.targets.length,
      validTargetsCount: region.targets.length,
      rejectedRowsCount: 0,
      boundingBox: {
        minLat: region.centerLat - 0.05,
        maxLat: region.centerLat + 0.05,
        minLng: region.centerLng - 0.05,
        maxLng: region.centerLng + 0.05,
      },
      crs: `${region.survey.crs} [DEMO / SIMULATED GEOREFERENCING]`,
    });

    addToast(
      'INFO',
      `Survey Location: ${region.name}`,
      `Loaded ${region.targets.length} targets. Sonar and coordinates updated.`
    );

    // Record REGION_CHANGED Audit Event
    const regionAudit: AuditEvent = {
      id: `AUD-REGION-${Date.now()}`,
      targetId: region.id,
      timestamp: new Date().toISOString(),
      actionType: 'REGION_CHANGED',
      title: `SURVEY REGION SWITCHED: ${region.name}`,
      previousValue: activeRegionId,
      newValue: region.id,
      operator: 'WATCH_STANDER',
      description: `Survey location switched to ${region.name} (${region.waterBody}). Hydrographic coordinate reference: ${region.survey.crs}. Loaded ${region.targets.length} targets.`,
      metadata: {
        regionId: region.id,
        regionName: region.name,
        waterBody: region.waterBody,
        targetCount: region.targets.length,
        centerLat: region.centerLat,
        centerLng: region.centerLng,
      },
    };
    setAuditTrail((prev) => [regionAudit, ...prev]);
  }, [activeRegionId, addToast]);

  // Preprocessing config helper
  const getPreprocessingConfig = useCallback((): PreprocessingConfig => {
    return preprocessingParamsRef.current;
  }, []);

  // Synchronize telemetry from normalized frame metadata
  const syncTelemetryFromFrame = useCallback((frame: NormalizedSonarFrame) => {
    setTelemetry((prev) => ({
      ...prev,
      pingId: frame.pingNumber,
      lat: frame.latitude,
      lng: frame.longitude,
      altitude: frame.altitudeMeters,
      depth: frame.depthMeters,
      headingDeg: frame.headingDeg,
      pitchDeg: frame.pitchDeg,
      rollDeg: frame.rollDeg,
      speedKnots: frame.speedKts,
      timestamp: frame.timestamp,
      frequencyKhz: frame.frequencyKhz,
    }));
  }, []);

  // Trigger AI Inference on processed acoustic frame
  const triggerInference = useCallback(
    async (frameToInfer?: NormalizedSonarFrame): Promise<InferenceResult | null> => {
      const frame = frameToInfer || currentSonarFrameRef.current;
      if (!frame) return null;

      // Prevent overlapping concurrent inference runs
      if (isInferringRef.current) return null;
      isInferringRef.current = true;

      try {
        setAiEngineStatus('PROCESSING');
        const pipelineResult = await aiPipelineRef.current.processFrame(frame);
        setLatestInferenceResult(pipelineResult.inferenceResult);
        setActiveCandidateDetections(pipelineResult.acceptedCandidates);
        setLastInferenceDurationMs(pipelineResult.inferenceResult.processingTimeMs);
        const engine = aiPipelineRef.current.getEngine();
        if (engine.getRuntimeInfo) {
          setModelRuntimeInfo(engine.getRuntimeInfo());
        }

        if (pipelineResult.inferenceResult.qualityGate === 'INFERENCE_SKIPPED') {
          setAiEngineStatus('DEGRADED');
          return pipelineResult.inferenceResult;
        }

        setAiEngineStatus('READY');

        // Check for new candidate anomaly conversion to canonical Target outside of setState
        const existingTargets = targetsRef.current;
        const newTargetsToPersist: Target[] = [];
        const existingMaxId = existingTargets.reduce((max, t) => {
          const match = t.id.match(/(?:TRG-26057-|TRG-|T-|TRG-IMPORT-|TRG-VIDEO-)(\d+)/i);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);

        for (const candidate of pipelineResult.acceptedCandidates) {
          const alreadyExists =
            existingTargets.some((t) => {
              if (candidate.trackId && t.operatorNotes?.includes(candidate.trackId)) {
                return true;
              }
              const dLat = Math.abs(t.latitude - candidate.latitude);
              const dLng = Math.abs(t.longitude - candidate.longitude);
              return (dLat < 0.00015 && dLng < 0.00015) || t.pingNumber === candidate.pingNumber;
            }) ||
            newTargetsToPersist.some((t) => {
              if (candidate.trackId && t.operatorNotes?.includes(candidate.trackId)) {
                return true;
              }
              const dLat = Math.abs(t.latitude - candidate.latitude);
              const dLng = Math.abs(t.longitude - candidate.longitude);
              return (dLat < 0.00015 && dLng < 0.00015) || t.pingNumber === candidate.pingNumber;
            });

          if (!alreadyExists) {
            // Find next strictly unique sequence number across all known targets
            let candidateSeq = Math.max(maxTargetSeqRef.current, existingMaxId, existingTargets.length) + 1;
            let candidateId = `TRG-${String(candidateSeq).padStart(2, '0')}`;
            while (
              existingTargets.some((t) => t.id === candidateId) ||
              newTargetsToPersist.some((t) => t.id === candidateId)
            ) {
              candidateSeq += 1;
              candidateId = `TRG-${String(candidateSeq).padStart(2, '0')}`;
            }
            maxTargetSeqRef.current = candidateSeq;

            const newTarget = TargetConverter.toTarget(
              candidate,
              surveyIdRef.current,
              'TRX-01',
              candidateSeq
            );
            newTargetsToPersist.push(newTarget);
          }
        }

        if (newTargetsToPersist.length > 0) {
          // Immediately synchronize targetsRef.current to avoid race conditions with subsequent frames
          targetsRef.current = [...targetsRef.current, ...newTargetsToPersist];

          const newAudits: AuditEvent[] = [];
          for (const newTarget of newTargetsToPersist) {
            const res = await targetRepository.createTarget(newTarget, 'AI-DETECTION-AGENT');
            if (res.success && res.data) {
              newAudits.push(res.data.audit);
            }
          }

          setTargets((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const uniqueToAdd = newTargetsToPersist.filter((t) => !existingIds.has(t.id));
            if (uniqueToAdd.length === 0) return prev;
            return [...prev, ...uniqueToAdd];
          });
          if (newAudits.length > 0) {
            setAuditTrail((prev) => [...newAudits, ...prev]);
          }

          const firstTarget = newTargetsToPersist[0];
          addToast(
            'INFO',
            `AI Anomaly Detected: ${firstTarget.id}`,
            `${firstTarget.categoryLabel} (${Math.round(firstTarget.confidence * 100)}% conf) • PENDING_REVIEW`
          );
        }

        return pipelineResult.inferenceResult;
      } catch (err) {
        console.error('Inference execution error:', err);
        setAiEngineStatus('DEGRADED');
        return null;
      } finally {
        isInferringRef.current = false;
      }
    },
    [addToast]
  );

  // Process and update active frame
  const processAndSetCurrentFrame = useCallback(() => {
    const config = preprocessingParamsRef.current;
    const frame = ingestionServiceRef.current.getCurrentProcessedFrame(config);

    currentSonarFrameRef.current = frame;
    setCurrentSonarFrame(frame);
    setSonarProcessingStatus(frame.processingStatus);
    setSonarProcessingError(frame.processingError || null);
    setSonarQuality(frame.quality);
    if (frame.lastValidFrameId) {
      setLastValidFrameId(frame.lastValidFrameId);
    }
    setSonarFramesHistory(ingestionServiceRef.current.getFrameHistory());
    syncTelemetryFromFrame(frame);

    // Run AI anomaly detection pipeline
    triggerInference(frame);
  }, [syncTelemetryFromFrame, triggerInference]);

  // Initial Load from Repositories & Sonar Ingestion Initialization
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const surveyRes = await surveyRepository.getSurvey('MIS-2026-INDO-04B');
      if (surveyRes.success && surveyRes.data && isMounted) {
        setSurvey(surveyRes.data);
      }

      const transectRes = await surveyRepository.getTransects('MIS-2026-INDO-04B');
      if (transectRes.success && transectRes.data && isMounted) {
        setTransects(transectRes.data);
      }

      const targetsRes = await targetRepository.getTargets();
      if (targetsRes.success && targetsRes.data && isMounted) {
        targetsRef.current = targetsRes.data;
        const maxId = targetsRes.data.reduce((max, t) => {
          const match = t.id.match(/TRG-26057-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        maxTargetSeqRef.current = Math.max(maxTargetSeqRef.current, maxId, targetsRes.data.length);
        setTargets(targetsRes.data);
      }

      // Initialize initial sonar frame
      if (isMounted) {
        processAndSetCurrentFrame();
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [processAndSetCurrentFrame]);

  const isInitialCalibrationMountedRef = useRef(false);
  // Re-process current frame whenever Gain, TVG, Contrast or Slant-Range is adjusted
  useEffect(() => {
    if (!isInitialCalibrationMountedRef.current) {
      isInitialCalibrationMountedRef.current = true;
      return;
    }
    processAndSetCurrentFrame();
  }, [gain, tvg, contrast, isSlantRangeCorrected, processAndSetCurrentFrame]);

  // Sequential Ping Replay Engine Timer
  useEffect(() => {
    if (appMode !== 'DEMO_REPLAY') return;

    // Standard interval scaled by playbackSpeed (e.g. 600ms / speed)
    const intervalMs = Math.max(50, Math.round(550 / playbackSpeed));

    const timer = setInterval(() => {
      ingestionServiceRef.current.stepNext();
      processAndSetCurrentFrame();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [appMode, playbackSpeed, processAndSetCurrentFrame]);

  // Replay Controls
  const stepNextPing = useCallback(() => {
    ingestionServiceRef.current.stepNext();
    processAndSetCurrentFrame();
  }, [processAndSetCurrentFrame]);

  const stepPrevPing = useCallback(() => {
    ingestionServiceRef.current.stepPrev();
    processAndSetCurrentFrame();
  }, [processAndSetCurrentFrame]);

  const stopReplay = useCallback(() => {
    ingestionServiceRef.current.resetToStart();
    setAppMode('PAUSED');
    processAndSetCurrentFrame();
  }, [processAndSetCurrentFrame]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    addToast('INFO', `Playback Speed: ${speed}x`, `Replay engine pacing adjusted`);
  }, [addToast]);

  const reprocessCurrentFrame = useCallback(() => {
    processAndSetCurrentFrame();
  }, [processAndSetCurrentFrame]);

  const ingestCustomPing = useCallback((raw: RawSonarPingInput) => {
    const config = getPreprocessingConfig();
    const frame = ingestionServiceRef.current.ingestExternalPing(raw, config);
    setCurrentSonarFrame(frame);
    setSonarProcessingStatus(frame.processingStatus);
    setSonarProcessingError(frame.processingError || null);
    setSonarQuality(frame.quality);
    syncTelemetryFromFrame(frame);

    if (frame.processingStatus === 'DEGRADED') {
      addToast('WARNING', 'Sonar Processing Degraded', frame.processingError || 'Acoustic anomaly in raw ping');
    } else {
      addToast('SUCCESS', `Ping #${frame.pingNumber} Ingested`, 'Frame normalized & preprocessed');
    }
  }, [getPreprocessingConfig, syncTelemetryFromFrame, addToast]);

  // Preprocessing display parameter setters
  const setGain = useCallback((newGain: number) => {
    setGainState(newGain);
  }, []);

  const setTvg = useCallback((newTvg: number) => {
    setTvgState(newTvg);
  }, []);

  const setContrast = useCallback((newContrast: number) => {
    setContrastState(newContrast);
  }, []);

  const setSlantRangeCorrected = useCallback((enabled: boolean) => {
    setSlantRangeCorrectedState(enabled);
  }, []);

  // Decision-support Survey Context for Risk Prioritization
  const surveyRiskContext = useMemo<SurveyRiskContext>(() => ({
    surveyId: survey.id,
    isDemoReplay: appMode === 'DEMO_REPLAY' && dataSource === 'DEMO',
    knownInfrastructure: MOCK_SURVEY_INFRASTRUCTURE,
  }), [survey.id, appMode, dataSource]);

  // Derived assessed targets with deterministic risk scoring & priority ranking
  const assessedTargets = useMemo(() => {
    // Strictly deduplicate by ID to guarantee unique keys across React renders
    const seenIds = new Set<string>();
    const deduplicatedTargets = targets.filter((t) => {
      if (!t.id || seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });
    return RiskAssessmentEngine.assessAndRankTargets(deduplicatedTargets, surveyRiskContext);
  }, [targets, surveyRiskContext]);

  // Sync targetsRef with assessedTargets for inference deduplication
  useEffect(() => {
    targetsRef.current = assessedTargets;
    const maxId = assessedTargets.reduce((max, t) => {
      const match = t.id.match(/(?:TRG-26057-|TRG-|T-|TRG-IMPORT-|TRG-VIDEO-)(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    if (maxId > maxTargetSeqRef.current) {
      maxTargetSeqRef.current = maxId;
    }
  }, [assessedTargets]);

  // Derived active target (with full risk assessment attached)
  const activeTarget = useMemo(() => {
    if (!activeTargetId) return assessedTargets[0] || null;
    return assessedTargets.find((t) => t.id === activeTargetId) || assessedTargets[0] || null;
  }, [assessedTargets, activeTargetId]);

  // Derived risk summary statistics
  const riskSummary = useMemo<RiskSummaryCounts>(() => {
    let critical = 0;
    let high = 0;
    let moderate = 0;
    let low = 0;
    for (const t of assessedTargets) {
      const level = t.riskAssessment?.operatorRiskLevel || t.riskAssessment?.riskLevel || 'LOW';
      if (level === 'CRITICAL') critical++;
      else if (level === 'HIGH') high++;
      else if (level === 'MODERATE') moderate++;
      else low++;
    }
    return {
      critical,
      high,
      moderate,
      low,
      totalAssessed: assessedTargets.length,
    };
  }, [assessedTargets]);

  // Derived Geospatial Intelligence & Hazard Hotspot Analysis
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [geointFilter, setGeointFilter] = useState<GeoIntFilterType>('ALL');

  const geointResult = useMemo<GeospatialIntelligenceResult>(() => {
    return GeoIntelligenceEngine.analyzeTargets(assessedTargets, surveyRiskContext);
  }, [assessedTargets, surveyRiskContext]);

  const selectedHotspot = useMemo(() => {
    if (!selectedHotspotId) return null;
    return geointResult.hotspots.find((h) => h.id === selectedHotspotId) || null;
  }, [geointResult.hotspots, selectedHotspotId]);

  const activeTargetHotspot = useMemo(() => {
    if (!activeTargetId) return null;
    return geointResult.hotspots.find((h) => h.targetIds.includes(activeTargetId)) || null;
  }, [geointResult.hotspots, activeTargetId]);

  const selectHotspot = useCallback((id: string | null) => {
    setSelectedHotspotId(id);
  }, []);

  // Repeat-Survey Temporal Change Detection State
  const [historicalSurveys] = useState<HistoricalSurvey[]>(HISTORICAL_SURVEYS);
  const [selectedHistoricalSurveyId, setSelectedHistoricalSurveyId] = useState<string | null>(
    HISTORICAL_SURVEYS[0]?.id || null
  );
  const [temporalFilter, setTemporalFilter] = useState<TemporalChangeType | 'ALL'>('ALL');
  const [selectedChangeAreaId, setSelectedChangeAreaId] = useState<string | null>(null);

  const selectedHistoricalSurvey = useMemo(() => {
    return historicalSurveys.find((s) => s.id === selectedHistoricalSurveyId) || historicalSurveys[0] || null;
  }, [historicalSurveys, selectedHistoricalSurveyId]);

  const surveyComparison = useMemo<SurveyComparison | null>(() => {
    if (!selectedHistoricalSurvey) return null;
    return TemporalChangeEngine.compareSurveys(
      selectedHistoricalSurvey,
      survey.id,
      survey.name,
      '2026-09-07',
      assessedTargets,
      transects,
      surveyRiskContext
    );
  }, [selectedHistoricalSurvey, survey.id, survey.name, assessedTargets, transects, surveyRiskContext]);

  const selectedChangeArea = useMemo(() => {
    if (!selectedChangeAreaId || !surveyComparison) return null;
    return surveyComparison.changedAreas.find((a) => a.id === selectedChangeAreaId) || null;
  }, [surveyComparison, selectedChangeAreaId]);

  const activeTargetTemporalChange = useMemo(() => {
    if (!activeTargetId || !surveyComparison) return null;
    return surveyComparison.allChanges.find((c) => c.targetId === activeTargetId) || null;
  }, [surveyComparison, activeTargetId]);

  const selectHistoricalSurvey = useCallback((id: string | null) => {
    setSelectedHistoricalSurveyId(id);
    setSelectedChangeAreaId(null);
  }, []);

  const selectChangeArea = useCallback((id: string | null) => {
    setSelectedChangeAreaId(id);
  }, []);

  // Follow-Up Recommendations State
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilterType>('ALL');
  const [operatorOverrides, setOperatorOverrides] = useState<Map<string, FollowUpOperatorOverride>>(new Map());
  const [operatorAcknowledgements, setOperatorAcknowledgements] = useState<
    Map<string, { acknowledgedAt: string; acknowledgedBy: string; operatorNote?: string }>
  >(new Map());

  // Raw recommendations generated by FollowUpRecommendationEngine
  const rawFollowUpResult = useMemo<FollowUpRecommendationResult>(() => {
    return FollowUpRecommendationEngine.generateRecommendations(
      assessedTargets,
      geointResult.hotspots,
      surveyComparison,
      surveyRiskContext
    );
  }, [assessedTargets, geointResult.hotspots, surveyComparison, surveyRiskContext]);

  // Merge operator overrides & acknowledgements with deterministic baseline
  const followUpResult = useMemo<FollowUpRecommendationResult>(() => {
    return FollowUpRecommendationEngine.applyOperatorModifications(
      rawFollowUpResult,
      operatorOverrides,
      operatorAcknowledgements
    );
  }, [rawFollowUpResult, operatorOverrides, operatorAcknowledgements]);

  // Sync recommendations to backend persistence
  useEffect(() => {
    if (followUpResult.recommendations.length > 0) {
      fetch('/api/recommendations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: followUpResult.recommendations }),
      }).catch(() => {});
    }
  }, [followUpResult.recommendations]);

  const selectedRecommendation = useMemo(() => {
    if (!selectedRecommendationId) return null;
    return followUpResult.recommendations.find((r) => r.id === selectedRecommendationId) || null;
  }, [followUpResult.recommendations, selectedRecommendationId]);

  const activeTargetRecommendation = useMemo(() => {
    if (!activeTargetId) return null;
    return followUpResult.recommendations.find((r) => r.targetIds.includes(activeTargetId)) || null;
  }, [followUpResult.recommendations, activeTargetId]);

  // Synchronize selection: Recommendation -> Target -> Hotspot
  const selectRecommendation = useCallback((id: string | null) => {
    setSelectedRecommendationId(id);
    if (id) {
      const rec = followUpResult.recommendations.find((r) => r.id === id);
      if (rec) {
        if (rec.hotspotId) {
          setSelectedHotspotId(rec.hotspotId);
        }
        if (rec.targetIds.length > 0) {
          setActiveTargetId(rec.targetIds[0]);
        }
      }
    }
  }, [followUpResult.recommendations]);

  // Operator Acknowledgement handler
  const acknowledgeRecommendation = useCallback(
    async (id: string, operatorNote?: string, operatorId: string = survey.chiefHydrographer): Promise<boolean> => {
      const rec = followUpResult.recommendations.find((r) => r.id === id);
      if (!rec) return false;

      const now = new Date().toISOString();
      setOperatorAcknowledgements((prev) => {
        const next = new Map(prev);
        next.set(id, {
          acknowledgedAt: now,
          acknowledgedBy: operatorId,
          operatorNote,
        });
        return next;
      });

      // Create single audit event for explicit operator action
      const targetId = rec.targetIds[0] || rec.id;
      const audit: AuditEvent = {
        id: `AUD-FOL-ACK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        targetId,
        timestamp: now,
        actionType: 'FOLLOW_UP_RECOMMENDATION_ACKNOWLEDGED',
        title: 'Follow-Up Survey Recommendation Acknowledged',
        previousValue: 'UNACKNOWLEDGED',
        newValue: 'ACKNOWLEDGED',
        operator: operatorId,
        description: `Operator acknowledged mission recommendation ${rec.id} (${rec.recommendationType}) - Urgency: ${rec.urgency}. ${operatorNote ? `Note: "${operatorNote}"` : ''}`,
        metadata: {
          recommendationId: rec.id,
          hotspotId: rec.hotspotId,
          targetIds: rec.targetIds,
          urgency: rec.urgency,
          recommendationType: rec.recommendationType,
          operatorNote,
        },
      };
      setAuditTrail((prev) => [audit, ...prev]);
      addToast('INFO', 'Recommendation Acknowledged', `Mission recommendation ${rec.id} logged.`);

      // Sync acknowledgement with backend API
      try {
        fetch(`/api/recommendations/${id}/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorNote, operatorId }),
        }).catch(() => {});
      } catch {}

      return true;
    },
    [followUpResult.recommendations, survey.chiefHydrographer, addToast]
  );

  // Operator Override handler
  const overrideRecommendation = useCallback(
    async (
      id: string,
      override: {
        priorityScore?: number;
        urgency?: FollowUpUrgency;
        recommendationType?: RecommendationType;
        reason: string;
      },
      operatorId: string = survey.chiefHydrographer
    ): Promise<boolean> => {
      const rec = followUpResult.recommendations.find((r) => r.id === id);
      if (!rec) return false;

      const now = new Date().toISOString();
      const newOverride: FollowUpOperatorOverride = {
        priorityScore: override.priorityScore,
        urgency: override.urgency,
        recommendationType: override.recommendationType,
        reason: override.reason,
        overriddenBy: operatorId,
        overriddenAt: now,
      };

      setOperatorOverrides((prev) => {
        const next = new Map(prev);
        next.set(id, newOverride);
        return next;
      });

      // Create single audit event for explicit operator action
      const targetId = rec.targetIds[0] || rec.id;
      const audit: AuditEvent = {
        id: `AUD-FOL-OVR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        targetId,
        timestamp: now,
        actionType: 'FOLLOW_UP_RECOMMENDATION_OVERRIDDEN',
        title: 'Follow-Up Recommendation Priority Overridden',
        previousValue: `${rec.urgency} | ${rec.recommendationType}`,
        newValue: `${override.urgency || rec.urgency} | ${override.recommendationType || rec.recommendationType}`,
        operator: operatorId,
        description: `Operator adjusted recommendation ${rec.id}: Type -> ${override.recommendationType || rec.recommendationType}, Urgency -> ${override.urgency || rec.urgency}. Justification: "${override.reason}"`,
        metadata: {
          recommendationId: rec.id,
          previousUrgency: rec.urgency,
          newUrgency: override.urgency,
          previousType: rec.recommendationType,
          newType: override.recommendationType,
          reason: override.reason,
        },
      };
      setAuditTrail((prev) => [audit, ...prev]);
      addToast('SUCCESS', 'Recommendation Overridden', `Mission priority adjusted for ${rec.id}.`);

      // Sync override with backend API
      try {
        fetch(`/api/recommendations/${id}/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...override, operatorId }),
        }).catch(() => {});
      } catch {}

      return true;
    },
    [followUpResult.recommendations, survey.chiefHydrographer, addToast]
  );

  // Derived audit events for the active target
  const activeTargetAuditTrail = useMemo(() => {
    if (!activeTargetId) return [];
    return auditTrail.filter((a) => a.targetId === activeTargetId);
  }, [auditTrail, activeTargetId]);

  // General addAuditEvent helper for recording timestamped operator actions
  const addAuditEvent = useCallback((eventData: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
    const newEvent: AuditEvent = {
      id: eventData.id || `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: eventData.timestamp || new Date().toISOString(),
      targetId: eventData.targetId || 'SYSTEM',
      actionType: eventData.actionType,
      title: eventData.title,
      previousValue: eventData.previousValue,
      newValue: eventData.newValue,
      operator: eventData.operator || survey.chiefHydrographer || 'HYDRO-OP-1',
      description: eventData.description,
      metadata: eventData.metadata,
    };
    setAuditTrail((prev) => [newEvent, ...prev]);
  }, [survey.chiefHydrographer]);

  // Select target
  const selectTarget = useCallback((id: string | null) => {
    setActiveTargetId(id);
    if (id) {
      const target = targetsRef.current.find((t) => t.id === id);
      const auditEvt: AuditEvent = {
        id: `AUD-SEL-${Date.now()}`,
        targetId: id,
        timestamp: new Date().toISOString(),
        actionType: 'TARGET_SELECTED',
        title: `TARGET SELECTED: ${id}`,
        operator: survey.chiefHydrographer || 'HYDRO-OP-1',
        description: `Target ${id} (${target?.categoryLabel || 'Debris'}) inspected on sonar / optical console.`,
        metadata: { targetId: id, category: target?.classification, confidence: target?.confidence },
      };
      setAuditTrail((prev) => [auditEvt, ...prev]);
    }
  }, [survey.chiefHydrographer]);

  // Confirm target
  const confirmTarget = useCallback(
    async (id: string, notes?: string): Promise<boolean> => {
      const res = await targetRepository.confirmTarget(id, notes, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Operation Failed', res.error || 'Unable to confirm target');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast(
        'SUCCESS',
        `Target ${id} Confirmed Debris`,
        `Verification status updated to CONFIRMED_DEBRIS`
      );
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Reject target
  const rejectTarget = useCallback(
    async (id: string, notes?: string): Promise<boolean> => {
      const res = await targetRepository.rejectTarget(id, notes, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Operation Failed', res.error || 'Unable to update target');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast(
        'INFO',
        `Target ${id} Marked False Alarm`,
        `Verification status changed to FALSE_POSITIVE`
      );
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Reclassify target
  const reclassifyTarget = useCallback(
    async (id: string, classification: DebrisCategory, notes?: string): Promise<boolean> => {
      const res = await targetRepository.reclassifyTarget(id, classification, notes, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Reclassification Failed', res.error || 'Invalid classification');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast('SUCCESS', `Target ${id} Reclassified`, `Category changed to ${target.categoryLabel}`);
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Mark target unknown / geological
  const markTargetUnknown = useCallback(
    async (id: string, notes?: string): Promise<boolean> => {
      const res = await targetRepository.markTargetUnknown(id, notes, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Operation Failed', res.error || 'Unable to update target');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast(
        'INFO',
        `Target ${id} Flagged Geological`,
        `Classified as natural seabed anomaly`
      );
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Add operator note
  const addOperatorNote = useCallback(
    async (id: string, note: string): Promise<boolean> => {
      const res = await targetRepository.addOperatorNote(id, note, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Save Note Failed', res.error || 'Unable to save observation note');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast('SUCCESS', `Target ${id} Note Recorded`, 'Observation saved to cruise survey register.');
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Override target risk priority
  const overrideTargetRisk = useCallback(
    async (id: string, operatorRiskLevel: RiskLevel, reason: string): Promise<boolean> => {
      const res = await targetRepository.overrideTargetRisk(
        id,
        operatorRiskLevel,
        reason,
        survey.chiefHydrographer
      );
      if (!res.success || !res.data) {
        addToast('WARNING', 'Risk Override Failed', res.error || 'Unable to override target risk');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast(
        'SUCCESS',
        `Target ${id} Risk Overridden`,
        `Priority level manually set to ${operatorRiskLevel}`
      );
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Acknowledge target risk assessment
  const acknowledgeTargetRisk = useCallback(
    async (id: string, notes?: string): Promise<boolean> => {
      const res = await targetRepository.acknowledgeTargetRisk(
        id,
        notes,
        survey.chiefHydrographer
      );
      if (!res.success || !res.data) {
        addToast('WARNING', 'Acknowledge Failed', res.error || 'Unable to acknowledge risk');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast(
        'INFO',
        `Target ${id} Risk Acknowledged`,
        'Logged in survey cruise register.'
      );
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Generic target update with validation
  const updateTarget = useCallback(
    async (id: string, changes: Partial<Target>): Promise<boolean> => {
      const res = await targetRepository.updateTarget(id, changes, survey.chiefHydrographer);
      if (!res.success || !res.data) {
        addToast('WARNING', 'Validation Error', res.error || 'Invalid target update payload');
        return false;
      }

      const { target, audit } = res.data;
      setTargets((prev) => prev.map((t) => (t.id === id ? target : t)));
      setAuditTrail((prev) => [audit, ...prev]);

      addToast('SUCCESS', `Target ${id} Updated`, 'Changes saved successfully.');
      return true;
    },
    [survey.chiefHydrographer, addToast]
  );

  // Toggle Stream play/pause
  const togglePlay = useCallback(() => {
    setAppMode((prev) => (prev === 'PAUSED' ? 'DEMO_REPLAY' : 'PAUSED'));
  }, []);

  // Toggle Transducer Frequency
  const toggleFrequency = useCallback(() => {
    const nextFreq = frequencyKhz === 410 ? 120 : 410;
    setFrequencyKhz(nextFreq);
    addToast(
      'INFO',
      `Sonar Frequency: ${nextFreq} kHz`,
      nextFreq === 410 ? 'Switched to High-Resolution Chirp mode' : 'Switched to Long-Range Pulse mode'
    );
  }, [frequencyKhz, addToast]);

  // Dynamic survey report calculation from centralized targets
  const generateReport = useCallback((): SurveyReport => {
    const criticalHazardsCount = targets.filter((t) => t.severity === 'CRITICAL').length;
    const highPriorityCount = targets.filter((t) => t.severity === 'HIGH').length;
    const confirmedDebrisCount = targets.filter((t) => t.verificationStatus === 'CONFIRMED_DEBRIS').length;
    const geologicalAnomaliesCount = targets.filter((t) => t.verificationStatus === 'GEOLOGICAL_ANOMALY').length;
    const falsePositivesCount = targets.filter((t) => t.verificationStatus === 'FALSE_POSITIVE').length;
    const pendingReviewsCount = targets.filter((t) => t.verificationStatus === 'PENDING_REVIEW').length;

    return {
      summary: {
        surveyId: survey.id,
        surveyCode: survey.code,
        generatedAt: new Date().toISOString(),
        chiefHydrographer: survey.chiefHydrographer,
        ihoStandard: 'IHO S-44 Order 1A',
        totalTargets: targets.length,
        criticalHazardsCount,
        highPriorityCount,
        confirmedDebrisCount,
        geologicalAnomaliesCount,
        falsePositivesCount,
        pendingReviewsCount,
        totalAreaSqKm: survey.totalAreaSqKm,
        swathWidthMeters: survey.swathRangePerChannelM * 2,
      },
      survey,
      targets,
      transects,
      recommendations: [
        'Deploy ROV with hydraulic grabber on confirmed derelict fishing gear prior to seasonal fishery migration.',
        'Promulgate Navigational Warning (NAVAREA / NOTAM) for confirmed critical ordnance/munitions anomalies.',
        'Submit salvage coordination punch-list to local maritime administration for containerized chemical drums.',
      ],
    };
  }, [survey, targets, transects]);

  // Ingest targets from user-uploaded CSV file
  const ingestTargetsFromCsv = useCallback(
    async (csvContent: string, filename: string = 'uploaded_targets.csv'): Promise<{ count: number; targets: Target[] }> => {
      try {
        const parseResult = SonarFileParser.parseFile(filename, csvContent);
        let extracted = parseResult.detectedTargets ? [...parseResult.detectedTargets] : [];

        // If no pre-parsed targets found but raw pings are present, run the full pipeline to detect anomalies
        if (extracted.length === 0 && parseResult.validPings.length > 0) {
          const report = await FileIngestionPipeline.processUploadedFile(filename, csvContent);
          extracted = report.detectedTargets || [];
        }

        // If raw pings exist, normalize and display the first ping in the waterfall view immediately
        if (parseResult.validPings.length > 0) {
          try {
            const firstPing = parseResult.validPings[0];
            const normalized = SonarPreprocessingPipeline.processFrame(firstPing, {
              gain: 1.0,
              tvg: 1.2,
              contrast: 1.0,
              isSlantRangeCorrected: true,
              noiseFilterThreshold: 0.02,
            });
            setCurrentSonarFrame(normalized);
          } catch {
            // graceful non-blocking frame update
          }
        }

        if (extracted.length === 0) {
          const reason = parseResult.rejectedRecords.length > 0
            ? `CSV validation rejected all rows: ${parseResult.rejectedRecords[0].reason} (Row ${parseResult.rejectedRecords[0].recordIndex})`
            : 'The CSV did not contain recognizable target records or valid coordinates (Latitude/Longitude).';
          addToast('WARNING', 'CSV Ingestion Failed', reason);
          throw new Error(reason);
        }

        // 1. Replace targets in backend repository
        if (targetRepository.replaceTargets) {
          await targetRepository.replaceTargets(extracted, 'CSV_OPERATOR_IMPORT');
        }

        // 2. Compute Bounding Box & Centroid from imported targets
        let minLat = Infinity;
        let maxLat = -Infinity;
        let minLng = Infinity;
        let maxLng = -Infinity;
        let sumLat = 0;
        let sumLng = 0;

        for (const t of extracted) {
          if (t.latitude < minLat) minLat = t.latitude;
          if (t.latitude > maxLat) maxLat = t.latitude;
          if (t.longitude < minLng) minLng = t.longitude;
          if (t.longitude > maxLng) maxLng = t.longitude;
          sumLat += t.latitude;
          sumLng += t.longitude;
        }

        const centerLat = sumLat / extracted.length;
        const centerLng = sumLng / extracted.length;

        const latSpanM = (maxLat - minLat) * 111320;
        const lngSpanM = (maxLng - minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
        const areaSqKm = Math.max(0.1, Math.round(((latSpanM * lngSpanM) / 1000000) * 100) / 100);

        // 3. Update Survey Context with imported dataset info
        setSurvey((prev) => ({
          ...prev,
          name: `CSV Ingest: ${filename}`,
          locationName: `Imported Survey Extent (${extracted.length} Targets) [${minLat.toFixed(4)}°N, ${minLng.toFixed(4)}°E]`,
          totalDetections: extracted.length,
          pendingReviews: extracted.filter((t) => t.verificationStatus === 'PENDING_REVIEW').length,
          totalAreaSqKm: areaSqKm || prev.totalAreaSqKm,
        }));

        // 4. Update synthetic transect covering the imported bounding box
        setTransects([
          {
            id: 'TRX-IMPORT-01',
            name: `Transect (Imported: ${filename})`,
            bearingDeg: 45.0,
            lengthMeters: Math.max(500, Math.round(Math.sqrt(latSpanM * latSpanM + lngSpanM * lngSpanM))),
            status: 'COMPLETED',
            startCoord: [minLng, minLat],
            endCoord: [maxLng, maxLat],
            pingStart: 1,
            pingEnd: Math.max(1000, extracted.length * 100),
            swathWidthMeters: 150,
          },
        ]);

        // 5. Center telemetry at centroid of imported targets
        setTelemetry((prev) => ({
          ...prev,
          lat: centerLat,
          lng: centerLng,
        }));

        // 6. Pause demo replay loop so synthetic frames do not overwrite/inject into imported data
        setAppMode('PAUSED');

        // 7. Strictly REPLACE active targets with the imported targets (DO NOT APPEND!)
        targetsRef.current = extracted;
        setTargets(extracted);
        setDataSource('CSV_IMPORT');

        // 8. Select first imported target
        if (extracted[0]) {
          setActiveTargetId(extracted[0].id);
        }

        // 9. Record full dataset provenance
        const provenance: DatasetProvenance = {
          dataSource: 'CSV_IMPORT',
          sourceFilename: filename,
          ingestionTimestamp: new Date().toISOString(),
          totalRecordsParsed: parseResult.totalRecordsFound,
          validTargetsCount: extracted.length,
          rejectedRowsCount: parseResult.rejectedRecords.length,
          boundingBox: { minLat, maxLat, minLng, maxLng },
          crs: 'WGS84 (EPSG:4326)',
        };
        setDatasetProvenance(provenance);

        // 10. Record Ingestion Audit Event
        const auditEvt: AuditEvent = {
          id: `AUD-CSV-IMPORT-${Date.now()}`,
          targetId: extracted[0]?.id || 'SYSTEM',
          timestamp: new Date().toISOString(),
          actionType: 'CSV_UPLOADED',
          title: `CSV DATASET ACTIVATED: ${filename}`,
          previousValue: 'DEMO_DATASET',
          newValue: `CSV_IMPORT (${extracted.length} targets)`,
          operator: 'OPERATOR_INGEST',
          description: `Active dataset replaced with ${extracted.length} imported targets from ${filename}. Bounding box: [${minLat.toFixed(5)}, ${minLng.toFixed(5)}] to [${maxLat.toFixed(5)}, ${maxLng.toFixed(5)}]. ${parseResult.rejectedRecords.length} rows rejected.`,
          metadata: {
            filename,
            totalRows: parseResult.totalRecordsFound,
            importedCount: extracted.length,
            rejectedCount: parseResult.rejectedRecords.length,
          },
        };
        setAuditTrail((prev) => [auditEvt, ...prev]);

        addToast(
          'SUCCESS',
          `CSV Dataset Activated: ${extracted.length} Targets`,
          `Replaced active dataset with ${extracted.length} targets from ${filename}. ${parseResult.rejectedRecords.length > 0 ? `(${parseResult.rejectedRecords.length} rows rejected)` : ''}`
        );

        refreshStorageInfo();
        return { count: extracted.length, targets: extracted };
      } catch (err: any) {
        addToast('WARNING', 'CSV Ingestion Failed', err?.message || 'Failed to parse target CSV.');
        throw err;
      }
    },
    [addToast, refreshStorageInfo]
  );

  // Reset active dataset back to Gulf of Mannar baseline demo replay
  const resetToDemo = useCallback(async () => {
    if (targetRepository.resetToDemo) {
      await targetRepository.resetToDemo();
    }
    const demoSurveyRes = await surveyRepository.getSurvey('MIS-2026-INDO-04B');
    if (demoSurveyRes.success && demoSurveyRes.data) {
      setSurvey(demoSurveyRes.data);
    }
    const demoTransectRes = await surveyRepository.getTransects('MIS-2026-INDO-04B');
    if (demoTransectRes.success && demoTransectRes.data) {
      setTransects(demoTransectRes.data);
    }
    targetsRef.current = [...MOCK_TARGETS];
    setTargets([...MOCK_TARGETS]);
    setActiveTargetId('TRG-26057-01');
    setDataSource('DEMO');
    setAppMode('DEMO_REPLAY');
    setTelemetry({
      timestamp: new Date().toISOString(),
      pingId: 42040,
      lat: 9.24158,
      lng: 79.18244,
      altitude: 14.6,
      depth: 28.4,
      speedKnots: 3.4,
      headingDeg: 42.5,
      pitchDeg: 0,
      rollDeg: 0,
      soundVelocity: 1514.8,
      transducerTempC: 18.4,
      frequencyKhz: 410,
      snr: 28.4,
    });
    setDatasetProvenance({
      dataSource: 'DEMO',
      sourceFilename: 'mockTargets.ts (Gulf of Mannar Demo)',
      ingestionTimestamp: new Date().toISOString(),
      totalRecordsParsed: MOCK_TARGETS.length,
      validTargetsCount: MOCK_TARGETS.length,
      rejectedRowsCount: 0,
      boundingBox: {
        minLat: 9.2365,
        maxLat: 9.2465,
        minLng: 79.1784,
        maxLng: 79.1865,
      },
      crs: 'WGS84 / UTM Zone 44N (EPSG:32644)',
    });
    addToast('INFO', 'Restored Demo Dataset', 'Active dataset reset to baseline Gulf of Mannar replay data.');
    refreshStorageInfo();
  }, [addToast, refreshStorageInfo]);

  // Log a target directly from real-time video inspection
  const logVideoTarget = useCallback(
    async (targetData: Partial<Target>): Promise<Target> => {
      const seq = maxTargetSeqRef.current + 1;
      maxTargetSeqRef.current = seq;
      const targetId = targetData.id || `TRG-VID-${String(seq).padStart(2, '0')}`;
      const classification = targetData.classification || 'MARINE_DEBRIS';

      const fullTarget: Target = {
        id: targetId,
        surveyId: targetData.surveyId || survey.id,
        transectId: targetData.transectId || 'TRX-VIDEO',
        pingNumber: targetData.pingNumber || (42500 + seq * 10),
        channel: targetData.channel || 'PORT',
        classification,
        categoryLabel: targetData.categoryLabel || SonarFileParser.getCategoryLabel(classification),
        confidence: targetData.confidence ?? 0.89,
        latitude: targetData.latitude ?? (9.2435 + (Math.random() - 0.5) * 0.006),
        longitude: targetData.longitude ?? (79.1842 + (Math.random() - 0.5) * 0.006),
        coordinateReferenceSystem: 'WGS84 / UTM Zone 44N (EPSG:32644)',
        utmZone: '44N',
        utmEasting: 410050.2,
        utmNorthing: 1021580.4,
        depth: targetData.depth ?? 28.4,
        slantRange: targetData.slantRange ?? 32.0,
        groundRange: targetData.groundRange ?? 28.5,
        towfishAltitude: targetData.towfishAltitude ?? 14.5,
        estimatedLength: targetData.estimatedLength ?? 2.8,
        estimatedWidth: targetData.estimatedWidth ?? 1.4,
        shadowLength: targetData.shadowLength ?? 3.5,
        shadowHeight: targetData.shadowHeight ?? 1.2,
        backscatter: targetData.backscatter ?? -16.4,
        severity: targetData.severity || 'HIGH',
        verificationStatus: 'PENDING_REVIEW',
        operatorNotes: targetData.operatorNotes || 'Logged from real-time video inspection feed.',
        detectedAt: new Date().toISOString(),
        waterfallBox: {
          x: (targetData.channel || 'PORT') === 'PORT' ? 24 : 68,
          y: Math.min(80, Math.max(20, (seq * 15) % 80)),
          width: 12,
          height: 14,
        },
        transectLine: 'TRX-01',
        category: classification,
        timestamp: new Date().toISOString(),
        slantRangeMeters: targetData.slantRange ?? 32.0,
        groundRangeMeters: targetData.groundRange ?? 28.5,
        towfishAltitudeMeters: targetData.towfishAltitude ?? 14.5,
        shadowLengthMeters: targetData.shadowLength ?? 3.5,
        estimatedTargetHeightMeters: targetData.shadowHeight ?? 1.2,
        estimatedLengthMeters: targetData.estimatedLength ?? 2.8,
        estimatedWidthMeters: targetData.estimatedWidth ?? 1.4,
        backscatterDb: targetData.backscatter ?? -16.4,
        coordinates: {
          lat: targetData.latitude ?? 9.2435,
          lng: targetData.longitude ?? 79.1842,
          utmZone: '44N',
          utmEasting: 410050.2,
          utmNorthing: 1021580.4,
          depthMeters: targetData.depth ?? 28.4,
        },
        sonarEvidenceReference: {
          pingNumber: targetData.pingNumber || (42500 + seq * 10),
          channel: targetData.channel || 'PORT',
          pixelX: 120,
          pixelY: 250,
          boundingBox: { xMin: 100, yMin: 220, xMax: 160, yMax: 280 },
          acousticCutoutUrl: '',
        },
        modelMetadata: {
          modelVersion: 'VIDEO-VISION-v2.4',
          inferenceTimestamp: new Date().toISOString(),
          onnxEngineVersion: 'ONNX-v1.17',
          featureVectorSize: 512,
          executionTimeMs: 14.2,
        },
      };

      const res = await targetRepository.createTarget(fullTarget, 'VIDEO_VISION_AGENT');
      const finalTarget = res.success && res.data?.target ? res.data.target : fullTarget;

      setTargets((prev) => [finalTarget, ...prev.filter((t) => t.id !== finalTarget.id)]);
      setActiveTargetId(finalTarget.id);

      // Record VIDEO_DETECTION_LOGGED Audit Event
      const videoAudit: AuditEvent = {
        id: `AUD-VID-TRG-${Date.now()}`,
        targetId: finalTarget.id,
        timestamp: new Date().toISOString(),
        actionType: 'VIDEO_DETECTION_LOGGED',
        title: `VIDEO TARGET LOGGED: ${finalTarget.id}`,
        newValue: `${finalTarget.categoryLabel} (${(finalTarget.confidence * 100).toFixed(1)}% Conf)`,
        operator: 'VIDEO_VISION_AGENT',
        description: `Logged anomaly ${finalTarget.id} from subsea optical feed. Class: ${finalTarget.categoryLabel}, Slant Range / Distance: ${finalTarget.slantRange?.toFixed(1)}m, Severity: ${finalTarget.severity}.`,
        metadata: {
          targetId: finalTarget.id,
          classification: finalTarget.classification,
          confidence: finalTarget.confidence,
          slantRange: finalTarget.slantRange,
          severity: finalTarget.severity,
          latitude: finalTarget.latitude,
          longitude: finalTarget.longitude,
        },
      };
      setAuditTrail((prev) => [videoAudit, ...prev]);

      addToast('SUCCESS', `Target Logged: ${finalTarget.id}`, `${finalTarget.categoryLabel} logged to registry.`);
      refreshStorageInfo();
      return finalTarget;
    },
    [survey.id, addToast, refreshStorageInfo]
  );

  const value: SurveyStoreContextType = {
    activeRegionId,
    activeRegion,
    availableRegions,
    switchSurveyRegion,
    dataSource,
    datasetProvenance,
    resetToDemo,
    survey,
    transects,
    targets: assessedTargets,
    activeTargetId,
    activeTarget,
    riskSummary,
    overrideTargetRisk,
    acknowledgeTargetRisk,
    geointResult,
    selectedHotspotId,
    selectedHotspot,
    activeTargetHotspot,
    selectHotspot,
    geointFilter,
    setGeointFilter,
    historicalSurveys,
    selectedHistoricalSurveyId,
    selectHistoricalSurvey,
    surveyComparison,
    temporalFilter,
    setTemporalFilter,
    selectedChangeAreaId,
    selectedChangeArea,
    selectChangeArea,
    activeTargetTemporalChange,
    followUpResult,
    followUpRecommendations: followUpResult.recommendations,
    followUpSummary: followUpResult.summary,
    selectedRecommendationId,
    selectedRecommendation,
    activeTargetRecommendation,
    followUpFilter,
    setFollowUpFilter,
    selectRecommendation,
    acknowledgeRecommendation,
    overrideRecommendation,
    telemetry,
    appMode,
    isPlaying: appMode !== 'PAUSED',
    frequencyKhz,
    currentSonarFrame,
    sonarFramesHistory,
    sonarProcessingStatus,
    sonarProcessingError,
    sonarQuality,
    lastValidFrameId,
    playbackSpeed,
    latestInferenceResult,
    activeCandidateDetections,
    aiEngineStatus,
    modelRuntimeInfo,
    lastInferenceDurationMs,
    triggerInference,
    gain,
    tvg,
    contrast,
    isSlantRangeCorrected,
    auditTrail,
    activeTargetAuditTrail,
    addAuditEvent,
    toasts,
    addToast,
    dismissToast,
    selectTarget,
    updateTarget,
    confirmTarget,
    rejectTarget,
    reclassifyTarget,
    markTargetUnknown,
    addOperatorNote,
    setAppMode,
    togglePlay,
    setFrequencyKhz,
    toggleFrequency,
    setGain,
    setTvg,
    setContrast,
    setSlantRangeCorrected,
    stepNextPing,
    stepPrevPing,
    stopReplay,
    setPlaybackSpeed,
    reprocessCurrentFrame,
    ingestCustomPing,
    generateReport,
    storageInfo,
    refreshStorageInfo,
    reloadTargets,
    ingestTargetsFromCsv,
    logVideoTarget,
  };

  return <SurveyStoreContext.Provider value={value}>{children}</SurveyStoreContext.Provider>;
};

export const useSurveyStore = (): SurveyStoreContextType => {
  const context = useContext(SurveyStoreContext);
  if (!context) {
    throw new Error('useSurveyStore must be used within a SurveyProvider');
  }
  return context;
};
