import React, { useState } from 'react';
import { BenchComponent, VirtualConnection } from '../types';
import { evaluateTechnicalCompliance, ComplianceEvaluation } from '../utils/complianceEngine';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Loader2, 
  FileCheck2, 
  Printer, 
  RefreshCw 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ComplianceViewProps {
  components: BenchComponent[];
  connections: VirtualConnection[];
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  components,
  connections
}) => {
  const [evaluation, setEvaluation] = useState<ComplianceEvaluation>(() =>
    evaluateTechnicalCompliance(components, connections)
  );
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleRefresh = () => {
    setEvaluation(evaluateTechnicalCompliance(components, connections));
  };

  const handleRunAiAudit = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: components.map(c => ({ tag: c.tag, name: c.name, type: c.type })),
          connections: connections.map(cn => ({ type: cn.type, from: cn.fromComponentId, to: cn.toComponentId })),
          complianceScore: evaluation.score,
          checks: evaluation.checks
        })
      });

      const data = await res.json();
      if (data.analysis) {
        setAiReport(data.analysis);
      } else if (data.fallback) {
        setAiReport(data.fallback);
      } else if (data.error) {
        setAiError(data.error);
      }
    } catch (err: any) {
      setAiError("Não foi possível conectar ao endpoint de IA Gemini no servidor.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Relatórios de Conformidade Técnica Automatizados
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Auditoria normativa automatizada conforme NR-12 (Segurança em Máquinas), ISO 4414, ISO 1219-1/2 e IEC 60204-1.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reavaliar Circuito</span>
            </button>

            <button
              onClick={handleRunAiAudit}
              disabled={isLoadingAi}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-md transition disabled:opacity-50"
            >
              {isLoadingAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Auditando com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auditoria Pericial Gemini AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Compliance Summary Score Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Radial or Big Score */}
              <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center border ${
                evaluation.score >= 90
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                  : evaluation.score >= 60
                  ? 'bg-amber-950/40 border-amber-500 text-amber-400'
                  : 'bg-red-950/40 border-red-500 text-red-400'
              }`}>
                <span className="text-3xl font-mono font-black">{evaluation.score}%</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Índice</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Status Geral: {evaluation.status}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  {evaluation.summaryText}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="text-center px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Total de Verificações</span>
                <p className="text-lg font-mono font-bold text-white">{evaluation.checks.length}</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Aprovados</span>
                <p className="text-lg font-mono font-bold text-emerald-400">
                  {evaluation.checks.filter(c => c.status === 'passed').length}
                </p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Não Conformidades</span>
                <p className="text-lg font-mono font-bold text-red-400">
                  {evaluation.checks.filter(c => c.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Audit Report Result (if generated) */}
        {aiReport && (
          <div className="bg-slate-900 border border-purple-800/60 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-purple-800/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-purple-200">
                  Parecer Pericial de Engenharia Gerado por Inteligência Artificial (Gemini)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                gemini-3.8-flash
              </span>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-2 markdown-body">
              <ReactMarkdown>{aiReport}</ReactMarkdown>
            </div>
          </div>
        )}

        {aiError && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Detailed Normative Checks Checklist */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Itens Auditados por Norma Técnica
          </h3>

          <div className="space-y-3">
            {evaluation.checks.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md flex items-start gap-3.5"
              >
                <div className="shrink-0 mt-0.5">
                  {item.status === 'passed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : item.status === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                      {item.standard}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {item.clause}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      item.status === 'passed'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : item.status === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}>
                      {item.status === 'passed' ? 'Conforme' : item.status === 'warning' ? 'Advertência' : 'Não Conforme'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-1.5">
                    {item.title}
                  </h4>

                  <p className="text-slate-300 mt-1 leading-relaxed">
                    {item.details}
                  </p>

                  <div className="mt-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400">
                    <span className="font-semibold text-slate-200">Recomendação:</span> {item.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
