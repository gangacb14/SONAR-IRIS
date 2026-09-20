import React, { useState, useMemo } from 'react';
import { 
  FileText, Shield, X, Search, Download, Filter, 
  Video, UploadCloud, CheckCircle2, AlertTriangle, 
  MapPin, Clock, Tag, User, Radio, RefreshCw
} from 'lucide-react';
import { useSurveyStore } from '../../store/surveyStore';
import { AuditEvent, AuditActionType } from '../../types/audit';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterCategory = 'ALL' | 'VIDEO' | 'CSV' | 'TARGETS' | 'SYSTEM';

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { auditTrail } = useSurveyStore();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');

  const filteredLogs = useMemo(() => {
    return auditTrail.filter((log) => {
      // Category filter
      if (activeCategory === 'VIDEO') {
        if (!['VIDEO_UPLOADED', 'VIDEO_DETECTION_LOGGED'].includes(log.actionType)) return false;
      } else if (activeCategory === 'CSV') {
        if (log.actionType !== 'CSV_UPLOADED') return false;
      } else if (activeCategory === 'TARGETS') {
        if (!['TARGET_CREATED', 'TARGET_VERIFIED', 'TARGET_RECLASSIFIED', 'TARGET_NOTE_ADDED', 'TARGET_SELECTED', 'TARGET_UNKNOWN_FLAGGED'].includes(log.actionType)) return false;
      } else if (activeCategory === 'SYSTEM') {
        if (!['REGION_CHANGED', 'RISK_OVERRIDE', 'RISK_ACKNOWLEDGED', 'FREQUENCY_TOGGLED', 'PLAYBACK_TOGGLED', 'REPORT_EXPORTED', 'FOLLOW_UP_RECOMMENDATION_ACKNOWLEDGED', 'FOLLOW_UP_RECOMMENDATION_OVERRIDDEN'].includes(log.actionType)) return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.title?.toLowerCase().includes(term) ||
        log.description?.toLowerCase().includes(term) ||
        log.actionType?.toLowerCase().includes(term) ||
        log.operator?.toLowerCase().includes(term) ||
        log.targetId?.toLowerCase().includes(term) ||
        log.newValue?.toLowerCase().includes(term) ||
        log.previousValue?.toLowerCase().includes(term)
      );
    });
  }, [auditTrail, activeCategory, searchTerm]);

  // Counts for tabs
  const counts = useMemo(() => {
    let video = 0;
    let csv = 0;
    let targets = 0;
    let system = 0;

    auditTrail.forEach((log) => {
      if (['VIDEO_UPLOADED', 'VIDEO_DETECTION_LOGGED'].includes(log.actionType)) video++;
      else if (log.actionType === 'CSV_UPLOADED') csv++;
      else if (['TARGET_CREATED', 'TARGET_VERIFIED', 'TARGET_RECLASSIFIED', 'TARGET_NOTE_ADDED', 'TARGET_SELECTED', 'TARGET_UNKNOWN_FLAGGED'].includes(log.actionType)) targets++;
      else system++;
    });

    return { total: auditTrail.length, video, csv, targets, system };
  }, [auditTrail]);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditTrail, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `aqua_scan_audit_log_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp (ISO)', 'Action Type', 'Title', 'Target ID', 'Operator', 'Previous Value', 'New Value', 'Description'];
    const rows = auditTrail.map((evt) => [
      `"${evt.timestamp}"`,
      `"${evt.actionType}"`,
      `"${(evt.title || '').replace(/"/g, '""')}"`,
      `"${evt.targetId}"`,
      `"${evt.operator}"`,
      `"${(evt.previousValue || '').replace(/"/g, '""')}"`,
      `"${(evt.newValue || '').replace(/"/g, '""')}"`,
      `"${(evt.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `aqua_scan_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  const getActionBadge = (type: AuditActionType) => {
    switch (type) {
      case 'VIDEO_UPLOADED':
        return {
          color: 'bg-purple-950/80 text-purple-300 border-purple-800',
          icon: <Video className="w-3.5 h-3.5 text-purple-400" />,
          label: 'VIDEO UPLOAD',
        };
      case 'VIDEO_DETECTION_LOGGED':
        return {
          color: 'bg-violet-950/80 text-violet-300 border-violet-800',
          icon: <Video className="w-3.5 h-3.5 text-violet-400" />,
          label: 'OPTICAL DETECT',
        };
      case 'CSV_UPLOADED':
        return {
          color: 'bg-blue-950/80 text-blue-300 border-blue-800',
          icon: <UploadCloud className="w-3.5 h-3.5 text-blue-400" />,
          label: 'CSV INGEST',
        };
      case 'TARGET_CREATED':
        return {
          color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
          icon: <Tag className="w-3.5 h-3.5 text-cyan-400" />,
          label: 'TARGET CREATED',
        };
      case 'TARGET_VERIFIED':
        return {
          color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'VERIFICATION',
        };
      case 'TARGET_RECLASSIFIED':
        return {
          color: 'bg-amber-950/80 text-amber-300 border-amber-800',
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400" />,
          label: 'RECLASSIFIED',
        };
      case 'TARGET_SELECTED':
        return {
          color: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <Radio className="w-3.5 h-3.5 text-slate-400" />,
          label: 'INSPECTED',
        };
      case 'REGION_CHANGED':
        return {
          color: 'bg-sky-950/80 text-sky-300 border-sky-800',
          icon: <MapPin className="w-3.5 h-3.5 text-sky-400" />,
          label: 'REGION SWITCH',
        };
      case 'RISK_OVERRIDE':
      case 'RISK_ACKNOWLEDGED':
        return {
          color: 'bg-rose-950/80 text-rose-300 border-rose-800',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
          label: 'RISK ACTION',
        };
      default:
        return {
          color: 'bg-slate-900 text-slate-300 border-slate-700',
          icon: <FileText className="w-3.5 h-3.5 text-slate-400" />,
          label: type.replace(/_/g, ' '),
        };
    }
  };

  return (
    <div id="audit-log-modal-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        id="audit-log-modal" 
        className="bg-[#0c121e] border border-[#223249] rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-200"
      >
        {/* Header */}
        <div className="bg-[#080d16] border-b border-[#1e293b] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-800 text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider font-mono-tech uppercase text-slate-100">
                  CRUISE & OPERATOR AUDIT TRAIL
                </h2>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                  {counts.total} TOTAL ACTIONS RECORDED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Timestamped provenance log capturing video uploads, CSV datasets, target verifications, and mission adjustments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#131d2e] hover:bg-[#1a283f] border border-[#2a3c57] text-slate-200 rounded text-xs font-mono-tech transition-colors cursor-pointer"
              title="Download full JSON audit log"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>JSON</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#131d2e] hover:bg-[#1a283f] border border-[#2a3c57] text-slate-200 rounded text-xs font-mono-tech transition-colors cursor-pointer"
              title="Download CSV audit log"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-[#131d2e] hover:bg-rose-950/60 hover:text-rose-300 border border-[#2a3c57] text-slate-400 rounded transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Category tabs and search */}
        <div className="bg-[#0e1625] border-b border-[#1e293b] p-3 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1 rounded text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === 'ALL'
                  ? 'bg-sky-950 border-sky-600 text-sky-300 font-bold'
                  : 'bg-[#121c2c] border-[#1e2c42] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>ALL ACTIONS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-300 font-mono">
                {counts.total}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('VIDEO')}
              className={`px-3 py-1 rounded text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === 'VIDEO'
                  ? 'bg-purple-950 border-purple-600 text-purple-300 font-bold'
                  : 'bg-[#121c2c] border-[#1e2c42] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3 h-3 text-purple-400" />
              <span>VIDEO UPLOADS & DETECTIONS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-purple-300 font-mono">
                {counts.video}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('CSV')}
              className={`px-3 py-1 rounded text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === 'CSV'
                  ? 'bg-blue-950 border-blue-600 text-blue-300 font-bold'
                  : 'bg-[#121c2c] border-[#1e2c42] text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-3 h-3 text-blue-400" />
              <span>CSV INGESTIONS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-blue-300 font-mono">
                {counts.csv}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('TARGETS')}
              className={`px-3 py-1 rounded text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === 'TARGETS'
                  ? 'bg-cyan-950 border-cyan-600 text-cyan-300 font-bold'
                  : 'bg-[#121c2c] border-[#1e2c42] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3 h-3 text-cyan-400" />
              <span>TARGETS & VERIFICATIONS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-cyan-300 font-mono">
                {counts.targets}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('SYSTEM')}
              className={`px-3 py-1 rounded text-xs font-mono-tech transition-colors cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === 'SYSTEM'
                  ? 'bg-amber-950 border-amber-600 text-amber-300 font-bold'
                  : 'bg-[#121c2c] border-[#1e2c42] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3 h-3 text-amber-400" />
              <span>NAVIGATION & SYSTEM</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-amber-300 font-mono">
                {counts.system}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs by keyword, target, operator..."
              className="w-full bg-[#080d16] border border-[#24354c] rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono-tech"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Audit Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#080d16]/80">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-mono-tech">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-60" />
              <p className="text-sm">NO AUDIT RECORDS FOUND</p>
              <p className="text-xs text-slate-600 mt-1">
                {searchTerm ? 'Try adjusting your search query' : 'User and system actions will appear here in chronological order.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.actionType);
              const dateObj = new Date(log.timestamp);
              const isoString = log.timestamp;
              const formattedTime = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '';

              return (
                <div
                  key={log.id}
                  className="bg-[#0f1726] border border-[#1e2c40] hover:border-[#2f4563] rounded-lg p-3 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1 space-y-1.5">
                    {/* Top row: Badge + Title + Target ID */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold font-mono-tech ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>

                      <span className="font-bold text-slate-100 font-mono-tech tracking-wide">
                        {log.title}
                      </span>

                      {log.targetId && log.targetId !== 'SYSTEM' && (
                        <span className="text-[10px] font-mono-tech px-1.5 py-0.2 rounded bg-sky-950/60 border border-sky-800 text-sky-300">
                          {log.targetId}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {log.description}
                    </p>

                    {/* Value Changes if present */}
                    {(log.previousValue || log.newValue) && (
                      <div className="flex items-center gap-2 text-[11px] font-mono-tech mt-1">
                        {log.previousValue && (
                          <span className="text-rose-400 line-through bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-900/50">
                            {log.previousValue}
                          </span>
                        )}
                        {log.previousValue && log.newValue && <span className="text-slate-500">➔</span>}
                        {log.newValue && (
                          <span className="text-emerald-300 font-bold bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-900/50">
                            {log.newValue}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Metadata tags if present */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(log.metadata).map(([k, v]) => {
                          if (v === undefined || v === null || typeof v === 'object') return null;
                          return (
                            <span key={k} className="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-[#152033] border border-[#273852] text-slate-400">
                              <span className="text-slate-500">{k}:</span> {String(v)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right side: Timestamp & Operator */}
                  <div className="flex md:flex-col items-end justify-between md:justify-start gap-1 shrink-0 text-right font-mono-tech">
                    <div className="flex items-center gap-1 text-[11px] text-sky-400 font-bold">
                      <Clock className="w-3 h-3 text-sky-500" />
                      <span>{formattedTime}</span>
                    </div>
                    <div className="text-[10px] text-slate-400" title={isoString}>
                      {isoString.slice(0, 10)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{log.operator}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#080d16] border-t border-[#1e293b] px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono-tech">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>IMMUTABLE HYDROGRAPHIC AUDIT TRAIL • STRICT PROVENANCE LOGGING</span>
          </div>
          <div>
            SHOWING {filteredLogs.length} OF {auditTrail.length} RECORDS
          </div>
        </div>
      </div>
    </div>
  );
};
