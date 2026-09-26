/**
 * @module api/serverless
 * @description Vercel Serverless Function entry point for PyroSat API Gateway.
 * Provides millisecond-level cold-start API handling on Vercel Edge/Serverless infrastructure.
 */

import { createSriVisionMiddleware } from '../server/app.mjs';

const middleware = createSriVisionMiddleware();

export default async function handler(req, res) {
  // Normalize incoming URL across Vercel rewrite headers
  const originalUrl =
    req.headers['x-forwarded-uri'] ||
    req.headers['x-matched-path'] ||
    req.url;

  if (originalUrl && originalUrl !== '/api/serverless' && originalUrl !== '/api/serverless.js') {
    req.url = originalUrl;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    res.on('finish', safeResolve);
    res.on('close', safeResolve);

    try {
      middleware(req, res, () => {
        if (!res.writableEnded) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'ROUTE_NOT_FOUND', path: req.url }));
        }
        safeResolve();
      }).catch((err) => {
        console.error('[Vercel Serverless Error]', err);
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'INTERNAL_SERVER_ERROR',
              message: err?.message || String(err),
            })
          );
        }
        safeResolve();
      });
    } catch (err) {
      console.error('[Vercel Serverless Synchronous Error]', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: 'INTERNAL_SERVER_ERROR',
            message: err?.message || String(err),
          })
        );
      }
      safeResolve();
    }
  });
}
