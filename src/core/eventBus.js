/**
 * @module core/eventBus
 * @description Centralized Reactive Event Bus for sriVision.
 * Implements Publish/Subscribe with memory leak prevention, replay capability, and window CustomEvent bridging.
 */

import { SRI_EVENTS } from './eventTypes.js';

class SriEventBus {
  constructor() {
    this._listeners = new Map();
    this._history = [];
    this._maxHistory = 100;
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name from SRI_EVENTS
   * @param {Function} handler - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event exactly once.
   */
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this._listeners.delete(event);
    }
  }

  /**
   * Publish an event to all subscribers and record in history.
   * Also bridges to window.dispatchEvent so external modules/Cesium handlers can react.
   */
  emit(event, payload = {}) {
    const eventRecord = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    this._history.push(eventRecord);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    const set = this._listeners.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      }
    }

    // Bridge to DOM CustomEvents
    try {
      window.dispatchEvent(new CustomEvent(event, { detail: payload }));
    } catch {}
  }

  /**
   * Get recent event history for audit or state rehydration.
   */
  getHistory(filterEvent = null) {
    if (filterEvent) {
      return this._history.filter((e) => e.event === filterEvent);
    }
    return [...this._history];
  }

  /**
   * Clear all listeners and history.
   */
  clear() {
    this._listeners.clear();
    this._history = [];
  }
}

export const eventBus = new SriEventBus();
export { SRI_EVENTS };
