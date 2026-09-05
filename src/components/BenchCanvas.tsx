import React, { useState, useRef } from 'react';
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
  Activity
} from 'lucide-react';
import { benchAudio } from '../utils/audioSynthesizer';
import { getSensorPorts } from '../utils/circuitSimulator';
import { ElectrovalveRenderer } from './ElectrovalveRenderer';

// Utility to calculate transformed world coordinates for ports taking rotation into account
export const getPortWorldCoordinates = (comp: BenchComponent, port: ComponentPort) => {
  const rotation = comp.rotation || 0;
  const rawX = (comp.width * port.x) / 100;
  const rawY = (comp.height * port.y) / 100;

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
}) => {
  // Connection wiring state
  const [connectingStart, setConnectingStart] = useState<{
    componentId: string;
    port: ComponentPort;
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPort, setHoveredPort] = useState<ComponentPort | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isParamsOpen, setIsParamsOpen] = useState<boolean>(false);

  const canvasRef = useRef<SVGSVGElement | null>(null);

  // Handle canvas mouse move for active drawing line
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Handle dragging component
    if (draggingCompId) {
      const draggedComp = components.find(c => c.id === draggingCompId);
      const isElectrical = draggedComp?.category === 'electrical' || draggedComp?.type === 'power_supply_24v';

      onUpdateComponents(
        components.map((c) => {
          if (c.id === draggingCompId) {
            const rawX = x - dragOffset.x;
            const rawY = y - dragOffset.y;

            const finalX = Math.max(15, Math.min(1385 - c.width, Math.round(rawX / 10) * 10));
            let finalY: number;

            if (isElectrical) {
              // Módulos elétricos fixam-se no Rack Superior (lado a lado, trilho Y=20)
              if (rawY < 180) {
                finalY = 20; // Alinhamento perfeito no trilho superior
              } else {
                finalY = Math.max(20, Math.min(220 - c.height, Math.round(rawY / 10) * 10));
              }
            } else {
              // Componentes pneumáticos (válvulas, atuadores, sensores, FRL, manifold)
              // Ficam no painel de perfil de alumínio ranhurado (Y >= 238)
              const clampedY = Math.max(238, Math.min(840 - c.height, rawY));
              // Encaixe suave nas ranhuras em T (perfil a cada 48px)
              const grooveIndex = Math.round((clampedY - 240) / 48);
              finalY = Math.max(240, Math.min(840 - c.height, 240 + grooveIndex * 48));
            }

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
  };

  // Port click to initiate or complete connection
  const handlePortClick = (comp: BenchComponent, port: ComponentPort, e: React.MouseEvent) => {
    e.stopPropagation();

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

  const handleDeleteConnection = (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateConnections(connections.filter((c) => c.id !== connId));
    benchAudio.playExhaust(0.1, 0.15);
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

    setDraggingCompId(comp.id);
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
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
        {/* Canvas Toolbar overlay */}
        <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="font-semibold text-slate-200">Painel de Alumínio Ranhurado</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {components.length} módulos instalados
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {connections.length} conexões ativas
          </span>
          {selectedComponent && (
            <>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-cyan-300 font-medium">
                Selecionado: <strong className="font-mono text-white">{selectedComponent.tag}</strong> ({(selectedComponent.rotation || 0)}°)
              </span>
            </>
          )}
          {connectingStart && (
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 animate-pulse">
              <span>Conectando {connectingStart.port.name}... Clique no destino ou ESC</span>
              <button
                onClick={() => setConnectingStart(null)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Active Connection Legend */}
        <div className="absolute bottom-3 left-4 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-cyan-500 rounded-sm" />
            <span className="text-slate-300">Mangueira Pneumática (PU 6mm Azul Claro)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-rose-500 rounded-sm" />
            <span className="text-slate-300">Cabo Elétrico (+24V Vermelho)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-blue-900 border border-blue-500 rounded-sm shadow-xs" />
            <span className="text-slate-300">Cabo Elétrico (0V Azul Escuro)</span>
          </div>
        </div>

        {/* SVG Interactive Workbench Canvas */}
        <div className="flex-1 w-full h-full overflow-auto cursor-crosshair">
          <svg
            ref={canvasRef}
            id="bench-svg-canvas"
            width={1400}
            height={850}
            viewBox="0 0 1400 850"
            className="w-[1400px] h-[850px] select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => {
              if (connectingStart) setConnectingStart(null);
              onSelectComponent(null);
              setIsParamsOpen(false);
            }}
          >
            <defs>
              {/* Aluminum Extrusion T-Slot Pattern for Didactic Bench */}
              <pattern id="aluminum-slats" width="50" height="48" patternUnits="userSpaceOnUse">
                {/* Slat aluminum face */}
                <rect width="50" height="48" fill="#141c2e" />
                <line x1="0" y1="0" x2="50" y2="0" stroke="#334155" strokeWidth="1" />
                {/* Subtle surface brushed texture */}
                <line x1="0" y1="12" x2="50" y2="12" stroke="#1e293b" strokeWidth="0.6" opacity="0.6" />
                <line x1="0" y1="24" x2="50" y2="24" stroke="#1e293b" strokeWidth="0.6" opacity="0.6" />
                {/* Horizontal T-Slot groove */}
                <rect x="0" y="40" width="50" height="7" fill="#070b14" />
                <line x1="0" y1="43.5" x2="50" y2="43.5" stroke="#1e293b" strokeWidth="1" strokeDasharray="6 4" />
                <line x1="0" y1="47.5" x2="50" y2="47.5" stroke="#475569" strokeWidth="0.8" />
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
            </defs>

            {/* ==================================================== */}
            {/* 1. RACK SUPERIOR: MÓDULOS ELÉTRICOS (24V CC / DIDÁTICO) */}
            {/* ==================================================== */}
            <g id="top-electrical-rack">
              {/* Rack Interior Backplane */}
              <rect x="0" y="0" width="1400" height="222" fill="#090f1d" />
              
              {/* Top Mounting Rail (DIN / Eurocard Frame) */}
              <rect x="10" y="6" width="1380" height="14" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              {/* Screw holes along the top rail */}
              {Array.from({ length: 35 }).map((_, i) => (
                <circle key={`ts_${i}`} cx={25 + i * 39} cy="13" r="2.5" fill="#475569" stroke="#090f1d" strokeWidth="0.6" />
              ))}

              {/* Bottom Mounting Rail of Electrical Rack */}
              <rect x="10" y="202" width="1380" height="14" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              {/* Screw holes along the bottom rail */}
              {Array.from({ length: 35 }).map((_, i) => (
                <circle key={`bs_${i}`} cx={25 + i * 39} cy="209" r="2.5" fill="#475569" stroke="#090f1d" strokeWidth="0.6" />
              ))}

              {/* Vertical Module Guide Marks (indica baias modulares padronizadas lado a lado) */}
              {Array.from({ length: 9 }).map((_, i) => (
                <line
                  key={`bg_${i}`}
                  x1={240 + i * 140}
                  y1="22"
                  x2={240 + i * 140}
                  y2="200"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                  opacity="0.5"
                />
              ))}

              {/* Rack Superior Title Identification Badge */}
              <g transform="translate(930, 8)">
                <rect width="450" height="20" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" opacity="0.9" />
                <circle cx="16" cy="10" r="3.5" fill="#10b981" />
                <text x="28" y="14" fill="#e2e8f0" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                  RACK SUPERIOR: MÓDULOS DE CONTROLE ELÉTRICO 24V CC (PELV)
                </text>
              </g>
            </g>

            {/* ==================================================== */}
            {/* 2. VIGA DIVISÓRIA ESTRUTURAL (SEPARAÇÃO RACK / PAINEL) */}
            {/* ==================================================== */}
            <g id="structural-divider">
              <rect x="0" y="222" width="1400" height="18" fill="#1e293b" stroke="#475569" strokeWidth="1" />
              <line x1="0" y1="224" x2="1400" y2="224" stroke="#64748b" strokeWidth="1" opacity="0.6" />
              <line x1="0" y1="238" x2="1400" y2="238" stroke="#090f1d" strokeWidth="1" />
              {/* Center plate */}
              <g transform="translate(560, 224)">
                <rect width="280" height="14" rx="3" fill="#090f1d" stroke="#334155" strokeWidth="1" />
                <text x="140" y="234" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                  DIVISOR ESTRUTURAL • BANCADA DIDÁTICA
                </text>
              </g>
            </g>

            {/* ==================================================== */}
            {/* 3. PAINEL RANHURADO DE PERFIL DE ALUMÍNIO (PNEUMÁTICA) */}
            {/* ==================================================== */}
            <g id="lower-pneumatic-panel">
              {/* Slotted Aluminum Profile Background */}
              <rect x="0" y="240" width="1400" height="610" fill="url(#aluminum-slats)" />

              {/* Guia de Montagem FRL + Distribuidor (à esquerda conforme a foto) */}
              <g transform="translate(25, 246)">
                <rect width="270" height="18" rx="3" fill="#090f1d" stroke="#0284c7" strokeWidth="1" opacity="0.85" />
                <text x="135" y="258" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                  SUPRIMENTO DE AR (FRL + DISTRIBUIDOR)
                </text>
              </g>

              {/* Placa de Identificação do Painel Ranhurado */}
              <g transform="translate(820, 824)">
                <rect width="560" height="18" rx="3" fill="#090f1d" stroke="#334155" strokeWidth="1" opacity="0.85" />
                <text x="280" y="836" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                  PAINEL DE PERFIL DE ALUMÍNIO RANHURADO (VÁLVULAS, SENSORES E ATUADORES)
                </text>
              </g>
            </g>

            {/* Workbench External Frame Border */}
            <rect x="0" y="0" width="1400" height="850" fill="none" stroke="#334155" strokeWidth="4" />

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

                return (
                  <g
                    key={comp.id}
                    id={`comp-${comp.id}`}
                    transform={`translate(${comp.x}, ${comp.y}) rotate(${rotation}, ${cx}, ${cy})`}
                    onMouseDown={(e) => {
                      handleComponentMouseDown(comp, e);
                      onSelectComponent(comp);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(comp);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(comp);
                      setIsParamsOpen(true);
                    }}
                    className="cursor-move group"
                  >
                    <title>{`${comp.name} (${comp.tag}) • Rotação: ${rotation}° • Clique para selecionar / Duplo clique para Parâmetros Técnicos`}</title>
                    
                    {/* Active Selection Outline & Angle Badge */}
                    {isSelected && (
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
                    <rect
                      x="2"
                      y="4"
                      width={comp.width}
                      height={comp.height}
                      rx="10"
                      fill="#000000"
                      opacity="0.5"
                    />

                    {/* Component Metal Chassis */}
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

                    {/* Rack Fixation Screws (Módulos elétricos aparafusados no rack superior conforme a foto) */}
                    {isElectrical && (
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
                    {!isElectrical && (
                      <g>
                        <rect x={comp.width / 2 - 16} y={comp.height - 2} width="32" height="5" rx="2" fill="#0284c7" stroke="#0369a1" strokeWidth="0.8" />
                        <circle cx={comp.width / 2} cy={comp.height + 0.5} r="1.5" fill="#ffffff" />
                      </g>
                    )}

                    {/* Top Anodized Header Bar */}
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

                    {/* Component Title */}
                    <text
                      x="52"
                      y="18"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {comp.type === 'power_supply_24v' ? 'Fonte 24V' : (comp.name.length > 18 ? comp.name.substring(0, 17) + '…' : comp.name)}
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
                      const pistonX = barrelX + 16 + (strokePct / 100) * 105;
                      
                      // External chrome rod extending OUTSIDE the cylinder rectangle (comp.width = 250)
                      // When stroke is 0%, rod tip sphere extends 25px outside comp.width (at X = 275)
                      // When stroke is 100%, rod tip sphere extends 225px outside comp.width (at X = 475, 200mm stroke - Haste e curso dobrados para facilitar posicionamento dos sensores)
                      const rodTipX = comp.width + 25 + (strokePct / 100) * 200;
                      const rodStartY = 53;
                      const rodHeight = 14;
                      const centerY = 60;
                      const isNearSensor = comp.state.sensorDetected || (strokePct <= 6 || strokePct >= 94);

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
                          {/* ------------------------------------------------------------- */}
                          <g transform={`translate(${comp.width}, 0)`}>
                            {/* Slotted Aluminum Extension Profile Rail - Dobro do espaço para os sensores */}
                            <rect x="0" y="88" width="255" height="14" rx="2" fill="#090f1d" stroke="#334155" strokeWidth="1" />
                            <line x1="0" y1="95" x2="255" y2="95" stroke="#475569" strokeWidth="2" strokeDasharray="8 3" />
                            
                            {/* T-Slot Fixation markings for proximity sensors */}
                            <text x="127" y="84" fill="#38bdf8" fontSize="7.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              TRILHO PARA SENSORES (CURSO 200mm)
                            </text>
                            <line x1="25" y1="88" x2="25" y2="102" stroke="#38bdf8" strokeWidth="1.5" />
                            <text x="25" y="112" fill="#94a3b8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              0mm (1S1)
                            </text>
                            <line x1="125" y1="88" x2="125" y2="98" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="125" y="112" fill="#64748b" fontSize="6.5" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              100mm
                            </text>
                            <line x1="225" y1="88" x2="225" y2="102" stroke="#38bdf8" strokeWidth="1.5" />
                            <text x="225" y="112" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              200mm (1S2)
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

                          {/* Magnetic Induction Halo when sphere actuates proximity sensors */}
                          {isNearSensor && (
                            <g>
                              <circle cx={rodTipX} cy={centerY} r="18" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                              <circle cx={rodTipX} cy={centerY} r="25" fill="url(#actuator-sphere-glow)" opacity="0.8" />
                              <circle cx={rodTipX} cy={centerY} r="32" fill="none" stroke="#0284c7" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.5" />
                            </g>
                          )}

                          {/* The Precision Metallic Actuator Sphere (Esfera Atuadora Metálica Ø20mm) */}
                          <circle cx={rodTipX} cy={centerY} r="10" fill="url(#actuator-sphere-grad)" stroke="#94a3b8" strokeWidth="1.2" />
                          {/* Specular curved highlight */}
                          <circle cx={rodTipX - 3} cy={centerY - 3} r="3" fill="#ffffff" opacity="0.85" />
                          <ellipse cx={rodTipX + 2} cy={centerY + 5} rx="4" ry="1.5" fill="#334155" opacity="0.5" />

                          {/* Sphere Callout / Tag */}
                          <g transform={`translate(${rodTipX}, ${centerY - 16})`}>
                            <text x="0" y="0" fill={isNearSensor ? "#38bdf8" : "#94a3b8"} fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                              ESFERA Ø20
                            </text>
                          </g>

                          {/* Internal Stroke display inside component card */}
                          <text x="70" y="24" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono'">
                            CURSO: {strokePct.toFixed(0)}% ({((strokePct / 100) * 200).toFixed(0)}mm)
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
                      const pistonX = barrelX + 14 + (strokePct / 100) * 80;
                      
                      // External chrome rod extending OUTSIDE cylinder rectangle (dobrado de 75 para 150px)
                      const rodTipX = comp.width + 20 + (strokePct / 100) * 150;
                      const isNearSensor = comp.state.sensorDetected || (strokePct <= 6 || strokePct >= 94);

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

                          {/* External Sensor Fixation Rail */}
                          <g transform={`translate(${comp.width}, 0)`}>
                            <rect x="0" y="74" width="190" height="12" rx="2" fill="#090f1d" stroke="#334155" strokeWidth="1" />
                            <line x1="0" y1="80" x2="190" y2="80" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 2" />
                            <line x1="20" y1="74" x2="20" y2="86" stroke="#38bdf8" strokeWidth="1.2" />
                            <text x="20" y="94" fill="#94a3b8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">0mm</text>
                            <line x1="95" y1="74" x2="95" y2="84" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                            <text x="95" y="94" fill="#64748b" fontSize="6" fontFamily="'JetBrains Mono'" textAnchor="middle">50mm</text>
                            <line x1="170" y1="74" x2="170" y2="86" stroke="#38bdf8" strokeWidth="1.2" />
                            <text x="170" y="94" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">100mm</text>
                          </g>

                          {/* Esfera Atuadora Metálica na ponta da haste */}
                          <rect x={rodTipX - 12} y={centerY - 6} width="5" height="12" rx="1" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                          {isNearSensor && (
                            <g>
                              <circle cx={rodTipX} cy={centerY} r="16" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                              <circle cx={rodTipX} cy={centerY} r="22" fill="url(#actuator-sphere-glow)" opacity="0.8" />
                            </g>
                          )}
                          <circle cx={rodTipX} cy={centerY} r="9" fill="url(#actuator-sphere-grad)" stroke="#94a3b8" strokeWidth="1.2" />
                          <circle cx={rodTipX - 2.5} cy={centerY - 2.5} r="2.5" fill="#ffffff" opacity="0.85" />
                          <text x={rodTipX} y={centerY - 14} fill={isNearSensor ? "#38bdf8" : "#94a3b8"} fontSize="6" fontWeight="bold" fontFamily="'JetBrains Mono'" textAnchor="middle">
                            ESFERA Ø18
                          </text>

                          <text x="60" y="20" fill="#38bdf8" fontSize="8.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
                            CURSO: {strokePct.toFixed(0)}% ({((strokePct / 100) * 100).toFixed(0)}mm)
                          </text>
                        </g>
                      );
                    })()}

                    {/* 3. FRL UNIT */}
                    {comp.type === 'frl_unit' && (
                      <g transform="translate(14, 34)">
                        {/* Horizontal distribution block linking inlet and outlet */}
                        <rect x="4" y="90" width="104" height="18" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
                        <line x1="8" y1="99" x2="104" y2="99" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="3 3" />

                        {/* Filter Bowl */}
                        <rect x="12" y="45" width="36" height="52" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        <line x1="30" y1="48" x2="30" y2="90" stroke="#38bdf8" strokeWidth="2" />
                        {/* Water level trap */}
                        <path d="M 16 85 Q 30 80 44 85 L 44 95 L 16 95 Z" fill="#0284c7" opacity="0.6" />
                        
                        {/* Pressure Gauge Dial */}
                        <circle cx="70" cy="35" r="26" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                        <circle cx="70" cy="35" r="22" fill="#1e293b" />
                        {/* Dial marks */}
                        <text x="70" y="28" fill="#94a3b8" fontSize="7" textAnchor="middle" fontFamily="'JetBrains Mono'">BAR</text>
                        <text x="70" y="44" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                          {(comp.state.pressureP || 6.0).toFixed(1)}
                        </text>
                        {/* Dial Needle */}
                        <line x1="70" y1="35" x2="80" y2="24" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                      </g>
                    )}

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

                    {/* 5. PUSH BUTTON STATION */}
                    {comp.type === 'push_button_station' && (
                      <g transform="translate(20, 36)">
                        {/* Green Button NA (13-14) */}
                        <g
                          transform="translate(10, 5)"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NA');
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NA');
                          }}
                          className="cursor-pointer hover:brightness-110"
                        >
                          <circle cx="16" cy="16" r="14" fill="#065f46" stroke="#10b981" strokeWidth="2" />
                          <circle cx="16" cy="16" r="10" fill={comp.state.buttonNApressed ? '#34d399' : '#10b981'} />
                          <text x="40" y="20" fill="#e2e8f0" fontSize="10" fontWeight="bold">S1 (NA)</text>
                        </g>

                        {/* Red Button NF (11-12) */}
                        <g
                          transform="translate(10, 50)"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onPressButton(comp.id, 'NF');
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            onReleaseButton(comp.id, 'NF');
                          }}
                          className="cursor-pointer hover:brightness-110"
                        >
                          <circle cx="16" cy="16" r="14" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2" />
                          <circle cx="16" cy="16" r="10" fill={comp.state.buttonNFpressed ? '#f87171' : '#ef4444'} />
                          <text x="40" y="20" fill="#e2e8f0" fontSize="10" fontWeight="bold">S0 (NF)</text>
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
                          {/* SENSOR CILÍNDRICO METÁLICO (M18) CONFORME FOTO */}

                          {/* 1. Face Sensora Ativa na Lateral Esquerda com a cor selecionada */}
                          <g id="sensor-sensing-face">
                            {/* Protruding Plastic Sensing Head */}
                            <rect
                              x="4"
                              y="36"
                              width="16"
                              height="28"
                              rx="3"
                              fill={techConfig.faceColor}
                              stroke={techConfig.faceStroke}
                              strokeWidth="1.2"
                            />
                            {/* Front face rim chamfer */}
                            <rect
                              x="3"
                              y="38"
                              width="4"
                              height="24"
                              rx="2"
                              fill={isActuated ? '#ffffff' : techConfig.faceColor}
                              opacity={isActuated ? 0.95 : 0.7}
                            />

                            {/* Marcação Exata do CENTRO DA FACE INDICADA (Ponto de Atuação) */}
                            <g transform="translate(13, 50)">
                              {/* Alvo concêntrico de centro */}
                              <circle
                                cx="0"
                                cy="0"
                                r="5.5"
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="1"
                                strokeDasharray={isActuated ? undefined : "2 2"}
                                opacity="0.9"
                              />
                              <circle
                                cx="0"
                                cy="0"
                                r="2"
                                fill={isActuated ? "#fbbf24" : "#ffffff"}
                              />

                              {/* Atuação e irradiação no centro da face indicada */}
                              {isActuated && (
                                <g>
                                  <circle cx="0" cy="0" r="14" fill="none" stroke={techConfig.faceColor} strokeWidth="1.5" className="animate-ping" opacity="0.8" />
                                  <circle cx="0" cy="0" r="20" fill={techConfig.glowColor} />
                                  <line x1="-5" y1="0" x2="-22" y2="0" stroke={techConfig.faceColor} strokeWidth="2" strokeDasharray="3 2" />
                                  <circle cx="-22" cy="0" r="3" fill={techConfig.faceColor} />
                                </g>
                              )}
                            </g>

                            {/* Indicador visual de Face Ativa */}
                            <text
                              x="13"
                              y="29"
                              fill={techConfig.accent}
                              fontSize="6"
                              fontWeight="900"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              FACE ATIVA
                            </text>
                          </g>

                          {/* 2. Corpo Cilíndrico Metálico Roscado (M18 Barrel) */}
                          <g id="sensor-threaded-barrel">
                            {/* Base metálica com gradiente niquelado */}
                            <rect
                              x="20"
                              y="38"
                              width="92"
                              height="24"
                              rx="2"
                              fill="#64748b"
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            {/* Linhas de rosca fina milimétrica (M18) */}
                            {[23, 27, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108].map(rx => (
                              <line
                                key={rx}
                                x1={rx}
                                y1="38.5"
                                x2={rx}
                                y2="61.5"
                                stroke="#94a3b8"
                                strokeWidth="1"
                                opacity="0.75"
                              />
                            ))}

                            {/* Porca Sextavada Dianteira (Hex Lock Nut 1) */}
                            <rect
                              x="31"
                              y="31"
                              width="12"
                              height="38"
                              rx="2"
                              fill="#94a3b8"
                              stroke="#475569"
                              strokeWidth="1.2"
                            />
                            <line x1="37" y1="31" x2="37" y2="69" stroke="#cbd5e1" strokeWidth="1" />
                            
                            {/* Arruela de pressão metálica (Washer) */}
                            <rect
                              x="43"
                              y="30"
                              width="3.5"
                              height="40"
                              rx="1"
                              fill="#64748b"
                              stroke="#334155"
                              strokeWidth="0.8"
                            />

                            {/* Porca Sextavada Traseira (Hex Lock Nut 2) */}
                            <rect
                              x="46.5"
                              y="31"
                              width="12"
                              height="38"
                              rx="2"
                              fill="#94a3b8"
                              stroke="#475569"
                              strokeWidth="1.2"
                            />
                            <line x1="52.5" y1="31" x2="52.5" y2="69" stroke="#cbd5e1" strokeWidth="1" />

                            {/* Etiqueta Técnica Gravada no Corpo do Sensor */}
                            {/* Requisito: Escrito Indutivo, Capacitivo, Magnético e Óptico em seu corpo */}
                            {/* e sua identificação deverá continuar sendo exemplo 1S1, 1S2... */}
                            <rect
                              x="62"
                              y="40"
                              width="42"
                              height="20"
                              rx="2"
                              fill="#f8fafc"
                              stroke="#94a3b8"
                              strokeWidth="0.8"
                            />
                            {/* Identificação (ex: 1S1, 1S2) */}
                            <text
                              x="83"
                              y="48.5"
                              fill="#0f172a"
                              fontSize="8"
                              fontWeight="900"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {comp.tag}
                            </text>
                            {/* Tipo por extenso escrito no corpo: Indutivo / Capacitivo / Magnético / Óptico */}
                            <text
                              x="83"
                              y="56.5"
                              fill={techConfig.faceStroke}
                              fontSize="6.5"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {techConfig.name}
                            </text>

                            {/* LED de Atuação Traseiro (Amarelo Âmbar industrial) */}
                            <circle
                              cx="107"
                              cy="43"
                              r="3"
                              fill={isActuated ? '#f59e0b' : '#334155'}
                              stroke={isActuated ? '#fbbf24' : '#1e293b'}
                              strokeWidth="0.8"
                            />
                            {isActuated && (
                              <circle cx="107" cy="43" r="6" fill="#f59e0b" opacity="0.6" className="animate-pulse" />
                            )}

                            {/* LED de Alimentação (PWR OK / SEM PWR) */}
                            <circle
                              cx="107"
                              cy="57"
                              r="2.5"
                              fill={isPowerOk ? '#10b981' : '#ef4444'}
                            />
                            <text
                              x="107"
                              y="69"
                              fill={isPowerOk ? '#34d399' : '#f87171'}
                              fontSize="5.5"
                              fontWeight="bold"
                              fontFamily="'JetBrains Mono'"
                              textAnchor="middle"
                            >
                              {isPowerOk ? 'PWR' : '!PWR'}
                            </text>

                            {/* Prensa-cabo / Strain relief azul na saída traseira (igual à foto) */}
                            <rect
                              x="112"
                              y="44"
                              width="10"
                              height="12"
                              rx="2"
                              fill="#0284c7"
                              stroke="#0369a1"
                              strokeWidth="1"
                            />
                          </g>

                          {/* 3. Pedaço de Cabo Preto Flexível saindo do sensor */}
                          <g id="sensor-cable-grommet">
                            {/* Cabo preto emborrachado curvando suavemente */}
                            <path
                              d="M 122 50 C 136 50, 144 50, 158 50"
                              fill="none"
                              stroke="#0f172a"
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M 122 50 C 136 50, 144 50, 158 50"
                              fill="none"
                              stroke="#334155"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            {/* Luva termorretrátil de terminação do cabo principal */}
                            <rect x="154" y="45" width="6" height="10" rx="1.5" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
                          </g>

                          {/* 4. Chicote de Fios Individuais Coloridos com Círculos de Conexão */}
                          <g id="sensor-wire-leads">
                            {wires === '3_wires' && (
                              <g>
                                {/* Fio Marrom (BN: +24V) */}
                                <path
                                  d="M 158 50 C 170 50, 178 24, 194 24"
                                  fill="none"
                                  stroke="#92400e"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 158 50 C 170 50, 178 24, 194 24"
                                  fill="none"
                                  stroke="#b45309"
                                  strokeWidth="1"
                                  strokeLinecap="round"
                                />
                                {/* Círculo identificado pelo fio: BN */}
                                <circle cx="194" cy="24" r="8.5" fill="#451a03" stroke="#92400e" strokeWidth="2" />
                                <circle cx="194" cy="24" r="4.5" fill="#78350f" />
                                <text x="178" y="16" fill="#fbbf24" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">
                                  BN (+24V)
                                </text>

                                {/* Fio Preto (BK: Sinal NA) */}
                                <path
                                  d="M 158 50 L 194 50"
                                  fill="none"
                                  stroke="#0f172a"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 158 50 L 194 50"
                                  fill="none"
                                  stroke="#475569"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                                {/* Círculo identificado pelo fio: BK */}
                                <circle cx="194" cy="50" r="8.5" fill="#020617" stroke="#475569" strokeWidth="2" />
                                <circle cx="194" cy="50" r="4.5" fill="#1e293b" />
                                <text x="178" y="42" fill="#e2e8f0" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">
                                  BK (Sinal)
                                </text>

                                {/* Fio Azul (BU: 0V) */}
                                <path
                                  d="M 158 50 C 170 50, 178 76, 194 76"
                                  fill="none"
                                  stroke="#1d4ed8"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 158 50 C 170 50, 178 76, 194 76"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="1"
                                  strokeLinecap="round"
                                />
                                {/* Círculo identificado pelo fio: BU */}
                                <circle cx="194" cy="76" r="8.5" fill="#172554" stroke="#2563eb" strokeWidth="2" />
                                <circle cx="194" cy="76" r="4.5" fill="#1e40af" />
                                <text x="178" y="93" fill="#93c5fd" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">
                                  BU (0V)
                                </text>
                              </g>
                            )}

                            {wires === '4_wires' && (
                              <g>
                                {/* Fio Marrom (BN) */}
                                <path d="M 158 50 C 170 50, 178 18, 194 18" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="194" cy="18" r="8" fill="#451a03" stroke="#92400e" strokeWidth="2" />
                                <text x="176" y="11" fill="#fbbf24" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">BN (+24V)</text>

                                {/* Fio Branco (WH - Sinal NF) */}
                                <path d="M 158 50 C 172 50, 178 39, 194 39" fill="none" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="194" cy="39" r="8" fill="#334155" stroke="#f8fafc" strokeWidth="2" />
                                <text x="176" y="32" fill="#ffffff" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">WH (NF)</text>

                                {/* Fio Preto (BK - Sinal NA) */}
                                <path d="M 158 50 C 172 50, 178 61, 194 61" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
                                <circle cx="194" cy="61" r="8" fill="#020617" stroke="#475569" strokeWidth="2" />
                                <text x="176" y="54" fill="#e2e8f0" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">BK (NA)</text>

                                {/* Fio Azul (BU - 0V) */}
                                <path d="M 158 50 C 170 50, 178 82, 194 82" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="194" cy="82" r="8" fill="#172554" stroke="#2563eb" strokeWidth="2" />
                                <text x="176" y="97" fill="#93c5fd" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">BU (0V)</text>
                              </g>
                            )}

                            {wires === '2_wires' && (
                              <g>
                                {/* Fio Marrom (BN - L+) */}
                                <path d="M 158 50 C 170 50, 178 34, 194 34" fill="none" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round" />
                                <circle cx="194" cy="34" r="8.5" fill="#451a03" stroke="#92400e" strokeWidth="2" />
                                <text x="176" y="25" fill="#fbbf24" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">BN (+24V)</text>

                                {/* Fio Azul (BU - Sinal/Carga) */}
                                <path d="M 158 50 C 170 50, 178 66, 194 66" fill="none" stroke="#1d4ed8" strokeWidth="3.5" strokeLinecap="round" />
                                <circle cx="194" cy="66" r="8.5" fill="#172554" stroke="#2563eb" strokeWidth="2" />
                                <text x="176" y="82" fill="#93c5fd" fontSize="7" fontWeight="bold" fontFamily="'JetBrains Mono'">BU (Sinal/0V)</text>
                              </g>
                            )}
                          </g>

                          {/* Aviso se desconectado da alimentação */}
                          {!isPowerOk && (
                            <g transform="translate(60, 74)">
                              <rect x="0" y="0" width="70" height="11" rx="2" fill="#7f1d1d" opacity="0.9" />
                              <text x="35" y="8" fill="#fecaca" fontSize="5.8" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
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
                      const px = (comp.width * port.x) / 100;
                      const py = (comp.height * port.y) / 100;
                      const isPneumatic = port.type === 'pneumatic';
                      const isTarget = connectingStart && connectingStart.port.type === port.type;
                      const isGround = port.functionType === 'ground_0v' || port.name.includes('0V');

                      // Check if port is connected
                      const isConnected = connections.some(
                        (c) =>
                          (c.fromComponentId === comp.id && c.fromPortId === port.id) ||
                          (c.toComponentId === comp.id && c.toPortId === port.id)
                      );

                      const labelText = port.name.split(' ')[0];
                      const isBottom = py > comp.height / 2;
                      const textY = isBottom ? -13 : 18;

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

                          {/* Outer Metallic / Plastic Ring (Orifício Circular de Entrada/Saída) */}
                          {isPneumatic ? (
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
                                r="8.5"
                                fill="#0f172a"
                                stroke={isGround ? '#1e3a8a' : '#ef4444'}
                                strokeWidth="2.5"
                                className="transition-colors group-hover/port:stroke-white"
                              />
                              {/* Bucha metálica niquelada de contato interno */}
                              <circle
                                r="5"
                                fill="#090d16"
                                stroke="#fbbf24"
                                strokeWidth="1"
                              />
                              {/* Orifício central do borne 4mm */}
                              <circle
                                r="2.8"
                                fill={isConnected ? (isGround ? '#172554' : '#ef4444') : '#020617'}
                              />
                            </g>
                          )}

                          {/* Port Technical Label Badge (Oculto em sensores para manter o chicote limpo com etiquetas embutidas) */}
                          {comp.type !== 'reed_switch_sensor' && (
                            <g transform={`translate(0, ${textY})`}>
                              <rect
                                x={-(labelText.length * 3.8 + 5)}
                                y="-7"
                                width={labelText.length * 7.6 + 10}
                                height="13"
                                rx="3"
                                fill="#090f1d"
                                stroke={isPneumatic ? '#0284c7' : isGround ? '#1e3a8a' : '#dc2626'}
                                strokeWidth="0.8"
                                opacity="0.9"
                              />
                              <text
                                x="0"
                                y="2.5"
                                fill={isPneumatic ? '#38bdf8' : isGround ? '#93c5fd' : '#fca5a5'}
                                fontSize="7.5"
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
              {connections.map((conn) => {
                const coords = getConnectionCoordinates(conn);
                if (!coords) return null;
                const { x1, y1, x2, y2 } = coords;

                const isPneumatic = conn.type === 'pneumatic';
                const isHovered = hoveredConnectionId === conn.id;

                // Bezier curve calculations for natural hose gravity sag
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const sag = Math.min(105, Math.max(25, dist * 0.22));

                const cx1 = x1 + dx * 0.3;
                const cy1 = y1 + sag;
                const cx2 = x2 - dx * 0.3;
                const cy2 = y2 + sag;

                const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

                // Color based on type and pressure/voltage
                let strokeColor = '#0284c7'; // Festo Blue PU hose
                let highlightColor = '#38bdf8';
                let strokeWidth = isPneumatic ? 5.5 : 4;
                let isGroundWire = false;

                if (!isPneumatic) {
                  isGroundWire = 
                    coords.sourcePort?.functionType === 'ground_0v' ||
                    coords.targetPort?.functionType === 'ground_0v' ||
                    coords.sourcePort?.name.includes('0V') ||
                    coords.targetPort?.name.includes('0V') ||
                    conn.fromPortId.includes('0V') ||
                    conn.toPortId.includes('0V');
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
                  >
                    {/* Outer glow / hit area for easy hover and click */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                    />

                    {/* Shadow underneath */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={strokeWidth + 3}
                      opacity={0.35}
                      transform="translate(1.5, 3.5)"
                    />

                    {/* Main hose / wire body */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      filter={conn.active && isSimulating ? 'url(#hose-glow)' : undefined}
                      className={isHovered ? 'brightness-125' : ''}
                    />

                    {/* Glossy highlight along tube / wire to simulate polyurethane sheen */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={highlightColor}
                      strokeWidth={strokeWidth * 0.35}
                      strokeLinecap="round"
                      opacity={0.75}
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
                        className="animate-[dash_1s_linear_infinite]"
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

                    {/* Delete Connection Tooltip Button at midpoint */}
                    {isHovered && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 + sag * 0.7})`}>
                        <circle r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        <text
                          x="0"
                          y="4"
                          fill="#ffffff"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          onClick={(e) => handleDeleteConnection(conn.id, e)}
                          className="cursor-pointer"
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
