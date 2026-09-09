import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BenchComponent, 
  VirtualConnection, 
  ComponentPort,
  PortType,
  SensorTechnology,
  SensorWireCount
} from '../types';
import { COMPONENT_TEMPLATES, ComponentTemplate } from '../data/componentLibrary';
import { 
  Plus, 
  Trash2, 
  X, 
  Zap, 
  Wind, 
  Sliders, 
  Layers, 
  Info,
  CheckCircle2,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  Radio,
  Sparkles,
  Check,
  ShieldCheck,
  Eye,
  Activity,
  Move,
  RotateCcw,
  Ruler,
  Minimize2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  LocateFixed,
  Target
} from 'lucide-react';
import { benchAudio } from '../utils/audioSynthesizer';
import { getSensorPorts } from '../utils/circuitSimulator';
import { ElectrovalveRenderer } from './ElectrovalveRenderer';
import { calculateRoutedConnections } from '../utils/cableRouter';

// Utility to calculate transformed world coordinates for ports taking rotation into account
export const getPortWorldCoordinates = (comp: BenchComponent, port: ComponentPort) => {
  const rotation = comp.rotation || 0;
  let portX = port.x;
  let portY = port.y;

  // Auto-ajuste para o módulo de botões de acionamento:
  // Garante que os bornes elétricos fiquem na régua inferior dedicada (y: 83%),
  // deixando os botões de acionamento superiores (y: ~70px) 100% livres e desobstruídos
  if (comp.type === 'push_button_station' && port.y < 70) {
    portY = 83;
    if (port.name.includes('13')) portX = 16;
    else if (port.name.includes('14')) portX = 38;
    else if (port.name.includes('11')) portX = 62;
    else if (port.name.includes('12')) portX = 84;
  }

  // Auto-ajuste para Unidade de Conservação FRL (Filtro-Regulador-Lubrificador):
  // Posiciona as conexões pneumáticas perfeitamente nos bocais de entrada (P) no regulador
  // e saída regulada (1) no lubrificador no corpo metálico industrial
  if (comp.type === 'frl_unit') {
    portY = 39;
    if (port.name.includes('P') || port.name.includes('Entrada')) {
      portX = 8;
    } else if (port.name.includes('1') || port.name.includes('Saída')) {
      portX = 92;
    }
  }

  // Auto-ajuste para Eletroválvulas 5/2 (Duplo Solenoide e Simples Solenoide):
  // Separa fisicamente as conexões elétricas de +24V (A1) e 0V (A2) para facilitar a fiação
  if (comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') {
    if (port.name.includes('Y1')) {
      if (port.functionType === 'signal_in' || port.name.includes('+')) {
        portX = 6;
        portY = 13;
      } else if (port.functionType === 'ground_0v' || port.name.includes('-')) {
        portX = 18;
        portY = 38;
      }
    } else if (port.name.includes('Y2')) {
      if (port.functionType === 'signal_in' || port.name.includes('+')) {
        portX = 94;
        portY = 13;
      } else if (port.functionType === 'ground_0v' || port.name.includes('-')) {
        portX = 82;
        portY = 38;
      }
    }
  }

  const rawX = (comp.width * portX) / 100;
  const rawY = (comp.height * portY) / 100;

  if (!rotation) {
    return {
      x: comp.x + rawX,
      y: comp.y + rawY,
    };
  }

  const cx = comp.width / 2;
  const cy = comp.height / 2;
  const dx = rawX - cx;
  const dy = rawY - cy;
  const rad = (rotation * Math.PI) / 180;
  const rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

  return {
    x: comp.x + cx + rotDx,
    y: comp.y + cy + rotDy,
  };
};

interface BenchCanvasProps {
  components: BenchComponent[];
  connections: VirtualConnection[];
  onUpdateComponents: (comps: BenchComponent[]) => void;
  onUpdateConnections: (conns: VirtualConnection[]) => void;
  isSimulating: boolean;
  onAddComponent: (template: ComponentTemplate) => void;
  onDeleteComponent: (id: string) => void;
  selectedComponent: BenchComponent | null;
  onSelectComponent: (comp: BenchComponent | null) => void;
  onTriggerManualOverride: (componentId: string) => void;
  onPressButton: (componentId: string, buttonType: 'NA' | 'NF') => void;
  onReleaseButton: (componentId: string, buttonType: 'NA' | 'NF') => void;
  isCatalogOpen: boolean;
  onToggleCatalog: () => void;
  onRotateComponent?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  showCrosshair?: boolean;
  onMousePosChange?: (pos: { x: number; y: number }) => void;
  onRegisterZoomControls?: (controls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitScreen: () => void;
    centerOnCursor: () => void;
  }) => void;
}

export const BenchCanvas: React.FC<BenchCanvasProps> = ({
  components,
  connections,
  onUpdateComponents,
  onUpdateConnections,
  isSimulating,
  onAddComponent,
  onDeleteComponent,
  selectedComponent,
  onSelectComponent,
  onTriggerManualOverride,
  onPressButton,
  onReleaseButton,
  isCatalogOpen,
  onToggleCatalog,
  onRotateComponent,
  zoom: externalZoom,
  onZoomChange,
  showCrosshair: externalShowCrosshair,
  onMousePosChange,
  onRegisterZoomControls,
}) => {
  // Connection wiring state
  const [connectingStart, setConnectingStart] = useState<{
    componentId: string;
    port: ComponentPort;
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [internalZoom, setInternalZoom] = useState<number>(1);
  const [internalShowCrosshair, setInternalShowCrosshair] = useState<boolean>(false);
  
  const zoom = externalZoom !== undefined ? externalZoom : internalZoom;
  const showCrosshair = externalShowCrosshair !== undefined ? externalShowCrosshair : internalShowCrosshair;

  const [hoveredPort, setHoveredPort] = useState<ComponentPort | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [draggingConnectionId, setDraggingConnectionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isParamsOpen, setIsParamsOpen] = useState<boolean>(false);
  const [purgingFrlId, setPurgingFrlId] = useState<string | null>(null);

  const canvasRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSnappedCompIdRef = useRef<string | null>(null);

  // Smooth Zoom Controllers with anchor tracking
  const handleZoom = (delta: number, anchorClient?: { clientX: number; clientY: number }) => {
    const prev = zoom;
    const next = Math.max(0.3, Math.min(2.5, Number((prev + delta).toFixed(2))));
    if (next === prev) return;

    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const anchorX = anchorClient ? anchorClient.clientX - containerRect.left : container.clientWidth / 2;
      const anchorY = anchorClient ? anchorClient.clientY - containerRect.top : container.clientHeight / 2;

      const contentX = (container.scrollLeft + anchorX) / prev;
      const contentY = (container.scrollTop + anchorY) / prev;

      requestAnimationFrame(() => {
        container.scrollLeft = contentX * next - anchorX;
        container.scrollTop = contentY * next - anchorY;
      });
    }

    if (onZoomChange) {
      onZoomChange(next);
    } else {
      setInternalZoom(next);
    }
  };

  const handleResetZoom = () => {
    if (onZoomChange) {
      onZoomChange(1);
    } else {
      setInternalZoom(1);
    }
  };

  const handleFitScreen = () => {
    const container = containerRef.current;
    if (!container) return;
    const availableW = container.clientWidth - 40;
    const availableH = container.clientHeight - 40;
    const fitScale = Math.max(0.3, Math.min(1.2, Number(Math.min(availableW / 2800, availableH / 1700).toFixed(2))));
    if (onZoomChange) {
      onZoomChange(fitScale);
    } else {
      setInternalZoom(fitScale);
    }
    container.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  const handleCenterOnCursor = () => {
    const container = containerRef.current;
    if (!container) return;
    const targetScrollLeft = mousePos.x * zoom - container.clientWidth / 2;
    const targetScrollTop = mousePos.y * zoom - container.clientHeight / 2;
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
  };

  // Expose zoom controls to parent / Header toolbar
  useEffect(() => {
    if (onRegisterZoomControls) {
      onRegisterZoomControls({
        zoomIn: () => handleZoom(0.15),
        zoomOut: () => handleZoom(-0.15),
        resetZoom: handleResetZoom,
        fitScreen: handleFitScreen,
        centerOnCursor: handleCenterOnCursor,
      });
    }
  });

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      handleZoom(delta, { clientX: e.clientX, clientY: e.clientY });
    }
  };

  // Quick interactive pressure adjustment for FRL Unit
  const handleAdjustFrlPressure = (comp: BenchComponent, e: React.MouseEvent) => {
    e.stopPropagation();
    benchAudio.playRelayClick();
    const cur = comp.state.pressureP ?? 6.0;
    const next = cur >= 10.0 ? 2.0 : Number((cur + 1.0).toFixed(1));
    onUpdateComponents(
      components.map((c) =>
        c.id === comp.id ? { ...c, state: { ...c.state, pressureP: next } } : c
      )
    );
  };

  // Manual condensation purge valve click for FRL Unit
  const handlePurgeFrl = (frlId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    benchAudio.playExhaust(0.18, 0.25);
    setPurgingFrlId(frlId);
    setTimeout(() => {
      setPurgingFrlId((current) => (current === frlId ? null : current));
    }, 600);
  };

  // Handle canvas mouse move for active drawing line and dragging
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    const svg = canvasRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    let x = e.clientX;
    let y = e.clientY;
    if (ctm) {
      const svgP = pt.matrixTransform(ctm.inverse());
      x = Math.max(0, Math.min(2800, Math.round(svgP.x)));
      y = Math.max(0, Math.min(1700, Math.round(svgP.y)));
    }
    setMousePos({ x, y });
    onMousePosChange?.({ x, y });

    // Handle dragging connection control point (reposicionar / desviar / esticar cabo ou tubo)
    if (draggingConnectionId) {
      const clampedX = Math.max(15, Math.min(2785, Math.round(x)));
      const clampedY = Math.max(15, Math.min(1685, Math.round(y)));

      onUpdateConnections(
        connections.map((c) => {
          if (c.id === draggingConnectionId) {
            return {
              ...c,
              customControlPoint: { x: clampedX, y: clampedY },
              customSag: undefined,
            };
          }
          return c;
        })
      );
      return;
    }

    // Handle dragging component
    if (draggingCompId) {
      const draggedComp = components.find(c => c.id === draggingCompId);
      if (!draggedComp) return;

      const rawX = x - dragOffset.x;
      const rawY = y - dragOffset.y;

      // 1. CASO ESPECIAL: CILINDRO PNEUMÁTICO SENDO ARRASTADO
      // Move o cilindro e sincroniza todos os sensores fixados no seu trilho
      if (draggedComp.type === 'double_acting_cylinder' || draggedComp.type === 'single_acting_cylinder') {
        const finalCylX = Math.max(15, Math.min(2785 - draggedComp.width, Math.round(rawX / 10) * 10));
        const clampedY = Math.max(238, Math.min(1680 - draggedComp.height, rawY));
        const grooveIndex = Math.round((clampedY - 240) / 48);
        const finalCylY = Math.max(240, Math.min(1680 - draggedComp.height, 240 + grooveIndex * 48));

        const deltaX = finalCylX - draggedComp.x;
        const deltaY = finalCylY - draggedComp.y;

        onUpdateComponents(
          components.map((c) => {
            if (c.id === draggingCompId) {
              return { ...c, x: finalCylX, y: finalCylY };
            }
            // Sensores fixados no trilho deste cilindro acompanham o deslocamento solidariamente
            if (c.type === 'reed_switch_sensor' && c.state.railCylinderId === draggingCompId) {
              return {
                ...c,
                x: c.x + deltaX,
                y: c.y + deltaY,
              };
            }
            return c;
          })
        );
        return;
      }

      // 2. CASO ESPECIAL: SENSOR DE PROXIMIDADE (REED / INDUTIVO / CAPACITIVO / ÓPTICO)
      // "quando aproximar os sensores do trilho para sensores, o sensor deverá ficar fixado neste trilho
      // como fosse atraido magneticamente e impedindo o movimento vertical e só liberando o movimento horizontal."
      if (draggedComp.type === 'reed_switch_sensor') {
        const cylinders = components.filter(
          item => item.type === 'double_acting_cylinder' || item.type === 'single_acting_cylinder'
        );

        let snapCyl: BenchComponent | null = null;
        let snapRailY = 0;
        let railMinX = 0;
        let railMaxX = 0;

        for (const cyl of cylinders) {
          const isSingle = cyl.type === 'single_acting_cylinder';
          // O sensor fica a 90° em relação ao cilindro (vertical, com a tampa sensora no topo apontando para a haste)
          // Suporte de fixação mecânica fica no corpo do sensor com centro em y = 42
          // Altura da ranhura T do trilho guia do cilindro (afastado da haste para evitar sobreposição):
          // Dupla ação: ranhura T central em cyl.y + 130. Com suporte em y = 42 => snapRailY = cyl.y + 88 (haste e esfera passam totalmente livres acima do sensor, com entreferro livre de ar de ~18px a ~30px)
          // Simples ação: ranhura T central em cyl.y + 118. Com suporte em y = 42 => snapRailY = cyl.y + 76
          const targetRailY = isSingle ? cyl.y + 76 : cyl.y + 88;

          // Faixa horizontal do curso do cilindro onde o sensor desliza sobre o trilho estendido:
          // Dupla ação: centro do sensor (finalX + 55) alinha de 0mm (x=275) até 300mm (x=575) no batente
          // Logo finalX vai de cyl.x + 205 até cyl.x + 535
          // Simples ação: centro do sensor alinha de 0mm (x=240) até 200mm (x=440) no batente
          // Logo finalX vai de cyl.x + 160 até cyl.x + 400
          const rMin = isSingle ? cyl.x + 160 : cyl.x + 205;
          const rMax = isSingle ? cyl.x + 400 : cyl.x + 535;

          // Zona de atração magnética do trilho:
          const inHorizontalRange = rawX >= rMin - 60 && rawX <= rMax + 60;
          const verticalDist = Math.abs(rawY - targetRailY);

          // Histerese magnética: se já estiver acoplado no trilho, requer puxar > 80px para desencaixar
          const snapThreshold = (draggedComp.state.snappedToRail && draggedComp.state.railCylinderId === cyl.id) ? 80 : 65;

          if (inHorizontalRange && verticalDist <= snapThreshold) {
            snapCyl = cyl;
            snapRailY = targetRailY;
            railMinX = rMin;
            railMaxX = rMax;
            break;
          }
        }

        let finalX: number;
        let finalY: number;
        let isSnapped = false;
        let railCylinderId: string | undefined = undefined;

        if (snapCyl) {
          // ATRAÇÃO MAGNÉTICA ATIVA:
          // 1. Bloqueia totalmente o movimento vertical: finalY permanece fixo no trilho
          finalY = snapRailY;
          // 2. Libera exclusivamente o movimento horizontal de deslizamento sobre o trilho
          finalX = Math.max(railMinX, Math.min(railMaxX, rawX));
          isSnapped = true;
          railCylinderId = snapCyl.id;

          // Efeito sonoro tátil de encaixe magnético ao engatar no trilho
          if (lastSnappedCompIdRef.current !== draggedComp.id) {
            benchAudio.playRelayClick();
            lastSnappedCompIdRef.current = draggedComp.id;
          }
        } else {
          // Fora do trilho: desengatado, livre para posicionamento no painel ranhurado
          if (lastSnappedCompIdRef.current === draggedComp.id) {
            lastSnappedCompIdRef.current = null;
          }
          finalX = Math.max(15, Math.min(2785 - draggedComp.width, Math.round(rawX / 10) * 10));
          const clampedY = Math.max(238, Math.min(1680 - draggedComp.height, rawY));
          const grooveIndex = Math.round((clampedY - 240) / 48);
          finalY = Math.max(240, Math.min(1680 - draggedComp.height, 240 + grooveIndex * 48));
          isSnapped = false;
          railCylinderId = undefined;
        }

        // Atualiza a posição do sensor
        onUpdateComponents(
          components.map((c) => {
            if (c.id === draggingCompId) {
              return {
                ...c,
                x: finalX,
                y: finalY,
                state: {
                  ...c.state,
                  snappedToRail: isSnapped,
                  railCylinderId: railCylinderId,
                },
              };
            }
            return c;
          })
        );
        return;
      }

      // 3. CASO PADRÃO: DEMAIS COMPONENTES ELÉTRICOS OU PNEUMÁTICOS
      const isElectrical = draggedComp.category === 'electrical' || draggedComp.type === 'power_supply_24v';
      const finalX = Math.max(15, Math.min(2785 - draggedComp.width, Math.round(rawX / 10) * 10));
      let finalY: number;

      if (isElectrical) {
        // Módulos elétricos fixam-se no Rack Superior (lado a lado, trilho Y=20)
        if (rawY < 180) {
          finalY = 20; // Alinhamento perfeito no trilho superior
        } else {
          finalY = Math.max(20, Math.min(220 - draggedComp.height, Math.round(rawY / 10) * 10));
        }
      } else {
        // Componentes pneumáticos (válvulas, FRL, manifold, etc.) no perfil de alumínio ranhurado
        const clampedY = Math.max(238, Math.min(1680 - draggedComp.height, rawY));
        const grooveIndex = Math.round((clampedY - 240) / 48);
        finalY = Math.max(240, Math.min(1680 - draggedComp.height, 240 + grooveIndex * 48));
      }

      onUpdateComponents(
        components.map((c) => {
          if (c.id === draggingCompId) {
            return {
              ...c,
              x: finalX,
              y: finalY,
            };
          }
          return c;
        })
      );
    }
  };

  const handleMouseUp = () => {
    if (draggingCompId) {
      setDraggingCompId(null);
    }
    if (draggingConnectionId) {
      setDraggingConnectionId(null);
    }
  };

  // Port click to initiate or complete connection
  const handlePortClick = (comp: BenchComponent, port: ComponentPort, e: React.MouseEvent) => {
    e.stopPropagation();

    // Silenciadores de bronze sinterizado acoplados nas portas de exaustão 3 e 5
    if (port.functionType === 'exhaust_r' || port.functionType === 'exhaust_s') {
      benchAudio.playExhaust(0.18, 0.2);
      if (connectingStart) {
        setConnectingStart(null);
      }
      return;
    }

    if (!connectingStart) {
      // Start connection
      setConnectingStart({ componentId: comp.id, port });
      benchAudio.playRelayClick();
    } else {
      // If clicking same port, cancel
      if (connectingStart.componentId === comp.id && connectingStart.port.id === port.id) {
        setConnectingStart(null);
        return;
      }

      // Validate port types
      if (connectingStart.port.type !== port.type) {
        alert(
          `Incompatibilidade Técnica: Não é permitido conectar uma via pneumática (mangueira) diretamente em um borne elétrico (fio)!`
        );
        setConnectingStart(null);
        return;
      }

      // Check if connection already exists
      const exists = connections.some(
        (c) =>
          (c.fromPortId === connectingStart.port.id && c.toPortId === port.id) ||
          (c.fromPortId === port.id && c.toPortId === connectingStart.port.id)
      );

      if (exists) {
        setConnectingStart(null);
        return;
      }

      // Create new connection
      const newConn: VirtualConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: port.type,
        fromComponentId: connectingStart.componentId,
        fromPortId: connectingStart.port.id,
        toComponentId: comp.id,
        toPortId: port.id,
        pressureBar: port.type === 'pneumatic' ? 6.0 : 0,
        voltageV: port.type === 'electrical' ? 24 : 0,
        active: true,
      };

      onUpdateConnections([...connections, newConn]);
      setConnectingStart(null);

      if (port.type === 'pneumatic') {
        benchAudio.playExhaust(0.12, 0.2);
      } else {
        benchAudio.playRelayClick();
      }
    }
  };

  const handleDeleteConnection = (connId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onUpdateConnections(connections.filter((c) => c.id !== connId));
    if (selectedConnectionId === connId) {
      setSelectedConnectionId(null);
    }
    benchAudio.playExhaust(0.1, 0.15);
  };

  // Ajuste de comprimento / folga da conexão selecionada (+/- mm de arco)
  const handleAdjustSag = (connId: string, delta: number) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;

    const comp1 = components.find((c) => c.id === conn.fromComponentId);
    const comp2 = components.find((c) => c.id === conn.toComponentId);
    const port1 = comp1?.ports.find((p) => p.id === conn.fromPortId);
    const port2 = comp2?.ports.find((p) => p.id === conn.toPortId);
    if (!comp1 || !comp2 || !port1 || !port2) return;

    const p1 = getPortWorldCoordinates(comp1, port1);
    const p2 = getPortWorldCoordinates(comp2, port2);

    const midChord = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const currentHandle = conn.customControlPoint || { x: midChord.x, y: midChord.y + 60 };

    const vx = currentHandle.x - midChord.x;
    const vy = currentHandle.y - midChord.y;
    const dist = Math.sqrt(vx * vx + vy * vy);

    let newHandle: { x: number; y: number };

    if (dist < 10) {
      // Se estava retilíneo, afasta na vertical para dar folga natural
      newHandle = {
        x: midChord.x,
        y: Math.max(20, Math.min(1680, midChord.y + Math.max(15, delta))),
      };
    } else {
      // Afasta ou aproxima do ponto médio da reta entre os bornes
      const scale = Math.max(0.1, (dist + delta) / dist);
      newHandle = {
        x: Math.max(15, Math.min(2785, Math.round(midChord.x + vx * scale))),
        y: Math.max(15, Math.min(1685, Math.round(midChord.y + vy * scale))),
      };
    }

    onUpdateConnections(
      connections.map((c) => {
        if (c.id === connId) {
          return {
            ...c,
            customControlPoint: newHandle,
            customSag: undefined,
          };
        }
        return c;
      })
    );
    benchAudio.playRelayClick();
  };

  // Restaurar traçado automático com desvio inteligente de obstáculos
  const handleResetConnectionRoute = (connId: string) => {
    onUpdateConnections(
      connections.map((c) => {
        if (c.id === connId) {
          const { customControlPoint, customSag, ...rest } = c;
          return rest;
        }
        return c;
      })
    );
    benchAudio.playRelayClick();
  };

  // Toggle Power Supply ON/OFF (Chave Liga / Desliga)
  const handleTogglePowerSupply = (componentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    benchAudio.playRelayClick();
    onUpdateComponents(
      components.map((c) => {
        if (c.id === componentId) {
          const nextActivated = c.state.activated === false ? true : false;
          const updated = {
            ...c,
            state: {
              ...c.state,
              activated: nextActivated,
              voltageV: nextActivated ? 24.0 : 0.0,
            },
          };
          if (selectedComponent?.id === componentId) {
            onSelectComponent(updated);
          }
          return updated;
        }
        return c;
      })
    );
  };

  // Start dragging component (repositioning does NOT open technical parameters)
  const handleComponentMouseDown = (comp: BenchComponent, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    if (connectingStart) return;
    if (comp.type.startsWith('terminal_strip')) return;

    setSelectedConnectionId(null);
    setDraggingCompId(comp.id);
    
    const svg = canvasRef.current;
    if (svg) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const svgP = pt.matrixTransform(ctm.inverse());
        setDragOffset({
          x: svgP.x - comp.x,
          y: svgP.y - comp.y,
        });
        return;
      }
    }
    setDragOffset({ x: 0, y: 0 });
  };

  // Calculate coordinates for connection bezier path (handles component rotation)
  const getConnectionCoordinates = (conn: VirtualConnection) => {
    const sourceComp = components.find((c) => c.id === conn.fromComponentId);
    const targetComp = components.find((c) => c.id === conn.toComponentId);
    if (!sourceComp || !targetComp) return null;

    const sourcePort = sourceComp.ports.find((p) => p.id === conn.fromPortId);
    const targetPort = targetComp.ports.find((p) => p.id === conn.toPortId);
    if (!sourcePort || !targetPort) return null;

    const sourceCoords = getPortWorldCoordinates(sourceComp, sourcePort);
    const targetCoords = getPortWorldCoordinates(targetComp, targetPort);

    return { 
      x1: sourceCoords.x, 
      y1: sourceCoords.y, 
      x2: targetCoords.x, 
      y2: targetCoords.y, 
      sourceComp, 
      targetComp, 
      sourcePort, 
      targetPort 
    };
  };

  // Roteamento inteligente de mangueiras pneumáticas e cabos elétricos com desvio de equipamentos e acomodação
  const routedConnections = useMemo(() => {
    return calculateRoutedConnections(connections, components);
  }, [connections, components]);

  // Conexão atualmente selecionada para reposicionamento e ajuste de comprimento
  const selectedRouted = useMemo(() => {
    if (!selectedConnectionId) return null;
    return routedConnections.find((r) => r.connection.id === selectedConnectionId) || null;
  }, [routedConnections, selectedConnectionId]);

  // Filter templates
  const filteredTemplates = COMPONENT_TEMPLATES.filter((tpl) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'electrical') {
      return tpl.category === 'electrical' || tpl.type === 'power_supply_24v';
    }
    if (selectedCategory === 'supply') {
      return tpl.category === 'supply' || tpl.type === 'power_supply_24v';
    }
    return tpl.category === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-950">
      {/* Left Sidebar: Component Catalog & Bench Palette */}
      {isCatalogOpen && (
        <aside className="w-full lg:w-72 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0 z-10 max-h-60 lg:max-h-full transition-all">
          {/* Palette Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Catálogo de Componentes
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {filteredTemplates.length} itens
              </span>
              <button
                onClick={onToggleCatalog}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Ocultar catálogo de componentes"
                aria-label="Ocultar catálogo"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Categories Bar */}
          <div className="p-2 border-b border-slate-800 flex gap-1 overflow-x-auto text-[11px] no-scrollbar">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'electrical', label: 'Elétrica' },
              { id: 'supply', label: 'Alimentação' },
              { id: 'actuators', label: 'Atuadores' },
              { id: 'valves', label: 'Válvulas' },
              { id: 'flow_logic', label: 'Fluxo/Lógica' },
              { id: 'sensors', label: 'Sensores' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.type}
                onClick={() => onAddComponent(tpl)}
                className="group p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 cursor-pointer transition shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                        {tpl.tagPrefix}
                      </span>
                      <h3 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                        {tpl.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <button
                    className="p-1.5 rounded-md bg-slate-700/80 group-hover:bg-cyan-600 text-slate-300 group-hover:text-white transition shrink-0 cursor-pointer"
                    title="Adicionar à bancada"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Port count preview */}
                <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Wind className="w-3 h-3 text-cyan-400" />
                    {tpl.defaultPorts.filter((p) => p.type === 'pneumatic').length} vias
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {tpl.defaultPorts.filter((p) => p.type === 'electrical').length} bornes
                  </span>
                  <span className="text-slate-400 capitalize">{tpl.category}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Help Banner */}
          <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Arraste para posicionar. Clique e use <strong>Girar Componente</strong> (ao lado de Emergência) para girar a 90°. <strong>Duplo clique</strong> para Parâmetros Técnicos.</span>
          </div>
        </aside>
      )}

      {/* Center: Aluminum Workbench Canvas */}
      <main className="flex-1 relative flex flex-col bg-[#0b101b] overflow-hidden">
        {/* Canvas Contextual Badges: Only shown during interactive actions (e.g. connecting ports or selected module) */}
        {(connectingStart || selectedComponent) && (
          <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg">
            {selectedComponent && (
              <span className="flex items-center gap-1 text-cyan-300 font-medium">
                Selecionado: <strong className="font-mono text-white">{selectedComponent.tag}</strong> ({(selectedComponent.rotation || 0)}°)
              </span>
            )}
            {connectingStart && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 animate-pulse">
                <span>Conectando {connectingStart.port.name}... Clique no destino ou ESC</span>
                <button
                  onClick={() => setConnectingStart(null)}
                  className="hover:text-white ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Floating Connection Drag/Status Message (se conectando) */}

        {/* SVG Interactive Workbench Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 w-full h-full overflow-auto cursor-crosshair relative scroll-smooth"
          onWheel={handleWheel}
        >
          <svg
            ref={canvasRef}
            id="bench-svg-canvas"
            width={2800}
            height={1700}
            viewBox="0 0 2800 1700"
            style={{
              width: `${2800 * zoom}px`,
              height: `${1700 * zoom}px`,
              minWidth: `${2800 * zoom}px`,
              minHeight: `${1700 * zoom}px`,
              display: 'block',
            }}
            className="select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => {
              if (connectingStart) setConnectingStart(null);
              onSelectComponent(null);
              setSelectedConnectionId(null);
              setIsParamsOpen(false);
            }}
          >
            <defs>
              {/* Aluminum Extrusion Slat Gradient (Perfil de Alumínio Anodizado Natural) */}
              <linearGradient id="aluminum-slat-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="25%" stopColor="#d5dbe5" />
                <stop offset="70%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#b4bece" />
              </linearGradient>

              {/* Aluminum Extrusion T-Slot Pattern for Didactic Bench */}
              <pattern id="aluminum-slats" width="60" height="50" patternUnits="userSpaceOnUse">
                {/* Slat aluminum face - light gray characteristic of anodized extruded aluminum */}
                <rect width="60" height="50" fill="url(#aluminum-slat-gradient)" />
                {/* Upper edge specular bevel reflection */}
                <line x1="0" y1="0.5" x2="60" y2="0.5" stroke="#ffffff" strokeWidth="1" opacity="0.9" />

                {/* Fine longitudinal brushed aluminum surface texture lines */}
                <line x1="0" y1="10" x2="60" y2="10" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />
                <line x1="0" y1="20" x2="60" y2="20" stroke="#94a3b8" strokeWidth="0.5" opacity="0.4" />
                <line x1="0" y1="30" x2="60" y2="30" stroke="#ffffff" strokeWidth="0.7" opacity="0.45" />

                {/* T-Slot upper bevel chamfer (reflexo biselado superior da ranhura) */}
                <line x1="0" y1="41" x2="60" y2="41" stroke="#ffffff" strokeWidth="1" />
                <line x1="0" y1="42" x2="60" y2="42" stroke="#64748b" strokeWidth="0.8" />

                {/* Horizontal T-Slot groove (ranhura T profunda para porcas de fixação rápida) */}
                <rect x="0" y="42.5" width="60" height="6" fill="#334155" />
                {/* Slot inner cavity shadow */}
                <rect x="0" y="42.5" width="60" height="2" fill="#1e293b" opacity="0.9" />
                {/* T-slot central channel guide line */}
                <line x1="0" y1="45.5" x2="60" y2="45.5" stroke="#0f172a" strokeWidth="1.2" strokeDasharray="8 6" opacity="0.75" />

                {/* T-Slot lower bevel chamfer */}
                <line x1="0" y1="48.5" x2="60" y2="48.5" stroke="#64748b" strokeWidth="0.8" />
                <line x1="0" y1="49.5" x2="60" y2="49.5" stroke="#f1f5f9" strokeWidth="1" />
              </pattern>

              {/* Glowing hose filter */}
              <filter id="hose-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Arrow markers for flow */}
              <marker id="arrow-flow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
              </marker>

              {/* Polished Chrome Cylinder Rod Gradient */}
              <linearGradient id="chrome-rod-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="20%" stopColor="#e2e8f0" />
                <stop offset="50%" stopColor="#cbd5e1" />
                <stop offset="80%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              {/* 3D Metallic Actuating Sphere Gradient */}
              <radialGradient id="actuator-sphere-grad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#e2e8f0" />
                <stop offset="65%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>

              {/* Magnetic Proximity Induction Glow */}
              <radialGradient id="actuator-sphere-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#0284c7" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </radialGradient>

              {/* FRL Unit Components Gradients & Materials */}
              <linearGradient id="frl-knob-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="25%" stopColor="#334155" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="85%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              <linearGradient id="frl-red-collar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="25%" stopColor="#ef4444" />
                <stop offset="70%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>

              <linearGradient id="frl-metal-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#242e42" />
                <stop offset="35%" stopColor="#131b2e" />
                <stop offset="80%" stopColor="#0a101d" />
                <stop offset="100%" stopColor="#030712" />
              </linearGradient>

              <linearGradient id="frl-sintered-bronze" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="20%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="80%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>

              <linearGradient id="frl-polycarb-glass" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
                <stop offset="12%" stopColor="#e2e8f0" stopOpacity="0.06" />
                <stop offset="88%" stopColor="#e2e8f0" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
              </linearGradient>

              <linearGradient id="frl-water-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.65" />
              </linearGradient>

              <linearGradient id="frl-oil-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
              </linearGradient>

              <linearGradient id="frl-gauge-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>

              {/* Terminal Strip +24V Polyamide Red Gradient */}
              <linearGradient id="term-strip-24v-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#dc2626" />
                <stop offset="70%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>

              {/* Terminal Strip 0V Polyamide Blue Gradient */}
              <linearGradient id="term-strip-0v-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="25%" stopColor="#1d4ed8" />
                <stop offset="70%" stopColor="#1e40af" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
            </defs>

            {/* ==================================================== */}
            {/* 1. RACK SUPERIOR: MÓDULOS ELÉTRICOS (24V CC / DIDÁTICO) */}
            {/* ==================================================== */}
            <g id="top-electrical-rack">
              {/* Rack Interior Backplane */}
              <rect x="0" y="0" width="2800" height="222" fill="#0f172a" />

              {/* Top Mounting Rail (Trilho de Fixação em Alumínio Anodizado) */}
              <rect x="10" y="6" width="2780" height="14" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
              <line x1="10" y1="7" x2="2790" y2="7" stroke="#e2e8f0" strokeWidth="1" />
              {/* Screw holes along the top rail */}
              {Array.from({ length: 70 }).map((_, i) => (
                <circle key={`ts_${i}`} cx={25 + i * 39.5} cy="13" r="2.5" fill="#475569" stroke="#cbd5e1" strokeWidth="0.8" />
              ))}

              {/* Bottom Mounting Rail of Electrical Rack */}
              <rect x="10" y="202" width="2780" height="14" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
              <line x1="10" y1="203" x2="2790" y2="203" stroke="#e2e8f0" strokeWidth="1" />
              {/* Screw holes along the bottom rail */}
              {Array.from({ length: 70 }).map((_, i) => (
                <circle key={`bs_${i}`} cx={25 + i * 39.5} cy="209" r="2.5" fill="#475569" stroke="#cbd5e1" strokeWidth="0.8" />
              ))}

              {/* Vertical Module Guide Marks (indica baias modulares padronizadas lado a lado) */}
              {Array.from({ length: 19 }).map((_, i) => (
                <line
                  key={`bg_${i}`}
                  x1={160 + i * 140}
                  y1="22"
                  x2={160 + i * 140}
                  y2="200"
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                  opacity="0.4"
                />
              ))}
            </g>

            {/* ==================================================== */}
            {/* 2. VIGA DIVISÓRIA ESTRUTURAL (PERFIL DE ALUMÍNIO)    */}
            {/* ==================================================== */}
            <g id="structural-divider">
              <rect x="0" y="222" width="2800" height="18" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
              <line x1="0" y1="223" x2="2800" y2="223" stroke="#f8fafc" strokeWidth="1.2" />
              <line x1="0" y1="227" x2="2800" y2="227" stroke="#cbd5e1" strokeWidth="0.8" />
              <line x1="0" y1="239" x2="2800" y2="239" stroke="#475569" strokeWidth="1.2" />
              <text x="1400" y="234" fill="#334155" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.8">
                BANCADA DIDÁTICA INDUSTRIAL 2800x1700mm • PERFIL ESTRUTURAL DE ALUMÍNIO RANHURADO DIDACTIC
              </text>
            </g>

            {/* ==================================================== */}
            {/* 3. PAINEL RANHURADO DE PERFIL DE ALUMÍNIO (PNEUMÁTICA) */}
            {/* ==================================================== */}
            <g id="lower-pneumatic-panel">
              {/* Slotted Aluminum Profile Background (Perfil de Alumínio Anodizado Cinza Claro) */}
              <rect x="0" y="240" width="2800" height="1460" fill="url(#aluminum-slats)" />
            </g>

            {/* Workbench External Frame Border */}
            <rect x="0" y="0" width="2800" height="1700" fill="none" stroke="#64748b" strokeWidth="4" />
            <rect x="2" y="2" width="2796" height="1696" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />

            {/* ---------------------------------------------------- */}
            {/* COMPONENTS LAYER */}
            {/* ---------------------------------------------------- */}
            <g id="components-layer">
              {components.map((comp) => {
                const isSelected = selectedComponent?.id === comp.id;
                const isElectrical = comp.category === 'electrical' || comp.type === 'power_supply_24v';
                const rotation = comp.rotation || 0;
                const cx = comp.width / 2;
                const cy = comp.height / 2;

                const isTerminalStrip = comp.type.startsWith('terminal_strip');

                return (
                  <g
                    key={comp.id}
                    id={`comp-${comp.id}`}
                    transform={`translate(${comp.x}, ${comp.y}) rotate(${rotation}, ${cx}, ${cy})`}
                    onMouseDown={(e) => {
                      handleComponentMouseDown(comp, e);
                      if (!isTerminalStrip) onSelectComponent(comp);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isTerminalStrip) onSelectComponent(comp);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isTerminalStrip) {
                        onSelectComponent(comp);
                        setIsParamsOpen(true);
                      }
                    }}
                    className={isTerminalStrip ? 'select-none' : 'cursor-move group'}
                  >
                    <title>{`${comp.name} (${comp.tag}) • Rotação: ${rotation}° • Clique para selecionar / Duplo clique para Parâmetros Técnicos`}</title>
                    
                    {/* Active Selection Outline & Angle Badge */}
                    {isSelected && !isTerminalStrip && (
                      <g className="pointer-events-none">
                        <rect
                          x="-5"
                          y="-5"
                          width={comp.width + 10}
                          height={comp.height + 10}
                          rx="12"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeDasharray="6 3"
                          className="animate-pulse"
                        />
                        <g transform={`translate(${comp.width - 32}, -11)`}>
                          <rect x="0" y="0" width="38" height="15" rx="3.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                          <text x="19" y="11" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                            {rotation}°
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Shadow */}
                    {!isTerminalStrip && (
                      <rect
                        x="2"
                        y="4"
                        width={comp.width}
                        height={comp.height}
                        rx="10"
                        fill="#000000"
                        opacity="0.5"
                      />
                    )}

                    {/* Component Metal Chassis */}
                    {!isTerminalStrip && (
                      <rect
                        x="0"
                        y="0"
                        width={comp.width}
                        height={comp.height}
                        rx="8"
                        fill="#1e293b"
                        stroke={isSelected ? '#38bdf8' : comp.faults?.isLeaking || comp.faults?.isCoilBurned ? '#ef4444' : '#334155'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        className="transition-colors"
                      />
                    )}

                    {/* Rack Fixation Screws (Módulos elétricos aparafusados no rack superior conforme a foto) */}
                    {isElectrical && !isTerminalStrip && (
                      <g>
                        <circle cx="10" cy="5" r="2.5" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
                        <line x1="8.5" y1="5" x2="11.5" y2="5" stroke="#cbd5e1" strokeWidth="0.6" />
                        <circle cx={comp.width - 32} cy="5" r="2.5" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
                        <line x1={comp.width - 33.5} y1="5" x2={comp.width - 30.5} y2="5" stroke="#cbd5e1" strokeWidth="0.6" />
                        <circle cx="10" cy={comp.height - 6} r="2.5" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
                        <line x1="8.5" y1={comp.height - 6} x2="11.5" y2={comp.height - 6} stroke="#cbd5e1" strokeWidth="0.6" />
                        <circle cx={comp.width - 10} cy={comp.height - 6} r="2.5" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
                        <line x1={comp.width - 11.5} y1={comp.height - 6} x2={comp.width - 8.5} y2={comp.height - 6} stroke="#cbd5e1" strokeWidth="0.6" />
                      </g>
                    )}

                    {/* Quick-Clamping Support Bracket for Slotted Aluminum Profile (Componentes pneumáticos) */}
                    {!isElectrical && !isTerminalStrip && (
                      <g>
                        <rect x={comp.width / 2 - 16} y={comp.height - 2} width="32" height="5" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
                        <circle cx={comp.width / 2} cy={comp.height + 0.5} r="1.5" fill="#ffffff" />
                      </g>
                    )}

                    {/* Top Anodized Header Bar */}
                    {!isTerminalStrip && (
                      <>
                        <rect
                          x="0"
                          y="0"
                          width={comp.width}
                          height="28"
                          rx="8"
                          fill="#0f172a"
                        />
                        <rect
                          x="0"
                          y="20"
                          width={comp.width}
                          height="8"
                          fill="#0f172a"
                        />

                        {/* Tag Badge (e.g. 1A, 1V, K1) */}
                        <rect
                          x="8"
                          y="5"
                          width="38"
                          height="18"
                          rx="4"
                          fill={comp.faults?.isLeaking || comp.faults?.isCoilBurned ? '#ef4444' : '#0284c7'}
                        />
                        <text
                          x="27"
                          y="18"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          {comp.tag}
                        </text>

                        {/* Festo Didactic brand badge for electrical rack modules */}
                        {isElectrical && (
                          <text
                            x={comp.width - 50}
                            y="17"
                            fill="#38bdf8"
                            fontSize="8"
                            fontWeight="bold"
                            letterSpacing="0.5"
                            fontFamily="'JetBrains Mono', monospace"
                          >
                            FESTO
                          </text>
                        )}

                        {/* Delete Component icon button */}
                        <g
                          transform={`translate(${comp.width - 24}, 5)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteComponent(comp.id);
                          }}
                          className="cursor-pointer opacity-40 hover:opacity-100 transition"
                        >
                          <rect width="18" height="18" rx="4" fill="#334155" />
                          <text x="9" y="13" fill="#f87171" fontSize="12" textAnchor="middle">×</text>
                        </g>
                      </>
                    )}

                    {/* ==================================================== */}
                    {/* RÉGUA DE BORNES +24V CC (BARRAMENTO SUPERIOR)        */}
                    {/* ==================================================== */}
                    {comp.type === 'terminal_strip_24v' && (() => {
                      const isStripEnergized = connections.some(
                        (c) => c.active && (c.fromComponentId === comp.id || c.toComponentId === comp.id)
                      );

                      return (
                        <g id={`terminal-strip-24v-${comp.id}`}>
                          {/* Sombra sutil de profundidade */}
                          <rect x="0" y="1" width={comp.width} height={comp.height} rx="3" fill="#000000" opacity="0.45" />

                          {/* Base de fixação em perfil/trilho DIN de alumínio */}
                          <rect x="0" y="0" width={comp.width} height={comp.height} rx="2.5" fill="#334155" stroke="#475569" strokeWidth="0.8" />
                          <line x1="0" y1="1" x2={comp.width} y2="1" stroke="#94a3b8" strokeWidth="0.8" opacity="0.7" />
                          <line x1="0" y1={comp.height - 1} x2={comp.width} y2={comp.height - 1} stroke="#1e293b" strokeWidth="0.8" />

                          {/* Corpo isolante contínuo em poliamida vermelha industrial (+24V) */}
                          <rect x="2" y="1.5" width={comp.width - 4} height={comp.height - 3} rx="2" fill="url(#term-strip-24v-grad)" stroke="#991b1b" strokeWidth="0.6" />

                          {/* Barramento interno condutor de cobre em toda a extensão */}
                          <line x1="10" y1={comp.height / 2} x2={comp.width - 10} y2={comp.height / 2} stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="3 1.5" opacity="0.45" />

                          {/* Bloco de Entrada Especial (FONTE IN) na extremidade esquerda */}
                          <rect x="6" y="2" width="56" height={comp.height - 4} rx="2" fill="#7f1d1d" stroke="#f59e0b" strokeWidth="1" />
                          
                          {/* LED Indicador de Potencial 24V Ativo */}
                          <circle cx="15" cy={comp.height / 2} r="3" fill="#0f172a" stroke="#d97706" strokeWidth="0.8" />
                          <circle
                            cx="15"
                            cy={comp.height / 2}
                            r="2"
                            fill={isStripEnergized ? '#22c55e' : '#450a0a'}
                            filter={isStripEnergized ? 'url(#hose-glow)' : undefined}
                          />

                          {/* Marcações Técnicas Serigrafadas */}
                          <text x="135" y="11" fill="#fecaca" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" opacity="0.85">
                            BARRAMENTO +24V CC (ALIMENTAÇÃO) • IEC 60204-1
                          </text>
                          <text x="750" y="11" fill="#fca5a5" fontSize="6.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace" opacity="0.65">
                            DISTRIBUIDOR EQUIPOTENCIAL 24VDC • MÁX. 10A
                          </text>
                          <text x="1400" y="11" fill="#fecaca" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" opacity="0.85">
                            RÉGUA SUPERIOR DE BORNES 24V (2800mm) • 56 BORNES
                          </text>
                          <text x="2100" y="11" fill="#fca5a5" fontSize="6.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace" opacity="0.65">
                            ISOLAÇÃO INDUSTRIAL POLIAMIDA 6.6
                          </text>
                          <text x="2670" y="11" fill="#fbbf24" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                            FESTO DIDACTIC
                          </text>
                        </g>
                      );
                    })()}

                    {/* ==================================================== */}
                    {/* RÉGUA DE BORNES 0V CC GND (BARRAMENTO INFERIOR)       */}
                    {/* ==================================================== */}
                    {comp.type === 'terminal_strip_0v' && (() => {
                      const isStripGrounded = connections.some(
                        (c) => c.active && (c.fromComponentId === comp.id || c.toComponentId === comp.id)
                      );

                      return (
                        <g id={`terminal-strip-0v-${comp.id}`}>
                          {/* Sombra sutil de profundidade */}
                          <rect x="0" y="1" width={comp.width} height={comp.height} rx="3" fill="#000000" opacity="0.45" />

                          {/* Base de fixação em perfil/trilho DIN de alumínio */}
                          <rect x="0" y="0" width={comp.width} height={comp.height} rx="2.5" fill="#334155" stroke="#475569" strokeWidth="0.8" />
                          <line x1="0" y1="1" x2={comp.width} y2="1" stroke="#94a3b8" strokeWidth="0.8" opacity="0.7" />
                          <line x1="0" y1={comp.height - 1} x2={comp.width} y2={comp.height - 1} stroke="#1e293b" strokeWidth="0.8" />

                          {/* Corpo isolante contínuo em poliamida azul industrial (0V GND) */}
                          <rect x="2" y="1.5" width={comp.width - 4} height={comp.height - 3} rx="2" fill="url(#term-strip-0v-grad)" stroke="#1e3a8a" strokeWidth="0.6" />

                          {/* Barramento interno condutor de retorno estanhado em toda a extensão */}
                          <line x1="10" y1={comp.height / 2} x2={comp.width - 10} y2={comp.height / 2} stroke="#93c5fd" strokeWidth="1.2" strokeDasharray="3 1.5" opacity="0.45" />

                          {/* Bloco de Entrada Especial (FONTE IN) na extremidade esquerda */}
                          <rect x="6" y="2" width="56" height={comp.height - 4} rx="2" fill="#172554" stroke="#38bdf8" strokeWidth="1" />
                          
                          {/* LED Indicador de Conexão 0V GND Ativa */}
                          <circle cx="15" cy={comp.height / 2} r="3" fill="#0f172a" stroke="#0284c7" strokeWidth="0.8" />
                          <circle
                            cx="15"
                            cy={comp.height / 2}
                            r="2"
                            fill={isStripGrounded ? '#38bdf8' : '#082f49'}
                            filter={isStripGrounded ? 'url(#hose-glow)' : undefined}
                          />

                          {/* Marcações Técnicas Serigrafadas */}
                          <text x="135" y="11" fill="#dbeafe" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" opacity="0.85">
                            BARRAMENTO 0V CC (COMUM / GND) • IEC 60204-1
                          </text>
                          <text x="750" y="11" fill="#bfdbfe" fontSize="6.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace" opacity="0.65">
                            DISTRIBUIDOR EQUIPOTENCIAL 0VDC • REFERÊNCIA DE TERRA
                          </text>
                          <text x="1400" y="11" fill="#dbeafe" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace" opacity="0.85">
                            RÉGUA INFERIOR DE BORNES 0V (2800mm) • 56 BORNES
                          </text>
                          <text x="2100" y="11" fill="#bfdbfe" fontSize="6.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace" opacity="0.65">
                            ISOLAÇÃO INDUSTRIAL POLIAMIDA 6.6
                          </text>
                          <text x="2670" y="11" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                            FESTO DIDACTIC
                          </text>
                        </g>
                      );
                    })()}

                    {/* ------------------------------------------------ */}
                    {/* CUSTOM INTERNAL GRAPHICS PER COMPONENT TYPE */}
                    {/* ------------------------------------------------ */}
                    {/* 1. DOUBLE ACTING CYLINDER */}
                    {comp.type === 'double_acting_cylinder' && (() => {
                      const strokePct = comp.state.position || 0;
                      // Inside barrel limits
                      const barrelX = 14;
                      const barrelWidth = 168;
                      const barrelY = 32;
                      const barrelH = 56;
                      const pistonX = barrelX + 16 + (strokePct / 100) * 146;
                      
                      // External chrome rod extending OUTSIDE the cylinder rectangle (comp.width = 250)
                      // When stroke is 0%, rod tip sphere extends 25px outside comp.width (at X = 275, 0mm)
                      // When stroke is 100%, rod tip sphere extends 325px outside comp.width (at X = 575, 300mm stroke completo no batente)
                      const rodTipX = comp.width + 25 + (strokePct / 100) * 300;
                      const rodStartY = 53;
                      const rodHeight = 14;
                      const centerY = 60;

                      // Identificar se há sensores fixados no trilho deste cilindro
                      const hasSnappedSensors = components.some(
                        c => c.type === 'reed_switch_sensor' && c.state.railCylinderId === comp.id && c.state.snappedToRail
                      );

                      // Atuação por proximidade industrial sem contato:
                      // Ocorre quando a esfera da haste do cilindro estiver próxima do sensor
                      // e alinhada pelo centro da tampa do sensor com o alinhamento vertical do centro da esfera.
                      const sphereWorldX = comp.x + rodTipX;
                      const sphereWorldY = comp.y + centerY;
                      const actuatedSensor = components.find(c => {
                        if (c.type !== 'reed_switch_sensor' || !c.state.sensorDetected) return false;
                        const sensorCapCenterX = c.x + c.width / 2;
                        const sensorCapCenterY = c.y + 15;
                        const isVerticalAligned = Math.abs(sphereWorldX - sensorCapCenterX) <= 16;
                        const verticalDist = sensorCapCenterY - sphereWorldY;
                        return isVerticalAligned && verticalDist >= 20 && verticalDist <= 60;
                      });
                      const isNearSensor = Boolean(actuatedSensor);

                      return (
                        <g>
                          {/* Cylinder Tie-Rods (Tirantes ISO 15552) */}
                          <line x1={barrelX} y1={barrelY + 4} x2={barrelX + barrelWidth + 14} y2={barrelY + 4} stroke="#475569" strokeWidth="2.5" />
                          <line x1={barrelX} y1={barrelY + barrelH - 4} x2={barrelX + barrelWidth + 14} y2={barrelY + barrelH - 4} stroke="#475569" strokeWidth="2.5" />

                          {/* Rear End Cap (Cabeçote Traseiro) */}
                          <rect x={barrelX - 2} y={barrelY - 2} width="16" height={barrelH + 4} rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

                          {/* Cylinder Barrel Extrusion (Camisa Anodizada) */}
                          <rect x={barrelX + 14} y={barrelY} width={barrelWidth} height={barrelH} rx="2" fill="#0b1329" stroke="#334155" strokeWidth="1.5" />
                          
                          {/* Barrel Profile Grooves */}
                          <line x1={barrelX + 14} y1={barrelY + 12} x2={barrelX + 14 + barrelWidth} y2={barrelY + 12} stroke="#1e293b" strokeWidth="1" />
                          <line x1={barrelX + 14} y1={barrelY + barrelH - 12} x2={barrelX + 14 + barrelWidth} y2={barrelY + barrelH - 12} stroke="#1e293b" strokeWidth="1" />

                          {/* Front Bearing Cap & Nose Bushing (Cabeçote Dianteiro com Guia da Haste) */}
                          <rect x={barrelX + 14 + barrelWidth} y={barrelY - 2} width="16" height={barrelH + 4} rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                          <rect x={barrelX + 30 + barrelWidth} y={centerY - 12} width="12" height="24" rx="2" fill="#334155" stroke="#475569" strokeWidth="1" />
                          {/* Wiper seal (raspador de haste) */}
                          <rect x={barrelX + 40 + barrelWidth} y={centerY - 9} width="3" height="18" rx="1" fill="#0284c7" />

                          {/* Continuous Chrome Rod extending OUT of the cylinder card */}
                          <rect
                            x={pistonX + 16}
                            y={rodStartY}
                            width={rodTipX - (pistonX + 16)}
                            height={rodHeight}
                            rx="2"
                            fill="url(#chrome-rod-grad)"
                            stroke="#94a3b8"
                            strokeWidth="0.8"
                          />
                          {/* Specular longitudinal reflection line along the rod */}
                          <line
                            x1={pistonX + 18}
                            y1={rodStartY + 3}
                            x2={rodTipX - 6}
                            y2={rodStartY + 3}
                            stroke="#ffffff"
                            strokeWidth="1.2"
                            opacity="0.7"
                          />

                          {/* Magnetic Piston Head (Êmbolo com anel magnético permanente) */}
                          <rect x={pistonX} y={barrelY + 4} width="18" height={barrelH - 8} rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                          {/* Neodymium Magnet Core */}
                          <rect x={pistonX + 5} y={barrelY + 9} width="8" height={barrelH - 18} rx="1" fill="#ef4444" />
                          {/* Piston Wear Rings */}
                          <line x1={pistonX + 2} y1={barrelY + 4} x2={pistonX + 2} y2={barrelY + barrelH - 4} stroke="#38bdf8" strokeWidth="1.5" />
                          <line x1={pistonX + 16} y1={barrelY + 4} x2={pistonX + 16} y2={barrelY + barrelH - 4} stroke="#38bdf8" strokeWidth="1.5" />

                          {/* ------------------------------------------------------------- */}
                          {/* EXTERNAL SENSOR FIXATION RAIL & CALIBRATED STROKE RULER */}
                          {/* Trilho guia magnético ampliado para cobrir com folga todo o curso do cilindro */}
                          {/* ------------------------------------------------------------- */}
                          <g transform={`translate(${comp.width}, 0)`}>
                            {/* Braço Mecânico de Fixação Estrutural do Trilho ao Cabeçote Dianteiro */}
                            <rect x="-8" y="70" width="12" height="54" rx="2" fill="#334155" stroke="#475569" strokeWidth="1" />
                            <circle cx="-2" cy="78" r="2" fill="#94a3b8" />
                            <circle cx="-2" cy="116" r="2" fill="#94a3b8" />

                            {/* Perfil de Alumínio Ranhurado de Fixação dos Sensores (Ampliado para 340px) */}
                            <rect
                              x="0"
                              y="120"
                              width="340"
                              height="20"
                              rx="3"
                              fill="#1e293b"
                              stroke={hasSnappedSensors ? "#38bdf8" : "#475569"}
                              strokeWidth={hasSnappedSensors ? "1.5" : "1"}
                            />
                            {/* Ranhura em T Magnética Central */}
                            <rect x="3" y="124" width="331" height="12" rx="1.5" fill="#090f1d" stroke="#334155" strokeWidth="0.8" />
                            <line
                              x1="6"
                              y1="130"
                              x2="331"
                              y2="130"
                              stroke={hasSnappedSensors ? "#38bdf8" : "#475569"}
                              strokeWidth="1.5"
                              strokeDasharray="6 3"
                              opacity={hasSnappedSensors ? 0.9 : 0.6}
                            />

                            {/* Batente Terminal Mecânico de Fim de Curso do Trilho */}
                            <rect x="334" y="117" width="8" height="26" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                            <circle cx="338" cy="122" r="1.5" fill="#0f172a" />
                            <circle cx="338" cy="138" r="1.5" fill="#0f172a" />
                            
                            {/* Identificação do Trilho e Guia Magnética */}
                            <g transform="translate(0, 102)">
                              <rect
                                x="35"
                                y="0"
                                width="255"
                                height="14"
                                rx="2"
                                fill="#0f172a"
                                stroke={hasSnappedSensors ? "#38bdf8" : "#334155"}
                                strokeWidth="0.8"
                              />
                              <text
                                x="162.5"
                                y="10"
                                fill={hasSnappedSensors ? "#38bdf8" : "#94a3b8"}
                                fontSize="7"
                                fontWeight="bold"
                                fontFamily="'JetBrains Mono'"
                                textAnchor="middle"
                              >
                                {hasSnappedSensors ? "🧲 TRILHO: GUIA MAGNÉTICA ATIVA" : "TRILHO GUIA MAGNÉTICO (CURSO TOTAL 300mm)"}
                              </text>
                            </g>

                            {/* Marcações Calibradas de Curso e Fim de Curso */}
                            <line x1="25" y1="120" x2="25" y2="140" stroke="#38bdf8" strokeWidth="1.5" />
                            <text x="25" y="150" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              0mm (1S1)
                            </text>
                            
                            <line x1="75" y1="122" x2="75" y2="134" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="75" y="148" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              50mm
                            </text>

                            <line x1="125" y1="120" x2="125" y2="138" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 2" />
                            <text x="125" y="150" fill="#94a3b8" fontSize="6.5" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              100mm
                            </text>

                            <line x1="175" y1="122" x2="175" y2="134" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="175" y="148" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              150mm
                            </text>

                            <line x1="225" y1="122" x2="225" y2="134" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="225" y="148" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              200mm
                            </text>

                            <line x1="275" y1="122" x2="275" y2="134" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="275" y="148" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              250mm
                            </text>

                            <line x1="325" y1="120" x2="325" y2="142" stroke="#38bdf8" strokeWidth="2" />
                            <text x="325" y="152" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              300mm (1S2 - FIM DE CURSO)
                            </text>

                            <text x="338" y="152" fill="#64748b" fontSize="5.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              BATENTE
                            </text>
                          </g>

                          {/* ------------------------------------------------------------- */}
                          {/* ESFERA ATUADORA METÁLICA NA PONTA DA HASTE */}
                          {/* ------------------------------------------------------------- */}
                          {/* Hexagonal Locking Nut */}
                          <rect x={rodTipX - 14} y={centerY - 7} width="6" height="14" rx="1.5" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                          <line x1={rodTipX - 11} y1={centerY - 6} x2={rodTipX - 11} y2={centerY + 6} stroke="#cbd5e1" strokeWidth="0.6" />

                          {/* Threaded Rod Stud */}
                          <rect x={rodTipX - 8} y={centerY - 4} width="8" height="8" fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" />

                          {/* Feixe e Retículo de Alinhamento Vertical Centro-a-Centro Sem Contato */}
                          {isNearSensor && actuatedSensor && (() => {
                            const sensorCapRelX = actuatedSensor.x + 55 - comp.x;
                            const sensorCapRelY = actuatedSensor.y + 15 - comp.y;
                            const capTopRelY = actuatedSensor.y + 12 - comp.y;
                            const sphereBottomY = centerY + 10;
                            const airGap = Math.max(0, capTopRelY - sphereBottomY);

                            return (
                              <g id="proximity-center-alignment-double">
                                {/* 1. Feixe Pontilhado Unindo o Centro da Esfera ao Centro da Tampa do Sensor */}
                                <line
                                  x1={rodTipX}
                                  y1={centerY}
                                  x2={sensorCapRelX}
                                  y2={sensorCapRelY}
                                  stroke="#34d399"
                                  strokeWidth="2.5"
                                  strokeDasharray="3 2"
                                  opacity="0.95"
                                />

                                {/* 2. Linha Guia Vertical Estendida Perpendicular a 90° */}
                                <line
                                  x1={rodTipX}
                                  y1={centerY - 18}
                                  x2={rodTipX}
                                  y2={sensorCapRelY + 12}
                                  stroke="#10b981"
                                  strokeWidth="1"
                                  strokeDasharray="2 3"
                                  opacity="0.6"
                                />

                                {/* 3. Retículo e Mira Concêntrica no Centro da Esfera */}
                                <circle cx={rodTipX} cy={centerY} r="3.5" fill="#34d399" />
                                <circle cx={rodTipX} cy={centerY} r="18" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                                <circle cx={rodTipX} cy={centerY} r="26" fill="url(#actuator-sphere-glow)" opacity="0.85" />
                                <line x1={rodTipX - 14} y1={centerY} x2={rodTipX + 14} y2={centerY} stroke="#34d399" strokeWidth="1.2" />
                                <line x1={rodTipX} y1={centerY - 14} x2={rodTipX} y2={centerY + 14} stroke="#34d399" strokeWidth="1.2" />

                                {/* 4. Ondas do Campo de Proximidade no Entreferro de Ar (Sem Contato Mecânico) */}
                                <g transform={`translate(${rodTipX}, ${(sphereBottomY + capTopRelY) / 2})`}>
                                  <ellipse cx="0" cy="0" rx="14" ry="3.5" fill="none" stroke="#34d399" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
                                  <ellipse cx="0" cy="0" rx="20" ry="4.5" fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.55" />
                                </g>

                                {/* 5. Etiqueta de Alinhamento Vertical e Entreferro */}
                                <g transform={`translate(${rodTipX}, ${centerY - 22})`}>
                                  <rect x="-72" y="-9" width="144" height="13" rx="2" fill="#0f172a" stroke="#34d399" strokeWidth="0.9" opacity="0.95" />
                                  <text x="0" y="0.5" fill="#34d399" fontSize="6.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                    ⌖ CENTROS ALINHADOS | SEM CONTATO ({airGap > 0 ? `GAP ${airGap}mm` : 'PROXIMIDADE'})
                                  </text>
                                </g>
                              </g>
                            );
                          })()}

                          {/* The Precision Metallic Actuator Sphere (Esfera Atuadora Metálica Ø20mm) */}
                          <circle cx={rodTipX} cy={centerY} r="10" fill="url(#actuator-sphere-grad)" stroke={isNearSensor ? "#34d399" : "#94a3b8"} strokeWidth="1.2" />
                          {/* Specular curved highlight */}
                          <circle cx={rodTipX - 3} cy={centerY - 3} r="3" fill="#ffffff" opacity="0.85" />
                          <ellipse cx={rodTipX + 2} cy={centerY + 5} rx="4" ry="1.5" fill="#334155" opacity="0.5" />

                          {/* Sphere Callout / Tag */}
                          <g transform={`translate(${rodTipX}, ${centerY - 16})`}>
                            <text
                              x="0"
                              y="0"
                              fill={isNearSensor ? "#34d399" : "#94a3b8"}
                              fontSize="6.5"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {isNearSensor ? "⌖ ALINHAMENTO VERTICAL (90° ATIVO)" : "ESFERA Ø20"}
                            </text>
                          </g>

                          {/* Internal Stroke display inside component card */}
                          <text x="70" y="24" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono'">
                            CURSO: {strokePct.toFixed(0)}% ({((strokePct / 100) * 300).toFixed(0)}mm)
                          </text>
                        </g>
                      );
                    })()}

                    {/* 2. SINGLE ACTING CYLINDER */}
                    {comp.type === 'single_acting_cylinder' && (() => {
                      const strokePct = comp.state.position || 0;
                      const barrelX = 14;
                      const barrelWidth = 145;
                      const barrelY = 26;
                      const barrelH = 48;
                      const centerY = 50;
                      const pistonX = barrelX + 14 + (strokePct / 100) * 115;
                      
                      // External chrome rod extending OUTSIDE cylinder rectangle
                      const rodTipX = comp.width + 20 + (strokePct / 100) * 200;
                      
                      const hasSnappedSensors = components.some(
                        c => c.type === 'reed_switch_sensor' && c.state.railCylinderId === comp.id && c.state.snappedToRail
                      );

                      const sphereWorldX = comp.x + rodTipX;
                      const sphereWorldY = comp.y + centerY;
                      const actuatedSensor = components.find(c => {
                        if (c.type !== 'reed_switch_sensor' || !c.state.sensorDetected) return false;
                        const sensorCapCenterX = c.x + c.width / 2;
                        const sensorCapCenterY = c.y + 15;
                        const isVerticalAligned = Math.abs(sphereWorldX - sensorCapCenterX) <= 16;
                        const verticalDist = sensorCapCenterY - sphereWorldY;
                        return isVerticalAligned && verticalDist >= 20 && verticalDist <= 60;
                      });
                      const isNearSensor = Boolean(actuatedSensor);

                      return (
                        <g>
                          {/* Rear cap */}
                          <rect x={barrelX - 2} y={barrelY - 2} width="14" height={barrelH + 4} rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

                          {/* Barrel */}
                          <rect x={barrelX + 12} y={barrelY} width={barrelWidth} height={barrelH} rx="2" fill="#0b1329" stroke="#334155" strokeWidth="1.5" />
                          
                          {/* Internal Compression Spring (Mola de Retorno) */}
                          <path
                            d={`M ${pistonX + 16} ${centerY} L ${pistonX + 26} ${centerY - 12} L ${pistonX + 38} ${centerY + 12} L ${pistonX + 50} ${centerY - 12} L ${pistonX + 62} ${centerY + 12} L ${pistonX + 74} ${centerY - 12} L ${barrelX + 12 + barrelWidth} ${centerY}`}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="1.8"
                          />

                          {/* Front Cap */}
                          <rect x={barrelX + 12 + barrelWidth} y={barrelY - 2} width="14" height={barrelH + 4} rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

                          {/* Continuous Chrome Rod extending OUT of cylinder card */}
                          <rect
                            x={pistonX + 14}
                            y={centerY - 6}
                            width={rodTipX - (pistonX + 14)}
                            height={12}
                            rx="2"
                            fill="url(#chrome-rod-grad)"
                            stroke="#94a3b8"
                            strokeWidth="0.8"
                          />

                          {/* Piston Head */}
                          <rect x={pistonX} y={barrelY + 4} width="14" height={barrelH - 8} rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.2" />

                          {/* External Sensor Fixation Rail (Afastado da haste, ranhura central em y=118, ampliado para 270px) */}
                          <g transform={`translate(${comp.width}, 0)`}>
                            {/* Braço de Fixação Estrutural */}
                            <rect x="-6" y="58" width="10" height="50" rx="2" fill="#334155" stroke="#475569" strokeWidth="1" />
                            <circle cx="-1" cy="65" r="1.8" fill="#94a3b8" />
                            <circle cx="-1" cy="104" r="1.8" fill="#94a3b8" />

                            <rect
                              x="0"
                              y="108"
                              width="234"
                              height="20"
                              rx="2"
                              fill="#1e293b"
                              stroke={hasSnappedSensors ? "#38bdf8" : "#475569"}
                              strokeWidth={hasSnappedSensors ? "1.5" : "1"}
                            />
                            <rect x="2" y="112" width="226" height="12" rx="1" fill="#090f1d" stroke="#334155" strokeWidth="0.8" />
                            <line
                              x1="4"
                              y1="118"
                              x2="226"
                              y2="118"
                              stroke={hasSnappedSensors ? "#38bdf8" : "#475569"}
                              strokeWidth="1.5"
                              strokeDasharray="6 2"
                            />

                            {/* Batente Terminal Mecânico de Fim de Curso */}
                            <rect x="228" y="105" width="6" height="26" rx="1.5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />

                            <text
                              x="117"
                              y="96"
                              fill={hasSnappedSensors ? "#38bdf8" : "#94a3b8"}
                              fontSize="6.5"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {hasSnappedSensors ? "🧲 TRILHO: GUIA MAGNÉTICA ATIVA" : "TRILHO GUIA MAGNÉTICO (CURSO TOTAL 200mm)"}
                            </text>
                            <line x1="20" y1="108" x2="20" y2="128" stroke="#38bdf8" strokeWidth="1.2" />
                            <text x="20" y="138" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">0mm</text>
                            <line x1="70" y1="110" x2="70" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="70" y="138" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">50mm</text>
                            <line x1="120" y1="110" x2="120" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="120" y="138" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">100mm</text>
                            <line x1="170" y1="110" x2="170" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="170" y="138" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">150mm</text>
                            <line x1="220" y1="108" x2="220" y2="130" stroke="#38bdf8" strokeWidth="1.5" />
                            <text x="220" y="140" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">200mm (FIM DE CURSO)</text>
                            <text x="230" y="140" fill="#64748b" fontSize="5.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BATENTE</text>
                          </g>

                          {/* Esfera Atuadora Metálica na ponta da haste */}
                          <rect x={rodTipX - 12} y={centerY - 6} width="5" height="12" rx="1" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                          {isNearSensor && actuatedSensor && (() => {
                            const sensorCapRelX = actuatedSensor.x + 55 - comp.x;
                            const sensorCapRelY = actuatedSensor.y + 15 - comp.y;
                            const capTopRelY = actuatedSensor.y + 12 - comp.y;
                            const sphereBottomY = centerY + 9;
                            const airGap = Math.max(0, capTopRelY - sphereBottomY);

                            return (
                              <g id="proximity-center-alignment-single">
                                {/* 1. Feixe Pontilhado Unindo Centro da Esfera ao Centro da Tampa */}
                                <line
                                  x1={rodTipX}
                                  y1={centerY}
                                  x2={sensorCapRelX}
                                  y2={sensorCapRelY}
                                  stroke="#34d399"
                                  strokeWidth="2.5"
                                  strokeDasharray="3 2"
                                  opacity="0.95"
                                />

                                {/* 2. Linha Guia Vertical Perpendicular a 90° */}
                                <line
                                  x1={rodTipX}
                                  y1={centerY - 16}
                                  x2={rodTipX}
                                  y2={sensorCapRelY + 10}
                                  stroke="#10b981"
                                  strokeWidth="1"
                                  strokeDasharray="2 3"
                                  opacity="0.6"
                                />

                                {/* 3. Retículo e Mira Concêntrica no Centro da Esfera */}
                                <circle cx={rodTipX} cy={centerY} r="3" fill="#34d399" />
                                <circle cx={rodTipX} cy={centerY} r="16" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                                <circle cx={rodTipX} cy={centerY} r="22" fill="url(#actuator-sphere-glow)" opacity="0.85" />
                                <line x1={rodTipX - 12} y1={centerY} x2={rodTipX + 12} y2={centerY} stroke="#34d399" strokeWidth="1.2" />
                                <line x1={rodTipX} y1={centerY - 12} x2={rodTipX} y2={centerY + 12} stroke="#34d399" strokeWidth="1.2" />

                                {/* 4. Ondas do Campo de Proximidade no Entreferro de Ar */}
                                <g transform={`translate(${rodTipX}, ${(sphereBottomY + capTopRelY) / 2})`}>
                                  <ellipse cx="0" cy="0" rx="12" ry="3" fill="none" stroke="#34d399" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.85" />
                                </g>

                                {/* 5. Etiqueta de Alinhamento */}
                                <g transform={`translate(${rodTipX}, ${centerY - 20})`}>
                                  <rect x="-68" y="-8" width="136" height="12" rx="2" fill="#0f172a" stroke="#34d399" strokeWidth="0.9" opacity="0.95" />
                                  <text x="0" y="0.5" fill="#34d399" fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                    ⌖ CENTROS ALINHADOS | SEM CONTATO ({airGap > 0 ? `GAP ${airGap}mm` : 'PROXIMIDADE'})
                                  </text>
                                </g>
                              </g>
                            );
                          })()}
                          <circle cx={rodTipX} cy={centerY} r="9" fill="url(#actuator-sphere-grad)" stroke={isNearSensor ? "#34d399" : "#94a3b8"} strokeWidth="1.2" />
                          <circle cx={rodTipX - 2.5} cy={centerY - 2.5} r="2.5" fill="#ffffff" opacity="0.85" />
                          <text x={rodTipX} y={centerY - 14} fill={isNearSensor ? "#34d399" : "#94a3b8"} fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                            {isNearSensor ? "⌖ ALINHAMENTO VERTICAL (90°)" : "ESFERA Ø18"}
                          </text>

                          <text x="60" y="20" fill="#38bdf8" fontSize="8.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
                            CURSO: {strokePct.toFixed(0)}% ({((strokePct / 100) * 200).toFixed(0)}mm)
                          </text>
                        </g>
                      );
                    })()}

                    {/* 3. FRL UNIT (UNIDADE DE CONSERVAÇÃO FRL: FILTRO-REGULADOR-LUBRIFICADOR) */}
                    {comp.type === 'frl_unit' && (() => {
                      const pressure = comp.state.pressureP ?? 6.0;
                      // Pressure gauge calculations (0 to 1.0 MPa / 0 to 10 bar)
                      const clampedP = Math.max(0, Math.min(10, pressure));
                      // Needle sweep: 270 degrees total. 0 bar = -135° (down-left), 5 bar = 0° (up), 10 bar = +135° (down-right)
                      const needleAngleDeg = -135 + (clampedP / 10) * 270;
                      const needleAngleRad = ((needleAngleDeg - 90) * Math.PI) / 180;
                      const gaugeCx = 44;
                      const gaugeCy = 74;
                      const needleR = 14;
                      const needleTipX = gaugeCx + needleR * Math.cos(needleAngleRad);
                      const needleTipY = gaugeCy + needleR * Math.sin(needleAngleRad);
                      const counterX = gaugeCx - 4 * Math.cos(needleAngleRad);
                      const counterY = gaugeCy - 4 * Math.sin(needleAngleRad);
                      const isPurging = purgingFrlId === comp.id;

                      // Gauge tick marks (0, 0.2, 0.4, 0.6, 0.8, 1.0 MPa)
                      const majorTicks = [
                        { val: '0', mpa: 0, deg: -135 },
                        { val: '0.2', mpa: 2, deg: -81 },
                        { val: '0.4', mpa: 4, deg: -27 },
                        { val: '0.6', mpa: 6, deg: 27 },
                        { val: '0.8', mpa: 8, deg: 81 },
                        { val: '1.0', mpa: 10, deg: 135 },
                      ];

                      return (
                        <g id={`frl-assembly-${comp.id}`}>
                          {/* ------------------------------------------------------------- */}
                          {/* 0. REAR STEEL MOUNTING BRACKET (SUPORTE TRASEIRO DE FIXAÇÃO) */}
                          {/* ------------------------------------------------------------- */}
                          {/* Central black steel mounting bracket with two vertical oval slots as in photo */}
                          <g id="frl-rear-bracket">
                            <rect x="58" y="18" width="34" height="48" rx="4" fill="#090e1a" stroke="#334155" strokeWidth="1.2" />
                            {/* Left mounting oval hole / slot */}
                            <rect x="64" y="24" width="7" height="13" rx="3.5" fill="#020617" stroke="#475569" strokeWidth="1" />
                            {/* Right mounting oval hole / slot */}
                            <rect x="79" y="24" width="7" height="13" rx="3.5" fill="#020617" stroke="#475569" strokeWidth="1" />
                            {/* Bracket reinforcement bend shadow */}
                            <line x1="59" y1="44" x2="91" y2="44" stroke="#1e293b" strokeWidth="1.5" />
                          </g>

                          {/* ------------------------------------------------------------- */}
                          {/* 1. LEFT COLUMN: FILTER-REGULATOR (FILTRO-REGULADOR COMBINADO) */}
                          {/* ------------------------------------------------------------- */}
                          <g id="frl-regulator-column">
                            {/* --- 1A. PRESSURE ADJUSTMENT KNOB (MANÍPULO GIRATÓRIO PRETO) --- */}
                            <g
                              className="cursor-pointer group/knob"
                              onClick={(e) => handleAdjustFrlPressure(comp, e)}
                            >
                              <title>Clique para ajustar a pressão regulada (+1 bar)</title>
                              {/* Knob upper fluted body */}
                              <rect
                                x="28"
                                y="14"
                                width="32"
                                height="22"
                                rx="3.5"
                                fill="url(#frl-knob-grad)"
                                stroke="#475569"
                                strokeWidth="1"
                                className="transition-all group-hover/knob:stroke-cyan-400"
                              />
                              {/* Top beveled cap */}
                              <rect x="30" y="14" width="28" height="4" rx="2" fill="#334155" />
                              {/* Vertical grip flutes (5 grooves) */}
                              <line x1="33" y1="18" x2="33" y2="34" stroke="#475569" strokeWidth="1.2" />
                              <line x1="38.5" y1="18" x2="38.5" y2="34" stroke="#64748b" strokeWidth="1.2" />
                              <line x1="44" y1="18" x2="44" y2="34" stroke="#64748b" strokeWidth="1.2" />
                              <line x1="49.5" y1="18" x2="49.5" y2="34" stroke="#64748b" strokeWidth="1.2" />
                              <line x1="55" y1="18" x2="55" y2="34" stroke="#475569" strokeWidth="1.2" />
                              {/* Rotary arrows cue */}
                              <text x="44" y="22" fill="#94a3b8" fontSize="5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                ↺ PULL ↻
                              </text>
                            </g>

                            {/* --- 1B. VIBRANT RED LOCKING COLLAR / RING (ANEL TRAVA VERMELHO) --- */}
                            {/* Characteristic industrial feature from the user's photo */}
                            <g id="frl-red-lock-ring">
                              <rect
                                x="25"
                                y="36"
                                width="38"
                                height="8"
                                rx="2"
                                fill="url(#frl-red-collar-grad)"
                                stroke="#991b1b"
                                strokeWidth="0.8"
                              />
                              {/* Specular highlight line along the collar */}
                              <line x1="27" y1="38" x2="61" y2="38" stroke="#fca5a5" strokeWidth="0.8" opacity="0.9" />
                              {/* Lock teeth ridges */}
                              <line x1="30" y1="40" x2="30" y2="43" stroke="#7f1d1d" strokeWidth="1" />
                              <line x1="37" y1="40" x2="37" y2="43" stroke="#7f1d1d" strokeWidth="1" />
                              <line x1="44" y1="40" x2="44" y2="43" stroke="#7f1d1d" strokeWidth="1" />
                              <line x1="51" y1="40" x2="51" y2="43" stroke="#7f1d1d" strokeWidth="1" />
                              <line x1="58" y1="40" x2="58" y2="43" stroke="#7f1d1d" strokeWidth="1" />
                            </g>

                            {/* --- 1C. CAST ALUMINUM REGULATOR BODY (CORPO METÁLICO PRETO) --- */}
                            <rect
                              x="17"
                              y="44"
                              width="54"
                              height="50"
                              rx="3"
                              fill="url(#frl-metal-body)"
                              stroke="#334155"
                              strokeWidth="1.3"
                            />
                            {/* Left edge pneumatic inlet port boss (Bocal P) */}
                            <rect x="7" y="66" width="11" height="16" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                            {/* Brass hexagonal nut */}
                            <rect x="9" y="68" width="5" height="12" rx="1" fill="#94a3b8" stroke="#64748b" strokeWidth="0.6" />
                            {/* Blue Festo push-in connector collar */}
                            <rect x="5" y="69.5" width="4" height="9" rx="1.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />
                            {/* Air flow indicator arrow stamped on cast body */}
                            <path d="M 12 55 L 18 55 M 16 53 L 18 55 L 16 57" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />

                            {/* --- 1D. CIRCULAR PRESSURE GAUGE (MANÔMETRO ANALÓGICO COM MOSTRADOR BRANCO) --- */}
                            {/* Mounted front and center on the regulator, matching photo */}
                            <g id="frl-pressure-gauge">
                              {/* Gauge shadow */}
                              <circle cx={gaugeCx + 1} cy={gaugeCy + 1.5} r="25" fill="#000000" opacity="0.4" />
                              {/* Outer stepped black bezel */}
                              <circle cx={gaugeCx} cy={gaugeCy} r="24.5" fill="#0b1120" stroke="#475569" strokeWidth="1.8" />
                              <circle cx={gaugeCx} cy={gaugeCy} r="22" fill="#1e293b" stroke="#334155" strokeWidth="0.8" />
                              {/* White dial face */}
                              <circle cx={gaugeCx} cy={gaugeCy} r="19.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />

                              {/* Dial scale track arc */}
                              <circle cx={gaugeCx} cy={gaugeCy} r="17" fill="none" stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="60 30" transform={`rotate(135 ${gaugeCx} ${gaugeCy})`} />
                              
                              {/* Red safety warning zone arc (> 8 bar / 0.8 MPa) */}
                              <path
                                d={`M ${gaugeCx + 17 * Math.cos((81 - 90) * Math.PI / 180)} ${gaugeCy + 17 * Math.sin((81 - 90) * Math.PI / 180)} A 17 17 0 0 1 ${gaugeCx + 17 * Math.cos((135 - 90) * Math.PI / 180)} ${gaugeCy + 17 * Math.sin((135 - 90) * Math.PI / 180)}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                              />

                              {/* Inner secondary blue track */}
                              <circle cx={gaugeCx} cy={gaugeCy} r="13" fill="none" stroke="#0284c7" strokeWidth="0.5" strokeOpacity="0.7" />

                              {/* Radial Tick Marks and Numbers */}
                              {majorTicks.map((tick, i) => {
                                const rad = ((tick.deg - 90) * Math.PI) / 180;
                                const x1 = gaugeCx + 18.5 * Math.cos(rad);
                                const y1 = gaugeCy + 18.5 * Math.sin(rad);
                                const x2 = gaugeCx + 15.5 * Math.cos(rad);
                                const y2 = gaugeCy + 15.5 * Math.sin(rad);
                                const tx = gaugeCx + 12 * Math.cos(rad);
                                const ty = gaugeCy + 12 * Math.sin(rad);

                                return (
                                  <g key={`gtick-${i}`}>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth="1" />
                                    <text
                                      x={tx}
                                      y={ty + 1.8}
                                      fill="#0f172a"
                                      fontSize="3.8"
                                      fontWeight="bold"
                                      fontFamily="'JetBrains Mono'"
                                      textAnchor="middle"
                                    >
                                      {tick.val}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Minor ticks (every 1 bar / 0.1 MPa) */}
                              {[-108, -54, 0, 54, 108].map((deg, i) => {
                                const rad = ((deg - 90) * Math.PI) / 180;
                                const x1 = gaugeCx + 18.5 * Math.cos(rad);
                                const y1 = gaugeCy + 18.5 * Math.sin(rad);
                                const x2 = gaugeCx + 16.5 * Math.cos(rad);
                                const y2 = gaugeCy + 16.5 * Math.sin(rad);
                                return <line key={`minortick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="0.6" />;
                              })}

                              {/* Dial Brand & Units Label */}
                              <text x={gaugeCx} y={gaugeCy - 4} fill="#090d16" fontSize="4.2" fontWeight="900" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                MPa
                              </text>
                              <text x={gaugeCx} y={gaugeCy + 8.5} fill="#0284c7" fontSize="3.6" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                {pressure.toFixed(1)} bar
                              </text>

                              {/* Dynamic Gauge Indicator Needle */}
                              <line
                                x1={counterX}
                                y1={counterY}
                                x2={needleTipX}
                                y2={needleTipY}
                                stroke="#090d16"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                              {/* Needle counterweight teardrop */}
                              <circle cx={counterX} cy={counterY} r="1.8" fill="#090d16" />

                              {/* Center Pivot Boss */}
                              <circle cx={gaugeCx} cy={gaugeCy} r="3.2" fill="#0f172a" />
                              <circle cx={gaugeCx} cy={gaugeCy} r="1.2" fill="#e2e8f0" />

                              {/* Specular Glass Lens Reflection Dome */}
                              <ellipse cx={gaugeCx - 5} cy={gaugeCy - 6} rx="12" ry="7" fill="url(#frl-gauge-shine)" transform={`rotate(-25 ${gaugeCx - 5} ${gaugeCy - 6})`} pointerEvents="none" />
                            </g>

                            {/* --- 1E. FILTER BOWL (COPO TRANSPARENTE DE POLICARBONATO) --- */}
                            <g id="frl-filter-bowl">
                              {/* Black mounting collar ring */}
                              <rect x="20" y="94" width="48" height="6" rx="1.5" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                              {/* Transparent Polycarbonate Bowl */}
                              <rect
                                x="22"
                                y="99"
                                width="44"
                                height="65"
                                rx="7"
                                fill="url(#frl-polycarb-glass)"
                                stroke="#94a3b8"
                                strokeWidth="1.2"
                              />

                              {/* Molded vertical grip ribs on bowl */}
                              <line x1="25" y1="102" x2="25" y2="158" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                              <line x1="63" y1="102" x2="63" y2="158" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" />

                              {/* Centrifugal swirl vane / deflector disc */}
                              <rect x="27" y="100" width="34" height="3" rx="1" fill="#475569" />

                              {/* SINTERED BRONZE POROUS FILTER ELEMENT (Bronze sinterizado poroso 5µm) */}
                              {/* Characteristic golden/bronze porous cartridge shown in photo */}
                              <rect
                                x="28"
                                y="103"
                                width="32"
                                height="22"
                                rx="3"
                                fill="url(#frl-sintered-bronze)"
                                stroke="#b45309"
                                strokeWidth="0.8"
                              />
                              {/* Sintered bronze texture dots */}
                              <circle cx="33" cy="108" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="40" cy="107" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="47" cy="108" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="54" cy="107" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="36" cy="113" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="43" cy="114" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="50" cy="113" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="33" cy="119" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="41" cy="120" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="48" cy="119" r="0.8" fill="#78350f" opacity="0.6" />
                              <circle cx="55" cy="120" r="0.8" fill="#78350f" opacity="0.6" />
                              {/* Filter lower retention baffle */}
                              <rect x="29" y="125" width="30" height="2.5" rx="1" fill="#334155" />

                              {/* Technical Red Warning Label on Bowl (as in photo) */}
                              <g transform="translate(26, 129)">
                                <rect x="0" y="0" width="36" height="15" rx="1.5" fill="#090f1d" fillOpacity="0.75" stroke="#ef4444" strokeWidth="0.7" />
                                <text x="18" y="4.5" fill="#ef4444" fontSize="4.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  CAUTION
                                </text>
                                <text x="18" y="8.5" fill="#fca5a5" fontSize="3" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  MAX PRESS 1.0 MPa
                                </text>
                                <text x="18" y="12" fill="#fca5a5" fontSize="2.8" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  POLYCARBONATE BOWL
                                </text>
                              </g>

                              {/* Water Trap / Liquid Condensation at Bottom */}
                              <path
                                d="M 23 148 Q 44 146 65 148 L 65 158 Q 44 164 23 158 Z"
                                fill="url(#frl-water-grad)"
                                stroke="#38bdf8"
                                strokeWidth="0.8"
                              />
                              {/* Meniscus wave line */}
                              <path d="M 24 148 Q 44 146 64 148" fill="none" stroke="#bae6fd" strokeWidth="0.8" opacity="0.85" />
                              <text x="44" y="156" fill="#e0f2fe" fontSize="3.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                CONDENSADO
                              </text>
                            </g>

                            {/* --- 1F. MANUAL CONDENSATION DRAIN PETCOCK (DRENO MANUAL PURGADOR) --- */}
                            {/* Interactive purge valve: clicking purges condensation with realistic exhaust hiss! */}
                            <g
                              className="cursor-pointer group/drain"
                              onClick={(e) => handlePurgeFrl(comp.id, e)}
                            >
                              <title>Clique para purgar água condensada do filtro</title>
                              {/* Threaded collar */}
                              <rect x="40" y="164" width="8" height="4" fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" />
                              {/* Hexagonal brass drain body */}
                              <rect
                                x="38"
                                y="168"
                                width="12"
                                height="5"
                                rx="1"
                                fill="#cbd5e1"
                                stroke="#64748b"
                                strokeWidth="0.8"
                                className="transition-colors group-hover/drain:stroke-sky-400 group-hover/drain:fill-sky-100"
                              />
                              {/* Knurled drain nozzle / nipple */}
                              <rect x="41.5" y="173" width="5" height="13" fill="#94a3b8" stroke="#475569" strokeWidth="0.6" />
                              {/* Barbs for drain tube connection */}
                              <line x1="41" y1="176" x2="47" y2="176" stroke="#475569" strokeWidth="0.8" />
                              <line x1="41" y1="179" x2="47" y2="179" stroke="#475569" strokeWidth="0.8" />
                              <line x1="41" y1="182" x2="47" y2="182" stroke="#475569" strokeWidth="0.8" />

                              {/* Interactive purge mist puff animation when triggered */}
                              {isPurging && (
                                <g id="frl-purge-cloud">
                                  <ellipse cx="44" cy="192" rx="16" ry="6" fill="#38bdf8" opacity="0.6" />
                                  <ellipse cx="44" cy="196" rx="24" ry="8" fill="#bae6fd" opacity="0.4" />
                                  <text x="44" y="195" fill="#0284c7" fontSize="5.5" fontWeight="900" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                    💨 PURGA!
                                  </text>
                                </g>
                              )}
                            </g>
                          </g>

                          {/* ------------------------------------------------------------- */}
                          {/* 2. CENTER MODULAR JOINER CLAMP (BLOCO ESPAÇADOR DE UNIÃO) */}
                          {/* ------------------------------------------------------------- */}
                          <g id="frl-center-clamp">
                            <rect x="71" y="56" width="15" height="34" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                            {/* Upper Allen Screw */}
                            <circle cx="78.5" cy="64" r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" />
                            <polygon points="78.5,62.5 79.8,63.2 79.8,64.8 78.5,65.5 77.2,64.8 77.2,63.2" fill="#94a3b8" />
                            {/* Lower Allen Screw */}
                            <circle cx="78.5" cy="80" r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" />
                            <polygon points="78.5,78.5 79.8,79.2 79.8,80.8 78.5,81.5 77.2,80.8 77.2,79.2" fill="#94a3b8" />
                          </g>

                          {/* ------------------------------------------------------------- */}
                          {/* 3. RIGHT COLUMN: LUBRICATOR (LUBRIFICADOR DE AR PNEUMÁTICO) */}
                          {/* ------------------------------------------------------------- */}
                          <g id="frl-lubricator-column">
                            {/* --- 3A. DRIP SIGHT DOME (CÚPULA TRANSPARENTE VISOR DE ÓLEO) --- */}
                            <g id="frl-drip-dome">
                              {/* Needle adjustment micro-screw on top */}
                              <rect x="103" y="21" width="8" height="10" rx="1.5" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
                              <line x1="104.5" y1="23" x2="104.5" y2="29" stroke="#64748b" strokeWidth="0.8" />
                              <line x1="107" y1="23" x2="107" y2="29" stroke="#64748b" strokeWidth="0.8" />
                              <line x1="109.5" y1="23" x2="109.5" y2="29" stroke="#64748b" strokeWidth="0.8" />

                              {/* Transparent Acrylic Dome */}
                              <rect
                                x="100"
                                y="31"
                                width="14"
                                height="21"
                                rx="5"
                                fill="url(#frl-polycarb-glass)"
                                stroke="#94a3b8"
                                strokeWidth="1"
                              />
                              {/* Dome reflection highlight */}
                              <line x1="102" y1="34" x2="102" y2="49" stroke="#ffffff" strokeWidth="1" opacity="0.6" />

                              {/* Internal Brass Drip Nozzle */}
                              <rect x="105.5" y="32" width="3" height="9" fill="#d97706" stroke="#b45309" strokeWidth="0.5" />
                              {/* Falling golden oil droplet into air stream */}
                              <ellipse cx="107" cy="45" rx="1.3" ry="1.8" fill="#f59e0b" stroke="#d97706" strokeWidth="0.4" />

                              {/* Dome Base Mounting Ring */}
                              <rect x="97" y="52" width="20" height="4" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
                            </g>

                            {/* --- 3B. CAST ALUMINUM LUBRICATOR BODY (CORPO METÁLICO DO LUBRIFICADOR) --- */}
                            <rect
                              x="86"
                              y="56"
                              width="48"
                              height="38"
                              rx="3"
                              fill="url(#frl-metal-body)"
                              stroke="#334155"
                              strokeWidth="1.3"
                            />
                            {/* Lubricator identification badge */}
                            <text x="110" y="72" fill="#94a3b8" fontSize="5.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              LUBRIFICADOR
                            </text>
                            <text x="110" y="80" fill="#64748b" fontSize="4.5" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              ISO VG 32
                            </text>

                            {/* Right edge pneumatic outlet port boss (Bocal de Saída 1) */}
                            <rect x="130" y="66" width="11" height="16" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                            {/* Brass hexagonal nut */}
                            <rect x="132" y="68" width="5" height="12" rx="1" fill="#94a3b8" stroke="#64748b" strokeWidth="0.6" />
                            {/* Blue Festo push-in connector collar */}
                            <rect x="137" y="69.5" width="4" height="9" rx="1.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />
                            {/* Air flow indicator arrow */}
                            <path d="M 126 55 L 132 55 M 130 53 L 132 55 L 130 57" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />

                            {/* --- 3C. LUBRICATOR BOWL (COPO TRANSPARENTE DE ÓLEO PNEUMÁTICO) --- */}
                            <g id="frl-oil-bowl">
                              {/* Top threaded collar ring */}
                              <rect x="88" y="94" width="44" height="6" rx="1.5" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                              {/* Transparent Polycarbonate Bowl */}
                              <rect
                                x="90"
                                y="99"
                                width="40"
                                height="65"
                                rx="7"
                                fill="url(#frl-polycarb-glass)"
                                stroke="#94a3b8"
                                strokeWidth="1.2"
                              />
                              {/* Vertical reflections on bowl */}
                              <line x1="93" y1="102" x2="93" y2="158" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                              <line x1="127" y1="102" x2="127" y2="158" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" />

                              {/* Vertical Siphon Tube (Tubo Pescador de Óleo) */}
                              <rect x="108.5" y="100" width="3" height="52" rx="1" fill="#f1f5f9" fillOpacity="0.7" stroke="#94a3b8" strokeWidth="0.6" />
                              {/* Bottom suction strainer screen */}
                              <rect x="107" y="150" width="6" height="4" rx="1" fill="#d97706" stroke="#b45309" strokeWidth="0.5" />

                              {/* Pneumatic Lubricant Oil Reservoir Level */}
                              <path
                                d="M 91 124 Q 110 122 129 124 L 129 158 Q 110 164 91 158 Z"
                                fill="url(#frl-oil-grad)"
                                stroke="#d97706"
                                strokeWidth="0.8"
                              />
                              {/* Oil meniscus curve */}
                              <path d="M 92 124 Q 110 122 128 124" fill="none" stroke="#fef08a" strokeWidth="0.8" opacity="0.9" />
                              <text x="110" y="142" fill="#78350f" fontSize="4.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                ÓLEO ISO VG32
                              </text>

                              {/* Technical Red Warning Label on Bowl */}
                              <g transform="translate(92, 104)">
                                <rect x="0" y="0" width="36" height="15" rx="1.5" fill="#090f1d" fillOpacity="0.75" stroke="#ef4444" strokeWidth="0.7" />
                                <text x="18" y="4.5" fill="#ef4444" fontSize="4.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  CAUTION
                                </text>
                                <text x="18" y="8.5" fill="#fca5a5" fontSize="2.8" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  TURBINE OIL ISO VG32
                                </text>
                                <text x="18" y="12" fill="#fca5a5" fontSize="2.8" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  DO NOT USE SOLVENTS
                                </text>
                              </g>
                            </g>

                            {/* --- 3D. BOTTOM OIL DRAIN / FILL PLUG --- */}
                            <rect x="105" y="164" width="10" height="7" rx="1.5" fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
                          </g>
                        </g>
                      );
                    })()}

                    {/* 3b. AIR MANIFOLD (BLOCO DISTRIBUIDOR 8 SAÍDAS FESTO) */}
                    {comp.type === 'air_manifold' && (
                      <g transform="translate(10, 26)">
                        {/* Blue anodized Festo aluminum manifold body */}
                        <rect x="2" y="4" width="146" height="52" rx="6" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
                        <rect x="6" y="8" width="138" height="44" rx="4" fill="#075985" />
                        {/* Internal pressurized air chamber line */}
                        <line x1="18" y1="30" x2="136" y2="30" stroke="#38bdf8" strokeWidth="3" opacity="0.8" />
                        <line x1="18" y1="30" x2="136" y2="30" stroke="#bae6fd" strokeWidth="1.2" />
                        {/* Festo Manifold identification */}
                        <text x="75" y="24" fill="#bae6fd" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
                          DISTRIBUIDOR 8x
                        </text>
                        <text x="75" y="40" fill="#e0f2fe" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                          6.0 BAR MAX
                        </text>
                      </g>
                    )}

                    {/* 3c. FLOW CONTROL THROTTLE (VÁLVULA REGULADORA DE FLUXO) */}
                    {comp.type === 'flow_control_throttle' && (
                      <g transform="translate(10, 24)">
                        {/* Valve metal body */}
                        <rect x="12" y="8" width="86" height="46" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        {/* Micrometric rotary adjustment knob on top */}
                        <rect x="44" y="0" width="22" height="10" rx="2" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                        <line x1="48" y1="2" x2="48" y2="8" stroke="#78350f" strokeWidth="1" />
                        <line x1="55" y1="2" x2="55" y2="8" stroke="#78350f" strokeWidth="1" />
                        <line x1="62" y1="2" x2="62" y2="8" stroke="#78350f" strokeWidth="1" />
                        {/* Throttle symbol */}
                        <path d="M 28 32 L 82 32" stroke="#38bdf8" strokeWidth="2" />
                        <polygon points="50,24 60,32 50,40" fill="#38bdf8" />
                        {/* Percent value */}
                        <text x="55" y="48" fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                          {comp.state.flowThrottlePercent || 40}%
                        </text>
                      </g>
                    )}

                    {/* 4. 5/2 WAY DIRECTIONAL ELECTROVALVE (INDUSTRIAL 4V220 / 4V210 WITH TRANSPARENT GLASS CUTAWAY) */}
                    {(comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') && (
                      <ElectrovalveRenderer
                        comp={comp}
                        onTriggerManualOverride={onTriggerManualOverride}
                        isSimulating={isSimulating}
                      />
                    )}

                    {/* 4b. 3/2 WAY PUSH BUTTON VALVE WITH TRANSPARENT GLASS CUTAWAY BODY */}
                    {comp.type === 'valve_3_2_button' && (() => {
                      const isPressed = comp.state.activated || comp.state.valvePosition === 'left';
                      return (
                        <g transform="translate(10, 20)">
                          {/* Machined aluminum block */}
                          <rect x="15" y="24" width="90" height="74" rx="4" fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
                          {/* Push button actuator on top */}
                          <g
                            transform={`translate(45, ${isPressed ? 10 : 2})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTriggerManualOverride(comp.id);
                            }}
                            className="cursor-pointer hover:brightness-110 transition-transform"
                          >
                            <rect x="0" y="0" width="30" height="24" rx="5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" />
                            <rect x="4" y="3" width="22" height="6" rx="2" fill="#fca5a5" opacity="0.6" />
                            <text x="15" y="16" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                              PULL/PUSH
                            </text>
                          </g>

                          {/* Transparent Glass Cutaway Chamber */}
                          <rect x="22" y="38" width="76" height="52" rx="3" fill="#020617" stroke="#38bdf8" strokeWidth="1.2" />
                          <rect x="24" y="44" width="72" height="38" rx="2" fill="#090d16" />

                          {/* Dynamic flow: Pressed (1->2), Not pressed (2->3 exhaust) */}
                          {isPressed ? (
                            <path d="M 38 82 L 38 60 Q 38 52 50 52 L 60 52 L 60 38" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                          ) : (
                            <path d="M 60 38 L 60 56 Q 60 66 72 66 L 82 66 L 82 82" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                          )}

                          {/* Moving Spool / Poppet */}
                          <g transform={`translate(0, ${isPressed ? 10 : 0})`} className="transition-transform duration-200">
                            <rect x="48" y="42" width="24" height="8" rx="2" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
                            <rect x="56" y="50" width="8" height="18" fill="#94a3b8" />
                            <rect x="48" y="68" width="24" height="8" rx="2" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
                          </g>

                          {/* Return spring */}
                          <path
                            d={isPressed ? "M 54 82 L 57 78 L 61 82 L 65 78 L 68 82" : "M 52 82 L 56 74 L 60 82 L 64 74 L 68 82"}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="1.5"
                          />

                          {/* Glass shine overlay */}
                          <rect x="22" y="38" width="76" height="52" rx="3" fill="rgba(56, 189, 248, 0.15)" pointerEvents="none" />
                          <text x="60" y="34" fill="#38bdf8" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                            3/2 NF VIDRO
                          </text>
                        </g>
                      );
                    })()}

                    {/* 5. PUSH BUTTON STATION (BOTOEIRA INDUSTRIAL FESTO DE COMANDO) */}
                    {comp.type === 'push_button_station' && (
                      <g>
                        {/* ---------------------------------------------------- */}
                        {/* ZONA SUPERIOR: DECK DE ACIONAMENTO ERGONÔMICO        */}
                        {/* Área 100% desobstruída e livre de conexões           */}
                        {/* ---------------------------------------------------- */}
                        <rect
                          x="8"
                          y="32"
                          width="144"
                          height="74"
                          rx="6"
                          fill="#090f1d"
                          stroke="#1e293b"
                          strokeWidth="1.2"
                        />
                        {/* Divisória sutil entre os dois botões no deck */}
                        <line x1="80" y1="36" x2="80" y2="102" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

                        {/* Etiqueta de Função Superior S1 */}
                        <text
                          x="43"
                          y="43"
                          fill="#34d399"
                          fontSize="7"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          S1 (LIGA / PARTIDA)
                        </text>

                        {/* Etiqueta de Função Superior S0 */}
                        <text
                          x="117"
                          y="43"
                          fill="#f87171"
                          fontSize="7"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          S0 (DESLIGA / PARADA)
                        </text>

                        {/* ==================================================== */}
                        {/* BOTÃO PULSADOR VERDE S1 (NA 13-14)                   */}
                        {/* ==================================================== */}
                        <g
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NA');
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NA');
                          }}
                          onMouseLeave={() => {
                            if (comp.state.buttonNApressed) {
                              onReleaseButton(comp.id, 'NA');
                            }
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NA');
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NA');
                          }}
                          className="cursor-pointer group/btn-na"
                        >
                          {/* Colar Metálico de Fixação Externa */}
                          <circle
                            cx="43"
                            cy="70"
                            r="21"
                            fill="#1e293b"
                            stroke="#475569"
                            strokeWidth="1.5"
                          />
                          {/* Anel Chanfrado Interno */}
                          <circle
                            cx="43"
                            cy="70"
                            r="18"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          {/* Halo luminoso quando acionado */}
                          {comp.state.buttonNApressed && (
                            <circle
                              cx="43"
                              cy="70"
                              r="24"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              opacity="0.8"
                              className="animate-pulse"
                            />
                          )}
                          {/* Atuador Cilíndrico / Cúpula Emborrachada Verde */}
                          <circle
                            cx="43"
                            cy="70"
                            r={comp.state.buttonNApressed ? 14 : 15.5}
                            fill={comp.state.buttonNApressed ? '#34d399' : '#059669'}
                            stroke={comp.state.buttonNApressed ? '#6ee7b7' : '#10b981'}
                            strokeWidth={comp.state.buttonNApressed ? 2.5 : 2}
                            className="transition-all"
                          />
                          {/* Brilho Especular Superior do Botão */}
                          <ellipse
                            cx="40"
                            cy={comp.state.buttonNApressed ? 68 : 66}
                            rx="7"
                            ry="3.5"
                            fill="#ffffff"
                            opacity={comp.state.buttonNApressed ? 0.6 : 0.35}
                            pointerEvents="none"
                          />
                          {/* Símbolo Industrial IEC "I" (Liga) */}
                          <text
                            x="43"
                            y={comp.state.buttonNApressed ? 73.5 : 73}
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            pointerEvents="none"
                          >
                            I
                          </text>
                          {/* Legenda de Status Inferior S1 */}
                          <text
                            x="43"
                            y="99"
                            fill={comp.state.buttonNApressed ? '#34d399' : '#64748b'}
                            fontSize="6"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            pointerEvents="none"
                          >
                            {comp.state.buttonNApressed ? 'ACIONADO (NA)' : 'PULSO NA'}
                          </text>
                        </g>

                        {/* ==================================================== */}
                        {/* BOTÃO PULSADOR VERMELHO S0 (NF 11-12)                */}
                        {/* ==================================================== */}
                        <g
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NF');
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NF');
                          }}
                          onMouseLeave={() => {
                            if (comp.state.buttonNFpressed) {
                              onReleaseButton(comp.id, 'NF');
                            }
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NF');
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NF');
                          }}
                          className="cursor-pointer group/btn-nf"
                        >
                          {/* Colar Metálico de Fixação Externa */}
                          <circle
                            cx="117"
                            cy="70"
                            r="21"
                            fill="#1e293b"
                            stroke="#475569"
                            strokeWidth="1.5"
                          />
                          {/* Anel Chanfrado Interno */}
                          <circle
                            cx="117"
                            cy="70"
                            r="18"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          {/* Halo luminoso quando acionado */}
                          {comp.state.buttonNFpressed && (
                            <circle
                              cx="117"
                              cy="70"
                              r="24"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2"
                              opacity="0.8"
                              className="animate-pulse"
                            />
                          )}
                          {/* Atuador Cilíndrico / Cúpula Emborrachada Vermelha */}
                          <circle
                            cx="117"
                            cy="70"
                            r={comp.state.buttonNFpressed ? 14 : 15.5}
                            fill={comp.state.buttonNFpressed ? '#ef4444' : '#b91c1c'}
                            stroke={comp.state.buttonNFpressed ? '#fca5a5' : '#ef4444'}
                            strokeWidth={comp.state.buttonNFpressed ? 2.5 : 2}
                            className="transition-all"
                          />
                          {/* Brilho Especular Superior do Botão */}
                          <ellipse
                            cx="114"
                            cy={comp.state.buttonNFpressed ? 68 : 66}
                            rx="7"
                            ry="3.5"
                            fill="#ffffff"
                            opacity={comp.state.buttonNFpressed ? 0.6 : 0.35}
                            pointerEvents="none"
                          />
                          {/* Símbolo Industrial IEC "O" (Desliga) */}
                          <text
                            x="117"
                            y={comp.state.buttonNFpressed ? 73.5 : 73}
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            pointerEvents="none"
                          >
                            O
                          </text>
                          {/* Legenda de Status Inferior S0 */}
                          <text
                            x="117"
                            y="99"
                            fill={comp.state.buttonNFpressed ? '#f87171' : '#64748b'}
                            fontSize="6"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            pointerEvents="none"
                          >
                            {comp.state.buttonNFpressed ? 'ACIONADO (NF)' : 'PULSO NF'}
                          </text>
                        </g>

                        {/* ---------------------------------------------------- */}
                        {/* ZONA INFERIOR: RÉGUA DE BORNES 4mm E ESQUEMA IEC     */}
                        {/* Painel isolado com bornes 13-14 (NA) e 11-12 (NF)    */}
                        {/* ---------------------------------------------------- */}
                        <rect
                          x="8"
                          y="112"
                          width="144"
                          height="62"
                          rx="4"
                          fill="#030712"
                          stroke="#334155"
                          strokeWidth="1"
                        />
                        {/* Linha separadora central entre bancos NA e NF */}
                        <line x1="80" y1="114" x2="80" y2="172" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />

                        {/* --- BANCO ESQUERDO: CONTATO NA (13-14) --- */}
                        <text
                          x="43"
                          y="122"
                          fill="#10b981"
                          fontSize="6.5"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          NA (13-14)
                        </text>

                        {/* Diagrama Esquemático IEC do Contato NA */}
                        <g>
                          {/* Linha terminal 13 */}
                          <line x1="26" y1="133" x2="35" y2="133" stroke="#64748b" strokeWidth="1.5" />
                          <circle cx="35" cy="133" r="2" fill="#38bdf8" />
                          {/* Linha terminal 14 */}
                          <line x1="51" y1="133" x2="61" y2="133" stroke="#64748b" strokeWidth="1.5" />
                          <circle cx="51" cy="133" r="2" fill={comp.state.buttonNApressed ? '#10b981' : '#64748b'} />
                          {/* Lâmina móvel do contato */}
                          {comp.state.buttonNApressed ? (
                            <line x1="35" y1="133" x2="51" y2="133" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                          ) : (
                            <line x1="35" y1="133" x2="49" y2="127" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          )}
                          {/* Acoplamento mecânico tracejado ao botão */}
                          <line x1="43" y1="125" x2="43" y2="130" stroke="#10b981" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                          {/* Números 13 e 14 */}
                          <text x="21" y="135" fill="#94a3b8" fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">13</text>
                          <text x="65" y="135" fill="#94a3b8" fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">14</text>
                        </g>

                        {/* --- BANCO DIREITO: CONTATO NF (11-12) --- */}
                        <text
                          x="117"
                          y="122"
                          fill="#ef4444"
                          fontSize="6.5"
                          fontWeight="bold"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                        >
                          NF (11-12)
                        </text>

                        {/* Diagrama Esquemático IEC do Contato NF */}
                        <g>
                          {/* Linha terminal 11 */}
                          <line x1="100" y1="133" x2="109" y2="133" stroke="#64748b" strokeWidth="1.5" />
                          <circle cx="109" cy="133" r="2" fill="#38bdf8" />
                          {/* Linha terminal 12 */}
                          <line x1="125" y1="133" x2="134" y2="133" stroke="#64748b" strokeWidth="1.5" />
                          <circle cx="125" cy="133" r="2" fill={!comp.state.buttonNFpressed ? '#ef4444' : '#64748b'} />
                          {/* Lâmina móvel do contato */}
                          {!comp.state.buttonNFpressed ? (
                            <line x1="109" y1="133" x2="125" y2="133" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                          ) : (
                            <line x1="109" y1="133" x2="123" y2="127" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          )}
                          {/* Acoplamento mecânico tracejado ao botão */}
                          <line x1="117" y1="125" x2="117" y2="130" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                          {/* Números 11 e 12 */}
                          <text x="95" y="135" fill="#94a3b8" fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">11</text>
                          <text x="138" y="135" fill="#94a3b8" fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">12</text>
                        </g>
                      </g>
                    )}

                    {/* 6. EMERGENCY STOP (NR-12) */}
                    {comp.type === 'emergency_stop_button' && (
                      <g
                        transform="translate(25, 36)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTriggerManualOverride(comp.id);
                        }}
                        className="cursor-pointer hover:scale-105 transition"
                      >
                        {/* Yellow Safety Ring */}
                        <circle cx="45" cy="40" r="32" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
                        <text x="45" y="18" fill="#713f12" fontSize="6" fontWeight="bold" textAnchor="middle">EMERGENCY STOP</text>
                        {/* Mushroom Head */}
                        <circle cx="45" cy="42" r="22" fill={comp.state.isEmergencyTriggered ? '#b91c1c' : '#ef4444'} stroke="#7f1d1d" strokeWidth="2" />
                        <path d="M 38 42 L 52 42 M 45 35 L 45 49" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                      </g>
                    )}

                    {/* 7. SENSOR INDUSTRIAL DE PROXIMIDADE (TUBULAR M18 TRADICIONAL CONFORME FOTO) */}
                    {comp.type === 'reed_switch_sensor' && (() => {
                      const tech: SensorTechnology = comp.state.sensorTech || 'magnetic';
                      const wires: SensorWireCount = comp.state.sensorWires || '3_wires';
                      const isPowerOk = comp.state.isPowerCorrect || false;
                      const isActuated = comp.state.sensorDetected && isPowerOk;
                      const isSnapped = comp.state.snappedToRail;

                      // Cores exigidas pelo usuário:
                      // Magnético: vermelho
                      // Indutivo: azul clara (igual à foto do sensor tradicional)
                      // Capacitivo: cinza
                      // Óptico: verde
                      const techConfig = {
                        magnetic: {
                          name: 'Magnético',
                          faceColor: '#ef4444',
                          faceStroke: '#dc2626',
                          glowColor: 'rgba(239, 68, 68, 0.45)',
                          accent: '#f87171'
                        },
                        inductive: {
                          name: 'Indutivo',
                          faceColor: '#38bdf8', // Azul clara conforme foto
                          faceStroke: '#0284c7',
                          glowColor: 'rgba(56, 189, 248, 0.45)',
                          accent: '#38bdf8'
                        },
                        capacitive: {
                          name: 'Capacitivo',
                          faceColor: '#94a3b8', // Cinza
                          faceStroke: '#64748b',
                          glowColor: 'rgba(148, 163, 184, 0.45)',
                          accent: '#cbd5e1'
                        },
                        optical: {
                          name: 'Óptico',
                          faceColor: '#22c55e', // Verde
                          faceStroke: '#16a34a',
                          glowColor: 'rgba(34, 197, 94, 0.45)',
                          accent: '#4ade80'
                        }
                      }[tech];

                      return (
                        <g>
                          {/* SENSOR INDUSTRIAL DE PROXIMIDADE (TUBULAR M18) A 90° EM RELAÇÃO AO CILINDRO */}

                          {/* 1. Tampa Sensora Retangular / Face Ativa no Topo (A 90° em relação ao cilindro) */}
                          <g id="sensor-sensing-face-90deg">
                            {/* Tampa Plástica Frontal Retangular */}
                            <rect
                              x="41"
                              y="6"
                              width="28"
                              height="18"
                              rx="2"
                              fill={techConfig.faceColor}
                              stroke={techConfig.faceStroke}
                              strokeWidth="1.2"
                            />

                            {/* Superfície Sensora Ativa Retangular / Inserto Frontal */}
                            <rect
                              x="44"
                              y="9"
                              width="22"
                              height="12"
                              rx="1.5"
                              fill={isActuated ? '#ffffff' : techConfig.faceColor}
                              stroke={isActuated ? techConfig.faceStroke : 'rgba(255, 255, 255, 0.4)'}
                              strokeWidth="0.8"
                              opacity={isActuated ? 0.95 : 0.85}
                            />

                            {/* Linha de encaixe / chanfro da tampa retangular com o corpo roscado */}
                            <line
                              x1="41"
                              y1="21"
                              x2="69"
                              y2="21"
                              stroke={techConfig.faceStroke}
                              strokeWidth="0.8"
                              opacity="0.7"
                            />

                            {/* Marcação Exata do CENTRO DA TAMPA DO SENSOR (55, 15) */}
                            <g transform="translate(55, 15)">
                              {/* Alvo e retículo no centro da tampa retangular */}
                              <rect
                                x="-5"
                                y="-5"
                                width="10"
                                height="10"
                                rx="1.5"
                                fill="none"
                                stroke={isActuated ? "#34d399" : "#ffffff"}
                                strokeWidth="1"
                                strokeDasharray={isActuated ? undefined : "2 2"}
                                opacity="0.9"
                              />
                              <line x1="-7" y1="0" x2="7" y2="0" stroke={isActuated ? "#fbbf24" : "#ffffff"} strokeWidth="0.8" />
                              <line x1="0" y1="-7" x2="0" y2="7" stroke={isActuated ? "#fbbf24" : "#ffffff"} strokeWidth="0.8" />
                              <circle cx="0" cy="0" r="1.8" fill={isActuated ? "#fbbf24" : "#ffffff"} />

                              {/* Indução por Proximidade e feixe vertical para cima em direção ao centro da esfera */}
                              {isActuated && (
                                <g>
                                  <circle cx="0" cy="0" r="14" fill="none" stroke={techConfig.faceColor} strokeWidth="1.5" className="animate-ping" opacity="0.85" />
                                  <circle cx="0" cy="0" r="20" fill={techConfig.glowColor} />
                                  {/* Feixe vertical de detecção sem contato subindo a 90° até o centro da esfera */}
                                  <line x1="0" y1="-3" x2="0" y2="-43" stroke="#34d399" strokeWidth="2.5" strokeDasharray="3 2" />
                                  <circle cx="0" cy="-43" r="3.5" fill="#34d399" />
                                </g>
                              )}
                            </g>

                            {/* Indicador de Alinhamento pelo Centro da Tampa Retangular */}
                            <text
                              x="55"
                              y="3"
                              fill={isActuated ? "#34d399" : techConfig.accent}
                              fontSize="5.8"
                              fontWeight="900"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {isActuated ? "⌖ TAMPA RETANGULAR: ALINHADA" : "TAMPA RETANGULAR"}
                            </text>
                          </g>

                          {/* 2. Suporte Metálico de Fixação no Trilho Guia do Cilindro */}
                          <g id="sensor-rail-bracket" transform="translate(18, 32)">
                            {/* Chapa base do suporte acoplado ao trilho ranhurado */}
                            <rect
                              x="0"
                              y="0"
                              width="74"
                              height="20"
                              rx="2.5"
                              fill="#1e293b"
                              stroke={isSnapped ? "#38bdf8" : "#475569"}
                              strokeWidth={isSnapped ? "1.5" : "1"}
                            />
                            {/* Encaixe guia magnético central que trava no perfil do trilho */}
                            <rect
                              x="4"
                              y="3"
                              width="66"
                              height="14"
                              rx="1.5"
                              fill="#090f1d"
                              stroke={isSnapped ? "#38bdf8" : "#334155"}
                              strokeWidth="0.8"
                            />
                            {/* Parafusos de retenção e fixação */}
                            <circle cx="8" cy="10" r="2.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />
                            <circle cx="66" cy="10" r="2.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />

                            {/* Status de Fixação Magnética ao Trilho */}
                            <text
                              x="37"
                              y="12.5"
                              fill={isSnapped ? "#38bdf8" : "#64748b"}
                              fontSize="5.2"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {isSnapped ? "🧲 FIXADO NO TRILHO ◄►" : "GUIA DO TRILHO"}
                            </text>
                          </g>

                          {/* 3. Corpo Cilíndrico Metálico Roscado Vertical (M18 Barrel) */}
                          <g id="sensor-threaded-barrel-vertical">
                            {/* Base metálica vertical roscada M18 */}
                            <rect
                              x="43"
                              y="24"
                              width="24"
                              height="65"
                              rx="2"
                              fill="#64748b"
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            {/* Linhas de rosca fina milimétrica horizontais (M18x1) */}
                            {[26, 29, 58, 61, 64, 67, 70, 73, 76, 79, 82, 85].map(ry => (
                              <line
                                key={ry}
                                x1="43.5"
                                y1={ry}
                                x2="66.5"
                                y2={ry}
                                stroke="#94a3b8"
                                strokeWidth="0.9"
                                opacity="0.8"
                              />
                            ))}

                            {/* Porca Sextavada Superior (Hex Lock Nut 1) */}
                            <rect
                              x="35"
                              y="34"
                              width="40"
                              height="10"
                              rx="1.5"
                              fill="#94a3b8"
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            <line x1="35" y1="39" x2="75" y2="39" stroke="#cbd5e1" strokeWidth="0.8" />

                            {/* Arruela de pressão metálica (Washer) */}
                            <rect
                              x="34"
                              y="44"
                              width="42"
                              height="3"
                              rx="0.8"
                              fill="#64748b"
                              stroke="#334155"
                              strokeWidth="0.7"
                            />

                            {/* Porca Sextavada Inferior (Hex Lock Nut 2) */}
                            <rect
                              x="35"
                              y="47"
                              width="40"
                              height="10"
                              rx="1.5"
                              fill="#94a3b8"
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            <line x1="35" y1="52" x2="75" y2="52" stroke="#cbd5e1" strokeWidth="0.8" />

                            {/* Etiqueta Técnica Gravada no Corpo do Sensor */}
                            {/* Requisito: Escrito Indutivo, Capacitivo, Magnético e Óptico em seu corpo */}
                            {/* e sua identificação deverá continuar sendo exemplo 1S1, 1S2... */}
                            <rect
                              x="37"
                              y="60"
                              width="36"
                              height="19"
                              rx="2"
                              fill="#f8fafc"
                              stroke="#94a3b8"
                              strokeWidth="0.8"
                            />
                            {/* Identificação (ex: 1S1, 1S2) */}
                            <text
                              x="55"
                              y="68"
                              fill="#0f172a"
                              fontSize="7.5"
                              fontWeight="900"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {comp.tag}
                            </text>
                            {/* Tipo por extenso gravado no corpo */}
                            <text
                              x="55"
                              y="75.5"
                              fill={techConfig.faceStroke}
                              fontSize="5.8"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {techConfig.name}
                            </text>

                            {/* LEDs Indicadores Industriais */}
                            {/* LED Amarelo Âmbar de Atuação / Comutação */}
                            <circle
                              cx="48"
                              cy="83"
                              r="2.8"
                              fill={isActuated ? '#f59e0b' : '#334155'}
                              stroke={isActuated ? '#fbbf24' : '#1e293b'}
                              strokeWidth="0.8"
                            />
                            {isActuated && (
                              <circle cx="48" cy="83" r="5.5" fill="#f59e0b" opacity="0.6" className="animate-pulse" />
                            )}

                            {/* LED Verde de Alimentação (PWR OK) */}
                            <circle
                              cx="62"
                              cy="83"
                              r="2.4"
                              fill={isPowerOk ? '#10b981' : '#ef4444'}
                            />
                            <text
                              x="55"
                              y="88.5"
                              fill={isPowerOk ? '#34d399' : '#f87171'}
                              fontSize="4.8"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {isPowerOk ? 'PWR OK' : '!PWR'}
                            </text>

                            {/* Prensa-cabo / Strain relief azul industrial na parte inferior */}
                            <rect
                              x="49"
                              y="89"
                              width="12"
                              height="9"
                              rx="1.5"
                              fill="#0284c7"
                              stroke="#0369a1"
                              strokeWidth="1"
                            />
                          </g>

                          {/* 4. Cabo Preto Flexível saindo para baixo */}
                          <g id="sensor-cable-grommet-vertical">
                            <path
                              d="M 55 98 L 55 118"
                              fill="none"
                              stroke="#0f172a"
                              strokeWidth="7"
                              strokeLinecap="round"
                            />
                            <path
                              d="M 55 98 L 55 118"
                              fill="none"
                              stroke="#334155"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                            {/* Luva termorretrátil de terminação do chicote */}
                            <rect x="50" y="114" width="10" height="5" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="0.7" />
                          </g>

                          {/* 5. Chicote de Fios Individuais com Bornes Circulares Identificados */}
                          <g id="sensor-wire-leads-vertical">
                            {wires === '3_wires' && (
                              <g>
                                {/* Fio Marrom (BN: +24V) - Esquerda */}
                                <path
                                  d="M 55 118 C 55 132, 20 132, 20 146"
                                  fill="none"
                                  stroke="#92400e"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 55 118 C 55 132, 20 132, 20 146"
                                  fill="none"
                                  stroke="#b45309"
                                  strokeWidth="0.9"
                                  strokeLinecap="round"
                                />
                                <circle cx="20" cy="146" r="8" fill="#451a03" stroke="#92400e" strokeWidth="1.8" />
                                <circle cx="20" cy="146" r="4" fill="#78350f" />
                                <text x="20" y="136" fill="#fbbf24" fontSize="5.8" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  BN (+24V)
                                </text>

                                {/* Fio Preto (BK: Sinal NA) - Centro */}
                                <path
                                  d="M 55 118 L 55 146"
                                  fill="none"
                                  stroke="#0f172a"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 55 118 L 55 146"
                                  fill="none"
                                  stroke="#475569"
                                  strokeWidth="1"
                                  strokeLinecap="round"
                                />
                                <circle cx="55" cy="146" r="8" fill="#020617" stroke="#475569" strokeWidth="1.8" />
                                <circle cx="55" cy="146" r="4" fill="#1e293b" />
                                <text x="55" y="136" fill="#e2e8f0" fontSize="5.8" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  BK (Sinal)
                                </text>

                                {/* Fio Azul (BU: 0V) - Direita */}
                                <path
                                  d="M 55 118 C 55 132, 90 132, 90 146"
                                  fill="none"
                                  stroke="#1d4ed8"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 55 118 C 55 132, 90 132, 90 146"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="0.9"
                                  strokeLinecap="round"
                                />
                                <circle cx="90" cy="146" r="8" fill="#172554" stroke="#2563eb" strokeWidth="1.8" />
                                <circle cx="90" cy="146" r="4" fill="#1e40af" />
                                <text x="90" y="136" fill="#93c5fd" fontSize="5.8" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                                  BU (0V)
                                </text>
                              </g>
                            )}

                            {wires === '4_wires' && (
                              <g>
                                {/* Fio Marrom (BN) */}
                                <path d="M 55 118 C 55 132, 16 132, 16 146" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="16" cy="146" r="7.5" fill="#451a03" stroke="#92400e" strokeWidth="1.6" />
                                <text x="16" y="136" fill="#fbbf24" fontSize="5.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BN (+24V)</text>

                                {/* Fio Branco (WH - Sinal NF) */}
                                <path d="M 55 118 C 55 132, 42 132, 42 146" fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="42" cy="146" r="7.5" fill="#334155" stroke="#f8fafc" strokeWidth="1.6" />
                                <text x="42" y="136" fill="#ffffff" fontSize="5.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">WH (NF)</text>

                                {/* Fio Preto (BK - Sinal NA) */}
                                <path d="M 55 118 C 55 132, 68 132, 68 146" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="68" cy="146" r="7.5" fill="#020617" stroke="#475569" strokeWidth="1.6" />
                                <text x="68" y="136" fill="#e2e8f0" fontSize="5.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BK (NA)</text>

                                {/* Fio Azul (BU - 0V) */}
                                <path d="M 55 118 C 55 132, 94 132, 94 146" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
                                <circle cx="94" cy="146" r="7.5" fill="#172554" stroke="#2563eb" strokeWidth="1.6" />
                                <text x="94" y="136" fill="#93c5fd" fontSize="5.2" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BU (0V)</text>
                              </g>
                            )}

                            {wires === '2_wires' && (
                              <g>
                                {/* Fio Marrom (BN - L+) */}
                                <path d="M 55 118 C 55 132, 35 132, 35 146" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="35" cy="146" r="8" fill="#451a03" stroke="#92400e" strokeWidth="1.8" />
                                <text x="35" y="136" fill="#fbbf24" fontSize="5.8" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BN (+24V)</text>

                                {/* Fio Azul (BU - Sinal/Carga) */}
                                <path d="M 55 118 C 55 132, 75 132, 75 146" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="75" cy="146" r="8" fill="#172554" stroke="#2563eb" strokeWidth="1.8" />
                                <text x="75" y="136" fill="#93c5fd" fontSize="5.8" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">BU (Sinal/0V)</text>
                              </g>
                            )}
                          </g>

                          {/* Aviso se desconectado da alimentação */}
                          {!isPowerOk && (
                            <g transform="translate(15, 99)">
                              <rect x="0" y="0" width="80" height="11" rx="2" fill="#7f1d1d" opacity="0.92" />
                              <text x="40" y="8" fill="#fecaca" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                                ⚠️ SEM ALIMENTAÇÃO
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })()}

                    {/* 8. POWER SUPPLY 24V (FONTE COM CHAVE LIGA/DESLIGA, 5x 24V E 5x 0V) */}
                    {comp.type === 'power_supply_24v' && (() => {
                      const isPowered = comp.state.activated !== false;
                      return (
                        <g transform="translate(8, 30)">
                          {/* Brushed metal interior chassis plate */}
                          <rect x="0" y="0" width="194" height="144" rx="6" fill="#090d16" stroke="#334155" strokeWidth="1" />

                          {/* Section 1: Digital Voltmeter + Interactive Rocker Switch (Liga / Desliga) */}
                          {/* Voltmeter Display */}
                          <rect x="6" y="4" width="92" height="38" rx="4" fill="#020617" stroke="#1e293b" strokeWidth="1.5" />
                          <text
                            x="52"
                            y="23"
                            fill={isPowered ? "#38bdf8" : "#475569"}
                            fontSize="15"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            letterSpacing="0.5"
                          >
                            {isPowered ? "24.0 V" : "0.0 V"}
                          </text>
                          <rect x="14" y="27" width="76" height="11" rx="2" fill={isPowered ? "#0369a1" : "#1e293b"} />
                          <text
                            x="52"
                            y="35"
                            fill={isPowered ? "#ffffff" : "#64748b"}
                            fontSize="7"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                          >
                            {isPowered ? "ESTABILIZADA" : "DESLIGADA"}
                          </text>

                          {/* Botão Liga / Desliga (Interactive Rocker Switch) */}
                          <g
                            onClick={(e) => handleTogglePowerSupply(comp.id, e)}
                            className="cursor-pointer group/switch"
                          >
                            <rect
                              x="104"
                              y="4"
                              width="84"
                              height="38"
                              rx="5"
                              fill="#0b1120"
                              stroke={isPowered ? "#10b981" : "#ef4444"}
                              strokeWidth="1.5"
                              className="transition-colors group-hover/switch:stroke-sky-400"
                            />
                            {/* Rocker frame */}
                            <rect x="108" y="7" width="76" height="20" rx="3" fill="#1e293b" />
                            
                            {isPowered ? (
                              <g>
                                {/* Active I (Liga) */}
                                <rect x="110" y="8" width="36" height="18" rx="2" fill="#10b981" />
                                <text x="128" y="21" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">I</text>
                                <text x="166" y="21" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">O</text>
                                {/* Status LED */}
                                <circle cx="118" cy="33" r="3" fill="#10b981" />
                                <circle cx="118" cy="33" r="5" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.6" className="animate-pulse" />
                                <text x="126" y="36" fill="#34d399" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">LIGADA</text>
                              </g>
                            ) : (
                              <g>
                                {/* Active O (Desliga) */}
                                <rect x="146" y="8" width="36" height="18" rx="2" fill="#ef4444" />
                                <text x="128" y="21" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">I</text>
                                <text x="164" y="21" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">O</text>
                                {/* Status LED */}
                                <circle cx="118" cy="33" r="3" fill="#64748b" />
                                <text x="126" y="36" fill="#94a3b8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">DESLIGADA</text>
                              </g>
                            )}
                          </g>

                          {/* Section 2: Barramento +24V (5 conexões elétricas com indicação 24V) */}
                          <g transform="translate(6, 44)">
                            <rect x="0" y="0" width="182" height="44" rx="4" fill="#1c1917" stroke="#7f1d1d" strokeWidth="1" />
                            <rect x="0" y="0" width="182" height="12" rx="3" fill="#7f1d1d" />
                            <text x="8" y="9" fill="#fecaca" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
                              5x SAÍDAS: 24V CC
                            </text>
                            <text x="174" y="9" fill="#fca5a5" fontSize="6.5" fontWeight="bold" textAnchor="end" fontFamily="'JetBrains Mono'">
                              ALIMENTAÇÃO [+]
                            </text>
                            {/* Visual guide labels under the 5 knobs */}
                            {[20, 58, 97, 136, 174].map((tx, idx) => (
                              <text key={idx} x={tx} y="41" fill="#ef4444" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                                24V
                              </text>
                            ))}
                          </g>

                          {/* Section 3: Barramento 0V (5 conexões elétricas com indicação 0V em Azul Escuro) */}
                          <g transform="translate(6, 92)">
                            <rect x="0" y="0" width="182" height="44" rx="4" fill="#0b1329" stroke="#1e3a8a" strokeWidth="1.2" />
                            <rect x="0" y="0" width="182" height="12" rx="3" fill="#172554" />
                            <text x="8" y="9" fill="#93c5fd" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
                              5x RETORNOS: 0V GND
                            </text>
                            <text x="174" y="9" fill="#60a5fa" fontSize="6.5" fontWeight="bold" textAnchor="end" fontFamily="'JetBrains Mono'">
                              COMUM [-]
                            </text>
                            {/* Visual guide labels under the 5 knobs */}
                            {[20, 58, 97, 136, 174].map((tx, idx) => (
                              <text key={idx} x={tx} y="41" fill="#93c5fd" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                                0V
                              </text>
                            ))}
                          </g>
                        </g>
                      );
                    })()}

                    {/* 9. INDUSTRIAL RELAY MODULE (K1) */}
                    {comp.type === 'industrial_relay' && (() => {
                      const isEnergized = comp.state.activated === true;
                      return (
                        <g transform="translate(15, 26)">
                          {/* Relay Base Socket Chassis */}
                          <rect x="0" y="0" width="130" height="144" rx="6" fill="#090f1d" stroke="#334155" strokeWidth="1.2" />
                          
                          {/* DIN Rail Clip indicator */}
                          <rect x="35" y="138" width="60" height="4" rx="1" fill="#475569" />

                          {/* Transparent Polycarbonate Cover */}
                          <rect x="18" y="8" width="94" height="124" rx="4" fill="#030712" fillOpacity="0.7" stroke={isEnergized ? "#10b981" : "#1e293b"} strokeWidth="1.2" />

                          {/* Coil Symbol & Internal Windings */}
                          <rect x="42" y="14" width="46" height="24" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                          <line x1="42" y1="14" x2="88" y2="38" stroke="#64748b" strokeWidth="1" />
                          <text x="65" y="30" fill="#cbd5e1" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                            24V CC
                          </text>

                          {/* Status LED */}
                          <g transform="translate(65, 48)">
                            <circle cx="0" cy="0" r="4.5" fill={isEnergized ? "#10b981" : "#334155"} stroke={isEnergized ? "#34d399" : "#1e293b"} strokeWidth="1" />
                            {isEnergized && (
                              <circle cx="0" cy="0" r="7.5" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.6" className="animate-pulse" />
                            )}
                            <text x="0" y="11" fill={isEnergized ? "#34d399" : "#64748b"} fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              {isEnergized ? "LIGADO" : "DESLIGADO"}
                            </text>
                          </g>

                          {/* Contact Scheme 1: NA (11-14) */}
                          <g transform="translate(26, 68)">
                            <rect x="0" y="0" width="78" height="22" rx="3" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                            <text x="6" y="14" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'">11</text>
                            <text x="72" y="14" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="end">14 (NA)</text>
                            {/* Contact Blade */}
                            {isEnergized ? (
                              <line x1="22" y1="11" x2="52" y2="11" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                            ) : (
                              <line x1="22" y1="11" x2="48" y2="6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                            )}
                            <circle cx="22" cy="11" r="2" fill="#38bdf8" />
                            <circle cx="52" cy="11" r="2" fill={isEnergized ? "#10b981" : "#64748b"} />
                          </g>

                          {/* Contact Scheme 2: NF (21-22) */}
                          <g transform="translate(26, 96)">
                            <rect x="0" y="0" width="78" height="22" rx="3" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                            <text x="6" y="14" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'">21</text>
                            <text x="72" y="14" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="end">22 (NF)</text>
                            {/* Contact Blade */}
                            {!isEnergized ? (
                              <line x1="22" y1="11" x2="52" y2="11" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                            ) : (
                              <line x1="22" y1="11" x2="48" y2="6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                            )}
                            <circle cx="22" cy="11" r="2" fill="#38bdf8" />
                            <circle cx="52" cy="11" r="2" fill={!isEnergized ? "#38bdf8" : "#64748b"} />
                          </g>
                        </g>
                      );
                    })()}

                    {/* ------------------------------------------------ */}
                    {/* PORTS RENDERING (Connection Circles / Entradas e Saídas) */}
                    {/* ------------------------------------------------ */}
                    {comp.ports.map((port) => {
                      let portX = port.x;
                      let portY = port.y;

                      // Auto-ajuste para o módulo de botões de acionamento:
                      // Garante que os bornes elétricos fiquem na régua inferior dedicada (y: 83%),
                      // deixando os botões de acionamento superiores (y: ~70px) 100% livres e desobstruídos
                      if (comp.type === 'push_button_station' && port.y < 70) {
                        portY = 83;
                        if (port.name.includes('13')) portX = 16;
                        else if (port.name.includes('14')) portX = 38;
                        else if (port.name.includes('11')) portX = 62;
                        else if (port.name.includes('12')) portX = 84;
                      }

                      // Auto-ajuste para a Unidade de Conservação FRL:
                      // Posiciona conexões nos bocais do corpo metálico industrial (P à esq, 1 à dir)
                      if (comp.type === 'frl_unit') {
                        portY = 39;
                        if (port.name.includes('P') || port.name.includes('Entrada')) {
                          portX = 8;
                        } else if (port.name.includes('1') || port.name.includes('Saída')) {
                          portX = 92;
                        }
                      }

                      // Auto-ajuste para Eletroválvulas 5/2:
                      // Separa fisicamente as conexões elétricas de +24V (A1) e 0V (A2)
                      if (comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') {
                        if (port.name.includes('Y1')) {
                          if (port.functionType === 'signal_in' || port.name.includes('+')) {
                            portX = 6;
                            portY = 13;
                          } else if (port.functionType === 'ground_0v' || port.name.includes('-')) {
                            portX = 18;
                            portY = 38;
                          }
                        } else if (port.name.includes('Y2')) {
                          if (port.functionType === 'signal_in' || port.name.includes('+')) {
                            portX = 94;
                            portY = 13;
                          } else if (port.functionType === 'ground_0v' || port.name.includes('-')) {
                            portX = 82;
                            portY = 38;
                          }
                        }
                      }

                      const px = (comp.width * portX) / 100;
                      const py = (comp.height * portY) / 100;
                      const isPneumatic = port.type === 'pneumatic';
                      const isExhaust = port.functionType === 'exhaust_r' || port.functionType === 'exhaust_s';
                      const isTarget = !isExhaust && connectingStart && connectingStart.port.type === port.type;
                      const isGround = port.functionType === 'ground_0v' || port.name.includes('0V');

                      // Check if port is connected
                      const isConnected = connections.some(
                        (c) =>
                          (c.fromComponentId === comp.id && c.fromPortId === port.id) ||
                          (c.toComponentId === comp.id && c.toPortId === port.id)
                      );

                      const isButtonStation = comp.type === 'push_button_station';
                      const isFRL = comp.type === 'frl_unit';
                      const isTerminalStripComp = comp.type.startsWith('terminal_strip');
                      const isStripInPort = isTerminalStripComp && port.name.includes('IN');
                      const isElectrovalve = comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid';

                      let labelText = port.name.split(' ')[0];
                      if (isExhaust) {
                        labelText = '';
                      } else if (isElectrovalve) {
                        if (port.name.includes('Y1')) {
                          labelText = 'Y1';
                        } else if (port.name.includes('Y2')) {
                          labelText = 'Y2';
                        }
                      } else if (isButtonStation) {
                        labelText = port.name.includes('13') ? '13' : port.name.includes('14') ? '14' : port.name.includes('11') ? '11' : port.name.includes('12') ? '12' : port.name;
                      } else if (isFRL) {
                        labelText = port.name.includes('P') || port.name.includes('Entrada') ? 'P' : 'S';
                      } else if (isTerminalStripComp) {
                        if (isStripInPort) {
                          labelText = comp.type === 'terminal_strip_24v' ? '⚡ FONTE IN' : '⏚ FONTE IN';
                        } else {
                          const numMatch = port.name.match(/\((\d+)\)/);
                          labelText = numMatch ? numMatch[1] : port.name;
                        }
                      }

                      const isBottom = py > comp.height / 2;
                      let textY = isExhaust ? 26 : isButtonStation ? 13 : isFRL ? -15 : (isBottom ? -13 : 18);
                      if (isTerminalStripComp) {
                        if (comp.type === 'terminal_strip_24v') {
                          textY = isStripInPort ? 16 : 14;
                        } else {
                          textY = isStripInPort ? -16 : -14;
                        }
                      } else if (isElectrovalve) {
                        textY = portY < 25 ? -14 : 15;
                      }

                      return (
                        <g
                          key={port.id}
                          transform={`translate(${px}, ${py})`}
                          onClick={(e) => handlePortClick(comp, port, e)}
                          onMouseEnter={() => setHoveredPort(port)}
                          onMouseLeave={() => setHoveredPort(null)}
                          className="cursor-pointer group/port"
                        >
                          {/* Large interactive click target */}
                          <circle
                            r="14"
                            fill="transparent"
                            stroke={isTarget ? (isPneumatic ? '#38bdf8' : '#f43f5e') : 'transparent'}
                            strokeWidth={isTarget ? 2 : 0}
                            strokeDasharray={isTarget ? '3 3' : undefined}
                            className={isTarget ? 'animate-spin' : ''}
                          />

                          {/* Target pulsing aura when connecting compatible wire/tube */}
                          {isTarget && (
                            <circle
                              r="15"
                              fill="none"
                              stroke={isPneumatic ? '#38bdf8' : '#f43f5e'}
                              strokeWidth="1.5"
                              opacity="0.6"
                              className="animate-pulse"
                            />
                          )}

                          {/* Outer Metallic / Plastic Ring (Orifício Circular de Entrada/Saída ou Silenciador de Bronze) */}
                          {isExhaust ? (
                            // Silenciador Pneumático G1/8" em Bronze Sinterizado (Escape das Câmaras)
                            <g className="cursor-default">
                              <title>Silenciador Pneumático G1/8" em Bronze Sinterizado (NR-15 - Atenuação Acústica)</title>
                              {/* Base sextavada em latão industrial usinado */}
                              <rect x="-8" y="-4" width="16" height="8" rx="1.5" fill="#d97706" stroke="#78350f" strokeWidth="1" />
                              <line x1="-4" y1="-4" x2="-4" y2="4" stroke="#fef08a" strokeWidth="0.8" opacity="0.8" />
                              <line x1="4" y1="-4" x2="4" y2="4" stroke="#78350f" strokeWidth="0.8" opacity="0.8" />
                              {/* Elemento cônico poroso de bronze sinterizado */}
                              <path
                                d="M -7 4 L -5.5 17 Q 0 20 5.5 17 L 7 4 Z"
                                fill="#b45309"
                                stroke="#78350f"
                                strokeWidth="1"
                              />
                              {/* Textura e ranhuras de descompressão acústica */}
                              <line x1="-5" y1="7" x2="5" y2="7" stroke="#fde047" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.7" />
                              <line x1="-5.5" y1="11" x2="5.5" y2="11" stroke="#451a03" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.8" />
                              <line x1="-5" y1="14" x2="5" y2="14" stroke="#fde047" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.6" />
                              {/* Orifício central de escape */}
                              <circle cx="0" cy="0" r="2.2" fill="#78350f" />
                            </g>
                          ) : isPneumatic ? (
                            // Engate Rápido Pneumático Festo QS
                            <g>
                              {/* Base metálica sextavada do engate rápido */}
                              <circle
                                r="8.5"
                                fill="#1e293b"
                                stroke="#94a3b8"
                                strokeWidth="1.5"
                                className="transition-colors group-hover/port:stroke-sky-400"
                              />
                              {/* Anilha de extração / colar azul Festo */}
                              <circle
                                r="6"
                                fill="#0284c7"
                                stroke="#0369a1"
                                strokeWidth="0.8"
                              />
                              {/* Orifício central de inserção do tubo de 4mm/6mm */}
                              <circle
                                r="3.5"
                                fill={isConnected ? '#38bdf8' : '#090d16'}
                                stroke={isConnected ? '#0284c7' : '#1e293b'}
                                strokeWidth="0.8"
                              />
                            </g>
                          ) : comp.type === 'reed_switch_sensor' ? (
                            // Círculo de Conexão do Fio do Sensor (Identificado pela cor do fio)
                            <g>
                              {/* Anel Externo colorido identificado pelo fio (BN, BU, BK, WH) */}
                              <circle
                                r="9"
                                fill={
                                  port.name.startsWith('BN') ? '#451a03' :
                                  port.name.startsWith('BU') ? '#172554' :
                                  port.name.startsWith('WH') ? '#334155' : '#020617'
                                }
                                stroke={
                                  port.name.startsWith('BN') ? '#d97706' :
                                  port.name.startsWith('BU') ? '#3b82f6' :
                                  port.name.startsWith('WH') ? '#f8fafc' : '#94a3b8'
                                }
                                strokeWidth="2.5"
                                className="transition-all group-hover/port:stroke-white group-hover/port:scale-110"
                              />
                              {/* Bucha interna de contato metálico em latão */}
                              <circle
                                r="5"
                                fill="#090d16"
                                stroke="#fbbf24"
                                strokeWidth="1"
                              />
                              {/* Terminal central conectado */}
                              <circle
                                r="2.8"
                                fill={isConnected ? '#22c55e' : '#fbbf24'}
                              />
                            </g>
                          ) : (
                            // Borne Banana Elétrico 4mm de Segurança
                            <g>
                              {/* Capa isolante circular colorida */}
                              <circle
                                r={isTerminalStripComp ? (isStripInPort ? 6.8 : 6.0) : 8.5}
                                fill="#0f172a"
                                stroke={
                                  isStripInPort
                                    ? (isGround ? '#38bdf8' : '#fbbf24')
                                    : (isGround ? '#1e3a8a' : '#ef4444')
                                }
                                strokeWidth={isStripInPort ? 2.5 : isTerminalStripComp ? 2.0 : 2.5}
                                className="transition-colors group-hover/port:stroke-white"
                              />
                              {/* Bucha metálica niquelada de contato interno */}
                              <circle
                                r={isTerminalStripComp ? 3.6 : 5}
                                fill="#090d16"
                                stroke="#fbbf24"
                                strokeWidth={isTerminalStripComp ? 0.8 : 1}
                              />
                              {/* Orifício central do borne 4mm */}
                              <circle
                                r={isTerminalStripComp ? 2.0 : 2.8}
                                fill={isConnected ? (isGround ? '#172554' : '#ef4444') : '#020617'}
                              />
                            </g>
                          )}

                          {/* Port Technical Label Badge (Oculto em sensores e quando labelText vazio como silenciadores) */}
                          {comp.type !== 'reed_switch_sensor' && Boolean(labelText) && (
                            <g transform={`translate(0, ${textY})`}>
                              <rect
                                x={-(labelText.length * (isTerminalStripComp ? 3.0 : 3.8) + (isTerminalStripComp ? 3 : 5))}
                                y={isTerminalStripComp ? "-5.5" : "-7"}
                                width={labelText.length * (isTerminalStripComp ? 6.0 : 7.6) + (isTerminalStripComp ? 6 : 10)}
                                height={isTerminalStripComp ? "11" : "13"}
                                rx={isTerminalStripComp ? 2 : 3}
                                fill="#090f1d"
                                stroke={
                                  isStripInPort ? (isGround ? '#38bdf8' : '#f59e0b') :
                                  isExhaust ? '#b45309' :
                                  isPneumatic ? '#0284c7' :
                                  isGround ? '#1e3a8a' :
                                  isButtonStation && (port.name.includes('13') || port.name.includes('14')) ? '#059669' :
                                  '#dc2626'
                                }
                                strokeWidth={isStripInPort ? 1.2 : 0.8}
                                opacity={isTerminalStripComp && !isStripInPort && hoveredPort?.id !== port.id ? 0.65 : 0.95}
                              />
                              <text
                                x="0"
                                y={isTerminalStripComp ? "2.2" : "2.5"}
                                fill={
                                  isStripInPort ? (isGround ? '#38bdf8' : '#fbbf24') :
                                  isExhaust ? '#fde047' :
                                  isPneumatic ? '#38bdf8' :
                                  isGround ? '#93c5fd' :
                                  isButtonStation && (port.name.includes('13') || port.name.includes('14')) ? '#34d399' :
                                  '#fca5a5'
                                }
                                fontSize={isTerminalStripComp ? (isStripInPort ? "6.5" : "6") : "7.5"}
                                fontWeight="bold"
                                fontFamily="'JetBrains Mono', monospace"
                                textAnchor="middle"
                                className="pointer-events-none"
                              >
                                {labelText}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Active Fault Icon Alert if component is faulty */}
                    {(comp.faults?.isLeaking || comp.faults?.isCoilBurned || comp.faults?.isStuck) && (
                      <g transform={`translate(${comp.width - 24}, ${comp.height - 24})`}>
                        <circle r="10" fill="#ef4444" className="animate-ping" opacity="0.4" />
                        <circle r="9" fill="#ef4444" />
                        <text x="0" y="3.5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">!</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ---------------------------------------------------- */}
            {/* CONNECTIONS LAYER (Hoses & Wires ON TOP OF BENCH)   */}
            {/* ---------------------------------------------------- */}
            <g id="connections-layer">
              {routedConnections.map((routed) => {
                const { connection: conn, coords, waypoints, pathD, isPneumatic, isGroundWire, controlHandle, lengthMm } = routed;
                const { x1, y1, x2, y2 } = coords;

                const isHovered = hoveredConnectionId === conn.id;
                const isSelected = selectedConnectionId === conn.id;

                // Color based on type and pressure/voltage
                let strokeColor = '#0284c7'; // Festo Blue PU hose
                let highlightColor = '#38bdf8';
                let strokeWidth = isPneumatic ? 5.5 : 4;

                if (!isPneumatic) {
                  // Cabo 0V (GND) em Azul Escuro para não confundir com mangueiras pneumáticas azuis claras
                  strokeColor = isGroundWire ? '#172554' : '#ef4444';
                  highlightColor = isGroundWire ? '#2563eb' : '#f87171';
                }

                return (
                  <g
                    key={conn.id}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredConnectionId(conn.id)}
                    onMouseLeave={() => setHoveredConnectionId(null)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConnection(conn.id, e);
                      setSelectedConnectionId(null);
                    }}
                  >
                    {/* Outer glow / hit area for easy hover and click / drag / double-click delete */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={22}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(conn.id);
                        onSelectComponent(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(conn.id, e);
                        setSelectedConnectionId(null);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(conn.id);
                        onSelectComponent(null);
                        setDraggingConnectionId(conn.id);
                      }}
                    />

                    {/* Selected active glow halo along entire curve */}
                    {isSelected && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={strokeWidth + 7}
                        strokeDasharray="8 6"
                        opacity={0.65}
                        className="animate-pulse pointer-events-none"
                      />
                    )}

                    {/* Shadow underneath */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={strokeWidth + 3}
                      opacity={0.35}
                      transform="translate(1.5, 3.5)"
                      className="pointer-events-none"
                    />

                    {/* Main hose / wire body */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      filter={conn.active && isSimulating ? 'url(#hose-glow)' : undefined}
                      className={isHovered || isSelected ? 'brightness-125' : ''}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(conn.id);
                        onSelectComponent(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(conn.id, e);
                        setSelectedConnectionId(null);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(conn.id);
                        onSelectComponent(null);
                        setDraggingConnectionId(conn.id);
                      }}
                    />

                    {/* Glossy highlight along tube / wire to simulate polyurethane sheen */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth={strokeWidth * 0.35}
                      strokeLinecap="round"
                      opacity={0.75}
                      className="pointer-events-none"
                    />

                    {/* Animated flow dash if simulating */}
                    {isSimulating && conn.active && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isPneumatic ? '#bae6fd' : isGroundWire ? '#93c5fd' : '#fef08a'}
                        strokeWidth={strokeWidth * 0.5}
                        strokeDasharray={isPneumatic ? '6 12' : '4 8'}
                        strokeLinecap="round"
                        className="animate-[dash_1s_linear_infinite] pointer-events-none"
                      />
                    )}

                    {/* ---------------------------------------------------- */}
                    {/* PHYSICAL CONNECTORS AT THE CIRCULAR ENTRANCES / EXITS */}
                    {/* ---------------------------------------------------- */}
                    {/* Origin connector fitting (Entrada/Saída de origem) */}
                    {isPneumatic ? (
                      // Engate Rápido Pneumático Festo QS conectado no círculo de origem
                      <g transform={`translate(${x1}, ${y1})`} className="pointer-events-none">
                        <circle r="7.5" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
                        <circle r="5.2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
                        <circle r="3" fill="#38bdf8" />
                        <circle r="1.5" fill="#0284c7" />
                      </g>
                    ) : (
                      // Plugue Banana 4mm conectado no borne circular de origem
                      <g transform={`translate(${x1}, ${y1})`} className="pointer-events-none">
                        <circle r="7.5" fill={isGroundWire ? '#172554' : '#b91c1c'} stroke={isGroundWire ? '#3b82f6' : '#ffffff'} strokeWidth="1.2" />
                        <circle r="4.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.2" />
                        <circle r="2.5" fill={isGroundWire ? '#1e40af' : '#f87171'} />
                      </g>
                    )}

                    {/* Destination connector fitting (Entrada/Saída de destino) */}
                    {isPneumatic ? (
                      // Engate Rápido Pneumático Festo QS conectado no círculo de destino
                      <g transform={`translate(${x2}, ${y2})`} className="pointer-events-none">
                        <circle r="7.5" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
                        <circle r="5.2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
                        <circle r="3" fill="#38bdf8" />
                        <circle r="1.5" fill="#0284c7" />
                      </g>
                    ) : (
                      // Plugue Banana 4mm conectado no borne circular de destino
                      <g transform={`translate(${x2}, ${y2})`} className="pointer-events-none">
                        <circle r="7.5" fill={isGroundWire ? '#172554' : '#b91c1c'} stroke={isGroundWire ? '#3b82f6' : '#ffffff'} strokeWidth="1.2" />
                        <circle r="4.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.2" />
                        <circle r="2.5" fill={isGroundWire ? '#1e40af' : '#f87171'} />
                      </g>
                    )}

                    {/* Interactive deflection and length control handle */}
                    {(isHovered || isSelected) && (
                      <g
                        transform={`translate(${controlHandle.x}, ${controlHandle.y})`}
                        className="cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionId(conn.id);
                          onSelectComponent(null);
                          setDraggingConnectionId(conn.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionId(conn.id);
                          onSelectComponent(null);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConnection(conn.id, e);
                          setSelectedConnectionId(null);
                        }}
                      >
                        {/* Outer halo */}
                        <circle
                          r={isSelected ? 16 : 12}
                          fill={isSelected ? '#0284c7' : '#0f172a'}
                          fillOpacity={isSelected ? 0.35 : 0.75}
                          stroke={isSelected ? '#38bdf8' : isPneumatic ? '#0ea5e9' : isGroundWire ? '#3b82f6' : '#ef4444'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          strokeDasharray={isSelected ? '4 3' : undefined}
                          className={isSelected ? 'animate-[spin_8s_linear_infinite]' : ''}
                        />
                        {/* Inner knob */}
                        <circle
                          r={isSelected ? 8 : 6}
                          fill={isSelected ? '#38bdf8' : '#1e293b'}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        {/* Center dot */}
                        {isSelected ? (
                          <circle r="3" fill="#0369a1" />
                        ) : (
                          <circle r="2" fill="#94a3b8" />
                        )}

                        {/* Floating tooltip */}
                        {!draggingConnectionId && (
                          <g transform="translate(0, -22)" className="pointer-events-none">
                            <rect
                              x="-95"
                              y="-12"
                              width="190"
                              height="22"
                              rx="5"
                              fill="#0f172a"
                              stroke={isSelected ? '#38bdf8' : '#64748b'}
                              strokeWidth="1.2"
                              opacity="0.95"
                            />
                            <text
                              x="0"
                              y="3"
                              fill="#e2e8f0"
                              fontSize="9"
                              fontWeight="600"
                              fontFamily="system-ui, -apple-system, sans-serif"
                              textAnchor="middle"
                            >
                              Arraste p/ esticar ou curvar (2 cliques p/ excluir)
                            </text>
                          </g>
                        )}
                      </g>
                    )}

                    {/* Quick Delete Tooltip Button */}
                    {isHovered && !draggingConnectionId && !isSelected && (
                      <g transform={`translate(${controlHandle.x + 22}, ${controlHandle.y - 12})`}>
                        <circle
                          r="10"
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          className="cursor-pointer hover:fill-rose-700"
                          onClick={(e) => handleDeleteConnection(conn.id, e)}
                        />
                        <text
                          x="0"
                          y="3.5"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                          onClick={(e) => handleDeleteConnection(conn.id, e)}
                          className="cursor-pointer pointer-events-none"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Active temporary line while drawing connection */}
              {connectingStart && (
                (() => {
                  const comp = components.find((c) => c.id === connectingStart.componentId);
                  if (!comp) return null;
                  const sourceCoords = getPortWorldCoordinates(comp, connectingStart.port);
                  const x1 = sourceCoords.x;
                  const y1 = sourceCoords.y;
                  const x2 = mousePos.x;
                  const y2 = mousePos.y;

                  const dx = x2 - x1;
                  const sag = Math.min(80, Math.max(20, Math.abs(dx) * 0.2));
                  const pathD = `M ${x1} ${y1} C ${x1 + dx * 0.3} ${y1 + sag}, ${x2 - dx * 0.3} ${y2 + sag}, ${x2} ${y2}`;

                  const isGroundStart = 
                    connectingStart.port.type === 'electrical' &&
                    (connectingStart.port.functionType === 'ground_0v' || connectingStart.port.name.includes('0V'));

                  const strokeColor = connectingStart.port.type === 'pneumatic' 
                    ? '#0ea5e9' 
                    : (isGroundStart ? '#1e3a8a' : '#f43f5e');

                  return (
                    <g className="pointer-events-none">
                      {/* Temporary line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={4.5}
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                        className="animate-pulse"
                      />
                      {/* Origin fitting */}
                      <circle 
                        cx={x1} 
                        cy={y1} 
                        r="7" 
                        fill={connectingStart.port.type === 'pneumatic' ? '#0284c7' : (isGroundStart ? '#172554' : '#ef4444')} 
                        stroke={isGroundStart ? '#3b82f6' : undefined} 
                        strokeWidth={isGroundStart ? 1.5 : 0} 
                      />
                      {/* Cursor tip ring */}
                      <circle cx={x2} cy={y2} r="6" fill="none" stroke={strokeColor} strokeWidth="2" />
                    </g>
                  );
                })()
              )}
            </g>

            {/* Precision Crosshair / Marked Cursor Position Guidelines */}
            {showCrosshair && (
              <g id="precision-cursor-crosshair" pointerEvents="none">
                {/* Horizontal guide across the 2800 width */}
                <line
                  x1="0"
                  y1={mousePos.y}
                  x2="2800"
                  y2={mousePos.y}
                  stroke="#0284c7"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                  opacity="0.65"
                />
                {/* Vertical guide across the 1700 height */}
                <line
                  x1={mousePos.x}
                  y1="0"
                  x2={mousePos.x}
                  y2="1700"
                  stroke="#0284c7"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                  opacity="0.65"
                />
                {/* Outer Reticle Ring */}
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="15"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  opacity="0.85"
                />
                {/* Center target dot */}
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="3"
                  fill="#38bdf8"
                />
                {/* Floating Coordinate Tag beside mouse */}
                <g transform={`translate(${mousePos.x > 2630 ? mousePos.x - 122 : mousePos.x + 18}, ${mousePos.y > 1650 ? mousePos.y - 32 : mousePos.y + 14})`}>
                  <rect
                    width="106"
                    height="24"
                    rx="4"
                    fill="#090d16"
                    stroke="#0284c7"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x="8"
                    y="16"
                    fill="#38bdf8"
                    fontSize="10"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="bold"
                  >
                    X:{mousePos.x} Y:{mousePos.y}
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>
      </main>

      {/* Right Sidebar: Selected Component Properties & Physical Tweaks (Abre apenas com duplo clique) */}
      {selectedComponent && isParamsOpen && (
        <aside className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {selectedComponent.tag}
                </span>
                <h3 className="text-xs font-bold text-slate-200">
                  Parâmetros Técnicos
                </h3>
              </div>
              <button
                onClick={() => setIsParamsOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                title="Fechar parâmetros técnicos"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Nome do Módulo</label>
                <p className="text-slate-200 font-semibold mt-0.5">
                  {selectedComponent.type === 'power_supply_24v' ? 'Fonte' : selectedComponent.name}
                </p>
              </div>

              {/* Dynamic properties for Actuator (Bore, Stroke, Load) */}
              {selectedComponent.category === 'actuators' && (
                <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Diâmetro do Êmbolo (D)</span>
                      <span className="font-mono text-cyan-400 font-semibold">
                        {selectedComponent.state.boreDiameterMm || 32} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="80"
                      step="4"
                      value={selectedComponent.state.boreDiameterMm || 32}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateComponents(
                          components.map((c) =>
                            c.id === selectedComponent.id
                              ? { ...c, state: { ...c.state, boreDiameterMm: val } }
                              : c
                          )
                        );
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Curso do Pistão (L)</span>
                      <span className="font-mono text-cyan-400 font-semibold">
                        {selectedComponent.state.strokeLengthMm || 100} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="300"
                      step="25"
                      value={selectedComponent.state.strokeLengthMm || 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateComponents(
                          components.map((c) =>
                            c.id === selectedComponent.id
                              ? { ...c, state: { ...c.state, strokeLengthMm: val } }
                              : c
                          )
                        );
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Carga Axial Resistente (F)</span>
                      <span className="font-mono text-amber-400 font-semibold">
                        {selectedComponent.state.appliedLoadN || 120} N
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="600"
                      step="10"
                      value={selectedComponent.state.appliedLoadN || 120}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateComponents(
                          components.map((c) =>
                            c.id === selectedComponent.id
                              ? { ...c, state: { ...c.state, appliedLoadN: val } }
                              : c
                          )
                        );
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* FRL Pressure adjust */}
              {selectedComponent.type === 'frl_unit' && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Pressão Regulada de Trabalho</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {(selectedComponent.state.pressureP || 6.0).toFixed(1)} bar
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={selectedComponent.state.pressureP || 6.0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateComponents(
                        components.map((c) =>
                          c.id === selectedComponent.id
                            ? { ...c, state: { ...c.state, pressureP: val } }
                            : c
                        )
                      );
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Throttle Valve flow percent */}
              {selectedComponent.type === 'flow_control_throttle' && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Abertura de Vazão (Estrangulador)</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {selectedComponent.state.flowThrottlePercent || 40}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={selectedComponent.state.flowThrottlePercent || 40}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateComponents(
                        components.map((c) =>
                          c.id === selectedComponent.id
                            ? { ...c, state: { ...c.state, flowThrottlePercent: val } }
                            : c
                        )
                      );
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Sensor Parameters: Tipo de Sensor, Quantidade de Fios e Diagnóstico de Alimentação */}
              {(selectedComponent.category === 'sensors' || selectedComponent.type === 'reed_switch_sensor') && (() => {
                const currentTech: SensorTechnology = selectedComponent.state.sensorTech || 'magnetic';
                const currentWires: SensorWireCount = selectedComponent.state.sensorWires || '3_wires';
                const isPowerOk = selectedComponent.state.isPowerCorrect || false;
                const errorDetail = selectedComponent.state.powerErrorDetail;

                const sensorTypes: { id: SensorTechnology; label: string; desc: string; icon: string; tag: string }[] = [
                  { id: 'magnetic', label: 'Magnético', desc: 'Detecta ímã permanente integrado no êmbolo', icon: '🧲', tag: 'Reed Switch' },
                  { id: 'inductive', label: 'Indutivo', desc: 'Detecta metais por oscilador de alta frequência', icon: '⚡', tag: 'Metais Ferrosos' },
                  { id: 'capacitive', label: 'Capacitivo', desc: 'Detecta dielétricos e condutores por capacitância', icon: '〰️', tag: 'Dielétricos' },
                  { id: 'optical', label: 'Óptico', desc: 'Detecta por barreira ou reflexão de feixe infravermelho', icon: '🔦', tag: 'Fotoelétrico' }
                ];

                const wireConfigs: { id: SensorWireCount; label: string; sub: string; detail: string; portsInfo: string }[] = [
                  { 
                    id: '2_wires', 
                    label: 'Dois Fios (2 fios)', 
                    sub: 'Ligação em Série', 
                    detail: 'Ligação em série com a carga (Solenoide Y1/Y2 ou Relé).',
                    portsInfo: 'Bornes: BN (+24V) • BU (Sinal / Carga)'
                  },
                  { 
                    id: '3_wires', 
                    label: 'Três Fios (3 fios)', 
                    sub: 'Padrão PNP Industrial', 
                    detail: 'Alimentação própria + saída digital NA chaveada a +24V.',
                    portsInfo: 'Bornes: BN (+24V) • BU (0V GND) • BK (Sinal)'
                  },
                  { 
                    id: '4_wires', 
                    label: 'Quatro Fios (4 fios)', 
                    sub: 'Saída Complementar (NA + NF)', 
                    detail: 'Alimentação própria + saídas antivalentes NA e NF.',
                    portsInfo: 'Bornes: BN (+24V) • BU (0V) • BK (NA) • WH (NF)'
                  }
                ];

                const handleTechSelect = (tech: SensorTechnology) => {
                  onUpdateComponents(
                    components.map(c =>
                      c.id === selectedComponent.id
                        ? { ...c, state: { ...c.state, sensorTech: tech } }
                        : c
                    )
                  );
                };

                const handleWiresSelect = (wires: SensorWireCount) => {
                  const newPorts = getSensorPorts(wires, selectedComponent.ports);
                  const validPortIds = new Set(newPorts.map(p => p.id));
                  
                  // Atualiza as portas e a configuração do sensor
                  onUpdateComponents(
                    components.map(c =>
                      c.id === selectedComponent.id
                        ? { ...c, ports: newPorts, state: { ...c.state, sensorWires: wires } }
                        : c
                    )
                  );

                  // Remove conexões ligadas a bornes que deixaram de existir
                  onUpdateConnections(
                    connections.filter(conn => {
                      if (conn.fromComponentId === selectedComponent.id && !validPortIds.has(conn.fromPortId)) return false;
                      if (conn.toComponentId === selectedComponent.id && !validPortIds.has(conn.toPortId)) return false;
                      return true;
                    })
                  );
                };

                const handlePositionSelect = (posMm: number) => {
                  const percent = posMm === 0 ? 0 : posMm === 200 ? 100 : 50;
                  onUpdateComponents(
                    components.map(c =>
                      c.id === selectedComponent.id
                        ? { ...c, state: { ...c.state, detectionPosition: percent } }
                        : c
                    )
                  );
                };

                return (
                  <div className="space-y-4">
                    {/* 1. SELETOR DE TIPO DE SENSOR */}
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-cyan-400" />
                          Tipo de Sensor
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                          {sensorTypes.find(t => t.id === currentTech)?.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {sensorTypes.map(t => {
                          const isSelected = currentTech === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleTechSelect(t.id)}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-cyan-950/80 border-cyan-500 shadow-sm shadow-cyan-950/50 text-white'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-base">{t.icon}</span>
                                {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                              </div>
                              <span className="text-[11px] font-bold block">{t.label}</span>
                              <span className="text-[9px] text-slate-400 line-clamp-1">{t.tag}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        {sensorTypes.find(t => t.id === currentTech)?.desc}
                      </p>
                    </div>

                    {/* 2. SELETOR DE QUANTIDADE DE FIOS */}
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-sky-400" />
                          Quantidade de Fios
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/80">
                          {currentWires === '2_wires' ? '2 FIOS' : currentWires === '4_wires' ? '4 FIOS' : '3 FIOS'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {wireConfigs.map(w => {
                          const isSelected = currentWires === w.id;
                          return (
                            <button
                              key={w.id}
                              onClick={() => handleWiresSelect(w.id)}
                              className={`w-full p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-sky-950/80 border-sky-500 shadow-sm shadow-sky-950/50 text-white'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold">{w.label}</span>
                                  <span className="text-[9px] font-mono text-slate-400">({w.sub})</span>
                                </div>
                                <div className="text-[9px] font-mono text-sky-300/80">{w.portsInfo}</div>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        {wireConfigs.find(w => w.id === currentWires)?.detail}
                      </p>
                    </div>

                    {/* 3. DIAGNÓSTICO DE ALIMENTAÇÃO CORRETA (IEC 60947-5-2) */}
                    <div className={`p-3 rounded-xl border transition-all ${
                      isPowerOk
                        ? 'bg-emerald-950/40 border-emerald-800/80'
                        : 'bg-amber-950/40 border-amber-800/80'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          {isPowerOk ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className={isPowerOk ? 'text-emerald-300' : 'text-amber-300'}>
                            {isPowerOk ? 'Alimentado Corretamente' : 'Sem Alimentação Correta'}
                          </span>
                        </span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isPowerOk
                            ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                            : 'bg-amber-900/80 text-amber-300 border border-amber-700'
                        }`}>
                          {isPowerOk ? '24V CC OK' : '0V / FALHA'}
                        </span>
                      </div>

                      {isPowerOk ? (
                        <p className="text-[10px] text-emerald-300/90 leading-relaxed">
                          O sensor está energizado de acordo com a norma. O LED de alimentação (PWR) está verde e a comutação das saídas opera normalmente.
                        </p>
                      ) : (
                        <div className="space-y-1 text-[10px] text-amber-200/90 leading-relaxed">
                          <p className="font-semibold text-amber-300">
                            {errorDetail || 'O sensor só funcionará se estiver devidamente alimentado.'}
                          </p>
                          <p className="text-slate-400 text-[9.5px]">
                            {currentWires === '2_wires'
                              ? 'Conecte BN (+24V) na fonte e BU (Carga) na solenoide com retorno ao 0V.'
                              : 'Conecte o borne BN (+24V) e o borne BU (0V) à fonte de 24V CC.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 4. POSIÇÃO DE FIXAÇÃO NO TRILHO DA HASTE */}
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Posição no Trilho do Cilindro</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {selectedComponent.state.detectionPosition === 0 ? '0 mm (1S1)' : '200 mm (1S2)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handlePositionSelect(0)}
                          className={`py-1.5 px-2 rounded text-xs font-mono font-bold border transition cursor-pointer ${
                            selectedComponent.state.detectionPosition === 0
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          0 mm (Recuado)
                        </button>
                        <button
                          onClick={() => handlePositionSelect(200)}
                          className={`py-1.5 px-2 rounded text-xs font-mono font-bold border transition cursor-pointer ${
                            selectedComponent.state.detectionPosition === 100
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          200 mm (Avançado)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Power Supply 24V (Fonte com Chave Liga/Desliga, 5x 24V e 5x 0V) */}
              {selectedComponent.type === 'power_supply_24v' && (() => {
                const isPowered = selectedComponent.state.activated !== false;
                return (
                  <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-sky-900/50">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-300">Interruptor Geral</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                        isPowered 
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800' 
                          : 'bg-rose-950 text-rose-400 border-rose-800'
                      }`}>
                        {isPowered ? 'LIGADA' : 'DESLIGADA'}
                      </span>
                    </div>

                    {/* Botão de Liga e Desliga */}
                    <button
                      onClick={() => handleTogglePowerSupply(selectedComponent.id)}
                      className={`w-full py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        isPowered
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 shadow-slate-950/50 border border-slate-700'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isPowered ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                      {isPowered ? 'Chave Liga / Desliga: LIGADA (24V)' : 'Chave Liga / Desliga: DESLIGADA (0V)'}
                    </button>

                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 font-mono">TENSÃO REGULADA DE SAÍDA</span>
                      <p className={`text-2xl font-mono font-black tracking-wider mt-0.5 ${isPowered ? 'text-sky-400' : 'text-slate-500'}`}>
                        {isPowered ? '24.0 V' : '0.0 V'} <span className="text-xs text-slate-400 font-normal">CC</span>
                      </p>
                      <p className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center justify-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isPowered ? 'bg-emerald-400' : 'bg-slate-500'} inline-block`}></span>
                        {isPowered ? 'Tensão Estabilizada e Travada' : 'Alimentação Desconectada'}
                      </p>
                    </div>

                    {/* Conexões Elétricas: 5x 24V e 5x 0V */}
                    <div className="space-y-1.5 text-[11px] p-2 rounded bg-slate-900/50 border border-slate-800">
                      <div className="flex justify-between items-center text-red-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          Conexões 24V (+):
                        </span>
                        <span className="font-mono font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 text-red-200">
                          5 Bornes
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-blue-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-900 border border-blue-500 inline-block" />
                          Conexões 0V (GND - Azul Escuro):
                        </span>
                        <span className="font-mono font-bold bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800 text-blue-200">
                          5 Bornes
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Padrão de Segurança:</span>
                        <span className="font-mono text-slate-200 font-semibold">PELV / SELV</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Norma Aplicável:</span>
                        <span className="font-mono text-cyan-400 font-semibold">IEC 60204-1 / NR-12</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Capacidade Máxima:</span>
                        <span className="font-mono text-slate-200">5.0 A (120 W)</span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-amber-950/30 border border-amber-800/40 text-[10px] text-amber-300/90 leading-relaxed">
                      Fonte estritamente travada em 24V CC com barramento duplo de 5 saídas 24V e 5 retornos 0V para conexão didática rápida.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <button
            onClick={() => {
              onDeleteComponent(selectedComponent.id);
              setIsParamsOpen(false);
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 font-semibold text-xs transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remover da Bancada</span>
          </button>
        </aside>
      )}
    </div>
  );
};
