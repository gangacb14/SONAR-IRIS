import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  ExternalLink, 
  ShieldAlert, 
  Layers,
  ArrowUpDown,
  GitCompare,
  Upload
} from 'lucide-react';
import { DebrisCategory, SonarDetection, VerificationStatus, SeverityLevel } from '../../types/sonar';
import { useSurveyStore } from '../../store/surveyStore';

interface DebrisRegistryViewProps {
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  onUpdateDetectionStatus: (detectionId: string, newStatus: VerificationStatus, notes?: string) => void;
}

export const DebrisRegistryView: React.FC<DebrisRegistryViewProps> = ({
  detections,
  selectedDetection,
  onSelectDetection,
  onUpdateDetectionStatus,
}) => {
  const { 
    geointResult, 
    selectHotspot, 
    surveyComparison, 
    temporalFilter, 
    setTemporalFilter,
    followUpResult,
    followUpRecommendations,
    selectRecommendation,
    ingestTargetsFromCsv,
    addToast,
  } = useSurveyStore();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [followUpFilter, setFollowUpFilter] = useState<string>('ALL');
  const [hotspotFilter, setHotspotFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(0.5);
  const [sortField, setSortField] = useState<string>('priorityRank');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Filtered and sorted data
  const filteredDetections = useMemo(() => {
    return detections
      .filter((det) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchId = det.id.toLowerCase().includes(q);
          const matchCat = det.categoryLabel.toLowerCase().includes(q);
          const matchNotes = det.operatorNotes?.toLowerCase().includes(q);
          if (!matchId && !matchCat && !matchNotes) return false;
        }

        if (hotspotFilter !== 'ALL') {
          if (hotspotFilter === 'UNCLUSTERED') {
            if (!geointResult?.unclusteredTargetIds?.includes(det.id)) return false;
          } else {
            const h = geointResult?.hotspots?.find((item) => item.id === hotspotFilter);
            if (!h || !h.targetIds.includes(det.id)) return false;
          }
        }

        if (categoryFilter !== 'ALL') {
          const cat = det.classification || det.category;
          if (cat !== categoryFilter) return false;
        }
        if (statusFilter !== 'ALL' && det.verificationStatus !== statusFilter) return false;
        if (severityFilter !== 'ALL' && det.severity !== severityFilter) return false;
        if (riskFilter !== 'ALL') {
          const level = det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel || 'LOW';
          if (level !== riskFilter) return false;
        }
        if (followUpFilter !== 'ALL') {
          const rec = followUpRecommendations.find((r) => r.targetIds.includes(det.id));
          if (followUpFilter === 'FOLLOW_UP_REQUIRED') {
            if (!rec) return false;
          } else {
            const urgency = rec?.operatorOverride?.urgency || rec?.urgency;
            if (urgency !== followUpFilter) return false;
          }
        }
        if (temporalFilter !== 'ALL') {
          const change = surveyComparison?.allChanges.find((c) => c.targetId === det.id);
          if (!change || change.changeType !== temporalFilter) return false;
        }
        if (det.confidence < minConfidence) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'changeScore') {
          const changeA = surveyComparison?.allChanges.find((c) => c.targetId === a.id)?.changeScore ?? 0;
          const changeB = surveyComparison?.allChanges.find((c) => c.targetId === b.id)?.changeScore ?? 0;
          return sortAsc ? changeA - changeB : changeB - changeA;
        }
        if (sortField === 'priorityRank') {
          const rankA = a.riskAssessment?.priorityRank ?? 999;
          const rankB = b.riskAssessment?.priorityRank ?? 999;
          return sortAsc ? rankA - rankB : rankB - rankA;
        }
        if (sortField === 'riskScore') {
          const scoreA = a.riskAssessment?.riskScore ?? 0;
          const scoreB = b.riskAssessment?.riskScore ?? 0;
          return sortAsc ? scoreA - scoreB : scoreB - scoreA;
        }
        if (sortField === 'confidence') {
          return sortAsc ? a.confidence - b.confidence : b.confidence - a.confidence;
        }

        const valA = (a as unknown as Record<string, unknown>)[sortField];
        const valB = (b as unknown as Record<string, unknown>)[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
  }, [detections, searchQuery, categoryFilter, statusFilter, severityFilter, riskFilter, temporalFilter, surveyComparison, minConfidence, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'priorityRank');
    }
  };

  const exportCSV = () => {
    const headers = [
      'Target ID',
      'Priority Rank',
      'Risk Level',
      'Risk Score',
      'Risk Category',
      'Transect',
      'Ping',
      'Timestamp',
      'Category',
      'Confidence',
      'Status',
      'Severity',
      'Channel',
      'Slant Range (m)',
      'Shadow Length (m)',
      'Estimated Height (m)',
      'Length (m)',
      'Width (m)',
      'Backscatter (dB)',
      'Latitude',
      'Longitude',
      'Depth (m)',
      'Operator Notes',
    ];

    const rows = filteredDetections.map((d) => [
      d.id,
      d.riskAssessment?.priorityRank ?? '',
      d.riskAssessment?.operatorRiskLevel || d.riskAssessment?.riskLevel || '',
      d.riskAssessment?.riskScore ?? '',
      d.riskAssessment?.primaryCategory ?? '',
      d.transectLine,
      d.pingNumber,
      d.timestamp,
      `"${d.categoryLabel}"`,
      d.confidence.toFixed(3),
      d.verificationStatus,
      d.severity,
      d.channel,
      d.slantRangeMeters.toFixed(1),
      d.shadowLengthMeters.toFixed(1),
      d.estimatedTargetHeightMeters.toFixed(2),
      d.estimatedLengthMeters.toFixed(1),
      d.estimatedWidthMeters.toFixed(1),
      d.backscatterDb.toFixed(1),
      d.coordinates.lat.toFixed(6),
      d.coordinates.lng.toFixed(6),
      d.coordinates.depthMeters.toFixed(1),
      `"${(d.operatorNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AERO_MARINE_DEBRIS_REGISTRY_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const csvInputRef = React.useRef<HTMLInputElement>(null);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const text = await file.text();
        const result = await ingestTargetsFromCsv(text, file.name);
        addToast('SUCCESS', `CSV Ingestion Complete`, `Imported ${result.count} targets from "${file.name}".`);
      } catch (err: any) {
        addToast('WARNING', 'CSV Import Failed', err?.message || 'Could not parse targets from CSV file.');
      }
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d14] text-slate-200 overflow-hidden select-none">
      {/* Search and Filters Header */}
      <div 
        id="registry-filters-bar" 
        className="bg-[#0e141f] border-b border-[#1e293b] p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              id="input-search-registry"
              type="text"
              placeholder="Filter by target ID, classification, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#090d14] border border-[#1e293b] focus:border-sky-500 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 font-mono-tech outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#090d14] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="GHOST_NET">Ghost Nets &amp; Trawls</option>
            <option value="METALLIC_DRUM">Industrial Drums / Barrels</option>
            <option value="WRECKAGE_DEBRIS">Vessel Hull Wreckage</option>
            <option value="TIRE_CLUSTER">Tire Clusters</option>
            <option value="ORDNANCE_UXO">Munitions / UXO</option>
            <option value="PLASTIC_AGGREGATE">Plastic Aggregates</option>
            <option value="PIPELINE_EXPOSURE">Pipeline Exposures</option>
            <option value="GEOLOGICAL_FEATURE">Geological Formations</option>
            <option value="MARINE_DEBRIS">General Marine Debris</option>
            <option value="UNKNOWN_ANOMALY">Unknown Acoustic Anomaly</option>
          </select>

          {/* Status Filter */}
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#090d14] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="CONFIRMED_DEBRIS">Confirmed Debris</option>
            <option value="GEOLOGICAL_ANOMALY">Geological Anomaly</option>
            <option value="ESCALATED_HAZARD">Escalated Hazard</option>
            <option value="FALSE_POSITIVE">False Positive</option>
          </select>

          {/* Severity Filter */}
          <select
            id="filter-severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#090d14] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Hazard</option>
            <option value="HIGH">High Severity</option>
            <option value="MODERATE">Moderate</option>
            <option value="INFORMATIONAL">Informational</option>
          </select>

          {/* Risk Level Filter */}
          <select
            id="filter-risk"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#090d14] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MODERATE">Moderate Risk</option>
            <option value="LOW">Low Risk</option>
          </select>

          {/* AI Follow-Up Priority Filter */}
          <select
            id="filter-followup"
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value)}
            className="bg-[#090d14] border border-purple-900/60 rounded px-2.5 py-1.5 text-xs text-purple-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Follow-Up Priorities</option>
            <option value="FOLLOW_UP_REQUIRED">Follow-Up Required ({followUpRecommendations.length})</option>
            <option value="CRITICAL">Critical Follow-Up ({followUpResult?.summary?.criticalCount ?? 0})</option>
            <option value="HIGH">High Follow-Up ({followUpResult?.summary?.highCount ?? 0})</option>
            <option value="MODERATE">Moderate Follow-Up ({followUpResult?.summary?.moderateCount ?? 0})</option>
            <option value="LOW">Low Follow-Up ({followUpResult?.summary?.lowCount ?? 0})</option>
          </select>

          {/* Temporal Change Filter */}
          <select
            id="filter-temporal"
            value={temporalFilter}
            onChange={(e) => setTemporalFilter(e.target.value as any)}
            className="bg-[#090d14] border border-cyan-900/60 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Temporal Statuses ({surveyComparison?.summary ? surveyComparison.summary.totalCurrentTargets : 'All'})</option>
            <option value="NEW">New Detections ({surveyComparison?.summary?.newTargets ?? 0})</option>
            <option value="PERSISTENT">Persistent / Stable ({surveyComparison?.summary?.persistentTargets ?? 0})</option>
            <option value="CHANGED">Changed / Escalated ({surveyComparison?.summary?.changedTargets ?? 0})</option>
            <option value="UNCERTAIN">Uncertain Coverage ({surveyComparison?.summary?.uncertainTargets ?? 0})</option>
            <option value="NOT_REASSESSED">Not Reassessed ({surveyComparison?.summary?.notReassessedTargets ?? 0})</option>
            <option value="REMOVED">Removed in Repeat ({surveyComparison?.summary?.removedTargets ?? 0})</option>
          </select>

          {/* Hotspot / Spatial Cluster Filter */}
          <select
            id="filter-hotspot"
            value={hotspotFilter}
            onChange={(e) => setHotspotFilter(e.target.value)}
            className="bg-[#090d14] border border-sky-900/50 rounded px-2.5 py-1.5 text-xs text-sky-300 font-mono-tech outline-none"
          >
            <option value="ALL">All Spatial Clusters</option>
            {geointResult?.hotspots?.map((h) => (
              <option key={h.id} value={h.id}>
                #{h.rank} {h.id} ({h.riskLevel} • {h.targetCount} trg)
              </option>
            ))}
            <option value="UNCLUSTERED">Unclustered Targets ({geointResult?.summary?.unclusteredTargets || 0})</option>
          </select>

          {/* Sort Field Selector */}
          <select
            id="select-sort-mode"
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value);
              setSortAsc(e.target.value === 'priorityRank');
            }}
            className="bg-[#090d14] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-tech outline-none"
          >
            <option value="priorityRank">Sort: Priority Rank</option>
            <option value="changeScore">Sort: Change Score</option>
            <option value="riskScore">Sort: Risk Score</option>
            <option value="confidence">Sort: AI Confidence</option>
            <option value="pingNumber">Sort: Ping Order</option>
            <option value="id">Sort: Target ID</option>
          </select>

          {/* Min Confidence Threshold */}
          <div className="flex items-center gap-1.5 bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded">
            <span className="text-[10px] font-mono-tech text-slate-400">CONF ≥</span>
            <input
              id="slider-min-confidence"
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-14 h-1 bg-[#1e293b] accent-sky-400 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono-tech text-sky-400 w-8">
              {(minConfidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Actions & Export */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-tech text-slate-400">
            SHOWING {filteredDetections.length} OF {detections.length} TARGETS
          </span>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleCsvImport}
            className="hidden"
          />

          <button
            id="btn-import-csv"
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 rounded text-xs font-mono-tech transition-colors"
            title="Upload CSV containing Targets with coordinates and classification"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT CSV TARGETS</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={exportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-sky-300 rounded text-xs font-mono-tech transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* High-Density Operational Data Table */}
      <div className="flex-1 overflow-auto">
        <table id="debris-registry-table" className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0e141f] border-b border-[#1e293b] text-[10px] font-mono-tech text-slate-400 uppercase z-10">
            <tr>
              <th className="py-2 px-3 cursor-pointer" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-1">
                  <span>TARGET ID</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2 px-3">HOTSPOT</th>
              <th className="py-2 px-3 cursor-pointer" onClick={() => handleSort('changeScore')}>
                <div className="flex items-center gap-1">
                  <span>TEMPORAL STATUS</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2 px-3">TRANSECT / PING</th>
              <th className="py-2 px-3">CH / SLANT RANGE</th>
              <th className="py-2 px-3">CLASSIFICATION</th>
              <th className="py-2 px-3 cursor-pointer" onClick={() => handleSort('priorityRank')}>
                <div className="flex items-center gap-1">
                  <span>PRIORITY / RISK</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2 px-3">FOLLOW-UP PRIORITY</th>
              <th className="py-2 px-3">RECOMMENDED ACTION</th>
              <th className="py-2 px-3 cursor-pointer" onClick={() => handleSort('confidence')}>
                <div className="flex items-center gap-1">
                  <span>CONFIDENCE</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2 px-3">EST. SIZE (L×W)</th>
              <th className="py-2 px-3">HEIGHT (SHADOW)</th>
              <th className="py-2 px-3">BACKSCATTER</th>
              <th className="py-2 px-3">SEVERITY</th>
              <th className="py-2 px-3">VERIFICATION STATUS</th>
              <th className="py-2 px-3 text-right">OPERATOR ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1e293b]/70 text-xs font-mono-tech">
            {filteredDetections.map((det) => {
              const isSelected = selectedDetection?.id === det.id;

              return (
                <tr
                  key={det.id}
                  id={`row-target-${det.id}`}
                  onClick={() => onSelectDetection(det)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-950/40 border-l-2 border-sky-400'
                      : 'hover:bg-[#0e141f]'
                  }`}
                >
                  {/* Target ID */}
                  <td className="py-2.5 px-3 font-bold text-slate-100">
                    <span className="text-sky-400">{det.id}</span>
                  </td>

                  {/* Hotspot Cluster Badge */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const h = geointResult?.hotspots?.find((item) => item.targetIds.includes(det.id));
                      if (!h) {
                        return <span className="text-slate-600 text-[10px]">-</span>;
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectHotspot(h.id);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            h.riskLevel === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                              : h.riskLevel === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900'
                              : 'bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900'
                          }`}
                          title={`Cluster Hotspot #${h.rank} (${h.riskLevel}) - Priority ${h.priorityScore}`}
                        >
                          #{h.rank}
                        </button>
                      );
                    })()}
                  </td>

                  {/* Temporal Status */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const change = surveyComparison?.allChanges.find((c) => c.targetId === det.id);
                      if (!change) {
                        return <span className="text-slate-600 text-[10px]">-</span>;
                      }
                      return (
                        <div className="flex items-center gap-1.5" title={change.reasons.join('; ')}>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            change.changeType === 'NEW'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : change.changeType === 'CHANGED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : change.changeType === 'PERSISTENT'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : change.changeType === 'REMOVED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}>
                            {change.changeType}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono-tech">
                            Δ{change.changeScore}
                          </span>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Transect & Ping */}
                  <td className="py-2.5 px-3 text-slate-300">
                    <div>{det.transectLine}</div>
                    <div className="text-[10px] text-slate-500">#{det.pingNumber.toLocaleString()}</div>
                  </td>

                  {/* Channel & Slant Range */}
                  <td className="py-2.5 px-3">
                    <span className={det.channel === 'PORT' ? 'text-cyan-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {det.channel}
                    </span>{' '}
                    <span className="text-slate-300">{det.slantRangeMeters.toFixed(1)}m</span>
                  </td>

                  {/* Classification */}
                  <td className="py-2.5 px-3">
                    <div className="text-slate-100 font-sans font-medium text-[11px] truncate max-w-xs" title={det.categoryLabel}>
                      {det.categoryLabel}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {det.coordinates.lat.toFixed(5)}°N, {det.coordinates.lng.toFixed(5)}°E
                    </div>
                  </td>

                  {/* Priority & Risk Level */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        #{det.riskAssessment?.priorityRank ?? '-'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${
                          (det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel) === 'CRITICAL'
                            ? 'bg-rose-950/80 border-rose-600/60 text-rose-300'
                            : (det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel) === 'HIGH'
                            ? 'bg-amber-950/80 border-amber-600/60 text-amber-300'
                            : (det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel) === 'MODERATE'
                            ? 'bg-sky-950/80 border-sky-600/60 text-sky-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {det.riskAssessment?.operatorRiskLevel || det.riskAssessment?.riskLevel || 'LOW'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {det.riskAssessment?.riskScore ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Follow-Up Priority */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const rec = followUpRecommendations.find((r) => r.targetIds.includes(det.id));
                      if (!rec) return <span className="text-slate-600 text-[10px]">-</span>;
                      const urgency = rec.operatorOverride?.urgency || rec.urgency;
                      const score = rec.operatorOverride?.priorityScore ?? rec.priorityScore;
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectRecommendation(rec.id);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            urgency === 'CRITICAL'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-700 hover:bg-rose-900'
                              : urgency === 'HIGH'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900'
                              : urgency === 'MODERATE'
                              ? 'bg-sky-950/80 text-sky-300 border-sky-700 hover:bg-sky-900'
                              : 'bg-purple-950/80 text-purple-300 border-purple-800 hover:bg-purple-900'
                          }`}
                          title={`Follow-Up Recommendation #${rec.rank} - Priority ${score}/100`}
                        >
                          #{rec.rank} {urgency} ({score})
                        </button>
                      );
                    })()}
                  </td>

                  {/* Recommended Action */}
                  <td className="py-2.5 px-3">
                    {(() => {
                      const rec = followUpRecommendations.find((r) => r.targetIds.includes(det.id));
                      if (!rec) return <span className="text-slate-600 text-[10px]">-</span>;
                      const action = rec.operatorOverride?.recommendationType || rec.recommendationType;
                      return (
                        <span className="text-[10px] text-purple-300 font-mono-tech whitespace-nowrap">
                          {action.replace(/_/g, ' ')}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Confidence */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-100">
                        {(det.confidence * 100).toFixed(1)}%
                      </span>
                      <div className="w-12 h-1.5 bg-[#1e293b] rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            det.confidence > 0.9 ? 'bg-emerald-400' : 'bg-sky-400'
                          }`}
                          style={{ width: `${det.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Dimensions */}
                  <td className="py-2.5 px-3 text-slate-300">
                    {det.estimatedLengthMeters.toFixed(1)}m × {det.estimatedWidthMeters.toFixed(1)}m
                  </td>

                  {/* Estimated Height from Shadow */}
                  <td className="py-2.5 px-3">
                    <span className="text-amber-300 font-medium">
                      {det.estimatedTargetHeightMeters.toFixed(2)} m
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      (shad: {det.shadowLengthMeters.toFixed(1)}m)
                    </span>
                  </td>

                  {/* Backscatter Intensity */}
                  <td className="py-2.5 px-3 text-slate-300">
                    {det.backscatterDb.toFixed(1)} dB
                  </td>

                  {/* Severity */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        det.severity === 'CRITICAL'
                          ? 'bg-red-950/70 border-red-700/60 text-red-300'
                          : det.severity === 'HIGH'
                          ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                          : det.severity === 'MODERATE'
                          ? 'bg-sky-950/70 border-sky-700/60 text-sky-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {det.severity}
                    </span>
                  </td>

                  {/* Verification Status */}
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        det.verificationStatus === 'CONFIRMED_DEBRIS'
                          ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                          : det.verificationStatus === 'PENDING_REVIEW'
                          ? 'bg-amber-950/80 border-amber-700/60 text-amber-300'
                          : det.verificationStatus === 'ESCALATED_HAZARD'
                          ? 'bg-red-950/80 border-red-700/60 text-red-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {det.verificationStatus.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        id={`btn-confirm-${det.id}`}
                        onClick={() => onUpdateDetectionStatus(det.id, 'CONFIRMED_DEBRIS')}
                        className="p-1 hover:bg-emerald-900/40 text-emerald-400 rounded border border-transparent hover:border-emerald-700"
                        title="Confirm as Verified Marine Debris"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`btn-geo-${det.id}`}
                        onClick={() => onUpdateDetectionStatus(det.id, 'GEOLOGICAL_ANOMALY')}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-transparent hover:border-slate-600"
                        title="Flag as Natural Bedrock / Geological Feature"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`btn-escalate-${det.id}`}
                        onClick={() => onUpdateDetectionStatus(det.id, 'ESCALATED_HAZARD')}
                        className="p-1 hover:bg-red-900/40 text-red-400 rounded border border-transparent hover:border-red-700"
                        title="Escalate as Critical Navigational / Chemical Hazard"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
