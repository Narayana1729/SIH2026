import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Play, 
  RotateCcw,
  Cpu
} from 'lucide-react';

interface InteractiveClassifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassifiedEventCreated?: (event: any) => void;
}

export const InteractiveClassifierModal: React.FC<InteractiveClassifierModalProps> = ({
  isOpen,
  onClose,
  onClassifiedEventCreated,
}) => {
  // Input features state
  const [tempK, setTempK] = useState<number>(1250);
  const [frpMw, setFrpMw] = useState<number>(45.0);
  const [areaM2, setAreaM2] = useState<number>(35.0);
  const [facilityDistKm, setFacilityDistKm] = useState<number>(0.2);
  const [forestDistKm, setForestDistKm] = useState<number>(18.5);
  const [recurrenceScore, setRecurrenceScore] = useState<number>(0.85);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<{
    stage1: string;
    stage2: string;
    confidence: number;
    explanation: string;
  } | null>({
    stage1: 'INDUSTRIAL ANOMALY',
    stage2: 'Accidental Fire / Toxic Release',
    confidence: 96.4,
    explanation: 'Extreme flame temperature (1250 K) and high FRP surge located within 200m of facility boundary indicates high-severity flare or uncontained ignition.'
  });

  if (!isOpen) return null;

  const runInference = () => {
    setIsRunning(true);
    setTimeout(() => {
      let s1 = 'NATURAL / VEGETATIVE';
      let s2 = 'Wildfire / Forest Fire';
      let conf = 92.0;
      let exp = '';
      let classId = 2;

      if (facilityDistKm < 1.5) {
        s1 = 'INDUSTRIAL ANOMALY';
        if (recurrenceScore > 0.7 && frpMw < 30) {
          s2 = 'Routine Refinery Flare';
          conf = 95.8;
          exp = 'High recurrence pattern and nominal FRP inside facility boundary matches normal flare operation.';
          classId = 0;
        } else {
          s2 = 'Accidental Industrial Fire / Release';
          conf = 97.2;
          exp = `Elevated temperature (${tempK} K) and acute thermal output inside industrial perimeter indicates anomalous incident.`;
          classId = 1;
        }
      } else if (forestDistKm < 2.0) {
        s1 = 'NATURAL / VEGETATIVE';
        s2 = 'Wildfire / Forest Reserve Anomaly';
        conf = 94.5;
        exp = 'Thermal hotspot inside forest reserve perimeter with smoldering/biomass signature.';
        classId = 2;
      } else {
        s1 = 'NATURAL / VEGETATIVE';
        s2 = 'Agricultural Stubble Burning';
        conf = 91.0;
        exp = 'Low recurrence and low flame temperature consistent with open field crop residue burning.';
        classId = 3;
      }

      const predResult = {
        stage1: s1,
        stage2: s2,
        confidence: conf,
        explanation: exp,
      };

      setPrediction(predResult);

      if (onClassifiedEventCreated) {
        onClassifiedEventCreated({
          payload: {
            temperature_k: tempK,
            frp_mw: frpMw,
            estimated_emitter_temp_k: tempK,
            estimated_emitter_area_m2: areaM2,
            distance_to_nearest_facility_km: facilityDistKm,
            distance_to_nearest_forest_reserve_km: forestDistKm,
            temporal_persistence_score: recurrenceScore,
            site_name: 'Simulated Asset',
          },
          classification: {
            predicted_class_id: classId,
            predicted_class: s2,
            confidence: conf / 100,
          }
        });
      }

      setIsRunning(false);
    }, 300);
  };

  const handleReset = () => {
    setTempK(1250);
    setFrpMw(45.0);
    setAreaM2(35.0);
    setFacilityDistKm(0.2);
    setForestDistKm(18.5);
    setRecurrenceScore(0.85);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-zinc-800 dark:text-zinc-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Interactive Classifier Lab
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Simulate satellite thermal inputs and test hierarchical classifier predictions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Sliders Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Flame Temperature */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Flame Temperature</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{tempK} K</span>
            </div>
            <input
              type="range"
              min="500"
              max="2000"
              step="25"
              value={tempK}
              onChange={(e) => setTempK(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>

          {/* FRP */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Fire Radiative Power</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{frpMw.toFixed(1)} MW</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="200.0"
              step="1.0"
              value={frpMw}
              onChange={(e) => setFrpMw(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>

          {/* Sub-pixel Area */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Sub-Pixel Fire Area</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{areaM2.toFixed(1)} m²</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="500.0"
              step="5.0"
              value={areaM2}
              onChange={(e) => setAreaM2(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>

          {/* Facility Proximity */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Facility Distance</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{facilityDistKm.toFixed(2)} km</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="25.0"
              step="0.05"
              value={facilityDistKm}
              onChange={(e) => setFacilityDistKm(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>

          {/* Forest Proximity */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Forest Reserve Distance</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{forestDistKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="50.0"
              step="0.5"
              value={forestDistKm}
              onChange={(e) => setForestDistKm(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>

          {/* Recurrence Score */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">90-Day Recurrence Score</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{(recurrenceScore * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={recurrenceScore}
              onChange={(e) => setRecurrenceScore(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-700 dark:accent-zinc-300"
            />
          </div>
        </div>

        {/* Prediction Results Card */}
        {prediction && (
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Model Output
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                {prediction.confidence}% Confidence
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Stage 1 Filter</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{prediction.stage1}</span>
              </div>
              <div className="bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Stage 2 Sub-Class</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{prediction.stage2}</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              {prediction.explanation}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={runInference}
              disabled={isRunning}
              className="px-4 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Computing...' : 'Run Prediction'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
