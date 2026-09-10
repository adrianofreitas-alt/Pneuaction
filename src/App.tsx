/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Maximize, Minimize } from 'lucide-react';
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
import { evaluateCircuitElectricalState } from './utils/circuitSimulator';

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

  // Modals & UI State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(true);
  const [testDurationSeconds, setTestDurationSeconds] = useState<number>(0);

  // Zoom and Cursor Position state (controlados na barra do Header)
  const [zoom, setZoom] = useState<number>(1);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(false);
  const [canvasMousePos, setCanvasMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomControlsRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitScreen: () => void;
    centerOnCursor: () => void;
  } | null>(null);

  const handleRegisterZoomControls = (controls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitScreen: () => void;
    centerOnCursor: () => void;
  }) => {
    zoomControlsRef.current = controls;
  };

  // Fullscreen state (Modo Painel Puro: exibe somente o painel e seus componentes)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next && currentTab !== 'workbench') {
        setCurrentTab('workbench');
      }
      try {
        if (next) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } catch {
        // Fallback gracioso se bloqueado por iframe sandbox
      }
      setTimeout(() => {
        zoomControlsRef.current?.fitScreen();
      }, 70);
      return next;
    });
  };

  // Escuta tecla Escape e evento fullscreenchange do navegador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleToggleFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => {
          zoomControlsRef.current?.fitScreen();
        }, 70);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

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

          // Real-time calculation of cylinder rod tip sphere position (with 0°, 90°, 180°, 270° rotation)
          const cylRot = cyl.rotation || 0;
          const strokeTravel = cyl.type === 'single_acting_cylinder' ? 200 : 300;
          const strokeOffset = cyl.type === 'single_acting_cylinder' ? 20 : 25;
          const rawSphereX = cyl.width + strokeOffset + (pos / 100) * strokeTravel;
          const rawSphereY = cyl.type === 'single_acting_cylinder' ? 50 : 60;
          let sphereX = cyl.x + rawSphereX;
          let sphereY = cyl.y + rawSphereY;

          if (cylRot) {
            const cx = cyl.width / 2;
            const cy = cyl.height / 2;
            const dx = rawSphereX - cx;
            const dy = rawSphereY - cy;
            const rad = (cylRot * Math.PI) / 180;
            sphereX = cyl.x + cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
            sphereY = cyl.y + cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
          }

          // 1. Update physical proximity detection for all sensors
          // A atuação dos sensores ocorre quando a esfera da haste do cilindro estiver próxima do sensor
          // e alinhada pelo centro da tampa do sensor e o alinhamento vertical do centro da esfera.
          // Sem precisar haver contato físico (com entreferro livre de ar na escala industrial).
          const sphereRadius = cyl.type === 'single_acting_cylinder' ? 9 : 10;
          const sphereBottomY = sphereY + sphereRadius;

          nextComps.forEach(comp => {
            if (comp.type === 'reed_switch_sensor') {
              const sensorCapCenterX = comp.x + comp.width / 2; // Centro horizontal da tampa (55)
              const sensorCapCenterY = comp.y + 15; // Centro vertical da tampa
              const sensorCapTopY = comp.y + 12; // Crista superior da tampa

              // Alinhamento vertical do centro da esfera com o centro da tampa do sensor
              const isVerticalAligned = Math.abs(sphereX - sensorCapCenterX) <= 16;

              // Proximidade sem contato físico (haste/esfera passam próximas com entreferro livre sem sobreposição)
              const verticalCenterDist = sensorCapCenterY - sphereY;
              const airGap = sensorCapTopY - sphereBottomY;
              const isNearWithoutContact = airGap >= 3 && verticalCenterDist >= 20 && verticalCenterDist <= 60;

              comp.state.sensorDetected = isVerticalAligned && isNearWithoutContact;
            }
          });

          // 2. Perform graph electrical circuit evaluation (IEC 60947-5-2)
          // Verifies correct power supply to sensors (BN: 24V, BU: 0V) and signal propagation to solenoids
          const circuitEval = evaluateCircuitElectricalState(nextComps, connections, isEmergencyActive);

          // 3. Update sensor power validation and diagnostics
          nextComps.forEach(comp => {
            if (comp.type === 'reed_switch_sensor') {
              const status = circuitEval.sensorStatuses.get(comp.id);
              if (status) {
                comp.state.isPowerCorrect = status.isPowerCorrect;
                comp.state.powerErrorDetail = status.errorDetail;
              }
            }
          });

          // 4. Update Industrial Relays (Auxiliary Relay K1 - 4 Reversible Contacts COM/NF/NA)
          // Bobina atua quando A2 estiver ligado no 0V e A1 receber +24V.
          // Quando cessar o sinal elétrico em A1, os contatos voltam imediatamente à posição de repouso (NF).
          nextComps.forEach((comp, idx) => {
            if (comp.type === 'industrial_relay') {
              const relayStatus = circuitEval.relayStatuses?.get(comp.id);
              const isCoilEnergized = Boolean(relayStatus?.isCoilEnergized && hasElectricalPower);
              const wasSwitched = Boolean(comp.state.isRelaySwitched ?? comp.state.activated);

              if (isCoilEnergized !== wasSwitched) {
                benchAudio.playRelayClick();
              }

              nextComps[idx] = {
                ...comp,
                state: {
                  ...comp.state,
                  isCoilEnergized,
                  isRelaySwitched: isCoilEnergized,
                  activated: isCoilEnergized,
                }
              };
            }
          });

          // 5. Update Timer Relays (On-Delay & Off-Delay - 2 Reversible Contacts COM/NF/NA)
          // Bobina atua quando A2 estiver ligado no 0V e A1 receber +24V, respeitando a automação de tempo.
          // On-Delay (TON): Conta tempo com bobina energizada; comuta após decorrido o tempo. Cessa sinal A1 -> reseta imediatamente para repouso (NF).
          // Off-Delay (TOF): Comuta instantaneamente ao energizar bobina. Cessa sinal A1 -> temporiza retardo no desligamento, voltando para repouso (NF) ao término.
          nextComps.forEach((comp, idx) => {
            if (comp.type === 'industrial_relay_on_delay') {
              const status = circuitEval.relayStatuses?.get(comp.id);
              const isPowered = Boolean(status?.isPowered && hasElectricalPower);
              const isCoilEnergized = Boolean(status?.isCoilEnergized && isPowered);
              const delaySec = Math.max(0.5, comp.state.timerDelaySec ?? 5.0);
              let elapsed = comp.state.timerElapsedSec ?? 0.0;
              let isSwitched = comp.state.isRelaySwitched ?? false;
              let isTiming = false;

              if (!isPowered) {
                elapsed = 0.0;
                isSwitched = false;
                isTiming = false;
              } else if (isCoilEnergized) {
                if (!isSwitched) {
                  isTiming = true;
                  elapsed = Math.min(delaySec, Number((elapsed + 0.1).toFixed(2)));
                  if (elapsed >= delaySec) {
                    isSwitched = true;
                    isTiming = false;
                    benchAudio.playRelayClick();
                  }
                }
              } else {
                // Bobina desenergizada (sinal em A1 cessou) -> reseta e volta contatos para repouso
                if (isSwitched) {
                  benchAudio.playRelayClick();
                }
                elapsed = 0.0;
                isSwitched = false;
                isTiming = false;
              }

              const remaining = Math.max(0, Number((delaySec - elapsed).toFixed(1)));
              nextComps[idx] = {
                ...comp,
                state: {
                  ...comp.state,
                  timerDelaySec: delaySec,
                  timerElapsedSec: elapsed,
                  timerRemainingSec: remaining,
                  isTiming,
                  isRelaySwitched: isSwitched,
                  activated: isSwitched,
                  isPowered,
                  isCoilEnergized,
                }
              };
            } else if (comp.type === 'industrial_relay_off_delay') {
              const status = circuitEval.relayStatuses?.get(comp.id);
              const isPowered = Boolean(status?.isPowered && hasElectricalPower);
              const isCoilEnergized = Boolean(status?.isCoilEnergized && isPowered);
              const delaySec = Math.max(0.5, comp.state.timerDelaySec ?? 5.0);
              let elapsed = comp.state.timerElapsedSec ?? 0.0;
              let isSwitched = comp.state.isRelaySwitched ?? false;
              let isTiming = false;

              if (!isPowered) {
                elapsed = 0.0;
                isSwitched = false;
                isTiming = false;
              } else if (isCoilEnergized) {
                // Bobina energizada (A1 com 24V e A2 com 0V): comuta instantaneamente e mantém zerado
                if (!isSwitched) {
                  benchAudio.playRelayClick();
                }
                isSwitched = true;
                elapsed = 0.0;
                isTiming = false;
              } else {
                // Bobina desenergizada (sinal em A1 cessou) mas com alimentação: inicia retardo de desligamento
                if (isSwitched) {
                  isTiming = true;
                  elapsed = Math.min(delaySec, Number((elapsed + 0.1).toFixed(2)));
                  if (elapsed >= delaySec) {
                    isSwitched = false;
                    isTiming = false;
                    elapsed = 0.0;
                    benchAudio.playRelayClick();
                  }
                }
              }

              const remaining = Math.max(0, Number((delaySec - elapsed).toFixed(1)));
              nextComps[idx] = {
                ...comp,
                state: {
                  ...comp.state,
                  timerDelaySec: delaySec,
                  timerElapsedSec: elapsed,
                  timerRemainingSec: remaining,
                  isTiming,
                  isRelaySwitched: isSwitched,
                  activated: isSwitched,
                  isPowered,
                  isCoilEnergized,
                }
              };
            }
          });

          // 6. Pass 2: Re-evaluate circuit to propagate switched relay contacts to solenoids and loads
          const finalCircuitEval = evaluateCircuitElectricalState(nextComps, connections, isEmergencyActive);

          // 7. Valve solenoids electrical actuation
          const y1Active = finalCircuitEval.solenoidY1Active && !hasCoilBurn;
          const y2Active = finalCircuitEval.solenoidY2Active && !hasCoilBurn;

          if (valve.type === 'valve_5_2_double_solenoid') {
            // Bistable valve spool memory:
            // Y1 energization drives spool to 'left' (Advance)
            // Y2 energization drives spool to 'right' (Retract)
            const activeY2Sensor = y2Active ? nextComps.find(c => c.type === 'reed_switch_sensor' && c.state.sensorDetected) : undefined;
            const activeY1Sensor = y1Active ? nextComps.find(c => c.type === 'reed_switch_sensor' && c.state.sensorDetected) : undefined;
            
            const y2TargetX = activeY2Sensor ? activeY2Sensor.x + activeY2Sensor.width / 2 : undefined;
            const y1TargetX = activeY1Sensor ? activeY1Sensor.x + activeY1Sensor.width / 2 : undefined;

            if (y1Active && !y2Active && valvePos !== 'left') {
              const readyToAdvance = y1TargetX !== undefined ? (sphereX <= y1TargetX || pos <= 0) : true;
              if (readyToAdvance) {
                valvePos = 'left';
                benchAudio.playExhaust(0.18, 0.25);
              }
            } else if (y2Active && !y1Active && valvePos !== 'right') {
              const readyToRetract = y2TargetX !== undefined ? (sphereX >= y2TargetX || pos >= 100) : true;
              if (readyToRetract) {
                valvePos = 'right';
                benchAudio.playExhaust(0.18, 0.25);
              }
            }
          } else if (valve.type === 'valve_5_2_single_solenoid') {
            // Válvula 5/2 vias simples solenoide com retorno por mola (spring return):
            // Quando a solenoide Y1 é energizada, o carretel avança para 'left'.
            // Quando a solenoide Y1 é desenergizada, a mola retorna o carretel para 'right'.
            if (y1Active) {
              valvePos = 'left';
            } else {
              valvePos = 'right';
            }
          }

          // 8. Cylinder physical displacement based on valve position
          if (!hasStuck) {
            if (valvePos === 'left') {
              // Chamber 4 pressurized -> Advance towards 100%
              if (pos < 100) {
                pos = Math.min(100, pos + speed);
              }
            } else {
              // Chamber 2 pressurized -> Return towards 0%
              if (pos > 0) {
                pos = Math.max(0, pos - speed);
                if (pos === 0) {
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

          nextComps[cylIndex] = {
            ...cyl,
            state: { ...cyl.state, position: pos }
          };

          nextComps[valveIndex] = {
            ...valve,
            state: {
              ...valve.state,
              valvePosition: valvePos,
              solenoidLeftActive: y1Active,
              solenoidRightActive: y2Active
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
  }, [isSimulating, isEmergencyActive, components, connections]);

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
    const isElectrical = template.category === 'electrical' || template.type === 'power_supply_24v';

    let targetX = 30;
    let targetY = 20;

    if (isElectrical) {
      // Posiciona no Rack Superior lado a lado
      const electricalComps = components.filter(c => c.category === 'electrical' || c.type === 'power_supply_24v');
      if (electricalComps.length === 0) {
        targetX = 30;
        targetY = 20;
      } else {
        const maxX = Math.max(...electricalComps.map(c => c.x + c.width));
        targetX = maxX + 15;
        targetY = 20;
        if (targetX + template.width > 1370) {
          targetX = 30 + (electricalComps.length % 5) * 40;
          targetY = 25;
        }
      }
    } else {
      // Posiciona na Placa Perfilada de Alumínio Ranhurado (Y >= 250)
      if (template.type === 'frl_unit') {
        targetX = 30;
        targetY = 250;
      } else if (template.type === 'air_manifold') {
        targetX = 185;
        targetY = 260;
      } else {
        const pneumaticComps = components.filter(c => c.category !== 'electrical' && c.type !== 'power_supply_24v' && c.type !== 'frl_unit' && c.type !== 'air_manifold');
        const col = pneumaticComps.length % 4;
        const row = Math.floor(pneumaticComps.length / 4);
        targetX = 360 + col * 240;
        targetY = 270 + row * 160;
      }
    }

    const newComp = createComponentFromTemplate(
      template,
      targetX,
      targetY,
      existingCount + 1
    );
    setComponents(prev => [...prev, newComp]);
    benchAudio.playRelayClick();
  };

  const handleDeleteComponent = (id: string) => {
    const compToDelete = components.find(c => c.id === id);
    if (compToDelete && compToDelete.type.startsWith('terminal_strip')) return;

    setComponents(prev => prev.filter(c => c.id !== id));
    setConnections(prev => prev.filter(cn => cn.fromComponentId !== id && cn.toComponentId !== id));
    if (selectedComponent?.id === id) {
      setSelectedComponent(null);
    }
  };

  // Rotate selected component by 90 degrees clockwise (0° -> 90° -> 180° -> 270° -> 0°)
  const handleRotateSelectedComponent = () => {
    if (!selectedComponent) return;
    const currentRot = selectedComponent.rotation || 0;
    const nextRot = (currentRot + 90) % 360;

    const updated = {
      ...selectedComponent,
      rotation: nextRot,
    };

    setSelectedComponent(updated);
    setComponents(prev =>
      prev.map(c => (c.id === selectedComponent.id ? { ...c, rotation: nextRot } : c))
    );
    benchAudio.playRelayClick();
  };

  // Keyboard shortcut: Press 'R' to rotate selected component 90 degrees, 'Esc' to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase() || '';
      if (['input', 'textarea', 'select'].includes(tag)) return;

      if ((e.key === 'r' || e.key === 'R') && selectedComponent) {
        e.preventDefault();
        handleRotateSelectedComponent();
      } else if (e.key === 'Escape') {
        setSelectedComponent(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponent]);

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

  // Toggle Catalog Visibility
  const handleToggleCatalog = () => {
    if (currentTab !== 'workbench') {
      setCurrentTab('workbench');
      setIsCatalogOpen(true);
    } else {
      setIsCatalogOpen(prev => !prev);
    }
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

  const currentSelectedComp = selectedComponent
    ? components.find(c => c.id === selectedComponent.id) || selectedComponent
    : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden relative">
      {/* Header Navigation: Oculto no Modo Tela Cheia para exibir somente o painel e seus componentes */}
      {!isFullscreen && (
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
          isCatalogOpen={isCatalogOpen}
          onToggleCatalog={handleToggleCatalog}
          selectedComponent={currentSelectedComp}
          onRotateComponent={handleRotateSelectedComponent}
          zoom={zoom}
          onZoomIn={() => zoomControlsRef.current?.zoomIn()}
          onZoomOut={() => zoomControlsRef.current?.zoomOut()}
          onResetZoom={() => zoomControlsRef.current?.resetZoom()}
          onFitScreen={() => zoomControlsRef.current?.fitScreen()}
          mousePos={canvasMousePos}
          showCrosshair={showCrosshair}
          onToggleCrosshair={() => setShowCrosshair(prev => !prev)}
          onCenterOnCursor={() => zoomControlsRef.current?.centerOnCursor()}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Botão Flutuante de Tela Cheia (Exibido no Modo Painel Puro para restaurar a tela inteira) */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            id="btn-exit-fullscreen"
            type="button"
            onClick={handleToggleFullscreen}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/95 hover:bg-slate-800 text-cyan-300 border border-cyan-500/60 shadow-2xl backdrop-blur-md transition-all cursor-pointer hover:border-cyan-400 active:scale-95 group"
            title="Aperte novamente para restaurar a tela inteira com todos os botões e campos (Atalho: Esc)"
          >
            <Minimize className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Sair da Tela Cheia</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-400">
              Esc
            </span>
          </button>
        </div>
      )}

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
            selectedComponent={currentSelectedComp}
            onSelectComponent={setSelectedComponent}
            onTriggerManualOverride={handleTriggerManualOverride}
            onPressButton={handlePressButton}
            onReleaseButton={handleReleaseButton}
            isCatalogOpen={isFullscreen ? false : isCatalogOpen}
            onToggleCatalog={handleToggleCatalog}
            onRotateComponent={handleRotateSelectedComponent}
            zoom={zoom}
            onZoomChange={setZoom}
            showCrosshair={showCrosshair}
            onMousePosChange={setCanvasMousePos}
            onRegisterZoomControls={handleRegisterZoomControls}
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
