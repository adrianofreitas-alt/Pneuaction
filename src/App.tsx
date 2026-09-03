/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BenchComponent, 
  VirtualConnection, 
  DiagnosticFault, 
  TelemetryMetrics 
} from './types';
import { PRESET_CIRCUITS } from './data/presets';
import { createComponentFromTemplate, ComponentTemplate } from './data/componentLibrary';
import { Header } from './components/Header';
import { BenchCanvas } from './components/BenchCanvas';
import { PhysicsView } from './components/PhysicsView';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { TestReportModal } from './components/TestReportModal';
import { PushNotificationToast } from './components/PushNotificationToast';
import { generateAutoCAD_DXF, generateTechnicalSVG, downloadFile } from './utils/cadExporter';
import { benchAudio } from './utils/audioSynthesizer';

export default function App() {
  // Navigation tab
  const [currentTab, setCurrentTab] = useState<'workbench' | 'physics' | 'telemetry'>('workbench');

  // Load initial preset (Ciclo Automático A+ A- com Válvula 5/2 biestável e Sensores)
  const initialData = PRESET_CIRCUITS[0].build();
  const [components, setComponents] = useState<BenchComponent[]>(initialData.components);
  const [connections, setConnections] = useState<VirtualConnection[]>(initialData.connections);

  // Simulation running state
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [selectedComponent, setSelectedComponent] = useState<BenchComponent | null>(null);

  // Real-time diagnostics & faults
  const [faults, setFaults] = useState<DiagnosticFault[]>([]);
  const [latestCriticalFault, setLatestCriticalFault] = useState<DiagnosticFault | null>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [testDurationSeconds, setTestDurationSeconds] = useState<number>(0);

  // Telemetry metrics
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    mainPressureBar: 6.0,
    flowRateNlMin: 120,
    totalAirConsumedLiters: 48,
    voltage24V: 24.1,
    currentAmperes: 0.28,
    powerWatts: 6.7,
    manifoldTempC: 24.2,
    totalCycles: 14,
    cycleFrequencyHz: 0.35,
    healthIndexScore: 98,
    emergencyStatus: false,
    iotGatewayOnline: true,
    lastUpdated: new Date().toISOString()
  });

  // Keep track of session time
  useEffect(() => {
    const timer = setInterval(() => {
      setTestDurationSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------------------------------
  // CORE SIMULATION ENGINE LOOP (Runs every 100ms)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isSimulating || isEmergencyActive) {
      // If emergency stopped, drop pressure and set zero flow
      if (isEmergencyActive) {
        setMetrics(m => ({ ...m, emergencyStatus: true, flowRateNlMin: 0 }));
      }
      return;
    }

    const interval = setInterval(() => {
      setComponents((prevComps) => {
        const nextComps = [...prevComps];

        // Find main cylinder (1A) and 5/2 valve (1V)
        const cylIndex = nextComps.findIndex(c => c.category === 'actuators');
        const valveIndex = nextComps.findIndex(c => c.category === 'valves');
        const sensor1Index = nextComps.findIndex(c => c.tag === '1S1');
        const sensor2Index = nextComps.findIndex(c => c.tag === '1S2');

        if (cylIndex !== -1 && valveIndex !== -1) {
          const cyl = nextComps[cylIndex];
          const valve = nextComps[valveIndex];
          const hasLeak = nextComps.some(c => c.faults?.isLeaking);
          const hasStuck = cyl.faults?.isStuck;
          const hasCoilBurn = valve.faults?.isCoilBurned;

          // Check if circuit has electrical power
          const powerSupplyComp = nextComps.find(c => c.type === 'power_supply_24v');
          const isPowerSupplyOn = powerSupplyComp ? powerSupplyComp.state.activated !== false : true;
          const hasElectricalPower = !isEmergencyActive && isPowerSupplyOn;

          // Check if valve has power or manual override
          let valvePos = valve.state.valvePosition || 'left';
          let pos = cyl.state.position || 0;
          const speed = (cyl.state.flowThrottlePercent || 40) * 0.08;

          // Simulation of automatic continuous oscillation or button-driven
          if (!hasStuck) {
            if (valvePos === 'left') {
              // Chamber 4 pressurized -> Advance towards 100%
              if (pos < 100) {
                pos = Math.min(100, pos + speed);
              } else {
                // Reached end of stroke (100%)
                if (sensor2Index !== -1) {
                  nextComps[sensor2Index].state.sensorDetected = true;
                }
                // If bi-stable automatic cycle, switch spool to return (requires electrical power)
                if (valve.type === 'valve_5_2_double_solenoid' && !hasCoilBurn && hasElectricalPower) {
                  valvePos = 'right';
                  benchAudio.playExhaust(0.18, 0.25);
                }
              }
            } else {
              // Chamber 2 pressurized -> Return towards 0%
              if (pos > 0) {
                pos = Math.max(0, pos - speed);
              } else {
                // Reached home position (0%)
                if (sensor1Index !== -1) {
                  nextComps[sensor1Index].state.sensorDetected = true;
                }
                // Switch spool back to advance (requires electrical power)
                if (valve.type === 'valve_5_2_double_solenoid' && !hasCoilBurn && hasElectricalPower) {
                  valvePos = 'left';
                  benchAudio.playExhaust(0.18, 0.25);
                  // Increment full cycle
                  setMetrics(m => ({
                    ...m,
                    totalCycles: m.totalCycles + 1,
                    totalAirConsumedLiters: m.totalAirConsumedLiters + 0.85
                  }));
                }
              }
            }
          }

          // Update sensors
          if (sensor1Index !== -1) {
            nextComps[sensor1Index].state.sensorDetected = pos <= 5;
          }
          if (sensor2Index !== -1) {
            nextComps[sensor2Index].state.sensorDetected = pos >= 95;
          }

          nextComps[cylIndex] = {
            ...cyl,
            state: { ...cyl.state, position: pos }
          };

          nextComps[valveIndex] = {
            ...valve,
            state: {
              ...valve.state,
              valvePosition: valvePos,
              solenoidLeftActive: hasElectricalPower && valvePos === 'left' && !hasCoilBurn,
              solenoidRightActive: hasElectricalPower && valvePos === 'right' && !hasCoilBurn
            }
          };
        }

        return nextComps;
      });

      // Update telemetry
      setMetrics(prev => {
        const hasLeak = components.some(c => c.faults?.isLeaking);
        const effectivePressure = hasLeak ? 2.8 : 6.0;
        const currentFlow = Math.max(10, Math.min(340, Math.round(150 + Math.sin(Date.now() / 600) * 80)));
        const isPowerLost = faults.some(f => f.id.includes('power'));
        const powerSupplyComp = components.find(c => c.type === 'power_supply_24v');
        const isPowerSupplyOff = powerSupplyComp ? powerSupplyComp.state.activated === false : false;
        const voltage = isEmergencyActive || isPowerLost || isPowerSupplyOff ? 0.0 : 24.0;
        const current = voltage === 0 ? 0.0 : 0.25 + (Math.random() * 0.02);

        return {
          ...prev,
          mainPressureBar: effectivePressure,
          flowRateNlMin: isEmergencyActive ? 0 : currentFlow,
          voltage24V: voltage,
          currentAmperes: current,
          powerWatts: Number((voltage * current).toFixed(2)),
          manifoldTempC: Math.min(48, prev.manifoldTempC + 0.005),
          lastUpdated: new Date().toISOString()
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulating, isEmergencyActive, components]);

  // --------------------------------------------------------------------------
  // ACTIONS & HANDLERS
  // --------------------------------------------------------------------------
  const handleToggleEmergency = () => {
    const newState = !isEmergencyActive;
    setIsEmergencyActive(newState);
    benchAudio.playWarningBeep();

    if (newState) {
      const emergencyFault: DiagnosticFault = {
        id: `fault_emerg_${Date.now()}`,
        componentId: 'emerg',
        componentTag: 'EMERGÊNCIA',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        message: 'PARADA DE EMERGÊNCIA ATIVADA (NR-12)',
        symptom: 'Circuito elétrico de comando desenergizado e retenção mecânica acionada.',
        rootCause: 'Operador acionou o botão cogumelo de segurança.',
        recommendedAction: 'Girar o botão no sentido horário para destravar e restabelecer alimentação.'
      };
      setFaults(prev => [emergencyFault, ...prev]);
      setLatestCriticalFault(emergencyFault);
    } else {
      setFaults(prev => prev.filter(f => !f.id.includes('emerg')));
    }
  };

  const handleResetBench = () => {
    setIsSimulating(false);
    setComponents(prev =>
      prev.map(c => ({
        ...c,
        state: { ...c.state, position: 0, valvePosition: 'left' }
      }))
    );
    benchAudio.playExhaust(0.3, 0.3);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_CIRCUITS.find(p => p.id === presetId);
    if (!preset) return;
    const built = preset.build();
    setComponents(built.components);
    setConnections(built.connections);
    setFaults([]);
    setSelectedComponent(null);
    benchAudio.playRelayClick();
  };

  const handleAddComponent = (template: ComponentTemplate) => {
    const existingCount = components.filter(c => c.type === template.type).length;
    const newComp = createComponentFromTemplate(
      template,
      100 + Math.random() * 200,
      100 + Math.random() * 150,
      existingCount + 1
    );
    setComponents(prev => [...prev, newComp]);
    benchAudio.playRelayClick();
  };

  const handleDeleteComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
    setConnections(prev => prev.filter(cn => cn.fromComponentId !== id && cn.toComponentId !== id));
    if (selectedComponent?.id === id) {
      setSelectedComponent(null);
    }
  };

  // Manual valve spool override
  const handleTriggerManualOverride = (componentId: string) => {
    setComponents(prev =>
      prev.map(c => {
        if (c.id === componentId) {
          const newPos = c.state.valvePosition === 'left' ? 'right' : 'left';
          benchAudio.playExhaust(0.15, 0.25);
          return {
            ...c,
            state: { ...c.state, valvePosition: newPos }
          };
        }
        return c;
      })
    );
  };

  const handlePressButton = (componentId: string, buttonType: 'NA' | 'NF') => {
    setComponents(prev =>
      prev.map(c => {
        if (c.id === componentId) {
          benchAudio.playRelayClick();
          return {
            ...c,
            state: {
              ...c.state,
              buttonNApressed: buttonType === 'NA' ? true : c.state.buttonNApressed,
              buttonNFpressed: buttonType === 'NF' ? true : c.state.buttonNFpressed,
            }
          };
        }
        return c;
      })
    );
  };

  const handleReleaseButton = (componentId: string, buttonType: 'NA' | 'NF') => {
    setComponents(prev =>
      prev.map(c => {
        if (c.id === componentId) {
          return {
            ...c,
            state: {
              ...c.state,
              buttonNApressed: buttonType === 'NA' ? false : c.state.buttonNApressed,
              buttonNFpressed: buttonType === 'NF' ? false : c.state.buttonNFpressed,
            }
          };
        }
        return c;
      })
    );
  };

  // Fault Injection
  const handleInjectFault = (faultType: string) => {
    let newFault: DiagnosticFault | null = null;

    if (faultType === 'hose_leak') {
      newFault = {
        id: `fault_leak_${Date.now()}`,
        componentId: components[0]?.id || 'sys',
        componentTag: '1A-P1',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        message: 'Queda Severa de Pressão na Linha de Alimentação (Vazamento)',
        symptom: 'Pressão caiu de 6.0 para 2.8 bar com ruído contínuo de escape de ar.',
        rootCause: 'Fissura na mangueira PU de 6mm ou desacoplamento parcial no engate rápido.',
        recommendedAction: 'Inspecionar a linha pneumática, cortar a extremidade danificada da mangueira e reconectar.'
      };
      setComponents(prev =>
        prev.map((c, i) => i === 0 ? { ...c, faults: { ...c.faults, isLeaking: true } } : c)
      );
    } else if (faultType === 'coil_burnout') {
      const valve = components.find(c => c.category === 'valves');
      newFault = {
        id: `fault_coil_${Date.now()}`,
        componentId: valve?.id || 'valve',
        componentTag: valve?.tag || '1V',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        message: 'Bobina do Solenoide Y1 Queimada (Circuito Aberto)',
        symptom: 'Válvula não comuta quando o botão de avanço é pressionado, mesmo com sinal 24V presente.',
        rootCause: 'Sobretensão ou ciclo de trabalho excessivo rompeu o enrolamento de cobre da bobina Y1.',
        recommendedAction: 'Medir resistência da bobina com multímetro (R = ∞) e substituir o solenoide 24VCC.'
      };
      if (valve) {
        setComponents(prev =>
          prev.map(c => c.id === valve.id ? { ...c, faults: { ...c.faults, isCoilBurned: true } } : c)
        );
      }
    } else if (faultType === 'rod_jam') {
      const cyl = components.find(c => c.category === 'actuators');
      newFault = {
        id: `fault_jam_${Date.now()}`,
        componentId: cyl?.id || 'cyl',
        componentTag: cyl?.tag || '1A',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        message: 'Travamento Mecânico na Haste do Cilindro 1A',
        symptom: 'Cilindro parou no meio do curso (50%) com pressão máxima sem movimento.',
        rootCause: 'Obstrução física na guia externa ou flambagem residual da haste por esforço lateral.',
        recommendedAction: 'Despressurizar a bancada, remover esforço radial e verificar alinhamento do suporte.'
      };
      if (cyl) {
        setComponents(prev =>
          prev.map(c => c.id === cyl.id ? { ...c, faults: { ...c.faults, isStuck: true } } : c)
        );
      }
    } else if (faultType === 'power_loss') {
      newFault = {
        id: `fault_power_${Date.now()}`,
        componentId: 'ps',
        componentTag: '0G',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        message: 'Ausência de Tensão no Barramento 24V CC',
        symptom: 'Nenhum relé ou solenoide aciona; LEDs de estado apagados.',
        rootCause: 'Disjuntor termomagnético desarmado ou cabo de alimentação rompido.',
        recommendedAction: 'Verificar bornes de saída da fonte 24V e rearme do disjuntor de comando.'
      };
    }

    if (newFault) {
      setFaults(prev => [newFault!, ...prev]);
      if (newFault.severity === 'critical') {
        setLatestCriticalFault(newFault);
      }
    }
  };

  const handleClearFault = (faultId: string) => {
    setFaults(prev => prev.filter(f => f.id !== faultId));
    setComponents(prev =>
      prev.map(c => ({
        ...c,
        faults: { isLeaking: false, isCoilBurned: false, isStuck: false }
      }))
    );
  };

  const handleClearAllFaults = () => {
    setFaults([]);
    setComponents(prev =>
      prev.map(c => ({
        ...c,
        faults: { isLeaking: false, isCoilBurned: false, isStuck: false }
      }))
    );
  };

  // CAD Export
  const handleExportCAD = (format: 'dxf' | 'svg' | 'json') => {
    if (format === 'dxf') {
      const dxfContent = generateAutoCAD_DXF(components, connections);
      downloadFile('Esquema_Eletropneumatico_AutoCAD.dxf', dxfContent, 'application/dxf');
    } else if (format === 'svg') {
      const svgContent = generateTechnicalSVG(components, connections);
      downloadFile('Esquema_Eletropneumatico_ISO1219.svg', svgContent, 'image/svg+xml');
    } else {
      const jsonContent = JSON.stringify({ components, connections, metrics }, null, 2);
      downloadFile('Projeto_Bancada_Eletropneumatica.json', jsonContent, 'application/json');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Header Navigation */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        isEmergencyActive={isEmergencyActive}
        onToggleEmergency={handleToggleEmergency}
        onResetBench={handleResetBench}
        onLoadPreset={handleLoadPreset}
        onExportCAD={handleExportCAD}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        activeFaultsCount={faults.length}
        unreadNotifications={faults.filter(f => f.severity === 'critical').length}
      />

      {/* Main Viewport Content based on active tab */}
      <div className="flex-1 flex overflow-hidden relative">
        {currentTab === 'workbench' && (
          <BenchCanvas
            components={components}
            connections={connections}
            onUpdateComponents={setComponents}
            onUpdateConnections={setConnections}
            isSimulating={isSimulating && !isEmergencyActive}
            onAddComponent={handleAddComponent}
            onDeleteComponent={handleDeleteComponent}
            selectedComponent={selectedComponent}
            onSelectComponent={setSelectedComponent}
            onTriggerManualOverride={handleTriggerManualOverride}
            onPressButton={handlePressButton}
            onReleaseButton={handleReleaseButton}
          />
        )}

        {currentTab === 'physics' && (
          <PhysicsView
            components={components}
            activePneumaticPressureBar={metrics.mainPressureBar}
          />
        )}

        {currentTab === 'telemetry' && (
          <TelemetryDashboard
            metrics={metrics}
            isSimulating={isSimulating}
            isEmergencyActive={isEmergencyActive}
            onToggleEmergency={handleToggleEmergency}
            activeFaultsCount={faults.length}
          />
        )}
      </div>

      {/* Detailed Test Report Modal */}
      <TestReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        components={components}
        connections={connections}
        faults={faults}
        metrics={metrics}
        testDurationSeconds={testDurationSeconds}
      />

      {/* Real-time Push Notification Toast for Critical Faults */}
      <PushNotificationToast
        fault={latestCriticalFault}
        onDismiss={() => setLatestCriticalFault(null)}
        onNavigateDiagnostics={() => setCurrentTab('telemetry')}
      />
    </div>
  );
}
