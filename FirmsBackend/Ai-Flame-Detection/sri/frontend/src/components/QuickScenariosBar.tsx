import React from 'react';
import { HelpCircle, Eye, EyeOff } from 'lucide-react';

interface QuickScenariosBarProps {
  onSelectScenario: (scenarioId: string) => void;
  activeScenarioId?: string;
  onOpenGuide: () => void;
  showAllPanels: boolean;
  onToggleAllPanels: () => void;
}

export const QuickScenariosBar: React.FC<QuickScenariosBarProps> = ({
  onSelectScenario,
  activeScenarioId,
  onOpenGuide,
  showAllPanels,
  onToggleAllPanels,
}) => {
  const scenarios = [
    {
      id: 'INC-001',
      name: 'Vizag Gas Leak',
      badge: 'Accidental',
      color: '#ef4444',
      badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
    },
    {
      id: 'INC-003',
      name: 'Jamnagar Refinery',
      badge: 'Routine',
      color: '#f59e0b',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    },
    {
      id: 'INC-007',
      name: 'Simlipal Forest',
      badge: 'Wildfire',
      color: '#10b981',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    },
    {
      id: 'INC-006',
      name: 'Punjab Stubble',
      badge: 'Stubble',
      color: '#0ea5e9',
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    },
  ];

  return (
    <div className="h-9 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-sm px-4 flex items-center justify-between text-xs select-none z-10">
      {/* Left: Quick Scenarios Pill Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[11px] font-medium text-zinc-500 shrink-0 hidden sm:inline">
          Active Feeds:
        </span>

        {scenarios.map((sc) => {
          const isActive = activeScenarioId === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: sc.color }}
              />
              <span className="font-medium">{sc.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${sc.badgeClass}`}>
                {sc.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Quick Tools */}
      <div className="flex items-center gap-2 shrink-0 pl-2">
        <button
          onClick={onToggleAllPanels}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
            !showAllPanels
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
          title="Toggle overlays visibility"
        >
          {showAllPanels ? (
            <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <Eye className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className="hidden md:inline">
            {showAllPanels ? 'Hide Overlays' : 'Show Overlays'}
          </span>
        </button>

        <button
          onClick={onOpenGuide}
          className="px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          title="User guide"
        >
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
          <span>Guide</span>
        </button>
      </div>
    </div>
  );
};
