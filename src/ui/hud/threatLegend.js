/**
 * @module ui/hud/threatLegend
 * @description Operational Threat Severity Matrix & Physics Legend for sriVision.
 * Provides explicit scientific color-tier definitions for Factor of Safety, Plume AEGL limits, and Surge Depths.
 */

export class ThreatLegend {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'sri-threat-legend';
    this.container.className = 'sri-threat-legend';
    document.body.appendChild(this.container);

    this.isExpanded = false;
    this._injectStyles();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="sri-legend-card ${this.isExpanded ? 'expanded' : 'collapsed'}">
        <div class="sri-legend-header" id="sri-legend-toggle">
          <span class="sri-legend-title">⚠️ THREAT MATRIX KEY</span>
          <span class="sri-legend-caret">${this.isExpanded ? '▼' : '▲'}</span>
        </div>
        ${this.isExpanded ? `
          <div class="sri-legend-body">
            <div class="sri-leg-row">
              <span class="sri-leg-dot crit"></span>
              <div class="sri-leg-desc">
                <strong>CRITICAL / RED</strong>
                <span>Industrial Fire / Explosion · FRP Surge &gt; 3x · Toxic IDLH</span>
              </div>
            </div>
            <div class="sri-leg-row">
              <span class="sri-leg-dot high"></span>
              <div class="sri-leg-desc">
                <strong>HIGH ALERT / ORANGE</strong>
                <span>Elevated Flaring · Active Wildfire · Toxic AEGL-2</span>
              </div>
            </div>
            <div class="sri-leg-row">
              <span class="sri-leg-dot mod"></span>
              <div class="sri-leg-desc">
                <strong>ADVISORY / YELLOW</strong>
                <span>Agricultural Burning / Stubble · Process Heat</span>
              </div>
            </div>
            <div class="sri-leg-row">
              <span class="sri-leg-dot norm"></span>
              <div class="sri-leg-desc">
                <strong>BASELINE / CYAN</strong>
                <span>Controlled Operational Heat · Normal Baseline</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('sri-legend-toggle')?.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      this.render();
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-legend-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-legend-styles';
    style.textContent = `
      #sri-threat-legend {
        position: absolute;
        bottom: 24px;
        left: 20px;
        z-index: 997;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
      }
      .sri-legend-card {
        background: var(--glass-bg, rgba(12, 14, 22, 0.88));
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        border-radius: var(--btn-radius, 8px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        color: var(--text-primary, #e8eaed);
        width: 260px;
        overflow: hidden;
        user-select: none;
      }
      .sri-legend-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.02);
      }
      .sri-legend-title {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--text-dim, rgba(232, 234, 237, 0.5));
        text-transform: uppercase;
      }
      .sri-legend-caret {
        font-size: 8px;
        color: var(--accent, #00d4ff);
      }
      .sri-legend-body {
        padding: 8px 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sri-leg-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .sri-leg-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        margin-top: 3px;
        flex-shrink: 0;
      }
      .sri-leg-dot.crit { background: #ff3344; box-shadow: 0 0 6px #ff3344; }
      .sri-leg-dot.high { background: #ff8800; box-shadow: 0 0 6px #ff8800; }
      .sri-leg-dot.mod  { background: #ffcc00; box-shadow: 0 0 6px #ffcc00; }
      .sri-leg-dot.norm { background: #00e5ff; box-shadow: 0 0 6px #00e5ff; }
      .sri-leg-desc {
        display: flex;
        flex-direction: column;
        font-size: 8px;
      }
      .sri-leg-desc strong {
        color: #fff;
        letter-spacing: 0.5px;
      }
      .sri-leg-desc span {
        color: var(--text-dim, rgba(232, 234, 237, 0.45));
        font-size: 7.5px;
        margin-top: 1px;
      }
    `;
    document.head.appendChild(style);
  }
}
