/**
 * @module ui/timeline
 * @description 24-hour temporal playback control for historical disaster playback.
 */

export class TimelineController {
  constructor(viewer) {
    this.viewer = viewer;
    this.sliderEl = document.getElementById('timeline-slider');
    this.labelEl = document.getElementById('timeline-label');
    this.init();
  }

  init() {
    if (this.sliderEl) {
      this.sliderEl.addEventListener('input', (e) => {
        const hoursAgo = 24 - Number(e.target.value);
        if (this.labelEl) {
          this.labelEl.textContent = hoursAgo === 0 ? 'LIVE (Trailing 24h)' : `T - ${hoursAgo}h`;
        }
      });
    }
  }
}
