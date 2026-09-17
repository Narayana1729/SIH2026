/**
 * @module ui/incidentPanel
 * @description Priority Incident Queue panel displaying multi-source correlated alerts, contributing factors, and operator actions.
 */

import * as Cesium from 'cesium';

export class IncidentPanel {
  constructor(viewer, appState) {
    this.viewer = viewer;
    this.appState = appState;
    this.containerEl = document.getElementById('incident-list');
    this.dossierEl = document.getElementById('incident-dossier');

    this.appState.subscribe((event, data) => {
      if (event === 'alertsUpdate') {
        this.renderAlerts(data);
      }
      if (event === 'incidentSelect') {
        this.renderDossier(data);
      }
    });
  }

  renderAlerts(alerts = []) {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    if (alerts.length === 0) {
      this.containerEl.innerHTML = '<div class="empty-state">No active critical incidents detected.</div>';
      return;
    }

    for (const alert of alerts) {
      const card = document.createElement('div');
      card.className = `incident-card severity-${alert.severity.toLowerCase()}`;
      card.innerHTML = `
        <div class="incident-header">
          <span class="severity-badge ${alert.severity.toLowerCase()}">${alert.severity}</span>
          <span class="incident-title">${alert.title}</span>
        </div>
        <div class="incident-meta">
          <span>📍 ${alert.place}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.appState.setSelectedIncident(alert);
        if (alert.location?.lat && alert.location?.lon) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(alert.location.lon, alert.location.lat, 250000.0),
            duration: 2.0,
          });
        }
      });

      this.containerEl.appendChild(card);
    }
  }

  renderDossier(incident) {
    if (!this.dossierEl) return;
    if (!incident) {
      this.dossierEl.innerHTML = '<div class="empty-state">Select an incident to view situational assessment dossier.</div>';
      return;
    }

    const d = incident.details || incident;
    const factors = d.contributing_factors || [];
    const prov = d.provenance || {};

    let factorsHtml = '';
    if (factors.length > 0) {
      factorsHtml = `
        <div class="dossier-section">
          <h4>Contributing Risk Factors</h4>
          <ul class="factor-list">
            ${factors.map((f) => `<li><strong>${f.factor || f.feature}:</strong> ${f.value || ''} (${f.impact || ''})</li>`).join('')}
          </ul>
        </div>
      `;
    }

    this.dossierEl.innerHTML = `
      <div class="dossier-content">
        <div class="dossier-header">
          <h3>${incident.title || 'Incident Dossier'}</h3>
          <span class="severity-badge ${incident.severity.toLowerCase()}">${incident.severity}</span>
        </div>
        <p class="dossier-recommendation"><strong>Operator Recommendation:</strong> ${incident.recommendation || d.operator_action || 'Ground verification recommended.'}</p>
        ${factorsHtml}
        <div class="dossier-section provenance">
          <h4>Data Provenance</h4>
          <p><strong>Source:</strong> ${prov.source || 'sriVision Ingestion Engine'}</p>
          <p><strong>Confidence Basis:</strong> ${prov.confidence_basis || 'Heuristic Scoring'}</p>
          <p class="limitations-note"><em>Caveats: ${(prov.scientific_limitations || []).join(' ')}</em></p>
        </div>
      </div>
    `;
  }
}
