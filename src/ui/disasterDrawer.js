/**
 * @module ui/disasterDrawer
 * @description Layer switch drawer for toggling Wildfires, Earthquakes, Weather, Forest, and Satellites.
 */

export class DisasterDrawer {
  constructor(appState, layerManagers) {
    this.appState = appState;
    this.layers = layerManagers;
    this.initToggles();
  }

  initToggles() {
    const toggles = [
      { id: 'toggle-wildfire', key: 'wildfire', manager: this.layers.wildfire },
      { id: 'toggle-earthquake', key: 'earthquakes', manager: this.layers.earthquakes },
      { id: 'toggle-weather', key: 'weather', manager: this.layers.weather },
      { id: 'toggle-forest', key: 'forest', manager: this.layers.forest },
      { id: 'toggle-satellites', key: 'satellites', manager: this.layers.satellites },
    ];

    for (const t of toggles) {
      const el = document.getElementById(t.id);
      if (el) {
        el.checked = this.appState.getLayerState(t.key);
        el.addEventListener('change', (e) => {
          const checked = e.target.checked;
          this.appState.setLayerState(t.key, checked);
          if (t.manager?.setVisible) {
            t.manager.setVisible(checked);
          }
        });
      }
    }
  }
}
