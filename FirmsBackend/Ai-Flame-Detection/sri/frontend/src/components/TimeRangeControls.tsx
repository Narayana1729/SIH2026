import React from 'react';
import { Calendar, Clock, GripVertical } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';

export type TimeRange = 'today' | '24h' | '7d' | 'custom';

interface TimeRangeControlsProps {
  selectedRange: TimeRange;
  onSelectRange: (range: TimeRange) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const TimeRangeControls: React.FC<TimeRangeControlsProps> = ({
  selectedRange,
  onSelectRange,
  selectedDate,
  onSelectDate,
}) => {
  return (
    <DraggablePanel defaultPosition={{ x: 350, y: 16 }} zIndex={400}>
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-xl flex items-center gap-1 text-xs select-none">
        
        {/* Grip Handle */}
        <div 
          className="drag-handle cursor-grab active:cursor-grabbing px-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-center transition-colors" 
          title="Drag to reposition"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center px-1.5 py-1 text-zinc-500 text-[11px] border-r border-zinc-200 dark:border-zinc-800/80 gap-1 hidden sm:flex">
          <Clock className="w-3 h-3 text-zinc-400" />
          <span>NASA NRT</span>
        </div>

        <button
          onClick={() => onSelectRange('today')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            selectedRange === 'today'
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
          }`}
        >
          Today
        </button>

        <button
          onClick={() => onSelectRange('24h')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            selectedRange === '24h'
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
          }`}
        >
          24h
        </button>

        <button
          onClick={() => onSelectRange('7d')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            selectedRange === '7d'
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
          }`}
        >
          7d
        </button>

        <div className="flex items-center pl-1 border-l border-zinc-200 dark:border-zinc-800/80">
          <label className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700">
            <Calendar className="w-3 h-3 text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              max="2026-09-01"
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(e.target.value);
                  onSelectRange('custom');
                }
              }}
              className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer font-mono"
            />
          </label>
        </div>
      </div>
    </DraggablePanel>
  );
};
