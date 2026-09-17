/**
 * @module core/audio
 * @description Procedural Web Audio SFX for sriVision Tactical HUD.
 * Generates low-latency high-tech UI audio effects (clicks, chimes, radar sweeps)
 * with zero external audio assets and durable mute preference.
 */

class TacticalAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      const stored = localStorage.getItem('sri:audio-enabled');
      if (stored !== null) this.enabled = stored === 'true';
    } catch {}
  }

  _initCtx() {
    if (!this.ctx && (globalThis.AudioContext || globalThis.webkitAudioContext)) {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  toggleAudio(enabled) {
    this.enabled = enabled !== undefined ? enabled : !this.enabled;
    try {
      localStorage.setItem('sri:audio-enabled', String(this.enabled));
    } catch {}
    return this.enabled;
  }

  playClick() {
    if (!this.enabled) return;
    try {
      this._initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {}
  }

  playAlert() {
    if (!this.enabled) return;
    try {
      this._initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  playFlyTo() {
    if (!this.enabled) return;
    try {
      this._initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.18);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

export const tacticalAudio = new TacticalAudioEngine();
