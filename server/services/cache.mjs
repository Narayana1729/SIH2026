/**
 * @module server/services/cache
 * @description Resilient, atomic disk cache service for sriVision API proxies.
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class DiskCacheService {
  /**
   * @param {string} cacheDir - Directory path for cache files.
   */
  constructor(cacheDir = path.resolve(process.cwd(), '.srivision-cache')) {
    this.cacheDir = cacheDir;
  }

  /**
   * Read cached payload if it exists.
   * @param {string} filename
   * @returns {Promise<string|null>}
   */
  async get(filename) {
    try {
      const filePath = path.join(this.cacheDir, filename);
      return await fsp.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Atomically write a file using a temporary file and rename.
   * @param {string} filename
   * @param {string} content
   * @returns {Promise<boolean>}
   */
  async set(filename, content) {
    try {
      await fsp.mkdir(this.cacheDir, { recursive: true });
      const tempPath = path.join(this.cacheDir, `${filename}.${randomUUID()}.tmp`);
      const finalPath = path.join(this.cacheDir, filename);
      await fsp.writeFile(tempPath, content, 'utf8');
      await fsp.rename(tempPath, finalPath);
      return true;
    } catch (err) {
      console.warn(`[sriVision cache] write failed for ${filename}:`, err?.message || err);
      return false;
    }
  }
}

export const defaultCache = new DiskCacheService();
