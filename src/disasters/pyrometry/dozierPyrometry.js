/**
 * Dozier Dual-Band Sub-Pixel Pyrometry Inversion
 * 
 * Based on Dozier (1981) sub-pixel thermal infrared radiance inversion:
 * Resolves sub-pixel true flame/flare temperature (T_flame) and combustion area (A_flame)
 * inside a single satellite pixel (e.g. 375m x 375m for VIIRS = 140,625 m²).
 * 
 * Planck's Law:
 *   B(lambda, T) = c1 / (lambda^5 * (exp(c2 / (lambda * T)) - 1))
 * 
 * Dual-Band Radiances:
 *   L_MIR = p * B(lambda_MIR, T_f) + (1 - p) * B(lambda_MIR, T_b)
 *   L_TIR = p * B(lambda_TIR, T_f) + (1 - p) * B(lambda_TIR, T_b)
 */

// Physical Constants
const C1 = 1.191042972e8; // W * um^4 / (m^2 * sr)
const C2 = 1.438777e4;    // um * K
const SIGMA_SB = 5.670374e-8; // Stefan-Boltzmann constant W/(m^2 * K^4)

// VIIRS I-Band Central Wavelengths (microns)
const LAMBDA_MIR = 3.74;  // I4 Band (Mid-Wave IR)
const LAMBDA_TIR = 11.45; // I5 Band (Thermal IR)

const PIXEL_AREA_M2 = 375 * 375; // VIIRS 375m nominal ground resolution = 140,625 m²

/**
 * Calculates spectral radiance via Planck's Law (W / (m² · sr · µm))
 */
export function planckRadiance(lambda, tempK) {
  if (tempK <= 0) return 0;
  const expTerm = Math.exp(C2 / (lambda * tempK)) - 1;
  if (expTerm <= 0) return 0;
  return C1 / (Math.pow(lambda, 5) * expTerm);
}

/**
 * Calculates brightness temperature from spectral radiance (Kelvin)
 */
export function planckInvTemp(lambda, radiance) {
  if (radiance <= 0) return 0;
  const val = (C1 / (Math.pow(lambda, 5) * radiance)) + 1;
  if (val <= 1) return 0;
  return C2 / (lambda * Math.log(val));
}

/**
 * Inverts Dozier equations using iterative Newton-Raphson / bounded bisection
 * to resolve sub-pixel flame temperature (T_f) and combustion area (A_f).
 * 
 * @param {number} brightTi4 - Measured brightness temperature in Band I4 / MIR (Kelvin)
 * @param {number} brightTi5 - Measured brightness temperature in Band I5 / TIR (Kelvin)
 * @param {number} frpMw - Fire Radiative Power (MW)
 * @returns {object} { flameTempK, flameTempC, flameAreaM2, backgroundTempK, radiantHeatFluxKwM2, regime }
 */
export function solveDozierPyrometry(brightTi4 = 340, brightTi5 = 295, frpMw = 15) {
  // Ensure valid temperatures
  let t4 = Math.max(brightTi4, 280);
  let t5 = Math.max(brightTi5, 270);
  
  // Estimate background temperature T_b from ambient TIR (usually slightly below t5)
  const tb = Math.min(t5 - 1.5, 300);
  
  // Measure observed spectral radiances
  const L_MIR_obs = planckRadiance(LAMBDA_MIR, t4);
  const L_TIR_obs = planckRadiance(LAMBDA_TIR, t5);
  
  const L_MIR_bg = planckRadiance(LAMBDA_MIR, tb);
  const L_TIR_bg = planckRadiance(LAMBDA_TIR, tb);
  
  // Numerical search for true flame temperature Tf in realistic combustion range [500K to 2200K]
  let bestTf = 950;
  let bestP = 0.0005;
  let minResidual = Infinity;
  
  for (let tf = 550; tf <= 2200; tf += 10) {
    const L_MIR_f = planckRadiance(LAMBDA_MIR, tf);
    const L_TIR_f = planckRadiance(LAMBDA_TIR, tf);
    
    // Solve fractional pixel area p from MIR equation
    const denomMIR = L_MIR_f - L_MIR_bg;
    if (denomMIR <= 0) continue;
    
    const p = (L_MIR_obs - L_MIR_bg) / denomMIR;
    if (p <= 0 || p > 1) continue;
    
    // Compute predicted TIR radiance for this (tf, p)
    const L_TIR_pred = p * L_TIR_f + (1 - p) * L_TIR_bg;
    const residual = Math.abs(L_TIR_pred - L_TIR_obs);
    
    if (residual < minResidual) {
      minResidual = residual;
      bestTf = tf;
      bestP = p;
    }
  }
  
  // Numerical bi-spectral inversion (Dozier 1981)
  // The solution (Tf, p) is determined purely by the minimum residual between predicted and observed TIR radiance.
  const deltaT = t4 - t5;
  const isHeuristicConstrained = false;
  
  const flameAreaM2 = Math.max(1.2, bestP * PIXEL_AREA_M2);
  const flameTempC = bestTf - 273.15;
  
  // Stefan-Boltzmann Radiant Heat Flux in kW/m²
  const radiantFluxKwM2 = (SIGMA_SB * Math.pow(bestTf, 4)) / 1000;
  
  // Determine combustion regime
  let regime = "Wildfire / Biomass Combustion";
  if (bestTf >= 1150 && flameAreaM2 <= 100) {
    regime = "Industrial High-Temp Gas Flare (Hydrocarbon)";
  } else if (bestTf >= 900 && flameAreaM2 <= 200) {
    regime = "Industrial Kiln / Point-Source Thermal Target";
  } else if (bestTf < 800) {
    regime = "Smoldering / Agricultural Stubble Residue";
  }
  
  // Perform sensitivity analysis over perturbation scenarios
  const sensitivity = computeDozierSensitivity(brightTi4, brightTi5, frpMw, { nominalTf: bestTf, nominalAf: flameAreaM2 });

  return {
    flameTempK: Math.round(bestTf),
    flameTempC: Math.round(flameTempC),
    flameAreaM2: Math.round(flameAreaM2 * 10) / 10,
    fractionalPixelArea: bestP,
    backgroundTempK: Math.round(tb * 10) / 10,
    radiantHeatFluxKwM2: Math.round(radiantFluxKwM2 * 10) / 10,
    regime,
    deltaT: Math.round(deltaT * 10) / 10,
    isHeuristicConstrained,
    inversionMethod: isHeuristicConstrained ? 'DOZIER_BISPECTRAL_WITH_FLARE_CONSTRAINT' : 'DOZIER_NUMERICAL_SEARCH',
    sensitivity_analysis: sensitivity,
  };
}

/**
 * Performs sensitivity analysis on Dozier sub-pixel inversion under systematic perturbation scenarios.
 *
 * Scenarios evaluated:
 *  - Background temperature Tb: ±2 K (regional climatological variability)
 *  - Brightness temperatures T4 and T5: ±1 K as sensitivity scenarios (sensor radiometric variation)
 *
 * @param {number} brightTi4 - MIR brightness temperature (K)
 * @param {number} brightTi5 - TIR brightness temperature (K)
 * @param {number} frpMw - Fire Radiative Power (MW)
 * @param {object} [options]
 * @returns {object} Sensitivity metrics, bounding intervals, and evaluated perturbation scenarios
 */
export function computeDozierSensitivity(brightTi4 = 340, brightTi5 = 295, frpMw = 15, options = {}) {
  const perturbations = [
    { name: 'Nominal', dt4: 0, dt5: 0, dtb: 0 },
    { name: 'T4_plus_1K', dt4: +1, dt5: 0, dtb: 0 },
    { name: 'T4_minus_1K', dt4: -1, dt5: 0, dtb: 0 },
    { name: 'T5_plus_1K', dt4: 0, dt5: +1, dtb: 0 },
    { name: 'T5_minus_1K', dt4: 0, dt5: -1, dtb: 0 },
    { name: 'Tb_plus_2K', dt4: 0, dt5: 0, dtb: +2 },
    { name: 'Tb_minus_2K', dt4: 0, dt5: 0, dtb: -2 },
    { name: 'Extreme_High_Contrast', dt4: +1, dt5: -1, dtb: -2 },
    { name: 'Extreme_Low_Contrast', dt4: -1, dt5: +1, dtb: +2 },
  ];

  const results = [];

  for (const p of perturbations) {
    const t4_pert = Math.max(brightTi4 + p.dt4, 280);
    const t5_pert = Math.max(brightTi5 + p.dt5, 270);
    const tb_pert = Math.min(t5_pert - 1.5 + p.dtb, 305);

    const L_MIR_obs = planckRadiance(LAMBDA_MIR, t4_pert);
    const L_TIR_obs = planckRadiance(LAMBDA_TIR, t5_pert);
    const L_MIR_bg = planckRadiance(LAMBDA_MIR, tb_pert);
    const L_TIR_bg = planckRadiance(LAMBDA_TIR, tb_pert);

    let bestTf = options.nominalTf || 950;
    let bestP = 0.0005;
    let minRes = Infinity;

    for (let tf = 550; tf <= 2200; tf += 15) {
      const L_MIR_f = planckRadiance(LAMBDA_MIR, tf);
      const L_TIR_f = planckRadiance(LAMBDA_TIR, tf);
      const denom = L_MIR_f - L_MIR_bg;
      if (denom <= 0) continue;

      const frac = (L_MIR_obs - L_MIR_bg) / denom;
      if (frac <= 0 || frac > 1) continue;

      const predTIR = frac * L_TIR_f + (1 - frac) * L_TIR_bg;
      const res = Math.abs(predTIR - L_TIR_obs);
      if (res < minRes) {
        minRes = res;
        bestTf = tf;
        bestP = frac;
      }
    }

    const areaM2 = Math.max(1.2, bestP * PIXEL_AREA_M2);
    results.push({
      scenario: p.name,
      t4_k: t4_pert,
      t5_k: t5_pert,
      tb_k: tb_pert,
      flame_temp_k: Math.round(bestTf),
      flame_area_m2: Math.round(areaM2 * 10) / 10,
    });
  }

  const temps = results.map((r) => r.flame_temp_k);
  const areas = results.map((r) => r.flame_area_m2);

  const minTempK = Math.min(...temps);
  const maxTempK = Math.max(...temps);
  const deltaTempK = maxTempK - minTempK;

  const minAreaM2 = Math.min(...areas);
  const maxAreaM2 = Math.max(...areas);
  const deltaAreaM2 = Math.round((maxAreaM2 - minAreaM2) * 10) / 10;

  let conditionStability = 'STABLE';
  if (deltaTempK > 180 || deltaAreaM2 > 50) {
    conditionStability = 'HIGH_SENSITIVITY';
  } else if (deltaTempK > 80 || deltaAreaM2 > 20) {
    conditionStability = 'MODERATE_SENSITIVITY';
  }

  return {
    method: 'PERTURBATION_SCENARIO_ANALYSIS',
    condition_stability: conditionStability,
    temperature_interval_k: {
      min: minTempK,
      max: maxTempK,
      delta_k: deltaTempK,
    },
    area_interval_m2: {
      min: minAreaM2,
      max: maxAreaM2,
      delta_m2: deltaAreaM2,
    },
    scenarios_evaluated: results.length,
    scenarios: results,
  };
}
