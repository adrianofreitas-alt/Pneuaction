import React, { useState } from 'react';
import { BenchComponent } from '../types';
import { calculateCylinderPhysics, calculateSolenoidThermalRise } from '../utils/physicsEngine';
import { 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  Gauge, 
  Wind, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

interface PhysicsViewProps {
  components: BenchComponent[];
  activePneumaticPressureBar: number;
}

export const PhysicsView: React.FC<PhysicsViewProps> = ({
  components,
  activePneumaticPressureBar
}) => {
  // Configurable physics simulation parameters
  const [boreDiameterMm, setBoreDiameterMm] = useState<number>(32);
  const [rodDiameterMm, setRodDiameterMm] = useState<number>(12);
  const [strokeLengthMm, setStrokeLengthMm] = useState<number>(160);
  const [workingPressureBar, setWorkingPressureBar] = useState<number>(activePneumaticPressureBar || 6.0);
  const [appliedLoadN, setAppliedLoadN] = useState<number>(150);
  const [solenoidActiveSeconds, setSolenoidActiveSeconds] = useState<number>(180);
  const [solenoidDutyCycle, setSolenoidDutyCycle] = useState<number>(70);

  // Compute physics equations
  const cylinderResults = calculateCylinderPhysics({
    boreDiameterMm,
    rodDiameterMm,
    strokeLengthMm,
    workingPressureBar,
    appliedLoadNewton: appliedLoadN,
    efficiency: 0.90
  });

  const thermalResults = calculateSolenoidThermalRise(solenoidActiveSeconds, solenoidDutyCycle);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Simulação Física & Resistência Mecânica dos Componentes
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Avaliação de flambagem de Euler (ISO 15552), tensão mecânica na haste, forças dinâmicas e estresse térmico de bobinas solenoides.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 border ${
              cylinderResults.isBucklingRisk 
                ? 'bg-red-950/80 text-red-400 border-red-800' 
                : 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
            }`}>
              {cylinderResults.isBucklingRisk ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>RISCO DE FLAMBAGEM DETECTADO</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>DIMENSIONAMENTO APROVADO</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Top Control Sliders for Interactive Testing */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Variáveis de Carga e Geometria do Atuador
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 text-xs">
            {/* Pressure */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Pressão de Trabalho</span>
                <span className="font-mono font-bold text-cyan-400">{workingPressureBar.toFixed(1)} bar</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                value={workingPressureBar}
                onChange={(e) => setWorkingPressureBar(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">0.1 a 1.0 MPa</span>
            </div>

            {/* Bore Diameter */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Diâmetro Êmbolo (D)</span>
                <span className="font-mono font-bold text-cyan-400">{boreDiameterMm} mm</span>
              </div>
              <input
                type="range"
                min="16"
                max="80"
                step="4"
                value={boreDiameterMm}
                onChange={(e) => setBoreDiameterMm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">Padrão ISO 15552</span>
            </div>

            {/* Rod Diameter */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Diâmetro Haste (d)</span>
                <span className="font-mono font-bold text-cyan-400">{rodDiameterMm} mm</span>
              </div>
              <input
                type="range"
                min="8"
                max="25"
                step="1"
                value={rodDiameterMm}
                onChange={(e) => setRodDiameterMm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">Aço CK45 Cromo Duro</span>
            </div>

            {/* Stroke Length */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Curso do Cilindro (L)</span>
                <span className="font-mono font-bold text-cyan-400">{strokeLengthMm} mm</span>
              </div>
              <input
                type="range"
                min="25"
                max="400"
                step="25"
                value={strokeLengthMm}
                onChange={(e) => setStrokeLengthMm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">Comprimento Livre de Avanço</span>
            </div>

            {/* Applied Load */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Carga Externa Axial (F)</span>
                <span className="font-mono font-bold text-amber-400">{appliedLoadN} N</span>
              </div>
              <input
                type="range"
                min="10"
                max="800"
                step="10"
                value={appliedLoadN}
                onChange={(e) => setAppliedLoadN(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">Resistência Externa / Peça</span>
            </div>
          </div>
        </div>

        {/* Technical Recommendation Alert Box */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          cylinderResults.isBucklingRisk 
            ? 'bg-red-950/40 border-red-800/80 text-red-200' 
            : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
        }`}>
          {cylinderResults.isBucklingRisk ? (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1">
              Parecer Técnico de Resistência dos Componentes
            </h4>
            <p className="text-xs leading-relaxed">
              {cylinderResults.recommendation}
            </p>
          </div>
        </div>

        {/* 2-Column Grid: Euler Buckling and Force Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Euler Critical Buckling & Stress Analysis */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Flambagem de Euler (Carga Crítica de Encurvamento)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Fk = (π² · E · I) / Lk²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Carga Crítica de Euler (Fk)</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {cylinderResults.eulerCriticalBucklingN} <span className="text-xs text-slate-400 font-normal">N</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Coeficiente de Segurança (S)</span>
                <p className={`text-lg font-mono font-bold mt-1 ${
                  cylinderResults.bucklingSafetyFactor < 3.5 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {cylinderResults.bucklingSafetyFactor} <span className="text-xs text-slate-400 font-normal">(Mín. 3.5)</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Tensão Normal na Haste (σ)</span>
                <p className="text-lg font-mono font-bold text-cyan-300 mt-1">
                  {cylinderResults.stressMpa} <span className="text-xs text-slate-400 font-normal">MPa</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Limite de Escoamento (Aço CK45)</span>
                <p className="text-lg font-mono font-bold text-slate-300 mt-1">
                  {cylinderResults.yieldStressSteelMpa} <span className="text-xs text-slate-400 font-normal">MPa</span>
                </p>
              </div>
            </div>

            {/* Visual Safety Bar */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-400">Margem de Segurança Estrutural</span>
                <span className="font-mono text-cyan-400">
                  {Math.min(100, Math.round((cylinderResults.bucklingSafetyFactor / 5) * 100))}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cylinderResults.bucklingSafetyFactor < 2.0 
                      ? 'bg-red-500' 
                      : cylinderResults.bucklingSafetyFactor < 3.5 
                      ? 'bg-amber-500' 
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (cylinderResults.bucklingSafetyFactor / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Column 2: Effective Forces & Consumption */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Forças de Trabalho & Consumo de Ar
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Rendimento η = 90%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Força Efetiva Avanço (Fa)</span>
                <p className="text-lg font-mono font-bold text-cyan-400 mt-1">
                  {cylinderResults.effectiveAdvanceForceN} <span className="text-xs text-slate-400 font-normal">N</span>
                </p>
                <span className="text-[10px] text-slate-500">Área Êmbolo: {cylinderResults.pistonAreaCm2} cm²</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Força Efetiva Recuo (Fr)</span>
                <p className="text-lg font-mono font-bold text-blue-400 mt-1">
                  {cylinderResults.effectiveReturnForceN} <span className="text-xs text-slate-400 font-normal">N</span>
                </p>
                <span className="text-[10px] text-slate-500">Área Anular: {cylinderResults.annularAreaCm2} cm²</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Consumo por Ciclo Duplo</span>
                <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  {cylinderResults.airConsumptionPerCycleNl} <span className="text-xs text-slate-400 font-normal">Nl</span>
                </p>
                <span className="text-[10px] text-slate-500">Condições normais (1.013 bar)</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-400">Velocidade Máxima Estimada</span>
                <p className="text-lg font-mono font-bold text-purple-400 mt-1">
                  {cylinderResults.maxStrokeVelocityMmS} <span className="text-xs text-slate-400 font-normal">mm/s</span>
                </p>
                <span className="text-[10px] text-slate-500">Com mangueira PU Ø6mm</span>
              </div>
            </div>

            {/* Comparison: Effective Force vs Applied External Load */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Força de Avanço Disponível ({cylinderResults.effectiveAdvanceForceN} N) vs Carga ({appliedLoadN} N)</span>
                <span className="font-mono text-cyan-400">
                  {((cylinderResults.effectiveAdvanceForceN / appliedLoadN) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
                {/* Available force bar */}
                <div
                  className="h-full bg-cyan-500 rounded-full"
                  style={{ width: `${Math.min(100, (cylinderResults.effectiveAdvanceForceN / (appliedLoadN * 1.5)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Solenoid Coil Thermal Stress Simulation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Simulação de Aquecimento Térmico em Bobina Solenoide (24V CC)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Classe de Isolação F (Máx 155°C) • Limite Operacional 65°C
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Tempo de Ativação Contínua</span>
                <span className="font-mono font-bold text-amber-400">{solenoidActiveSeconds} s</span>
              </div>
              <input
                type="range"
                min="10"
                max="600"
                step="10"
                value={solenoidActiveSeconds}
                onChange={(e) => setSolenoidActiveSeconds(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Fator de Operação (Duty Cycle)</span>
                <span className="font-mono font-bold text-amber-400">{solenoidDutyCycle}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={solenoidDutyCycle}
                onChange={(e) => setSolenoidDutyCycle(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-400">Temperatura da Bobina</span>
              <p className={`text-lg font-mono font-bold mt-1 ${
                thermalResults.isOverheating ? 'text-red-400' : 'text-amber-400'
              }`}>
                {thermalResults.temperatureC} °C
              </p>
              <span className="text-[10px] text-slate-500">
                {thermalResults.isOverheating ? 'Sobreaquecimento detectado!' : 'Dentro da faixa segura'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-400">Resistência Ôhmica do Cobre</span>
              <p className="text-lg font-mono font-bold text-cyan-300 mt-1">
                {thermalResults.coilResistanceOhm} Ω
              </p>
              <span className="text-[10px] text-slate-500">
                Corrente: {(24 / thermalResults.coilResistanceOhm).toFixed(2)} A
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
