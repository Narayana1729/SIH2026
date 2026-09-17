"""
10m Land Use / Land Cover (LULC) Footprint Engine.
Backed by genuine ESA WorldCover 10m GeoTIFF rasters via rasterio.
Strictly zero synthetic generation, zero np.random.uniform calls, and zero fabricated numbers.
"""

from typing import Dict, Any
import os
import sys

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from raster_lulc_service import get_default_raster_lulc_service


class LULCEngine:
    def __init__(self, raster_dirs=None):
        self.raster_service = get_default_raster_lulc_service()

    def compute_footprint_fractions(self, lat: float, lon: float, dist_to_facility_km: float = 999.0) -> Dict[str, Any]:
        """
        Computes real ESA WorldCover 10m LULC fractional coverage [forest, cropland, builtup, bare]
        within the ~375m thermal pixel footprint.
        
        If location is outside real raster coverage, returns status = DATA_UNAVAILABLE and
        is_lulc_measured = False without fabricating numbers.
        """
        ctx = self.raster_service.get_landcover_context(lat, lon, footprint_meters=375.0)

        if ctx.get("is_lulc_measured"):
            return {
                "forest_fraction": ctx["forest_fraction"],
                "cropland_fraction": ctx["cropland_fraction"],
                "builtup_fraction": ctx["builtup_fraction"],
                "bare_fraction": ctx["bare_fraction"],
                "water_fraction": ctx.get("water_fraction", 0.0),
                "grassland_fraction": ctx.get("grassland_fraction", 0.0),
                "dominant_class": ctx["dominant_class"],
                "lulc_source": "ESA_WORLDCOVER",
                "lulc_resolution_m": 10,
                "is_lulc_measured": True,
                "status": "MEASURED_RASTER",
                "raster_file": ctx.get("raster_file"),
            }
        else:
            return {
                "forest_fraction": 0.0,
                "cropland_fraction": 0.0,
                "builtup_fraction": 0.0,
                "bare_fraction": 0.0,
                "water_fraction": 0.0,
                "grassland_fraction": 0.0,
                "dominant_class": "DATA_UNAVAILABLE",
                "lulc_source": "ESA_WORLDCOVER",
                "lulc_resolution_m": 10,
                "is_lulc_measured": False,
                "status": "DATA_UNAVAILABLE",
                "reason": ctx.get("reason", "Outside available ESA WorldCover 10m raster coverage"),
            }


if __name__ == "__main__":
    lulc = LULCEngine()
    print("Jamnagar Refinery Footprint:", lulc.compute_footprint_fractions(22.38, 69.87, dist_to_facility_km=0.28))
    print("Similipal Forest Footprint:", lulc.compute_footprint_fractions(21.86, 86.33, dist_to_facility_km=98.0))
    print("Karnal Haryana Cropland Footprint:", lulc.compute_footprint_fractions(29.68, 76.98, dist_to_facility_km=45.0))
    print("Unknown Offshore Footprint:", lulc.compute_footprint_fractions(0.0, 0.0))
