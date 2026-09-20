/**
 * PostgreSQL + PostGIS Database Configuration
 * SIH 2026 Problem Statement 26057
 *
 * Reads database credentials securely from environment variables.
 * Credentials are never hardcoded. Supports standard DATABASE_URL
 * or separate host/port/db/user/password parameters.
 */

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export function getDatabaseConfig(): { config: DatabaseConfig; isConfigured: boolean } {
  // Prefer DATABASE_URL if provided
  const databaseUrl = process.env.DATABASE_URL?.trim();

  const host = process.env.POSTGRES_HOST?.trim();
  const port = parseInt(process.env.POSTGRES_PORT?.trim() || '5432', 10);
  const database = process.env.POSTGRES_DB?.trim() || 'sonar_geoint_db';
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD?.trim();
  const sslMode = process.env.POSTGRES_SSL?.trim()?.toLowerCase();

  const isConfigured = Boolean(databaseUrl || (host && user));

  const ssl = sslMode === 'true' || sslMode === 'require'
    ? { rejectUnauthorized: false }
    : false;

  const config: DatabaseConfig = {
    connectionString: databaseUrl || undefined,
    host: host || 'localhost',
    port: isNaN(port) ? 5432 : port,
    database,
    user: user || undefined,
    password: password || undefined,
    ssl,
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  return { config, isConfigured };
}
