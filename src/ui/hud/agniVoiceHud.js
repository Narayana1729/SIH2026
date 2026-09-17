/**
 * @module src/ui/hud/agniVoiceHud
 * @description AGNI Tactical Voice AI Command HUD
 * 
 * High-performance speech recognition and live 32-bar microphone audio
 * spectrum visualizer (Web Audio API + Web Speech API + Quick Command Fallbacks).
 */

import { tacticalAudio } from '../../core/audio.js';

let hudElement = null;
let recognition = null;
let isListening = false;
let audioContext = null;
let analyser = null;
let micStream = null;
let animFrameId = null;
let commandCallback = null;
let restartTimeout = null;

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
  hudElement.style.display = 'block';
  const transcriptEl = hudElement.querySelector('#agni-transcript');
  if (transcriptEl) {
    transcriptEl.innerHTML = `"Listening for voice command... (e.g. 'List mining activities')"`;
  }
  const statusEl = hudElement.querySelector('#agni-mic-status');
  if (statusEl) {
    statusEl.textContent = "MIC ACTIVE";
    statusEl.style.color = "#38bdf8";
  }
  tacticalAudio.playAlert();
  startVoiceListening();
  setTimeout(() => {
    const input = hudElement?.querySelector('#agni-voice-input');
    if (input) input.focus();
  }, 100);
}

export function closeVoiceHud() {
  if (hudElement) {
    hudElement.style.display = 'none';
  }
  stopVoiceListening();
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
    background: rgba(8, 14, 26, 0.94);
    border: 1px solid rgba(0, 212, 255, 0.4);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.85), 0 0 30px rgba(0, 212, 255, 0.2);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 10001;
    display: none;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: #f1f5f9;
    width: 520px;
    max-width: calc(100vw - 40px);
    animation: agniHudSlideUp 220ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  hudElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div id="agni-pulse-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #00d4ff; box-shadow: 0 0 12px #00d4ff; animation: agniGlowPulse 1.2s infinite ease-in-out;"></div>
        <span style="font-size: 12px; font-weight: 800; color: #00d4ff; letter-spacing: 1px;">AGNI TACTICAL VOICE AI</span>
        <span id="agni-mic-status" style="font-size: 9px; padding: 1px 6px; background: rgba(0,212,255,0.15); border: 1px solid rgba(0,212,255,0.3); border-radius: 4px; color: #38bdf8;">MIC ACTIVE</span>
      </div>
      <button id="agni-close-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; width: 24px; height: 24px; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 120ms ease;">✕</button>
    </div>

    <!-- 32-Bar Live Audio Visualizer Canvas -->
    <canvas id="agni-waveform-canvas" width="480" height="42" style="width: 100%; height: 42px; border-radius: 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); display: block; margin-bottom: 10px;"></canvas>

    <!-- Real-time Speech Transcript Display -->
    <div id="agni-transcript" style="font-size: 13px; color: #38bdf8; min-height: 22px; margin-bottom: 10px; text-align: center; padding: 4px 8px; background: rgba(0,212,255,0.05); border: 1px dashed rgba(0,212,255,0.25); border-radius: 6px; word-break: break-word;">
      "Listening for voice command... (e.g. 'List mining activities')"
    </div>

    <!-- Quick Text Fallback Input -->
    <div style="display: flex; gap: 6px; margin-bottom: 10px;">
      <input id="agni-voice-input" type="text" placeholder="Speak into mic or type command (e.g. 'list mining')..." style="
        flex: 1;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 6px 10px;
        font-family: inherit;
        font-size: 11px;
        color: #f8fafc;
        outline: none;
      " />
      <button id="agni-send-btn" style="
        background: linear-gradient(135deg, #00d4ff, #0284c7);
        border: none;
        border-radius: 6px;
        padding: 0 14px;
        font-family: inherit;
        font-size: 10px;
        font-weight: 700;
        color: #04101e;
        cursor: pointer;
        transition: transform 120ms ease;
      ">RUN</button>
    </div>

    <!-- Interactive Quick Action Chips -->
    <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; font-size: 9.5px;">
      <button type="button" class="agni-quick-chip" data-cmd="list out all mining activities" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">⛏️ List Mining</button>
      <button type="button" class="agni-quick-chip" data-cmd="list all thermal targets" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">⚡ All Targets</button>
      <button type="button" class="agni-quick-chip" data-cmd="list industrial refineries" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🏭 Industry</button>
      <button type="button" class="agni-quick-chip" data-cmd="list stubble burning" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🌾 Stubble</button>
      <button type="button" class="agni-quick-chip" data-cmd="zoom to jamnagar" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">📍 Jamnagar</button>
      <button type="button" class="agni-quick-chip" data-cmd="simulate plume" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🔬 Plume Sim</button>
    </div>

    <style>
      @keyframes agniGlowPulse {
        0% { opacity: 0.5; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 16px #00d4ff; }
        100% { opacity: 0.5; transform: scale(0.9); }
      }
      @keyframes agniHudSlideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .agni-quick-chip:hover {
        background: rgba(0, 212, 255, 0.2) !important;
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

  const inputEl = hudElement.querySelector('#agni-voice-input');
  const sendBtn = hudElement.querySelector('#agni-send-btn');

  const submitInput = () => {
    const val = inputEl?.value?.trim();
    if (val) {
      inputEl.value = '';
      handleVoiceCommand(val.toLowerCase());
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
        handleVoiceCommand(cmd.toLowerCase());
      }
    });
  });
}

function startVoiceListening() {
  isListening = true;
  initLiveMicrophone();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const statusEl = hudElement?.querySelector('#agni-mic-status');
    const transcriptEl = hudElement?.querySelector('#agni-transcript');
    if (statusEl) {
      statusEl.textContent = "TYPE / CHIPS";
      statusEl.style.color = "#f59e0b";
    }
    if (transcriptEl) {
      transcriptEl.textContent = "Speech recognition unavailable. Click quick buttons or type below.";
    }
    return;
  }

  try {
    if (recognition) {
      try { recognition.stop(); } catch (err) {}
      recognition = null;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      const statusEl = hudElement?.querySelector('#agni-mic-status');
      if (statusEl) {
        statusEl.textContent = "LISTENING LIVE";
        statusEl.style.color = "#10b981";
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      const text = (final || interim).trim();
      const transcriptEl = hudElement?.querySelector('#agni-transcript');
      if (transcriptEl && text) {
        transcriptEl.innerHTML = `<span>"${text}"</span>`;
      }

      if (text) {
        handleVoiceCommand(text.toLowerCase());
      }
    };

    recognition.onerror = (e) => {
      console.warn('AGNI Voice Recognition Error:', e.error);
      if (e.error === 'not-allowed') {
        const statusEl = hudElement?.querySelector('#agni-mic-status');
        if (statusEl) {
          statusEl.textContent = "MIC BLOCKED";
          statusEl.style.color = "#ef4444";
        }
      }
    };

    recognition.onend = () => {
      if (isListening) {
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (isListening && recognition) {
            try { recognition.start(); } catch (err) {}
          }
        }, 300);
      }
    };

    recognition.start();
  } catch (err) {
    console.warn('SpeechRecognition initialization error:', err);
  }
}

function stopVoiceListening() {
  isListening = false;
  clearTimeout(restartTimeout);
  if (recognition) {
    try { recognition.stop(); } catch (err) {}
    recognition = null;
  }
  if (micStream) {
    try {
      micStream.getTracks().forEach((track) => track.stop());
    } catch (err) {}
    micStream = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

let lastCommandTime = 0;
let lastCommandText = '';

function handleVoiceCommand(cmd) {
  const now = Date.now();
  // Prevent rapid duplicate fire within 1.2s for identical command
  if (cmd === lastCommandText && now - lastCommandTime < 1200) {
    return;
  }

  const transcriptEl = hudElement?.querySelector('#agni-transcript');
  
  if (cmd.includes('mining') || cmd.includes('smelter') || cmd.includes('coal') || cmd.includes('mine') || cmd.includes('extraction')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('LIST_MINING', '⛏️ Opening Mining & Smelting Registry');
  } else if (cmd.includes('all target') || cmd.includes('all thermal') || cmd.includes('list all') || cmd.includes('registry') || cmd.includes('anomalies')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('LIST_ALL', '⚡ Opening Thermal Anomaly Intelligence Registry');
  } else if (cmd.includes('stubble') || cmd.includes('agri') || cmd.includes('crop') || cmd.includes('farm') || cmd.includes('paddy')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('LIST_AGRICULTURAL', '🌾 Opening Agricultural Stubble Registry');
  } else if (cmd.includes('wildfire') || cmd.includes('forest') || cmd.includes('timber') || cmd.includes('canopy')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('LIST_WILDFIRE', '🌲 Opening Forest Wildfire Registry');
  } else if (cmd.includes('refiner') || cmd.includes('steel') || cmd.includes('plant') || cmd.includes('industr')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('LIST_INDUSTRIAL', '🏭 Opening Industrial Facilities Registry');
  } else if (cmd.includes('flare') || cmd.includes('gas flare')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('SHOW_FLARES', '🔥 Filtered for Gas Flares');
  } else if (cmd.includes('jamnagar') || cmd.includes('gujarat')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('ZOOM_JAMNAGAR', '📍 Flying to Jamnagar Petrochemical Complex');
  } else if (cmd.includes('plume') || cmd.includes('dispersion')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('SIMULATE_PLUME', '🔬 Running Gaussian Plume Dispersion');
  } else if (cmd.includes('upload') || cmd.includes('csv') || cmd.includes('firms')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('OPEN_UPLOAD', '📁 Opening NASA FIRMS CSV Uploader');
  } else if (cmd.includes('lab') || cmd.includes('sandbox')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('OPEN_SIM_LAB', '🧪 Opening AI Simulation Lab');
  } else if (cmd.includes('dispatch') || cmd.includes('emergency') || cmd.includes('sms')) {
    lastCommandTime = now;
    lastCommandText = cmd;
    executeAction('DISPATCH_EMERGENCY', '🚨 Opening Emergency Dispatch Modal');
  } else {
    if (transcriptEl) {
      transcriptEl.innerHTML = `<span style="color: #94a3b8;">Heard: "${cmd}"</span>`;
    }
  }
}

function executeAction(action, feedback) {
  tacticalAudio.playAlert();
  const transcriptEl = hudElement?.querySelector('#agni-transcript');
  if (transcriptEl) {
    transcriptEl.innerHTML = `<span style="color: #34d399; font-weight: 800;">✅ ${feedback}</span>`;
  }
  const statusEl = hudElement?.querySelector('#agni-mic-status');
  if (statusEl) {
    statusEl.textContent = "COMMAND EXECUTED";
    statusEl.style.color = "#10b981";
  }

  // Stop microphone & speech recognition immediately to prevent repeating/looping
  stopVoiceListening();

  if (typeof commandCallback === 'function') {
    commandCallback(action);
  }

  // Auto-dismiss HUD after 650ms confirmation flash
  setTimeout(() => {
    closeVoiceHud();
  }, 650);
}

function initLiveMicrophone() {
  const canvas = hudElement?.querySelector('#agni-waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      micStream = stream;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioContext = new AudioContextClass();
          const source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
        }
      } catch (err) {
        console.warn('AudioContext setup warning:', err);
      }
    }).catch((err) => {
      console.warn('Microphone permission request error:', err);
    });
  }

  function renderWaveform() {
    if (!isListening) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numBars = 32;
    const barWidth = (canvas.width / numBars) - 3;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    if (analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
    }

    for (let i = 0; i < numBars; i++) {
      let height = 4;
      if (freqData && freqData.length > 0) {
        const binIndex = Math.min(i, freqData.length - 1);
        const val = freqData[binIndex] / 255;
        height = Math.max(4, val * (canvas.height - 6));
      } else {
        // Fallback smooth subtle wave
        const t = Date.now() * 0.004;
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
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, height, 2) : ctx.fillRect(x, y, barWidth, height);
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(renderWaveform);
  }

  renderWaveform();
}
