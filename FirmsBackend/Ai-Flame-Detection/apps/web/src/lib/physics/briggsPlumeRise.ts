/**
 * Briggs (1969/1975) Convective Plume Rise & Fumigation Dynamics.
 * 
 * Provides rigorous aerodynamic and thermodynamic modeling for thermal plumes,
 * computing buoyant convective flux Fb, final plume rise Delta-H, effective
 * release height Heff, and downwind ground touchdown distance.
 */

import type { ThermalEvent } from '../../types/event.ts';
import type { AtmosphericStabilityClass, BriggsPlumeRiseResult } from '../../types/plumeRise.ts';

export interface PlumeRiseParameters {
  frpMw?: number;
  windSpeedMs?: number;
  ambientTempK?: number;
  physicalStackHeightM?: number;
  stabilityClass?: AtmosphericStabilityClass;
  isIndustrial?: boolean;
}

const STABILITY_LABELS: Record<AtmosphericStabilityClass, string> = {
  A: "Very Unstable (Strong Convective Mixing)",
  B: "Moderately Unstable",
  C: "Slightly Unstable",
  D: "Neutral (Overcast / High Wind)",
  E: "Slightly Stable (Nighttime Inversion)",
  F: "Moderately Stable (Surface Inversion)",
};

const STABILITY_TOUCHDOWN_MULTIPLIER: Record<AtmosphericStabilityClass, number> = {
  A: 6.5,
  B: 10.0,
  C: 14.5,
  D: 18.0,
  E: 28.0,
  F: 40.0,
};

/**
 * Calculates convective plume rise according to the classical Briggs formulations
 * adopted by US EPA (ISC3, AERMOD) and international atmospheric dispersion standards.
 */
export function calculateBriggsPlumeRise(
  event?: ThermalEvent | null,
  params?: PlumeRiseParameters
): BriggsPlumeRiseResult {
  const frpMw = Math.max(0.1, params?.frpMw ?? event?.frp_mw ?? 15.0);
  const windSpeedMs = Math.max(1.0, params?.windSpeedMs ?? 3.5);
  const ambientTempK = Math.max(250.0, params?.ambientTempK ?? 298.15);
  const isIndustrial = params?.isIndustrial ?? (event?.classification === "INDUSTRIAL");
  
  // Physical release height: flare stacks typically 25-45m; wildfires ground level 2m
  const physicalStackHeightM = params?.physicalStackHeightM ?? (isIndustrial ? 32.0 : 2.0);
  const stabilityClass: AtmosphericStabilityClass = params?.stabilityClass ?? (isIndustrial ? "D" : "C");

  // 1. Convective Buoyancy Flux Fb (m^4 / s^3)
  // Briggs empirical formulation: Fb = 8.79e-6 * Q_H (Watts)
  // For thermal flares/hotspots, Q_H in Watts = frpMw * 1e6
  const convectiveHeatFluxFbM4s3 = Number((8.79 * frpMw).toFixed(2));

  // 2. Compute plume rise based on stability regime
  let plumeRiseDeltaHM = 0;
  let neutralTransitionDistanceXfM = 0;

  if (stabilityClass === "A" || stabilityClass === "B" || stabilityClass === "C" || stabilityClass === "D") {
    // Neutral or Unstable Regime (Briggs 1969, 1975)
    if (convectiveHeatFluxFbM4s3 < 55.0) {
      neutralTransitionDistanceXfM = 21.425 * Math.pow(convectiveHeatFluxFbM4s3, 0.75);
    } else {
      neutralTransitionDistanceXfM = 34.0 * Math.pow(convectiveHeatFluxFbM4s3, 0.4);
    }

    // Final plume rise: Delta h = 1.6 * Fb^(1/3) * x_f^(2/3) / u
    const deltaH = (1.6 * Math.cbrt(convectiveHeatFluxFbM4s3) * Math.pow(neutralTransitionDistanceXfM, 2 / 3)) / windSpeedMs;
    plumeRiseDeltaHM = Number(deltaH.toFixed(1));
  } else {
    // Stable Regime (Classes E & F)
    // Buoyancy frequency parameter s = (g / T_a) * (dTheta / dz)
    const dThetaDz = stabilityClass === "E" ? 0.005 : 0.02; // K/m potential temperature gradient
    const g = 9.81;
    const s = (g / ambientTempK) * dThetaDz;

    // Stable wind formula: Delta h = 2.6 * (Fb / (u * s))^(1/3)
    const deltaHWind = 2.6 * Math.cbrt(convectiveHeatFluxFbM4s3 / (windSpeedMs * s));

    // Stable calm formula: Delta h = 5.0 * Fb^(1/4) / s^(3/8)
    const deltaHCalm = (5.0 * Math.pow(convectiveHeatFluxFbM4s3, 0.25)) / Math.pow(s, 0.375);

    plumeRiseDeltaHM = Number(Math.min(deltaHWind, deltaHCalm).toFixed(1));
    neutralTransitionDistanceXfM = Number((Math.PI * windSpeedMs * Math.pow(s, -0.5)).toFixed(1));
  }

  // 3. Effective Release Height Heff = hs + Delta h
  const effectiveReleaseHeightHeffM = Number((physicalStackHeightM + plumeRiseDeltaHM).toFixed(1));

  // 4. Downwind Ground Touchdown Distance
  // Distance where plume vertical dispersion sigma_z intersects ground level
  const touchdownMult = STABILITY_TOUCHDOWN_MULTIPLIER[stabilityClass] ?? 18.0;
  const downwindTouchdownDistanceM = Math.round(effectiveReleaseHeightHeffM * touchdownMult);

  // 5. Maximum Ground-level Concentration Factor (relative scale)
  // Scaled inversely with wind speed and square of effective height (Gaussian peak at x_max)
  const rawConcFactor = (frpMw * 1000) / (windSpeedMs * Math.pow(Math.max(20, effectiveReleaseHeightHeffM), 1.8));
  const maxGroundConcentrationFactorPpm = Number(rawConcFactor.toFixed(3));

  // 6. Fumigation Risk Assessment
  // Fumigation occurs when a buoyant aloft plume is entrapped by expanding convective boundary layer
  // or downward downdrafts in unstable/sheared wind conditions
  const isBuoyancyDominated = convectiveHeatFluxFbM4s3 >= 15.0;
  const fumigationRisk = (stabilityClass === "A" || stabilityClass === "B") && (windSpeedMs > 4.5 || frpMw > 80.0);

  let fumigationExplanation = "Buoyant plume stabilizes aloft in laminar stratospheric boundary layer.";
  if (fumigationRisk) {
    fumigationExplanation = "CRITICAL FUMIGATION WARNING: Strong thermal turbulence or shear forcing high-altitude plume rapidly downward to surface level.";
  } else if (isBuoyancyDominated) {
    fumigationExplanation = `Strong buoyancy lift (+${plumeRiseDeltaHM}m) clears local surface boundary; initial ground touchdown delayed to ${downwindTouchdownDistanceM}m downwind.`;
  }

  return {
    physicalStackHeightM,
    convectiveHeatFluxFbM4s3,
    plumeRiseDeltaHM,
    effectiveReleaseHeightHeffM,
    stabilityClass,
    stabilityLabel: STABILITY_LABELS[stabilityClass],
    downwindTouchdownDistanceM,
    maxGroundConcentrationFactorPpm,
    fumigationRisk,
    fumigationExplanation,
    isBuoyancyDominated,
    neutralTransitionDistanceXfM: Number(neutralTransitionDistanceXfM.toFixed(1)),
  };
}
