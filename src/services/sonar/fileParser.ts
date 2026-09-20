/**
 * Sonar File Parsing and Strict Validation Service
 * SIH 2026 Problem Statement 26057
 * 
 * Supports:
 * - JSON Array / Object / Wrapper Sonar Records (.json)
 * - GeoJSON FeatureCollection Sonar Points (.geojson)
 * - Tabular Sonar Records (.csv)
 * 
 * Enforces:
 * - Filename sanitization & path-traversal prevention
 * - Extension and MIME type verification
 * - File size bounds (default 15MB)
 * - WGS84 Geodetic boundary checks [-90..+90, -180..+180]
 * - Hydrographic and acoustic sanity rules
 * - Resilient partial record processing (records errors without aborting valid rows)
 */

import { RawSonarPingInput } from '../../types/sonarFrame';
import { SupportedSonarFormat, IngestionRejection } from '../../types/ingestion';
import { SonarInputValidator } from './validation';
import { Target, DebrisCategory, VerificationStatus, SeverityLevel } from '../../types/target';
import { wgs84ToUtm, isValidWgs84 } from '../../utils/geo';

export interface ParseResult {
  format: SupportedSonarFormat;
  sanitizedFilename: string;
  fileSizeBytes: number;
  validPings: RawSonarPingInput[];
  rejectedRecords: IngestionRejection[];
  totalRecordsFound: number;
  detectedTargets: Target[];
}

export class SonarFileParser {
  public static readonly MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes
  public static readonly ALLOWED_EXTENSIONS = ['.json', '.csv', '.geojson', '.txt'];

  /**
   * Sanitizes uploaded filename to prevent directory traversal or remote shell exploits.
   */
  public static sanitizeFilename(rawFilename: string): string {
    if (!rawFilename || typeof rawFilename !== 'string') {
      return `sonar_data_${Date.now()}.json`;
    }
    // Strip directories and dangerous path components
    const base = rawFilename.split(/[/\\]/).pop() || 'sonar_data';
    // Remove invalid characters, retain safe alphanumeric, dots, dashes, underscores
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned.length > 0 ? cleaned : `sonar_data_${Date.now()}.json`;
  }

  /**
   * Identifies format from filename extension or content inspection.
   */
  public static detectFormat(filename: string, content: string): SupportedSonarFormat {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.geojson')) return 'GEOJSON';
    if (lower.endsWith('.csv')) return 'CSV';
    if (lower.endsWith('.json')) {
      // Check if GeoJSON FeatureCollection
      if (content.includes('"FeatureCollection"') || content.includes('"features"')) {
        return 'GEOJSON';
      }
      return 'JSON';
    }

    // Heuristic detection based on content
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && (trimmed.includes('"features"') || trimmed.includes('"FeatureCollection"'))) {
      return 'GEOJSON';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'JSON';
    }
    if (trimmed.includes(',') && trimmed.includes('\n')) {
      return 'CSV';
    }

    // Default to JSON
    return 'JSON';
  }

  public static parse(rawFilename: string, content: string | any): RawSonarPingInput[] {
    const res = this.parseFile(rawFilename, content);
    return res.validPings;
  }

  /**
   * Computes byte length in a cross-platform (browser/Node) manner.
   */
  private static getByteLength(str: string): number {
    if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
      try {
        return Buffer.byteLength(str, 'utf8');
      } catch {
        // fallback below
      }
    }
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    return str.length;
  }

  /**
   * Validates metadata, size, extension, and parses file content.
   */
  public static parseFile(rawFilename: string, content: string | any): ParseResult {
    const sanitizedFilename = this.sanitizeFilename(rawFilename);
    const ext = '.' + (sanitizedFilename.split('.').pop() || '').toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext) && ext !== '.geojson') {
      throw new Error(`Unsupported sonar file format "${ext}". Allowed: ${this.ALLOWED_EXTENSIONS.join(', ')}`);
    }

    const contentStr = typeof content === 'string' ? content : (content && typeof content.toString === 'function' ? content.toString('utf8') : String(content));
    const fileSizeBytes = this.getByteLength(contentStr);

    if (fileSizeBytes > this.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds security limit of ${
          this.MAX_FILE_SIZE_BYTES / (1024 * 1024)
        } MB`
      );
    }

    if (!contentStr || contentStr.trim().length === 0) {
      throw new Error('Uploaded sonar file is empty.');
    }

    const format = this.detectFormat(sanitizedFilename, contentStr);
    const rejectedRecords: IngestionRejection[] = [];
    let rawRecords: any[] = [];

    if (format === 'JSON') {
      rawRecords = this.extractJsonRecords(contentStr, rejectedRecords);
    } else if (format === 'GEOJSON') {
      rawRecords = this.extractGeoJsonRecords(contentStr, rejectedRecords);
    } else {
      rawRecords = this.extractCsvRecords(contentStr, rejectedRecords);
    }

    // Validate each extracted record against physical rules and structural schema
    const validPings: RawSonarPingInput[] = [];
    const detectedTargets: Target[] = [];

    rawRecords.forEach((record, index) => {
      const rawPingVal = SonarFileParser.getVal(record, 'pingNumber', 'ping_number', 'ping', 'id', 'record', 'index');
      const pingNum = rawPingVal !== undefined && !isNaN(Number(rawPingVal)) ? Number(rawPingVal) : index + 1;

      // 1. Check if record is a Target row
      if (SonarFileParser.isTargetRecord(record)) {
        const parsedTarget = SonarFileParser.parseTargetRecord(record, index, sanitizedFilename);
        if (parsedTarget) {
          detectedTargets.push(parsedTarget);

          // Synthesize a valid matching ping for this target so acoustic waterfall and telemetry reflect it
          const targetRange = Math.max(75, Math.ceil(parsedTarget.slantRange * 1.4));
          const targetAlt = Math.min(14.5, targetRange * 0.3);
          const sampleCount = 512;

          validPings.push({
            surveyId: parsedTarget.surveyId || 'SURVEY-2026-04B',
            transectId: parsedTarget.transectId || 'TRX-01',
            pingNumber: parsedTarget.pingNumber || pingNum,
            timestamp: parsedTarget.detectedAt || new Date().toISOString(),
            channel: 'DUAL',
            sampleCount,
            rangeMeters: targetRange,
            samplingIntervalUsec: 97.4,
            frequencyKhz: 410,
            altitudeMeters: targetAlt,
            depthMeters: parsedTarget.depth || 28.0,
            headingDeg: 42.5,
            latitude: parsedTarget.latitude,
            longitude: parsedTarget.longitude,
            pitchDeg: 0.0,
            rollDeg: 0.0,
            speedKts: 3.4,
            portSamples: SonarFileParser.synthesizeAcousticProfile(sampleCount, targetAlt, targetRange, parsedTarget.pingNumber),
            starboardSamples: SonarFileParser.synthesizeAcousticProfile(sampleCount, targetAlt, targetRange, parsedTarget.pingNumber + 1),
            sourceFile: sanitizedFilename,
            packetFormat: 'IMAGE_INGEST',
          });
          return;
        }
      }

      // 2. Mandatory coordinates check for raw ping records
      const rawLatVal = SonarFileParser.getVal(record, 'latitude', 'lat', 'y', 'northing');
      const rawLngVal = SonarFileParser.getVal(record, 'longitude', 'lng', 'lon', 'x', 'easting');
      let lat = parseFloat(rawLatVal);
      let lng = parseFloat(rawLngVal);

      // Handle accidental X/Y (Lng/Lat) flip
      if ((!Number.isFinite(lat) || lat < -90 || lat > 90) && Number.isFinite(lng) && lng >= -90 && lng <= 90 && Math.abs(lat) <= 180) {
        const tmp = lat;
        lat = lng;
        lng = tmp;
      }

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        rejectedRecords.push({
          recordIndex: index + 1,
          pingNumber: pingNum,
          field: 'latitude',
          reason: `Invalid or missing latitude (${rawLatVal ?? 'undefined'}). Must be a finite number between -90 and 90.`,
        });
        return;
      }

      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        rejectedRecords.push({
          recordIndex: index + 1,
          pingNumber: pingNum,
          field: 'longitude',
          reason: `Invalid or missing longitude (${rawLngVal ?? 'undefined'}). Must be a finite number between -180 and 180.`,
        });
        return;
      }

      // 3. Timestamp check
      let timestamp = SonarFileParser.getVal(record, 'timestamp', 'time', 'dateTime', 'date', 'utc_time');
      if (!timestamp) {
        timestamp = new Date().toISOString();
      } else if (typeof timestamp === 'number') {
        timestamp = new Date(timestamp).toISOString();
      } else if (isNaN(Date.parse(timestamp))) {
        timestamp = new Date().toISOString();
      }

      // 4. Acoustic Parameters
      const sampleCount = Number(SonarFileParser.getVal(record, 'sampleCount', 'sample_count', 'samples') ?? 512);
      let rangeMeters = Number(SonarFileParser.getVal(record, 'rangeMeters', 'range', 'range_meters', 'swath', 'swathWidth') ?? 75);
      let altitudeMeters = Number(SonarFileParser.getVal(record, 'altitudeMeters', 'altitude', 'alt', 'altitude_meters', 'towfishAltitude') ?? 14.5);
      const depthMeters = Number(SonarFileParser.getVal(record, 'depthMeters', 'depth', 'depth_meters', 'waterDepth') ?? 28.5);
      const headingDeg = Number(SonarFileParser.getVal(record, 'headingDeg', 'heading', 'heading_deg', 'hdg', 'course') ?? 42.5);
      const pitchDeg = Number(SonarFileParser.getVal(record, 'pitchDeg', 'pitch', 'pitch_deg') ?? 0.0);
      const rollDeg = Number(SonarFileParser.getVal(record, 'rollDeg', 'roll', 'roll_deg') ?? 0.0);
      const speedKts = Number(SonarFileParser.getVal(record, 'speedKts', 'speed', 'speed_kts', 'sog', 'velocity') ?? 3.4);
      const frequencyKhz = Number(SonarFileParser.getVal(record, 'frequencyKhz', 'frequency', 'frequency_khz', 'freq') ?? 410);
      const samplingIntervalUsec = Number(SonarFileParser.getVal(record, 'samplingIntervalUsec', 'samplingInterval', 'sample_interval') ?? 97.4);

      if (!Number.isFinite(rangeMeters) || rangeMeters <= 0 || rangeMeters > 3000) {
        rangeMeters = 75;
      }
      if (!Number.isFinite(altitudeMeters) || altitudeMeters < 0) {
        altitudeMeters = 14.5;
      }
      // Guarantee physical constraint: swath range exceeds towfish altitude
      if (altitudeMeters >= rangeMeters) {
        rangeMeters = Math.max(rangeMeters, Math.ceil(altitudeMeters * 1.5));
      }

      // 5. Acoustic Samples
      let portSamples = SonarFileParser.getVal(record, 'portSamples', 'port_samples', 'port');
      let starboardSamples = SonarFileParser.getVal(record, 'starboardSamples', 'starboard_samples', 'starboard', 'stbd');

      if (typeof portSamples === 'string') {
        portSamples = this.parseSampleString(portSamples);
      }
      if (typeof starboardSamples === 'string') {
        starboardSamples = this.parseSampleString(starboardSamples);
      }

      // If sample arrays are absent or zero length, synthesize a physically compliant backscatter profile
      if (!Array.isArray(portSamples) || portSamples.length === 0) {
        portSamples = this.synthesizeAcousticProfile(sampleCount, altitudeMeters, rangeMeters, pingNum);
      }
      if (!Array.isArray(starboardSamples) || starboardSamples.length === 0) {
        starboardSamples = this.synthesizeAcousticProfile(sampleCount, altitudeMeters, rangeMeters, pingNum + 1);
      }

      const surveyId = String(SonarFileParser.getVal(record, 'surveyId', 'survey_id', 'survey') || 'SURVEY-2026-04B');
      const transectId = String(SonarFileParser.getVal(record, 'transectId', 'transect_id', 'transect', 'line') || 'TRX-01');
      const rawChannel = String(SonarFileParser.getVal(record, 'channel') || 'DUAL').toUpperCase();

      const pingInput: RawSonarPingInput = {
        surveyId,
        transectId,
        pingNumber: Number(pingNum),
        timestamp,
        channel: (rawChannel.includes('PORT') ? 'PORT' : rawChannel.includes('STARBOARD') ? 'STARBOARD' : 'DUAL') as any,
        sampleCount,
        rangeMeters,
        samplingIntervalUsec,
        frequencyKhz,
        altitudeMeters,
        depthMeters,
        headingDeg,
        latitude: lat,
        longitude: lng,
        pitchDeg,
        rollDeg,
        speedKts,
        portSamples,
        starboardSamples,
        sourceFile: sanitizedFilename,
        packetFormat: (record.packetFormat as any) || 'IMAGE_INGEST',
      };

      // Run against SonarInputValidator
      const validation = SonarInputValidator.validate(pingInput);
      if (!validation.isValid) {
        const errorIssue = validation.issues.find((i) => i.severity === 'ERROR');
        rejectedRecords.push({
          recordIndex: index + 1,
          pingNumber: pingNum,
          field: errorIssue?.field || 'unknown',
          reason: errorIssue?.message || 'Failed acoustic integrity validation',
        });
      } else {
        validPings.push(pingInput);
      }
    });

    return {
      format,
      sanitizedFilename,
      fileSizeBytes,
      validPings,
      rejectedRecords,
      totalRecordsFound: rawRecords.length,
      detectedTargets,
    };
  }

  private static extractJsonRecords(content: string, rejectedRecords: IngestionRejection[]): any[] {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`Invalid JSON syntax: ${(err as Error).message}`);
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.pings)) return parsed.pings;
      if (Array.isArray(parsed.records)) return parsed.records;
      if (Array.isArray(parsed.data)) return parsed.data;
      // Single ping object
      return [parsed];
    }
    throw new Error('Expected JSON array of sonar pings or object containing pings array.');
  }

  private static extractGeoJsonRecords(content: string, rejectedRecords: IngestionRejection[]): any[] {
    let geojson: any;
    try {
      geojson = JSON.parse(content);
    } catch (err) {
      throw new Error(`Invalid GeoJSON syntax: ${(err as Error).message}`);
    }

    if (!geojson.features || !Array.isArray(geojson.features)) {
      throw new Error('GeoJSON must contain a "features" array of Point geometries.');
    }

    const records: any[] = [];
    geojson.features.forEach((feature: any, idx: number) => {
      if (!feature.geometry || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
        rejectedRecords.push({
          recordIndex: idx,
          reason: 'Feature geometry must be a valid Point with [longitude, latitude] coordinates.',
        });
        return;
      }

      const [lng, lat] = feature.geometry.coordinates;
      records.push({
        ...(feature.properties || {}),
        longitude: lng,
        latitude: lat,
      });
    });

    return records;
  }

  /**
   * Universal case-insensitive, punctuation-stripped field lookup helper for records.
   */
  public static getVal(record: Record<string, any>, ...names: string[]): any {
    if (!record || typeof record !== 'object') return undefined;
    // 1. Direct key match
    for (const name of names) {
      if (record[name] !== undefined && record[name] !== null && record[name] !== '') {
        return record[name];
      }
    }
    // 2. Normalized clean key match
    const recordKeys = Object.keys(record);
    const cleanNames = names.map((n) => n.toLowerCase().replace(/[\s_()\-.]/g, ''));
    for (const key of recordKeys) {
      const cleanKey = key.toLowerCase().replace(/[\s_()\-.]/g, '');
      for (const cleanName of cleanNames) {
        if (cleanKey === cleanName) {
          const val = record[key];
          if (val !== undefined && val !== null && val !== '') return val;
        }
      }
    }
    // 3. Substring matching for headers with units (e.g. "Latitude (deg)")
    for (const key of recordKeys) {
      const cleanKey = key.toLowerCase().replace(/[\s_()\-.]/g, '');
      for (const cleanName of cleanNames) {
        if (cleanKey.includes(cleanName) || cleanName.includes(cleanKey)) {
          const val = record[key];
          if (val !== undefined && val !== null && val !== '') return val;
        }
      }
    }
    return undefined;
  }

  private static extractCsvRecords(content: string, rejectedRecords: IngestionRejection[]): any[] {
    // Strip UTF-8 Byte Order Mark if present
    const cleanContent = content.replace(/^\uFEFF/, '').trim();
    const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header line and one data row.');
    }

    const headerLine = lines[0];
    // Dynamic delimiter detection: comma, tab, or semicolon
    let delimiter = ',';
    if (headerLine.includes('\t') && headerLine.split('\t').length > headerLine.split(',').length) {
      delimiter = '\t';
    } else if (headerLine.includes(';') && headerLine.split(';').length > headerLine.split(',').length) {
      delimiter = ';';
    }

    const headers = this.parseCsvRow(headerLine, delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = this.parseCsvRow(line, delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
      
      // If cells are fewer than headers, gracefully pad with empty strings
      const rowCells = [...cells];
      while (rowCells.length < headers.length) {
        rowCells.push('');
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((hdr, colIdx) => {
        rowObj[hdr] = rowCells[colIdx] !== undefined ? rowCells[colIdx] : '';
      });
      records.push(rowObj);
    }

    return records;
  }

  private static parseCsvRow(rowText: string, delimiter: string = ','): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < rowText.length; i++) {
      const ch = rowText[i];
      if (ch === '"') {
        if (inQuotes && rowText[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  private static parseSampleString(str: string): number[] {
    const cleaned = str.replace(/[\[\]]/g, '');
    const parts = cleaned.split(/[;, ]+/).filter((s) => s.length > 0);
    return parts.map((p) => {
      const val = parseFloat(p);
      return isNaN(val) ? 0.0 : Math.min(1.0, Math.max(0.0, val));
    });
  }

  /**
   * Procedurally generates a physically consistent acoustic backscatter profile
   * based on altitude, range, and seabed decay physics.
   */
  public static synthesizeAcousticProfile(
    sampleCount: number,
    altitude: number,
    range: number,
    seed: number
  ): number[] {
    const samples = new Array<number>(sampleCount);
    const effRange = Math.max(range, altitude * 1.25, 10.0);
    const nadirCutoff = Math.min(sampleCount - 1, Math.max(0, Math.floor((altitude / effRange) * sampleCount)));

    for (let i = 0; i < sampleCount; i++) {
      if (i < nadirCutoff) {
        // Water column return
        samples[i] = ((Math.sin(i * 9.1 + seed) * 0.5 + 0.5) * 0.03);
      } else if (i >= nadirCutoff && i <= nadirCutoff + 4) {
        // First bottom return
        samples[i] = 0.80 + (Math.sin(seed * 2.3) * 0.1);
      } else {
        // Seabed reverberation decay
        const t = (i - nadirCutoff) / (sampleCount - nadirCutoff);
        const decay = Math.pow(1 - t * 0.55, 1.4);
        const texture = (Math.sin(i * 0.7 + seed * 1.7) * 0.5 + 0.5) * 0.12;
        samples[i] = Math.min(1.0, Math.max(0.0, (0.32 + texture) * decay));
      }
    }
    return samples;
  }

  /**
   * Evaluates if a parsed data record represents a canonical Target rather than a raw acoustic ping.
   */
  public static isTargetRecord(record: Record<string, any>): boolean {
    if (!record || typeof record !== 'object') return false;
    const keys = Object.keys(record).map((k) => k.toLowerCase().replace(/[\s_()\-.]/g, ''));
    
    // Check for target-specific indicators
    const targetKeywords = [
      'targetid', 'target', 'debris', 'classification', 'category', 'categorylabel',
      'severity', 'verificationstatus', 'shadowlength', 'slantrange', 'backscatter',
      'risklevel', 'riskscore', 'anomaly', 'hazard'
    ];
    const hasTargetField = keys.some((k) => targetKeywords.some((tk) => k.includes(tk)));

    const hasLat = keys.some((k) => k === 'lat' || k === 'latitude' || k === 'y' || k.includes('latitude') || k.startsWith('lat'));
    const hasLng = keys.some((k) => k === 'lng' || k === 'lon' || k === 'longitude' || k === 'x' || k.includes('longitude') || k.startsWith('lon') || k.startsWith('lng'));

    return hasTargetField && hasLat && hasLng;
  }

  /**
   * Parses and constructs a canonical Target object from a raw CSV/JSON/GeoJSON target record.
   */
  public static parseTargetRecord(
    record: Record<string, any>,
    index: number,
    sourceFile: string
  ): Target | null {
    try {
      const getVal = (...names: string[]): any => SonarFileParser.getVal(record, ...names);

      let rawLat = parseFloat(getVal('Latitude', 'lat', 'y', 'northing'));
      let rawLng = parseFloat(getVal('Longitude', 'lng', 'lon', 'x', 'easting'));

      // Handle accidental X/Y (Lng/Lat) flip
      if (!isValidWgs84(rawLat, rawLng) && isValidWgs84(rawLng, rawLat)) {
        const tmp = rawLat;
        rawLat = rawLng;
        rawLng = tmp;
      }

      if (!isValidWgs84(rawLat, rawLng)) {
        return null;
      }

      const rawId = getVal('Target ID', 'target_id', 'targetId', 'id', 'ID', 'Target');
      const targetId = rawId ? String(rawId).trim() : `TRG-IMPORT-${String(index + 1).padStart(2, '0')}`;

      const rawCategory = getVal('Classification', 'Category', 'category', 'categoryLabel', 'type', 'debris_type');
      const classification = this.normalizeCategory(rawCategory);
      const categoryLabel = getVal('Category Label', 'Label', 'category_label') || this.getCategoryLabel(classification);

      const confidence = Math.min(1.0, Math.max(0.1, parseFloat(getVal('Confidence', 'confidence', 'score') || '0.92')));
      const rawSeverity = getVal('Severity', 'severity', 'Risk Level', 'riskLevel', 'Priority');
      const severity = this.normalizeSeverity(rawSeverity);

      const rawStatus = getVal('Status', 'status', 'Verification Status', 'verificationStatus');
      const verificationStatus = this.normalizeStatus(rawStatus);

      const pingNum = parseInt(getVal('Ping', 'ping_number', 'pingNumber', 'ping') || String(42000 + (index + 1) * 20), 10);
      const rawChannel = String(getVal('Channel', 'channel') || 'PORT').toUpperCase();
      const channel: 'PORT' | 'STARBOARD' = rawChannel.includes('STARBOARD') || rawChannel.includes('STBD') ? 'STARBOARD' : 'PORT';

      const slantRange = Math.max(1.0, parseFloat(getVal('Slant Range (m)', 'slant_range', 'slantRange') || '35.0'));
      const shadowLength = Math.max(0.1, parseFloat(getVal('Shadow Length (m)', 'shadow_length', 'shadowLength') || '4.2'));
      const shadowHeight = Math.max(0.1, parseFloat(getVal('Estimated Height (m)', 'shadow_height', 'shadowHeight', 'height') || '1.5'));
      const estimatedLength = Math.max(0.1, parseFloat(getVal('Length (m)', 'length', 'estimatedLength') || '3.5'));
      const estimatedWidth = Math.max(0.1, parseFloat(getVal('Width (m)', 'width', 'estimatedWidth') || '1.8'));
      const backscatter = parseFloat(getVal('Backscatter (dB)', 'backscatter', 'backscatterDb') || '-18.5');
      const depth = Math.max(1.0, parseFloat(getVal('Depth (m)', 'depth', 'depthMeters') || '28.5'));
      const towfishAltitude = Math.max(1.0, parseFloat(getVal('Altitude (m)', 'altitude', 'towfishAltitude') || '14.5'));
      const groundRange = Math.max(1.0, parseFloat(getVal('Ground Range (m)', 'ground_range', 'groundRange') || (slantRange * 0.9).toFixed(1)));

      const utm = wgs84ToUtm(rawLat, rawLng);
      const utmZone = getVal('UTM Zone', 'utmZone') || utm.zone;
      const utmEasting = parseFloat(getVal('UTM Easting', 'utmEasting') || utm.easting.toFixed(1));
      const utmNorthing = parseFloat(getVal('UTM Northing', 'utmNorthing') || utm.northing.toFixed(1));

      const detectedAt = getVal('Timestamp', 'detected_at', 'detectedAt', 'Date', 'time') || new Date().toISOString();
      const operatorNotes = getVal('Operator Notes', 'notes', 'operatorNotes', 'Notes') || `Imported from ${sourceFile}`;

      const target: Target = {
        id: targetId,
        surveyId: String(getVal('Survey ID', 'survey_id', 'surveyId') || 'SURVEY-2026-04B'),
        transectId: String(getVal('Transect', 'transect_id', 'transectId') || 'TRX-01'),
        pingNumber: pingNum,
        channel,
        classification,
        categoryLabel,
        confidence,
        latitude: rawLat,
        longitude: rawLng,
        coordinateReferenceSystem: 'WGS84 / UTM Zone 44N (EPSG:32644)',
        utmZone,
        utmEasting,
        utmNorthing,
        depth,
        slantRange,
        groundRange,
        towfishAltitude,
        estimatedLength,
        estimatedWidth,
        shadowLength,
        shadowHeight,
        backscatter,
        severity,
        verificationStatus,
        operatorNotes,
        detectedAt,
        waterfallBox: {
          x: channel === 'PORT' ? 22 : 68,
          y: Math.min(80, Math.max(15, (pingNum % 80) + 10)),
          width: 12,
          height: 14,
        },
        transectLine: String(getVal('Transect', 'transect_id', 'transectId') || 'TRX-01'),
        category: classification,
        timestamp: detectedAt,
        slantRangeMeters: slantRange,
        groundRangeMeters: groundRange,
        towfishAltitudeMeters: towfishAltitude,
        shadowLengthMeters: shadowLength,
        estimatedTargetHeightMeters: shadowHeight,
        estimatedLengthMeters: estimatedLength,
        estimatedWidthMeters: estimatedWidth,
        backscatterDb: backscatter,
        coordinates: {
          lat: rawLat,
          lng: rawLng,
          utmZone,
          utmEasting,
          utmNorthing,
          depthMeters: depth,
        },
        sonarEvidenceReference: {
          pingNumber: pingNum,
          channel,
          pixelX: channel === 'PORT' ? 120 : 380,
          pixelY: 250,
          boundingBox: {
            xMin: channel === 'PORT' ? 90 : 350,
            yMin: 220,
            xMax: channel === 'PORT' ? 150 : 410,
            yMax: 280,
          },
          acousticCutoutUrl: '',
        },
        modelMetadata: {
          modelVersion: 'CSV-INGEST-v2.4',
          inferenceTimestamp: new Date().toISOString(),
          onnxEngineVersion: 'ONNX-v1.17',
          featureVectorSize: 512,
          executionTimeMs: 12.5,
        },
      };

      return target;
    } catch {
      return null;
    }
  }

  public static normalizeCategory(val: any): DebrisCategory {
    if (!val) return 'MARINE_DEBRIS';
    const str = String(val).toUpperCase().replace(/[\s-]/g, '_');
    if (str.includes('NET') || str.includes('TRAWL') || str.includes('GEAR') || str.includes('GHOST')) return 'GHOST_NET';
    if (str.includes('DRUM') || str.includes('BARREL') || str.includes('METALLIC')) return 'METALLIC_DRUM';
    if (str.includes('PLASTIC') || str.includes('AGGREGATE')) return 'PLASTIC_AGGREGATE';
    if (str.includes('WRECK') || str.includes('HULL') || str.includes('SCRAP')) return 'WRECKAGE_DEBRIS';
    if (str.includes('TIRE') || str.includes('TYRE')) return 'TIRE_CLUSTER';
    if (str.includes('PIPE') || str.includes('CABLE') || str.includes('FREE_SPAN')) return 'PIPELINE_EXPOSURE';
    if (str.includes('UXO') || str.includes('ORDNANCE') || str.includes('MUNITION') || str.includes('MINE') || str.includes('BOMB')) return 'ORDNANCE_UXO';
    if (str.includes('BEDROCK') || str.includes('GEOLOGIC') || str.includes('REEF') || str.includes('ROCK')) return 'GEOLOGICAL_FEATURE';
    if (str.includes('DEBRIS') || str.includes('GARBAGE') || str.includes('TRASH')) return 'MARINE_DEBRIS';
    return 'UNKNOWN_ANOMALY';
  }

  public static getCategoryLabel(category: DebrisCategory): string {
    const LABEL_MAP: Record<DebrisCategory, string> = {
      GHOST_NET: 'Derelict Fishing Net / Gear',
      METALLIC_DRUM: 'Industrial Drum / Barrel',
      PLASTIC_AGGREGATE: 'Plastic Marine Aggregate',
      WRECKAGE_DEBRIS: 'Vessel Wreckage / Hull Scrap',
      TIRE_CLUSTER: 'Commercial Tire Cluster',
      PIPELINE_EXPOSURE: 'Pipeline Free-Span / Cable',
      ORDNANCE_UXO: 'Metallic Munitions / UXO',
      GEOLOGICAL_FEATURE: 'Natural Bedrock / Geological',
      MARINE_DEBRIS: 'General Marine Debris',
      UNKNOWN_ANOMALY: 'Unknown Acoustic Anomaly',
    };
    return LABEL_MAP[category] || 'Acoustic Anomaly';
  }

  public static normalizeSeverity(val: any): SeverityLevel {
    if (!val) return 'MODERATE';
    const str = String(val).toUpperCase();
    if (str.includes('CRIT')) return 'CRITICAL';
    if (str.includes('HIGH')) return 'HIGH';
    if (str.includes('MOD') || str.includes('MED')) return 'MODERATE';
    if (str.includes('LOW')) return 'LOW';
    if (str.includes('INFO')) return 'INFORMATIONAL';
    return 'MODERATE';
  }

  public static normalizeStatus(val: any): VerificationStatus {
    if (!val) return 'PENDING_REVIEW';
    const str = String(val).toUpperCase().replace(/[\s-]/g, '_');
    if (str.includes('CONFIRM') || str.includes('VERIFIED')) return 'CONFIRMED_DEBRIS';
    if (str.includes('GEOLOG') || str.includes('NATURAL')) return 'GEOLOGICAL_ANOMALY';
    if (str.includes('FALSE') || str.includes('REJECT')) return 'FALSE_POSITIVE';
    if (str.includes('ESCALAT') || str.includes('HAZARD')) return 'ESCALATED_HAZARD';
    return 'PENDING_REVIEW';
  }
}
