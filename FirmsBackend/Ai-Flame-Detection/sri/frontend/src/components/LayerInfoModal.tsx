import React from 'react';
import type { LayerDefinition } from '../layersConfig';
import { 
  X, 
  Database, 
  ShieldCheck, 
  Layers
} from 'lucide-react';

interface LayerInfoModalProps {
  layer: LayerDefinition | null;
  onClose: () => void;
}

export const LayerInfoModal: React.FC<LayerInfoModalProps> = ({ layer, onClose }) => {
  if (!layer) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-zinc-800 dark:text-zinc-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {layer.name}
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                  {layer.category}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{layer.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Specifications Grid */}
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider block mb-1">
              Description & Operational Context
            </span>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              {layer.metadata.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 font-medium">
                <Database className="w-3 h-3 text-zinc-400" /> Data Source
              </span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                {layer.metadata.datasetName}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{layer.metadata.provider}</p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-2.5 rounded-lg space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Resolution & Mode
              </span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                {layer.metadata.resolution || 'Standard'}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{layer.metadata.mode}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <span className="text-[11px] text-zinc-500">
            Internal PostGIS Geodatabase Reference
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
