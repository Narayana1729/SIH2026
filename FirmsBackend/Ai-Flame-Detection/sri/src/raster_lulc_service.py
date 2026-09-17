"""
ESA WorldCover 10m Real GeoTIFF Raster Service.
Uses rasterio and NumPy for genuine geospatial raster reading, spatial window extraction,
and class fraction computation. Strictly no random numbers or fabricated values.
"""

import os
import glob
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform

# Mapping of ESA WorldCover v200 class codes to PyroSat semantic categories
ESA_WORLDCOVER_CLASSES = {
    10: "forest",
    20: "shrubland",
    30: "grassland",
    40: "cropland",
    50: "builtup",
    60: "bare",
    70: "snow_ice",
    80: "water",
    90: "wetland",
    95: "mangroves",
    100: "moss_lichen",
}


class RasterLULCService:
    def __init__(self, raster_dirs=None):
        if raster_dirs is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            candidates = [
                os.path.abspath(os.path.join(base_dir, "../../../../data/rasters/esa_worldcover")),
                os.path.abspath(os.path.join(base_dir, "../../data/rasters/esa_worldcover")),
                os.path.abspath(os.path.join(base_dir, "../data/rasters/esa_worldcover")),
            ]
            self.raster_dirs = [d for d in candidates if os.path.isdir(d)]
        else:
            self.raster_dirs = raster_dirs

        self.raster_files = []
        for d in self.raster_dirs:
            self.raster_files.extend(glob.glob(os.path.join(d, "*.tif")))

        # Index metadata for available rasters and cache readers
        self.indices = []
        self._open_datasets = {}
        for f in self.raster_files:
            try:
                src = rasterio.open(f)
                self._open_datasets[f] = src
                self.indices.append({
                    "path": f,
                    "bounds": src.bounds,
                    "crs": str(src.crs),
                    "transform": src.transform,
                    "nodata": src.nodata,
                    "res": src.res,
                })
            except Exception as e:
                continue

    def get_landcover_context(self, lat: float, lon: float, footprint_meters: float = 375.0) -> dict:
        """
        Extract exact ESA WorldCover 10m pixel class fractions within a spatial window
        centered on the given WGS-84 coordinate.
        """
        matched_idx = None
        for idx_info in self.indices:
            b = idx_info["bounds"]
            if b.left <= lon <= b.right and b.bottom <= lat <= b.top:
                matched_idx = idx_info
                break

        if not matched_idx:
            return {
                "forest_fraction": None,
                "cropland_fraction": None,
                "builtup_fraction": None,
                "bare_fraction": None,
                "water_fraction": None,
                "grassland_fraction": None,
                "shrubland_fraction": None,
                "dominant_class": "UNKNOWN",
                "lulc_source": "ESA_WORLDCOVER",
                "lulc_resolution_m": 10,
                "is_lulc_measured": False,
                "status": "DATA_UNAVAILABLE",
                "reason": "Coordinates outside available ESA WorldCover 10m raster coverage",
            }

        try:
            src = self._open_datasets.get(matched_idx["path"])
            if src is None or src.closed:
                src = rasterio.open(matched_idx["path"])
                self._open_datasets[matched_idx["path"]] = src

            half_deg_lon = (footprint_meters / 2.0) / (111320.0 * np.cos(np.radians(lat)))
            half_deg_lat = (footprint_meters / 2.0) / 110574.0

            min_lon, max_lon = lon - half_deg_lon, lon + half_deg_lon
            min_lat, max_lat = lat - half_deg_lat, lat + half_deg_lat

            # If raster CRS is not WGS84, transform coordinates
            if src.crs != "EPSG:4326":
                xs, ys = transform("EPSG:4326", src.crs, [min_lon, max_lon], [min_lat, max_lat])
                min_x, max_x = min(xs), max(xs)
                min_y, max_y = min(ys), max(ys)
            else:
                min_x, max_x = min_lon, max_lon
                min_y, max_y = min_lat, max_lat

            win = from_bounds(min_x, min_y, max_x, max_y, src.transform)
            pixels = src.read(1, window=win)

            if pixels.size == 0 or (matched_idx["nodata"] is not None and np.all(pixels == matched_idx["nodata"])):
                return {
                    "forest_fraction": None,
                    "cropland_fraction": None,
                    "builtup_fraction": None,
                    "bare_fraction": None,
                    "water_fraction": None,
                    "grassland_fraction": None,
                    "shrubland_fraction": None,
                    "dominant_class": "NODATA",
                    "lulc_source": "ESA_WORLDCOVER",
                    "lulc_resolution_m": 10,
                    "is_lulc_measured": False,
                    "status": "DATA_UNAVAILABLE",
                    "reason": "Pixel window contains only NoData",
                }

            # Filter NoData pixels if present
            if matched_idx["nodata"] is not None:
                pixels = pixels[pixels != matched_idx["nodata"]]
                if pixels.size == 0:
                    return {
                        "forest_fraction": None,
                        "cropland_fraction": None,
                        "builtup_fraction": None,
                        "bare_fraction": None,
                        "water_fraction": None,
                        "grassland_fraction": None,
                        "shrubland_fraction": None,
                        "dominant_class": "NODATA",
                        "lulc_source": "ESA_WORLDCOVER",
                        "lulc_resolution_m": 10,
                        "is_lulc_measured": False,
                        "status": "DATA_UNAVAILABLE",
                        "reason": "All pixels matched NoData value",
                    }

            unique, counts = np.unique(pixels, return_counts=True)
            total_valid_pixels = float(pixels.size)
            class_counts = dict(zip(unique.tolist(), counts.tolist()))

            def get_pct(codes):
                c = sum(class_counts.get(code, 0) for code in codes)
                return round(c / total_valid_pixels, 3)

            forest = get_pct([10, 95])  # Trees + Mangroves
            shrub = get_pct([20])
            grass = get_pct([30])
            crop = get_pct([40])
            builtup = get_pct([50])
            bare = get_pct([60])
            water = get_pct([80])
            wetland = get_pct([90])

            # Determine dominant class from actual pixel plurality
            code_to_name = {
                10: "Tree Cover / Forest",
                20: "Shrubland",
                30: "Grassland",
                40: "Cropland",
                50: "Built-up / Industrial",
                60: "Bare Land",
                80: "Water Body",
                90: "Herbaceous Wetland",
                95: "Mangroves",
            }
            dominant_code = unique[np.argmax(counts)]
            dominant_name = code_to_name.get(dominant_code, f"Class {dominant_code}")

            return {
                "forest_fraction": forest,
                "cropland_fraction": crop,
                "builtup_fraction": builtup,
                "bare_fraction": bare,
                "water_fraction": water,
                "grassland_fraction": grass,
                "shrubland_fraction": shrub,
                "dominant_class": dominant_name,
                "dominant_class_code": int(dominant_code),
                "valid_pixel_count": int(total_valid_pixels),
                "lulc_source": "ESA_WORLDCOVER",
                "lulc_resolution_m": 10,
                "raster_crs": matched_idx["crs"],
                "raster_file": os.path.basename(matched_idx["path"]),
                "is_lulc_measured": True,
                "status": "MEASURED_RASTER",
            }

        except Exception as e:
            return {
                "forest_fraction": None,
                "cropland_fraction": None,
                "builtup_fraction": None,
                "bare_fraction": None,
                "water_fraction": None,
                "grassland_fraction": None,
                "shrubland_fraction": None,
                "dominant_class": "ERROR",
                "lulc_source": "ESA_WORLDCOVER",
                "lulc_resolution_m": 10,
                "is_lulc_measured": False,
                "status": "DATA_UNAVAILABLE",
                "error": str(e),
            }


_GLOBAL_RASTER_LULC_SERVICE = None


def get_default_raster_lulc_service():
    global _GLOBAL_RASTER_LULC_SERVICE
    if _GLOBAL_RASTER_LULC_SERVICE is None:
        _GLOBAL_RASTER_LULC_SERVICE = RasterLULCService()
    return _GLOBAL_RASTER_LULC_SERVICE
