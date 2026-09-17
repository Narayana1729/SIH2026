import React, { useState, useMemo } from 'react';
import type { LayerDefinition, LayerCategory } from '../layersConfig';
import { DraggablePanel } from './DraggablePanel';
import { 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Satellite, 
  Radio, 
  Building2, 
  Zap, 
  Fuel, 
  ShieldAlert, 
  History, 
  Hospital, 
  Database, 
  Map, 
  Trees,
  Layers as LayersIcon,
  Check,
  Flame,
  CheckCheck,
  RotateCcw
} from 'lucide-react';

interface LayersPanelProps {
  layerDefinitions: LayerDefinition[];
  activeLayers: Record<string, boolean>;
  onToggleLayer: (layerId: string) => void;
  onOpenInfo: (layer: LayerDefinition) => void;
  onApplyPreset?: (layerIds: string[]) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layerDefinitions,
  activeLayers,
  onToggleLayer,
  onOpenInfo,
  onApplyPreset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Quick Preset Configurations
  const presets = [
    {
      id: 'industrial_emergency',
      label: 'Industrial & HAZMAT',
      icon: '🏭',
      layers: ['india-industrial-facilities', 'emergency-services-ndrf', 'hazmat-zones-tier1', 'historical-industrial-disasters', 'nasa-firms-live-api'],
    },
    {
      id: 'nasa_satellites',
      label: 'NASA Satellites',
      icon: '🛰️',
      layers: ['nasa-firms-viirs', 'nasa-firms-live-api', 'benchmark-labeled-dataset'],
    },
    {
      id: 'critical_energy',
      label: 'Critical Energy',
      icon: '⚡',
      layers: ['global-power-plants', 'oil-gas-refineries', 'steel-smelters-blast-furnaces'],
    },
    {
      id: 'ecological_forest',
      label: 'Wildfire & Reserves',
      icon: '🌲',
      layers: ['indian-forest-reserves', 'nasa-firms-live-api'],
    },
  ];

  // Filter layers by search query
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return layerDefinitions;
    const q = searchQuery.toLowerCase();
    return layerDefinitions.filter(l => 
      l.name.toLowerCase().includes(q) ||
      l.subtitle.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.metadata.datasetName.toLowerCase().includes(q) ||
      l.metadata.provider.toLowerCase().includes(q)
    );
  }, [layerDefinitions, searchQuery]);

  // Group filtered layers by category
  const groupedLayers = useMemo(() => {
    const groups: Partial<Record<LayerCategory, LayerDefinition[]>> = {};
    filteredLayers.forEach(l => {
      if (!groups[l.category]) {
        groups[l.category] = [];
      }
      groups[l.category]!.push(l);
    });
    return groups;
  }, [filteredLayers]);

  // Render appropriate domain icon
  const renderIcon = (iconType: LayerDefinition['iconType']) => {
    switch (iconType) {
      case 'satellite':
        return <Satellite className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'radio':
        return <Radio className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />;
      case 'factory':
        return <Building2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
      case 'fuel':
        return <Fuel className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'anvil':
        return <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
      case 'hazard':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />;
      case 'history':
        return <History className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'emergency':
        return <Hospital className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />;
      case 'database':
        return <Database className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'map':
        return <Map className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
      case 'trees':
        return <Trees className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
      default:
        return <LayersIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
    }
  };

  const activeCount = Object.values(activeLayers).filter(Boolean).length;

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const handleSelectAll = (enable: boolean) => {
    layerDefinitions.forEach(l => {
      if (!!activeLayers[l.id] !== enable) {
        onToggleLayer(l.id);
      }
    });
  };

  const handleApplyPresetInternal = (presetLayerIds: string[]) => {
    if (onApplyPreset) {
      onApplyPreset(presetLayerIds);
    } else {
      layerDefinitions.forEach(l => {
        const shouldEnable = presetLayerIds.includes(l.id);
        if (!!activeLayers[l.id] !== shouldEnable) {
          onToggleLayer(l.id);
        }
      });
    }
  };

  return (
    <DraggablePanel defaultPosition={{ x: 16, y: 16 }} zIndex={400} className="w-[320px] sm:w-[330px]">
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl flex flex-col overflow-hidden transition-all duration-150">
        
        {/* 1. Panel Header (Collapsible & Draggable) */}
        <div 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="drag-handle cursor-grab active:cursor-grabbing h-10 px-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors select-none bg-zinc-50/70 dark:bg-zinc-900/40"
        >
          <div className="flex items-center gap-2">
            <LayersIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>GIS Layers</span>
              <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-200/70 dark:bg-zinc-800/80 px-1.5 py-0.2 rounded">
                {activeCount}/{layerDefinitions.length}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            )}
          </div>
        </div>

        {/* 2. Expanded Content */}
        {!isCollapsed && (
          <div className="flex flex-col">
            
            {/* Quick Tactical Presets Ribbon */}
            <div className="p-2.5 bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-200 dark:border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium px-1">
                <span>Presets</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSelectAll(true)}
                    className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 flex items-center gap-0.5 cursor-pointer"
                    title="Enable all layers"
                  >
                    <CheckCheck className="w-3 h-3 text-zinc-500" /> All
                  </button>
                  <span className="text-zinc-400 dark:text-zinc-600">·</span>
                  <button 
                    onClick={() => handleSelectAll(false)}
                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer"
                    title="Disable all layers"
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-500" /> Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((p) => {
                  const isPresetActive = p.layers.every(id => !!activeLayers[id]);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleApplyPresetInternal(p.layers)}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium border text-left flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isPresetActive
                          ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <span className="text-xs">{p.icon}</span>
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Box */}
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-950/40">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter layers..."
                  className="w-full bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 rounded-md pl-8 pr-7 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Layer List */}
            <div className="max-h-[340px] overflow-y-auto p-2 space-y-2">
              {Object.keys(groupedLayers).length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No matching layers found
                </div>
              ) : (
                Object.entries(groupedLayers).map(([category, layers]) => {
                  const isCatCollapsed = !!collapsedCategories[category];
                  const catActiveCount = layers?.filter(l => !!activeLayers[l.id]).length || 0;

                  return (
                    <div key={category} className="space-y-1">
                      
                      {/* Category Label */}
                      <div 
                        onClick={() => toggleCategoryCollapse(category)}
                        className="px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900/40"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{category}</span>
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                            ({catActiveCount}/{layers?.length})
                          </span>
                        </span>
                        {isCatCollapsed ? (
                          <ChevronDown className="w-3 h-3 text-zinc-400" />
                        ) : (
                          <ChevronUp className="w-3 h-3 text-zinc-400" />
                        )}
                      </div>

                      {/* Layer Items */}
                      {!isCatCollapsed && (
                        <div className="space-y-1">
                          {layers?.map((layer) => {
                            const isChecked = !!activeLayers[layer.id];

                            return (
                              <div
                                key={layer.id}
                                className={`flex items-center justify-between p-2 rounded-lg transition-colors group border ${
                                  isChecked
                                    ? 'bg-zinc-50 dark:bg-zinc-900/90 border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100'
                                    : 'bg-white dark:bg-zinc-950/40 border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 hover:border-zinc-200 dark:hover:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {/* Left: Checkbox + Icon + Titles */}
                                <div 
                                  onClick={() => onToggleLayer(layer.id)}
                                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer pr-1"
                                >
                                  {/* Crisp Square Checkbox */}
                                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors border ${
                                    isChecked
                                      ? 'bg-zinc-800 dark:bg-zinc-200 border-zinc-800 dark:border-zinc-200 text-white dark:text-zinc-900'
                                      : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-transparent hover:border-zinc-400'
                                  }`}>
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>

                                  {/* Domain Icon */}
                                  <div className="shrink-0 p-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                    {renderIcon(layer.iconType)}
                                  </div>

                                  {/* Titles */}
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs font-medium truncate ${
                                        isChecked ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'
                                      }`}>
                                        {layer.name}
                                      </span>
                                      <span 
                                        className="text-[10px] font-mono shrink-0 text-zinc-400 dark:text-zinc-500"
                                      >
                                        · {layer.status}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate font-normal">
                                      {layer.subtitle}
                                    </span>
                                  </div>
                                </div>

                                {/* Right: Information Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenInfo(layer);
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                                  title={`Inspect ${layer.name} details`}
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>

                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            {/* 3. Panel Footer */}
            <div className="h-8 border-t border-zinc-200 dark:border-zinc-800 px-3.5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>PostGIS & FIRMS Engine</span>
              </span>
              <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                12 Registries
              </span>
            </div>

          </div>
        )}

      </div>
    </DraggablePanel>
  );
};
