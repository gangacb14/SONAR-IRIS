/**
 * Comprehensive Sonar File Ingestion & Acoustic Pipeline Modal
 * SIH 2026 Problem Statement 26057
 *
 * Supports:
 * - Real Sonar File Ingestion (.json, .csv, .geojson, up to 15MB)
 * - Multipart file upload to /api/sonar/upload with client fallback
 * - Resilient partial record ingestion with transparent rejection reporting
 * - Sample dataset downloads (CSV, GeoJSON, JSON)
 * - Detailed ingestion report: pings, anomalies, follow-up recommendations, missions created
 * - Backwards-compatible single-ping acoustic parameter simulator
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Activity, 
  Layers, 
  ShieldAlert,
  ArrowRight,
  Download,
  Check,
  RefreshCw,
  FileCode,
  Sliders,
  Database,
  Crosshair,
  ListOrdered
} from 'lucide-react';
import { RawSonarPingInput, ValidationResult, NormalizedSonarFrame } from '../../types/sonarFrame';
import { FileIngestionReport, IngestionStatus } from '../../types/ingestion';
import { SonarInputValidator } from '../../services/sonar/validation';
import { SonarPreprocessingPipeline } from '../../services/sonar/pipeline';
import { FileUploadService } from '../../services/sonar/fileUploadService';
import { useSurveyStore } from '../../store/surveyStore';

interface SonarIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalTab = 'FILE_UPLOAD' | 'PARAMETER_SIMULATOR';

export const SonarIngestModal: React.FC<SonarIngestModalProps> = ({ isOpen, onClose }) => {
  const { 
    ingestCustomPing, 
    gain, 
    tvg, 
    contrast, 
    isSlantRangeCorrected, 
    reloadTargets, 
    refreshStorageInfo, 
    addToast,
    ingestTargetsFromCsv,
    dataSource,
    datasetProvenance,
    resetToDemo,
    targets
  } = useSurveyStore();

  const [activeTab, setActiveTab] = useState<ModalTab>('FILE_UPLOAD');

  // File Ingestion State
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<IngestionStatus | 'Idle'>('Idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [ingestionReport, setIngestionReport] = useState<FileIngestionReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parameter Simulator State (preserving legacy single ping tool)
  const [pingNumber, setPingNumber] = useState<number>(42250);
  const [rangeMeters, setRangeMeters] = useState<number>(75);
  const [altitudeMeters, setAltitudeMeters] = useState<number>(14.5);
  const [depthMeters, setDepthMeters] = useState<number>(28.5);
  const [frequencyKhz, setFrequencyKhz] = useState<number>(410);
  const [latitude, setLatitude] = useState<number>(9.24350);
  const [longitude, setLongitude] = useState<number>(79.18420);
  const [presetType, setPresetType] = useState<'NOMINAL' | 'NOISY' | 'DEGRADED_SATURATION' | 'CORRUPTED'>('NOMINAL');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewFrame, setPreviewFrame] = useState<NormalizedSonarFrame | null>(null);

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // File Upload Handlers
  // --------------------------------------------------------------------------

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validExts = ['json', 'csv', 'geojson', 'txt'];

    if (!validExts.includes(ext)) {
      setErrorMessage(`Invalid file format ".${ext}". Please upload .json, .csv, or .geojson sonar files.`);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 15 MB.`);
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setIngestionReport(null);
    setUploadStatus('Idle');
    setUploadProgress(0);
  };

  const handleExecuteUpload = async () => {
    if (!selectedFile) return;

    try {
      setErrorMessage(null);
      setUploadStatus('Processing');
      setUploadProgress(25);

      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 150);

      const rawText = await selectedFile.text();

      // Execute full ingestion pipeline via FileUploadService (backend API with client fallback)
      const report = await FileUploadService.uploadFile(selectedFile);

      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStatus(report.status);
      setIngestionReport(report);

      if (report.status !== 'Failed') {
        // If file is CSV or text, activate dataset in store with bounding box, transect, and targets
        if (selectedFile.name.toLowerCase().endsWith('.csv') || selectedFile.name.toLowerCase().endsWith('.txt')) {
          await ingestTargetsFromCsv(rawText, selectedFile.name);
        }

        // Refresh survey state and backend storage info
        await reloadTargets();
        await refreshStorageInfo();

        if (report.status === 'Completed') {
          addToast(
            'SUCCESS',
            `Ingested ${report.statistics.recordsProcessed} Sonar Records`,
            `${report.statistics.targetsDetected} targets detected, ${report.statistics.recommendationsGenerated} recommendations generated.`
          );
        } else {
          addToast(
            'WARNING',
            `Partially Processed: ${report.statistics.recordsProcessed} Valid, ${report.statistics.recordsRejected} Rejected`,
            `${report.statistics.targetsDetected} targets detected.`
          );
        }
      } else {
        const failureMsg = report.error || report.rejectedRecords?.[0]?.reason || 'All sonar records failed validation';
        setErrorMessage(failureMsg);
        addToast('WARNING', 'Ingestion Failed', failureMsg);
      }
    } catch (err: any) {
      setUploadStatus('Failed');
      setErrorMessage(err.message || 'File ingestion failed');
      addToast('WARNING', 'Upload Error', err.message || 'Sonar file processing error');
    }
  };

  const handleLoadSampleTargetsDirectly = async () => {
    try {
      setErrorMessage(null);
      setUploadStatus('Processing');
      setUploadProgress(40);
      const res = await ingestTargetsFromCsv(SAMPLE_TARGETS_CSV, 'sample_targets_registry.csv');
      setUploadProgress(100);
      setUploadStatus('Completed');
      addToast('SUCCESS', 'Sample Dataset Activated', `Replaced active dataset with ${res.count} imported targets.`);
    } catch (err: any) {
      setUploadStatus('Failed');
      setErrorMessage(err.message || 'Failed to activate sample targets dataset');
    }
  };

  const handleDownloadSample = async (format: 'json' | 'csv' | 'geojson') => {
    try {
      const sample = await FileUploadService.fetchSampleFile(format);
      const blob = new Blob([sample.content], { type: format === 'json' || format === 'geojson' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sample.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('INFO', `Sample Downloaded: ${sample.filename}`, 'Ready for immediate hydrographic testing');
    } catch (err: any) {
      addToast('WARNING', 'Sample Download Failed', err.message);
    }
  };

  const SAMPLE_TARGETS_CSV = `Target ID,Classification,Label,Confidence,Severity,Latitude,Longitude,Slant Range,Depth,Estimated Length,Estimated Width,Shadow Height,Backscatter,Notes
TRG-01,GHOST_NET,Derelict Fishing Net,0.94,HIGH,9.24082,79.18188,38.4,49.8,18.5,4.2,2.8,-14.2,Acoustic netting snagged on reef
TRG-02,METALLIC_DRUM,Industrial Chemical Drum,0.96,HIGH,9.24185,79.18312,44.2,51.2,1.2,0.8,1.4,-9.8,Cylindrical specular reflector
TRG-03,WRECKAGE_DEBRIS,Vessel Hull Scrap,0.95,CRITICAL,9.23650,79.17840,41.2,54.2,12.8,4.5,3.2,-8.4,Structural timber and metal ribs
TRG-04,TIRE_CLUSTER,Commercial Tire Cluster,0.91,MODERATE,9.24420,79.18560,32.6,47.5,6.2,3.1,1.1,-18.2,High backscatter torus signatures
TRG-05,ORDNANCE_UXO,Potential Munitions / UXO,0.88,CRITICAL,9.24210,79.18290,29.4,50.1,2.1,0.6,0.9,-6.5,Elongated high-density metallic echo`;

  const handleDownloadTargetsCsv = () => {
    const blob = new Blob([SAMPLE_TARGETS_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_targets_registry.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('INFO', 'Downloaded sample_targets_registry.csv', 'Sample CSV with target coordinates ready.');
  };

  const handleQuickLoadTargetsCsv = () => {
    const mockFile = new File([SAMPLE_TARGETS_CSV], 'sample_targets_registry.csv', { type: 'text/csv' });
    validateAndSetFile(mockFile);
    addToast('INFO', 'Loaded sample_targets_registry.csv', 'Targets CSV ready for ingestion.');
  };

  const handleQuickLoadSample = async (format: 'json' | 'csv' | 'geojson') => {
    try {
      const sample = await FileUploadService.fetchSampleFile(format);
      const mockFile = new File([sample.content], sample.filename, {
        type: format === 'json' || format === 'geojson' ? 'application/json' : 'text/csv',
      });
      validateAndSetFile(mockFile);
    } catch (err: any) {
      addToast('WARNING', 'Quick Load Failed', err.message);
    }
  };

  // --------------------------------------------------------------------------
  // Legacy Simulator Handlers
  // --------------------------------------------------------------------------

  const buildRawPing = (type = presetType): RawSonarPingInput => {
    const sampleCount = 512;
    const portSamples = new Array<number>(sampleCount);
    const stbdSamples = new Array<number>(sampleCount);

    const nadirCutoff = Math.floor((altitudeMeters / rangeMeters) * sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      if (type === 'CORRUPTED') {
        portSamples[i] = i % 10 === 0 ? NaN : -0.5;
        stbdSamples[i] = 0;
        continue;
      }

      if (type === 'DEGRADED_SATURATION') {
        portSamples[i] = 0.99;
        stbdSamples[i] = 0.98;
        continue;
      }

      if (i < nadirCutoff) {
        portSamples[i] = Math.random() * 0.03;
        stbdSamples[i] = Math.random() * 0.03;
        continue;
      }

      if (i >= nadirCutoff && i <= nadirCutoff + 5) {
        portSamples[i] = 0.85;
        stbdSamples[i] = 0.82;
        continue;
      }

      const grain = type === 'NOISY' ? Math.random() * 0.4 : Math.random() * 0.1;
      const decay = Math.pow(1 - (i / sampleCount) * 0.5, 1.2);
      portSamples[i] = Math.min(1.0, (0.35 + grain) * decay);
      stbdSamples[i] = Math.min(1.0, (0.35 + grain) * decay);
    }

    return {
      surveyId: 'SRV-2026-GOM-01',
      transectId: 'TRX-01',
      pingNumber,
      timestamp: new Date().toISOString(),
      channel: 'DUAL',
      sampleCount,
      rangeMeters: type === 'CORRUPTED' ? -10 : rangeMeters,
      samplingIntervalUsec: 97.4,
      frequencyKhz,
      altitudeMeters: type === 'CORRUPTED' ? 120 : altitudeMeters,
      depthMeters,
      headingDeg: 42.5,
      latitude,
      longitude,
      pitchDeg: 0.1,
      rollDeg: -0.2,
      speedKts: 3.4,
      portSamples,
      starboardSamples: stbdSamples,
      packetFormat: 'IMAGE_INGEST',
    };
  };

  const handleValidateAndPreprocess = () => {
    const raw = buildRawPing();
    const val = SonarInputValidator.validate(raw);
    setValidationResult(val);

    const frame = SonarPreprocessingPipeline.processFrame(raw, {
      gain,
      tvg,
      contrast,
      isSlantRangeCorrected,
      noiseFilterThreshold: 0.04,
    });
    setPreviewFrame(frame);
  };

  const handleInjectIntoStream = () => {
    const raw = buildRawPing();
    ingestCustomPing(raw);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div 
        id="sonar-ingest-modal"
        className="w-full max-w-3xl bg-[#090d14] border border-[#2c3a50] rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200 text-xs font-mono-tech select-none"
      >
        {/* Header */}
        <div className="p-3.5 bg-[#0e141f] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-sm tracking-wider text-slate-100 uppercase">
              SONAR DATA INGESTION & PIPELINE SUITE
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1e293b] bg-[#090d14] px-4 pt-2 gap-2">
          <button
            id="tab-file-ingest"
            onClick={() => setActiveTab('FILE_UPLOAD')}
            className={`pb-2 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'FILE_UPLOAD'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Real Sonar File Ingest (.json / .csv / .geojson)</span>
          </button>
          <button
            id="tab-param-sim"
            onClick={() => setActiveTab('PARAMETER_SIMULATOR')}
            className={`pb-2 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'PARAMETER_SIMULATOR'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Single-Ping Simulator & QA</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {activeTab === 'FILE_UPLOAD' ? (
            /* ============================================================= */
            /* TAB 1: REAL SONAR FILE INGESTION                              */
            /* ============================================================= */
            <div className="space-y-4">
              {/* Active Dataset Provenance & Isolation Banner */}
              <div className="p-3 bg-[#0e141f] border border-[#1e293b] rounded space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dataSource === 'CSV_IMPORT' ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                      ACTIVE DATA SOURCE:{' '}
                      <span className={dataSource === 'CSV_IMPORT' ? 'text-cyan-400' : 'text-amber-400'}>
                        {dataSource === 'CSV_IMPORT' ? 'OPERATOR CSV INGESTION' : 'DEMO REPLAY (GULF OF MANNAR)'}
                      </span>
                    </span>
                  </div>
                  {dataSource === 'CSV_IMPORT' ? (
                    <button
                      type="button"
                      onClick={resetToDemo}
                      className="px-2 py-0.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700 text-amber-300 rounded text-[10px] transition-colors"
                      title="Reset state and restore baseline demo data"
                    >
                      ↺ Restore Baseline Demo Data
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLoadSampleTargetsDirectly}
                      className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-300 rounded text-[10px] transition-colors"
                      title="Instantly test CSV ingestion & dataset replacement"
                    >
                      ⚡ Test CSV Replacement (Sample)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div className="bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                    <span className="text-slate-500 uppercase block">Active File</span>
                    <span className="text-slate-200 font-semibold truncate block" title={datasetProvenance.sourceFilename}>
                      {datasetProvenance.sourceFilename}
                    </span>
                  </div>
                  <div className="bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                    <span className="text-slate-500 uppercase block">Targets Count</span>
                    <span className="text-cyan-300 font-bold block">
                      {datasetProvenance.validTargetsCount} Valid Targets
                    </span>
                  </div>
                  <div className="bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                    <span className="text-slate-500 uppercase block">Rejections</span>
                    <span className={datasetProvenance.rejectedRowsCount > 0 ? 'text-rose-400 font-bold block' : 'text-slate-400 block'}>
                      {datasetProvenance.rejectedRowsCount} Rows Rejected
                    </span>
                  </div>
                  <div className="bg-[#090d14] p-1.5 rounded border border-[#1e293b]">
                    <span className="text-slate-500 uppercase block">Bounding Extent</span>
                    <span className="text-slate-300 block truncate" title={`[${datasetProvenance.boundingBox.minLat.toFixed(3)}, ${datasetProvenance.boundingBox.minLng.toFixed(3)}] to [${datasetProvenance.boundingBox.maxLat.toFixed(3)}, ${datasetProvenance.boundingBox.maxLng.toFixed(3)}]`}>
                      {datasetProvenance.boundingBox.minLat.toFixed(3)}°N, {datasetProvenance.boundingBox.minLng.toFixed(3)}°E
                    </span>
                  </div>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                id="sonar-file-dropzone"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                  dragActive
                    ? 'border-cyan-400 bg-cyan-950/20 text-cyan-200'
                    : selectedFile
                    ? 'border-emerald-600/70 bg-[#0e141f] text-slate-200'
                    : 'border-[#2c3a50] hover:border-cyan-500/50 bg-[#0e141f]/70 text-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.geojson,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-1">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click to Browse or Drag & Drop Sonar File'}
                </div>
                <div className="text-[11px] text-slate-400 max-w-md">
                  Supports standardized hydrographic formats: <strong>JSON Array</strong>, <strong>CSV Transect</strong>, or <strong>GeoJSON Features</strong> (Max: 15 MB)
                </div>
                {selectedFile && (
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-cyan-300">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>Ready for validation & ONNX inference</span>
                  </div>
                )}
              </div>

              {/* Sample Files Toolbar */}
              <div className="bg-[#0e141f] border border-[#1e293b] p-2.5 rounded flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Standard Test Datasets (Quick Load / Download):</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickLoadSample('json')}
                      className="px-2 py-1 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-cyan-300 rounded text-[10px] transition-colors"
                      title="Load sample JSON pings into uploader"
                    >
                      Load .JSON
                    </button>
                    <button
                      onClick={() => handleDownloadSample('json')}
                      className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-cyan-300 rounded"
                      title="Download sample JSON file"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickLoadTargetsCsv()}
                      className="px-2 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600 text-cyan-200 rounded text-[10px] font-bold transition-colors"
                      title="Load sample CSV containing Targets with coordinates, class, severity"
                    >
                      Targets .CSV
                    </button>
                    <button
                      onClick={() => handleDownloadTargetsCsv()}
                      className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-cyan-300 rounded"
                      title="Download sample Targets CSV"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickLoadSample('csv')}
                      className="px-2 py-1 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-cyan-300 rounded text-[10px] transition-colors"
                      title="Load sample CSV transect into uploader"
                    >
                      Raw Sonar .CSV
                    </button>
                    <button
                      onClick={() => handleDownloadSample('csv')}
                      className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-cyan-300 rounded"
                      title="Download sample CSV file"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickLoadSample('geojson')}
                      className="px-2 py-1 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-cyan-300 rounded text-[10px] transition-colors"
                      title="Load sample GeoJSON into uploader"
                    >
                      Load .GeoJSON
                    </button>
                    <button
                      onClick={() => handleDownloadSample('geojson')}
                      className="p-1 hover:bg-[#1e293b] text-slate-400 hover:text-cyan-300 rounded"
                      title="Download sample GeoJSON file"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message banner */}
              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded flex items-start gap-2 text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight">{errorMessage}</div>
                </div>
              )}

              {/* Progress indicator */}
              {uploadStatus === 'Processing' && (
                <div className="space-y-1.5 bg-[#0e141f] border border-[#1e293b] p-3 rounded">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-cyan-300 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Ingesting & executing AI detection pipeline...
                    </span>
                    <span className="font-bold text-slate-200">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-cyan-500 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ingestion Report Card */}
              {ingestionReport && (
                <div className="space-y-3 bg-[#0e141f] border border-[#1e293b] p-3.5 rounded">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${
                        ingestionReport.status === 'Completed'
                          ? 'text-emerald-400'
                          : ingestionReport.status === 'Partially Processed'
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`} />
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                        INGESTION REPORT: {ingestionReport.filename}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ingestionReport.status === 'Completed'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : ingestionReport.status === 'Partially Processed'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        : 'bg-red-950/80 text-red-300 border border-red-700/60'
                    }`}>
                      {ingestionReport.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Sonar Pings Processed</div>
                      <div className="text-base font-bold text-cyan-300">
                        {ingestionReport.statistics.recordsProcessed} / {ingestionReport.statistics.recordsReceived}
                      </div>
                    </div>
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Seabed Anomalies Detected</div>
                      <div className="text-base font-bold text-amber-300">
                        {ingestionReport.statistics.targetsDetected}
                      </div>
                    </div>
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Follow-Up Missions</div>
                      <div className="text-base font-bold text-emerald-300">
                        {ingestionReport.statistics.recommendationsGenerated} recs ({ingestionReport.statistics.missionsCreated} missions)
                      </div>
                    </div>
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Persistence Backend</div>
                      <div className="text-slate-200 font-semibold flex items-center gap-1 mt-0.5">
                        <Database className="w-3 h-3 text-cyan-400" />
                        <span>{ingestionReport.storageMode}</span>
                      </div>
                    </div>
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Execution Latency</div>
                      <div className="text-slate-200 font-semibold mt-0.5">
                        {ingestionReport.durationMs} ms
                      </div>
                    </div>
                    <div className="bg-[#090d14] p-2 rounded border border-[#1e293b]">
                      <div className="text-slate-500 uppercase">Rejected Records</div>
                      <div className={`font-bold mt-0.5 ${
                        ingestionReport.statistics.recordsRejected > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {ingestionReport.statistics.recordsRejected} records
                      </div>
                    </div>
                  </div>

                  {/* Rejected Records Details (if any) */}
                  {ingestionReport.rejectedRecords.length > 0 && (
                    <div className="p-2.5 bg-amber-950/20 border border-amber-800/40 rounded space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-300 uppercase flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Resilient Ingestion: {ingestionReport.rejectedRecords.length} Malformed Records Suppressed</span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {ingestionReport.rejectedRecords.map((rej, idx) => (
                          <div key={idx} className="text-[9px] text-slate-300 bg-slate-900/80 p-1 rounded flex items-center justify-between">
                            <span>Record #{rej.recordIndex}: {rej.reason}</span>
                            {rej.rawSnippet && <span className="text-slate-500 font-mono text-[8px]">{rej.rawSnippet}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected Targets Snippet */}
                  {ingestionReport.detectedTargets.length > 0 && (
                    <div className="text-[10px] space-y-1">
                      <span className="text-slate-400 uppercase font-semibold">Targets Extracted:</span>
                      <div className="flex flex-wrap gap-1">
                        {ingestionReport.detectedTargets.map((t) => (
                          <span
                            key={t.id}
                            className="px-2 py-0.5 rounded bg-[#131b29] border border-[#2c3a50] text-slate-300 text-[9px] flex items-center gap-1"
                          >
                            <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
                            <span>{t.id}: {t.categoryLabel} (Ping #{t.pingNumber})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ============================================================= */
            /* TAB 2: PARAMETER SIMULATOR & SINGLE-PING QA (LEGACY)          */
            /* ============================================================= */
            <div className="space-y-4">
              {/* Preset Ingestion Selector */}
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">
                  Select Ingestion Stream Preset:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'NOMINAL', label: 'Nominal Swath', desc: 'Clean seabed' },
                    { id: 'NOISY', label: 'Acoustic Reverberation', desc: 'Thruster noise' },
                    { id: 'DEGRADED_SATURATION', label: 'Receiver Saturation', desc: 'Over-amplified' },
                    { id: 'CORRUPTED', label: 'Corrupted Packet', desc: 'Fails validation' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPresetType(p.id as any);
                        setValidationResult(null);
                        setPreviewFrame(null);
                      }}
                      className={`p-2 rounded border text-left flex flex-col gap-0.5 transition-colors ${
                        presetType === p.id 
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 font-bold' 
                          : 'bg-[#0e141f] border-[#1e293b] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-[10px] uppercase text-slate-200">{p.label}</span>
                      <span className="text-[9px] text-slate-500">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical & Navigation Parameters */}
              <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded space-y-3">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">
                  Hydrographic & Acoustic Ingestion Parameters:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Ping Number</label>
                    <input 
                      type="number"
                      value={pingNumber}
                      onChange={(e) => setPingNumber(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Swath Range (m)</label>
                    <input 
                      type="number"
                      value={rangeMeters}
                      onChange={(e) => setRangeMeters(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Towfish Altitude (m)</label>
                    <input 
                      type="number"
                      value={altitudeMeters}
                      onChange={(e) => setAltitudeMeters(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Chirp Freq (kHz)</label>
                    <input 
                      type="number"
                      value={frequencyKhz}
                      onChange={(e) => setFrequencyKhz(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Latitude (°N)</label>
                    <input 
                      type="number"
                      step="0.00001"
                      value={latitude}
                      onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase">Longitude (°E)</label>
                    <input 
                      type="number"
                      step="0.00001"
                      value={longitude}
                      onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#090d14] border border-[#1e293b] px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Action to trigger validation & preprocessing */}
              <div className="flex gap-2">
                <button
                  id="btn-modal-validate"
                  onClick={handleValidateAndPreprocess}
                  className="flex-1 py-2 bg-[#131b29] hover:bg-[#1e293b] border border-[#2c3a50] text-cyan-300 font-semibold rounded flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Execute Preprocessing Pipeline</span>
                </button>
              </div>

              {/* Validation & Quality Diagnostics Output */}
              {validationResult && (
                <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">STAGE 1: INPUT VALIDATION REPORT</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      validationResult.isValid 
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' 
                        : 'bg-red-950/80 text-red-300 border border-red-700/60'
                    }`}>
                      {validationResult.isValid ? 'VALID PASS' : 'VALIDATION FAILED'}
                    </span>
                  </div>

                  {validationResult.issues.length > 0 && (
                    <div className="space-y-1">
                      {validationResult.issues.map((iss, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-300">
                          <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                            iss.severity === 'FATAL' ? 'text-red-400' : 'text-amber-400'
                          }`} />
                          <span>[{iss.severity}] {iss.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stage 7: Quality Assessment & Preprocessing Summary */}
              {previewFrame && (
                <div className="bg-[#0e141f] border border-[#1e293b] p-3 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold">STAGE 7: NORMALIZED FRAME QUALITY</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewFrame.quality.status === 'GOOD'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : previewFrame.quality.status === 'DEGRADED'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        : 'bg-red-950/80 text-red-300 border border-red-700/60'
                    }`}>
                      SCORE: {previewFrame.quality.score}/100 ({previewFrame.quality.status})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[10px]">
                    <div>Processing Status: <strong className="text-slate-200">{previewFrame.processingStatus}</strong></div>
                    <div>Execution Time: <strong className="text-slate-200">{previewFrame.processingTimeMs} ms</strong></div>
                    <div>Dynamic Range: <strong className="text-slate-200">{previewFrame.quality.dynamicRangeDb} dB</strong></div>
                    <div>Receiver Saturation: <strong className="text-slate-200">{previewFrame.quality.saturationPercentage}%</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0e141f] border-t border-[#1e293b] flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            {activeTab === 'FILE_UPLOAD'
              ? 'Multi-ping acoustic tracking & PostGIS persistence enabled.'
              : 'Single-ping direct pipeline test mode.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#1e293b] text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
            {activeTab === 'FILE_UPLOAD' ? (
              <button
                id="btn-execute-file-upload"
                disabled={!selectedFile || uploadStatus === 'Processing'}
                onClick={handleExecuteUpload}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 font-semibold rounded flex items-center gap-1.5 transition-colors"
              >
                {uploadStatus === 'Processing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing File...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Ingest & Execute Pipeline</span>
                  </>
                )}
              </button>
            ) : (
              <button
                id="btn-modal-inject"
                onClick={handleInjectIntoStream}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-100 font-semibold rounded flex items-center gap-1.5 transition-colors"
              >
                <span>Inject Into Waterfall</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
