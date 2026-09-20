import React, { useState } from 'react';
import { 
  Sliders, 
  Palette, 
  MoveHorizontal, 
  Ruler, 
  MousePointer, 
  RotateCcw, 
  Crosshair,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Info
} from 'lucide-react';
import { SonarDetection, SonarPalette, TowfishTelemetry } from '../../types/sonar';
import { WaterfallCanvas } from './WaterfallCanvas';
import { useSurveyStore } from '../../store/surveyStore';

interface WaterfallWorkspaceProps {
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  telemetry: TowfishTelemetry;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const WaterfallWorkspace: React.FC<WaterfallWorkspaceProps> = ({
  detections,
  selectedDetection,
  onSelectDetection,
  telemetry,
  isPlaying,
  onTogglePlay,
}) => {
  // Store integration for Sonar Ingestion & Preprocessing Pipeline
  const {
    gain,
    tvg,
    contrast,
    isSlantRangeCorrected,
    setGain,
    setTvg,
    setContrast,
    setSlantRangeCorrected,
    currentSonarFrame,
    sonarFramesHistory,
    sonarProcessingStatus,
    sonarProcessingError,
    sonarQuality,
    lastValidFrameId,
    playbackSpeed,
    setPlaybackSpeed,
    stepNextPing,
    stepPrevPing,
    stopReplay,
  } = useSurveyStore();

  // Local display parameter state
  const [palette, setPalette] = useState<SonarPalette>('AMBER');
  const [activeTool, setActiveTool] = useState<'SELECT' | 'RULER' | 'SHADOW_CALC'>('SELECT');
  const [showQualityDetails, setShowQualityDetails] = useState<boolean>(false);
  const [measurementResult, setMeasurementResult] = useState<{
    lengthMeters: number;
    shadowMeters: number;
    calculatedHeightMeters: number;
  } | null>(null);

  const resetDisplayParams = () => {
    setGain(1.1);
    setContrast(1.2);
    setTvg(1.3);
    setSlantRangeCorrected(false);
  };

  const speeds = [0.25, 0.5, 1.0, 2.0, 4.0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-hidden">
      {/* Top Instrumentation Toolbar for Sonar Controls */}
      <div 
        id="sonar-controls-toolbar" 
        className="bg-[#0e141f] border-b border-[#1e293b] px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs"
      >
        {/* Left: Tool selector & Replay Engine Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tool selector: Select, Caliper, Shadow Calculator */}
          <div className="flex items-center gap-1 bg-[#090d14] border border-[#1e293b] p-0.5 rounded">
            <button
              id="tool-btn-select"
              onClick={() => setActiveTool('SELECT')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTool === 'SELECT'
                  ? 'bg-[#1e293b] text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Select & Inspect Detections"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select Target</span>
            </button>

            <button
              id="tool-btn-ruler"
              onClick={() => setActiveTool('RULER')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTool === 'RULER'
                  ? 'bg-[#1e293b] text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Measure acoustic distance & dimensions"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Caliper</span>
            </button>

            <button
              id="tool-btn-shadow"
              onClick={() => setActiveTool('SHADOW_CALC')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTool === 'SHADOW_CALC'
                  ? 'bg-[#1e293b] text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Calculate target height from acoustic shadow length"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Shadow Calc</span>
            </button>
          </div>

          {/* Sonar Ping Replay Engine Controls */}
          <div className="flex items-center gap-1 bg-[#090d14] border border-[#1e293b] px-1.5 py-0.5 rounded">
            <button
              id="replay-btn-prev"
              onClick={stepPrevPing}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] rounded transition-colors"
              title="Previous Ping"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              id="replay-btn-play-pause"
              onClick={onTogglePlay}
              className={`p-1 rounded transition-colors ${
                isPlaying 
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' 
                  : 'bg-sky-950/60 text-sky-400 border border-sky-800/60'
              }`}
              title={isPlaying ? 'Pause Replay Engine' : 'Resume Ping Replay'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              id="replay-btn-stop"
              onClick={stopReplay}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1e293b] rounded transition-colors"
              title="Stop and Reset to Initial Ping"
            >
              <Square className="w-3 h-3" />
            </button>

            <button
              id="replay-btn-next"
              onClick={stepNextPing}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] rounded transition-colors"
              title="Next Ping"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Playback speed selector */}
            <div className="flex items-center ml-1 border-l border-[#1e293b] pl-1.5 gap-1">
              <Gauge className="w-3 h-3 text-slate-500" />
              {speeds.map((s) => (
                <button
                  key={s}
                  id={`speed-btn-${s}`}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1 py-0.5 text-[9px] font-mono-tech rounded transition-colors ${
                    playbackSpeed === s
                      ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Processing State & Quality Indicator */}
        <div className="flex items-center gap-2">
          {/* Processing Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#090d14] border border-[#1e293b] text-[10px] font-mono-tech">
            <span className="text-slate-500 uppercase">PIPELINE:</span>
            <span 
              className={`font-semibold uppercase flex items-center gap-1 ${
                sonarProcessingStatus === 'READY'
                  ? 'text-emerald-400'
                  : sonarProcessingStatus === 'DEGRADED'
                  ? 'text-amber-400'
                  : 'text-sky-400'
              }`}
            >
              <span 
                className={`w-1.5 h-1.5 rounded-full ${
                  sonarProcessingStatus === 'READY' 
                    ? 'bg-emerald-400 animate-pulse' 
                    : sonarProcessingStatus === 'DEGRADED' 
                    ? 'bg-amber-400' 
                    : 'bg-sky-400'
                }`} 
              />
              {sonarProcessingStatus}
            </span>
          </div>

          {/* Acoustic Quality Score Badge */}
          {sonarQuality && (
            <div className="relative">
              <button
                id="quality-score-badge"
                onClick={() => setShowQualityDetails(!showQualityDetails)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono-tech transition-colors ${
                  sonarQuality.status === 'GOOD'
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/40'
                    : sonarQuality.status === 'ACCEPTABLE'
                    ? 'bg-sky-950/40 border-sky-800/50 text-sky-300 hover:bg-sky-900/40'
                    : 'bg-amber-950/50 border-amber-700/60 text-amber-300 hover:bg-amber-900/50'
                }`}
                title="Click to view acoustic quality flags"
              >
                <Activity className="w-3 h-3" />
                <span>QUALITY: {sonarQuality.score}/100</span>
                <span className="opacity-75">({sonarQuality.status})</span>
              </button>

              {/* Quality Flags Popover */}
              {showQualityDetails && (
                <div 
                  id="quality-details-popover"
                  className="absolute right-0 top-8 z-30 w-72 bg-[#090d14] border border-[#2c3a50] p-2.5 rounded shadow-xl text-[10px] font-mono-tech"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#1e293b] text-slate-300">
                    <span className="font-semibold text-sky-400">ACOUSTIC QUALITY ASSESSMENT</span>
                    <button 
                      onClick={() => setShowQualityDetails(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 py-1.5 text-slate-400 border-b border-[#1e293b]">
                    <div>Dynamic Range: <strong className="text-slate-200">{sonarQuality.dynamicRangeDb} dB</strong></div>
                    <div>Noise Floor: <strong className="text-slate-200">{sonarQuality.noiseFloorEstimate}</strong></div>
                    <div>Saturation: <strong className="text-slate-200">{sonarQuality.saturationPercentage}%</strong></div>
                    <div>Swath Symmetry: <strong className="text-emerald-400">Nominal</strong></div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <div className="text-slate-500 uppercase text-[9px]">Acoustic Flags:</div>
                    {sonarQuality.flags.map((flag, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-1 h-1 bg-sky-400 rounded-full flex-shrink-0" />
                        <span className="truncate">{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Preprocessing display calibration controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Slant-range correction toggle */}
          <button
            id="btn-toggle-slant-range"
            onClick={() => setSlantRangeCorrected(!isSlantRangeCorrected)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono-tech transition-colors ${
              isSlantRangeCorrected
                ? 'bg-sky-950/60 border-sky-700/60 text-sky-300 font-semibold'
                : 'bg-[#090d14] border-[#1e293b] text-slate-400 hover:text-slate-200'
            }`}
            title="Slant-Range to Ground-Range conversion (removes nadir water gap using altitude)"
          >
            <MoveHorizontal className="w-3 h-3" />
            <span>SLANT-CORR: {isSlantRangeCorrected ? 'ON' : 'OFF'}</span>
          </button>

          {/* Color Palette Selector */}
          <div className="flex items-center gap-1 bg-[#090d14] border border-[#1e293b] px-1.5 py-0.5 rounded">
            <Palette className="w-3 h-3 text-slate-400" />
            {(['AMBER', 'GRAYSCALE', 'OCEAN', 'COPPER_INVERTED'] as SonarPalette[]).map((p) => (
              <button
                key={p}
                id={`palette-btn-${p.toLowerCase()}`}
                onClick={() => setPalette(p)}
                className={`px-1 py-0.5 text-[9px] font-mono-tech rounded transition-colors ${
                  palette === p
                    ? 'bg-[#1e293b] text-sky-400 font-bold border border-[#2c3a50]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'COPPER_INVERTED' ? 'INV' : p.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Sliders: Gain & TVG */}
          <div className="flex items-center gap-2 bg-[#090d14] border border-[#1e293b] px-2 py-0.5 rounded">
            {/* Gain */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono-tech text-slate-400">GAIN</span>
              <input
                id="slider-gain"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={gain}
                onChange={(e) => setGain(parseFloat(e.target.value))}
                className="w-12 h-1 bg-[#1e293b] accent-sky-400 rounded cursor-pointer"
                title="Acoustic Receiver Gain"
              />
              <span className="text-[9px] font-mono-tech text-slate-300 w-6">
                {gain.toFixed(1)}x
              </span>
            </div>

            {/* TVG */}
            <div className="flex items-center gap-1 border-l border-[#1e293b] pl-1.5">
              <span className="text-[9px] font-mono-tech text-slate-400">TVG</span>
              <input
                id="slider-tvg"
                type="range"
                min="1.0"
                max="2.0"
                step="0.05"
                value={tvg}
                onChange={(e) => setTvg(parseFloat(e.target.value))}
                className="w-12 h-1 bg-[#1e293b] accent-sky-400 rounded cursor-pointer"
                title="Time-Varying Gain (Range Attenuation Compensation)"
              />
              <span className="text-[9px] font-mono-tech text-slate-300 w-6">
                {tvg.toFixed(1)}x
              </span>
            </div>

            {/* Reset button */}
            <button
              id="btn-reset-display"
              onClick={resetDisplayParams}
              className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-slate-200 rounded"
              title="Reset display calibration to default"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Degradation / Error Banner (Section 15: Error and Fallback Behavior) */}
      {sonarProcessingStatus === 'DEGRADED' && (
        <div 
          id="sonar-degraded-banner"
          className="bg-amber-950/80 border-b border-amber-700/80 px-3 py-1.5 flex items-center justify-between text-xs font-mono-tech text-amber-200 z-10"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="font-bold text-amber-300">SONAR PROCESSING DEGRADED:</span>
            <span>{sonarProcessingError || 'Acoustic sample saturation / channel imbalance detected.'}</span>
          </div>
          <div className="text-[10px] text-amber-400">
            Last valid frame: <strong className="text-slate-100">{lastValidFrameId || 'NONE'}</strong>
          </div>
        </div>
      )}

      {/* Primary Sonar Waterfall Viewport */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-2">
        <WaterfallCanvas
          detections={detections}
          selectedDetection={selectedDetection}
          onSelectDetection={onSelectDetection}
          palette={palette}
          gain={gain}
          contrast={contrast}
          tvg={tvg}
          isSlantRangeCorrected={isSlantRangeCorrected}
          isPlaying={isPlaying}
          telemetry={telemetry}
          activeTool={activeTool}
          onMeasurementComplete={(res) => setMeasurementResult(res)}
          currentSonarFrame={currentSonarFrame}
          sonarFramesHistory={sonarFramesHistory}
        />

        {/* Live Active Measurement Caliper Readout Bar */}
        {measurementResult && (
          <div 
            id="active-measurement-banner" 
            className="absolute bottom-4 bg-[#090d14]/95 border border-amber-500/60 text-slate-200 px-3.5 py-1.5 rounded shadow-lg flex items-center gap-4 text-xs font-mono-tech z-10"
          >
            <div className="flex items-center gap-1.5 text-amber-400">
              <Ruler className="w-4 h-4" />
              <span className="font-semibold">ACOUSTIC CALIPER:</span>
            </div>
            <div>
              <span className="text-slate-400">ACOUSTIC SHADOW:</span>{' '}
              <strong className="text-slate-100">{measurementResult.shadowMeters.toFixed(2)} m</strong>
            </div>
            <div className="border-l border-[#1e293b] pl-3">
              <span className="text-slate-400">ESTIMATED VERTICAL RELIEF:</span>{' '}
              <strong className="text-emerald-400 text-sm">{measurementResult.calculatedHeightMeters.toFixed(2)} m</strong>
            </div>
            <div className="text-[10px] text-slate-400 hidden sm:inline">
              [h = (L_shadow × H_alt) / R_slant]
            </div>
            <button
              onClick={() => setMeasurementResult(null)}
              className="text-slate-400 hover:text-slate-200 ml-2"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Bottom Ping History & Quick Target Bookmark Rail */}
      <div 
        id="waterfall-bottom-dock" 
        className="bg-[#0e141f] border-t border-[#1e293b] px-3 py-1.5 flex items-center justify-between gap-2 text-xs select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-tech text-slate-400 uppercase">
            TARGET BOOKMARKS ({detections.length}):
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[55vw]">
            {detections.map((det) => {
              const isSelected = selectedDetection?.id === det.id;
              return (
                <button
                  key={det.id}
                  id={`chip-target-${det.id}`}
                  onClick={() => onSelectDetection(det)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-tech transition-colors border flex-shrink-0 ${
                    isSelected
                      ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-semibold ring-1 ring-sky-400'
                      : det.severity === 'CRITICAL'
                      ? 'bg-red-950/40 border-red-800/60 text-red-300 hover:bg-red-900/40'
                      : det.severity === 'HIGH'
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
                      : 'bg-[#131b29] border-[#1e293b] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span>{det.id}</span>
                  <span className="text-[9px] opacity-75">({det.channel === 'PORT' ? 'P' : 'S'})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 text-[10px] font-mono-tech text-slate-400">
          <span>FRAME: <strong className="text-slate-200">#{currentSonarFrame?.pingNumber || telemetry.pingId}</strong></span>
          <span>ORIGIN: <strong className="text-sky-400">{currentSonarFrame?.dataOrigin.acousticSamples || 'SIMULATED'}</strong></span>
          <span>SPEED: <strong className="text-slate-200">{playbackSpeed}x</strong></span>
          <span className="text-sky-400">410 kHz CHIRP</span>
        </div>
      </div>
    </div>
  );
};
