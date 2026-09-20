import React from 'react';
import { 
  Waves, 
  MapPin, 
  ShieldAlert, 
  CheckCircle2, 
  Database, 
  Compass, 
  Cpu, 
  ArrowRight, 
  FileText, 
  AlertTriangle,
  Flame,
  Info,
  Layers,
  Radio,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { useSurveyStore } from '../../store/surveyStore';
import { INDIAN_SURVEY_REGIONS } from '../../data/indianSurveyRegions';
import { ActiveNavView } from '../NavigationRail';

interface OverviewViewProps {
  onNavigate: (view: ActiveNavView) => void;
  onOpenIngestModal?: () => void;
}

const WORKFLOW_STEPS = [
  { id: 'data', label: 'SONAR DATA', status: 'ACQUIRED', desc: 'EdgeTech Chirp / Klein' },
  { id: 'ingest', label: 'INGEST', status: 'VALIDATED', desc: 'CSV / JSON / Stream' },
  { id: 'validate', label: 'VALIDATE', status: 'PASSED', desc: 'Hydrographic Bounds' },
  { id: 'preprocess', label: 'PREPROCESS', status: 'ACTIVE', desc: 'Slant-Range / TVG / Gain' },
  { id: 'ai', label: 'AI DETECTION', status: 'INFERRED', desc: 'CNN Target Detector' },
  { id: 'classify', label: 'CLASSIFY', status: 'TAGGED', desc: '10 Debris Categories' },
  { id: 'georef', label: 'GEOREFERENCE', status: 'DEMO / SIM', desc: 'WGS84 / UTM Coords' },
  { id: 'map', label: 'MAP', status: 'PLOTTED', desc: 'GIS Swath Overlay' },
  { id: 'risk', label: 'RISK ASSESSMENT', status: 'SCORED', desc: 'Navigational & Eco Risk' },
  { id: 'mission', label: 'MISSION PRIORITY', status: 'QUEUED', desc: 'ROV / Secondary Survey' },
  { id: 'report', label: 'REPORT', status: 'READY', desc: 'IHO S-44 GeoJSON / CSV' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate, onOpenIngestModal }) => {
  const { 
    survey, 
    targets, 
    telemetry, 
    activeTarget, 
    selectTarget, 
    riskSummary,
    activeRegionId,
    switchSurveyRegion,
    aiEngineStatus,
    lastInferenceDurationMs,
  } = useSurveyStore();

  const criticalCount = targets.filter((t) => t.severity === 'CRITICAL').length;
  const highCount = targets.filter((t) => t.severity === 'HIGH').length;
  const confirmedCount = targets.filter((t) => t.verificationStatus === 'CONFIRMED_DEBRIS').length;
  const geologicalCount = targets.filter((t) => t.verificationStatus === 'GEOLOGICAL_ANOMALY').length;
  const pendingCount = targets.filter((t) => t.verificationStatus === 'PENDING_REVIEW').length;

  const currentRegion = INDIAN_SURVEY_REGIONS.find((r) => r.id === activeRegionId) || INDIAN_SURVEY_REGIONS[0];

  return (
    <div id="overview-view-container" className="flex-1 flex flex-col h-full bg-[#080d16] overflow-y-auto text-slate-100 p-4 md:p-6 select-none">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        
        {/* Top Header Banner: Problem Statement & DEMO MODE Indicator */}
        <div className="bg-[#0e141f] border border-[#1e293b] rounded-lg p-4 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2 py-0.5 bg-sky-950 border border-sky-600/70 text-sky-400 text-xs font-mono-tech font-bold rounded">
                  SONAR-IRIS
                </span>
                <span className="text-[11px] font-mono-tech text-amber-400 bg-amber-950/70 border border-amber-700/60 px-2 py-0.5 rounded font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  DEMO MODE: RECORDED / SIMULATED SONAR DATA
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">
                AI-Powered Automated Underwater Marine Debris and Anomaly Detection System
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Real-time acoustic analysis of side-scan sonar imagery for marine debris classification, 
                shadow mensuration, hazard prioritization, and follow-up hydrographic mission planning.
              </p>
            </div>

            {/* Ingest / Replay Quick Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                id="btn-overview-open-scan"
                onClick={() => onNavigate('SONAR_SCAN')}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Waves className="w-4 h-4" />
                <span>Open Sonar Scan</span>
              </button>
              {onOpenIngestModal && (
                <button
                  id="btn-overview-ingest"
                  onClick={onOpenIngestModal}
                  className="px-3 py-2 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-slate-200 rounded text-xs font-medium transition-colors"
                >
                  Ingest Dataset
                </button>
              )}
            </div>
          </div>

          {/* Demo Mode Notice Box */}
          <div className="mt-3.5 pt-3 border-t border-[#1e293b] flex items-start gap-2 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-300">Prototype Hardware Status:</strong> Physical side-scan sonar hardware is not connected in this browser session. 
              The application uses recorded and simulated sonar survey data with <span className="text-sky-300 font-mono-tech">DEMO / SIMULATED GEOREFERENCING</span>. 
              All internal telemetry, acoustic shadows, target classifications, and mission queues are internally consistent and architected for plug-and-play connection to live EdgeTech, Klein, or Kongsberg sonar feeds.
            </p>
          </div>
        </div>

        {/* Small Clean Main Workflow Indicator */}
        <div className="bg-[#0e141f] border border-[#1e293b] rounded-lg p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono-tech uppercase text-slate-400 font-bold tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              INTEGRATED OPERATIONAL WORKFLOW PIPELINE
            </span>
            <span className="text-[10px] font-mono-tech text-slate-500">
              END-TO-END AUTOMATED HYDROGRAPHIC INFERENCE
            </span>
          </div>

          {/* Horizontal responsive step trail */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-1.5">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div 
                key={step.id} 
                className="bg-[#090d14] border border-[#1e293b] rounded p-2 flex flex-col justify-between hover:border-sky-700/60 transition-colors"
              >
                <div className="flex items-center justify-between text-[9px] font-mono-tech text-slate-500 mb-1">
                  <span>{(idx + 1).toString().padStart(2, '0')}</span>
                  <span className="text-[8px] px-1 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-800/40 font-semibold">
                    {step.status}
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-200 font-mono-tech truncate">
                  {step.label}
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Survey Region Selector & Geographical Location Cards */}
        <div className="bg-[#0e141f] border border-[#1e293b] rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Active Survey Region (India &amp; Surrounding Waters)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any coastal or marine survey zone to instantly update the entire application dataset, targets, coordinates, and telemetry.
              </p>
            </div>

            <div className="text-[11px] font-mono-tech text-slate-400 bg-[#090d14] px-2.5 py-1 rounded border border-[#1e293b]">
              CURRENT: <strong className="text-sky-300">{survey.name}</strong>
            </div>
          </div>

          {/* Region Selection Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {INDIAN_SURVEY_REGIONS.map((region) => {
              const isSelected = region.id === activeRegionId;
              return (
                <button
                  key={region.id}
                  id={`btn-select-region-${region.id}`}
                  onClick={() => switchSurveyRegion(region.id)}
                  className={`p-2.5 rounded text-left transition-all border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-sky-950/70 border-sky-400 text-sky-100 ring-1 ring-sky-400'
                      : 'bg-[#090d14] border-[#1e293b] text-slate-300 hover:border-[#2c3a50] hover:bg-[#0d1422]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate">{region.name}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate mt-1">
                    {region.waterBody.split('/')[0]}
                  </span>
                  <div className="flex items-center justify-between text-[9px] font-mono-tech text-slate-400 mt-2 pt-1.5 border-t border-[#1e293b]">
                    <span>{region.targets.length} Targets</span>
                    <span className={isSelected ? 'text-sky-300' : 'text-slate-500'}>
                      {region.centerLat.toFixed(1)}°N
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Survey Region Details Strip */}
          <div className="mt-3.5 p-3 bg-[#090d14] border border-[#1e293b] rounded grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono-tech">
            <div>
              <span className="text-[9px] text-slate-500 uppercase">SURVEY ID</span>
              <p className="text-slate-200 font-semibold truncate">{survey.code}</p>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase">VESSEL / PLATFORM</span>
              <p className="text-slate-200 truncate">{survey.surveyVessel}</p>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase">SONAR SENSOR</span>
              <p className="text-sky-300 truncate">{survey.operatingFrequency}</p>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase">SURVEY AREA</span>
              <p className="text-slate-200">{survey.totalAreaSqKm} km² ({survey.totalPings.toLocaleString()} pings)</p>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase">TELEMETRY COORDS</span>
              <p className="text-slate-200 truncate">{telemetry.lat.toFixed(4)}°N, {telemetry.lng.toFixed(4)}°E</p>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase">CHIEF HYDROGRAPHER</span>
              <p className="text-slate-300 truncate">{survey.chiefHydrographer}</p>
            </div>
          </div>
        </div>

        {/* Survey Anomaly Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div 
            onClick={() => onNavigate('DETECTIONS')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-[#2c3a50] p-3.5 rounded cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>TOTAL DETECTIONS</span>
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1 font-mono-tech">
              {targets.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              100% verified in survey sector
            </div>
          </div>

          <div 
            onClick={() => onNavigate('MISSION')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-red-900/50 p-3.5 rounded cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>CRITICAL HAZARDS</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400 mt-1 font-mono-tech">
              {criticalCount}
            </div>
            <div className="text-[10px] text-red-300/80 mt-0.5">
              Prioritize ROV inspection
            </div>
          </div>

          <div 
            onClick={() => onNavigate('MISSION')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-amber-900/50 p-3.5 rounded cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>HIGH PRIORITY</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1 font-mono-tech">
              {highCount}
            </div>
            <div className="text-[10px] text-amber-300/80 mt-0.5">
              Wreckage, nets &amp; pipelines
            </div>
          </div>

          <div 
            onClick={() => onNavigate('DETECTIONS')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-emerald-900/50 p-3.5 rounded cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>CONFIRMED DEBRIS</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono-tech">
              {confirmedCount}
            </div>
            <div className="text-[10px] text-emerald-300/80 mt-0.5">
              Anthropogenic objects
            </div>
          </div>

          <div 
            onClick={() => onNavigate('DETECTIONS')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-[#2c3a50] p-3.5 rounded cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>NATURAL ANOMALIES</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono-tech">
              {geologicalCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Geological seabed features
            </div>
          </div>
        </div>

        {/* Operational Quick Jump Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Module 1: Sonar Waterfall Inspection */}
          <div 
            onClick={() => onNavigate('SONAR_SCAN')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-sky-500/70 p-4 rounded-lg cursor-pointer transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-sky-950 text-sky-400 rounded border border-sky-800/60 group-hover:scale-105 transition-transform">
                  <Waves className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono-tech text-sky-400 font-semibold flex items-center gap-1">
                  VIEW SCAN <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-sky-300 transition-colors">
                1. Sonar Waterfall
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Real-time acoustic waterfall visualization, time-varying gain, slant-range correction, and optical video inspection.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#1e293b] text-[10px] font-mono-tech text-slate-400 flex items-center justify-between">
              <span>{survey.operatingFrequency}</span>
              <span className="text-emerald-400">15 Hz Stream</span>
            </div>
          </div>

          {/* Module 2: GIS Map */}
          <div 
            onClick={() => onNavigate('MAP')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-sky-500/70 p-4 rounded-lg cursor-pointer transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-sky-950 text-sky-400 rounded border border-sky-800/60 group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono-tech text-sky-400 font-semibold flex items-center gap-1">
                  VIEW MAP <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-sky-300 transition-colors">
                2. India Waters GIS Map
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Interactive chart of India peninsular coastline, Arabian Sea, Bay of Bengal, and active survey transect corridors.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#1e293b] text-[10px] font-mono-tech text-slate-400 flex items-center justify-between">
              <span>7 Survey Regions</span>
              <span className="text-sky-400">WGS84 / UTM</span>
            </div>
          </div>

          {/* Module 3: Debris Registry */}
          <div 
            onClick={() => onNavigate('DETECTIONS')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-sky-500/70 p-4 rounded-lg cursor-pointer transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-sky-950 text-sky-400 rounded border border-sky-800/60 group-hover:scale-105 transition-transform">
                  <Database className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono-tech text-sky-400 font-semibold flex items-center gap-1">
                  REGISTRY <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-sky-300 transition-colors">
                3. Debris &amp; Anomaly Registry
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Structured catalog of detected targets with AI classification, bounding calipers, shadow height, and operator notes.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#1e293b] text-[10px] font-mono-tech text-slate-400 flex items-center justify-between">
              <span>{targets.length} Cataloged</span>
              <span className="text-amber-400">{pendingCount} Pending</span>
            </div>
          </div>

          {/* Module 4: Mission Prioritization */}
          <div 
            onClick={() => onNavigate('MISSION')}
            className="bg-[#0e141f] border border-[#1e293b] hover:border-sky-500/70 p-4 rounded-lg cursor-pointer transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 bg-sky-950 text-sky-400 rounded border border-sky-800/60 group-hover:scale-105 transition-transform">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono-tech text-sky-400 font-semibold flex items-center gap-1">
                  MISSIONS <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-sky-300 transition-colors">
                4. Mission Priority Queue
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                AI-assisted mission recommendations for ROV dive inspections, secondary sonar passes, and UXO perimeter safety.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#1e293b] text-[10px] font-mono-tech text-slate-400 flex items-center justify-between">
              <span>AI Recommendations</span>
              <span className="text-red-400">{criticalCount} Actionable</span>
            </div>
          </div>

        </div>

        {/* Selected Target Spotlight Section (if any target selected) */}
        {activeTarget && (
          <div className="bg-[#0e141f] border border-[#1e293b] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono-tech uppercase text-slate-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                CURRENTLY SELECTED ANOMALY SPOTLIGHT: <strong className="text-slate-100">{activeTarget.id}</strong>
              </span>
              <button
                onClick={() => onNavigate('SONAR_SCAN')}
                className="text-xs text-sky-400 hover:text-sky-300 underline font-mono-tech"
              >
                Inspect in Sonar Waterfall →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono-tech bg-[#090d14] p-3 rounded border border-[#1e293b]">
              <div>
                <span className="text-[9px] text-slate-500 uppercase">CLASSIFICATION</span>
                <p className="text-slate-200 font-semibold truncate">{activeTarget.categoryLabel}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase">CONFIDENCE</span>
                <p className="text-sky-400 font-bold">{(activeTarget.confidence * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase">RANGE / CHANNEL</span>
                <p className="text-slate-200">{activeTarget.slantRange.toFixed(1)}m ({activeTarget.channel})</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase">ESTIMATED HEIGHT</span>
                <p className="text-amber-400 font-bold">{activeTarget.shadowHeight.toFixed(2)}m</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase">RISK LEVEL</span>
                <p className={`font-bold ${
                  activeTarget.severity === 'CRITICAL' ? 'text-red-400' :
                  activeTarget.severity === 'HIGH' ? 'text-amber-400' : 'text-sky-400'
                }`}>
                  {activeTarget.severity}
                </p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase">RECOMMENDED ACTION</span>
                <p className="text-emerald-400 truncate">
                  {activeTarget.severity === 'CRITICAL' || activeTarget.severity === 'HIGH'
                    ? 'Prioritize ROV inspection'
                    : activeTarget.severity === 'MODERATE'
                    ? 'Schedule secondary sonar survey'
                    : 'Monitor / verify'}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
