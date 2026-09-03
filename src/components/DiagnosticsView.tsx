import React from 'react';
import { 
  BenchComponent, 
  VirtualConnection, 
  DiagnosticFault 
} from '../types';
import { 
  Wrench, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Wind, 
  Zap, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';
import { benchAudio } from '../utils/audioSynthesizer';

interface DiagnosticsViewProps {
  components: BenchComponent[];
  connections: VirtualConnection[];
  faults: DiagnosticFault[];
  onInjectFault: (faultType: string, targetComponentId?: string) => void;
  onClearFault: (faultId: string) => void;
  onClearAllFaults: () => void;
  onCreateMaintenanceFromFault: (fault: DiagnosticFault) => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  components,
  connections,
  faults,
  onInjectFault,
  onClearFault,
  onClearAllFaults,
  onCreateMaintenanceFromFault,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Diagnósticos de Falhas em Tempo Real & Injetor Didático
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitoramento contínuo de anomalias pneumáticas e elétricas, análise de causa raiz e injeção de falhas para treinamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {faults.length > 0 && (
              <button
                onClick={onClearAllFaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Todas as Falhas</span>
              </button>
            )}
          </div>
        </div>

        {/* Fault Injector Panel for Educational Simulations */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Injetor Didático de Falhas Industriais
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Clique em um cenário para simular a falha na bancada
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Leak injection */}
            <button
              onClick={() => {
                onInjectFault('hose_leak');
                benchAudio.playExhaust(0.4, 0.4);
              }}
              className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
                <Wind className="w-4 h-4" />
                <span>Vazamento de Mangueira</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simula microfissura ou escape no engate rápido, gerando queda de pressão de 6 para 2.5 bar.
              </p>
            </button>

            {/* Coil Burnout */}
            <button
              onClick={() => {
                onInjectFault('coil_burnout');
                benchAudio.playWarningBeep();
              }}
              className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-red-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-1">
                <Flame className="w-4 h-4" />
                <span>Queima de Bobina Y1</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simula interrupção no enrolamento de cobre por sobretensão, impedindo a comutação eletromagnética.
              </p>
            </button>

            {/* Cylinder Rod Jam */}
            <button
              onClick={() => {
                onInjectFault('rod_jam');
                benchAudio.playWarningBeep();
              }}
              className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Travamento Mecânico</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simula corpo estranho ou desalinhamento axial impedindo o avanço completo do pistão 1A.
              </p>
            </button>

            {/* Supply Drop */}
            <button
              onClick={() => {
                onInjectFault('power_loss');
                benchAudio.playWarningBeep();
              }}
              className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
                <Zap className="w-4 h-4" />
                <span>Queda no Barramento 24V</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Simula desarme do disjuntor de proteção na fonte secundária ou perda de alimentação DC.
              </p>
            </button>
          </div>
        </div>

        {/* Active Diagnostics List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>Falhas Ativas Diagnosticadas</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-cyan-400">
                {faults.length} ocorrências
              </span>
            </h3>
          </div>

          {faults.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">
                Sistema Operando Normalmente
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Nenhuma anomalia pneumática ou elétrica detectada. As pressões, correntes e posições dos atuadores estão dentro dos limites nominais estabelecidos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {faults.map((fault) => (
                <div
                  key={fault.id}
                  className={`p-4 rounded-xl border transition shadow-lg ${
                    fault.severity === 'critical'
                      ? 'bg-red-950/30 border-red-800/80 text-red-200'
                      : fault.severity === 'warning'
                      ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-950/80 shrink-0 mt-0.5">
                        {fault.severity === 'critical' ? (
                          <AlertOctagon className="w-5 h-5 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-white border border-slate-700">
                            TAG: {fault.componentTag}
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            fault.severity === 'critical' ? 'bg-red-900 text-red-100' : 'bg-amber-900 text-amber-100'
                          }`}>
                            {fault.severity}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(fault.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white mt-1.5">
                          {fault.message}
                        </h4>

                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          <span className="font-semibold text-slate-100">Sintoma:</span> {fault.symptom}
                        </p>

                        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                          <p className="text-slate-300">
                            <span className="font-semibold text-cyan-400">Causa Raiz Provável:</span> {fault.rootCause}
                          </p>
                          <p className="text-slate-300">
                            <span className="font-semibold text-emerald-400">Ação Corretiva Recomendada:</span> {fault.recommendedAction}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Clear Fault & Create OS in Cloud DB */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end sm:self-start">
                      <button
                        onClick={() => onCreateMaintenanceFromFault(fault)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition"
                        title="Abrir Ordem de Serviço (OS) no Banco em Nuvem"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Gerar Ordem de Serviço (OS)</span>
                      </button>

                      <button
                        onClick={() => onClearFault(fault.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Solucionar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
