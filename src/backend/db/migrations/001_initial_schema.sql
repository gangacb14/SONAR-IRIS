-- ==============================================================================
-- SIH 2026 Problem Statement 26057: Subsea Sonar Debris & GEOINT Analytics
-- Migration 001: Initial Schema with PostGIS Spatial Extensions
-- ==============================================================================

-- 1. Enable PostGIS Extension for native geospatial calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Migrations Tracking Table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Surveys Table
CREATE TABLE IF NOT EXISTS surveys (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  location_name VARCHAR(255),
  crs VARCHAR(128),
  sonar_equipment VARCHAR(255),
  operating_frequency VARCHAR(128),
  survey_vessel VARCHAR(255),
  vehicle_type VARCHAR(255),
  chief_hydrographer VARCHAR(255),
  date VARCHAR(32),
  total_area_sq_km DOUBLE PRECISION DEFAULT 0.0,
  total_pings BIGINT DEFAULT 0,
  total_detections INT DEFAULT 0,
  pending_reviews INT DEFAULT 0,
  swath_range_per_channel_m DOUBLE PRECISION DEFAULT 75.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transects Table
CREATE TABLE IF NOT EXISTS transects (
  id VARCHAR(64) PRIMARY KEY,
  survey_id VARCHAR(64) REFERENCES surveys(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) DEFAULT 'PLANNED',
  planned_heading_deg DOUBLE PRECISION,
  length_meters DOUBLE PRECISION,
  ping_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4b. Sonar Pings Table with PostGIS Spatial Point Geometry
CREATE TABLE IF NOT EXISTS sonar_pings (
  id SERIAL PRIMARY KEY,
  survey_id VARCHAR(64) DEFAULT 'MIS-2026-INDO-04B',
  transect_id VARCHAR(64) DEFAULT 'TRX-01',
  ping_number INT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),
  altitude_meters DOUBLE PRECISION,
  depth_meters DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  frequency_khz INT DEFAULT 410,
  quality_score DOUBLE PRECISION,
  processing_status VARCHAR(32) DEFAULT 'READY',
  candidate_count INT DEFAULT 0,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sonar_pings_geom ON sonar_pings USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_sonar_pings_survey ON sonar_pings(survey_id, ping_number);

-- 5. Targets Table with PostGIS Point Geometry
CREATE TABLE IF NOT EXISTS targets (
  id VARCHAR(64) PRIMARY KEY,
  survey_id VARCHAR(64) DEFAULT 'MIS-2026-INDO-04B',
  transect_id VARCHAR(64) DEFAULT 'TRX-01',
  ping_number INT NOT NULL,
  channel VARCHAR(16) NOT NULL,
  
  -- AI Classification
  classification VARCHAR(64) NOT NULL,
  category_label VARCHAR(128) NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,

  -- Geographic Coordinates & PostGIS Geometry
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),
  coordinate_reference_system VARCHAR(128) DEFAULT 'WGS84 / UTM Zone 44N (EPSG:32644)',
  utm_zone VARCHAR(32),
  utm_easting DOUBLE PRECISION,
  utm_northing DOUBLE PRECISION,
  depth DOUBLE PRECISION NOT NULL,

  -- Acoustic & Metric Characteristics
  slant_range DOUBLE PRECISION NOT NULL,
  ground_range DOUBLE PRECISION NOT NULL,
  towfish_altitude DOUBLE PRECISION NOT NULL,
  estimated_length DOUBLE PRECISION,
  estimated_width DOUBLE PRECISION,
  shadow_length DOUBLE PRECISION,
  shadow_height DOUBLE PRECISION,
  backscatter DOUBLE PRECISION,

  -- Operational Verification Status
  severity VARCHAR(32) NOT NULL,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  operator_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(128),

  -- Risk & Operator Overrides
  risk_assessment JSONB,
  operator_risk_level VARCHAR(32),
  operator_override_reason TEXT,

  -- Sonar Evidence & Model Metadata
  sonar_evidence_reference JSONB,
  model_metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Spatial & Attribute Indexes for Targets
CREATE INDEX IF NOT EXISTS idx_targets_geom ON targets USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_targets_survey ON targets(survey_id);
CREATE INDEX IF NOT EXISTS idx_targets_classification ON targets(classification);
CREATE INDEX IF NOT EXISTS idx_targets_verification ON targets(verification_status);
CREATE INDEX IF NOT EXISTS idx_targets_severity ON targets(severity);

-- 7. Follow-Up Survey Recommendations Table with PostGIS Spatial Center
CREATE TABLE IF NOT EXISTS follow_up_recommendations (
  id VARCHAR(64) PRIMARY KEY,
  rank INT NOT NULL,
  target_ids JSONB NOT NULL,
  hotspot_id VARCHAR(64),

  -- Spatial Location
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),

  -- Decision-Support Metrics
  priority_score DOUBLE PRECISION NOT NULL,
  urgency VARCHAR(32) NOT NULL,
  recommendation_type VARCHAR(64) NOT NULL,

  -- Reasoning & Transparency
  reasons JSONB NOT NULL,
  evidence JSONB NOT NULL,
  uncertainty JSONB NOT NULL,
  expected_benefit TEXT NOT NULL,

  -- Related Context & Provenance
  related_risk_level VARCHAR(32) NOT NULL,
  related_change_type VARCHAR(32),
  provenance VARCHAR(32) NOT NULL,
  area_name VARCHAR(128),
  target_count INT DEFAULT 1,

  -- Operator Acknowledgement & Override Lifecycle
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(128),
  operator_note TEXT,
  operator_override JSONB,

  generated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Spatial & Operational Indexes for Recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_geom ON follow_up_recommendations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_recommendations_rank ON follow_up_recommendations(rank);
CREATE INDEX IF NOT EXISTS idx_recommendations_urgency ON follow_up_recommendations(urgency);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON follow_up_recommendations(priority_score DESC);

-- 9. Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  target_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  operator VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_target_id ON audit_events(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action_type);
