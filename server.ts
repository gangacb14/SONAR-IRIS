/**
 * High-Performance Express + Vite Server Entry Point
 * SIH 2026 Problem Statement 26057: Subsea Sonar Marine Debris & GEOINT
 *
 * Mounts REST API routes, initializes PostgreSQL + PostGIS with automated migrations,
 * handles graceful development fallback, and serves Vite SPA in dev and production.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiRouter from './src/backend/routes/api';
import { runMigrations } from './src/backend/db/migrator';
import { db } from './src/backend/db/connection';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Basic request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Initialize database & run migrations
  try {
    console.log('[Startup] Initializing Database & Running Schema Migrations...');
    const migrationResult = await runMigrations();
    const health = await db.getHealth();

    if (health.connected) {
      console.log(`[Database] Connected to PostgreSQL. PostGIS active: ${health.postgisAvailable}`);
      if (health.postgisVersion) {
        console.log(`[Database] PostGIS Version: ${health.postgisVersion.split('\n')[0]}`);
      }
    } else {
      console.log(`[Database] Operating in ${health.storageMode} mode (In-Memory / Local Storage Fallback).`);
      console.log('[Database] Set DATABASE_URL to connect to live PostgreSQL + PostGIS.');
    }
  } catch (err: any) {
    console.warn('[Startup] Database initialization encountered notice:', err.message);
  }

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Vite] Development middleware mounted.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Static] Production static assets serving from dist.');
  }

  app.listen(PORT, HOST, () => {
    console.log(`=============================================================`);
    console.log(`Sonar Debris & GEOINT Analytics Server running on http://${HOST}:${PORT}`);
    console.log(`API endpoints accessible under /api/*`);
    console.log(`=============================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});
