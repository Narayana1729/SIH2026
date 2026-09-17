/**
 * @module environmental/forest/vegetation/forestVegetation
 * @description Vegetation health categorization and multi-spectral change classification.
 */

import {
  clampIndex,
  computeNdvi,
  computeNdmi,
  computeNbr,
  computeEvi,
  computeSavi,
  calculateNDVI,
  calculateNDMI,
  calculateNBR,
} from './vegetationIndices.js';

export {
  clampIndex,
  computeNdvi,
  computeNdmi,
  computeNbr,
  computeEvi,
  computeSavi,
  calculateNDVI,
  calculateNDMI,
  calculateNBR,
};

export const VEGETATION_CLASSES = Object.freeze({
  DENSE_FOREST: { id: 'DENSE_FOREST', label: 'Dense Forest Canopy', minNdvi: 0.60, color: '#2ecc71' },
  HEALTHY_VEGETATION: { id: 'HEALTHY_VEGETATION', label: 'Healthy Vegetation / Secondary Growth', minNdvi: 0.40, color: '#a8e6cf' },
  SPARSE_VEGETATION: { id: 'SPARSE_VEGETATION', label: 'Sparse Vegetation / Shrubland', minNdvi: 0.20, color: '#f1c40f' },
  DEGRADED_BARREN: { id: 'DEGRADED_BARREN', label: 'Degraded / Cleared / Bare Soil', minNdvi: -1.0, color: '#e74c3c' },
});

export function classifyVegetation(ndvi) {
  const val = clampIndex(ndvi);
  if (val >= VEGETATION_CLASSES.DENSE_FOREST.minNdvi) return VEGETATION_CLASSES.DENSE_FOREST;
  if (val >= VEGETATION_CLASSES.HEALTHY_VEGETATION.minNdvi) return VEGETATION_CLASSES.HEALTHY_VEGETATION;
  if (val >= VEGETATION_CLASSES.SPARSE_VEGETATION.minNdvi) return VEGETATION_CLASSES.SPARSE_VEGETATION;
  return VEGETATION_CLASSES.DEGRADED_BARREN;
}

export function classifyCanopyChange(t1Ndvi, t2Ndvi, nbrDelta = 0) {
  const v1 = clampIndex(t1Ndvi);
  const v2 = clampIndex(t2Ndvi);
  const delta = Math.round((v2 - v1) * 10000) / 10000;
  const burn = Number(nbrDelta) || 0;

  if (delta <= -0.15 && burn <= -0.20) {
    return {
      changeType: 'BURN_RELATED_LOSS',
      deltaNdvi: delta,
      severity: 'CRITICAL',
      description: 'Severe canopy drop accompanied by acute burn scar spectral signature',
    };
  }

  if (delta <= -0.25) {
    return {
      changeType: 'SUDDEN_CLEARING',
      deltaNdvi: delta,
      severity: 'CRITICAL',
      description: 'Acute canopy collapse indicating rapid mechanical or clear-cut disturbance',
    };
  }

  if (delta <= -0.12) {
    return {
      changeType: 'GRADUAL_DEGRADATION',
      deltaNdvi: delta,
      severity: 'HIGH',
      description: 'Moderate canopy decline consistent with selective thinning or environmental stress',
    };
  }

  if (delta < -0.05) {
    return {
      changeType: 'MINOR_VEGETATION_CHANGE',
      deltaNdvi: delta,
      severity: 'MODERATE',
      description: 'Minor vegetation dip, potentially attributable to seasonal senescence or phenology',
    };
  }

  if (delta >= -0.05 && delta <= 0.05) {
    return {
      changeType: 'STABLE_CANOPY',
      deltaNdvi: delta,
      severity: 'LOW',
      description: 'Canopy density within stable historical equilibrium',
    };
  }

  return {
    changeType: 'CANOPY_RECOVERY',
    deltaNdvi: delta,
    severity: 'POSITIVE',
    description: 'Statistically significant greening trend indicative of regeneration or seasonal flush',
  };
}

export const classifySpectralChange = classifyCanopyChange;
