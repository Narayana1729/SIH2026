/**
 * Interactive NASA FIRMS CSV Drag-&-Drop Ingestion Modal
 * 
 * Allows users to drag-and-drop or select any NASA FIRMS CSV file
 * (VIIRS S-NPP, NOAA-20, NOAA-21, or MODIS NRT/Archive).
 * Automatically parses, classifies, solves Planck-Dozier pyrometry,
 * and renders into the active Cesium 3D scene.
 */

import { parseFirmsCsv } from '../../data/firmsCsv.js';
import { classifyThermalIncident } from '../../intelligence/thermalClassifier.js';
import { solveDozierPyrometry } from '../../disasters/pyrometry/dozierPyrometry.js';

let modalElement = null;
let onDataImportedCallback = null;

export function openFirmsUploadModal(onImported) {
  onDataImportedCallback = onImported;
  if (!modalElement) {
    createUploadModalDOM();
  }
  modalElement.style.display = 'flex';
}

export function closeFirmsUploadModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
  }
}

function createUploadModalDOM() {
  modalElement = document.createElement('div');
  modalElement.id = 'firms-upload-modal-container';
  modalElement.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(4, 9, 20, 0.85);
    backdrop-filter: blur(14px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
  `;

  modalElement.innerHTML = `
    <div style="
      background: linear-gradient(145deg, #091220, #040810);
      border: 1px solid rgba(168, 85, 247, 0.35);
      border-radius: 14px;
      width: 640px;
      max-width: 92vw;
      box-shadow: 0 25px 70px rgba(0,0,0,0.85), 0 0 50px rgba(168,85,247,0.15);
      padding: 24px;
    ">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; border-radius: 8px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🛰️
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #c084fc; letter-spacing: 0.5px;">NASA FIRMS CSV INGESTION</h2>
            <div style="font-size: 12px; color: #94a3b8;">Upload VIIRS 375m / MODIS 1km Active Fire Hotspot Datasets</div>
          </div>
        </div>
        <button id="upload-modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">✕</button>
      </div>

      <!-- Drop Zone -->
      <div id="csv-drop-zone" style="
        border: 2px dashed rgba(168, 85, 247, 0.4);
        border-radius: 12px;
        background: rgba(168, 85, 247, 0.04);
        padding: 36px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 18px;
      ">
        <div style="font-size: 36px; margin-bottom: 10px;">📥</div>
        <div style="font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px;">Drag & Drop NASA FIRMS CSV Here</div>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">or click to browse from your filesystem</div>
        <input type="file" id="csv-file-input" accept=".csv" style="display: none;" />
        <span style="
          display: inline-block;
          background: rgba(168, 85, 247, 0.2);
          border: 1px solid #a855f7;
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #e9d5ff;
        ">Select CSV File</span>
      </div>

      <!-- Format Compatibility Info -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; font-size: 12px; color: #94a3b8; margin-bottom: 16px;">
        <strong style="color: #cbd5e1;">Supported Standards:</strong> VIIRS I-Band (VNP14IMGTDL, VJ114IMGTDL), MODIS C6.1 (MOD14/MYD14). Columns parsed: <code style="color: #38bdf8;">latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, confidence, version, bright_ti5, frp, daynight</code>.
      </div>

      <!-- Ingestion Results Display -->
      <div id="upload-results" style="display: none; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 14px; font-size: 12px;">
        <div style="color: #34d399; font-weight: 700; margin-bottom: 4px;" id="upload-status-title">✓ Ingestion Complete</div>
        <div id="upload-status-body" style="color: #94a3b8; line-height: 1.5;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Close handlers
  modalElement.querySelector('#upload-modal-close-btn').addEventListener('click', closeFirmsUploadModal);
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) closeFirmsUploadModal();
  });

  const dropZone = modalElement.querySelector('#csv-drop-zone');
  const fileInput = modalElement.querySelector('#csv-file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#a855f7';
    dropZone.style.background = 'rgba(168, 85, 247, 0.12)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'rgba(168, 85, 247, 0.4)';
    dropZone.style.background = 'rgba(168, 85, 247, 0.04)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(168, 85, 247, 0.4)';
    dropZone.style.background = 'rgba(168, 85, 247, 0.04)';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  });
}

function processCsvFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const csvText = e.target.result;
    try {
      const records = parseFirmsCsv(csvText);
      if (!records || records.length === 0) {
        alert('No valid FIRMS thermal records detected in CSV file.');
        return;
      }

      // Process and classify all records
      let flareCount = 0;
      let wildfireCount = 0;
      let totalFrp = 0;

      const processedHazards = records.map((rec, i) => {
        const frp = rec.frp || 15;
        totalFrp += frp;
        const brightT4 = rec.bright_ti4 || 330;
        const brightT5 = rec.bright_ti5 || 295;
        
        // Solve Dozier Pyrometry
        const dozier = solveDozierPyrometry(brightT4, brightT5, frp);

        // Classify
        const classification = classifyThermalIncident({
          frp,
          bright_ti4: brightT4,
          bright_ti5: brightT5,
          daynight: rec.daynight || 'D',
          distKm: 15 // Default distance if facilities not queried
        }, []);

        if (classification.category?.includes('Flare')) {
          flareCount++;
        } else {
          wildfireCount++;
        }

        return {
          id: `custom-firms-${i}`,
          lat: rec.latitude,
          lon: rec.longitude,
          latitude: rec.latitude,
          longitude: rec.longitude,
          frp,
          brightness: brightT4,
          bright_ti4: brightT4,
          bright_ti5: brightT5,
          acq_date: rec.acq_date,
          acq_time: rec.acq_time,
          satellite: rec.satellite || 'VIIRS-NRT',
          daynight: rec.daynight,
          confidence: rec.confidence,
          category: classification.category || 'Thermal Hotspot',
          flameTempK: dozier.flameTempK,
          flameTempC: dozier.flameTempC,
          flameAreaM2: dozier.flameAreaM2,
          isCustomImport: true
        };
      });

      // Show summary results in modal
      const resultsDiv = modalElement.querySelector('#upload-results');
      const bodyDiv = modalElement.querySelector('#upload-status-body');
      resultsDiv.style.display = 'block';
      bodyDiv.innerHTML = `
        • <strong>${records.length} Hotspots Ingested</strong> from <code>${file.name}</code><br/>
        • <strong>${flareCount} Gas Flares</strong> | <strong>${wildfireCount} Wildfires / Biomass</strong><br/>
        • Cumulative Thermal Release: <strong>${Math.round(totalFrp)} MW</strong><br/>
        • Rendered into Cesium 3D Custom Layer.
      `;

      if (typeof onDataImportedCallback === 'function') {
        onDataImportedCallback(processedHazards);
      }
    } catch (err) {
      console.error('FIRMS CSV Parsing Error:', err);
      alert('Error parsing FIRMS CSV file: ' + err.message);
    }
  };
  reader.readAsText(file);
}
