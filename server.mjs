#!/usr/bin/env node
/**
 * @module server
 * @description Production preview runner for PyroSat.
 */

import { preview } from 'vite';

const port = parseInt(process.env.PORT || '8080', 10);
const host = process.env.HOST || '0.0.0.0';

console.log(`[PyroSat] Starting Industrial Thermal Satellite Intelligence Platform on http://${host}:${port}...`);

try {
  const server = await preview({
    preview: {
      port,
      host,
      allowedHosts: true,
    },
  });

  server.printUrls();

  const shutdown = () => {
    console.log('\n[PyroSat] Shutting down server...');
    server.httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error('[PyroSat] Failed to start production server:', error);
  process.exit(1);
}
