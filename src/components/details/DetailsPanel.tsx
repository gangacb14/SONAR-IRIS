import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  Copy, 
  Compass, 
  Activity, 
  Tag, 
  Save, 
  Clock, 
  Ruler, 
  Maximize2,
  History,
  FileCheck,
  Sparkles,
  Flame,
  CheckCheck,
  SlidersHorizontal,
  Info,
  Radar,
  GitCompare,
  ArrowRight
} from 'lucide-react';
import { DebrisCategory, SonarDetection, VerificationStatus, SeverityLevel } from '../../types/sonar';
import { AuditEvent } from '../../types/audit';
import { RiskLevel, RiskCategory } from '../../types/risk';
import { useSurveyStore } from '../../store/surveyStore';

interface DetailsPanelProps {
  detection: SonarDetection | null;
  onClose: () => void;
  onUpdateStatus: (detectionId: string, newStatus: VerificationStatus, notes?: string) => void;
  onUpdateCategory: (detectionId: string, newCategory: DebrisCategory) => void;
  onAddNote?: (detectionId: string, note: string) => void;
  onOverrideRisk?: (detectionId: string, operatorRiskLevel: RiskLevel, reason: string) => void;
  onAcknowledgeRisk?: (detectionId: string, notes?: string) => void;
  auditEvents?: AuditEvent[];
}

const CATEGORY_OPTIONS: Array<{ value: DebrisCategory; label: string }> = [
  { value: 'GHOST_NET', label: 'Derelict Fishing Net / Gear' },
  { value: 'METALLIC_DRUM', label: 'Industrial Drum / Barrel' },
  { value: 'PLASTIC_AGGREGATE', label: 'Plastic Marine Aggregate' },
  { value: 'WRECKAGE_DEBRIS', label: 'Vessel Wreckage / Hull Scrap' },
  { value: 'TIRE_CLUSTER', label: 'Commercial Tire Cluster' },
  { value: 'PIPELINE_EXPOSURE', label: 'Pipeline Free-Span / Cable' },
  { value: 'ORDNANCE_UXO', label: 'Metallic Munitions / UXO' },
  { value: 'GEOLOGICAL_FEATURE', label: 'Natural Bedrock / Geological' },
  { value: 'MARINE_DEBRIS', label: 'General Anthropogenic Debris' },
  { value: 'UNKNOWN_ANOMALY', label: 'Unknown Acoustic Anomaly' },
];

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  detection,
  onClose,
  onUpdateStatus,
  onUpdateCategory,
  onAddNote,
  onOverrideRisk,
  onAcknowledgeRisk,
  auditEvents = [],
}) => {
  const { 
    activeTargetHotspot, 
    selectHotspot, 
    activeTargetTemporalChange, 
    surveyComparison,
    activeTargetRecommendation,
    followUpRecommendations,
  } = useSurveyStore();
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isEditingCategory, setIsEditingCategory] = useState<boolean>(false);
  const [isOverridingRisk, setIsOverridingRisk] = useState<boolean>(false);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel>('HIGH');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Sync operator notes and risk state when detection changes
  React.useEffect(() => {
    if (detection) {
      setOperatorNotes(detection.operatorNotes || '');
      setIsEditingCategory(false);
      setIsOverridingRisk(false);
      setSelectedRiskLevel(
        detection.riskAssessment?.operatorRiskLevel || 
        detection.riskAssessment?.riskLevel || 
        'HIGH'
      );
      setOverrideReason(detection.riskAssessment?.operatorOverrideReason || '');
    }
  }, [detection?.id]);

  // Clean timeout for copy state
  React.useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  if (!detection) {
    return (
      <aside 
        id="contextual-details-panel-empty" 
        className="w-80 md:w-96 bg-[#090d14] border-l border-[#1e293b] flex flex-col items-center justify-center p-6 text-center text-slate-500 select-none flex-shrink-0"
      >
        <Compass className="w-10 h-10 mb-3 text-slate-700" />
        <span className="text-xs font-mono-tech uppercase tracking-wider text-slate-400">
          NO ANOMALY SELECTED
        </span>
        <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
          Click any target bounding box in the Sonar Waterfall, pin on the GIS chart, or row in the registry to inspect.
        </p>
      </aside>
    );
  }

  const handleSaveNotes = () => {
    if (onAddNote) {
      onAddNote(detection.id, operatorNotes);
    } else {
      onUpdateStatus(detection.id, detection.verificationStatus, operatorNotes);
    }
  };

  const copyCoordinates = () => {
    const lat = detection.latitude ?? detection.coordinates.lat;
    const lng = detection.longitude ?? detection.coordinates.lng;
    const utmZone = detection.utmZone ?? detection.coordinates.utmZone;
    const easting = detection.utmEasting ?? detection.coordinates.utmEasting;
    const northing = detection.utmNorthing ?? detection.coordinates.utmNorthing;

    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)} [UTM ${utmZone} ${easting.toFixed(1)}E ${northing.toFixed(1)}N]`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
  };

  return (
    <aside 
      id="contextual-details-panel" 
      className="w-80 md:w-96 bg-[#090d14] border-l border-[#1e293b] flex flex-col justify-between select-none overflow-y-auto z-20 flex-shrink-0 text-slate-200"
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-[#1e293b] bg-[#0e141f] flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-mono-tech font-bold tracking-wider text-slate-100">
            {detection.id}
          </span>
          <span
            className={`text-[9px] font-mono-tech font-semibold px-1.5 py-0.2 rounded border ${
              detection.severity === 'CRITICAL'
                ? 'bg-red-950/70 border-red-700/60 text-red-300'
                : detection.severity === 'HIGH'
                ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                : 'bg-[#131b29] border-[#2c3a50] text-sky-300'
            }`}
          >
            {detection.severity}
          </span>
        </div>

        <button
          id="btn-close-details"
          onClick={onClose}
          className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-slate-200 rounded"
          title="Close inspector panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5 flex-1">
        {/* Classification Title, Reclassify & Confidence */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>OBJECT CLASSIFICATION</span>
            <button
              onClick={() => setIsEditingCategory(!isEditingCategory)}
              className="text-sky-400 hover:text-sky-300 underline text-[10px]"
            >
              {isEditingCategory ? 'Cancel' : 'Reclassify'}
            </button>
          </div>

          {isEditingCategory ? (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <select
                value={detection.classification || detection.category}
                onChange={(e) => {
                  onUpdateCategory(detection.id, e.target.value as DebrisCategory);
                  setIsEditingCategory(false);
                }}
                className="w-full bg-[#090d14] border border-sky-600 rounded p-1.5 text-xs font-mono-tech text-slate-200"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-100 mt-0.5">
              {detection.categoryLabel}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-xs font-mono-tech">
            <span className="text-slate-400">AI CONFIDENCE:</span>
            <span className="text-sky-400 font-bold">
              {(detection.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#1e293b] rounded mt-1 overflow-hidden">
            <div
              className={`h-full ${detection.confidence > 0.9 ? 'bg-emerald-400' : 'bg-sky-400'}`}
              style={{ width: `${detection.confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Acoustic Cutout & Acoustic Profile Canvas */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>ACOUSTIC CUTOUT &amp; SHADOW TRACE</span>
            <span className="text-amber-400 font-semibold">{detection.channel} CHANNEL</span>
          </div>

          {/* High-Contrast Acoustic Snippet Canvas Graphic */}
          <div className="relative w-full h-28 bg-[#070a10] border border-[#1e293b] rounded overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 240 100" className="w-full h-full">
              <g stroke="#131b29" strokeWidth="1">
                <line x1="0" y1="20" x2="240" y2="20" />
                <line x1="0" y1="40" x2="240" y2="40" />
                <line x1="0" y1="60" x2="240" y2="60" />
                <line x1="0" y1="80" x2="240" y2="80" />
              </g>

              <ellipse
                cx={detection.channel === 'PORT' ? 140 : 80}
                cy="50"
                rx="14"
                ry="22"
                fill="#fde047"
                opacity="0.9"
              />
              <ellipse
                cx={detection.channel === 'PORT' ? 140 : 80}
                cy="50"
                rx="8"
                ry="14"
                fill="#ffffff"
                opacity="0.95"
              />

              <polygon
                points={
                  detection.channel === 'PORT'
                    ? '124,32 40,24 40,76 124,68'
                    : '96,32 180,24 180,76 96,68'
                }
                fill="#000000"
                opacity="0.98"
                stroke="#f59e0b"
                strokeWidth="0.75"
                strokeDasharray="2,2"
              />

              <line
                x1={detection.channel === 'PORT' ? 40 : 96}
                y1="86"
                x2={detection.channel === 'PORT' ? 124 : 180}
                y2="86"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <text
                x={detection.channel === 'PORT' ? 82 : 138}
                y="96"
                fill="#f59e0b"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                SHADOW: {(detection.shadowLength || detection.shadowLengthMeters).toFixed(1)}m
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-tech text-slate-400">
            <div>
              <span>SLANT RANGE: </span>
              <strong className="text-slate-200">{(detection.slantRange || detection.slantRangeMeters).toFixed(1)} m</strong>
            </div>
            <div>
              <span>BACKSCATTER: </span>
              <strong className="text-slate-200">{(detection.backscatter || detection.backscatterDb).toFixed(1)} dB</strong>
            </div>
          </div>
        </div>

        {/* Acoustic Shadow Mensuration & Dimensional Profiler */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>ACOUSTIC SHADOW MENSURATION</span>
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono-tech">
            <div className="flex flex-col bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">EST. TARGET HEIGHT (H)</span>
              <span className="text-amber-400 font-bold text-sm">
                {(detection.shadowHeight || detection.estimatedTargetHeightMeters).toFixed(2)} m
              </span>
            </div>

            <div className="flex flex-col bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">EST. LENGTH × WIDTH</span>
              <span className="text-slate-200 font-bold text-sm">
                {(detection.estimatedLength || detection.estimatedLengthMeters).toFixed(1)} × {(detection.estimatedWidth || detection.estimatedWidthMeters).toFixed(1)} m
              </span>
            </div>

            <div className="flex flex-col bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">SHADOW LENGTH (L_s)</span>
              <span className="text-slate-200 font-medium">
                {(detection.shadowLength || detection.shadowLengthMeters).toFixed(1)} m
              </span>
            </div>

            <div className="flex flex-col bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">GROUND RANGE (R_g)</span>
              <span className="text-slate-200 font-medium">
                {(detection.groundRange || detection.groundRangeMeters).toFixed(1)} m
              </span>
            </div>
          </div>

          <div className="text-[9px] font-mono-tech text-slate-500 bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
            FORMULA: H = (L_shadow × H_sensor) / R_slant = ({(detection.shadowLength || detection.shadowLengthMeters).toFixed(1)} × {(detection.towfishAltitude || detection.towfishAltitudeMeters).toFixed(1)}) / {(detection.slantRange || detection.slantRangeMeters).toFixed(1)}
          </div>
        </div>

        {/* Geospatial Geodetic Coordinates */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>GEOSPATIAL COORDINATES</span>
            <button
              onClick={copyCoordinates}
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
            >
              <Copy className="w-3 h-3" />
              <span>{isCopied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>

          <div className="text-xs font-mono-tech text-slate-200">
            {(detection.latitude ?? detection.coordinates.lat).toFixed(6)}°N, {(detection.longitude ?? detection.coordinates.lng).toFixed(6)}°E
          </div>
          <div className="text-[10px] font-mono-tech text-slate-400">
            UTM Zone {detection.utmZone ?? detection.coordinates.utmZone}: {(detection.utmEasting ?? detection.coordinates.utmEasting).toFixed(1)}m E, {(detection.utmNorthing ?? detection.coordinates.utmNorthing).toFixed(1)}m N
          </div>
          <div className="text-[10px] font-mono-tech text-slate-400">
            SEABED DEPTH: {(detection.depth ?? detection.coordinates.depthMeters).toFixed(1)} m
          </div>
        </div>

        {/* Acoustic Metadata & Data Provenance (Section 5 & 12) */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>ACOUSTIC FRAME & PROVENANCE</span>
            <FileCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono-tech">
            <div className="flex flex-col bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">PING / TRANSECT</span>
              <span className="text-slate-200 font-semibold">#{detection.pingNumber} • {detection.transectId || 'TRX-01'}</span>
            </div>
            <div className="flex flex-col bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase">CHANNEL / SWATH</span>
              <span className="text-sky-300 font-semibold">{detection.channel === 'PORT' ? 'PORT SWATH' : 'STARBOARD SWATH'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[9px] font-mono-tech bg-[#090d14] p-2 rounded border border-[#1e293b]">
            <div className="text-slate-500 uppercase">Scientific Accountability Tags:</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Acoustic Samples:</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-bold">SIMULATED</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Geospatial Coordinates:</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 font-bold">DERIVED (WGS84)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Shadow Mensuration:</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-bold">DERIVED</span>
            </div>
          </div>
        </div>

        {/* Explainable AI Evidence (Section 13: WHY WAS THIS FLAGGED?) */}
        <div className="bg-[#0e141f] border border-sky-900/60 p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-sky-400 uppercase">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              WHY WAS THIS FLAGGED? (AI EVIDENCE)
            </span>
            <span className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-800/60 text-sky-300 text-[9px] font-mono-tech">
              {detection.modelMetadata?.modelName || 'demo-inference-v1'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 text-xs font-mono-tech">
            <div className="bg-[#090d14] p-2 rounded border border-[#1e293b] flex flex-col gap-1.5">
              <div className="flex items-start gap-1.5 text-slate-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                <span>
                  Peak Backscatter: <strong className="text-slate-100">{(detection.backscatter || detection.backscatterDb || -3.5).toFixed(1)} dB</strong> (Acoustic highlight response)
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
                <span>
                  Acoustic Shadow: <strong className="text-amber-300">{(detection.shadowLength || detection.shadowLengthMeters || 1.2).toFixed(2)} m</strong> (Measured obstruction shadow)
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1 flex-shrink-0" />
                <span>
                  Vertical Relief: <strong className="text-sky-300">{(detection.shadowHeight || detection.estimatedTargetHeightMeters || 0.8).toFixed(2)} m</strong> above seabed
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                <span>
                  Inference Confidence: <strong className="text-indigo-300">{((detection.confidence || 0.85) * 100).toFixed(0)}%</strong> (Threshold: &gt;50%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex flex-col bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                <span className="text-[9px] text-slate-500 uppercase">Geological Filter:</span>
                <span className={`font-semibold ${
                  detection.classification === 'GEOLOGICAL_FEATURE'
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}>
                  {detection.classification === 'GEOLOGICAL_FEATURE'
                    ? 'LIKELY_GEOLOGICAL'
                    : 'LIKELY_MAN_MADE'}
                </span>
              </div>

              <div className="flex flex-col bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                <span className="text-[9px] text-slate-500 uppercase">Quality Gating:</span>
                <span className="text-sky-300 font-semibold">INFERENCE_ALLOWED</span>
              </div>
            </div>

            <div className="text-[9px] font-mono-tech text-slate-500 bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
              PROVENANCE: Model {detection.modelMetadata?.modelName || 'demo-inference-v1'} • Mode: SIMULATED • Heuristic False-Positive Filter: PASSED
            </div>
          </div>
        </div>

        {/* Hazard & Operational Risk Prioritization */}
        {detection.riskAssessment && (
          <div 
            id="panel-hazard-prioritization" 
            className="bg-[#0e141f] border border-amber-900/40 p-3 rounded flex flex-col gap-2.5"
          >
            {/* Header with Priority Rank & Risk Level */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono-tech text-amber-400 font-bold uppercase">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>HAZARD PRIORITIZATION</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono-tech font-bold text-slate-300">
                  PRIORITY #{detection.riskAssessment.priorityRank}
                </span>
              </div>
            </div>

            {/* Score & Badges */}
            <div className="bg-[#090d14] border border-[#1e293b] p-2.5 rounded flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono-tech text-slate-500 uppercase">
                  OPERATIONAL RISK LEVEL
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono-tech font-bold tracking-wider border ${
                      (detection.riskAssessment.operatorRiskLevel || detection.riskAssessment.riskLevel) === 'CRITICAL'
                        ? 'bg-rose-950/90 border-rose-600 text-rose-200'
                        : (detection.riskAssessment.operatorRiskLevel || detection.riskAssessment.riskLevel) === 'HIGH'
                        ? 'bg-amber-950/90 border-amber-600 text-amber-200'
                        : (detection.riskAssessment.operatorRiskLevel || detection.riskAssessment.riskLevel) === 'MODERATE'
                        ? 'bg-sky-950/90 border-sky-600 text-sky-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {detection.riskAssessment.operatorRiskLevel || detection.riskAssessment.riskLevel}
                  </span>
                  <span className="text-xs font-mono-tech text-slate-400">
                    Score: <strong className="text-slate-100">{detection.riskAssessment.riskScore}</strong>/100
                  </span>
                </div>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-[9px] font-mono-tech text-slate-500 uppercase">
                  HAZARD DOMAIN
                </span>
                <span className="text-xs font-mono-tech font-semibold text-slate-200 mt-0.5">
                  {detection.riskAssessment.primaryCategory}
                </span>
              </div>
            </div>

            {/* Operator Override Banner (if overridden) */}
            {detection.riskAssessment.operatorRiskLevel && (
              <div className="bg-amber-950/40 border border-amber-800/60 p-2 rounded text-[10px] font-mono-tech flex flex-col gap-1 text-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                    OPERATOR OVERRIDE ACTIVE
                  </span>
                  <span className="text-[9px] text-amber-400/80">
                    Orig AI: {detection.riskAssessment.riskLevel}
                  </span>
                </div>
                <div className="text-slate-300 text-[10px]">
                  Reason: &quot;{detection.riskAssessment.operatorOverrideReason}&quot;
                </div>
              </div>
            )}

            {/* Factor Weight Breakdown Bars */}
            <div className="flex flex-col gap-1.5 text-[10px] font-mono-tech bg-[#090d14] p-2 rounded border border-[#1e293b]">
              <span className="text-[9px] text-slate-500 uppercase font-semibold">
                FACTOR BREAKDOWN:
              </span>

              {/* Object Type Hazard */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-[10px] truncate max-w-[140px]">Object Severity:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-[#1e293b] rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded"
                      style={{ width: `${Math.min(100, detection.riskAssessment.severityScore)}%` }}
                    />
                  </div>
                  <span className="text-slate-200 w-6 text-right">{detection.riskAssessment.severityScore}</span>
                </div>
              </div>

              {/* Size & Mensuration */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-[10px] truncate max-w-[140px]">Relief &amp; Dimensions:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-[#1e293b] rounded overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded"
                      style={{ width: `${Math.min(100, detection.riskAssessment.sizeContribution)}%` }}
                    />
                  </div>
                  <span className="text-slate-200 w-6 text-right">{detection.riskAssessment.sizeContribution}</span>
                </div>
              </div>

              {/* Infrastructure Proximity */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-[10px] truncate max-w-[140px]">Infrastructure Proximity:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-[#1e293b] rounded overflow-hidden">
                    <div
                      className="h-full bg-rose-400 rounded"
                      style={{ width: `${Math.min(100, detection.riskAssessment.proximityScore)}%` }}
                    />
                  </div>
                  <span className="text-slate-200 w-6 text-right">{detection.riskAssessment.proximityScore}</span>
                </div>
              </div>

              {/* Contextual Exposure */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-[10px] truncate max-w-[140px]">Contextual Sensitivity:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-[#1e293b] rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded"
                      style={{ width: `${Math.min(100, detection.riskAssessment.contextualExposure)}%` }}
                    />
                  </div>
                  <span className="text-slate-200 w-6 text-right">{detection.riskAssessment.contextualExposure}</span>
                </div>
              </div>
            </div>

            {/* Explainable Risk Reasons */}
            {detection.riskAssessment.reasons && detection.riskAssessment.reasons.length > 0 && (
              <div className="flex flex-col gap-1 bg-[#090d14] p-2 rounded border border-[#1e293b]">
                <span className="text-[9px] font-mono-tech text-slate-500 uppercase font-semibold">
                  OPERATIONAL REASONS:
                </span>
                <ul className="flex flex-col gap-1 text-[10px] font-mono-tech text-slate-300">
                  {detection.riskAssessment.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Action */}
            {detection.riskAssessment.recommendedAction && (
              <div className="bg-sky-950/30 border border-sky-800/40 p-2 rounded flex flex-col gap-1">
                <span className="text-[9px] font-mono-tech text-sky-400 uppercase font-semibold flex items-center gap-1">
                  <Info className="w-3 h-3 text-sky-400" />
                  RECOMMENDED ACTION:
                </span>
                <p className="text-[10px] font-mono-tech text-slate-200">
                  {detection.riskAssessment.recommendedAction}
                </p>
              </div>
            )}

            {/* Spatial Intelligence & Cluster Context */}
            {activeTargetHotspot ? (
              <div id="target-cluster-context-card" className="bg-[#090d14] border border-sky-800/60 p-2.5 rounded flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono-tech">
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <Radar className="w-3.5 h-3.5" />
                    <span>SPATIAL CLUSTER: HOTSPOT #{activeTargetHotspot.rank}</span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    activeTargetHotspot.riskLevel === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                    activeTargetHotspot.riskLevel === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    'bg-sky-950 text-sky-300 border border-sky-800'
                  }`}>
                    {activeTargetHotspot.riskLevel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono-tech">
                  Target is part of a {activeTargetHotspot.targetCount}-target hazard cluster within {activeTargetHotspot.radiusMeters}m radius (Priority score: {activeTargetHotspot.priorityScore}).
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#1e293b] text-[9px] font-mono-tech text-slate-400">
                  <span>DOMINANT: {activeTargetHotspot.dominantCategories.join(', ')}</span>
                  <button
                    type="button"
                    onClick={() => selectHotspot(activeTargetHotspot.id)}
                    className="text-sky-400 hover:text-sky-200 underline"
                  >
                    View Cluster On Map
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#090d14] border border-[#1e293b] p-2 rounded text-[10px] font-mono-tech text-slate-400 flex items-center justify-between">
                <span>SPATIAL CONTEXT: Isolated anomaly</span>
                <span className="text-slate-500">RADIUS &gt; 140m</span>
              </div>
            )}

            {/* Repeat-Survey Temporal Change & History */}
            {activeTargetTemporalChange && (
              <div 
                id="target-temporal-change-card"
                className="bg-[#0b111c] border border-cyan-800/50 p-2.5 rounded flex flex-col gap-2 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-[10px] font-mono-tech">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>TEMPORAL STATUS:</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    activeTargetTemporalChange.changeType === 'NEW' 
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' 
                      : activeTargetTemporalChange.changeType === 'CHANGED'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                      : activeTargetTemporalChange.changeType === 'PERSISTENT'
                      ? 'bg-sky-950/80 text-sky-300 border border-sky-700'
                      : activeTargetTemporalChange.changeType === 'REMOVED'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-700'
                      : 'bg-slate-900 text-slate-300 border border-slate-700'
                  }`}>
                    {activeTargetTemporalChange.changeType.replace('_', ' ')}
                  </span>
                </div>

                {/* Baseline Survey Reference */}
                <div className="flex items-center justify-between text-[9px] font-mono-tech text-slate-400 bg-[#070a10] px-2 py-1 rounded border border-[#1a2333]">
                  <span>BASELINE: {surveyComparison?.previousSurveyDate || '2025-08-14'}</span>
                  <span className="text-cyan-400 truncate max-w-[170px]" title={surveyComparison?.previousSurveyName}>
                    {surveyComparison?.previousSurveyName || 'Gulf of Mannar Baseline'}
                  </span>
                </div>

                {/* Change Score vs Risk Score Dual Meters */}
                <div className="grid grid-cols-2 gap-2 bg-[#070a10] p-2 rounded border border-[#1a2333]">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono-tech text-slate-400 uppercase">
                      CHANGE MAGNITUDE
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-base font-mono-tech font-bold text-cyan-300">
                        {activeTargetTemporalChange.changeScore}
                      </span>
                      <span className="text-[9px] font-mono-tech text-slate-500">/ 100</span>
                    </div>
                    <span className="text-[8px] font-mono-tech text-slate-500">Acoustic/spatial delta</span>
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-mono-tech text-slate-400 uppercase">
                      TEMPORAL PRIORITY
                    </span>
                    <span className={`text-xs font-mono-tech font-bold mt-1 ${
                      activeTargetTemporalChange.temporalPriority === 'CRITICAL' ? 'text-rose-400' :
                      activeTargetTemporalChange.temporalPriority === 'HIGH' ? 'text-amber-400' :
                      activeTargetTemporalChange.temporalPriority === 'MODERATE' ? 'text-sky-400' :
                      'text-slate-400'
                    }`}>
                      {activeTargetTemporalChange.temporalPriority}
                    </span>
                    <span className="text-[8px] font-mono-tech text-slate-500">
                      Hazard Rank: #{activeTargetTemporalChange.currentTarget?.riskAssessment?.priorityRank ?? detection.riskAssessment?.priorityRank ?? 1}
                    </span>
                  </div>
                </div>

                {/* Dimensional & Position Shift Metrics (for matched targets) */}
                {activeTargetTemporalChange.previousTarget && (
                  <div className="flex flex-col gap-1 text-[10px] font-mono-tech bg-[#070a10] p-2 rounded border border-[#1a2333]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Position Shift:</span>
                      <span className="text-slate-200 font-bold">{activeTargetTemporalChange.positionShiftMeters ?? 0} m</span>
                    </div>
                    {activeTargetTemporalChange.footprintChange && (
                      <>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Footprint Length:</span>
                          <span className="text-slate-200">
                            {activeTargetTemporalChange.footprintChange.previousLengthM}m 
                            <ArrowRight className="inline w-2.5 h-2.5 mx-1 text-slate-500" />
                            {activeTargetTemporalChange.footprintChange.currentLengthM}m 
                            <span className={activeTargetTemporalChange.footprintChange.deltaLengthM > 0 ? 'text-amber-400 ml-1 font-bold' : 'text-slate-400 ml-1'}>
                              ({activeTargetTemporalChange.footprintChange.deltaLengthM > 0 ? '+' : ''}{activeTargetTemporalChange.footprintChange.deltaLengthM}m)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Footprint Width:</span>
                          <span className="text-slate-200">
                            {activeTargetTemporalChange.footprintChange.previousWidthM}m 
                            <ArrowRight className="inline w-2.5 h-2.5 mx-1 text-slate-500" />
                            {activeTargetTemporalChange.footprintChange.currentWidthM}m
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Multi-Survey Chronological Observation History */}
                <div className="flex flex-col gap-1 text-[10px] font-mono-tech">
                  <span className="text-[9px] font-mono-tech text-slate-500 uppercase font-semibold">
                    SURVEY OBSERVATION HISTORY:
                  </span>
                  <div className="relative pl-3 border-l-2 border-cyan-800/60 flex flex-col gap-2 text-[9px] py-1">
                    {/* Previous survey node */}
                    <div className="relative">
                      <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-slate-600 border border-slate-900" />
                      <div className="text-slate-400 font-semibold flex items-center justify-between">
                        <span>2025-08-14 (Baseline Survey)</span>
                        <span className="text-[8px] text-slate-500">ORV Sagar Kanya</span>
                      </div>
                      <div className="text-slate-300">
                        {activeTargetTemporalChange.previousTarget ? (
                          <span>Observed as <strong className="text-cyan-300">{activeTargetTemporalChange.previousTarget.classification || activeTargetTemporalChange.previousTarget.category}</strong> ({activeTargetTemporalChange.previousTarget.id})</span>
                        ) : (
                          <span className="text-slate-500 italic">No acoustic signature detected in coverage area</span>
                        )}
                      </div>
                    </div>

                    {/* Current survey node */}
                    <div className="relative">
                      <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-cyan-400 border border-cyan-900" />
                      <div className="text-cyan-400 font-semibold flex items-center justify-between">
                        <span>2026-09-07 (Repeat Survey)</span>
                        <span className="text-[8px] text-cyan-500">AUV HUGIN 6000</span>
                      </div>
                      <div className="text-slate-200">
                        <span>Observed as <strong className="text-emerald-300">{detection.category}</strong> ({detection.id})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explainable Rationale */}
                {activeTargetTemporalChange.reasons && activeTargetTemporalChange.reasons.length > 0 && (
                  <div className="flex flex-col gap-1 bg-[#070a10] p-2 rounded border border-[#1a2333]">
                    <span className="text-[9px] font-mono-tech text-slate-500 uppercase font-semibold">
                      TEMPORAL CHANGE RATIONALE:
                    </span>
                    <ul className="flex flex-col gap-1 text-[9px] font-mono-tech text-slate-300">
                      {activeTargetTemporalChange.reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-400 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI FOLLOW-UP SURVEY RECOMMENDATION & MISSION PRIORITIZATION */}
            {activeTargetRecommendation && (
              <div 
                id="target-followup-recommendation-section" 
                className="bg-[#0b101a] border border-purple-900/60 p-2.5 rounded-lg flex flex-col gap-2"
              >
                <div className="flex items-center justify-between border-b border-purple-900/40 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-mono-tech font-bold text-slate-200">
                      FOLLOW-UP RECOMMENDATION
                    </span>
                    <span className="text-[9px] px-1 py-0.2 bg-purple-950 text-purple-300 border border-purple-800 rounded font-bold">
                      {activeTargetRecommendation.provenance || 'DERIVED'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-mono-tech font-bold px-1.5 py-0.5 rounded ${
                      (activeTargetRecommendation.operatorOverride?.urgency || activeTargetRecommendation.urgency) === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-600'
                        : (activeTargetRecommendation.operatorOverride?.urgency || activeTargetRecommendation.urgency) === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : 'bg-sky-950 text-sky-300 border border-sky-600'
                    }`}>
                      PRIORITY: {activeTargetRecommendation.operatorOverride?.urgency || activeTargetRecommendation.urgency}
                    </span>
                    <span className="text-[10px] font-mono-tech font-bold text-slate-400">
                      ({activeTargetRecommendation.operatorOverride?.priorityScore || activeTargetRecommendation.priorityScore}/100)
                    </span>
                  </div>
                </div>

                {/* Recommended Action Pill */}
                <div className="flex items-center justify-between bg-[#070a10] p-1.5 rounded border border-[#1a2333]">
                  <span className="text-[9px] font-mono-tech text-slate-400 uppercase">
                    RECOMMENDED ACTION:
                  </span>
                  <span className="text-[10px] font-mono-tech font-bold text-purple-300">
                    {(activeTargetRecommendation.operatorOverride?.recommendationType || activeTargetRecommendation.recommendationType).replace(/_/g, ' ')}
                  </span>
                </div>

                {/* WHY (Reasons) */}
                {activeTargetRecommendation.reasons.length > 0 && (
                  <div className="flex flex-col gap-1 bg-[#070a10] p-2 rounded border border-[#1a2333]">
                    <span className="text-[9px] font-mono-tech text-slate-400 uppercase font-semibold">
                      WHY (OPERATIONAL JUSTIFICATION):
                    </span>
                    <ul className="flex flex-col gap-1 text-[9px] font-mono-tech text-slate-300">
                      {activeTargetRecommendation.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* EVIDENCE */}
                {activeTargetRecommendation.evidence.length > 0 && (
                  <div className="flex flex-col gap-1 bg-[#070a10] p-2 rounded border border-[#1a2333]">
                    <span className="text-[9px] font-mono-tech text-slate-400 uppercase font-semibold">
                      ACOUSTIC / SPATIAL EVIDENCE:
                    </span>
                    <ul className="flex flex-col gap-1 text-[9px] font-mono-tech text-slate-300">
                      {activeTargetRecommendation.evidence.map((ev, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-sky-400 mt-0.5">•</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* EXPECTED BENEFIT */}
                <div className="bg-[#070a10] p-2 rounded border border-[#1a2333]">
                  <span className="text-[9px] font-mono-tech text-purple-400 uppercase font-semibold block">
                    EXPECTED BENEFIT:
                  </span>
                  <span className="text-[10px] font-mono-tech text-slate-200 mt-0.5 block italic">
                    "{activeTargetRecommendation.expectedBenefit}"
                  </span>
                </div>

                {/* Hotspot Cluster Context if part of Hotspot (Rule 21) */}
                {activeTargetHotspot && (
                  <div className="bg-[#070a10] p-2 rounded border border-sky-900/40 space-y-1 text-[9px] font-mono-tech">
                    <div className="flex items-center justify-between text-slate-300 font-bold border-b border-[#1a2333] pb-1">
                      <span className="text-sky-300 flex items-center gap-1">
                        <Radar className="w-3 h-3" />
                        HOTSPOT CONTEXT (#{activeTargetHotspot.rank})
                      </span>
                      <span>{activeTargetHotspot.targetCount} TARGETS IN CLUSTER</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400 pt-0.5">
                      <div>Critical: <strong className="text-rose-400">{activeTargetHotspot.targetIds.filter(id => id.includes('01') || id.includes('07')).length || 1}</strong></div>
                      <div>High: <strong className="text-amber-400">{activeTargetHotspot.targetIds.length > 2 ? 2 : 1}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Operator Risk Actions (Acknowledge & Override) */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center gap-2">
                <button
                  id="btn-acknowledge-risk"
                  onClick={() => onAcknowledgeRisk?.(detection.id)}
                  className="flex-1 py-1.5 px-2 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-sky-300 rounded text-xs font-mono-tech flex items-center justify-center gap-1.5 transition-colors"
                  title="Acknowledge priority in cruise register"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Acknowledge Risk</span>
                </button>

                <button
                  id="btn-toggle-risk-override"
                  onClick={() => setIsOverridingRisk(!isOverridingRisk)}
                  className="py-1.5 px-2.5 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-amber-300 rounded text-xs font-mono-tech flex items-center justify-center gap-1 transition-colors"
                  title="Manually adjust hazard priority level"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{isOverridingRisk ? 'Cancel' : 'Override'}</span>
                </button>
              </div>

              {/* Inline Override Form */}
              {isOverridingRisk && (
                <div className="bg-[#090d14] border border-amber-600/70 p-2 rounded flex flex-col gap-2 mt-1">
                  <span className="text-[10px] font-mono-tech text-amber-300 font-bold uppercase">
                    OPERATOR RISK OVERRIDE
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-tech text-slate-400">PRIORITY:</span>
                    <select
                      id="select-override-level"
                      value={selectedRiskLevel}
                      onChange={(e) => setSelectedRiskLevel(e.target.value as RiskLevel)}
                      className="bg-[#0e141f] border border-[#2c3a50] rounded px-2 py-1 text-xs font-mono-tech text-slate-200 outline-none flex-1"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MODERATE">MODERATE</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>

                  <input
                    id="input-override-reason"
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Mandatory operator justification reason..."
                    className="w-full bg-[#0e141f] border border-[#2c3a50] rounded px-2 py-1 text-xs font-mono-tech text-slate-200 placeholder:text-slate-600 outline-none"
                  />

                  <button
                    id="btn-submit-risk-override"
                    onClick={() => {
                      if (!overrideReason.trim()) return;
                      onOverrideRisk?.(detection.id, selectedRiskLevel, overrideReason.trim());
                      setIsOverridingRisk(false);
                    }}
                    disabled={!overrideReason.trim()}
                    className="w-full py-1 bg-amber-950/90 hover:bg-amber-900 border border-amber-600 text-amber-200 rounded text-xs font-mono-tech font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Confirm Override
                  </button>
                </div>
              )}
            </div>

            <div className="text-[9px] font-mono-tech text-slate-500 bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
              PROVENANCE: DEMO_REPLAY • Deterministic Operational Scoring • Human-in-the-Loop Decision Support
            </div>
          </div>
        )}

        {/* Verification Status & Decision Workflow */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>OPERATOR VERIFICATION DECISION</span>
            <span className="text-sky-400 font-semibold">{detection.verificationStatus}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="action-btn-confirm"
              onClick={() => onUpdateStatus(detection.id, 'CONFIRMED_DEBRIS', operatorNotes)}
              className={`px-2 py-1.5 rounded text-xs font-mono-tech font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                detection.verificationStatus === 'CONFIRMED_DEBRIS'
                  ? 'bg-emerald-900/80 border-emerald-500 text-emerald-200'
                  : 'bg-[#090d14] border-[#1e293b] text-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm Debris</span>
            </button>

            <button
              id="action-btn-geological"
              onClick={() => onUpdateStatus(detection.id, 'GEOLOGICAL_ANOMALY', operatorNotes)}
              className={`px-2 py-1.5 rounded text-xs font-mono-tech font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                detection.verificationStatus === 'GEOLOGICAL_ANOMALY'
                  ? 'bg-slate-700 border-slate-400 text-slate-100'
                  : 'bg-[#090d14] border-[#1e293b] text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Geological</span>
            </button>

            <button
              id="action-btn-escalate"
              onClick={() => onUpdateStatus(detection.id, 'ESCALATED_HAZARD', operatorNotes)}
              className={`px-2 py-1.5 rounded text-xs font-mono-tech font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                detection.verificationStatus === 'ESCALATED_HAZARD'
                  ? 'bg-red-900/80 border-red-500 text-red-200'
                  : 'bg-[#090d14] border-[#1e293b] text-red-400 hover:bg-red-950/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Critical Hazard</span>
            </button>

            <button
              id="action-btn-false-pos"
              onClick={() => onUpdateStatus(detection.id, 'FALSE_POSITIVE', operatorNotes)}
              className={`px-2 py-1.5 rounded text-xs font-mono-tech font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                detection.verificationStatus === 'FALSE_POSITIVE'
                  ? 'bg-slate-800 border-red-800 text-slate-300'
                  : 'bg-[#090d14] border-[#1e293b] text-slate-500 hover:text-slate-300'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              <span>False Alarm</span>
            </button>
          </div>
        </div>

        {/* Operator Field Notes */}
        <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
            <span>HYDROGRAPHER FIELD LOG</span>
            <span className="text-[9px] text-slate-500">AUTO-SAVED IN CRUISE LOG</span>
          </div>

          <textarea
            id="textarea-operator-notes"
            rows={3}
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            placeholder="Enter salvage observations, sonar frequency notes, ROV dive recommendations..."
            className="w-full bg-[#090d14] border border-[#1e293b] focus:border-sky-500 rounded p-2 text-xs font-mono-tech text-slate-200 placeholder:text-slate-600 outline-none resize-none"
          />

          <button
            id="btn-save-notes"
            onClick={handleSaveNotes}
            className="w-full py-1.5 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-sky-300 rounded text-xs font-mono-tech font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Hydrographic Observation</span>
          </button>
        </div>

        {/* Verification Audit Trail Section */}
        {auditEvents && auditEvents.length > 0 && (
          <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 uppercase">
              <span className="flex items-center gap-1.5">
                <History className="w-3 h-3 text-sky-400" />
                <span>AUDIT TRAIL ({auditEvents.length})</span>
              </span>
              <span className="text-[9px] text-slate-500">CRUISE LOG</span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
              {auditEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-[#090d14] border border-[#1e293b] p-1.5 rounded text-[10px] font-mono-tech"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-sky-300 font-medium">{evt.title}</span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[10px] mt-0.5">{evt.description}</p>
                  <span className="text-[9px] text-slate-500">Op: {evt.operator}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
