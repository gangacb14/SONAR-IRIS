import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Target, 
  AlertTriangle, 
  ShieldAlert, 
  Flame,
  Grid,
  ChevronDown,
  ChevronRight,
  X,
  Crosshair,
  Radar,
  Info,
  SlidersHorizontal,
  GitCompare,
  Sparkles,
  Globe
} from 'lucide-react';
import { SonarDetection, SurveyMission, SurveyTransect, TowfishTelemetry } from '../../types/sonar';
import { useSurveyStore } from '../../store/surveyStore';
import { GeoIntFilterType } from '../../types/geoint';
import { MissionPriorityQueuePanel } from '../followUp/MissionPriorityQueuePanel';
import { IndiaWatersMap } from './IndiaWatersMap';

interface GeospatialMapViewProps {
  mission: SurveyMission;
  transects: SurveyTransect[];
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  telemetry: TowfishTelemetry;
}

export const GeospatialMapView: React.FC<GeospatialMapViewProps> = ({
  mission,
  transects,
  detections,
  selectedDetection,
  onSelectDetection,
  telemetry,
}) => {
  const {
    activeRegionId,
    activeRegion,
    availableRegions,
    switchSurveyRegion,
    geointResult,
    selectedHotspotId,
    selectedHotspot,
    activeTargetHotspot,
    selectHotspot,
    geointFilter,
    setGeointFilter,
    surveyComparison,
    followUpResult,
    followUpRecommendations,
    selectedRecommendationId,
    selectRecommendation,
  } = useSurveyStore();

  // Scope: India Waters Overview (7 Regions) vs Local Sector Hydrographic Swath
  const [chartScope, setChartScope] = useState<'NATIONAL_OVERVIEW' | 'SECTOR_SWATH'>('NATIONAL_OVERVIEW');

  // Layer toggles
  const [showBathymetry, setShowBathymetry] = useState<boolean>(true);
  const [showSwathFootprint, setShowSwathFootprint] = useState<boolean>(true);
  const [showFairwayZone, setShowFairwayZone] = useState<boolean>(true);
  const [showSoundings, setShowSoundings] = useState<boolean>(true);
  const [showTransectLabels, setShowTransectLabels] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showHazardDensity, setShowHazardDensity] = useState<boolean>(false);
  const [showTemporalOverlay, setShowTemporalOverlay] = useState<boolean>(true);
  const [showFollowUpPriority, setShowFollowUpPriority] = useState<boolean>(true);
  const [isGeoIntPanelOpen, setIsGeoIntPanelOpen] = useState<boolean>(true);
  const [isMissionQueueOpen, setIsMissionQueueOpen] = useState<boolean>(false);

  // Zoom / Pan / Cursor state
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number; utmX: number; utmY: number }>({
    lat: 9.24158,
    lng: 79.18244,
    utmX: 410050.2,
    utmY: 1021580.4,
  });

  // Reference coordinates for chart projection (Dynamically derived from active hydrographic survey region)
  const centerLat = activeRegion ? activeRegion.centerLat : 9.24158;
  const centerLng = activeRegion ? activeRegion.centerLng : 79.18244;
  const deltaLat = 0.025;
  const deltaLng = 0.025;
  const MIN_LNG = centerLng - deltaLng;
  const MAX_LNG = centerLng + deltaLng;
  const MIN_LAT = centerLat - deltaLat;
  const MAX_LAT = centerLat + deltaLat;

  const projectLng = (lng: number): number => {
    return ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 860 + 50;
  };

  const projectLat = (lat: number): number => {
    // Invert Y for SVG coordinates
    return 620 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 540;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Inverse projection to lat/lng
    const normX = Math.max(0, Math.min(1, (x - 50) / 860));
    const normY = Math.max(0, Math.min(1, (620 - y) / 540));

    const lng = MIN_LNG + normX * (MAX_LNG - MIN_LNG);
    const lat = MIN_LAT + normY * (MAX_LAT - MIN_LAT);

    setCursorPos({
      lat,
      lng,
      utmX: 408000 + normX * 4000,
      utmY: 1019000 + normY * 4000,
    });
  };

  // Filtered Hotspots based on current geointFilter
  const filteredHotspots = useMemo(() => {
    if (!geointResult?.hotspots) return [];
    if (geointFilter === 'ALL' || geointFilter === 'HOTSPOTS_ONLY') {
      return geointResult.hotspots;
    }
    if (geointFilter === 'CRITICAL') {
      return geointResult.hotspots.filter((h) => h.riskLevel === 'CRITICAL');
    }
    if (geointFilter === 'HIGH_RISK') {
      return geointResult.hotspots.filter((h) => h.riskLevel === 'HIGH' || h.riskLevel === 'CRITICAL');
    }
    if (geointFilter === 'UNCLUSTERED') {
      return [];
    }
    return geointResult.hotspots;
  }, [geointResult?.hotspots, geointFilter]);

  // Target map lookup for fast resolution
  const detectionsMap = useMemo(() => {
    const map = new Map<string, SonarDetection>();
    for (const d of detections) {
      map.set(d.id, d);
    }
    return map;
  }, [detections]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080d16] select-none overflow-hidden relative">
      {/* Top Map Toolbar */}
      <div 
        id="gis-map-toolbar" 
        className="bg-[#0e141f] border-b border-[#1e293b] px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Selector: India Overview vs Sector Swath */}
          <div className="flex items-center gap-1 bg-[#090d14] border border-sky-800/60 p-0.5 rounded">
            <button
              id="btn-map-scope-national"
              onClick={() => setChartScope('NATIONAL_OVERVIEW')}
              className={`px-2.5 py-1 rounded text-xs font-mono-tech transition-all flex items-center gap-1.5 ${
                chartScope === 'NATIONAL_OVERVIEW'
                  ? 'bg-sky-950 text-sky-300 font-semibold border border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>India Waters (7 Regions)</span>
            </button>
            <button
              id="btn-map-scope-sector"
              onClick={() => setChartScope('SECTOR_SWATH')}
              className={`px-2.5 py-1 rounded text-xs font-mono-tech transition-all flex items-center gap-1.5 ${
                chartScope === 'SECTOR_SWATH'
                  ? 'bg-sky-950 text-sky-300 font-semibold border border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Sector Swath ({activeRegion.name})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#090d14] border border-[#1e293b] rounded">
            <span className="text-[10px] font-mono-tech uppercase text-slate-300">
              {chartScope === 'NATIONAL_OVERVIEW' ? 'EEZ OVERVIEW • 7 REGIONS' : `${activeRegion.survey.crs}`}
            </span>
          </div>

          {/* Standard GIS Layer Toggles */}
          <div className="hidden lg:flex items-center gap-1 bg-[#090d14] border border-[#1e293b] p-0.5 rounded text-[11px]">
            <button
              id="btn-toggle-bathymetry"
              onClick={() => setShowBathymetry(!showBathymetry)}
              className={`px-2 py-0.5 rounded transition-colors ${
                showBathymetry ? 'bg-[#1e293b] text-sky-400 font-medium' : 'text-slate-500'
              }`}
            >
              Bathymetry
            </button>
            <button
              id="btn-toggle-swath"
              onClick={() => setShowSwathFootprint(!showSwathFootprint)}
              className={`px-2 py-0.5 rounded transition-colors ${
                showSwathFootprint ? 'bg-[#1e293b] text-sky-400 font-medium' : 'text-slate-500'
              }`}
            >
              Swath Ribbon
            </button>
            <button
              id="btn-toggle-fairway"
              onClick={() => setShowFairwayZone(!showFairwayZone)}
              className={`px-2 py-0.5 rounded transition-colors ${
                showFairwayZone ? 'bg-[#1e293b] text-amber-400 font-medium' : 'text-slate-500'
              }`}
            >
              Fairway Zone
            </button>
            <button
              id="btn-toggle-soundings"
              onClick={() => setShowSoundings(!showSoundings)}
              className={`px-2 py-0.5 rounded transition-colors ${
                showSoundings ? 'bg-[#1e293b] text-slate-200 font-medium' : 'text-slate-500'
              }`}
            >
              Soundings
            </button>
          </div>

          {/* Spatial Intelligence Layer Controls */}
          <div className="flex items-center gap-1 bg-[#090d14] border border-sky-900/40 p-0.5 rounded text-[11px]">
            <button
              id="btn-toggle-hotspots"
              onClick={() => setShowHotspots(!showHotspots)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                showHotspots ? 'bg-sky-950/80 text-sky-300 font-medium border border-sky-600/50' : 'text-slate-500'
              }`}
              title="Toggle Spatial Hazard Hotspot Clusters"
            >
              <Radar className="w-3 h-3 text-sky-400" />
              <span>Hotspots ({geointResult?.hotspots?.length || 0})</span>
            </button>

            <button
              id="btn-toggle-density-heatmap"
              onClick={() => setShowHazardDensity(!showHazardDensity)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                showHazardDensity ? 'bg-amber-950/80 text-amber-300 font-medium border border-amber-600/50' : 'text-slate-500'
              }`}
              title="Toggle Risk-Weighted Spatial Density Grid"
            >
              <Grid className="w-3 h-3 text-amber-400" />
              <span>Hazard Density</span>
            </button>

            <button
              id="btn-toggle-temporal-overlay"
              onClick={() => setShowTemporalOverlay(!showTemporalOverlay)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                showTemporalOverlay ? 'bg-cyan-950/80 text-cyan-300 font-medium border border-cyan-600/50' : 'text-slate-500'
              }`}
              title="Toggle Repeat-Survey Temporal Change Overlay"
            >
              <GitCompare className="w-3 h-3 text-cyan-400" />
              <span>Temporal Changes ({surveyComparison?.summary ? surveyComparison.summary.newTargets + surveyComparison.summary.changedTargets : 0})</span>
            </button>

            <button
              id="btn-toggle-followup-priority"
              onClick={() => setShowFollowUpPriority(!showFollowUpPriority)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                showFollowUpPriority ? 'bg-purple-950/80 text-purple-300 font-medium border border-purple-600/50' : 'text-slate-500'
              }`}
              title="Toggle AI Follow-Up Survey Priority Overlay"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Follow-Up Priority ({followUpRecommendations.length})</span>
            </button>

            <button
              id="btn-toggle-mission-queue"
              onClick={() => setIsMissionQueueOpen(!isMissionQueueOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                isMissionQueueOpen ? 'bg-purple-900 text-purple-200 font-bold border border-purple-500' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Open AI Follow-Up Mission Queue Operational Panel"
            >
              <span>Queue ({followUpResult?.summary?.criticalCount || 0} Crit)</span>
            </button>

            <button
              id="btn-toggle-geoint-panel"
              onClick={() => setIsGeoIntPanelOpen(!isGeoIntPanelOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                isGeoIntPanelOpen ? 'bg-[#1e293b] text-slate-200' : 'text-slate-500'
              }`}
              title="Toggle Spatial Intelligence Overview Panel"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              <span>Top Hazards</span>
            </button>
          </div>
        </div>

        {/* Live Cursor Coordinate Readout */}
        <div className="flex items-center gap-3 text-[11px] font-mono-tech bg-[#090d14] border border-[#1e293b] px-2.5 py-1 rounded">
          <div className="flex items-center gap-1 text-slate-300">
            <span className="text-slate-500">CURSOR:</span>
            <span>{cursorPos.lat.toFixed(5)}°N, {cursorPos.lng.toFixed(5)}°E</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-slate-400 border-l border-[#1e293b] pl-2">
            <span className="text-slate-500">UTM:</span>
            <span>44N {cursorPos.utmX.toFixed(0)}m E, {cursorPos.utmY.toFixed(0)}m N</span>
          </div>
        </div>
      </div>

      {chartScope === 'NATIONAL_OVERVIEW' ? (
        <IndiaWatersMap
          activeRegionId={activeRegionId}
          onSelectRegion={switchSurveyRegion}
          onViewSectorSwath={() => setChartScope('SECTOR_SWATH')}
        />
      ) : (
        /* Primary Geospatial SVG Chart (Local Sector Swath) */
        <div className="flex-1 relative w-full h-full overflow-hidden flex items-center justify-center p-2 marine-grid-bg">
        <svg
          id="hydrographic-map-svg"
          viewBox="0 0 960 680"
          onMouseMove={handleMouseMove}
          className="w-full h-full max-h-[82vh] object-contain border border-[#1e293b] bg-[#070b12]"
        >
          <defs>
            {/* Swath coverage strip pattern */}
            <pattern id="swathHatch" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.3" />
            </pattern>
            {/* Risk Fairway crosshatch */}
            <pattern id="riskHatch" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.25" />
            </pattern>
            {/* Hotspot Radial Glow */}
            <radialGradient id="hotspotGlowCritical" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hotspotGlowHigh" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            {/* Displacement arrow marker */}
            <marker id="displacementArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Graticule Grid Coordinates (Parallels & Meridians) */}
          <g className="opacity-25" stroke="#334155" strokeWidth="0.75" strokeDasharray="3,3">
            <line x1="50" y1="120" x2="910" y2="120" />
            <line x1="50" y1="240" x2="910" y2="240" />
            <line x1="50" y1="360" x2="910" y2="360" />
            <line x1="50" y1="480" x2="910" y2="480" />
            <line x1="50" y1="600" x2="910" y2="600" />

            <line x1="180" y1="40" x2="180" y2="640" />
            <line x1="360" y1="40" x2="360" y2="640" />
            <line x1="540" y1="40" x2="540" y2="640" />
            <line x1="720" y1="40" x2="720" y2="640" />
          </g>

          {/* Graticule coordinate labels */}
          <g fontSize="9" fontFamily="ui-monospace, monospace" fill="#64748b">
            <text x="55" y="115">9°15'00"N</text>
            <text x="55" y="235">9°14'30"N</text>
            <text x="55" y="355">9°14'00"N</text>
            <text x="55" y="475">9°13'30"N</text>
            <text x="55" y="595">9°13'00"N</text>

            <text x="185" y="635">79°10'30"E</text>
            <text x="365" y="635">79°11'00"E</text>
            <text x="545" y="635">79°11'30"E</text>
            <text x="725" y="635">79°12'00"E</text>
          </g>

          {/* Shipping Fairway Buffer Zone (Hazard / Anchor Restriction) */}
          {showFairwayZone && (
            <g id="fairway-risk-zone">
              <polygon
                points="120,80 840,110 810,210 90,180"
                fill="url(#riskHatch)"
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="6,3"
                strokeOpacity="0.7"
              />
              <text
                x="140"
                y="145"
                fill="#f59e0b"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fontWeight="bold"
                letterSpacing="1"
                opacity="0.8"
              >
                RESTRICTED SHIPPING FAIRWAY / ANCHORING PROHIBITED (ZONE BRAVO)
              </text>
            </g>
          )}

          {/* Bathymetric Depth Contours (Isobaths) */}
          {showBathymetry && (
            <g id="bathymetry-isobaths" stroke="#0ea5e9" strokeOpacity="0.45" fill="none">
              <path d="M 60,80 Q 240,140 460,110 T 900,130" strokeWidth="1" />
              <text x="80" y="75" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" opacity="0.6">-20m</text>

              <path d="M 60,190 Q 280,230 520,200 T 900,240" strokeWidth="1.2" />
              <text x="80" y="185" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" opacity="0.6">-35m</text>

              <path d="M 60,320 Q 320,380 580,310 T 900,360" strokeWidth="1.4" />
              <text x="80" y="315" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" opacity="0.8">-45m</text>

              <path d="M 60,460 Q 350,510 640,440 T 900,490" strokeWidth="1.6" />
              <text x="80" y="455" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" opacity="0.8">-55m</text>

              <path d="M 60,580 Q 380,620 700,560 T 900,610" strokeWidth="1.8" />
              <text x="80" y="575" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" opacity="0.8">-65m</text>
            </g>
          )}

          {/* Soundings (Scattered depth numbers) */}
          {showSoundings && (
            <g id="depth-soundings" fontSize="9" fontFamily="ui-monospace, monospace" fill="#64748b" textAnchor="middle">
              <text x="210" y="100">22.4</text>
              <text x="440" y="150">31.8</text>
              <text x="680" y="170">34.2</text>
              <text x="180" y="270">41.6</text>
              <text x="390" y="280">43.2</text>
              <text x="620" y="290">46.5</text>
              <text x="240" y="410">48.9</text>
              <text x="480" y="420">51.2</text>
              <text x="730" y="430">53.6</text>
              <text x="290" y="540">58.4</text>
              <text x="560" y="550">61.0</text>
              <text x="810" y="560">64.2</text>
            </g>
          )}

          {/* Survey Transect Tracks and Swath Footprint Polygons */}
          {transects.map((tr) => {
            const x1 = projectLng(tr.startCoord[0]);
            const y1 = projectLat(tr.startCoord[1]);
            const x2 = projectLng(tr.endCoord[0]);
            const y2 = projectLat(tr.endCoord[1]);

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = (-dy / len) * 18;
            const ny = (dx / len) * 18;

            const isDone = tr.status === 'COMPLETED';
            const isActive = tr.status === 'IN_PROGRESS';

            return (
              <g key={tr.id} id={`transect-${tr.id}`}>
                {showSwathFootprint && (
                  <polygon
                    points={`${x1 - nx},${y1 - ny} ${x2 - nx},${y2 - ny} ${x2 + nx},${y2 + ny} ${x1 + nx},${y1 + ny}`}
                    fill={isDone ? '#0284c7' : isActive ? 'url(#swathHatch)' : '#1e293b'}
                    fillOpacity={isDone ? '0.22' : '0.4'}
                    stroke={isActive ? '#38bdf8' : '#0369a1'}
                    strokeWidth="0.75"
                    strokeDasharray={isActive ? '4,2' : 'none'}
                  />
                )}

                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isActive ? '#38bdf8' : isDone ? '#0284c7' : '#475569'}
                  strokeWidth={isActive ? '2' : '1.5'}
                  strokeDasharray={isActive ? 'none' : isDone ? 'none' : '4,3'}
                />

                {showTransectLabels && (
                  <text
                    x={(x1 + x2) / 2 + 10}
                    y={(y1 + y2) / 2}
                    fill={isActive ? '#38bdf8' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fontWeight={isActive ? 'bold' : 'normal'}
                  >
                    {tr.id} ({tr.bearingDeg}° - {tr.lengthMeters}m)
                  </text>
                )}
              </g>
            );
          })}

          {/* HAZARD DENSITY GRID OVERLAY (HEATMAP) */}
          {showHazardDensity && geointResult?.densityCells && (
            <g id="hazard-density-heatmap-layer">
              {geointResult.densityCells.map((cell) => {
                const x1 = projectLng(cell.bounds.minLng);
                const x2 = projectLng(cell.bounds.maxLng);
                const y1 = projectLat(cell.bounds.maxLat);
                const y2 = projectLat(cell.bounds.minLat);
                const width = Math.max(12, Math.abs(x2 - x1));
                const height = Math.max(12, Math.abs(y2 - y1));
                const cx = Math.min(x1, x2);
                const cy = Math.min(y1, y2);

                const cellColor =
                  cell.criticalCount > 0
                    ? '#f43f5e'
                    : cell.highCount > 0
                    ? '#f59e0b'
                    : '#38bdf8';

                return (
                  <rect
                    key={cell.cellId}
                    id={`density-${cell.cellId}`}
                    x={cx}
                    y={cy}
                    width={width}
                    height={height}
                    fill={cellColor}
                    fillOpacity={Math.min(0.45, Math.max(0.12, cell.intensity * 0.4))}
                    stroke={cellColor}
                    strokeWidth={0.75}
                    strokeOpacity={Math.max(0.2, cell.intensity * 0.6)}
                    rx={3}
                  />
                );
              })}
            </g>
          )}

          {/* SPATIAL HAZARD HOTSPOTS LAYER */}
          {showHotspots && (
            <g id="hazard-hotspots-layer">
              {filteredHotspots.map((h) => {
                const cx = projectLng(h.centerLongitude);
                const cy = projectLat(h.centerLatitude);
                const isSelected = selectedHotspotId === h.id;
                const containsActiveTarget = activeTargetHotspot?.id === h.id;

                // Scale radius in meters to chart coordinates
                // Survey height is ~3660m across 540 pixels = ~0.1475 px/meter
                const rPix = Math.max(32, Math.min(130, Math.round(h.radiusMeters * 0.16)));

                const color =
                  h.riskLevel === 'CRITICAL'
                    ? '#f43f5e'
                    : h.riskLevel === 'HIGH'
                    ? '#f59e0b'
                    : h.riskLevel === 'MODERATE'
                    ? '#38bdf8'
                    : '#64748b';

                return (
                  <g
                    key={h.id}
                    id={`hotspot-group-${h.id}`}
                    onClick={() => selectHotspot(isSelected ? null : h.id)}
                    className="cursor-pointer group"
                  >
                    {/* Active Target / Selection Ring */}
                    {(isSelected || containsActiveTarget) && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={rPix + 6}
                        fill="none"
                        stroke={isSelected ? '#38bdf8' : color}
                        strokeWidth={2}
                        strokeDasharray="4,2"
                        className="animate-pulse"
                      />
                    )}

                    {/* Hotspot Boundary Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rPix}
                      fill={color}
                      fillOpacity={isSelected ? 0.22 : containsActiveTarget ? 0.16 : 0.08}
                      stroke={color}
                      strokeWidth={isSelected ? 2.5 : containsActiveTarget ? 2 : 1.5}
                      strokeDasharray="5,3"
                    />

                    {/* Center Hotspot Emblem / Rank Badge */}
                    <g transform={`translate(${cx}, ${cy})`}>
                      <rect
                        x="-20"
                        y="-11"
                        width="40"
                        height="22"
                        rx="3"
                        fill="#090d14"
                        fillOpacity="0.95"
                        stroke={isSelected ? '#38bdf8' : color}
                        strokeWidth={isSelected ? 2 : 1.2}
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill={color}
                        fontSize="11"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="bold"
                      >
                        #{h.rank}
                      </text>
                      <text
                        x="0"
                        y="22"
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize="8"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="bold"
                      >
                        {h.targetCount} TRG
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* Real-time Towfish AUV Position Marker */}
          {(() => {
            const fishX = projectLng(telemetry.lng);
            const fishY = projectLat(telemetry.lat);

            return (
              <g id="towfish-live-marker" transform={`translate(${fishX}, ${fishY})`}>
                <path
                  d="M 0 0 L -35 -40 L 35 -40 Z"
                  fill="#38bdf8"
                  fillOpacity="0.15"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  transform={`rotate(${telemetry.headingDeg})`}
                />

                <circle r="14" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" className="animate-ping" />
                <circle r="5" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-18"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  transform={`rotate(${telemetry.headingDeg})`}
                />

                <text
                  x="12"
                  y="4"
                  fill="#38bdf8"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                >
                  AUV HUGIN-6000 [3.4 kts]
                </text>
              </g>
            );
          })()}

          {/* Sonar Detections / Anomalies Markers */}
          {detections.map((det) => {
            const lng = det.longitude ?? det.coordinates.lng;
            const lat = det.latitude ?? det.coordinates.lat;
            const x = projectLng(lng);
            const y = projectLat(lat);
            const isSelected = selectedDetection?.id === det.id;

            // Check if this detection belongs to the selected hotspot
            const isInSelectedHotspot = selectedHotspot?.targetIds?.includes(det.id);

            // Opacity handling when filtering
            const isUnclustered = geointResult?.unclusteredTargetIds?.includes(det.id);
            let markerOpacity = 1.0;
            if (geointFilter === 'HOTSPOTS_ONLY' && isUnclustered) {
              markerOpacity = 0.3;
            } else if (geointFilter === 'UNCLUSTERED' && !isUnclustered) {
              markerOpacity = 0.3;
            } else if (selectedHotspotId && !isInSelectedHotspot) {
              markerOpacity = 0.55;
            }

            const effectiveRisk = det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel;
            const markerColor =
              effectiveRisk === 'CRITICAL'
                ? '#f43f5e'
                : effectiveRisk === 'HIGH'
                ? '#f59e0b'
                : effectiveRisk === 'MODERATE'
                ? '#38bdf8'
                : det.verificationStatus === 'GEOLOGICAL_ANOMALY' || effectiveRisk === 'LOW'
                ? '#64748b'
                : det.severity === 'CRITICAL'
                ? '#f43f5e'
                : det.severity === 'HIGH'
                ? '#f59e0b'
                : '#10b981';

            const rank = det.riskAssessment?.priorityRank;
            const labelText = rank ? `#${rank} ${det.id}` : det.id;
            const labelWidth = rank ? 78 : 68;

            const temporalChange = surveyComparison?.allChanges?.find((c) => c.targetId === det.id);
            const isNewTarget = showTemporalOverlay && temporalChange?.changeType === 'NEW';
            const isChangedTarget = showTemporalOverlay && temporalChange?.changeType === 'CHANGED';

            return (
              <g
                key={det.id}
                id={`map-pin-${det.id}`}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectDetection(det)}
                opacity={markerOpacity}
                className="cursor-pointer group"
              >
                {/* Temporal Displacement Vector (arrow from previous baseline coordinates) */}
                {isChangedTarget && temporalChange?.previousTarget?.coordinates && (
                  <g id={`displacement-vector-${det.id}`} className="pointer-events-none">
                    <circle
                      cx={projectLng(temporalChange.previousTarget.coordinates.lng) - x}
                      cy={projectLat(temporalChange.previousTarget.coordinates.lat) - y}
                      r="4"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                      strokeDasharray="2,2"
                    />
                    <line
                      x1={projectLng(temporalChange.previousTarget.coordinates.lng) - x}
                      y1={projectLat(temporalChange.previousTarget.coordinates.lat) - y}
                      x2={0}
                      y2={0}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                      markerEnd="url(#displacementArrow)"
                    />
                  </g>
                )}

                {/* Outer Selection Highlight Halo */}
                {isSelected && (
                  <circle r="16" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,2" />
                )}

                {/* Hotspot Member Accent Halo */}
                {isInSelectedHotspot && !isSelected && (
                  <circle r="13" fill="none" stroke={markerColor} strokeWidth="1.5" strokeDasharray="2,2" />
                )}

                {/* Target Pin Marker */}
                <rect
                  x="-6"
                  y="-6"
                  width="12"
                  height="12"
                  fill="#090d14"
                  stroke={markerColor}
                  strokeWidth={isSelected ? '2.5' : isInSelectedHotspot ? '2' : '1.5'}
                  transform="rotate(45)"
                />
                <circle r="2.5" fill={markerColor} />

                {/* Label Tag */}
                <g transform="translate(10, -6)">
                  <rect
                    x="0"
                    y="0"
                    width={labelWidth}
                    height="16"
                    fill="#090d14"
                    fillOpacity="0.92"
                    stroke={isSelected ? '#38bdf8' : isInSelectedHotspot ? markerColor : '#1e293b'}
                    rx="2"
                  />
                  <text
                    x="4"
                    y="11"
                    fill={isSelected ? '#38bdf8' : effectiveRisk === 'CRITICAL' ? '#fda4af' : '#e2e8f0'}
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    fontWeight="bold"
                  >
                    {labelText}
                  </text>

                  {/* Temporal Status Badge on Map Pin */}
                  {isNewTarget && (
                    <g transform={`translate(${labelWidth + 2}, 0)`}>
                      <rect x="0" y="0" width="30" height="16" fill="#064e3b" stroke="#10b981" rx="2" />
                      <text x="5" y="11" fill="#6ee7b7" fontSize="8" fontFamily="ui-monospace, monospace" fontWeight="bold">
                        NEW
                      </text>
                    </g>
                  )}

                  {isChangedTarget && (
                    <g transform={`translate(${labelWidth + 2}, 0)`}>
                      <rect x="0" y="0" width="28" height="16" fill="#78350f" stroke="#f59e0b" rx="2" />
                      <text x="4" y="11" fill="#fde68a" fontSize="8" fontFamily="ui-monospace, monospace" fontWeight="bold">
                        Δ{temporalChange?.changeScore}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}

          {/* GHOST MARKERS FOR REMOVED TARGETS IN REPEAT SURVEY */}
          {showTemporalOverlay && surveyComparison?.removedTargets?.map((rem) => {
            const coords = rem.previousTarget?.coordinates ?? rem.currentTarget?.coordinates;
            if (!coords) return null;
            const rx = projectLng(coords.lng);
            const ry = projectLat(coords.lat);
            return (
              <g
                key={rem.id}
                id={`removed-pin-${rem.id}`}
                transform={`translate(${rx}, ${ry})`}
                className="cursor-pointer"
                title={`Target ${rem.id} from 2025 survey not detected in current survey (confirmed clear/missing)`}
              >
                <circle r="10" fill="#450a0a" fillOpacity="0.4" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3,2" />
                <line x1="-4" y1="-4" x2="4" y2="4" stroke="#f43f5e" strokeWidth="1.5" />
                <line x1="-4" y1="4" x2="4" y2="-4" stroke="#f43f5e" strokeWidth="1.5" />
                <g transform="translate(12, -6)">
                  <rect x="0" y="0" width="88" height="16" fill="#090d14" fillOpacity="0.9" stroke="#f43f5e" rx="2" />
                  <text x="4" y="11" fill="#fca5a5" fontSize="8" fontFamily="ui-monospace, monospace" fontWeight="bold">
                    REMOVED: {rem.id}
                  </text>
                </g>
              </g>
            );
          })}

          {/* FOLLOW-UP MISSION RECOMMENDATION OVERLAYS */}
          {showFollowUpPriority && (
            <g id="followup-priority-layer">
              {followUpRecommendations.map((rec) => {
                const isSelected = selectedRecommendationId === rec.id;
                if (rec.centerLongitude === undefined || rec.centerLatitude === undefined) return null;
                const px = projectLng(rec.centerLongitude);
                const py = projectLat(rec.centerLatitude);
                const urgency = rec.operatorOverride?.urgency || rec.urgency;
                const ringColor =
                  urgency === 'CRITICAL' ? '#f43f5e' :
                  urgency === 'HIGH' ? '#f59e0b' :
                  urgency === 'MODERATE' ? '#38bdf8' : '#a855f7';

                return (
                  <g
                    key={`followup-marker-${rec.id}`}
                    id={`followup-marker-${rec.id}`}
                    transform={`translate(${px}, ${py})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectRecommendation(rec.id);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing Priority Ring */}
                    <circle
                      r={rec.hotspotId ? 38 : 22}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray="4,3"
                      className={isSelected ? 'animate-pulse' : ''}
                      opacity={isSelected ? 0.9 : 0.6}
                    />

                    {/* Top Rank Badge on Map */}
                    {rec.rank <= 6 && (
                      <g transform="translate(0, -28)">
                        <rect
                          x="-35"
                          y="-9"
                          width="70"
                          height="18"
                          rx="3"
                          fill="#090d14"
                          fillOpacity="0.95"
                          stroke={ringColor}
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill={ringColor}
                          fontSize="9"
                          fontFamily="ui-monospace, monospace"
                          fontWeight="bold"
                        >
                          #{rec.rank} {urgency}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Nautical Chart Compass Rose */}
          <g id="compass-rose" transform="translate(880, 80)">
            <circle r="36" fill="#090d14" fillOpacity="0.8" stroke="#1e293b" strokeWidth="1" />
            <line x1="0" y1="-32" x2="0" y2="32" stroke="#475569" strokeWidth="1" />
            <line x1="-32" y1="0" x2="32" y2="0" stroke="#475569" strokeWidth="1" />
            <polygon points="0,-32 -5,-12 0,-16 5,-12" fill="#ef4444" />
            <polygon points="0,32 -5,12 0,16 5,12" fill="#94a3b8" />
            <text x="-4" y="-36" fill="#ef4444" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="bold">N</text>
            <text x="36" y="4" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">E</text>
            <text x="-4" y="46" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">S</text>
            <text x="-46" y="4" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, monospace">W</text>
          </g>

          {/* Calibrated Distance Scale Bar */}
          <g id="scale-bar" transform="translate(50, 640)">
            <rect x="0" y="-12" width="200" height="18" fill="#090d14" fillOpacity="0.85" rx="2" stroke="#1e293b" />
            <line x1="10" y1="0" x2="190" y2="0" stroke="#cbd5e1" strokeWidth="2" />
            <line x1="10" y1="-5" x2="10" y2="5" stroke="#cbd5e1" strokeWidth="2" />
            <line x1="100" y1="-3" x2="100" y2="3" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="190" y1="-5" x2="190" y2="5" stroke="#cbd5e1" strokeWidth="2" />
            <text x="10" y="-6" fill="#cbd5e1" fontSize="9" fontFamily="ui-monospace, monospace">0</text>
            <text x="95" y="-6" fill="#cbd5e1" fontSize="9" fontFamily="ui-monospace, monospace">500m</text>
            <text x="175" y="-6" fill="#cbd5e1" fontSize="9" fontFamily="ui-monospace, monospace">1,000m</text>
          </g>
        </svg>

        {/* FLOATING MISSION PRIORITY QUEUE DRAWER (TOP-RIGHT) */}
        {isMissionQueueOpen && (
          <div 
            id="floating-mission-priority-drawer"
            className="absolute top-4 right-4 w-96 max-h-[calc(100%-2rem)] z-20"
          >
            <MissionPriorityQueuePanel onClose={() => setIsMissionQueueOpen(false)} />
          </div>
        )}

        {/* FLOATING SPATIAL INTELLIGENCE & HAZARD HOTSPOTS DRAWER (TOP-LEFT) */}
        {isGeoIntPanelOpen && (
          <div 
            id="geoint-hazard-panel"
            className="absolute top-4 left-4 w-80 max-h-[calc(100%-2rem)] bg-[#090d14]/95 border border-[#1e293b] rounded-lg shadow-2xl flex flex-col z-20 overflow-hidden font-mono-tech backdrop-blur-sm"
          >
            {/* Header */}
            <div className="bg-[#0e141f] border-b border-[#1e293b] p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-bold text-slate-200">SPATIAL INTELLIGENCE</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-sky-950 text-sky-300 border border-sky-800 rounded">
                  {geointResult?.provenance || 'DERIVED'}
                </span>
              </div>
              <button
                onClick={() => setIsGeoIntPanelOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
                title="Collapse Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-[#0b101a] border-b border-[#1e293b] text-center text-[10px]">
              <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                <div className="text-slate-500">HOTSPOTS</div>
                <div className="text-slate-200 font-bold text-xs">{geointResult?.summary?.totalHotspots || 0}</div>
              </div>
              <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                <div className="text-rose-400">CRITICAL</div>
                <div className="text-rose-400 font-bold text-xs">{geointResult?.summary?.criticalHotspots || 0}</div>
              </div>
              <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                <div className="text-amber-400">HIGH</div>
                <div className="text-amber-400 font-bold text-xs">{geointResult?.summary?.highRiskHotspots || 0}</div>
              </div>
              <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                <div className="text-slate-400">UNCLUST</div>
                <div className="text-slate-300 font-bold text-xs">{geointResult?.summary?.unclusteredTargets || 0}</div>
              </div>
            </div>

            {/* Spatial Filter Pills */}
            <div className="px-2 py-1.5 bg-[#090d14] border-b border-[#1e293b] flex items-center gap-1 overflow-x-auto text-[9px]">
              {(['ALL', 'HOTSPOTS_ONLY', 'CRITICAL', 'HIGH_RISK', 'UNCLUSTERED'] as GeoIntFilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setGeointFilter(f)}
                  className={`px-1.5 py-0.5 rounded border whitespace-nowrap transition-colors ${
                    geointFilter === f
                      ? 'bg-sky-950 text-sky-300 border-sky-600'
                      : 'bg-transparent text-slate-400 border-[#1e293b] hover:border-slate-600'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto max-h-[50vh] p-2 space-y-2">
              {/* SELECTED HOTSPOT INVESTIGATOR CARD */}
              {selectedHotspot && (
                <div 
                  id="selected-hotspot-card"
                  className="bg-[#0e1626] border border-sky-500/50 rounded p-2.5 space-y-2 text-[11px]"
                >
                  <div className="flex items-center justify-between border-b border-sky-900/60 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        selectedHotspot.riskLevel === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-600'
                          : selectedHotspot.riskLevel === 'HIGH'
                          ? 'bg-amber-950 text-amber-300 border border-amber-600'
                          : 'bg-sky-950 text-sky-300 border border-sky-600'
                      }`}>
                        HOTSPOT #{selectedHotspot.rank}
                      </span>
                      <span className="font-bold text-slate-200">
                        {selectedHotspot.riskLevel}
                      </span>
                    </div>
                    <button
                      onClick={() => selectHotspot(null)}
                      className="text-slate-400 hover:text-slate-200 text-[10px]"
                    >
                      Deselect
                    </button>
                  </div>

                  {/* Hotspot Metrics Grid */}
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                      <span className="text-slate-500 block">PRIORITY</span>
                      <span className="text-slate-200 font-bold text-xs">{selectedHotspot.priorityScore}</span>
                    </div>
                    <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                      <span className="text-slate-500 block">TARGETS</span>
                      <span className="text-slate-200 font-bold text-xs">{selectedHotspot.targetCount}</span>
                    </div>
                    <div className="p-1 bg-[#090d14] rounded border border-[#1e293b]">
                      <span className="text-slate-500 block">RADIUS</span>
                      <span className="text-slate-200 font-bold text-xs">{selectedHotspot.radiusMeters}m</span>
                    </div>
                  </div>

                  {/* Dominant Categories */}
                  <div className="flex items-center gap-1 flex-wrap text-[9px]">
                    <span className="text-slate-500">DOMINANT:</span>
                    {selectedHotspot.dominantCategories.map((cat) => (
                      <span key={cat} className="px-1.5 py-0.2 bg-[#090d14] text-slate-300 border border-[#1e293b] rounded">
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Operational Rationale */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">OPERATIONAL REASONING</span>
                    <ul className="space-y-1 text-[10px] text-slate-300">
                      {selectedHotspot.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1 leading-snug">
                          <span className="text-sky-400 font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Targets in Hotspot - Clickable to synchronize */}
                  <div className="space-y-1 pt-1 border-t border-sky-900/40">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      AFFECTED TARGETS ({selectedHotspot.targetIds.length})
                    </span>
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {selectedHotspot.targetIds.map((tId) => {
                        const targetDet = detectionsMap.get(tId);
                        const isThisSelected = selectedDetection?.id === tId;
                        const level = targetDet?.riskAssessment?.operatorRiskLevel || targetDet?.riskAssessment?.riskLevel || 'LOW';

                        return (
                          <div
                            key={tId}
                            onClick={() => {
                              if (targetDet) onSelectDetection(targetDet);
                            }}
                            className={`p-1 rounded flex items-center justify-between cursor-pointer border transition-colors ${
                              isThisSelected
                                ? 'bg-sky-900/60 border-sky-400 text-slate-100'
                                : 'bg-[#090d14] border-[#1e293b] hover:border-slate-500 text-slate-300'
                            }`}
                          >
                            <span className="font-bold">{tId}</span>
                            <div className="flex items-center gap-1.5 text-[9px]">
                              <span className="text-slate-400 truncate max-w-[90px]">
                                {targetDet?.categoryLabel || targetDet?.category}
                              </span>
                              <span className={`px-1 rounded font-bold ${
                                level === 'CRITICAL' ? 'bg-rose-950 text-rose-400' :
                                level === 'HIGH' ? 'bg-amber-950 text-amber-400' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {level}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TOP HAZARD AREAS LIST */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                  <span>TOP HAZARD AREAS (RANKED)</span>
                  <span>PRIORITY</span>
                </div>

                {geointResult?.hotspots && geointResult.hotspots.length > 0 ? (
                  geointResult.hotspots.slice(0, 5).map((h) => {
                    const isSelected = selectedHotspotId === h.id;
                    return (
                      <div
                        key={h.id}
                        id={`top-hazard-${h.id}`}
                        onClick={() => selectHotspot(isSelected ? null : h.id)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#0f172a] border-sky-500 shadow-md'
                            : 'bg-[#090d14] border-[#1e293b] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              h.riskLevel === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                              h.riskLevel === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              'bg-sky-950 text-sky-300 border border-sky-800'
                            }`}>
                              #{h.rank}
                            </span>
                            <span className="font-bold text-slate-200 text-xs">{h.id}</span>
                            <span className="text-[10px] text-slate-400">({h.targetCount} targets)</span>
                          </div>
                          <span className="text-xs font-bold text-amber-400">{h.priorityScore}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">
                          {h.reasons[0]}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-slate-500 text-[11px] bg-[#090d14] rounded border border-[#1e293b]">
                    No spatial hotspots detected
                  </div>
                )}
              </div>

              {/* UNCLUSTERED / ISOLATED TARGETS NOTICE */}
              {(geointResult?.summary?.isolatedCriticalTargets || 0) > 0 && (
                <div className="p-2 bg-rose-950/40 border border-rose-800/60 rounded text-[10px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ISOLATED CRITICAL HAZARD:</span>{' '}
                    {geointResult?.summary?.isolatedCriticalTargets} critical anomaly is unclustered. Maintained on chart.
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Provenance Banner */}
            <div className="bg-[#0b101a] border-t border-[#1e293b] p-1.5 text-[9px] text-slate-500 text-center uppercase tracking-wider">
              DERIVED DECISION SUPPORT • NOT LEGALLY SURVEYED BOUNDARIES
            </div>
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-4 right-4 bg-[#090d14]/95 border border-[#1e293b] p-2.5 rounded text-[10px] font-mono-tech flex flex-col gap-1.5 shadow-lg max-w-[280px]">
          <span className="text-slate-400 font-bold uppercase border-b border-[#1e293b] pb-1 flex items-center justify-between">
            <span>PRIORITY & HAZARD LEGEND</span>
          </span>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm shrink-0" />
            <span>Critical Hazard (UXO / Chemical / Fairway)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm shrink-0" />
            <span>High Hazard (Ghost Net / High Relief)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 bg-sky-400 rounded-sm shrink-0" />
            <span>Moderate Hazard (Plastic / Tire Cluster)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 bg-slate-500 rounded-sm shrink-0" />
            <span>Low Risk / Geological Bedrock</span>
          </div>
          <div className="flex items-center gap-2 text-sky-400 pt-1 border-t border-[#1e293b]">
            <span className="w-3 h-1 bg-sky-500 shrink-0" />
            <span>150m Sonar Swath Ribbon</span>
          </div>
          <div className="flex items-center gap-2 text-amber-300 pt-1 border-t border-[#1e293b]">
            <span className="w-3 h-3 rounded-full border border-dashed border-amber-400 bg-amber-500/20 shrink-0" />
            <span>Hazard Cluster (Dashed Hotspot)</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
