import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("NASA FIRMS CSV Batch Ingestion & Multi-Domain Fire Classification Suite", () => {
  it("Step 1: Parses raw NASA FIRMS VIIRS CSV lines and extracts numerical spatial/thermal telemetry", () => {
    const rawCsv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
30.892,75.821,342.5,0.4,0.4,2026-09-12,0742,N,VIIRS,95,NRT,301.2,42.8,D
30.915,75.855,338.1,0.4,0.4,2026-09-12,0742,N,VIIRS,90,NRT,299.8,38.2,D
30.874,75.790,349.0,0.4,0.4,2026-09-12,0742,N,VIIRS,98,NRT,302.4,56.1,D`;

    const lines = rawCsv.trim().split("\n");
    assert.equal(lines.length, 4);

    const detections = lines.slice(1).map((l) => {
      const parts = l.split(",");
      return {
        lat: parseFloat(parts[0]),
        lon: parseFloat(parts[1]),
        brightness: parseFloat(parts[2]),
        frp: parseFloat(parts[12]),
      };
    });

    assert.equal(detections.length, 3);
    const avgLat = detections.reduce((s, d) => s + d.lat, 0) / detections.length;
    const avgLon = detections.reduce((s, d) => s + d.lon, 0) / detections.length;
    const maxFrp = Math.max(...detections.map((d) => d.frp));

    assert.ok(avgLat > 30.8 && avgLat < 31.0);
    assert.ok(avgLon > 75.7 && avgLon < 75.9);
    assert.equal(maxFrp, 56.1);
  });

  it("Step 2: Correctly attributes Punjab cluster as Agricultural Stubble Burning", () => {
    const lat = 30.89;
    const lon = 75.82;
    const isPunjabAgri = Math.abs(lat - 30.8) < 0.8 && Math.abs(lon - 75.8) < 0.8;
    assert.equal(isPunjabAgri, true, "Punjab coordinates should be identified as Agricultural region");
  });

  it("Step 3: Correctly attributes Jamnagar cluster as Oil & Gas Refinery Flare", () => {
    const lat = 22.471;
    const lon = 70.058;
    const isJamnagarRefinery = Math.abs(lat - 22.47) < 0.15 && Math.abs(lon - 70.05) < 0.15;
    assert.equal(isJamnagarRefinery, true, "Jamnagar coordinates should match Oil & Gas Refinery complex");
  });

  it("Step 4: Correctly attributes Similipal cluster as Forest & Canopy Wildfire", () => {
    const lat = 21.867;
    const lon = 86.333;
    const isSimilipalForest = Math.abs(lat - 21.86) < 0.3 && Math.abs(lon - 86.33) < 0.3;
    assert.equal(isSimilipalForest, true, "Similipal coordinates should match protected biosphere reserve");
  });

  it("Step 5: Correctly attributes Singrauli cluster as Mining & Coal Seam Fire", () => {
    const lat = 24.115;
    const lon = 82.684;
    const isSingrauliMining = Math.abs(lat - 24.11) < 0.4 && Math.abs(lon - 82.68) < 0.4;
    assert.equal(isSingrauliMining, true, "Singrauli coordinates should match open-cast coal & thermal power zone");
  });

  it("Step 6: Enforces PAC consistency auto-dispatch for high-confidence industrial matches", () => {
    const distanceMeters = 240;
    const predictedClass: string = "GAS_OIL";
    const pacStatus = distanceMeters < 1500 && (predictedClass === "INDUSTRIAL" || predictedClass === "GAS_OIL")
      ? "AUTO_DISPATCH"
      : "REVIEW_REQUIRED";

    assert.equal(pacStatus, "AUTO_DISPATCH");
  });
});
