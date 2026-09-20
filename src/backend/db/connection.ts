/**
 * PostgreSQL + PostGIS Connection & Pool Management
 * SIH 2026 Problem Statement 26057
 *
 * Manages database pool lifecycle, executes parameterized SQL queries,
 * verifies PostGIS spatial extension availability, and provides status reporting.
 * If credentials are not set or database is unreachable, gracefully signals fallback.
 */

import type pg from 'pg';
import { getDatabaseConfig, DatabaseConfig } from './config';

let PoolClass: typeof pg.Pool | null = null;

async function loadPgPool(): Promise<typeof pg.Pool | null> {
  if (PoolClass) return PoolClass;
  if (typeof window !== 'undefined') {
    return null; // Do not attempt to load Node PostgreSQL driver in browser client
  }
  try {
    const pkgName = 'pg';
    const imported = await import(/* @vite-ignore */ pkgName);
    PoolClass = imported.default?.Pool || imported.Pool || (imported as any).default?.default?.Pool;
    return PoolClass;
  } catch (err: any) {
    console.warn('[PostgreSQL Driver] Unable to load pg package dynamically:', err?.message || err);
    return null;
  }
}

export interface DatabaseHealth {
  configured: boolean;
  connected: boolean;
  storageMode: 'POSTGRESQL_POSTGIS' | 'DEVELOPMENT_FALLBACK';
  database: string;
  host: string;
  port: number;
  postgisAvailable: boolean;
  postgisVersion: string | null;
  activePoolClients?: number;
  idlePoolClients?: number;
  lastChecked: string;
  error?: string;
}

class DatabaseConnectionManager {
  private pool: pg.Pool | null = null;
  private isConnected = false;
  private postgisAvailable = false;
  private postgisVersion: string | null = null;
  private connectionAttempted = false;
  private lastError: string | null = null;
  private isInitializing = false;

  public async getPool(): Promise<pg.Pool | null> {
    if (this.pool && this.isConnected) {
      return this.pool;
    }
    await this.initializePool();
    return this.pool;
  }

  public async initializePool(): Promise<boolean> {
    if (this.isInitializing) return this.isConnected;
    this.isInitializing = true;

    const { config, isConfigured } = getDatabaseConfig();

    if (!isConfigured) {
      this.isConnected = false;
      this.lastError = 'PostgreSQL environment variables (DATABASE_URL or POSTGRES_*) not configured.';
      this.isInitializing = false;
      return false;
    }

    try {
      if (!this.pool) {
        const PGPool = await loadPgPool();
        if (!PGPool) {
          this.isConnected = false;
          this.lastError = 'PostgreSQL pg driver not available in this environment.';
          this.isInitializing = false;
          return false;
        }

        const poolConfig: pg.PoolConfig = config.connectionString
          ? {
              connectionString: config.connectionString,
              ssl: config.ssl,
              max: config.maxConnections,
              idleTimeoutMillis: config.idleTimeoutMillis,
              connectionTimeoutMillis: config.connectionTimeoutMillis,
            }
          : {
              host: config.host,
              port: config.port,
              database: config.database,
              user: config.user,
              password: config.password,
              ssl: config.ssl,
              max: config.maxConnections,
              idleTimeoutMillis: config.idleTimeoutMillis,
              connectionTimeoutMillis: config.connectionTimeoutMillis,
            };

        this.pool = new PGPool(poolConfig);

        this.pool.on('error', (err) => {
          console.warn('[PostgreSQL Pool] Idle client error:', err.message);
          this.isConnected = false;
          this.lastError = err.message;
        });
      }

      // Test connection
      const client = await this.pool.connect();
      try {
        const res = await client.query('SELECT 1 as connected;');
        this.isConnected = res.rows.length > 0 && res.rows[0].connected === 1;

        // Check PostGIS
        try {
          const gisRes = await client.query("SELECT PostGIS_Full_Version() as version;");
          if (gisRes.rows.length > 0) {
            this.postgisAvailable = true;
            this.postgisVersion = gisRes.rows[0].version;
          }
        } catch {
          // Attempt to enable if not present
          try {
            await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
            const retryGis = await client.query("SELECT PostGIS_Full_Version() as version;");
            this.postgisAvailable = true;
            this.postgisVersion = retryGis.rows[0]?.version || 'PostGIS enabled';
          } catch (gisErr: any) {
            this.postgisAvailable = false;
            this.postgisVersion = null;
            console.warn('[PostGIS] PostGIS extension not available:', gisErr.message);
          }
        }

        this.lastError = null;
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      this.isConnected = false;
      this.postgisAvailable = false;
      this.lastError = err.message || 'Database connection error';
      return false;
    } finally {
      this.connectionAttempted = true;
      this.isInitializing = false;
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<pg.QueryResult<T> | null> {
    try {
      const pool = await this.getPool();
      if (!pool || !this.isConnected) {
        return null;
      }
      return await pool.query<T>(sql, params);
    } catch (err: any) {
      console.warn('[PostgreSQL Query Error]:', err.message);
      this.lastError = err.message;
      return null;
    }
  }

  public async getHealth(): Promise<DatabaseHealth> {
    const { config, isConfigured } = getDatabaseConfig();

    if (!this.connectionAttempted) {
      await this.initializePool();
    }

    return {
      configured: isConfigured,
      connected: this.isConnected,
      storageMode: this.isConnected ? 'POSTGRESQL_POSTGIS' : 'DEVELOPMENT_FALLBACK',
      database: config.database,
      host: config.host || 'local',
      port: config.port,
      postgisAvailable: this.postgisAvailable,
      postgisVersion: this.postgisVersion,
      activePoolClients: this.pool?.totalCount,
      idlePoolClients: this.pool?.idleCount,
      lastChecked: new Date().toISOString(),
      error: this.lastError || undefined,
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      this.postgisAvailable = false;
    }
  }
}

export const db = new DatabaseConnectionManager();
