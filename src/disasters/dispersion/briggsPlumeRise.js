/**
 * @module src/disasters/dispersion/briggsPlumeRise
 * @description Briggs (1969/1975) Convective Plume Rise & Fumigation Dynamics.
 *
 * Provides aerodynamic and thermodynamic modeling for thermal plumes,
 * computing buoyant convective flux Fb, final plume rise Delta-H, effective
 * release height Heff, and downwind ground touchdown distance.
 * Implements formulations adopted by US EPA (ISC3, AERMOD) and atmospheric dispersion standards.
 */

export const STABILITY_LABELS = Object.freeze({
  A: 'Very Unstable (Strong Convective Mixing)',
  B: 'Moderately Unstable',
  C: 'Slightly Unstable',
  D: 'Neutral (Overcast / High Wind)',
  E: 'Slightly Stable (Nighttime Inversion)',
  F: 'Moderately Stable (Surface Inversion)',
});

export const STABILITY_TOUCHDOWN_MULTIPLIER = Object.freeze({
  A: 6.5,
  B: 10.0,
  C: 14.5,
  D: 18.0,
  E: 28.0,
  F: 40.0,
});

/**
 * Calculates convective plume rise according to the classical Briggs formulations.
 *
 * @param {object} [event] - Optional thermal event object
 * @param {object} [params] - Overriding parameters
 * @param {number} [params.frpMw] - Fire Radiative Power in MW
 * @param {number} [params.windSpeedMs] - Wind velocity in m/s
 * @param {number} [params.ambientTempK] - Ambient temperature in Kelvin
 * @param {number} [params.physicalStackHeightM] - Physical release/stack height in meters
 * @param {string} [params.stabilityClass] - 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
 * @param {boolean} [params.isIndustrial] - True if industrial flare/stack vs ground wildfire
 * @returns {object} Full Briggs plume rise calculation result
 */
export function calculateBriggsPlumeRise(event = null, params = {}) {
  const frpMw = Math.max(0.1, Number(params.frpMw ?? event?.frp_mw ?? event?.frp ?? 15.0));
  const windSpeedMs = Math.max(0.5, Number(params.windSpeedMs ?? params.windSpeed ?? event?.windSpeed ?? 3.5));
  const ambientTempK = Math.max(250.0, Number(params.ambientTempK ?? params.temperatureK ?? 298.15));
  const isIndustrial = Boolean(
    params.isIndustrial ??
    (event?.classification === 'INDUSTRIAL' || event?.isIndustrial || event?.category?.includes('INDUSTRIAL'))
  );

  // Physical release height: industrial flare stacks typically 25-45m; wildfires at ground level 2m
  const physicalStackHeightM = Number(params.physicalStackHeightM ?? (isIndustrial ? 32.0 : 2.0));
  const stabilityClass = String(params.stabilityClass ?? (isIndustrial ? 'D' : 'C')).toUpperCase();
  const validStability = ['A', 'B', 'C', 'D', 'E', 'F'].includes(stabilityClass) ? stabilityClass : 'D';

  // 1. Convective Buoyancy Flux Fb (m^4 / s^3)
  // Briggs empirical formulation: Fb = 8.79e-6 * Q_H (Watts)
  // For thermal flares/hotspots, Q_H in Watts = frpMw * 1e6
  const convectiveHeatFluxFbM4s3 = Number((8.79 * frpMw).toFixed(2));

  let plumeRiseDeltaHM = 0;
  let neutralTransitionDistanceXfM = 0;

  // 2. Regime Partition: Neutral/Unstable (A-D) vs Stable (E-F)
  if (['A', 'B', 'C', 'D'].includes(validStability)) {
    // Transition distance Xf (distance to final plume rise)
    if (convectiveHeatFluxFbM4s3 < 55.0) {
      neutralTransitionDistanceXfM = 2.16 * Math.pow(convectiveHeatFluxFbM4s3, 0.4) * Math.pow(physicalStackHeightM, 0.6);
    } else {
      neutralTransitionDistanceXfM = 3.38 * Math.pow(convectiveHeatFluxFbM4s3, 0.4);
    }

    // Briggs 2/3 Law for neutral/convective plume rise
    const deltaH = (1.6 * Math.cbrt(convectiveHeatFluxFbM4s3) * Math.pow(neutralTransitionDistanceXfM, 2 / 3)) / windSpeedMs;
    plumeRiseDeltaHM = Number(deltaH.toFixed(1));
  } else {
    // Stable Regime (Classes E & F)
    // Buoyancy frequency parameter s = (g / T_a) * (dTheta / dz)
    const dThetaDz = validStability === 'E' ? 0.005 : 0.02; // K/m potential temperature gradient
    const g = 9.81;
    const s = Math.max(1e-5, (g / ambientTempK) * dThetaDz);

    // Stable wind formula: Delta h = 2.6 * (Fb / (u * s))^(1/3)
    const deltaHWind = 2.6 * Math.cbrt(convectiveHeatFluxFbM4s3 / (windSpeedMs * s));

    // Stable calm formula: Delta h = 5.0 * Fb^(1/4) / s^(3/8)
    const deltaHCalm = (5.0 * Math.pow(convectiveHeatFluxFbM4s3, 0.25)) / Math.pow(s, 0.375);

    plumeRiseDeltaHM = Number(Math.min(deltaHWind, deltaHCalm).toFixed(1));
    neutralTransitionDistanceXfM = Number((Math.PI * windSpeedMs * Math.pow(s, -0.5)).toFixed(1));
  }

  // 3. Effective Release Height Heff = Hs + Delta h
  const effectiveReleaseHeightHeffM = Number((physicalStackHeightM + plumeRiseDeltaHM).toFixed(1));

  // 4. Downwind Ground Touchdown Distance
  const touchdownMult = STABILITY_TOUCHDOWN_MULTIPLIER[validStability] ?? 18.0;
  const downwindTouchdownDistanceM = Math.round(effectiveReleaseHeightHeffM * touchdownMult);

  // 5. Maximum Ground-level Concentration Factor (relative scale)
  const rawConcFactor = (frpMw * 1000) / (windSpeedMs * Math.pow(Math.max(20, effectiveReleaseHeightHeffM), 1.8));
  const maxGroundConcentrationFactorPpm = Number(rawConcFactor.toFixed(3));

  // 6. Fumigation Risk Assessment
  const isBuoyancyDominated = convectiveHeatFluxFbM4s3 >= 15.0;
  const fumigationRisk = (validStability === 'A' || validStability === 'B') && (windSpeedMs > 4.5 || frpMw > 80.0);

  let fumigationExplanation = 'Buoyant plume stabilizes aloft in laminar atmospheric boundary layer.';
  if (fumigationRisk) {
    fumigationExplanation = 'CRITICAL FUMIGATION WARNING: Strong thermal turbulence or wind shear forcing high-altitude plume rapidly downward to ground level.';
  } else if (isBuoyancyDominated) {
    fumigationExplanation = `Strong buoyancy lift (+${plumeRiseDeltaHM}m) clears local surface boundary; initial ground touchdown delayed to ${downwindTouchdownDistanceM}m downwind.`;
  }

  return {
    physicalStackHeightM,
    convectiveHeatFluxFbM4s3,
    plumeRiseDeltaHM,
    effectiveReleaseHeightHeffM,
    stabilityClass: validStability,
    stabilityLabel: STABILITY_LABELS[validStability],
    downwindTouchdownDistanceM,
    maxGroundConcentrationFactorPpm,
    fumigationRisk,
    fumigationExplanation,
    isBuoyancyDominated,
    neutralTransitionDistanceXfM: Number(neutralTransitionDistanceXfM.toFixed(1)),
  };
}
