/**
 * @module server/routes/stream
 * @description Production Server-Sent Events (SSE) stream for real-time incident telemetry & alerts.
 */

import EventEmitter from 'node:events';
import { metricsRegistry } from '../services/metrics.mjs';

class RealtimeEventHub extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000);
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    metricsRegistry.activeConnections = this.clients.size;
  }

  removeClient(res) {
    this.clients.delete(res);
    metricsRegistry.activeConnections = this.clients.size;
  }

  broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.removeClient(client);
      }
    }
  }
}

export const eventHub = new RealtimeEventHub();

/**
 * Handles SSE connection requests.
 */
export function handleEventsStreamRoute(req, res, url) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  eventHub.addClient(res);

  // Initial handshake packet
  const connectMsg = {
    type: 'STREAM_CONNECTED',
    serverTime: new Date().toISOString(),
    activeClients: eventHub.clients.size,
  };
  res.write(`retry: 3000\n`);
  res.write(`event: handshake\ndata: ${JSON.stringify(connectMsg)}\n\n`);

  // Periodic heartbeat every 15s to keep connections alive across NAT/proxies
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeatTimer);
      eventHub.removeClient(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    eventHub.removeClient(res);
  });
}
