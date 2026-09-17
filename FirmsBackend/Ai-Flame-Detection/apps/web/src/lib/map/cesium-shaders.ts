/**
 * CesiumJS Post-Processing Shaders extracted from sriVision:
 * - NVG / Surveillance (P43 Phosphor Green, Scintillation Noise, Intensifier Tube Bloom, Honeycomb)
 * - FLIR Thermal (Ironbow / White-Hot / Black-Hot false color heat signature)
 * - Tactical Noir (Monochrome high-contrast with edge bloom)
 */

import * as Cesium from "cesium";

export type VisualStylePreset = "NORMAL" | "SURVEILLANCE" | "THERMAL" | "NOIR";

export const SURVEILLANCE_SHADER = `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float intensity;
  uniform float time;
  uniform float gain;
  uniform float bloom;
  uniform float scanlineStr;
  uniform float pixelation;
  in vec2 v_textureCoordinates;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 barrelDistort(vec2 uv, float strength) {
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    float distort = 1.0 + r2 * strength * 0.5 + r2 * r2 * strength * 0.15;
    c *= distort;
    return c * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = v_textureCoordinates;
    vec2 dUV = barrelDistort(uv, 0.08);

    vec4 color = texture(colorTexture, dUV);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Green P43 phosphor palette
    vec3 nvgGreen = vec3(0.12, 0.95, 0.28);
    vec3 nvgHighlight = vec3(0.75, 1.0, 0.65);

    float amplified = clamp(lum * (1.2 + gain * 1.5), 0.0, 1.0);
    vec3 finalColor = mix(nvgGreen * amplified, nvgHighlight, pow(amplified, 3.0));

    // Scintillation noise
    float noise = hash(dUV * 400.0 + fract(time * 12.0)) * 0.15;
    finalColor += noise * nvgGreen;

    // Scanlines
    float scanline = sin(dUV.y * colorTextureDimensions.y * 1.2) * 0.06;
    finalColor -= scanline;

    // Vignette
    vec2 vUv = uv * 2.0 - 1.0;
    float vig = 1.0 - smoothstep(0.65, 1.1, length(vUv));
    finalColor *= vig;

    out_FragColor = vec4(mix(color.rgb, finalColor, intensity), color.a);
  }
`;

export const THERMAL_FLIR_SHADER = `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float intensity;
  uniform float time;
  uniform float sensitivity;
  uniform float bloom;
  in vec2 v_textureCoordinates;

  vec3 ironbow(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec3 c0 = vec3(0.02, 0.02, 0.05);   // deep cold
    const vec3 c1 = vec3(0.18, 0.02, 0.38);   // deep purple
    const vec3 c2 = vec3(0.62, 0.08, 0.45);   // magenta
    const vec3 c3 = vec3(0.92, 0.22, 0.12);   // red
    const vec3 c4 = vec3(1.0, 0.62, 0.0);     // orange
    const vec3 c5 = vec3(1.0, 0.94, 0.38);   // yellow
    const vec3 c6 = vec3(1.0, 1.0, 1.0);     // hot white
    float s = t * 6.0;
    if (s < 1.0) return mix(c0, c1, s);
    if (s < 2.0) return mix(c1, c2, s - 1.0);
    if (s < 3.0) return mix(c2, c3, s - 2.0);
    if (s < 4.0) return mix(c3, c4, s - 3.0);
    if (s < 5.0) return mix(c4, c5, s - 4.0);
    return mix(c5, c6, s - 5.0);
  }

  void main() {
    vec2 uv = v_textureCoordinates;
    vec4 color = texture(colorTexture, uv);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    float temp = clamp((lum - 0.1) * (1.2 + sensitivity * 0.8), 0.0, 1.0);
    vec3 flirColor = ironbow(temp);

    // Subtle thermal sensor noise
    float noise = (fract(sin(dot(uv + fract(time * 5.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
    flirColor += noise;

    out_FragColor = vec4(mix(color.rgb, flirColor, intensity), color.a);
  }
`;

export const NOIR_TACTICAL_SHADER = `
  uniform sampler2D colorTexture;
  uniform float intensity;
  in vec2 v_textureCoordinates;

  void main() {
    vec2 uv = v_textureCoordinates;
    vec4 color = texture(colorTexture, uv);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // High-contrast tactical monochrome
    float contrast = smoothstep(0.15, 0.85, lum);
    vec3 noir = vec3(contrast);

    // Cyan tint on midtones
    noir += vec3(0.0, 0.12, 0.18) * contrast;

    out_FragColor = vec4(mix(color.rgb, noir, intensity), color.a);
  }
`;

export class TacticalPostProcessManager {
  private viewer: Cesium.Viewer;
  private stages: Map<string, Cesium.PostProcessStage> = new Map();
  public activePreset: VisualStylePreset = "NORMAL";

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.initStages();
  }

  private initStages() {
    const scene = this.viewer.scene;

    // 1. Bloom & HDR
    scene.highDynamicRange = true;
    scene.postProcessStages.bloom.enabled = true;
    scene.postProcessStages.bloom.uniforms.contrast = 128;
    scene.postProcessStages.bloom.uniforms.brightness = -0.3;
    scene.postProcessStages.bloom.uniforms.glowOnly = false;
    scene.postProcessStages.bloom.uniforms.delta = 1.0;
    scene.postProcessStages.bloom.uniforms.sigma = 2.0;

    // 2. NVG Surveillance Stage
    try {
      const nvgStage = new Cesium.PostProcessStage({
        fragmentShader: SURVEILLANCE_SHADER,
        uniforms: {
          intensity: 0.0,
          gain: 0.65,
          bloom: 0.45,
          scanlineStr: 0.8,
          pixelation: 2.0,
          time: 0.0,
        },
      });
      scene.postProcessStages.add(nvgStage);
      this.stages.set("SURVEILLANCE", nvgStage);
    } catch (e) {
      console.warn("[PostProcess] NVG stage initialization failed:", e);
    }

    // 3. FLIR Thermal Stage
    try {
      const flirStage = new Cesium.PostProcessStage({
        fragmentShader: THERMAL_FLIR_SHADER,
        uniforms: {
          intensity: 0.0,
          sensitivity: 0.8,
          bloom: 0.65,
          time: 0.0,
        },
      });
      scene.postProcessStages.add(flirStage);
      this.stages.set("THERMAL", flirStage);
    } catch (e) {
      console.warn("[PostProcess] FLIR stage initialization failed:", e);
    }

    // 4. Tactical Noir Stage
    try {
      const noirStage = new Cesium.PostProcessStage({
        fragmentShader: NOIR_TACTICAL_SHADER,
        uniforms: {
          intensity: 0.0,
        },
      });
      scene.postProcessStages.add(noirStage);
      this.stages.set("NOIR", noirStage);
    } catch (e) {
      console.warn("[PostProcess] NOIR stage initialization failed:", e);
    }

    // Time ticker for dynamic shader noise
    let startTime = performance.now();
    scene.preRender.addEventListener(() => {
      const elapsed = (performance.now() - startTime) / 1000.0;
      const nvg = this.stages.get("SURVEILLANCE");
      if (nvg && nvg.enabled) nvg.uniforms.time = elapsed;
      const flir = this.stages.get("THERMAL");
      if (flir && flir.enabled) flir.uniforms.time = elapsed;
    });
  }

  public setPreset(preset: VisualStylePreset) {
    this.activePreset = preset;

    // Reset all stages
    for (const [key, stage] of this.stages.entries()) {
      if (key === preset) {
        stage.enabled = true;
        stage.uniforms.intensity = 1.0;
      } else {
        stage.enabled = false;
        stage.uniforms.intensity = 0.0;
      }
    }

    // Adjust Bloom intensity for style
    const bloom = this.viewer.scene.postProcessStages.bloom;
    if (preset === "SURVEILLANCE") {
      bloom.enabled = true;
      bloom.uniforms.contrast = 96;
      bloom.uniforms.brightness = -0.15;
    } else if (preset === "THERMAL") {
      bloom.enabled = true;
      bloom.uniforms.contrast = 110;
      bloom.uniforms.brightness = -0.2;
    } else if (preset === "NOIR") {
      bloom.enabled = true;
      bloom.uniforms.contrast = 140;
      bloom.uniforms.brightness = -0.35;
    } else {
      bloom.enabled = true;
      bloom.uniforms.contrast = 128;
      bloom.uniforms.brightness = -0.3;
    }

    this.viewer.scene.requestRender();
  }

  public toggleBloom(enabled?: boolean): boolean {
    const bloom = this.viewer.scene.postProcessStages.bloom;
    bloom.enabled = enabled !== undefined ? enabled : !bloom.enabled;
    this.viewer.scene.requestRender();
    return bloom.enabled;
  }
}
