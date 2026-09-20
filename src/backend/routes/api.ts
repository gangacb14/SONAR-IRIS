/**
 * REST API Endpoints for Sonar Debris & GEOINT Analytics
 * SIH 2026 Problem Statement 26057
 *
 * Provides validated API routes for:
 * - Database health, PostGIS telemetry & migrations
 * - Survey and transect metadata
 * - Target ingestion, spatial queries (PostGIS nearby/bbox), lifecycle transitions
 * - Follow-up survey recommendations & mission queue
 * - Operator acknowledgement & overrides
 * - Audit provenance logs
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../db/storageService';
import { db } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { Target, DebrisCategory, VerificationStatus } from '../../types/target';
import { RiskLevel } from '../../types/risk';
import { FollowUpOperatorOverride } from '../../types/followUp';
import { FileIngestionPipeline } from '../../services/sonar/fileIngestionPipeline';
import { SonarFileParser } from '../../services/sonar/fileParser';

const router = Router();

// Middleware: attach storage mode header
router.use(async (_req, res, next) => {
  const health = await db.getHealth();
  res.setHeader('X-Storage-Mode', health.storageMode);
  res.setHeader('X-PostGIS-Active', String(health.postgisAvailable));
  next();
});

// ============================================================================
// 1. HEALTH & DATABASE STATUS
// ============================================================================

router.get('/health', async (_req: Request, res: Response) => {
  const status = await storageService.getStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: status,
  });
});

router.get('/db/status', async (_req: Request, res: Response) => {
  try {
    const status = await storageService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/db/migrate', async (_req: Request, res: Response) => {
  try {
    const result = await runMigrations();
    res.json({
      success: result.success,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. SURVEYS & TRANSECTS
// ============================================================================

router.get('/surveys/:id', async (req: Request, res: Response) => {
  try {
    const survey = await storageService.getSurvey(req.params.id);
    if (!survey) {
      return res.status(404).json({ success: false, error: `Survey '${req.params.id}' not found` });
    }
    const transects = await storageService.getTransects(req.params.id);
    res.json({ success: true, data: { survey, transects } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 3. TARGETS & POSTGIS SPATIAL QUERIES
// ============================================================================

/**
 * GET /api/targets/nearby - PostGIS ST_DWithin & ST_Distance search
 */
router.get('/targets/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat((req.query.lng || req.query.lon) as string);
    const radiusMeters = parseFloat((req.query.radiusMeters || req.query.radius || '500') as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid spatial parameters: lat and lng/lon query params must be valid numbers',
      });
    }

    if (radiusMeters <= 0 || radiusMeters > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid radiusMeters: must be between 1 and 50000 meters',
      });
    }

    const nearby = await storageService.findNearbyTargets(lat, lng, radiusMeters);
    res.json({
      success: true,
      data: nearby,
      spatialQuery: {
        center: { lat, lng },
        radiusMeters,
        resultsCount: nearby.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/targets/bbox - PostGIS Bounding Box Search
 */
router.get('/targets/bbox', async (req: Request, res: Response) => {
  try {
    const minLat = parseFloat(req.query.minLat as string);
    const maxLat = parseFloat(req.query.maxLat as string);
    const minLng = parseFloat((req.query.minLng || req.query.minLon) as string);
    const maxLng = parseFloat((req.query.maxLng || req.query.maxLon) as string);

    if ([minLat, maxLat, minLng, maxLng].some((n) => isNaN(n))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box: minLat, maxLat, minLng, maxLng must all be numbers',
      });
    }

    const targets = await storageService.findTargetsInBoundingBox(minLat, maxLat, minLng, maxLng);
    res.json({
      success: true,
      data: targets,
      boundingBox: { minLat, maxLat, minLng, maxLng, count: targets.length },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/targets - List targets with optional attribute filters
 */
router.get('/targets', async (req: Request, res: Response) => {
  try {
    const targets = await storageService.getTargets({
      surveyId: req.query.surveyId as string,
      classification: req.query.classification as string,
      severity: req.query.severity as string,
      status: req.query.status as string,
    });
    res.json({ success: true, data: targets, count: targets.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/targets/:id - Get single target
 */
router.get('/targets/:id', async (req: Request, res: Response) => {
  try {
    const target = await storageService.getTargetById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, error: `Target '${req.params.id}' not found` });
    }
    res.json({ success: true, data: target });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets - Ingest target record
 */
router.post('/targets', async (req: Request, res: Response) => {
  try {
    const target = req.body as Target;
    if (!target || !target.id || typeof target.latitude !== 'number' || typeof target.longitude !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid target payload: must include id, latitude, and longitude',
      });
    }

    const operator = (req.body.operator as string) || 'AI-EDGE-INFERENCE';
    const saved = await storageService.upsertTarget(target, operator);

    const audit: import('../../types/audit').AuditEvent = {
      id: `AUD-ING-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: saved.id,
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_CREATED',
      title: 'Target Ingested via API',
      previousValue: undefined,
      newValue: saved.categoryLabel,
      operator,
      description: `Target ${saved.id} (${saved.categoryLabel}) persisted via backend API.`,
    };
    await storageService.addAuditEvent(audit);

    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/replace - Replace entire target dataset with imported targets
 */
router.post('/targets/replace', async (req: Request, res: Response) => {
  try {
    const { targets, operator } = req.body;
    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({
        success: false,
        error: 'Expected "targets" array in request body.',
      });
    }

    const op = operator || 'CSV_IMPORT';
    const replaced = await storageService.replaceTargets(targets, op);

    const audit: import('../../types/audit').AuditEvent = {
      id: `AUD-REPLACE-${Date.now()}`,
      targetId: targets[0]?.id || 'SYSTEM',
      timestamp: new Date().toISOString(),
      actionType: 'TARGET_CREATED',
      title: 'Active Dataset Replaced via API',
      newValue: `${replaced.length} targets active`,
      operator: op,
      description: `Replaced active target dataset with ${replaced.length} records.`,
    };
    await storageService.addAuditEvent(audit);

    res.json({ success: true, data: replaced });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/reset-demo - Reset active targets to baseline demo dataset
 */
router.post('/targets/reset-demo', async (_req: Request, res: Response) => {
  try {
    const reset = await storageService.resetToDemo();
    res.json({ success: true, data: reset });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/targets/:id - Update target fields
 */
router.patch('/targets/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const patch = req.body;
    const operator = req.body.operator || 'Hydrographer';

    const result = await storageService.updateTarget(id, patch, operator);
    if (!result) {
      return res.status(404).json({ success: false, error: `Target '${id}' not found` });
    }

    res.json({ success: true, data: result.target, audit: result.audit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/:id/confirm - Confirm target as marine debris
 */
router.post('/targets/:id/confirm', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const notes = req.body.notes || 'Debris presence confirmed by operator';
    const operator = req.body.operator || 'Hydrographer';

    const result = await storageService.updateTarget(
      id,
      {
        verificationStatus: 'CONFIRMED_DEBRIS',
        operatorNotes: notes,
        verifiedAt: new Date().toISOString(),
        verifiedBy: operator,
      },
      operator
    );

    if (!result) {
      return res.status(404).json({ success: false, error: `Target '${id}' not found` });
    }

    res.json({ success: true, data: result.target, audit: result.audit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/:id/reject - Reject target as false positive
 */
router.post('/targets/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const notes = req.body.notes || 'Marked as false alarm';
    const operator = req.body.operator || 'Hydrographer';

    const result = await storageService.updateTarget(
      id,
      {
        verificationStatus: 'FALSE_POSITIVE',
        operatorNotes: notes,
        verifiedAt: new Date().toISOString(),
        verifiedBy: operator,
      },
      operator
    );

    if (!result) {
      return res.status(404).json({ success: false, error: `Target '${id}' not found` });
    }

    res.json({ success: true, data: result.target, audit: result.audit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/:id/reclassify - Reclassify category
 */
router.post('/targets/:id/reclassify', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const classification = req.body.classification as DebrisCategory;
    const notes = req.body.notes;
    const operator = req.body.operator || 'Hydrographer';

    if (!classification) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: classification' });
    }

    const result = await storageService.updateTarget(
      id,
      {
        classification,
        operatorNotes: notes,
        verifiedAt: new Date().toISOString(),
        verifiedBy: operator,
      },
      operator
    );

    if (!result) {
      return res.status(404).json({ success: false, error: `Target '${id}' not found` });
    }

    res.json({ success: true, data: result.target, audit: result.audit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/targets/:id/risk-override - Operator risk level override
 */
router.post('/targets/:id/risk-override', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { operatorRiskLevel, reason, operator } = req.body;

    if (!operatorRiskLevel || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: operatorRiskLevel and reason',
      });
    }

    const result = await storageService.updateTarget(
      id,
      {
        operatorRiskLevel: operatorRiskLevel as RiskLevel,
        operatorOverrideReason: reason,
      },
      operator || 'Hydrographer'
    );

    if (!result) {
      return res.status(404).json({ success: false, error: `Target '${id}' not found` });
    }

    res.json({ success: true, data: result.target, audit: result.audit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. RECOMMENDATIONS & MISSION QUEUE
// ============================================================================

/**
 * GET /api/recommendations - Retrieve prioritized mission queue
 */
router.get('/recommendations', async (_req: Request, res: Response) => {
  try {
    const recommendations = await storageService.getRecommendations();
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/recommendations/:id - Retrieve single recommendation
 */
router.get('/recommendations/:id', async (req: Request, res: Response) => {
  try {
    const rec = await storageService.getRecommendationById(req.params.id);
    if (!rec) {
      return res.status(404).json({ success: false, error: `Recommendation '${req.params.id}' not found` });
    }
    res.json({ success: true, data: rec });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/recommendations/sync - Ingest or sync recommendations from the engine
 */
router.post('/recommendations/sync', async (req: Request, res: Response) => {
  try {
    const recommendations = req.body.recommendations;
    if (!Array.isArray(recommendations)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: recommendations must be an array',
      });
    }

    await storageService.syncRecommendations(recommendations);
    res.json({ success: true, count: recommendations.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/recommendations/:id/acknowledge - Operator Acknowledgement
 */
router.post('/api/recommendations/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const operatorNote = req.body.operatorNote;
    const operatorId = req.body.operatorId || 'Chief Hydrographer';
    const now = new Date().toISOString();

    const updated = await storageService.acknowledgeRecommendation(id, {
      acknowledgedAt: now,
      acknowledgedBy: operatorId,
      operatorNote,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: `Recommendation '${id}' not found` });
    }

    // Add audit trail event
    await storageService.addAuditEvent({
      id: `AUD-FOL-ACK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: updated.targetIds[0] || id,
      timestamp: now,
      actionType: 'FOLLOW_UP_RECOMMENDATION_ACKNOWLEDGED',
      title: 'Recommendation Acknowledged via API',
      previousValue: 'UNACKNOWLEDGED',
      newValue: 'ACKNOWLEDGED',
      operator: operatorId,
      description: `Recommendation ${id} acknowledged by ${operatorId}. ${operatorNote ? `Note: "${operatorNote}"` : ''}`,
      metadata: { recommendationId: id, operatorNote },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Also support route without /api prefix if mounted under /api
router.post('/recommendations/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const operatorNote = req.body.operatorNote;
    const operatorId = req.body.operatorId || 'Chief Hydrographer';
    const now = new Date().toISOString();

    const updated = await storageService.acknowledgeRecommendation(id, {
      acknowledgedAt: now,
      acknowledgedBy: operatorId,
      operatorNote,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: `Recommendation '${id}' not found` });
    }

    await storageService.addAuditEvent({
      id: `AUD-FOL-ACK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: updated.targetIds[0] || id,
      timestamp: now,
      actionType: 'FOLLOW_UP_RECOMMENDATION_ACKNOWLEDGED',
      title: 'Recommendation Acknowledged via API',
      previousValue: 'UNACKNOWLEDGED',
      newValue: 'ACKNOWLEDGED',
      operator: operatorId,
      description: `Recommendation ${id} acknowledged by ${operatorId}. ${operatorNote ? `Note: "${operatorNote}"` : ''}`,
      metadata: { recommendationId: id, operatorNote },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/recommendations/:id/override - Operator Override
 */
router.post('/recommendations/:id/override', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { priorityScore, urgency, recommendationType, reason, operatorId } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Missing required field: reason' });
    }

    const now = new Date().toISOString();
    const override: FollowUpOperatorOverride = {
      priorityScore: typeof priorityScore === 'number' ? priorityScore : undefined,
      urgency,
      recommendationType,
      reason,
      overriddenBy: operatorId || 'Chief Hydrographer',
      overriddenAt: now,
    };

    const updated = await storageService.overrideRecommendation(id, override);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Recommendation '${id}' not found` });
    }

    await storageService.addAuditEvent({
      id: `AUD-FOL-OVR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetId: updated.targetIds[0] || id,
      timestamp: now,
      actionType: 'FOLLOW_UP_RECOMMENDATION_OVERRIDDEN',
      title: 'Recommendation Overridden via API',
      previousValue: `${updated.urgency} | ${updated.recommendationType}`,
      newValue: `${override.urgency || updated.urgency} | ${override.recommendationType || updated.recommendationType}`,
      operator: override.overriddenBy,
      description: `Operator override applied to recommendation ${id}. Reason: "${reason}"`,
      metadata: { override },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 5. AUDIT RECORDS
// ============================================================================

router.get('/audit', async (req: Request, res: Response) => {
  try {
    const targetId = req.query.targetId as string;
    const events = await storageService.getAuditEvents(targetId);
    res.json({ success: true, data: events, count: events.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 6. REAL SONAR FILE INGESTION & PIPELINE ENDPOINTS
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB upload limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (['json', 'csv', 'geojson', 'txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format '.${ext}'. Supported formats: .json, .csv, .geojson`));
    }
  },
});

// Multipart file upload endpoint
router.post('/sonar/upload', (req: Request, res: Response, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 15MB limit',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload error',
      });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided in request. Please attach a sonar file (.json, .csv, .geojson) under field "file".',
      });
    }

    const report = await FileIngestionPipeline.processUploadedFile(
      req.file.originalname,
      req.file.buffer
    );

    const statusCode = report.status === 'Failed' ? 400 : 200;
    return res.status(statusCode).json({
      success: report.status !== 'Failed',
      data: report,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Unexpected exception during sonar file ingestion',
    });
  }
});

// Programmatic / Direct payload ingestion
router.post('/sonar/upload-raw', async (req: Request, res: Response) => {
  try {
    const { filename, content, pings } = req.body;

    let payloadBuffer: Buffer | string;
    let effectiveFilename = filename || 'sonar_records.json';

    if (pings && Array.isArray(pings)) {
      payloadBuffer = JSON.stringify(pings);
      effectiveFilename = filename || 'sonar_pings.json';
    } else if (content) {
      payloadBuffer = typeof content === 'string' ? content : JSON.stringify(content);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Expected "content" string or "pings" array in request body.',
      });
    }

    const report = await FileIngestionPipeline.processUploadedFile(
      effectiveFilename,
      payloadBuffer
    );

    const statusCode = report.status === 'Failed' ? 400 : 200;
    return res.status(statusCode).json({
      success: report.status !== 'Failed',
      data: report,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Unexpected exception during raw sonar ingestion',
    });
  }
});

// Download sample realistic sonar dataset
router.get('/sonar/samples/:format', (req: Request, res: Response) => {
  const format = (req.params.format || 'json').toLowerCase();
  const baseLat = 9.2435;
  const baseLng = 79.1842;
  const now = Date.now();

  if (format === 'csv') {
    const headers = [
      'surveyId',
      'transectId',
      'pingNumber',
      'timestamp',
      'channel',
      'sampleCount',
      'rangeMeters',
      'altitudeMeters',
      'depthMeters',
      'headingDeg',
      'latitude',
      'longitude',
      'speedKts',
      'frequencyKhz',
    ];

    const rows: string[] = [headers.join(',')];
    for (let i = 0; i < 8; i++) {
      const pingNum = 42300 + i;
      const lat = (baseLat + i * 0.00002).toFixed(6);
      const lng = (baseLng + i * 0.000015).toFixed(6);
      const time = new Date(now + i * 70).toISOString();
      const alt = (14.5 + Math.sin(i * 0.4) * 0.2).toFixed(2);
      rows.push(
        `SRV-2026-GOM-01,TRX-01,${pingNum},${time},DUAL,512,75,${alt},28.5,42.5,${lat},${lng},3.4,410`
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_sonar_transect.csv"');
    return res.send(rows.join('\n'));
  }

  if (format === 'geojson') {
    const features = [];
    for (let i = 0; i < 6; i++) {
      const pingNum = 42320 + i;
      const lat = Number((baseLat + i * 0.00002).toFixed(6));
      const lng = Number((baseLng + i * 0.000015).toFixed(6));
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          surveyId: 'SRV-2026-GOM-01',
          transectId: 'TRX-01',
          pingNumber: pingNum,
          timestamp: new Date(now + i * 70).toISOString(),
          channel: 'DUAL',
          sampleCount: 512,
          rangeMeters: 75,
          altitudeMeters: 14.5,
          depthMeters: 28.5,
          headingDeg: 42.5,
          speedKts: 3.4,
          frequencyKhz: 410,
        },
      });
    }

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_sonar_transect.geojson"');
    return res.json(geojson);
  }

  // Default: JSON array of pings
  const pings = [];
  for (let i = 0; i < 6; i++) {
    const pingNum = 42310 + i;
    const lat = Number((baseLat + i * 0.00002).toFixed(6));
    const lng = Number((baseLng + i * 0.000015).toFixed(6));
    pings.push({
      surveyId: 'SRV-2026-GOM-01',
      transectId: 'TRX-01',
      pingNumber: pingNum,
      timestamp: new Date(now + i * 70).toISOString(),
      channel: 'DUAL',
      sampleCount: 512,
      rangeMeters: 75,
      altitudeMeters: 14.5,
      depthMeters: 28.5,
      headingDeg: 42.5,
      latitude: lat,
      longitude: lng,
      speedKts: 3.4,
      frequencyKhz: 410,
      samplingIntervalUsec: 97.4,
      portSamples: SonarFileParser.synthesizeAcousticProfile(512, 14.5, 75, pingNum),
      starboardSamples: SonarFileParser.synthesizeAcousticProfile(512, 14.5, 75, pingNum + 1),
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_sonar_transect.json"');
  return res.json(pings);
});

// Single ping ingestion (legacy)
router.post('/sonar/ingest', async (req: Request, res: Response) => {
  try {
    const { pingNumber, latitude, longitude, altitudeMeters, depthMeters, headingDeg, qualityScore, rawPayload } = req.body;

    if (typeof pingNumber !== 'number' || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Missing required ping fields: pingNumber, latitude, longitude',
      });
    }

    const recorded = await storageService.recordSonarPing({
      surveyId: req.body.surveyId || 'MIS-2026-INDO-04B',
      transectId: req.body.transectId || 'TRX-01',
      pingNumber,
      timestamp: req.body.timestamp || new Date().toISOString(),
      latitude,
      longitude,
      altitudeMeters,
      depthMeters,
      headingDeg,
      qualityScore,
      rawPayload,
    });

    res.json({
      success: true,
      message: 'Sonar ping recorded',
      recordedInPostgis: recorded,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
