import React from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  RotateCw,
  AlertOctagon, 
  Activity, 
  FileText, 
  Radio, 
  FolderDown, 
  Layers, 
  Cpu, 
  Bell
} from 'lucide-react';
import { PRESET_CIRCUITS } from '../data/presets';
import { BenchComponent } from '../types';

interface HeaderProps {
  currentTab: 'workbench' | 'physics' | 'telemetry';
  setCurrentTab: (tab: 'workbench' | 'physics' | 'telemetry') => void;
  isSimulating: boolean;
  setIsSimulating: (running: boolean) => void;
  isEmergencyActive: boolean;
  onToggleEmergency: () => void;
  onResetBench: () => void;
  onLoadPreset: (presetId: string) => void;
  onExportCAD: (format: 'dxf' | 'svg' | 'json') => void;
  onOpenReportModal: () => void;
  activeFaultsCount: number;
  unreadNotifications: number;
  isCatalogOpen: boolean;
  onToggleCatalog: () => void;
  selectedComponent?: BenchComponent | null;
  onRotateComponent?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  isSimulating,
  setIsSimulating,
  isEmergencyActive,
  onToggleEmergency,
  onResetBench,
  onLoadPreset,
  onExportCAD,
  onOpenReportModal,
  activeFaultsCount,
  unreadNotifications,
  isCatalogOpen,
  onToggleCatalog,
  selectedComponent,
  onRotateComponent
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-slate-100">
      {/* Top Bar: Title, Controls, Presets, Export */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-900/30 ring-1 ring-cyan-400/30">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Simulador de Eletropneumática Didática
              </h1>
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-semibold whitespace-nowrap">
                ISO 1219 • NR-12
              </span>
              <span
                id="badge-workbench-din35"
                className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/90 text-cyan-300 border border-slate-700 font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                title="Bancada Didática DIN 35 com perfil de alumínio ranhurado"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Bancada didática DIN 35
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Bancada Didática Virtual de Automação Fluídica, Elétrica e Manutenção Industrial
            </p>
          </div>
        </div>

        {/* Center: Play, Stop, Reset, Emergency NR-12 */}
        <div className="flex items-center gap-2">
          <button
            id="btn-play-pause"
            onClick={() => setIsSimulating(!isSimulating)}
            disabled={isEmergencyActive}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              isEmergencyActive
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isSimulating
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
            }`}
            title={isSimulating ? 'Pausar Simulação' : 'Iniciar Simulação de Fluxo e Corrente'}
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simular</span>
              </>
            )}
          </button>

          <button
            id="btn-reset-bench"
            onClick={onResetBench}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Resetar posições e despressurizar"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Zerar</span>
          </button>

          {/* Emergency Stop Button (NR-12) */}
          <button
            id="btn-emergency-stop"
            onClick={onToggleEmergency}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isEmergencyActive
                ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-lg shadow-red-900/50'
                : 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-800/80'
            }`}
            title="Botão de Parada de Emergência com Trava Mecânica conforme NR-12"
          >
            <AlertOctagon className="w-4 h-4 fill-red-500 text-red-950" />
            <span>{isEmergencyActive ? 'EMERGÊNCIA TRAVADA' : 'EMERGÊNCIA'}</span>
          </button>

          {/* Botão Girar Componente (Posicionado ao lado direito do botão de emergência) */}
          <button
            id="btn-rotate-component"
            onClick={onRotateComponent}
            disabled={!selectedComponent}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              selectedComponent
                ? 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border-cyan-700 shadow-md shadow-cyan-950/50 cursor-pointer active:scale-95'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/60 cursor-not-allowed opacity-60'
            }`}
            title={
              selectedComponent
                ? `Girar ${selectedComponent.name} (${selectedComponent.tag}) a 90°`
                : 'Selecione um componente no painel para girá-lo a 90°'
            }
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Girar Componente</span>
            {selectedComponent && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/90 text-cyan-200 border border-cyan-700/80">
                {selectedComponent.tag} ({(selectedComponent.rotation || 0)}°)
              </span>
            )}
          </button>
        </div>

        {/* Right: Presets, CAD, Report */}
        <div className="flex items-center gap-2">
          {/* Preset Selector */}
          <div className="relative">
            <select
              id="select-preset"
              onChange={(e) => {
                if (e.target.value) onLoadPreset(e.target.value);
              }}
              defaultValue=""
              className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="" disabled>Circuitos Prontos...</option>
              {PRESET_CIRCUITS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* CAD Export Dropdown */}
          <div className="relative group">
            <button 
              id="btn-cad-export"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Exportar para ferramentas CAD industriais"
            >
              <FolderDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>CAD</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
              <button
                onClick={() => onExportCAD('dxf')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center justify-between"
              >
                <span>AutoCAD (.DXF)</span>
                <span className="text-[10px] text-cyan-400 font-mono">2D CAD</span>
              </button>
              <button
                onClick={() => onExportCAD('svg')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center justify-between"
              >
                <span>Esquema Vetorial (.SVG)</span>
                <span className="text-[10px] text-emerald-400 font-mono">ISO 1219</span>
              </button>
              <button
                onClick={() => onExportCAD('json')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 flex items-center justify-between"
              >
                <span>Schema JSON (.JSON)</span>
                <span className="text-[10px] text-amber-400 font-mono">CAE</span>
              </button>
            </div>
          </div>

          {/* Botão Mostrar / Ocultar Catálogo - Fisicamente ao lado da tecla Relatório */}
          <button
            id="btn-show-catalog"
            onClick={onToggleCatalog}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm border cursor-pointer ${
              isCatalogOpen
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-700/60 shadow-slate-950/40'
                : 'bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white border-cyan-400 shadow-cyan-900/30 ring-1 ring-cyan-400/40'
            }`}
            title={isCatalogOpen ? 'Ocultar catálogo de componentes' : 'Mostrar catálogo de componentes didáticos'}
            aria-label={isCatalogOpen ? 'Ocultar catálogo' : 'Mostrar catálogo'}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isCatalogOpen ? 'Ocultar Catálogo' : 'Mostrar Catálogo'}</span>
          </button>

          {/* Detailed Report Button */}
          <button
            id="btn-open-report"
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-sm transition cursor-pointer"
            title="Exportar relatório detalhado dos testes realizados"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Relatório</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 border-t border-slate-800 overflow-x-auto no-scrollbar">
        <button
          id="tab-workbench"
          onClick={() => setCurrentTab('workbench')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            currentTab === 'workbench'
              ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bancada Virtual</span>
        </button>

        <button
          id="tab-physics"
          onClick={() => setCurrentTab('physics')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            currentTab === 'physics'
              ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Simulação Física & Resistência</span>
        </button>

        <button
          id="tab-telemetry"
          onClick={() => setCurrentTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            currentTab === 'telemetry'
              ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Painel de Monitoramento Remoto</span>
          {unreadNotifications > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <Bell className="w-3 h-3" />
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
