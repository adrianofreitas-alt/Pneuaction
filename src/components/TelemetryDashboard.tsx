import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Gauge, 
  Wind, 
  Zap, 
  Flame, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  Wifi, 
  AlertOctagon, 
  Clock, 
  Volume2, 
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { TelemetryMetrics } from '../types';

interface TelemetryDashboardProps {
  metrics: TelemetryMetrics;
  isSimulating: boolean;
  isEmergencyActive: boolean;
  onToggleEmergency: () => void;
  activeFaultsCount: number;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  metrics,
  isSimulating,
  isEmergencyActive,
  onToggleEmergency,
  activeFaultsCount
}) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());

  // Pressure PSI conversion: 1 bar = 14.5038 PSI
  const pressurePsi = (metrics.mainPressureBar * 14.5038).toFixed(1);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Painel de Controle e Monitoramento Remoto IoT
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Supervisão telemétrica contínua da bancada via protocolo industrial OPC UA / MQTT em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gateway Conectado</span>
              <span className="text-[10px] text-slate-500 font-mono">({lastSync})</span>
            </div>

            {/* Remote Emergency Stop Button */}
            <button
              onClick={onToggleEmergency}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                isEmergencyActive
                  ? 'bg-red-600 text-white border-red-400 animate-pulse'
                  : 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-800'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{isEmergencyActive ? 'REARMAR SISTEMA' : 'BLOQUEIO REMOTO'}</span>
            </button>
          </div>
        </div>

        {/* Top Status Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Health Score */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Índice Geral de Saúde</span>
              <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                {metrics.healthIndexScore}%
              </p>
              <span className="text-[10px] text-slate-500">Operação nominal estável</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Cycle Counter */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Ciclos Efetuados</span>
              <p className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                {metrics.totalCycles}
              </p>
              <span className="text-[10px] text-slate-500">
                Frequência: {(metrics.cycleFrequencyHz * 60).toFixed(0)} ciclos/min
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-800 flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Air Consumed */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Ar Total Consumido</span>
              <p className="text-2xl font-mono font-bold text-blue-400 mt-1">
                {metrics.totalAirConsumedLiters.toFixed(0)} <span className="text-xs font-normal text-slate-400">Nl</span>
              </p>
              <span className="text-[10px] text-slate-500">
                {(metrics.totalAirConsumedLiters / 1000).toFixed(2)} m³ normalizados
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-800 flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-400" />
            </div>
          </div>

          {/* Active Faults */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Alarmes Ativos</span>
              <p className={`text-2xl font-mono font-bold mt-1 ${
                activeFaultsCount > 0 ? 'text-red-400' : 'text-slate-300'
              }`}>
                {activeFaultsCount}
              </p>
              <span className="text-[10px] text-slate-500">
                {activeFaultsCount > 0 ? 'Intervenção requerida' : 'Zero anomalias'}
              </span>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              activeFaultsCount > 0
                ? 'bg-red-950/80 border-red-800 text-red-400 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Detailed Gauges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pressure Gauge */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Pressão da Linha Principal
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">
                {pressurePsi} PSI
              </span>
            </div>

            <div className="flex items-center justify-center py-4">
              <div className="relative w-40 h-40 rounded-full border-4 border-slate-800 flex flex-col items-center justify-center bg-slate-950/60 shadow-inner">
                <span className="text-3xl font-mono font-black text-cyan-400">
                  {metrics.mainPressureBar.toFixed(1)}
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">BAR</span>
                <span className="text-[10px] text-slate-500 mt-1">Faixa: 0 a 10 bar</span>
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span>Mínimo: 4.5 bar</span>
              <span>Nominal: 6.0 bar</span>
              <span>Máximo: 8.0 bar</span>
            </div>
          </div>

          {/* Flow Rate & Air Dynamics */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Vazão Instantânea de Ar Comprimido
                </h3>
              </div>
              <span className="text-[10px] font-mono text-blue-400 font-bold">
                Q (Nl/min)
              </span>
            </div>

            <div className="flex items-center justify-center py-4">
              <div className="relative w-40 h-40 rounded-full border-4 border-slate-800 flex flex-col items-center justify-center bg-slate-950/60 shadow-inner">
                <span className="text-3xl font-mono font-black text-blue-400">
                  {metrics.flowRateNlMin.toFixed(0)}
                </span>
                <span className="text-xs font-bold font-mono text-slate-400">Nl/min</span>
                <span className="text-[10px] text-slate-500 mt-1">ISO 6358</span>
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span>Repouso: 0 Nl/min</span>
              <span>Pico Avanço: 320 Nl/min</span>
            </div>
          </div>

          {/* Electrical 24V Supply & Power */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Comando Elétrico 24V CC (PELV)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-400 font-bold">
                IEC 60204-1
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400">Tensão Fixa de Saída</span>
                <p className="text-xl font-mono font-bold text-amber-400 mt-1">
                  {metrics.voltage24V.toFixed(1)} V
                </p>
                <span className="text-[10px] text-emerald-400 font-medium">Estabilizada em 24V</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400">Corrente Total</span>
                <p className="text-xl font-mono font-bold text-white mt-1">
                  {metrics.currentAmperes.toFixed(2)} A
                </p>
                <span className="text-[10px] text-slate-500">Carga das bobinas</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center col-span-2">
                <span className="text-[11px] text-slate-400">Potência Elétrica Dissipada</span>
                <p className="text-xl font-mono font-bold text-cyan-300 mt-1">
                  {metrics.powerWatts.toFixed(1)} W
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Alimentação Fixa: 24V CC (PELV)</span>
              <span className="text-emerald-400 font-mono">Status: 24V OK</span>
            </div>
          </div>
        </div>

        {/* Manifold Temperature and IoT Protocol specs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Temperatura do Bloco de Válvulas</span>
                <p className="text-lg font-mono font-bold text-white">
                  {metrics.manifoldTempC.toFixed(1)} °C
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">Protocolo:</span>
                <p className="font-mono text-slate-200">OPC UA / MQTT v5</p>
              </div>
              <div>
                <span className="text-slate-500">Taxa de Atualização:</span>
                <p className="font-mono text-slate-200">100 ms (10 Hz)</p>
              </div>
              <div>
                <span className="text-slate-500">Latência do Nó:</span>
                <p className="font-mono text-emerald-400">12 ms</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
