import React from 'react';
import { 
  Activity, 
  Compass, 
  HardDrive, 
  Radio, 
  ShieldCheck, 
  Shield,
  User, 
  Volume2, 
  Clock,
  Layers,
  AlertTriangle,
  Play,
  Pause,
  Download,
  Upload,
  Flame,
  Database
} from 'lucide-react';
import { SurveyMission, TowfishTelemetry } from '../types/sonar';
import { RiskSummaryCounts } from '../types/risk';
import { ModelRuntimeInfo } from '../types/aiInference';
import { useSurveyStore } from '../store/surveyStore';

interface TopMissionBarProps {
  mission: SurveyMission;
  telemetry: TowfishTelemetry;
  isPlaying: boolean;
  appMode?: 'DEMO_REPLAY' | 'LIVE_FEED' | 'PAUSED';
  onTogglePlay: () => void;
  onExportClick: () => void;
  onIngestClick?: () => void;
  onAuditLogsClick?: () => void;
  activeView: string;
  aiStatus?: 'READY' | 'PROCESSING' | 'DEGRADED' | 'UNAVAILABLE';
  aiLatencyMs?: number;
  riskSummary?: RiskSummaryCounts;
  modelRuntimeInfo?: ModelRuntimeInfo;
}

export const TopMissionBar: React.FC<TopMissionBarProps> = ({
  mission,
  telemetry,
  isPlaying,
  appMode = 'DEMO_REPLAY',
  onTogglePlay,
  onExportClick,
  onIngestClick,
  onAuditLogsClick,
  activeView,
  aiStatus = 'READY',
  aiLatencyMs = 18.5,
  riskSummary,
  modelRuntimeInfo,
}) => {
  const { 
    storageInfo, 
    dataSource, 
    datasetProvenance, 
    resetToDemo, 
    targets,
    activeRegionId,
    availableRegions,
    switchSurveyRegion,
    auditTrail,
  } = useSurveyStore();

  return (
    <header 
      id="top-mission-bar" 
      className="bg-[#090d14] border-b border-[#1e293b] text-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 select-none z-30"
    >
      {/* Platform & Survey Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-[#1e293b]">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Acoustic Processing Core Active" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wider text-sky-400 uppercase">
                SONAR-IRIS
              </span>
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              {mission.code}
            </span>
          </div>
        </div>

        {/* Survey Region Quick-Selector & Vessel */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono-tech uppercase text-slate-400">SURVEY REGION:</span>
              <select
                id="select-active-survey-region"
                value={activeRegionId}
                onChange={(e) => switchSurveyRegion(e.target.value)}
                className="bg-[#0e141f] border border-[#2c3a50] text-sky-300 text-xs font-medium rounded px-2 py-0.5 outline-none cursor-pointer hover:border-sky-500 transition-colors max-w-[210px] truncate"
                title="Switch active hydrographic survey dataset"
              >
                {availableRegions.map((reg) => (
                  <option key={reg.id} value={reg.id} className="bg-[#0e141f] text-slate-200">
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400 truncate max-w-[260px] mt-0.5">
              {mission.surveyVessel} • {mission.operatingFrequency}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Real-time Towfish Telemetry & Sensor Readings */}
      <div className="flex items-center gap-4 bg-[#0e141f] border border-[#1e293b] px-3 py-1 rounded">
        {/* Positioning */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#1e293b]">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase font-mono-tech">HDG / SPD</span>
            <span className="text-[11px] font-mono-tech font-medium text-slate-100">
              {telemetry.headingDeg.toFixed(1)}° • {telemetry.speedKnots.toFixed(1)} kts
            </span>
          </div>
        </div>

        {/* Altitude & Depth */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#1e293b]">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase font-mono-tech">ALTITUDE (SEABED)</span>
            <span className="text-[11px] font-mono-tech font-medium text-sky-300">
              {telemetry.altitude.toFixed(1)} m
            </span>
          </div>
          <div className="flex flex-col pl-2 border-l border-[#1e293b]">
            <span className="text-[9px] text-slate-400 uppercase font-mono-tech">DEPTH (SURF)</span>
            <span className="text-[11px] font-mono-tech font-medium text-slate-200">
              {telemetry.depth.toFixed(1)} m
            </span>
          </div>
        </div>

        {/* Position Coordinates */}
        <div className="hidden xl:flex flex-col pr-3 border-r border-[#1e293b]">
          <span className="text-[9px] text-slate-400 uppercase font-mono-tech">COORDINATES (WGS84)</span>
          <span className="text-[11px] font-mono-tech text-slate-200">
            {telemetry.lat.toFixed(5)}°N, {telemetry.lng.toFixed(5)}°E
          </span>
        </div>

        {/* Attitude Pitch & Roll */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase font-mono-tech">PITCH / ROLL</span>
            <span className="text-[11px] font-mono-tech text-slate-300">
              {telemetry.pitchDeg > 0 ? `+${telemetry.pitchDeg.toFixed(1)}` : telemetry.pitchDeg.toFixed(1)}° / {telemetry.rollDeg > 0 ? `+${telemetry.rollDeg.toFixed(1)}` : telemetry.rollDeg.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Sound Velocity Profile */}
        <div className="hidden 2xl:flex flex-col pl-2 border-l border-[#1e293b]">
          <span className="text-[9px] text-slate-400 uppercase font-mono-tech">SVP / TEMP</span>
          <span className="text-[11px] font-mono-tech text-emerald-400">
            {telemetry.soundVelocity.toFixed(1)} m/s • {telemetry.transducerTempC}°C
          </span>
        </div>
      </div>

      {/* Right: Operational Status, Stream Controller & Actions */}
      <div className="flex items-center gap-3">
        {/* Stream Playback Toggle & Replay Mode Tag */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-toggle-stream"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-tech font-medium transition-colors border ${
              isPlaying 
                ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300 hover:bg-emerald-900/60' 
                : 'bg-amber-950/60 border-amber-700/70 text-amber-300 hover:bg-amber-900/60'
            }`}
            title={isPlaying ? 'Pause acoustic waterfall acquisition' : 'Resume acoustic stream'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>{appMode === 'DEMO_REPLAY' ? 'DEMO REPLAY (15Hz)' : 'LIVE FEED'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>STREAM PAUSED</span>
              </>
            )}
          </button>
          
          {dataSource === 'CSV_IMPORT' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onIngestClick}
                className="px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/70 rounded text-[10px] font-mono-tech text-cyan-300 font-semibold flex items-center gap-1.5 hover:bg-cyan-900/80 transition-colors"
                title={`Active Source of Truth: CSV IMPORT\nFile: ${datasetProvenance.sourceFilename || 'CSV'}\nValid Targets: ${datasetProvenance.validTargetsCount} | Rejected Rows: ${datasetProvenance.rejectedRowsCount}\nIngested: ${new Date(datasetProvenance.ingestionTimestamp).toLocaleTimeString()}\nClick to view Ingestion Pipeline.`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="max-w-[140px] truncate">CSV: {datasetProvenance.sourceFilename || 'IMPORTED'} ({datasetProvenance.validTargetsCount || targets.length} TGTs)</span>
              </button>
              <button
                type="button"
                onClick={resetToDemo}
                className="px-1.5 py-0.5 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] rounded text-[10px] font-mono-tech text-amber-400 hover:text-amber-300 transition-colors"
                title="Restore baseline Gulf of Mannar demo replay dataset"
              >
                ↺ Demo
              </button>
            </div>
          ) : (
            <span 
              className="px-2 py-0.5 bg-amber-950/80 border border-amber-600/70 rounded text-[10px] font-mono-tech text-amber-300 font-semibold flex items-center gap-1.5"
              title="DEMO MODE: Operating on recorded/simulated side-scan sonar data with hydrographic demo georeferencing. Physical sonar hardware is not connected."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              DEMO MODE
            </span>
          )}
        </div>

        {/* AI Model Runtime Indicator */}
        <div 
          id="bar-ai-model-status" 
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#0e141f] border border-[#1e293b] rounded text-[10px] font-mono-tech"
          title={
            modelRuntimeInfo?.status === 'ONNX_ACTIVE'
              ? `Real ONNX Model Active: ${modelRuntimeInfo.modelVersion} on ${modelRuntimeInfo.hardwareBackend} (${aiLatencyMs.toFixed(1)}ms)`
              : modelRuntimeInfo?.status === 'FALLBACK_SIMULATED'
              ? `Development Fallback Engine: ${modelRuntimeInfo?.modelVersion || 'Simulated'} - Awaiting real .onnx model weights file`
              : 'Model Unavailable: Inference inactive or failed'
          }
        >
          {modelRuntimeInfo?.status === 'ONNX_ACTIVE' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-300">
                AI:{' '}
                <strong className="text-emerald-400 font-semibold">
                  ONNX Active ({aiLatencyMs.toFixed(1)}ms)
                </strong>
              </span>
            </>
          ) : modelRuntimeInfo?.status === 'FALLBACK_SIMULATED' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
              <span className="text-slate-300">
                AI:{' '}
                <strong className="text-cyan-400 font-semibold">
                  Local Vision Model ({aiLatencyMs.toFixed(1)}ms)
                </strong>
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-slate-300">
                AI:{' '}
                <strong className="text-rose-400 font-semibold">
                  Model Unavailable
                </strong>
              </span>
            </>
          )}
        </div>

        {/* Database & Spatial Engine Status Badge */}
        <div
          id="bar-db-status"
          className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#0e141f] border border-[#1e293b] rounded text-[11px] font-mono-tech"
          title={
            storageInfo?.storageMode === 'POSTGRESQL_POSTGIS'
              ? `Connected to PostgreSQL + PostGIS (${storageInfo.database}). Spatial indexing active.`
              : 'Operating in Development Fallback Mode (In-Memory / Local Storage). Connect PostgreSQL with PostGIS via DATABASE_URL.'
          }
        >
          <Database className="w-3.5 h-3.5 text-slate-400" />
          {storageInfo?.storageMode === 'POSTGRESQL_POSTGIS' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-300">
                DB: <strong className="text-emerald-400 font-semibold">PostgreSQL + PostGIS</strong>
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
              <span className="text-slate-300">
                DB: <strong className="text-cyan-400 font-semibold">Local Storage DB</strong>
              </span>
            </>
          )}
        </div>

        {/* Operational Hazard Priority Summary Badge */}
        {riskSummary && riskSummary.totalAssessed > 0 && (
          <div 
            id="bar-hazard-summary" 
            className="hidden xl:flex items-center gap-2 px-2 py-1 bg-[#0e141f] border border-[#1e293b] rounded text-[10px] font-mono-tech"
            title="Operational Hazard Priority Summary"
          >
            <div className="flex items-center gap-1 text-slate-400 font-semibold uppercase">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>HAZARDS:</span>
            </div>
            <div className="flex items-center gap-1">
              {riskSummary.critical > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-950/90 border border-rose-600 text-rose-200 font-bold">
                  {riskSummary.critical} CRIT
                </span>
              )}
              {riskSummary.high > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-950/90 border border-amber-600 text-amber-200 font-bold">
                  {riskSummary.high} HIGH
                </span>
              )}
              {riskSummary.moderate > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-sky-950/70 border border-sky-700 text-sky-200">
                  {riskSummary.moderate} MOD
                </span>
              )}
              {riskSummary.low > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  {riskSummary.low} LOW
                </span>
              )}
            </div>
          </div>
        )}

        {/* Hydrographer / Operator Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono-tech text-[11px] text-slate-300 truncate max-w-[140px]" title={mission.chiefHydrographer}>
            HYDROGRAPHER
          </span>
        </div>

        {/* Audit Logs Action */}
        {onAuditLogsClick && (
          <button
            id="btn-open-audit-logs"
            onClick={onAuditLogsClick}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/70 text-purple-300 border border-purple-700/60 rounded text-xs font-mono-tech transition-colors cursor-pointer"
            title="Open comprehensive chronological cruise and operator audit logs"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">AUDIT LOGS</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-200 font-bold">
              {auditTrail.length}
            </span>
          </button>
        )}

        {/* Ingest Sonar Ping / Image Action */}
        {onIngestClick && (
          <button
            id="btn-ingest-sonar-ping"
            onClick={onIngestClick}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900/70 text-sky-300 border border-sky-700/60 rounded text-xs font-mono-tech transition-colors"
            title="Ingest raw ping, test preprocessing pipeline, or trigger degradation test"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Ingest Sonar</span>
          </button>
        )}

        {/* Export Report Action */}
        <button
          id="btn-export-survey-report"
          onClick={onExportClick}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] rounded text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden sm:inline">Export Survey</span>
        </button>
      </div>
    </header>
  );
};
