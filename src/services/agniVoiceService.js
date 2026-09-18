/**
 * @module src/services/agniVoiceService
 * @description AGNI Tactical Voice AI Service Layer for PyroSat / Firms.
 * 
 * Provides:
 *  - Full duplex Web Speech API STT (Speech Recognition) & TTS (Speech Synthesis)
 *  - Web Audio API AnalyserNode for live 32-bar audio frequency visualization
 *  - Chromium TTS keep-alive timer preventing 15s silent engine pauses
 *  - Voice synthesis voice picker favoring natural and en-IN vocal patterns
 *  - Tactical NLU API bridge connecting to /api/v1/agni/interpret
 *  - Local deterministic fallback interpreter if API or network is unreachable
 */

export class AgniVoiceService {
  constructor() {
    this.mediaStream = null;
    this.audioContext = null;
    this.analyserNode = null;
    this.recognition = null;
    this.isListening = false;
    this.isMuted = false;
    this.availableVoices = [];
    this.voicesInitialized = false;
    this.currentUtterance = null;
    this.ttsKeepAliveInterval = null;
    this.activeAbortController = null;
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      try {
        const savedMute = localStorage.getItem('agni_tts_muted');
        if (savedMute !== null) {
          this.isMuted = savedMute === 'true';
        }
      } catch {
        // Ignore localStorage error
      }
      this.initVoices();
    }
  }

  /**
   * Populate available Web Speech Synthesis voices
   */
  initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.availableVoices = window.speechSynthesis.getVoices() || [];
      if (this.availableVoices.length > 0) {
        this.voicesInitialized = true;
      }
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            this.availableVoices = window.speechSynthesis.getVoices() || [];
            this.voicesInitialized = true;
          } catch {
            // Ignore voice listener errors
          }
        };
      }
    } catch {
      // Ignore voice fetch errors
    }
  }

  /**
   * Toggle TTS verbal response mute state
   */
  setMuted(muted) {
    this.isMuted = Boolean(muted);
    try {
      localStorage.setItem('agni_tts_muted', String(this.isMuted));
    } catch {}
    if (this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.stopTtsKeepAlive();
    }
    this.notify('mute_changed', { isMuted: this.isMuted });
    return this.isMuted;
  }

  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  /**
   * Chromium keepalive workaround for long utterances (>15s)
   */
  startTtsKeepAlive() {
    this.stopTtsKeepAlive();
    this.ttsKeepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        } catch {}
      }
    }, 5000);
  }

  stopTtsKeepAlive() {
    if (this.ttsKeepAliveInterval) {
      clearInterval(this.ttsKeepAliveInterval);
      this.ttsKeepAliveInterval = null;
    }
  }

  /**
   * Speak tactical verbal response via Web Speech Synthesis
   */
  speak(text, { onStart, onEnd, onError } = {}) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    if (this.isMuted || !text || !text.trim()) {
      return false;
    }

    try {
      this.stopTtsKeepAlive();
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      if (!this.voicesInitialized || this.availableVoices.length === 0) {
        this.initVoices();
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      this.currentUtterance = utterance;

      if (this.availableVoices.length > 0) {
        const preferred =
          this.availableVoices.find((v) => v.lang === 'en-IN') ||
          this.availableVoices.find((v) => v.lang.startsWith('en-') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))) ||
          this.availableVoices.find((v) => v.lang.startsWith('en-')) ||
          this.availableVoices[0];

        if (preferred) {
          utterance.voice = preferred;
          utterance.lang = preferred.lang;
        } else {
          utterance.lang = 'en-IN';
        }
      } else {
        utterance.lang = 'en-IN';
      }

      utterance.volume = 1.0;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.startTtsKeepAlive();
        this.notify('tts_start', { text });
        if (typeof onStart === 'function') onStart();
      };

      utterance.onend = () => {
        this.stopTtsKeepAlive();
        this.currentUtterance = null;
        this.notify('tts_end', { text });
        if (typeof onEnd === 'function') onEnd();
      };

      utterance.onerror = (e) => {
        this.stopTtsKeepAlive();
        this.currentUtterance = null;
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[AGNI TTS] Speech error:', e.error || e);
        }
        if (typeof onError === 'function') onError(e);
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[AGNI TTS] Speak error:', err);
      return false;
    }
  }

  /**
   * Request microphone stream and attach AnalyserNode for audio visualization
   */
  async startAudioCapture() {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone audio capture not supported in this environment');
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 64;
        this.analyserNode.smoothingTimeConstant = 0.8;
        source.connect(this.analyserNode);
      }

      return this.mediaStream;
    } catch (err) {
      console.warn('[AGNI Audio] Audio capture error:', err);
      throw err;
    }
  }

  /**
   * Retrieve normalized 32-bar frequency amplitude values (0.0 to 1.0)
   */
  getAudioFrequencyData() {
    if (!this.analyserNode) {
      return null;
    }
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Stop audio capture and close microphone stream
   */
  stopAudioCapture() {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyserNode = null;
  }

  /**
   * Start Speech Recognition session
   */
  startSpeechRecognition({ onTranscript, onError, onEnd, onStart } = {}) {
    if (typeof window === 'undefined') return false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false;
    }

    try {
      this.stopSpeechRecognition();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.isListening = true;
        this.notify('listening_started');
        if (typeof onStart === 'function') onStart();
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (final.trim()) {
          this.notify('transcript', { text: final.trim(), isFinal: true });
          if (typeof onTranscript === 'function') onTranscript(final.trim(), true);
        } else if (interim.trim()) {
          this.notify('transcript', { text: interim.trim(), isFinal: false });
          if (typeof onTranscript === 'function') onTranscript(interim.trim(), false);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') return;
        this.notify('error', { error: event.error });
        if (typeof onError === 'function') onError(event);
      };

      recognition.onend = () => {
        this.notify('listening_ended');
        if (typeof onEnd === 'function') onEnd();
      };

      recognition.start();
      this.recognition = recognition;
      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('[AGNI STT] Recognition start error:', err);
      return false;
    }
  }

  stopSpeechRecognition() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
  }

  /**
   * Send transcribed text or typed input to AGNI API interpreter
   */
  async interpretCommand(transcript, context = {}) {
    if (!transcript || !transcript.trim()) {
      return null;
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();

    try {
      const resp = await fetch('/api/v1/agni/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          context,
        }),
        signal: this.activeAbortController.signal,
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const result = await resp.json();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to interpret voice command');
    } catch (err) {
      if (err.name === 'AbortError') {
        return null;
      }
      console.warn('[AGNI API] Remote interpretation failed, falling back to local heuristic:', err.message);
      return this.localInterpretFallback(transcript);
    } finally {
      this.activeAbortController = null;
    }
  }

  /**
   * Deterministic local fallback in case of network unavailability
   */
  localInterpretFallback(transcript) {
    const raw = transcript.toLowerCase();

    // 1. High-Specificity Tactical Commands (XAI, Plume, Simulation, Dispatch, Dossier, Recenter)
    if (raw.includes('xai') || raw.includes('shap') || raw.includes('why') || raw.includes('explain')) {
      return {
        action: 'OPEN_XAI',
        speech_response: 'Opening explainable AI feature attribution and TreeSHAP waterfall diagnostic.',
        feedback: '🧠 Opening XAI Attribution Diagnostic'
      };
    }
    if (raw.includes('plume') || raw.includes('dispersion') || raw.includes('gaussian') || raw.includes('toxic gas')) {
      return {
        action: 'SHOW_HAZARD',
        hazard_type: 'PLUME_DISPERSION',
        speech_response: 'Executing ALOHA and atmospheric Gaussian plume simulation.',
        feedback: '🔬 Simulating Gaussian Chemical Plume Dispersion'
      };
    }
    if (raw.includes('simulat') || raw.includes('lab') || raw.includes('sandbox')) {
      return {
        action: 'OPEN_SIMULATION_LAB',
        speech_response: 'Launching AI Multi-Physics Simulation Lab and sandbox.',
        feedback: '🧪 Opening AI Simulation Lab'
      };
    }
    if (raw.includes('recenter') || raw.includes('reset view') || raw.includes('india overview') || raw.includes('home')) {
      return {
        action: 'MAP_ACTION',
        map_action: 'RECENTER_INDIA',
        speech_response: 'Recentering geospatial camera to national India surveillance grid.',
        feedback: '🇮🇳 Recentered on National Surveillance Grid'
      };
    }
    if (raw.includes('dispatch') || raw.includes('responder') || raw.includes('sms') || raw.includes('alert team')) {
      return {
        action: 'DISPATCH_PREVIEW',
        speech_response: 'Initiating tactical emergency dispatch and Fast2SMS dispatch modal.',
        feedback: '🚨 Opening Tactical Emergency Dispatch Modal'
      };
    }
    if (raw.includes('dossier') || raw.includes('incident action plan') || raw.includes('iap') || raw.includes('report')) {
      return {
        action: 'OPEN_DOSSIER',
        speech_response: 'Compiling Comprehensive Tactical Incident Action Plan dossier.',
        feedback: '📋 Opening Tactical Incident Action Plan Dossier'
      };
    }

    // 2. Incident Filtering & Category Registry
    if (raw.includes('mining') || raw.includes('coal') || raw.includes('mine') || raw.includes('smelter')) {
      return {
        action: 'FILTER_THERMAL_EVENTS',
        filters: { category: 'coal_mining_fire', status: 'ACTIVE' },
        speech_response: 'Opening active coal mining and smelting thermal anomaly registry.',
        feedback: '⛏️ Filtered for Mining & Smelting Anomaly Registry'
      };
    }
    if (raw.includes('stubble') || raw.includes('crop') || raw.includes('farm') || raw.includes('paddy')) {
      return {
        action: 'FILTER_THERMAL_EVENTS',
        filters: { category: 'crop_residue', status: 'ACTIVE' },
        speech_response: 'Showing agricultural stubble burning events across North India.',
        feedback: '🌾 Filtered for Agricultural Stubble Registry'
      };
    }
    if (raw.includes('wildfire') || raw.includes('forest') || raw.includes('timber') || raw.includes('canopy')) {
      return {
        action: 'FILTER_THERMAL_EVENTS',
        filters: { category: 'forest_wildfire', status: 'ACTIVE' },
        speech_response: 'Displaying forest wildfire hotspots and protected-area perimeters.',
        feedback: '🌲 Filtered for Forest Wildfire Hotspots'
      };
    }
    if (raw.includes('industr') || raw.includes('refiner') || raw.includes('chemical') || raw.includes('plant')) {
      return {
        action: 'FILTER_THERMAL_EVENTS',
        filters: { category: 'industrial_flaring', status: 'ACTIVE' },
        speech_response: 'Filtering for verified industrial petrochemical and refinery operations.',
        feedback: '🏭 Filtered for Industrial Facilities Registry'
      };
    }
    if (raw.includes('critical') || raw.includes('emergency') || raw.includes('urgent')) {
      return {
        action: 'FILTER_THERMAL_EVENTS',
        filters: { severity: 'CRITICAL', status: 'ACTIVE' },
        speech_response: 'Filtering active incidents for CRITICAL tier thermal surges.',
        feedback: '🚨 Filtered for CRITICAL Anomaly Surges'
      };
    }
    if (raw.includes('dispatch') || raw.includes('responder') || raw.includes('sms') || raw.includes('alert team')) {
      return {
        action: 'DISPATCH_PREVIEW',
        speech_response: 'Initiating tactical emergency dispatch and Fast2SMS dispatch modal.',
        feedback: '🚨 Opening Tactical Emergency Dispatch Modal'
      };
    }
    if (raw.includes('dossier') || raw.includes('incident action plan') || raw.includes('iap') || raw.includes('report')) {
      return {
        action: 'OPEN_DOSSIER',
        speech_response: 'Compiling Comprehensive Tactical Incident Action Plan dossier.',
        feedback: '📋 Opening Tactical Incident Action Plan Dossier'
      };
    }

    return {
      action: 'UNKNOWN',
      speech_response: `Tactical command recognized: "${transcript}". No direct action registered.`,
      feedback: `ℹ️ Heard: "${transcript}"`
    };
  }

  /**
   * Event listener subscription helper
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, payload = {}) {
    for (const cb of this.listeners) {
      try {
        cb(event, payload);
      } catch (err) {
        console.warn('[AGNI Listener Error]', err);
      }
    }
  }
}

export const agniVoiceService = new AgniVoiceService();
