import React, { useState } from 'react';
import { Waves, Video } from 'lucide-react';
import { SurveyProvider, useSurveyStore } from './store/surveyStore';
import { DebrisCategory, VerificationStatus } from './types/sonar';
import { TopMissionBar } from './components/TopMissionBar';
import { NavigationRail, ActiveNavView } from './components/NavigationRail';
import { OverviewView } from './components/overview/OverviewView';
import { WaterfallWorkspace } from './components/waterfall/WaterfallWorkspace';
import { GeospatialMapView } from './components/map/GeospatialMapView';
import { DebrisRegistryView } from './components/registry/DebrisRegistryView';
import { DiagnosticsView } from './components/diagnostics/DiagnosticsView';
import { ReportView } from './components/report/ReportView';
import { DetailsPanel } from './components/details/DetailsPanel';
import { ToastContainer } from './components/NotificationToast';
import { SonarIngestModal } from './components/waterfall/SonarIngestModal';
import { MissionPriorityQueuePanel } from './components/followUp/MissionPriorityQueuePanel';
import { SubseaVideoView } from './components/video/SubseaVideoView';
import { AuditLogModal } from './components/audit/AuditLogModal';

function MarineWorkstationInner() {
  const {
    survey,
    transects,
    targets,
    activeTarget,
    activeTargetAuditTrail,
    telemetry,
    appMode,
    isPlaying,
    frequencyKhz,
    aiEngineStatus,
    lastInferenceDurationMs,
    toasts,
    addToast,
    dismissToast,
    selectTarget,
    updateTarget,
    confirmTarget,
    rejectTarget,
    reclassifyTarget,
    markTargetUnknown,
    addOperatorNote,
    overrideTargetRisk,
    acknowledgeTargetRisk,
    riskSummary,
    modelRuntimeInfo,
    togglePlay,
    toggleFrequency,
  } = useSurveyStore();

  const [activeView, setActiveView] = useState<ActiveNavView>('OVERVIEW');
  const [sonarSubMode, setSonarSubMode] = useState<'WATERFALL' | 'VIDEO'>('WATERFALL');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Status handler dispatching to centralized repository operations
  const handleUpdateStatus = (
    detectionId: string,
    newStatus: VerificationStatus,
    notes?: string
  ) => {
    if (newStatus === 'CONFIRMED_DEBRIS') {
      confirmTarget(detectionId, notes);
    } else if (newStatus === 'FALSE_POSITIVE') {
      rejectTarget(detectionId, notes);
    } else if (newStatus === 'GEOLOGICAL_ANOMALY') {
      markTargetUnknown(detectionId, notes);
    } else {
      updateTarget(detectionId, {
        verificationStatus: newStatus,
        operatorNotes: notes,
      });
    }
  };

  // Reclassify category handler dispatching to centralized store
  const handleUpdateCategory = (detectionId: string, newCategory: DebrisCategory) => {
    reclassifyTarget(detectionId, newCategory);
  };

  // Export GeoJSON from canonical centralized store targets
  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      name: `${survey.code}_DEBRIS_TARGETS`,
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
      },
      features: targets.map((det) => ({
        type: 'Feature',
        properties: {
          id: det.id,
          surveyId: det.surveyId,
          transectId: det.transectId,
          pingNumber: det.pingNumber,
          category: det.classification,
          label: det.categoryLabel,
          confidence: det.confidence,
          status: det.verificationStatus,
          severity: det.severity,
          channel: det.channel,
          slantRangeM: det.slantRange,
          shadowLengthM: det.shadowLength,
          estimatedHeightM: det.shadowHeight,
          estimatedLengthM: det.estimatedLength,
          estimatedWidthM: det.estimatedWidth,
          backscatterDb: det.backscatter,
          depthM: det.depth,
          utmZone: det.utmZone,
          utmEasting: det.utmEasting,
          utmNorthing: det.utmNorthing,
          notes: det.operatorNotes,
          detectedAt: det.detectedAt,
          verifiedAt: det.verifiedAt,
          verifiedBy: det.verifiedBy,
        },
        geometry: {
          type: 'Point',
          coordinates: [det.longitude, det.latitude],
        },
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `${survey.code}_DEBRIS_TARGETS.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('SUCCESS', 'GeoJSON Export Complete', 'Standard GIS layer downloaded.');
  };

  // Export CSV from canonical centralized store targets
  const handleExportCSV = () => {
    const headers = [
      'Target ID',
      'Survey ID',
      'Transect',
      'Ping',
      'Detected At',
      'Classification',
      'Label',
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
      'UTM Zone',
      'UTM Easting',
      'UTM Northing',
      'Depth (m)',
      'Verified By',
      'Verified At',
      'Operator Notes',
    ];

    const rows = targets.map((d) => [
      d.id,
      d.surveyId,
      d.transectId,
      d.pingNumber,
      d.detectedAt,
      d.classification,
      `"${d.categoryLabel}"`,
      d.confidence.toFixed(3),
      d.verificationStatus,
      d.severity,
      d.channel,
      d.slantRange.toFixed(1),
      d.shadowLength.toFixed(1),
      d.shadowHeight.toFixed(2),
      d.estimatedLength.toFixed(1),
      d.estimatedWidth.toFixed(1),
      d.backscatter.toFixed(1),
      d.latitude.toFixed(6),
      d.longitude.toFixed(6),
      d.utmZone,
      d.utmEasting.toFixed(1),
      d.utmNorthing.toFixed(1),
      d.depth.toFixed(1),
      `"${d.verifiedBy || ''}"`,
      `"${d.verifiedAt || ''}"`,
      `"${(d.operatorNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${survey.code}_DEBRIS_CATALOG.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('SUCCESS', 'CSV Export Complete', 'Full registry exported.');
  };

  const pendingCount = targets.filter((d) => d.verificationStatus === 'PENDING_REVIEW').length;

  return (
    <div id="marine-operational-workstation" className="flex flex-col h-screen w-screen bg-[#090d14] text-slate-100 overflow-hidden select-none">
      {/* Top Mission / Status Bar */}
      <TopMissionBar
        mission={survey}
        telemetry={telemetry}
        isPlaying={isPlaying}
        appMode={appMode}
        onTogglePlay={togglePlay}
        onExportClick={() => setActiveView('REPORT')}
        onIngestClick={() => setIsIngestModalOpen(true)}
        onAuditLogsClick={() => setIsAuditModalOpen(true)}
        activeView={activeView}
        aiStatus={aiEngineStatus}
        aiLatencyMs={lastInferenceDurationMs}
        riskSummary={riskSummary}
        modelRuntimeInfo={modelRuntimeInfo}
      />

      {/* Main Workspace Frame: Left Rail + Center Screen + Right Context Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Compact Navigation Rail */}
        <NavigationRail
          activeView={activeView}
          onSelectView={(view) => setActiveView(view)}
          pendingReviewsCount={pendingCount}
          totalDetectionsCount={targets.length}
          frequencyKhz={frequencyKhz}
          onToggleFrequency={toggleFrequency}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        />

        {/* Center Primary Operational Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeView === 'OVERVIEW' && (
            <OverviewView
              onNavigate={(view) => setActiveView(view)}
              onOpenIngestModal={() => setIsIngestModalOpen(true)}
            />
          )}

          {activeView === 'SONAR_SCAN' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Sonar Sensor Stream Mode Sub-bar */}
              <div className="bg-[#0b1018] border-b border-[#1e293b] px-3.5 py-1.5 flex items-center justify-between gap-3 text-xs flex-shrink-0 z-10">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-tech uppercase text-slate-400">SENSOR STREAM:</span>
                  <div className="flex items-center gap-1 bg-[#070c14] border border-[#1e293b] p-0.5 rounded">
                    <button
                      id="btn-submode-waterfall"
                      onClick={() => setSonarSubMode('WATERFALL')}
                      className={`px-2.5 py-1 rounded text-xs font-mono-tech transition-all flex items-center gap-1.5 ${
                        sonarSubMode === 'WATERFALL'
                          ? 'bg-sky-950 text-sky-300 font-semibold border border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Waves className="w-3.5 h-3.5 text-sky-400" />
                      <span>Acoustic Waterfall</span>
                    </button>
                    <button
                      id="btn-submode-video"
                      onClick={() => setSonarSubMode('VIDEO')}
                      className={`px-2.5 py-1 rounded text-xs font-mono-tech transition-all flex items-center gap-1.5 ${
                        sonarSubMode === 'VIDEO'
                          ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Subsea Optical AI Feed</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono-tech text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{sonarSubMode === 'WATERFALL' ? 'SONAR-IRIS DUAL-CHANNEL SSS (PORT / STBD)' : 'ROV OPTICAL INSPECTION STREAM'}</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {sonarSubMode === 'WATERFALL' ? (
                  <WaterfallWorkspace
                    detections={targets}
                    selectedDetection={activeTarget}
                    onSelectDetection={(det) => {
                      selectTarget(det.id);
                      setIsRightPanelOpen(true);
                    }}
                    telemetry={telemetry}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                  />
                ) : (
                  <SubseaVideoView />
                )}
              </div>
            </div>
          )}

          {activeView === 'DETECTIONS' && (
            <DebrisRegistryView
              detections={targets}
              selectedDetection={activeTarget}
              onSelectDetection={(det) => {
                selectTarget(det.id);
                setIsRightPanelOpen(true);
              }}
              onUpdateDetectionStatus={handleUpdateStatus}
            />
          )}

          {activeView === 'MAP' && (
            <GeospatialMapView
              mission={survey}
              transects={transects}
              detections={targets}
              selectedDetection={activeTarget}
              onSelectDetection={(det) => {
                selectTarget(det.id);
                setIsRightPanelOpen(true);
              }}
              telemetry={telemetry}
            />
          )}

          {activeView === 'MISSION' && (
            <div className="flex-1 p-4 overflow-y-auto bg-[#090d14]">
              <div className="max-w-6xl mx-auto">
                <MissionPriorityQueuePanel />
              </div>
            </div>
          )}

          {activeView === 'REPORT' && (
            <ReportView
              mission={survey}
              transects={transects}
              detections={targets}
              onExportGeoJSON={handleExportGeoJSON}
              onExportCSV={handleExportCSV}
            />
          )}
        </main>

        {/* Right Contextual Analysis / Details Panel */}
        {isRightPanelOpen && activeView !== 'REPORT' && activeView !== 'OVERVIEW' && (
          <DetailsPanel
            detection={activeTarget}
            onClose={() => setIsRightPanelOpen(false)}
            onUpdateStatus={handleUpdateStatus}
            onUpdateCategory={handleUpdateCategory}
            onAddNote={addOperatorNote}
            onOverrideRisk={overrideTargetRisk}
            onAcknowledgeRisk={acknowledgeTargetRisk}
            auditEvents={activeTargetAuditTrail}
          />
        )}
      </div>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Sonar Ingestion and Preprocessing Pipeline Modal */}
      <SonarIngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
      />

      {/* Mission Provenance & Cruise Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <SurveyProvider>
      <MarineWorkstationInner />
    </SurveyProvider>
  );
}
