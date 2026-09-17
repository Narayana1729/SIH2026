/**
 * @module vite.config
 * @description Clean, modular Vite configuration for sriVision — Environmental & Disaster Command Platform.
 * Imports modular server routes from server/app.mjs instead of monolithic in-config handlers.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import cesium from 'vite-plugin-cesium';
import { createSriVisionMiddleware } from './server/app.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROVIDER_ENV_AT_BOOT = globalThis.__GEV_PROVIDER_ENV_AT_BOOT ??= Object.freeze({ ...process.env });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== '') process.env[k] = v;
  }
  const firmsKey = env.FIRMS_MAP_KEY || env.NASA_FIRMS_MAP_KEY || '1f855e76a168a37d8423e9d1f2047e76';
  process.env.FIRMS_MAP_KEY = firmsKey;

  return {
    root: '.',
    publicDir: 'public',
    plugins: [
      cesium(),
      {
        name: 'srivision-api-gateway',
        configureServer(server) {
          server.middlewares.use(createSriVisionMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(createSriVisionMiddleware());
        },
      },
    ],
    define: {
      'import.meta.env.GOOGLE_MAPS_API_KEY': JSON.stringify(env.GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.CESIUM_ION_TOKEN': JSON.stringify(env.CESIUM_ION_TOKEN || ''),
      'import.meta.env.FIRMS_MAP_KEY': JSON.stringify(env.FIRMS_MAP_KEY || ''),
    },
    server: {
      port: parseInt(env.PORT || '8080', 10),
      host: env.HOST || '0.0.0.0',
    },
    preview: {
      port: parseInt(env.PORT || '8080', 10),
      host: env.HOST || '0.0.0.0',
    },
    build: {
      target: 'esnext',
      sourcemap: true,
    },
  };
});
