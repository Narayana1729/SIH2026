import React, { useState } from 'react';
import type { Incident, EmergencyResponder } from '../types';
import type { PlumeWeatherInput, PlumeTelemetry, AtmosphericStability } from '../engine/plumeEngine';
import type { IncidentDispatchSummary } from '../engine/dispatchEngine';
import { 
  Wind, 
  Compass, 
  Flame, 
  Truck, 
  Hospital, 
  Gauge, 
  X, 
  Minimize2, 
  Maximize2, 
  ShieldAlert 
} from 'lucide-react';

interface PlumeTacticalPanelProps {
  selectedIncident: Incident | null;
  weather: PlumeWeatherInput;
  telemetry: PlumeTelemetry | null;
  dispatchPlan: IncidentDispatchSummary | null;
  onWeatherChange: (updated: Partial<PlumeWeatherInput>) => void;
  onSelectResponder?: (responder: EmergencyResponder) => void;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onClose?: () => void;
}

export const PlumeTacticalPanel: React.FC<PlumeTacticalPanelProps> = ({
  selectedIncident,
  weather,
  telemetry,
  dispatchPlan,
  onWeatherChange,
  onSelectResponder,
  onShowToast,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'plume' | 'dispatch'>('plume');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [dispatchedUnits, setDispatchedUnits] = useState<Record<string, boolean>>({});

  if (!selectedIncident) {
    return null;
  }

  const downwindHeading = ((weather.windDirection + 180) % 360 + 360) % 360;

  const getHeadingName = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
    return directions[index];
  };

  const handleDispatch = (responder: EmergencyResponder, unitType: string = 'Unit') => {
    setDispatchedUnits(prev => ({
      ...prev,
      [responder.id]: true
    }));
    if (onSelectResponder) {
      onSelectResponder(responder);
    }
    if (onShowToast) {
      onShowToast(
        `${unitType} Mobilized`,
        `Response order transmitted to ${responder.name}.`,
        'success'
      );
    }
  };

  // 1. Minimized Floating HUD Bar
  if (isMinimized) {
    return (
      <div className="drag-handle cursor-grab active:cursor-grabbing bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xl flex items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          <Wind className="w-4 h-4 text-sky-500" />
          <div className="flex flex-col">
            <span className="font-medium text-zinc-900 dark:text-zinc-200 text-xs truncate max-w-[180px]">
              {selectedIncident.facility}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              Plume: {telemetry ? telemetry.plumeLengthKm.toFixed(1) : '8.5'}km ({getHeadingName(downwindHeading)} {downwindHeading}°) · ETA {dispatchPlan?.nearestFireStation?.etaFormatted || '12 min'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
            title="Expand tactical panel"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer"
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[82vh] text-zinc-800 dark:text-zinc-200">
      
      {/* 1. Header with Window Controls */}
      <div className="drag-handle cursor-grab active:cursor-grabbing px-3.5 py-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Wind className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                Plume & Dispatch Deck
              </h3>
              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono shrink-0">
                Gaussian 2.4
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate">
              {selectedIncident.facility}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-1 gap-1">
        <button
          onClick={() => setActiveTab('plume')}
          className={`flex-1 py-1 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'plume'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Plume Dispersion</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex-1 py-1 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'dispatch'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Emergency Dispatch</span>
        </button>
      </div>

      {/* 3. Tab Content Area */}
      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        
        {activeTab === 'plume' ? (
          <>
            {/* Atmospheric Simulation Controls */}
            <div className="bg-zinc-50/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1.5 text-[11px]">
                <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-zinc-400" /> Wind & Atmospheric State
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                  Downwind: <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{downwindHeading}° ({getHeadingName(downwindHeading)})</strong>
                </span>
              </div>

              {/* Wind Speed Control */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 text-[11px]">
                    <Gauge className="w-3 h-3 text-zinc-400" /> Wind Speed
                  </span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono text-xs">
                    {(weather.windSpeed * 3.6).toFixed(1)} km/h <span className="text-zinc-400 dark:text-zinc-500">({weather.windSpeed.toFixed(1)} m/s)</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="25.0"
                  step="0.5"
                  value={weather.windSpeed}
                  onChange={(e) => onWeatherChange({ windSpeed: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
                />
              </div>

              {/* Wind Origin Direction Control */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 text-[11px]">
                    <Compass className="w-3 h-3 text-zinc-400" /> Origin Heading
                  </span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono text-xs">
                    {weather.windDirection}° ({getHeadingName(weather.windDirection)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  step="5"
                  value={weather.windDirection}
                  onChange={(e) => onWeatherChange({ windDirection: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
                />
              </div>

              {/* Stability Class Selector */}
              <div className="pt-1">
                <div className="text-[10px] text-zinc-500 font-medium mb-1">
                  Pasquill-Gifford Stability Class
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['STABLE', 'NEUTRAL', 'UNSTABLE'] as AtmosphericStability[]).map((s) => {
                    const active = weather.stability === s;
                    return (
                      <button
                        key={s}
                        onClick={() => onWeatherChange({ stability: s })}
                        className={`py-1 rounded text-[10.5px] font-medium border transition-colors cursor-pointer text-center ${
                          active
                            ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        {s === 'STABLE' ? 'Stable (Night)' : s === 'NEUTRAL' ? 'Neutral (Std)' : 'Unstable (Day)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Plume Footprint Telemetry */}
            <div className="bg-zinc-50/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1 text-[11px]">
                <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" /> Hazard Footprint
                </span>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">Live Gaussian</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Plume Reach</div>
                  <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                    {telemetry ? telemetry.plumeLengthKm.toFixed(2) : '8.50'}<span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal"> km</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Max Spread</div>
                  <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                    {telemetry ? Math.round(telemetry.maxWidthMeters) : '1850'}<span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal"> m</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Hazard Area</div>
                  <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                    {telemetry ? telemetry.areaSqKm.toFixed(1) : '14.2'}<span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal"> km²</span>
                  </div>
                </div>
              </div>

              {/* Severity Contours Readout */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Zone 1: Thermal Core & Blast
                  </span>
                  <span className="font-mono text-rose-500 dark:text-rose-400 text-[10px]">IDLH Lethal</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Zone 2: Toxic Gas Dispersion
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 text-[10px]">High Risk Evac</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Zone 3: Smoke Drift
                  </span>
                  <span className="font-mono text-yellow-600 dark:text-yellow-400 text-[10px]">Buffer Alert</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Dispatch Tab */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span className="font-medium text-[11px]">Emergency Responders</span>
              <span className="font-mono text-[10px]">40 km/h Corridor Model</span>
            </div>

            {/* Fire Station Responder Card */}
            {dispatchPlan?.nearestFireStation && (
              <div className="bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200">{dispatchPlan.nearestFireStation.responder.name}</div>
                      <div className="text-[11px] text-zinc-500">{dispatchPlan.nearestFireStation.responder.city}, {dispatchPlan.nearestFireStation.responder.state}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                      ETA {dispatchPlan.nearestFireStation.etaFormatted}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {dispatchPlan.nearestFireStation.distanceFormatted}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-500">4 Foam Tenders, Hazmat</span>
                  <button
                    onClick={() => handleDispatch(dispatchPlan.nearestFireStation!.responder, 'Fire Tender')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      dispatchedUnits[dispatchPlan.nearestFireStation.responder.id]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {dispatchedUnits[dispatchPlan.nearestFireStation.responder.id] ? 'Dispatched' : 'Dispatch Unit'}
                  </button>
                </div>
              </div>
            )}

            {/* Hospital Responder Card */}
            {dispatchPlan?.nearestHospital && (
              <div className="bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <Hospital className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200">{dispatchPlan.nearestHospital.responder.name}</div>
                      <div className="text-[11px] text-zinc-500">{dispatchPlan.nearestHospital.responder.city}, {dispatchPlan.nearestHospital.responder.state}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                      ETA {dispatchPlan.nearestHospital.etaFormatted}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {dispatchPlan.nearestHospital.distanceFormatted}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-500">Burn ICU (24 Beds), Toxicology</span>
                  <button
                    onClick={() => handleDispatch(dispatchPlan.nearestHospital!.responder, 'Hospital Alert')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      dispatchedUnits[dispatchPlan.nearestHospital.responder.id]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {dispatchedUnits[dispatchPlan.nearestHospital.responder.id] ? 'Alerted' : 'Alert Hospital'}
                  </button>
                </div>
              </div>
            )}

            {/* NDRF Base Responder Card */}
            {dispatchPlan?.nearestNdrf && (
              <div className="bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200">{dispatchPlan.nearestNdrf.responder.name}</div>
                      <div className="text-[11px] text-zinc-500">{dispatchPlan.nearestNdrf.responder.city}, {dispatchPlan.nearestNdrf.responder.state}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200">
                      ETA {dispatchPlan.nearestNdrf.etaFormatted}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {dispatchPlan.nearestNdrf.distanceFormatted}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-500">CBRN Decontamination, Air Evac</span>
                  <button
                    onClick={() => handleDispatch(dispatchPlan.nearestNdrf!.responder, 'NDRF Unit')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      dispatchedUnits[dispatchPlan.nearestNdrf.responder.id]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {dispatchedUnits[dispatchPlan.nearestNdrf.responder.id] ? 'Mobilized' : 'Mobilize NDRF'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* 4. Footer */}
      <div className="h-8 border-t border-zinc-200 dark:border-zinc-800 px-3.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>Dispersion Vector Active</span>
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          Coordinated Dispatch
        </span>
      </div>

    </div>
  );
};
