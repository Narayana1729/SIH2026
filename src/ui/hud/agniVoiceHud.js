/**
 * @module src/ui/hud/agniVoiceHud
 * @description AGNI Tactical Voice AI Command HUD for PyroSat / Firms
 * 
 * Features:
 *  - 32-Bar Real-Time Web Audio API frequency visualizer
 *  - Full-duplex STT & verbal voice synthesis (TTS) with Mute toggle
 *  - REST integration with Gemini-backed /api/v1/agni/interpret
 *  - Live interim transcript display + tactical verbal response banner
 *  - Quick tactical chips covering mining, stubble, flares, XAI, plume, sim lab, and map navigation
 */

import { tacticalAudio } from '../../core/audio.js';
import { agniVoiceService } from '../../services/agniVoiceService.js';

let hudElement = null;
let commandCallback = null;
let animFrameId = null;
let isVisualizerRunning = false;
let autoCloseTimer = null;

export function initAgniVoiceHud(onCommand) {
  commandCallback = onCommand;
  if (!hudElement) {
    createVoiceHudDOM();
  }
}

export function toggleAgniVoiceHud() {
  if (!hudElement) {
    createVoiceHudDOM();
  }
  
  if (hudElement.style.display === 'none' || !hudElement.style.display) {
    openVoiceHud();
  } else {
    closeVoiceHud();
  }
}

export function openVoiceHud() {
  if (!hudElement) createVoiceHudDOM();
  clearTimeout(autoCloseTimer);
  hudElement.style.display = 'block';

  const transcriptEl = hudElement.querySelector('#agni-transcript');
  if (transcriptEl) {
    transcriptEl.innerHTML = `<span style="color: #64748b;">Listening for voice command... (e.g. <i>"Filter critical thermal events"</i>)</span>`;
  }
  const responseBubble = hudElement.querySelector('#agni-response-bubble');
  if (responseBubble) {
    responseBubble.style.display = 'none';
    responseBubble.textContent = '';
  }

  updateMuteButtonUI();
  updateStatus("MIC ACTIVE", "#38bdf8");
  tacticalAudio.playAlert();
  startListening();

  setTimeout(() => {
    const input = hudElement?.querySelector('#agni-voice-input');
    if (input) input.focus();
  }, 100);
}

export function closeVoiceHud() {
  if (hudElement) {
    hudElement.style.display = 'none';
  }
  clearTimeout(autoCloseTimer);
  stopListening();
}

function updateStatus(text, color = '#38bdf8') {
  const statusEl = hudElement?.querySelector('#agni-mic-status');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.color = color;
  }
  const pulseDot = hudElement?.querySelector('#agni-pulse-dot');
  if (pulseDot) {
    pulseDot.style.background = color;
    pulseDot.style.boxShadow = `0 0 12px ${color}`;
  }
}

function updateMuteButtonUI() {
  const muteBtn = hudElement?.querySelector('#agni-mute-btn');
  if (!muteBtn) return;
  if (agniVoiceService.isMuted) {
    muteBtn.innerHTML = '🔇 VOICE OFF';
    muteBtn.title = 'Speech synthesis muted. Click to enable verbal audio responses.';
    muteBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    muteBtn.style.color = '#f87171';
    muteBtn.style.background = 'rgba(239, 68, 68, 0.12)';
  } else {
    muteBtn.innerHTML = '🔊 VOICE ON';
    muteBtn.title = 'Verbal audio responses enabled. Click to mute.';
    muteBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    muteBtn.style.color = '#34d399';
    muteBtn.style.background = 'rgba(16, 185, 129, 0.12)';
  }
}

function createVoiceHudDOM() {
  if (document.getElementById('agni-voice-hud-container')) {
    hudElement = document.getElementById('agni-voice-hud-container');
    return;
  }

  hudElement = document.createElement('div');
  hudElement.id = 'agni-voice-hud-container';
  hudElement.style.cssText = `
    position: fixed;
    bottom: 25px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(8, 14, 26, 0.96);
    border: 1px solid rgba(0, 212, 255, 0.45);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 35px rgba(0, 212, 255, 0.25);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    z-index: 10001;
    display: none;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: #f1f5f9;
    width: 540px;
    max-width: calc(100vw - 32px);
    animation: agniHudSlideUp 220ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  hudElement.innerHTML = `
    <!-- HUD Header -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div id="agni-pulse-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #00d4ff; box-shadow: 0 0 12px #00d4ff; animation: agniGlowPulse 1.2s infinite ease-in-out;"></div>
        <span style="font-size: 12px; font-weight: 800; color: #00d4ff; letter-spacing: 1px;">AGNI TACTICAL VOICE AI</span>
        <span id="agni-mic-status" style="font-size: 9px; padding: 2px 7px; background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.3); border-radius: 4px; color: #38bdf8; font-weight: 700;">MIC ACTIVE</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="agni-mute-btn" type="button" style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); border-radius: 5px; color: #34d399; font-size: 9.5px; font-weight: 700; padding: 3px 8px; cursor: pointer; transition: all 150ms ease;">🔊 VOICE ON</button>
        <button id="agni-close-btn" type="button" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; width: 24px; height: 24px; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 120ms ease;">✕</button>
      </div>
    </div>

    <!-- 32-Bar Live Audio Visualizer Canvas -->
    <canvas id="agni-waveform-canvas" width="500" height="42" style="width: 100%; height: 42px; border-radius: 8px; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.08); display: block; margin-bottom: 10px;"></canvas>

    <!-- Real-time Speech Transcript Display -->
    <div id="agni-transcript" style="font-size: 12.5px; color: #38bdf8; min-height: 24px; margin-bottom: 8px; text-align: center; padding: 5px 10px; background: rgba(0,212,255,0.05); border: 1px dashed rgba(0,212,255,0.25); border-radius: 6px; word-break: break-word;">
      <span style="color: #64748b;">Listening for voice command... (e.g. <i>"Filter critical thermal events"</i>)</span>
    </div>

    <!-- Spoken Voice Feedback Bubble -->
    <div id="agni-response-bubble" style="display: none; font-size: 11.5px; color: #a7f3d0; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; text-align: left; line-height: 1.4;"></div>

    <!-- Quick Text Fallback Input -->
    <div style="display: flex; gap: 6px; margin-bottom: 10px;">
      <input id="agni-voice-input" type="text" placeholder="Speak into mic or type command (e.g. 'show stubble fires')..." style="
        flex: 1;
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 7px 11px;
        font-family: inherit;
        font-size: 11px;
        color: #f8fafc;
        outline: none;
      " />
      <button id="agni-send-btn" type="button" style="
        background: linear-gradient(135deg, #00d4ff, #0284c7);
        border: none;
        border-radius: 6px;
        padding: 0 16px;
        font-family: inherit;
        font-size: 10px;
        font-weight: 700;
        color: #04101e;
        cursor: pointer;
        transition: transform 120ms ease;
      ">RUN</button>
    </div>

    <!-- Interactive Quick Tactical Action Chips -->
    <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; font-size: 9px;">
      <button type="button" class="agni-quick-chip" data-cmd="list mining activities" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">⛏️ Mining Basins</button>
      <button type="button" class="agni-quick-chip" data-cmd="show stubble fires in punjab" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🌾 Stubble Fires</button>
      <button type="button" class="agni-quick-chip" data-cmd="filter critical thermal events" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🚨 Critical Surges</button>
      <button type="button" class="agni-quick-chip" data-cmd="list industrial refineries" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🏭 Refineries</button>
      <button type="button" class="agni-quick-chip" data-cmd="simulate plume dispersion" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🔬 Plume Sim</button>
      <button type="button" class="agni-quick-chip" data-cmd="explain why this is classified industrial" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🧠 TreeSHAP XAI</button>
      <button type="button" class="agni-quick-chip" data-cmd="open simulation lab" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🧪 Simulation Lab</button>
      <button type="button" class="agni-quick-chip" data-cmd="recenter map to india" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🇮🇳 Recenter India</button>
      <button type="button" class="agni-quick-chip" data-cmd="dispatch emergency team" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🚨 Fast2SMS Dispatch</button>
    </div>

    <style>
      @keyframes agniGlowPulse {
        0% { opacity: 0.5; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0.5; transform: scale(0.9); }
      }
      @keyframes agniHudSlideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .agni-quick-chip:hover {
        background: rgba(0, 212, 255, 0.22) !important;
        border-color: #00d4ff !important;
        color: #00d4ff !important;
      }
      #agni-close-btn:hover {
        background: rgba(239, 68, 68, 0.25) !important;
        border-color: #ef4444 !important;
        color: #ef4444 !important;
      }
    </style>
  `;

  document.body.appendChild(hudElement);

  hudElement.querySelector('#agni-close-btn')?.addEventListener('click', closeVoiceHud);

  const muteBtn = hudElement.querySelector('#agni-mute-btn');
  muteBtn?.addEventListener('click', () => {
    tacticalAudio.playClick();
    agniVoiceService.toggleMute();
    updateMuteButtonUI();
  });

  const inputEl = hudElement.querySelector('#agni-voice-input');
  const sendBtn = hudElement.querySelector('#agni-send-btn');

  const submitInput = () => {
    const val = inputEl?.value?.trim();
    if (val) {
      inputEl.value = '';
      processCommand(val);
    }
  };

  sendBtn?.addEventListener('click', submitInput);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitInput();
    }
  });

  hudElement.querySelectorAll('.agni-quick-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      tacticalAudio.playClick();
      const cmd = chip.getAttribute('data-cmd');
      if (cmd) {
        processCommand(cmd);
      }
    });
  });
}

function startListening() {
  clearTimeout(autoCloseTimer);
  // 1. Start audio visualizer
  startVisualizer();

  // 2. Start speech recognition
  const success = agniVoiceService.startSpeechRecognition({
    onStart: () => {
      updateStatus("LISTENING LIVE", "#10b981");
    },
    onTranscript: (text, isFinal) => {
      const transcriptEl = hudElement?.querySelector('#agni-transcript');
      if (transcriptEl && text) {
        transcriptEl.innerHTML = `<span>"${text}"</span>`;
      }
      if (isFinal) {
        processCommand(text);
      }
    },
    onError: (err) => {
      if (err?.error === 'not-allowed') {
        updateStatus("MIC BLOCKED", "#ef4444");
      }
    },
    onEnd: () => {
      // If HUD is still open, keep speech recognition restarted smoothly
      if (hudElement && hudElement.style.display !== 'none' && !autoCloseTimer) {
        setTimeout(() => {
          if (hudElement && hudElement.style.display !== 'none' && !autoCloseTimer) {
            agniVoiceService.startSpeechRecognition();
          }
        }, 300);
      }
    },
  });

  if (!success) {
    updateStatus("TEXT ONLY / CHIPS", "#f59e0b");
    const transcriptEl = hudElement?.querySelector('#agni-transcript');
    if (transcriptEl) {
      transcriptEl.innerHTML = `<span style="color: #cbd5e1;">Speech recognition inactive in this browser. Use input below or quick action chips.</span>`;
    }
  }
}

function stopListening() {
  agniVoiceService.stopSpeechRecognition();
  stopVisualizer();
}

let lastCommandTime = 0;
let lastCommandText = '';

async function processCommand(cmdText) {
  const now = Date.now();
  if (cmdText === lastCommandText && now - lastCommandTime < 1500) {
    return;
  }
  lastCommandText = cmdText;
  lastCommandTime = now;

  updateStatus("PROCESSING...", "#f59e0b");
  const transcriptEl = hudElement?.querySelector('#agni-transcript');
  if (transcriptEl) {
    transcriptEl.innerHTML = `<span style="color: #38bdf8;">"${cmdText}"</span>`;
  }

  // Gather context from window state
  const context = {
    incident_id: window.__sriVision?.hazardInspector?.currentHazard?.id || null,
    selected_sector: window.__sriVision?.selectedSector || null,
    has_active_plume: Boolean(window.__sriVision?.hazardLayerManager?.getLayer('hazard-dispersion')?.isVisible),
  };

  try {
    const result = await agniVoiceService.interpretCommand(cmdText, context);
    if (!result) return;

    // Display verbal response bubble
    const responseBubble = hudElement?.querySelector('#agni-response-bubble');
    if (responseBubble && result.speech_response) {
      responseBubble.style.display = 'block';
      responseBubble.innerHTML = `<strong>🗣️ AGNI:</strong> ${result.speech_response}`;
    }

    if (transcriptEl && result.feedback) {
      transcriptEl.innerHTML = `<span style="color: #34d399; font-weight: 700;">✅ ${result.feedback}</span>`;
    }

    updateStatus("COMMAND EXECUTED", "#10b981");
    tacticalAudio.playAlert();

    // Speak tactical response
    if (result.speech_response) {
      agniVoiceService.speak(result.speech_response);
    }

    // Dispatch command to application handler
    if (typeof commandCallback === 'function') {
      commandCallback(result);
    }

    // Auto-close HUD after 2.8 seconds so user can see what happened
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      closeVoiceHud();
    }, 2800);
  } catch (err) {
    console.warn('[AGNI HUD] Execution failed:', err);
    updateStatus("ERROR", "#ef4444");
  }
}

function startVisualizer() {
  if (isVisualizerRunning) return;
  isVisualizerRunning = true;

  agniVoiceService.startAudioCapture().catch(() => {
    // Fall back to synthetic waveform animation if mic access rejected
  });

  const canvas = hudElement?.querySelector('#agni-waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function renderWaveform() {
    if (!isVisualizerRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numBars = 32;
    const barWidth = (canvas.width / numBars) - 3;
    const freqData = agniVoiceService.getAudioFrequencyData();

    for (let i = 0; i < numBars; i++) {
      let height = 4;
      if (freqData && freqData.length > 0) {
        const binIndex = Math.min(i, freqData.length - 1);
        const val = freqData[binIndex] / 255;
        height = Math.max(4, val * (canvas.height - 6));
      } else {
        // Fallback procedural waveform
        const t = Date.now() * 0.0035;
        height = Math.abs(Math.sin(t + i * 0.25) * Math.cos(t * 0.4 + i * 0.15)) * (canvas.height - 10) + 4;
      }

      const x = i * (barWidth + 3);
      const y = (canvas.height - height) / 2;

      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#00d4ff');
      grad.addColorStop(0.5, '#38bdf8');
      grad.addColorStop(1, '#0284c7');

      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, height, 2);
      } else {
        ctx.fillRect(x, y, barWidth, height);
      }
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(renderWaveform);
  }

  renderWaveform();
}

function stopVisualizer() {
  isVisualizerRunning = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  agniVoiceService.stopAudioCapture();
}
