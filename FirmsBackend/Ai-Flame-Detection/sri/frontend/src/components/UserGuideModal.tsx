import React from 'react';
import { X, Play, BookOpen } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (scenarioId: string) => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectScenario,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-zinc-800 dark:text-zinc-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Thermal Intelligence Platform Guide
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                AI verification and emergency plume dispersion workflow
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

        {/* Core Steps */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-3 rounded-lg space-y-1.5">
            <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center justify-center text-[10px]">
              1
            </div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Incident Selection</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Click any thermal hotspot marker on the 2D/3D map or browse the left incident feed.
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-3 rounded-lg space-y-1.5">
            <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center justify-center text-[10px]">
              2
            </div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Inspect Evidence</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Examine SHAP attributions, Planck pyrometry temperatures, and 90-day time-series baselines.
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-3 rounded-lg space-y-1.5">
            <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center justify-center text-[10px]">
              3
            </div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Plume & Dispatch</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Simulate wind conditions and deploy nearest NDRF or Fire Station units with live ETAs.
            </p>
          </div>
        </div>

        {/* Demo Scenarios */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider block">
            Load Operational Demo Scenarios
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onSelectScenario('INC-001'); onClose(); }}
              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Vizag Gas Leak & Fire</div>
                <div className="text-[11px] text-zinc-500">Toxic plume and NDRF response</div>
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </button>

            <button
              onClick={() => { onSelectScenario('INC-002'); onClose(); }}
              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Jamnagar Refinery Flare</div>
                <div className="text-[11px] text-zinc-500">Routine operational flare suppression</div>
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </button>

            <button
              onClick={() => { onSelectScenario('INC-003'); onClose(); }}
              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Simlipal National Park</div>
                <div className="text-[11px] text-zinc-500">Forest reserve ecological boundary</div>
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </button>

            <button
              onClick={() => { onSelectScenario('INC-004'); onClose(); }}
              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Punjab Stubble Fire</div>
                <div className="text-[11px] text-zinc-500">Agricultural biomass burning</div>
              </div>
              <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <span className="text-[11px] text-zinc-500">
            Press Esc to exit anytime
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-medium transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
