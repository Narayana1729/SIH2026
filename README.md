# SIH2026

## PyroSat — Industrial Fire, Gas Flare & Persistent Thermal Source Satellite Intelligence Platform

PyroSat is a geospatial Earth Observation (EO) and machine-learning intelligence platform designed for the Smart India Hackathon (SIH 2026). It ingests multi-sensor NASA FIRMS (VIIRS/MODIS) thermal telemetry, executes physical Dozier sub-pixel combustion pyrometry inversions, performs 2-stage hierarchical machine-learning segregation (Industrial vs Non-Industrial disasters), and provides local feature attribution using exact Lundberg TreeSHAP dynamic programming.

### Key Capabilities
- **Physical Sub-Pixel Inversion**: Planck/Dozier dual-band solver resolving true flame temperature ($T_f$), combustion area ($A_f$), and radiant heat flux ($kW/m^2$).
- **2-Stage Hierarchical ML Ensemble**: LightGBM/GradientBoosting classifier segregating refinery gas flares, industrial fires, forest wildfires, crop stubble burning, and coal seam fires with strict probability provenance.
- **Local TreeSHAP Explainability**: Exact polynomial Lundberg dynamic programming TreeSHAP explaining Stage-1 industrial segregation.
- **Real Satellite Integration**: ESA WorldCover 10m land use / land cover (LULC) and Sentinel-2 Level-2A surface reflectance (NDVI, NBR, SWIR ratios) grounding.
- **Atmospheric Dispersion Plumes**: Gaussian plume modeling with live atmospheric weather telemetry (wind vector, velocity, temperature).
- **Incident Action Plans (IAP)**: Real-time emergency directives, HazMat chemical profiling, and automated PDF export.

### Quickstart
```bash
# Install dependencies
npm install

# Start local development server (Cesium 3D visualizer + Backend API)
npm run dev

# Run master automated test suite
npm test
```
