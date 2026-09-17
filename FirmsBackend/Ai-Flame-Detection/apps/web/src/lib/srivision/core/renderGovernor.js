/**
 * @module core/renderGovernor
 * @description Controls Cesium rendering frame rate to maintain high battery and GPU efficiency.
 */

export class RenderGovernor {
  constructor(viewer) {
    this.viewer = viewer;
    this.isRequestRenderMode = true;
    this.idleFrameRate = 10;
    this.activeFrameRate = 60;
  }

  enable() {
    if (this.viewer) {
      this.viewer.useDefaultRenderLoop = true;
      this.viewer.targetFrameRate = this.activeFrameRate;
    }
  }

  requestFrame() {
    if (this.viewer && this.isRequestRenderMode) {
      this.viewer.scene.requestRender();
    }
  }
}
