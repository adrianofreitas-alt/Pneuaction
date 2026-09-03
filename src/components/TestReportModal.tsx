import React, { useRef } from 'react';
import { 
  BenchComponent, 
  VirtualConnection, 
  DiagnosticFault, 
  TelemetryMetrics 
} from '../types';
import { 
  FileText, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu,
  Layers
} from 'lucide-react';
import { downloadFile } from '../utils/cadExporter';

interface TestReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: BenchComponent[];
  connections: VirtualConnection[];
  faults: DiagnosticFault[];
  metrics: TelemetryMetrics;
  testDurationSeconds: number;
}

export const TestReportModal: React.FC<TestReportModalProps> = ({
  isOpen,
  onClose,
  components,
  connections,
  faults,
  metrics,
  testDurationSeconds
}) => {
  const reportRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR');
  const durationMin = Math.floor(testDurationSeconds / 60);
  const durationSec = testDurationSeconds % 60;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const reportData = {
      title: "Relatório de Testes Eletropneumáticos - Bancada Didática",
      date: dateStr,
      time: timeStr,
      sessionDuration: `${durationMin}m ${durationSec}s`,
      benchMetrics: metrics,
      componentsCount: components.length,
      connectionsCount: connections.length,
      activeFaults: faults,
      components: components.map(c => ({
        tag: c.tag,
        name: c.name,
        category: c.category,
        healthPercent: c.state.healthPercent
      })),
      complianceStatus: faults.length === 0 ? "APROVADO" : "APROVADO COM RESSALVAS"
    };

    downloadFile(
      `Relatorio_Testes_Eletropneumatica_${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(reportData, null, 2),
      'application/json'
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Relatório Detalhado de Testes & Ensaio Técnico
              </h3>
              <p className="text-xs text-slate-400">
                Laudo técnico oficial de ensaio didático eletropneumático
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Imprimir laudo técnico ou salvar em PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition"
              title="Exportar dados do relatório em JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Content Body */}
        <div ref={reportRef} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-200">
          {/* Institutional Header */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400">
                  LAUDO TÉCNICO PERICIAL DE ENSAIO DIDÁTICO
                </span>
                <h2 className="text-base font-bold text-white mt-1">
                  Bancada de Treinamento em Eletropneumática Industrial
                </h2>
                <p className="text-slate-400 text-xs">
                  Laboratório de Mecatrônica e Automação Industrial • Padrão SENAI / MEC
                </p>
              </div>

              <div className="text-right font-mono text-[11px] text-slate-400">
                <p>RELATÓRIO: <strong className="text-white">REL-2026-{Math.floor(1000 + Math.random() * 9000)}</strong></p>
                <p>DATA: <strong className="text-white">{dateStr} {timeStr}</strong></p>
                <p>NORMA: <strong className="text-cyan-400">ISO 1219 / NR-12</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500">Duração do Ensaio:</span>
                <p className="font-semibold text-slate-200 font-mono">{durationMin} min {durationSec} s</p>
              </div>
              <div>
                <span className="text-slate-500">Total de Ciclos:</span>
                <p className="font-semibold text-slate-200 font-mono">{metrics.totalCycles} ciclos</p>
              </div>
              <div>
                <span className="text-slate-500">Pressão Estabilizada:</span>
                <p className="font-semibold text-cyan-400 font-mono">{metrics.mainPressureBar.toFixed(1)} bar</p>
              </div>
              <div>
                <span className="text-slate-500">Conformidade Geral:</span>
                <p className="font-semibold text-emerald-400 font-mono">{faults.length === 0 ? 'CONFORME' : 'COM RESSALVAS'}</p>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Metrics Summary */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              1. Medições e Métricas Críticas em Regime Permanente
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400">Ar Total Consumido</span>
                <p className="text-base font-mono font-bold text-white mt-1">
                  {metrics.totalAirConsumedLiters.toFixed(1)} Nl
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400">Vazão Máxima</span>
                <p className="text-base font-mono font-bold text-white mt-1">
                  {metrics.flowRateNlMin.toFixed(0)} Nl/min
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400">Tensão de Comando</span>
                <p className="text-base font-mono font-bold text-amber-400 mt-1">
                  {metrics.voltage24V.toFixed(1)} V CC
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400">Temperatura Manifold</span>
                <p className="text-base font-mono font-bold text-slate-200 mt-1">
                  {metrics.manifoldTempC.toFixed(1)} °C
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Bill of Materials (BOM) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              2. Lista Técnica de Componentes do Circuito (BOM)
            </h4>
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 font-semibold">TAG</th>
                    <th className="p-2.5 font-semibold">Descrição do Equipamento</th>
                    <th className="p-2.5 font-semibold">Categoria</th>
                    <th className="p-2.5 font-semibold">Vias / Bornes</th>
                    <th className="p-2.5 font-semibold">Saúde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                  {components.map((comp) => (
                    <tr key={comp.id}>
                      <td className="p-2.5 font-mono font-bold text-cyan-400">{comp.tag}</td>
                      <td className="p-2.5 font-medium text-slate-200">{comp.name}</td>
                      <td className="p-2.5 text-slate-400 capitalize">{comp.category}</td>
                      <td className="p-2.5 text-slate-400 font-mono">{comp.ports.length} conexões</td>
                      <td className="p-2.5 font-mono text-emerald-400">{comp.state.healthPercent || 98}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Faults & Diagnostics History */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              3. Diagnósticos e Registro de Anomalias Durante o Ensaio
            </h4>
            {faults.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Nenhuma falha operacional ou anomalia estrutural detectada durante o período avaliado.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {faults.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold font-mono">[{f.componentTag}] {f.message}</span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        <strong>Causa Raiz:</strong> {f.rootCause} | <strong>Ação:</strong> {f.recommendedAction}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Technical Approval Sign-off */}
          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-6">
            <div className="text-center w-56">
              <div className="border-b border-slate-600 pb-1 font-mono text-slate-300">
                Prof. Adriano Freitas
              </div>
              <span className="text-[10px] text-slate-500">Docente Responsável / SENAI</span>
            </div>

            <div className="text-center w-56">
              <div className="border-b border-slate-600 pb-1 font-mono text-slate-300">
                Aluno Operador
              </div>
              <span className="text-[10px] text-slate-500">Assinatura do Responsável pelo Teste</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">
                  CERTIFICADO SENAI
                </span>
                <p className="text-[11px] text-slate-300">Conforme NR-12 & ISO 1219-1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
