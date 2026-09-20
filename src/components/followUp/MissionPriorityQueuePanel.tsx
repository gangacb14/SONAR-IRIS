/**
 * Mission Priority Queue Operational Panel
 * SIH 2026 Problem Statement 26057
 * 
 * Compact decision-support panel answering:
 * "Which targets or areas should be investigated next, and why?"
 * 
 * Displays ranked follow-up recommendations, urgency breakdowns,
 * expected operational benefits, and supports operator acknowledgement/overrides.
 */

import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  SlidersHorizontal, 
  FileText, 
  Target, 
  Radar, 
  AlertTriangle, 
  ShieldAlert, 
  Info,
  Layers,
  Search,
  CheckCheck,
  X
} from 'lucide-react';
import { useSurveyStore } from '../../store/surveyStore';
import { FollowUpRecommendation, FollowUpUrgency, RecommendationType, FollowUpFilterType } from '../../types/followUp';

interface MissionPriorityQueuePanelProps {
  onClose?: () => void;
  compact?: boolean;
}

export const MissionPriorityQueuePanel: React.FC<MissionPriorityQueuePanelProps> = ({
  onClose,
  compact = false,
}) => {
  const {
    followUpResult,
    selectedRecommendationId,
    selectRecommendation,
    followUpFilter,
    setFollowUpFilter,
    acknowledgeRecommendation,
    overrideRecommendation,
  } = useSurveyStore();

  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [operatorNoteInput, setOperatorNoteInput] = useState<string>('');
  const [isOverridingId, setIsOverridingId] = useState<string | null>(null);
  const [overrideUrgency, setOverrideUrgency] = useState<FollowUpUrgency>('HIGH');
  const [overrideAction, setOverrideAction] = useState<RecommendationType>('ADDITIONAL_SONAR_PASS');
  const [overrideReason, setOverrideReason] = useState<string>('');

  const recommendations = followUpResult?.recommendations || [];
  const summary = followUpResult?.summary;

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter((rec) => {
      const activeUrgency = rec.operatorOverride?.urgency || rec.urgency;
      if (followUpFilter === 'ALL') return true;
      if (followUpFilter === 'FOLLOW_UP_REQUIRED') {
        return activeUrgency === 'CRITICAL' || activeUrgency === 'HIGH';
      }
      return activeUrgency === followUpFilter;
    });
  }, [recommendations, followUpFilter]);

  const handleRowClick = (rec: FollowUpRecommendation) => {
    selectRecommendation(rec.id);
    setExpandedRecId(expandedRecId === rec.id ? null : rec.id);
  };

  const handleAcknowledge = async (e: React.MouseEvent, recId: string) => {
    e.stopPropagation();
    await acknowledgeRecommendation(recId, operatorNoteInput);
    setOperatorNoteInput('');
  };

  const handleApplyOverride = async (e: React.FormEvent, recId: string) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;
    await overrideRecommendation(recId, {
      urgency: overrideUrgency,
      recommendationType: overrideAction,
      reason: overrideReason,
    });
    setIsOverridingId(null);
    setOverrideReason('');
  };

  return (
    <div 
      id="mission-priority-queue-panel" 
      className="bg-[#090d14]/95 border border-[#1e293b] rounded-lg shadow-2xl flex flex-col font-mono-tech backdrop-blur-sm overflow-hidden text-xs"
    >
      {/* Panel Header */}
      <div className="bg-[#0e141f] border-b border-[#1e293b] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-200 tracking-wide">
            FOLLOW-UP MISSION QUEUE
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-purple-950 text-purple-300 border border-purple-800 rounded font-bold">
            {followUpResult?.provenance || 'DERIVED'}
          </span>
        </div>
        {onClose && (
          <button
            id="btn-close-priority-queue"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Top Action & Metrics Summary */}
      <div className="p-2.5 bg-[#0b101a] border-b border-[#1e293b] space-y-2">
        <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
          <div className="p-1 bg-[#090d14] rounded border border-rose-900/40">
            <span className="text-rose-400 block font-bold">CRITICAL</span>
            <span className="text-rose-300 font-bold text-xs">
              {String(summary?.criticalCount ?? 0).padStart(2, '0')}
            </span>
          </div>
          <div className="p-1 bg-[#090d14] rounded border border-amber-900/40">
            <span className="text-amber-400 block font-bold">HIGH</span>
            <span className="text-amber-300 font-bold text-xs">
              {String(summary?.highCount ?? 0).padStart(2, '0')}
            </span>
          </div>
          <div className="p-1 bg-[#090d14] rounded border border-sky-900/40">
            <span className="text-sky-400 block font-bold">MODERATE</span>
            <span className="text-sky-300 font-bold text-xs">
              {String(summary?.moderateCount ?? 0).padStart(2, '0')}
            </span>
          </div>
          <div className="p-1 bg-[#090d14] rounded border border-slate-800">
            <span className="text-slate-400 block font-bold">LOW</span>
            <span className="text-slate-300 font-bold text-xs">
              {String(summary?.lowCount ?? 0).padStart(2, '0')}
            </span>
          </div>
        </div>

        {summary?.topAction && (
          <div className="flex items-center justify-between px-2 py-1 bg-[#090d14] rounded border border-purple-900/40 text-[10px]">
            <span className="text-slate-400">TOP RECOMMENDED ACTION:</span>
            <span className="text-purple-300 font-bold">
              {summary.topAction.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Filter Chips */}
      <div className="px-2.5 py-1.5 bg-[#090d14] border-b border-[#1e293b] flex items-center gap-1 overflow-x-auto text-[9px]">
        {(['ALL', 'FOLLOW_UP_REQUIRED', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as FollowUpFilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFollowUpFilter(f)}
            className={`px-2 py-0.5 rounded border whitespace-nowrap transition-colors ${
              followUpFilter === f
                ? 'bg-purple-950 text-purple-300 border-purple-600 font-bold'
                : 'bg-transparent text-slate-400 border-[#1e293b] hover:border-slate-600'
            }`}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Ranked Queue Items */}
      <div className="flex-1 overflow-y-auto max-h-[55vh] p-2 space-y-1.5 divide-y divide-[#1e293b]/50">
        {filteredRecs.length === 0 ? (
          <div className="p-4 text-center text-slate-500 italic">
            No follow-up recommendations matching filter.
          </div>
        ) : (
          filteredRecs.map((rec) => {
            const isSelected = selectedRecommendationId === rec.id;
            const isExpanded = expandedRecId === rec.id;
            const activeUrgency = rec.operatorOverride?.urgency || rec.urgency;
            const activeAction = rec.operatorOverride?.recommendationType || rec.recommendationType;
            const activeScore = rec.operatorOverride?.priorityScore || rec.priorityScore;

            return (
              <div
                key={rec.id}
                id={`rec-item-${rec.id}`}
                onClick={() => handleRowClick(rec)}
                className={`p-2 rounded transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#151c2c] border border-purple-500/70 shadow-md'
                    : 'bg-[#090d14]/70 hover:bg-[#0f1522] border border-transparent hover:border-[#1e293b]'
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 text-xs w-5">
                      {String(rec.rank).padStart(2, '0')}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      activeUrgency === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-600'
                        : activeUrgency === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : activeUrgency === 'MODERATE'
                        ? 'bg-sky-950 text-sky-300 border border-sky-600'
                        : 'bg-slate-900 text-slate-400 border border-slate-700'
                    }`}>
                      {activeUrgency}
                    </span>
                    <span className="font-bold text-slate-200 truncate max-w-[140px]">
                      {rec.areaName || rec.targetIds[0]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-purple-300 font-bold px-1.5 py-0.5 bg-purple-950/60 border border-purple-800/60 rounded">
                      {activeAction.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {activeScore}
                    </span>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mt-1 text-[9px]">
                  {rec.hotspotId && (
                    <span className="text-sky-400 flex items-center gap-0.5">
                      <Radar className="w-2.5 h-2.5" />
                      Cluster ({rec.targetCount} targets)
                    </span>
                  )}
                  {rec.relatedChangeType && (
                    <span className="text-cyan-400">
                      Temporal: {rec.relatedChangeType}
                    </span>
                  )}
                  {rec.acknowledged && (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Acknowledged
                    </span>
                  )}
                  {rec.operatorOverride && (
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                      Overridden
                    </span>
                  )}
                </div>

                {/* Expandable Details Rationale Card */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2 border-t border-[#1e293b] space-y-2 text-[10px]">
                    {/* WHY THIS AREA */}
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px]">
                        WHY THIS AREA / TARGET:
                      </span>
                      <ul className="mt-1 space-y-0.5 text-slate-300 pl-2">
                        {rec.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-purple-400 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* EVIDENCE */}
                    <div>
                      <span className="text-slate-400 font-bold block uppercase text-[9px]">
                        EVIDENCE:
                      </span>
                      <ul className="mt-1 space-y-0.5 text-slate-300 pl-2">
                        {rec.evidence.map((e, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-sky-400 font-bold">•</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* UNCERTAINTY */}
                    {rec.uncertainty && rec.uncertainty.length > 0 && (
                      <div>
                        <span className="text-slate-400 font-bold block uppercase text-[9px]">
                          UNCERTAINTY:
                        </span>
                        <ul className="mt-1 space-y-0.5 text-amber-300/80 pl-2">
                          {rec.uncertainty.map((u, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{u}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* EXPECTED BENEFIT */}
                    <div className="bg-[#0e141f] p-1.5 rounded border border-[#1e293b]">
                      <span className="text-purple-400 font-bold block uppercase text-[9px]">
                        EXPECTED BENEFIT:
                      </span>
                      <span className="text-slate-200 mt-0.5 block italic">
                        "{rec.expectedBenefit}"
                      </span>
                    </div>

                    {/* Operator Acknowledgement & Override Controls */}
                    <div className="pt-2 border-t border-[#1e293b] flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        {!rec.acknowledged ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={operatorNoteInput}
                              onChange={(e) => setOperatorNoteInput(e.target.value)}
                              placeholder="Optional operator review note..."
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-[#090d14] border border-[#1e293b] rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-purple-500"
                            />
                            <button
                              onClick={(e) => handleAcknowledge(e, rec.id)}
                              className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded font-bold flex items-center gap-1"
                              title="Acknowledge recommendation review"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>Acknowledge</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Reviewed by {rec.acknowledgedBy || 'Chief Hydrographer'}</span>
                            {rec.operatorNote && (
                              <span className="text-slate-400 italic">"{rec.operatorNote}"</span>
                            )}
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOverridingId(isOverridingId === rec.id ? null : rec.id);
                          }}
                          className="px-2 py-1 bg-[#1e293b] hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                          <span>{isOverridingId === rec.id ? 'Cancel' : 'Override'}</span>
                        </button>
                      </div>

                      {/* Inline Override Form */}
                      {isOverridingId === rec.id && (
                        <form 
                          onSubmit={(e) => handleApplyOverride(e, rec.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#0b101a] border border-amber-900/50 p-2 rounded space-y-2 text-[10px]"
                        >
                          <div className="font-bold text-amber-400">
                            MANUAL OPERATOR OVERRIDE (Preserves Automated Baseline)
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-400 block">Override Urgency:</label>
                              <select
                                value={overrideUrgency}
                                onChange={(e) => setOverrideUrgency(e.target.value as FollowUpUrgency)}
                                className="w-full bg-[#090d14] border border-[#1e293b] rounded p-1 text-slate-200"
                              >
                                <option value="CRITICAL">CRITICAL</option>
                                <option value="HIGH">HIGH</option>
                                <option value="MODERATE">MODERATE</option>
                                <option value="LOW">LOW</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-400 block">Recommended Action:</label>
                              <select
                                value={overrideAction}
                                onChange={(e) => setOverrideAction(e.target.value as RecommendationType)}
                                className="w-full bg-[#090d14] border border-[#1e293b] rounded p-1 text-slate-200"
                              >
                                <option value="ADDITIONAL_SONAR_PASS">ADDITIONAL SONAR PASS</option>
                                <option value="CLOSER_TARGET_INSPECTION">CLOSER TARGET INSPECTION</option>
                                <option value="ROV_VISUAL_INSPECTION">ROV VISUAL INSPECTION</option>
                                <option value="SPECIALIST_ASSESSMENT">SPECIALIST ASSESSMENT</option>
                                <option value="INFRASTRUCTURE_INSPECTION">INFRASTRUCTURE INSPECTION</option>
                                <option value="REASSESS_SURVEY_COVERAGE">REASSESS SURVEY COVERAGE</option>
                                <option value="OPERATOR_REVIEW">OPERATOR REVIEW</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-slate-400 block">Operator Justification Reason (Required):</label>
                            <input
                              type="text"
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="e.g. Target lies adjacent to subsea gas pipeline corridor..."
                              className="w-full bg-[#090d14] border border-[#1e293b] rounded p-1 text-slate-200"
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsOverridingId(null)}
                              className="px-2 py-1 bg-transparent text-slate-400 hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold rounded"
                            >
                              Apply Override
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
