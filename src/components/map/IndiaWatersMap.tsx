import React, { useState } from 'react';
import { 
  Compass, 
  Anchor, 
  Waves, 
  MapPin, 
  ExternalLink, 
  ChevronRight, 
  ShieldAlert, 
  AlertTriangle, 
  Layers,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { INDIAN_SURVEY_REGIONS, IndianSurveyRegion } from '../../data/indianSurveyRegions';

interface IndiaWatersMapProps {
  activeRegionId: string;
  onSelectRegion: (regionId: string) => void;
  onViewSectorSwath: () => void;
  onViewSonarWaterfall?: () => void;
}

export const IndiaWatersMap: React.FC<IndiaWatersMapProps> = ({
  activeRegionId,
  onSelectRegion,
  onViewSectorSwath,
  onViewSonarWaterfall,
}) => {
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const activeRegion = INDIAN_SURVEY_REGIONS.find((r) => r.id === activeRegionId) || INDIAN_SURVEY_REGIONS[0];
  const hoveredRegion = hoveredRegionId ? INDIAN_SURVEY_REGIONS.find((r) => r.id === hoveredRegionId) : null;
  const displayedRegion = hoveredRegion || activeRegion;

  // Region SVG map anchor positions on a 960 x 660 viewBox
  const regionPositions: Record<string, { cx: number; cy: number; labelDx: number; labelDy: number }> = {
    'gulf-of-mannar': { cx: 405, cy: 580, labelDx: -90, labelDy: 24 },
    'gulf-of-kutch': { cx: 165, cy: 250, labelDx: -80, labelDy: -20 },
    'bay-of-bengal': { cx: 580, cy: 360, labelDx: 20, labelDy: 0 },
    'arabian-sea': { cx: 240, cy: 370, labelDx: -100, labelDy: -5 },
    'lakshadweep': { cx: 260, cy: 535, labelDx: -90, labelDy: 15 },
    'andaman-nicobar': { cx: 795, cy: 490, labelDx: 20, labelDy: 0 },
    'palk-strait': { cx: 435, cy: 540, labelDx: 18, labelDy: -15 },
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060a12] select-none overflow-hidden relative">
      {/* Top Region Quick Bar */}
      <div className="bg-[#0c121d] border-b border-[#1e293b] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-tech uppercase text-slate-400">SURVEY REGIONS:</span>
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[650px] no-scrollbar">
            {INDIAN_SURVEY_REGIONS.map((reg) => {
              const isSelected = reg.id === activeRegionId;
              return (
                <button
                  key={reg.id}
                  id={`btn-region-${reg.id}`}
                  onClick={() => onSelectRegion(reg.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono-tech whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-sky-950 text-sky-300 font-semibold border border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                      : 'bg-[#101827] hover:bg-[#162235] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span>{reg.name}</span>
                  <span className="text-[10px] opacity-70">({reg.targets.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onViewSectorSwath}
            className="px-3 py-1 bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-500/70 rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            title="Inspect high-resolution hydrographic swath for selected region"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Sector Swath ({activeRegion.name})</span>
            <ChevronRight className="w-3 h-3 text-sky-300" />
          </button>
        </div>
      </div>

      {/* Main Map SVG Area */}
      <div className="flex-1 relative w-full h-full overflow-hidden flex items-center justify-center p-2 marine-grid-bg">
        <svg
          id="india-waters-overview-svg"
          viewBox="0 0 960 660"
          className="w-full h-full max-h-[82vh] object-contain border border-[#1e293b] bg-[#060a12]"
        >
          <defs>
            {/* Water Depth Gradient */}
            <radialGradient id="deepOcean" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="#08101e" />
              <stop offset="100%" stopColor="#04070d" />
            </radialGradient>

            {/* Active Region Pulse Glow */}
            <radialGradient id="regionActiveGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>

            {/* Continental Shelf Hatch */}
            <pattern id="shelfHatch" width="8" height="8" patternTransform="rotate(30 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.4" />
            </pattern>
          </defs>

          {/* Deep Ocean Base */}
          <rect width="960" height="660" fill="url(#deepOcean)" />

          {/* Geographic Graticule Grid lines (Latitude / Longitude) */}
          <g stroke="#162032" strokeWidth="0.75" strokeDasharray="3,3">
            {/* Parallels (Latitude) */}
            <line x1="40" y1="120" x2="920" y2="120" />
            <line x1="40" y1="240" x2="920" y2="240" />
            <line x1="40" y1="360" x2="920" y2="360" />
            <line x1="40" y1="480" x2="920" y2="480" />
            <line x1="40" y1="600" x2="920" y2="600" />

            {/* Meridians (Longitude) */}
            <line x1="160" y1="40" x2="160" y2="620" />
            <line x1="300" y1="40" x2="300" y2="620" />
            <line x1="440" y1="40" x2="440" y2="620" />
            <line x1="580" y1="40" x2="580" y2="620" />
            <line x1="720" y1="40" x2="720" y2="620" />
            <line x1="860" y1="40" x2="860" y2="620" />
          </g>

          {/* Coordinate Labels */}
          <g fontSize="9" fontFamily="ui-monospace, monospace" fill="#475569">
            <text x="45" y="115">25°00'N</text>
            <text x="45" y="235">20°00'N</text>
            <text x="45" y="355">15°00'N</text>
            <text x="45" y="475">10°00'N</text>
            <text x="45" y="595">05°00'N</text>

            <text x="165" y="635">70°00'E</text>
            <text x="305" y="635">75°00'E</text>
            <text x="445" y="635">80°00'E</text>
            <text x="585" y="635">85°00'E</text>
            <text x="725" y="635">90°00'E</text>
            <text x="865" y="635">95°00'E</text>
          </g>

          {/* Continental Shelf Bathymetric Contours (200m depth buffer around peninsular India) */}
          <path
            d="M 140 230 C 145 280, 205 320, 220 370 C 240 430, 280 490, 340 550 C 370 580, 395 620, 420 620 C 445 615, 490 570, 470 520 C 490 460, 530 400, 565 340 C 600 280, 635 240, 660 210"
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="1.2"
            strokeDasharray="4,4"
            opacity="0.6"
          />

          {/* ============================================================ */}
          {/* WATERBODY CARTOGRAPHIC LABELS                                */}
          {/* ============================================================ */}
          <g fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700" letterSpacing="0.3em">
            {/* ARABIAN SEA */}
            <text 
              x="170" 
              y="420" 
              fill="#1e3a5f" 
              fontSize="20" 
              opacity="0.85"
            >
              ARABIAN SEA
            </text>

            {/* BAY OF BENGAL */}
            <text 
              x="630" 
              y="380" 
              fill="#1e3a5f" 
              fontSize="20" 
              opacity="0.85"
            >
              BAY OF BENGAL
            </text>

            {/* INDIAN OCEAN */}
            <text 
              x="360" 
              y="645" 
              fill="#1e3a5f" 
              fontSize="18" 
              opacity="0.75"
            >
              INDIAN OCEAN
            </text>

            {/* LAKSHADWEEP SEA */}
            <text 
              x="220" 
              y="490" 
              fill="#1b2e4b" 
              fontSize="11" 
              opacity="0.8"
            >
              LAKSHADWEEP SEA
            </text>

            {/* ANDAMAN SEA */}
            <text 
              x="835" 
              y="460" 
              fill="#1b2e4b" 
              fontSize="11" 
              opacity="0.8"
            >
              ANDAMAN SEA
            </text>

            {/* GULF OF KUTCH */}
            <text 
              x="120" 
              y="225" 
              fill="#1b2e4b" 
              fontSize="10" 
              opacity="0.8"
            >
              GULF OF KUTCH
            </text>

            {/* PALK STRAIT */}
            <text 
              x="425" 
              y="525" 
              fill="#1b2e4b" 
              fontSize="10" 
              opacity="0.8"
            >
              PALK STRAIT
            </text>

            {/* GULF OF MANNAR */}
            <text 
              x="365" 
              y="595" 
              fill="#1b2e4b" 
              fontSize="10" 
              opacity="0.8"
            >
              GULF OF MANNAR
            </text>
          </g>

          {/* ============================================================ */}
          {/* LANDMASS POLYGONS                                            */}
          {/* ============================================================ */}
          {/* Indian Subcontinent Peninsular Landmass */}
          <path
            d="
              M 150 160
              Q 175 180 200 190
              Q 170 215 155 235
              Q 165 245 190 245
              Q 210 255 195 275
              Q 175 285 180 300
              Q 215 315 240 310
              Q 275 320 295 345
              Q 325 390 350 440
              Q 370 490 380 535
              Q 395 565 405 585
              Q 415 565 425 545
              Q 440 520 460 480
              Q 490 430 525 375
              Q 555 330 580 290
              Q 620 250 645 220
              Q 660 190 640 160
              Z
            "
            fill="#0c1422"
            stroke="#1e293b"
            strokeWidth="1.5"
          />

          {/* Sri Lanka Landmass */}
          <path
            d="
              M 445 570 
              C 465 565, 480 585, 475 615 
              C 470 635, 450 630, 440 610 
              C 435 590, 435 575, 445 570 Z
            "
            fill="#0c1422"
            stroke="#1e293b"
            strokeWidth="1.2"
          />

          {/* Andaman & Nicobar Islands Archipelago */}
          <g id="andaman-islands" fill="#0c1422" stroke="#2563eb" strokeWidth="1">
            <ellipse cx="785" cy="425" rx="5" ry="16" />
            <ellipse cx="790" cy="465" rx="4.5" ry="18" />
            <ellipse cx="796" cy="505" rx="6" ry="14" />
            <ellipse cx="802" cy="545" rx="7" ry="20" />
            <ellipse cx="808" cy="580" rx="5" ry="10" />
          </g>

          {/* Lakshadweep Archipelago */}
          <g id="lakshadweep-islands" fill="#0c1422" stroke="#2563eb" strokeWidth="1">
            <circle cx="260" cy="495" r="4" />
            <circle cx="258" cy="520" r="4" />
            <circle cx="262" cy="542" r="3.5" />
            <circle cx="268" cy="565" r="3.5" />
          </g>

          {/* Exclusive Economic Zone (EEZ) Boundary (Simulated Hydrographic Limits) */}
          <path
            d="M 120 200 C 130 290, 190 400, 215 500 C 235 580, 310 635, 400 645 C 500 640, 560 550, 600 450 C 650 350, 710 260, 740 180"
            fill="none"
            stroke="#0284c7"
            strokeWidth="1"
            strokeDasharray="6,4"
            opacity="0.3"
          />

          {/* ============================================================ */}
          {/* THE 7 INTERACTIVE SURVEY REGION MARKERS                     */}
          {/* ============================================================ */}
          {INDIAN_SURVEY_REGIONS.map((region) => {
            const pos = regionPositions[region.id] || { cx: 480, cy: 330, labelDx: 0, labelDy: 0 };
            const isSelected = region.id === activeRegionId;
            const isHovered = region.id === hoveredRegionId;
            const criticalCount = region.targets.filter((t) => t.severity === 'CRITICAL').length;

            return (
              <g
                key={region.id}
                id={`map-marker-${region.id}`}
                className="cursor-pointer transition-all group"
                onClick={() => onSelectRegion(region.id)}
                onMouseEnter={() => setHoveredRegionId(region.id)}
                onMouseLeave={() => setHoveredRegionId(null)}
              >
                {/* Active Outer Pulse Aura */}
                {isSelected && (
                  <>
                    <circle
                      cx={pos.cx}
                      cy={pos.cy}
                      r="32"
                      fill="url(#regionActiveGlow)"
                      className="animate-ping opacity-60"
                    />
                    <circle
                      cx={pos.cx}
                      cy={pos.cy}
                      r="20"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      className="animate-spin-slow"
                    />
                  </>
                )}

                {/* Pin Head */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={isSelected ? 11 : isHovered ? 9 : 7.5}
                  fill={isSelected ? '#0284c7' : '#0f172a'}
                  stroke={isSelected ? '#38bdf8' : isHovered ? '#38bdf8' : '#334155'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all"
                />

                {/* Inner Anchor/Ping Dot */}
                <circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={isSelected ? 4.5 : 3}
                  fill={isSelected ? '#f8fafc' : criticalCount > 0 ? '#f43f5e' : '#38bdf8'}
                />

                {/* Connected Leader Line to Badge */}
                <line
                  x1={pos.cx}
                  y1={pos.cy}
                  x2={pos.cx + pos.labelDx}
                  y2={pos.cy + pos.labelDy}
                  stroke={isSelected ? '#38bdf8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray={isSelected ? 'none' : '2,2'}
                  opacity={isSelected || isHovered ? 1 : 0.6}
                />

                {/* Region Label Badge */}
                <g transform={`translate(${pos.cx + pos.labelDx}, ${pos.cy + pos.labelDy})`}>
                  <rect
                    x={pos.labelDx < 0 ? -120 : 0}
                    y="-11"
                    width="120"
                    height="22"
                    rx="4"
                    fill={isSelected ? '#0e1d32' : '#0b1320'}
                    stroke={isSelected ? '#38bdf8' : isHovered ? '#0284c7' : '#1e293b'}
                    strokeWidth={isSelected ? 1.5 : 1}
                    className="shadow-md"
                  />
                  <text
                    x={pos.labelDx < 0 ? -112 : 8}
                    y="4"
                    fill={isSelected ? '#e0f2fe' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontWeight={isSelected ? '700' : '500'}
                  >
                    {region.name}
                  </text>
                  <text
                    x={pos.labelDx < 0 ? -12 : 108}
                    y="4"
                    textAnchor="end"
                    fill={criticalCount > 0 ? '#f43f5e' : '#38bdf8'}
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    fontWeight="700"
                  >
                    {region.targets.length}T
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Selected Region Detailed Floating Inspector (Bottom Right) */}
        <div 
          id="active-region-card"
          className="absolute bottom-4 right-4 w-80 md:w-96 bg-[#0c1422]/95 border border-[#1e293b] backdrop-blur-md rounded-lg shadow-2xl p-4 text-slate-200 z-20"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#1e293b]">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono-tech uppercase text-sky-400 font-bold">
                  {displayedRegion.name}
                </span>
                <span className="text-[10px] font-mono-tech px-1.5 py-0.2 bg-[#131f33] border border-[#2c4060] text-sky-300 rounded">
                  {displayedRegion.waterBody}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                {displayedRegion.subTitle}
              </p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mt-1" title="Acoustic Data Stream Active" />
          </div>

          <div className="grid grid-cols-2 gap-2 py-2.5 text-xs font-mono-tech border-b border-[#1e293b]">
            <div>
              <span className="text-[10px] text-slate-400 block">CENTER COORD</span>
              <span className="text-slate-200 text-[11px]">
                {displayedRegion.centerLat.toFixed(4)}°N, {displayedRegion.centerLng.toFixed(4)}°E
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">SURVEY VESSEL</span>
              <span className="text-slate-200 text-[11px] truncate block">
                {displayedRegion.survey.surveyVessel}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">TARGETS DETECTED</span>
              <span className="text-sky-300 text-[11px] font-bold">
                {displayedRegion.targets.length} Targets ({displayedRegion.targets.filter((t) => t.severity === 'CRITICAL').length} Critical)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">ACOUSTIC FREQ</span>
              <span className="text-slate-200 text-[11px]">
                {displayedRegion.survey.operatingFrequency}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2.5 flex items-center justify-between gap-2">
            {displayedRegion.id !== activeRegionId ? (
              <button
                id="btn-activate-survey-dataset"
                onClick={() => onSelectRegion(displayedRegion.id)}
                className="flex-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Switch to this Region</span>
              </button>
            ) : (
              <button
                id="btn-inspect-sector-swath"
                onClick={onViewSectorSwath}
                className="flex-1 px-3 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-500 text-sky-300 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Inspect Sector Swath</span>
              </button>
            )}

            {onViewSonarWaterfall && (
              <button
                onClick={onViewSonarWaterfall}
                className="px-3 py-1.5 bg-[#131f33] hover:bg-[#1a2b47] border border-[#2c4060] text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1"
                title="View acoustic side-scan sonar waterfall"
              >
                <Waves className="w-3.5 h-3.5 text-sky-400" />
                <span>Sonar</span>
              </button>
            )}
          </div>

          <div className="mt-2 text-[9px] font-mono-tech text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>DEMO MODE: Hydrographic survey georeferenced for prototype demonstration.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
