import React from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Building, 
  Calendar 
} from 'lucide-react';
import { SonarDetection, SurveyMission, SurveyTransect } from '../../types/sonar';

interface ReportViewProps {
  mission: SurveyMission;
  transects: SurveyTransect[];
  detections: SonarDetection[];
  onExportGeoJSON: () => void;
  onExportCSV: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  mission,
  transects,
  detections,
  onExportGeoJSON,
  onExportCSV,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const criticalCount = detections.filter((d) => d.severity === 'CRITICAL').length;
  const highCount = detections.filter((d) => d.severity === 'HIGH').length;
  const confirmedCount = detections.filter((d) => d.verificationStatus === 'CONFIRMED_DEBRIS').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d14] text-slate-200 overflow-y-auto select-none p-4 md:p-6 gap-6">
      {/* Report Action Bar */}
      <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400" />
          <span className="font-mono-tech font-bold text-slate-200 uppercase">
            HYDROGRAPHIC SURVEY &amp; DEBRIS ASSESSMENT REPORT (IHO S-44 COMPLIANT)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131b29] hover:bg-[#1e293b] text-slate-200 border border-[#2c3a50] rounded font-mono-tech transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>PRINT REPORT</span>
          </button>

          <button
            id="btn-report-geojson"
            onClick={onExportGeoJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131b29] hover:bg-[#1e293b] text-sky-300 border border-[#2c3a50] rounded font-mono-tech transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>EXPORT GEOJSON</span>
          </button>

          <button
            id="btn-report-csv"
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/70 hover:bg-sky-900/70 text-sky-200 border border-sky-600/60 rounded font-mono-tech transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-300" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="max-w-4xl mx-auto w-full bg-[#0e141f] border border-[#1e293b] p-6 md:p-8 rounded flex flex-col gap-6 text-slate-300 shadow-xl">
        {/* Formal Hydrographic Header */}
        <div className="border-b border-[#1e293b] pb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono-tech uppercase tracking-widest text-sky-400">
              NATIONAL INSTITUTE OF OCEAN TECHNOLOGY / INCOIS
            </div>
            <h1 className="text-lg md:text-xl font-bold text-slate-100 mt-1">
              SIDE-SCAN SONAR MARINE DEBRIS &amp; SEABED ANOMALY REPORT
            </h1>
            <div className="text-xs font-mono-tech text-slate-400 mt-1">
              Hydrographic Survey • Survey ID: {mission.code}
            </div>
          </div>

          <div className="text-right text-xs font-mono-tech text-slate-400">
            <div>DATE: {mission.date}</div>
            <div>STATUS: PRELIMINARY OPERATIONAL</div>
            <div className="text-emerald-400 font-semibold">IHO S-44 ORDER 1A</div>
          </div>
        </div>

        {/* Survey Metadata Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono-tech">
          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">SURVEY VESSEL &amp; PLATFORM</span>
            <span className="text-slate-200 font-semibold">{mission.surveyVessel}</span>
          </div>

          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">SONAR SENSOR</span>
            <span className="text-slate-200 font-semibold">{mission.sonarEquipment}</span>
          </div>

          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">COORDINATE REFERENCE</span>
            <span className="text-slate-200 font-semibold">{mission.crs}</span>
          </div>

          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">TOTAL SURVEYED AREA</span>
            <span className="text-sky-300 font-semibold">{mission.totalAreaSqKm} km²</span>
          </div>

          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">SWATH WIDTH &amp; RANGE</span>
            <span className="text-slate-200 font-semibold">150m (±75m Port / Stbd)</span>
          </div>

          <div className="bg-[#090d14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-slate-500 block text-[10px]">CHIEF HYDROGRAPHER</span>
            <span className="text-slate-200 font-semibold">{mission.chiefHydrographer}</span>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="bg-[#090d14] border border-[#1e293b] p-4 rounded flex flex-col gap-3">
          <div className="text-xs font-mono-tech uppercase font-bold text-slate-300">
            EXECUTIVE SURVEY FINDINGS
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-tech">
            <div className="bg-[#0e141f] p-3 rounded border border-[#1e293b]">
              <span className="text-slate-500 block text-[10px]">TOTAL TARGETS DETECTED</span>
              <span className="text-xl font-bold text-slate-100">{detections.length}</span>
            </div>

            <div className="bg-[#0e141f] p-3 rounded border border-[#1e293b]">
              <span className="text-slate-500 block text-[10px]">CRITICAL HAZARDS</span>
              <span className="text-xl font-bold text-red-400">{criticalCount}</span>
            </div>

            <div className="bg-[#0e141f] p-3 rounded border border-[#1e293b]">
              <span className="text-slate-500 block text-[10px]">HIGH PRIORITY DEBRIS</span>
              <span className="text-xl font-bold text-amber-400">{highCount}</span>
            </div>

            <div className="bg-[#0e141f] p-3 rounded border border-[#1e293b]">
              <span className="text-slate-500 block text-[10px]">CONFIRMED VALIDATED</span>
              <span className="text-xl font-bold text-emerald-400">{confirmedCount}</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400 mt-1">
            During side-scan acoustic acquisition across Transect Lines TRX-01 through TRX-03 in the Gulf of Mannar shipping fairway buffer, the automated subsea AI edge detection system identified {detections.length} acoustic anomalies. Significant targets include derelict monofilament gillnets presenting high entanglement risk to marine megafauna, a corroded 200L chemical drum requiring hazardous salvage handling, and a historical cylindrical projectile flagged for naval clearance diving verification.
          </p>
        </div>

        {/* Itemized Target Register Table */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-mono-tech uppercase font-bold text-slate-300">
            ITEMIZED ANOMALY &amp; DEBRIS PUNCH LIST
          </div>

          <div className="overflow-x-auto border border-[#1e293b] rounded">
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#090d14] text-slate-400 uppercase text-[9px] border-b border-[#1e293b]">
                <tr>
                  <th className="py-2 px-2.5">ID</th>
                  <th className="py-2 px-2.5">COORDINATES (WGS84)</th>
                  <th className="py-2 px-2.5">CATEGORY</th>
                  <th className="py-2 px-2.5">EST. SIZE</th>
                  <th className="py-2 px-2.5">HEIGHT</th>
                  <th className="py-2 px-2.5">CONF</th>
                  <th className="py-2 px-2.5">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {detections.map((det) => (
                  <tr key={det.id} className="hover:bg-[#090d14]/60">
                    <td className="py-2 px-2.5 font-bold text-sky-400">{det.id}</td>
                    <td className="py-2 px-2.5 text-slate-300">
                      {det.coordinates.lat.toFixed(5)}°N, {det.coordinates.lng.toFixed(5)}°E
                    </td>
                    <td className="py-2 px-2.5 font-sans text-slate-200">{det.categoryLabel}</td>
                    <td className="py-2 px-2.5 text-slate-300">
                      {det.estimatedLengthMeters.toFixed(1)} × {det.estimatedWidthMeters.toFixed(1)}m
                    </td>
                    <td className="py-2 px-2.5 text-amber-300 font-semibold">
                      {det.estimatedTargetHeightMeters.toFixed(2)}m
                    </td>
                    <td className="py-2 px-2.5 text-slate-200 font-semibold">
                      {(det.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="text-[10px] text-slate-300 font-medium">
                        {det.verificationStatus.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remediation & Oceanographic Recommendations */}
        <div className="border-t border-[#1e293b] pt-4 flex flex-col gap-2 text-xs">
          <span className="font-mono-tech uppercase font-bold text-slate-300">
            RECOMMENDED REMEDIATION PROTOCOL
          </span>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 font-mono-tech text-[11px]">
            <li>Deploy ROV with hydraulic grabber on TRG-01 for derelict ghost net recovery prior to migratory season.</li>
            <li>Issue Notice to Mariners (NOTAM) for 500m perimeter around TRG-05 (Potential Munitions/UXO).</li>
            <li>Coordinate salvage crane vessel with Tamil Nadu Maritime Board for drum retrieval at TRG-02.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
