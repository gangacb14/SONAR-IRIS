import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { SonarDetection, SonarPalette, TowfishTelemetry } from '../../types/sonar';
import { NormalizedSonarFrame } from '../../types/sonarFrame';

interface WaterfallCanvasProps {
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  palette: SonarPalette;
  gain: number; // 0.5 - 2.0
  contrast: number; // 0.5 - 2.0
  tvg: number; // Time-varying gain slope
  isSlantRangeCorrected: boolean;
  isPlaying: boolean;
  telemetry: TowfishTelemetry;
  activeTool: 'SELECT' | 'RULER' | 'SHADOW_CALC';
  onMeasurementComplete?: (result: { lengthMeters: number; shadowMeters: number; calculatedHeightMeters: number }) => void;
  currentSonarFrame?: NormalizedSonarFrame | null;
  sonarFramesHistory?: NormalizedSonarFrame[];
}

interface RulerPoint {
  x: number;
  y: number;
  rangeMeters: number;
  pingOffset: number;
}

export const resolveWaterfallBox = (det: any): { x: number; y: number; width: number; height: number } => {
  if (!det) {
    return { x: 50, y: 50, width: 10, height: 12 };
  }
  if (det.waterfallBox && typeof det.waterfallBox.x === 'number') {
    return {
      x: det.waterfallBox.x,
      y: det.waterfallBox.y ?? 40,
      width: det.waterfallBox.width ?? 10,
      height: det.waterfallBox.height ?? 12,
    };
  }
  if (det.sonarEvidenceReference?.waterfallBox && typeof det.sonarEvidenceReference.waterfallBox.x === 'number') {
    return {
      x: det.sonarEvidenceReference.waterfallBox.x,
      y: det.sonarEvidenceReference.waterfallBox.y ?? 40,
      width: det.sonarEvidenceReference.waterfallBox.width ?? 10,
      height: det.sonarEvidenceReference.waterfallBox.height ?? 12,
    };
  }
  if (det.sonarEvidenceReference?.boundingBox && typeof det.sonarEvidenceReference.boundingBox.xMin === 'number') {
    const bbox = det.sonarEvidenceReference.boundingBox;
    return {
      x: Math.max(2, Math.min(90, (bbox.xMin / 640) * 100)),
      y: Math.max(5, Math.min(85, (bbox.yMin / 360) * 100)),
      width: Math.max(4, Math.min(25, ((bbox.xMax - bbox.xMin) / 640) * 100)),
      height: Math.max(4, Math.min(25, ((bbox.yMax - bbox.yMin) / 360) * 100)),
    };
  }
  const isPort = det.channel === 'PORT';
  const range = det.slantRangeMeters ?? det.slantRange ?? 35;
  const normRange = Math.min(1, Math.max(0.1, range / 75));
  const x = isPort ? (50 - normRange * 40) : (50 + normRange * 35);
  let hash = 0;
  if (det.id) {
    for (let i = 0; i < det.id.length; i++) hash = (hash * 31 + det.id.charCodeAt(i)) % 100;
  }
  const y = 20 + Math.abs(hash % 60);
  return { x: Math.max(5, Math.min(85, x)), y, width: 10, height: 12 };
};

export const WaterfallCanvas: React.FC<WaterfallCanvasProps> = ({
  detections,
  selectedDetection,
  onSelectDetection,
  palette,
  gain,
  contrast,
  tvg,
  isSlantRangeCorrected,
  isPlaying,
  telemetry,
  activeTool,
  onMeasurementComplete,
  currentSonarFrame,
  sonarFramesHistory,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredDetection, setHoveredDetection] = useState<SonarDetection | null>(null);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  
  // Measurement ruler state
  const [rulerStart, setRulerStart] = useState<RulerPoint | null>(null);
  const [rulerCurrent, setRulerCurrent] = useState<RulerPoint | null>(null);

  // Sounding dimensions
  const TOTAL_RANGE_METERS = 150; // 75m port + 75m stbd
  const WATER_COLUMN_RATIO = isSlantRangeCorrected ? 0 : Math.min(0.24, (telemetry.altitude / 75) * 0.4);

  // Palette color lookups
  const getPaletteColor = useCallback((intensity: number, paletteName: SonarPalette): [number, number, number] => {
    // intensity: 0.0 to 1.0
    const clamped = Math.max(0, Math.min(1, intensity));

    switch (paletteName) {
      case 'AMBER': {
        // Classic Edgetech/Klein amber phosphor
        if (clamped < 0.15) {
          const t = clamped / 0.15;
          return [Math.round(15 * t), Math.round(10 * t), Math.round(5 * t)];
        } else if (clamped < 0.55) {
          const t = (clamped - 0.15) / 0.4;
          return [
            Math.round(15 + (180 - 15) * t),
            Math.round(10 + (90 - 10) * t),
            Math.round(5 + (15 - 5) * t),
          ];
        } else if (clamped < 0.85) {
          const t = (clamped - 0.55) / 0.3;
          return [
            Math.round(180 + (245 - 180) * t),
            Math.round(90 + (190 - 90) * t),
            Math.round(15 + (60 - 15) * t),
          ];
        } else {
          const t = (clamped - 0.85) / 0.15;
          return [
            Math.round(245 + (255 - 245) * t),
            Math.round(190 + (250 - 190) * t),
            Math.round(60 + (220 - 60) * t),
          ];
        }
      }
      case 'OCEAN': {
        // Cobalt cyan marine hydrographic palette
        return [
          Math.round(8 + 30 * clamped),
          Math.round(16 + 180 * clamped),
          Math.round(28 + 225 * clamped),
        ];
      }
      case 'COPPER_INVERTED': {
        // Inverted high-contrast inspection
        const inv = 1 - clamped;
        return [
          Math.round(240 * inv),
          Math.round(210 * inv),
          Math.round(170 * inv),
        ];
      }
      case 'GRAYSCALE':
      default: {
        const val = Math.round(clamped * 255);
        return [val, val, val];
      }
    }
  }, []);

  // Continuous waterfall scrolling simulation when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setScrollOffset((prev) => (prev + 1) % 1000);
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Render the high-precision procedural side-scan sonar image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create an offscreen buffer for scanlines
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const nadirCenter = width / 2;
    const waterColumnPixels = (width / 2) * WATER_COLUMN_RATIO;

    // Procedural acoustic synthesis simulating real seabed backscatter physics
    for (let y = 0; y < height; y++) {
      const virtualY = (y + scrollOffset) * 0.04;

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const distFromCenter = Math.abs(x - nadirCenter);

        // 1. Water Column Nadir Gap (Sound has not reached seabed yet)
        if (!isSlantRangeCorrected && distFromCenter < waterColumnPixels) {
          // Dark water column with subtle acoustic speckle/particulates
          const waterNoise = (Math.sin(x * 0.4 + y * 0.2) * 0.02 + Math.random() * 0.03);
          const [r, g, b] = getPaletteColor(Math.max(0, waterNoise * 0.2), palette);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
          continue;
        }

        // 2. First seabed bottom arrival specular reflection
        const isFirstBottomReturn = !isSlantRangeCorrected && Math.abs(distFromCenter - waterColumnPixels) < 3;

        // 3. Seabed acoustic backscatter from normalized preprocessed samples
        let intensity = 0.38;

        if (currentSonarFrame && currentSonarFrame.portProcessedSamples.length > 0) {
          // Acoustic sample bins from preprocessed frame
          if (x < nadirCenter) {
            const portRatio = (nadirCenter - x) / nadirCenter;
            const sIdx = Math.min(
              currentSonarFrame.portProcessedSamples.length - 1,
              Math.floor(portRatio * currentSonarFrame.portProcessedSamples.length)
            );
            intensity = currentSonarFrame.portProcessedSamples[sIdx] ?? 0.38;
          } else {
            const stbdRatio = (x - nadirCenter) / (width - nadirCenter);
            const sIdx = Math.min(
              currentSonarFrame.starboardProcessedSamples.length - 1,
              Math.floor(stbdRatio * currentSonarFrame.starboardProcessedSamples.length)
            );
            intensity = currentSonarFrame.starboardProcessedSamples[sIdx] ?? 0.38;
          }
          // Micro acoustic ripple/speckle overlay for high visual fidelity
          const sandRipples = Math.sin((x * 0.15 + virtualY * 18) * 0.5) * 0.05;
          const sedimentGrain = (Math.sin(x * 0.8) * Math.cos(virtualY * 10) * 0.03 + (Math.random() - 0.5) * 0.04);
          intensity = Math.max(0, Math.min(1.0, intensity + sandRipples + sedimentGrain));
        } else {
          // Fallback procedural acoustic texture
          const rangeRatio = (distFromCenter - waterColumnPixels) / (width / 2 - waterColumnPixels);
          const tvgComp = 1 + rangeRatio * (tvg - 1);
          const sandRipples = Math.sin((x * 0.15 + virtualY * 18) * 0.5) * 0.08;
          const sedimentGrain = (Math.sin(x * 0.8) * Math.cos(virtualY * 10) * 0.04 + (Math.random() - 0.5) * 0.09);
          intensity = 0.38 + sandRipples + sedimentGrain;
          if (isFirstBottomReturn) intensity += 0.28;
          intensity = (intensity - 0.5) * contrast + 0.5;
          intensity = intensity * gain * tvgComp;
        }

        // 4. Inject Acoustic Target Echoes & Shadows for Detections
        if (detections && Array.isArray(detections)) {
          for (const det of detections) {
            if (!det) continue;
            const box = resolveWaterfallBox(det);
            // Convert detection coordinates to pixel space
            const detPixelX = (box.x / 100) * width;
            const detPixelY = (box.y / 100) * height;
            const detWidth = (box.width / 100) * width;
            const detHeight = (box.height / 100) * height;

            const dx = x - detPixelX;
            const dy = y - detPixelY;

            // Target Body (Specular highlight - bright acoustic bounce)
            if (dx >= 0 && dx < detWidth * 0.45 && dy >= 0 && dy < detHeight) {
              intensity += 0.55; // high acoustic return
            }

            // Acoustic Shadow (Sound blocked by object height - dark void cast outward away from nadir)
            const isPort = det.channel === 'PORT';
            const shadowStart = isPort ? detPixelX - detWidth * 0.75 : detPixelX + detWidth * 0.45;
            const shadowWidth = detWidth * 0.8;

            if (
              ((isPort && x >= shadowStart && x < detPixelX) ||
               (!isPort && x > detPixelX + detWidth * 0.45 && x <= detPixelX + detWidth * 0.45 + shadowWidth)) &&
              dy >= 0 && dy < detHeight
            ) {
              intensity = 0.02; // true acoustic shadow
            }
          }
        }

        const [r, g, b] = getPaletteColor(intensity, palette);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw central nadir line and range calibration rulers
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Center Nadir Line
    ctx.beginPath();
    ctx.moveTo(nadirCenter, 0);
    ctx.lineTo(nadirCenter, height);
    ctx.stroke();

    // Port & Starboard range intervals (25m, 50m, 75m)
    const intervals = [0.25, 0.5, 0.75, 1.0];
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';

    intervals.forEach((frac) => {
      // Port side
      const portX = nadirCenter - (width / 2) * frac;
      ctx.beginPath();
      ctx.moveTo(portX, 0);
      ctx.lineTo(portX, height);
      ctx.stroke();
      ctx.fillText(`-${Math.round(75 * frac)}m`, Math.max(5, portX + 4), 14);

      // Starboard side
      const stbdX = nadirCenter + (width / 2) * frac;
      ctx.beginPath();
      ctx.moveTo(stbdX, 0);
      ctx.lineTo(stbdX, height);
      ctx.stroke();
      ctx.fillText(`+${Math.round(75 * frac)}m`, Math.min(width - 35, stbdX + 4), 14);
    });

    ctx.setLineDash([]); // Reset line dash
  }, [palette, gain, contrast, tvg, isSlantRangeCorrected, scrollOffset, detections, telemetry, currentSonarFrame, getPaletteColor]);

  // Coordinate mapper from canvas pixels to Slant Range (Meters)
  const pixelToRangeMeters = (pixelX: number, width: number): number => {
    const nadirCenter = width / 2;
    const distFromCenter = Math.abs(pixelX - nadirCenter);
    return (distFromCenter / (width / 2)) * 75;
  };

  // Handle canvas click / measurement ruler
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'RULER' || activeTool === 'SHADOW_CALC') {
      const range = pixelToRangeMeters(x, canvasRef.current.width);
      const pt: RulerPoint = { x, y, rangeMeters: range, pingOffset: y };
      setRulerStart(pt);
      setRulerCurrent(pt);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if ((activeTool === 'RULER' || activeTool === 'SHADOW_CALC') && rulerStart) {
      const range = pixelToRangeMeters(x, canvasRef.current.width);
      setRulerCurrent({ x, y, rangeMeters: range, pingOffset: y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (rulerStart && rulerCurrent && typeof rulerStart.x === 'number' && typeof rulerCurrent.x === 'number' && canvasRef.current) {
      const dxPx = Math.abs(rulerCurrent.x - rulerStart.x);
      const width = canvasRef.current.width;
      const metersPerPixel = 150 / width;
      const shadowMeters = dxPx * metersPerPixel;
      const slantRange = (rulerStart.rangeMeters + rulerCurrent.rangeMeters) / 2;

      // Hydrographic Shadow Height formula: h = (L_shadow * H_towfish) / R_slant
      const calculatedHeight = slantRange > 0 ? (shadowMeters * telemetry.altitude) / slantRange : 0;

      if (onMeasurementComplete) {
        onMeasurementComplete({
          lengthMeters: shadowMeters,
          shadowMeters,
          calculatedHeightMeters: calculatedHeight,
        });
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex flex-col items-center justify-center bg-[#070a10] overflow-hidden select-none"
    >
      {/* Sonar Canvas */}
      <canvas
        id="sonar-waterfall-canvas"
        ref={canvasRef}
        width={960}
        height={680}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className={`w-full h-full max-h-[82vh] object-contain border border-[#1e293b] ${
          activeTool === 'RULER' || activeTool === 'SHADOW_CALC' ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {/* Interactive Detection Bounding Box Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {detections && Array.isArray(detections) && detections.map((det) => {
          if (!det) return null;
          const box = resolveWaterfallBox(det);
          const isSelected = selectedDetection?.id === det.id;
          const isHovered = hoveredDetection?.id === det.id;

          const borderStyle = isSelected
            ? 'border-sky-400 bg-sky-500/15 ring-1 ring-sky-400'
            : det.severity === 'CRITICAL'
            ? 'border-red-500 bg-red-500/10'
            : det.severity === 'HIGH'
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-emerald-500/80 bg-emerald-500/10';

          const slantRange = det.slantRangeMeters ?? det.slantRange ?? 0;
          const targetHeight = det.estimatedTargetHeightMeters ?? det.shadowHeight ?? 0;

          return (
            <div
              key={det.id}
              id={`detection-box-${det.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDetection(det);
              }}
              onMouseEnter={() => setHoveredDetection(det)}
              onMouseLeave={() => setHoveredDetection(null)}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
              }}
              className={`absolute border transition-all pointer-events-auto cursor-pointer flex flex-col justify-between p-1 ${borderStyle}`}
            >
              {/* Header tag */}
              <div className="flex items-center justify-between gap-1 overflow-hidden">
                <span className="text-[9px] font-mono-tech font-bold px-1 py-0.2 bg-[#090d14]/90 text-slate-100 rounded border border-[#2c3a50] truncate">
                  {det.id}
                </span>
                <span className="text-[9px] font-mono-tech font-semibold px-1 py-0.2 bg-[#090d14]/90 text-sky-400 rounded border border-[#2c3a50]">
                  {((det.confidence ?? 0.9) * 100).toFixed(0)}%
                </span>
              </div>

              {/* Footer info tag */}
              <div className="flex items-center justify-between text-[8px] font-mono-tech text-slate-300 bg-[#090d14]/85 px-1 rounded truncate">
                <span>{det.channel === 'PORT' ? 'PORT' : 'STBD'} {slantRange.toFixed(1)}m</span>
                <span className="text-amber-300 font-medium">H: {targetHeight.toFixed(1)}m</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Measurement Ruler Rendering */}
      {rulerStart && rulerCurrent && typeof rulerStart.x === 'number' && typeof rulerCurrent.x === 'number' && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <line
            x1={rulerStart.x}
            y1={rulerStart.y}
            x2={rulerCurrent.x}
            y2={rulerCurrent.y}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4,2"
          />
          <circle cx={rulerStart.x} cy={rulerStart.y} r="3.5" fill="#f59e0b" />
          <circle cx={rulerCurrent.x} cy={rulerCurrent.y} r="3.5" fill="#f59e0b" />
          <text
            x={(rulerStart.x + rulerCurrent.x) / 2 + 8}
            y={(rulerStart.y + rulerCurrent.y) / 2 - 8}
            fill="#f59e0b"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fontWeight="bold"
          >
            L: {(Math.abs(rulerCurrent.x - rulerStart.x) * (150 / 960)).toFixed(1)}m
          </text>
        </svg>
      )}

      {/* Nadir and Swath Status Bar Overlay */}
      <div className="absolute top-2 left-3 flex items-center gap-2 bg-[#090d14]/90 border border-[#1e293b] px-2.5 py-1 rounded text-[10px] font-mono-tech text-slate-300">
        <span className="text-sky-400 font-semibold">PORT (0 - 75m)</span>
        <span className="text-slate-500">|</span>
        <span className="text-amber-400">NADIR ALT {telemetry.altitude.toFixed(1)}m</span>
        <span className="text-slate-500">|</span>
        <span className="text-sky-400 font-semibold">STARBOARD (0 - 75m)</span>
      </div>

      {/* Slant-range status tag */}
      <div className="absolute top-2 right-3 bg-[#090d14]/90 border border-[#1e293b] px-2.5 py-1 rounded text-[10px] font-mono-tech text-slate-300 flex items-center gap-2">
        <span>SLANT-RANGE:</span>
        <span className={isSlantRangeCorrected ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
          {isSlantRangeCorrected ? 'CORRECTED (GROUND RANGE)' : 'RAW UNCORRECTED'}
        </span>
      </div>
    </div>
  );
};
