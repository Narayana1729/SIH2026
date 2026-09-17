"use client";

import { useState, useEffect } from "react";
import {
  fetchEmergencyServicesGeoJson,
  fetchHistoricalDisastersGeoJson,
  fetchMultimodalBenchmarkGeoJson,
  fetchIndiaBoundariesGeoJson,
  GisFeatureCollection,
  EMPTY_GIS_COLLECTION,
} from "@/lib/api/gisLayers";

export function useGisExtraLayers() {
  const [emergencyData, setEmergencyData] = useState<GisFeatureCollection>(EMPTY_GIS_COLLECTION);
  const [disastersData, setDisastersData] = useState<GisFeatureCollection>(EMPTY_GIS_COLLECTION);
  const [benchmarkData, setBenchmarkData] = useState<GisFeatureCollection>(EMPTY_GIS_COLLECTION);
  const [boundariesData, setBoundariesData] = useState<GisFeatureCollection>(EMPTY_GIS_COLLECTION);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchEmergencyServicesGeoJson(),
      fetchHistoricalDisastersGeoJson(),
      fetchMultimodalBenchmarkGeoJson(),
      fetchIndiaBoundariesGeoJson(),
    ])
      .then(([emerg, disasters, benchmark, boundaries]) => {
        if (isMounted) {
          setEmergencyData(emerg);
          setDisastersData(disasters);
          setBenchmarkData(benchmark);
          setBoundariesData(boundaries);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    emergencyData,
    disastersData,
    benchmarkData,
    boundariesData,
    isLoading,
  };
}

