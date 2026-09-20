import React from 'react';
import { 
  Activity, 
  Cpu, 
  Compass, 
  Radio, 
  HardDrive, 
  Thermometer, 
  ShieldCheck, 
  Zap, 
  Layers, 
  AlertCircle,
  Database,
  Server,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { TowfishTelemetry, SurveyMission } from '../../types/sonar';
import { useSurveyStore } from '../../store/surveyStore';

interface DiagnosticsViewProps {
  telemetry: TowfishTelemetry;
  mission: SurveyMission;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  telemetry,
  mission,
}) => {
  const { modelRuntimeInfo, lastInferenceDurationMs, storageInfo, refreshStorageInfo } = useSurveyStore();
  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d14] text-slate-200 overflow-y-auto select-none p-4 gap-4">
      {/* Overview Status Banner */}
      <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-950/60 border border-emerald-700/60 rounded text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
              <span>ALL ACOUSTIC &amp; SENSOR SYSTEMS NOMINAL</span>
              <span className="text-[10px] font-mono-tech px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                HEALTH: 99.8%
              </span>
            </div>
            <div className="text-[11px] font-mono-tech text-slate-400 mt-0.5">
              AUV HUGIN-6000 INS TIGHT-COUPLED • DUAL-FREQ CHIRP TRANSDUCER ACTIVE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-tech">
          <div>
            <span className="text-slate-500 block text-[10px]">PING LOSS RATE</span>
            <span className="text-emerald-400 font-bold">0.02% (4/18,500)</span>
          </div>
          <div className="border-l border-[#1e293b] pl-4">
            <span className="text-slate-500 block text-[10px]">ACOUSTIC LINK</span>
            <span className="text-sky-400 font-bold">98.4 Mbps (UHF/ACOUSTIC)</span>
          </div>
          <div className="border-l border-[#1e293b] pl-4">
            <span className="text-slate-500 block text-[10px]">STORAGE (SSD)</span>
            <span className="text-slate-200 font-bold">412 GB / 1.0 TB</span>
          </div>
        </div>
      </div>

      {/* Grid of Specialized Marine Instruments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Instrument 1: Inertial Navigation System (INS) & Gyro Attitude */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-mono-tech font-bold text-slate-200 flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>INS ATTITUDE &amp; POSITIONING (IXBLUE PHINS)</span>
            </span>
            <span className="text-[10px] font-mono-tech text-emerald-400">RTK-FIXED</span>
          </div>

          {/* Gyro Attitude Inclinometer Graphic */}
          <div className="relative w-full h-36 bg-[#070b12] border border-[#1e293b] rounded flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 200 120" className="w-full h-full">
              {/* Artificial Horizon Pitch Ladder */}
              <line x1="20" y1="60" x2="80" y2="60" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="120" y1="60" x2="180" y2="60" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="100" cy="60" r="3" fill="#38bdf8" />

              {/* Pitch Marks */}
              <line x1="70" y1="40" x2="130" y2="40" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
              <text x="135" y="43" fill="#64748b" fontSize="8" fontFamily="ui-monospace">+5°</text>

              <line x1="70" y1="80" x2="130" y2="80" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
              <text x="135" y="83" fill="#64748b" fontSize="8" fontFamily="ui-monospace">-5°</text>

              {/* Vehicle symbol rotated by Roll */}
              <g transform={`rotate(${telemetry.rollDeg}, 100, 60)`}>
                <polygon points="100,56 94,64 106,64" fill="#f59e0b" />
                <line x1="60" y1="60" x2="140" y2="60" stroke="#f59e0b" strokeWidth="2" />
              </g>
            </svg>

            <span className="absolute bottom-1 right-2 text-[9px] font-mono-tech text-slate-400">
              ROLL: {telemetry.rollDeg.toFixed(1)}° • PITCH: {telemetry.pitchDeg.toFixed(1)}°
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
            <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">GYRO HEADING</span>
              <span className="text-slate-100 font-bold">{telemetry.headingDeg.toFixed(1)}° TRUE</span>
            </div>
            <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">DOPPLER LOG (DVL)</span>
              <span className="text-slate-100 font-bold">{telemetry.speedKnots.toFixed(1)} kts OVER GROUND</span>
            </div>
          </div>
        </div>

        {/* Instrument 2: Sound Velocity Profile (SVP) & Water Column */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-mono-tech font-bold text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              <span>SOUND VELOCITY PROFILE (CTD/SVP)</span>
            </span>
            <span className="text-[10px] font-mono-tech text-sky-400">VALEPORT MINISVP</span>
          </div>

          {/* SVP Depth Curve Graph */}
          <div className="relative w-full h-36 bg-[#070b12] border border-[#1e293b] rounded flex items-center justify-center p-2">
            <svg viewBox="0 0 220 120" className="w-full h-full">
              {/* Depth grid lines */}
              <line x1="40" y1="20" x2="210" y2="20" stroke="#1e293b" strokeWidth="1" />
              <line x1="40" y1="60" x2="210" y2="60" stroke="#1e293b" strokeWidth="1" />
              <line x1="40" y1="100" x2="210" y2="100" stroke="#1e293b" strokeWidth="1" />

              <text x="5" y="24" fill="#64748b" fontSize="8" fontFamily="ui-monospace">0m</text>
              <text x="5" y="64" fill="#64748b" fontSize="8" fontFamily="ui-monospace">25m</text>
              <text x="5" y="104" fill="#64748b" fontSize="8" fontFamily="ui-monospace">50m</text>

              {/* Sound velocity curve: thermocline layer representation */}
              <path
                d="M 180,20 C 170,40 110,65 140,100"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />

              {/* Current Towfish depth marker */}
              <circle cx="138" cy="98" r="4" fill="#38bdf8" />
              <text x="146" y="96" fill="#38bdf8" fontSize="8" fontFamily="ui-monospace" fontWeight="bold">
                TOWFISH (48m)
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
            <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">SURFACE SOUND SPEED</span>
              <span className="text-slate-100 font-bold">1522.4 m/s</span>
            </div>
            <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">SEABED SOUND SPEED</span>
              <span className="text-emerald-400 font-bold">{telemetry.soundVelocity.toFixed(1)} m/s</span>
            </div>
          </div>
        </div>

        {/* Instrument 3: Edge AI Detection Pipeline (Acoustic Neural Engine) */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-mono-tech font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>ONNX EDGE AI INFERENCE ENGINE</span>
            </span>
            {modelRuntimeInfo?.status === 'ONNX_ACTIVE' ? (
              <span className="text-[10px] font-mono-tech text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONNX ACTIVE ({lastInferenceDurationMs.toFixed(1)}ms)
              </span>
            ) : modelRuntimeInfo?.status === 'FALLBACK_SIMULATED' ? (
              <span className="text-[10px] font-mono-tech text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                LOCAL VISION ({lastInferenceDurationMs.toFixed(1)}ms)
              </span>
            ) : (
              <span className="text-[10px] font-mono-tech text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                UNAVAILABLE
              </span>
            )}
          </div>

          {/* Model Metrics */}
          <div className="flex flex-col gap-2">
            <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b] flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono-tech">
                <span className="text-slate-400">MODEL ARCHITECTURE:</span>
                <span className="text-sky-300 font-bold">{modelRuntimeInfo?.modelVersion || 'yolov8x-sonar-debris-quantized'}</span>
              </div>
              <div className="flex justify-between text-xs font-mono-tech">
                <span className="text-slate-400">EXECUTION BACKEND:</span>
                <span className="text-slate-200">{modelRuntimeInfo?.hardwareBackend || 'CPU (WebGPU Supported)'}</span>
              </div>
              <div className="flex justify-between text-xs font-mono-tech">
                <span className="text-slate-400">MODEL ARTIFACT PATH:</span>
                <span className="text-slate-300 truncate max-w-[200px]" title={modelRuntimeInfo?.modelPath}>
                  {modelRuntimeInfo?.modelPath || 'None configured (awaiting model artifact)'}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono-tech">
                <span className="text-slate-400">REAL ONNX LOADED:</span>
                <span className={modelRuntimeInfo?.isRealOnnxLoaded ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                  {modelRuntimeInfo?.isRealOnnxLoaded ? 'YES (Live Neural Weights)' : 'NO (.onnx artifact awaiting deployment)'}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono-tech">
                <span className="text-slate-400">FALSE-ALARM SUPPRESSION:</span>
                <span className="text-emerald-400 font-bold">96.4% on Natural Sand</span>
              </div>
            </div>

            {/* Hardware VRAM & Temperature */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
              <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 block">AUV GPU VRAM</span>
                <span className="text-slate-100 font-bold">1.4 GB / 8.0 GB</span>
              </div>
              <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                <span className="text-[10px] text-slate-500 block">CHASSIS TEMP</span>
                <span className="text-slate-100 font-bold">34.2 °C (SUBSEA COOLED)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instrument 4: PostgreSQL + PostGIS Geospatial Persistence Engine */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-col gap-3 lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-mono-tech font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>POSTGRESQL + POSTGIS SPATIAL PERSISTENCE ENGINE</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refreshStorageInfo()}
                className="flex items-center gap-1 text-[10px] font-mono-tech px-2 py-0.5 bg-[#131b29] hover:bg-[#1a2536] border border-[#2c3a50] text-slate-300 rounded transition-colors"
                title="Poll database status"
              >
                <RefreshCw className="w-3 h-3 text-sky-400" />
                <span>POLL STATUS</span>
              </button>
              {storageInfo?.storageMode === 'POSTGRESQL_POSTGIS' ? (
                <span className="text-[10px] font-mono-tech text-emerald-400 flex items-center gap-1 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  POSTGRESQL + POSTGIS ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-mono-tech text-amber-400 flex items-center gap-1 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  DEV RESILIENT FALLBACK
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono-tech">
            <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">STORAGE MODE</span>
              <span className="text-slate-100 font-bold block mt-0.5">
                {storageInfo?.storageMode === 'POSTGRESQL_POSTGIS' ? 'PostgreSQL + PostGIS (Active)' : 'Local Storage Mode'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {storageInfo?.storageMode === 'POSTGRESQL_POSTGIS'
                  ? 'Spatial queries running ST_DWithin & ST_Distance'
                  : 'In-Memory / Local Haversine Calculation'}
              </span>
            </div>

            <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">DATABASE &amp; SPATIAL INDEXING</span>
              <span className="text-emerald-400 font-bold block mt-0.5">
                {storageInfo?.postgisAvailable ? 'PostGIS Extension Enabled' : 'EPSG:4326 Compatible'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate" title={storageInfo?.postgisVersion || 'Local GIST simulated'}>
                {storageInfo?.postgisVersion ? storageInfo.postgisVersion.split(' ')[0] : 'GIST index schema applied'}
              </span>
            </div>

            <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">PERSISTED ENTITIES</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sky-400 font-bold">{storageInfo?.targetCount ?? 8} Targets</span>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-400 font-bold">{storageInfo?.recommendationCount ?? 5} Recs</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {storageInfo?.auditCount ?? 8} Audit events recorded
              </span>
            </div>

            <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
              <span className="text-[10px] text-slate-500 block">SPATIAL API ENDPOINTS</span>
              <span className="text-emerald-300 font-bold block mt-0.5">
                /api/targets/nearby
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                /api/targets/bbox • /api/recommendations
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Ping Packet Inspection Log */}
      <div className="bg-[#0e141f] border border-[#1e293b] p-3.5 rounded flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <span className="text-xs font-mono-tech font-bold text-slate-200 uppercase">
            RAW ACOUSTIC TELEMETRY PACKET INSPECTOR (.JSF / .XTF STREAM)
          </span>
          <span className="text-[10px] font-mono-tech text-slate-400">
            BAUD: 115200 • PROTOCOL: EDGETECH FORMAT 4200
          </span>
        </div>

        <div className="bg-[#070b12] p-2.5 rounded border border-[#1e293b] font-mono-tech text-[11px] text-slate-400 flex flex-col gap-1 overflow-x-auto">
          <div className="text-sky-400">
            [16:14:02.481] PING_SYNC #42180 | FREQ: 410.0 kHz | CHANNELS: 2 (PORT/STBD) | SAMPLES: 2048 | RANGE: 75.0m
          </div>
          <div>
            [16:14:02.483] ATTITUDE_MSG | ROLL: +01.20° | PITCH: -00.30° | HEADING: 042.60° | HEAVE: -0.04m
          </div>
          <div>
            [16:14:02.485] GNSS_POS_FIX | LAT: 09.241580 N | LNG: 079.182440 E | ELLIP_HT: -42.8m | HDOP: 0.8
          </div>
          <div className="text-amber-400">
            [16:14:02.508] INFERENCE_HIT | ID: TRG-02 | STBD 44.2m | CONF: 0.968 | CLASS: METALLIC_DRUM | SHADOW: 2.8m
          </div>
          <div className="text-emerald-400">
            [16:14:02.510] BUFFER_COMMIT | WRITTEN TO AUV NVME SECTOR: 0x4F12A09B | CHECKSUM: CRC-32 VALID
          </div>
        </div>
      </div>
    </div>
  );
};
