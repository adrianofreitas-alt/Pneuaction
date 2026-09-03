import React, { useState, useRef } from 'react';
import { 
  BenchComponent, 
  VirtualConnection, 
  ComponentPort,
  PortType 
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
  AlertTriangle
} from 'lucide-react';
import { benchAudio } from '../utils/audioSynthesizer';

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
      onUpdateComponents(
        components.map((c) => {
          if (c.id === draggingCompId) {
            return {
              ...c,
              x: Math.max(10, Math.min(1300 - c.width, Math.round((x - dragOffset.x) / 10) * 10)),
              y: Math.max(10, Math.min(750 - c.height, Math.round((y - dragOffset.y) / 10) * 10)),
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

  // Start dragging component
  const handleComponentMouseDown = (comp: BenchComponent, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    if (connectingStart) return;

    onSelectComponent(comp);
    setDraggingCompId(comp.id);
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Calculate coordinates for connection bezier path
  const getConnectionCoordinates = (conn: VirtualConnection) => {
    const sourceComp = components.find((c) => c.id === conn.fromComponentId);
    const targetComp = components.find((c) => c.id === conn.toComponentId);
    if (!sourceComp || !targetComp) return null;

    const sourcePort = sourceComp.ports.find((p) => p.id === conn.fromPortId);
    const targetPort = targetComp.ports.find((p) => p.id === conn.toPortId);
    if (!sourcePort || !targetPort) return null;

    const x1 = sourceComp.x + (sourceComp.width * sourcePort.x) / 100;
    const y1 = sourceComp.y + (sourceComp.height * sourcePort.y) / 100;
    const x2 = targetComp.x + (targetComp.width * targetPort.x) / 100;
    const y2 = targetComp.y + (targetComp.height * targetPort.y) / 100;

    return { x1, y1, x2, y2, sourceComp, targetComp, sourcePort, targetPort };
  };

  // Filter templates
  const filteredTemplates = COMPONENT_TEMPLATES.filter((tpl) => {
    if (selectedCategory === 'all') return true;
    return tpl.category === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-950">
      {/* Left Sidebar: Component Catalog & Bench Palette */}
      <aside className="w-full lg:w-72 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0 z-10 max-h-60 lg:max-h-full">
        {/* Palette Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Catálogo de Componentes
            </h2>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {filteredTemplates.length} itens
          </span>
        </div>

        {/* Categories Bar */}
        <div className="p-2 border-b border-slate-800 flex gap-1 overflow-x-auto text-[11px] no-scrollbar">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'supply', label: 'Alimentação' },
            { id: 'actuators', label: 'Atuadores' },
            { id: 'valves', label: 'Válvulas' },
            { id: 'flow_logic', label: 'Fluxo/Lógica' },
            { id: 'electrical', label: 'Elétrica' },
            { id: 'sensors', label: 'Sensores' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition ${
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
                  className="p-1.5 rounded-md bg-slate-700/80 group-hover:bg-cyan-600 text-slate-300 group-hover:text-white transition shrink-0"
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
          <span>Clique em um orifício e arraste até outro para conectar mangueiras ou fios.</span>
        </div>
      </aside>

      {/* Center: Aluminum Workbench Canvas */}
      <main className="flex-1 relative flex flex-col bg-[#0b101b] overflow-hidden">
        {/* Canvas Toolbar overlay */}
        <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold text-slate-200">Bancada Didática DIN 35</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {components.length} módulos instalados
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            {connections.length} conexões ativas
          </span>
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
            <span className="text-slate-300">Mangueira Pneumática (PU 6mm)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-rose-500 rounded-sm" />
            <span className="text-slate-300">Cabo Elétrico (+24V Vermelho)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-blue-700 rounded-sm" />
            <span className="text-slate-300">Cabo Elétrico (0V Azul)</span>
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
            }}
          >
            <defs>
              {/* Aluminum Extrusion T-Slot Pattern */}
              <pattern id="aluminum-slats" width="50" height="50" patternUnits="userSpaceOnUse">
                <rect width="50" height="50" fill="#0f172a" />
                <rect x="0" y="0" width="50" height="46" fill="#141e33" />
                {/* Horizontal T-Slot groove */}
                <line x1="0" y1="48" x2="50" y2="48" stroke="#090d16" strokeWidth="3" />
                <line x1="0" y1="49" x2="50" y2="49" stroke="#1e293b" strokeWidth="1" />
                {/* Vertical DIN rail markers */}
                <line x1="25" y1="0" x2="25" y2="50" stroke="#1c2841" strokeWidth="1" strokeDasharray="4 4" />
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
            </defs>

            {/* Aluminum Workbench Background */}
            <rect width="100%" height="100%" fill="url(#aluminum-slats)" />

            {/* Workbench Edge Frames */}
            <rect x="0" y="0" width="1400" height="850" fill="none" stroke="#334155" strokeWidth="4" />

            {/* Top pneumatic manifold supply rail */}
            <line x1="30" y1="20" x2="1370" y2="20" stroke="#0284c7" strokeWidth="3" opacity="0.3" />
            <line x1="30" y1="28" x2="1370" y2="28" stroke="#e11d48" strokeWidth="2" opacity="0.3" />

            {/* ---------------------------------------------------- */}
            {/* CONNECTIONS LAYER (Hoses & Wires) */}
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
                const sag = Math.min(100, Math.max(25, dist * 0.22));

                const cx1 = x1 + dx * 0.3;
                const cy1 = y1 + sag;
                const cx2 = x2 - dx * 0.3;
                const cy2 = y2 + sag;

                const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

                // Color based on type and pressure/voltage
                let strokeColor = '#38bdf8'; // Blue PU hose
                let strokeWidth = isPneumatic ? 5 : 3.5;
                if (!isPneumatic) {
                  strokeColor = conn.fromPortId.includes('0V') || conn.toPortId.includes('0V') 
                    ? '#2563eb' 
                    : '#ef4444';
                }

                return (
                  <g
                    key={conn.id}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredConnectionId(conn.id)}
                    onMouseLeave={() => setHoveredConnectionId(null)}
                  >
                    {/* Outer glow / hit area */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                    />

                    {/* Shadow underneath */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={strokeWidth + 2}
                      opacity={0.4}
                      transform="translate(1, 3)"
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

                    {/* Animated flow dash if simulating */}
                    {isSimulating && conn.active && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isPneumatic ? '#bae6fd' : '#fef08a'}
                        strokeWidth={strokeWidth * 0.45}
                        strokeDasharray={isPneumatic ? '6 12' : '4 8'}
                        strokeLinecap="round"
                        className="animate-[dash_1s_linear_infinite]"
                      />
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
                  const x1 = comp.x + (comp.width * connectingStart.port.x) / 100;
                  const y1 = comp.y + (comp.height * connectingStart.port.y) / 100;
                  const x2 = mousePos.x;
                  const y2 = mousePos.y;

                  const dx = x2 - x1;
                  const sag = Math.min(80, Math.max(20, Math.abs(dx) * 0.2));
                  const pathD = `M ${x1} ${y1} C ${x1 + dx * 0.3} ${y1 + sag}, ${x2 - dx * 0.3} ${y2 + sag}, ${x2} ${y2}`;

                  const strokeColor = connectingStart.port.type === 'pneumatic' ? '#0ea5e9' : '#f43f5e';

                  return (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={4}
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                      className="animate-pulse pointer-events-none"
                    />
                  );
                })()
              )}
            </g>

            {/* ---------------------------------------------------- */}
            {/* COMPONENTS LAYER */}
            {/* ---------------------------------------------------- */}
            <g id="components-layer">
              {components.map((comp) => {
                const isSelected = selectedComponent?.id === comp.id;

                return (
                  <g
                    key={comp.id}
                    transform={`translate(${comp.x}, ${comp.y})`}
                    onMouseDown={(e) => handleComponentMouseDown(comp, e)}
                    className="cursor-move group"
                  >
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
                      rx="10"
                      fill="#1e293b"
                      stroke={isSelected ? '#38bdf8' : comp.faults?.isLeaking || comp.faults?.isCoilBurned ? '#ef4444' : '#334155'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      className="transition-colors"
                    />

                    {/* Top Anodized Header Bar */}
                    <rect
                      x="0"
                      y="0"
                      width={comp.width}
                      height="28"
                      rx="10"
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
                      {comp.type === 'power_supply_24v' ? 'Fonte' : (comp.name.length > 20 ? comp.name.substring(0, 19) + '…' : comp.name)}
                    </text>

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
                    {comp.type === 'double_acting_cylinder' && (
                      <g transform="translate(18, 38)">
                        {/* Cylinder Barrel */}
                        <rect x="0" y="8" width="130" height="52" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                        
                        {/* Piston Stroke (Dynamic position 0 to 100%) */}
                        {(() => {
                          const strokePct = comp.state.position || 0;
                          const pistonX = 8 + (strokePct / 100) * 80;
                          const rodWidth = 40 + (strokePct / 100) * 80;

                          return (
                            <g>
                              {/* Chrome Rod */}
                              <rect x={pistonX + 16} y="26" width={rodWidth} height="16" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                              
                              {/* Magnetic Piston Head */}
                              <rect x={pistonX} y="11" width="16" height="46" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                              
                              {/* Magnet Core */}
                              <rect x={pistonX + 4} y="16" width="8" height="36" fill="#ef4444" />
                              
                              {/* Rod tip clevis */}
                              <circle cx={pistonX + 16 + rodWidth + 4} cy="34" r="7" fill="#64748b" stroke="#94a3b8" strokeWidth="1.5" />
                            </g>
                          );
                        })()}

                        {/* Stroke Ruler */}
                        <line x1="0" y1="68" x2="130" y2="68" stroke="#334155" strokeWidth="1" />
                        <text x="0" y="78" fill="#64748b" fontSize="8" fontFamily="'JetBrains Mono'">0mm</text>
                        <text x="105" y="78" fill="#64748b" fontSize="8" fontFamily="'JetBrains Mono'">100mm</text>
                        <text x="160" y="38" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono'">
                          {(comp.state.position || 0).toFixed(0)}%
                        </text>
                      </g>
                    )}

                    {/* 2. SINGLE ACTING CYLINDER */}
                    {comp.type === 'single_acting_cylinder' && (
                      <g transform="translate(18, 38)">
                        <rect x="0" y="8" width="110" height="44" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                        
                        {/* Internal Spring */}
                        <path d="M 60 30 L 70 20 L 80 40 L 90 20 L 100 40 L 105 30" fill="none" stroke="#64748b" strokeWidth="1.5" />
                        
                        {/* Piston & Rod */}
                        {(() => {
                          const strokePct = comp.state.position || 0;
                          const px = 8 + (strokePct / 100) * 60;
                          return (
                            <g>
                              <rect x={px + 14} y="24" width={30 + (strokePct / 100) * 50} height="12" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                              <rect x={px} y="11" width="14" height="38" rx="2" fill="#0284c7" />
                            </g>
                          );
                        })()}
                        <text x="145" y="34" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono'">
                          {(comp.state.position || 0).toFixed(0)}%
                        </text>
                      </g>
                    )}

                    {/* 3. FRL UNIT */}
                    {comp.type === 'frl_unit' && (
                      <g transform="translate(16, 38)">
                        {/* Filter Bowl */}
                        <rect x="10" y="55" width="36" height="60" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        <line x1="28" y1="58" x2="28" y2="105" stroke="#38bdf8" strokeWidth="2" />
                        
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

                    {/* 4. 5/2 WAY VALVE */}
                    {(comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') && (
                      <g transform="translate(12, 38)">
                        {/* Valve Body Outline */}
                        <rect x="25" y="10" width="145" height="62" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        
                        {/* Left/Right Spool Position Highlight */}
                        <rect
                          x={comp.state.valvePosition === 'left' ? 28 : 98}
                          y="13"
                          width="68"
                          height="56"
                          rx="3"
                          fill="#0284c7"
                          opacity="0.25"
                        />

                        {/* ISO 1219 Spool Arrows */}
                        <g stroke="#94a3b8" strokeWidth="1.5" fill="none">
                          {/* Box 1 (Left): 1->4 and 2->3 */}
                          <line x1="45" y1="62" x2="45" y2="20" markerEnd="url(#arrow-flow)" />
                          <line x1="80" y1="20" x2="80" y2="62" markerEnd="url(#arrow-flow)" />

                          {/* Box 2 (Right): 1->2 and 4->5 */}
                          <line x1="115" y1="62" x2="150" y2="20" />
                          <line x1="150" y1="20" x2="115" y2="62" />
                        </g>

                        {/* Solenoid Coil status LEDs */}
                        <g transform="translate(4, 25)">
                          <rect width="16" height="32" rx="2" fill="#334155" />
                          <circle cx="8" cy="16" r="4" fill={comp.state.solenoidLeftActive ? '#10b981' : '#64748b'} />
                          <text x="8" y="38" fill="#94a3b8" fontSize="8" textAnchor="middle">Y1</text>
                        </g>

                        {comp.type === 'valve_5_2_double_solenoid' && (
                          <g transform="translate(176, 25)">
                            <rect width="16" height="32" rx="2" fill="#334155" />
                            <circle cx="8" cy="16" r="4" fill={comp.state.solenoidRightActive ? '#10b981' : '#64748b'} />
                            <text x="8" y="38" fill="#94a3b8" fontSize="8" textAnchor="middle">Y2</text>
                          </g>
                        )}

                        {/* Manual override button */}
                        <g
                          transform="translate(85, 78)"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTriggerManualOverride(comp.id);
                          }}
                          className="cursor-pointer hover:brightness-125"
                        >
                          <rect width="26" height="14" rx="3" fill="#f59e0b" />
                          <text x="13" y="10" fill="#000000" fontSize="8" fontWeight="bold" textAnchor="middle">MAN</text>
                        </g>
                      </g>
                    )}

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

                    {/* 7. REED SWITCH SENSOR */}
                    {comp.type === 'reed_switch_sensor' && (
                      <g transform="translate(15, 30)">
                        <rect x="0" y="8" width="80" height="24" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        {/* Indicator LED */}
                        <circle cx="16" cy="20" r="4" fill={comp.state.sensorDetected ? '#e11d48' : '#334155'} />
                        <text x="26" y="23" fill="#cbd5e1" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono'">
                          {comp.state.detectionPosition === 0 ? 'REC (0%)' : 'AV (100%)'}
                        </text>
                      </g>
                    )}

                    {/* 8. POWER SUPPLY 24V (FONTE COM CHAVE LIGA/DESLIGA, 5x 24V E 5x 0V) */}
                    {comp.type === 'power_supply_24v' && (() => {
                      const isPowered = comp.state.activated !== false;
                      return (
                        <g transform="translate(8, 34)">
                          {/* Brushed metal interior chassis plate */}
                          <rect x="0" y="0" width="194" height="168" rx="6" fill="#090d16" stroke="#334155" strokeWidth="1" />

                          {/* Section 1: Digital Voltmeter + Interactive Rocker Switch (Liga / Desliga) */}
                          {/* Voltmeter Display */}
                          <rect x="6" y="6" width="92" height="44" rx="4" fill="#020617" stroke="#1e293b" strokeWidth="1.5" />
                          <text
                            x="52"
                            y="28"
                            fill={isPowered ? "#38bdf8" : "#475569"}
                            fontSize="17"
                            fontWeight="bold"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            letterSpacing="0.5"
                          >
                            {isPowered ? "24.0 V" : "0.0 V"}
                          </text>
                          <rect x="14" y="34" width="76" height="12" rx="2" fill={isPowered ? "#0369a1" : "#1e293b"} />
                          <text
                            x="52"
                            y="43"
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
                              y="6"
                              width="84"
                              height="44"
                              rx="5"
                              fill="#0b1120"
                              stroke={isPowered ? "#10b981" : "#ef4444"}
                              strokeWidth="1.5"
                              className="transition-colors group-hover/switch:stroke-sky-400"
                            />
                            {/* Rocker frame */}
                            <rect x="108" y="10" width="76" height="24" rx="3" fill="#1e293b" />
                            
                            {isPowered ? (
                              <g>
                                {/* Active I (Liga) */}
                                <rect x="110" y="12" width="36" height="20" rx="2" fill="#10b981" />
                                <text x="128" y="27" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">I</text>
                                <text x="166" y="27" fill="#64748b" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">O</text>
                                {/* Status LED */}
                                <circle cx="118" cy="42" r="3" fill="#10b981" />
                                <circle cx="118" cy="42" r="5" fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.6" className="animate-pulse" />
                                <text x="126" y="45" fill="#34d399" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono'">LIGADA</text>
                              </g>
                            ) : (
                              <g>
                                {/* Active O (Desliga) */}
                                <rect x="146" y="12" width="36" height="20" rx="2" fill="#ef4444" />
                                <text x="128" y="27" fill="#64748b" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">I</text>
                                <text x="164" y="27" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">O</text>
                                {/* Status LED */}
                                <circle cx="118" cy="42" r="3" fill="#64748b" />
                                <text x="126" y="45" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono'">DESLIGADA</text>
                              </g>
                            )}
                          </g>

                          {/* Section 2: Barramento +24V (5 conexões elétricas com indicação 24V) */}
                          <g transform="translate(6, 56)">
                            <rect x="0" y="0" width="182" height="48" rx="4" fill="#1c1917" stroke="#7f1d1d" strokeWidth="1" />
                            <rect x="0" y="0" width="182" height="13" rx="3" fill="#7f1d1d" />
                            <text x="8" y="10" fill="#fecaca" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono'">
                              5x SAÍDAS: 24V CC
                            </text>
                            <text x="174" y="10" fill="#fca5a5" fontSize="7" fontWeight="bold" textAnchor="end" fontFamily="'JetBrains Mono'">
                              ALIMENTAÇÃO [+]
                            </text>
                            {/* Visual guide labels under the 5 knobs */}
                            {[20, 58, 97, 136, 174].map((tx, idx) => (
                              <text key={idx} x={tx} y="44" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                                24V
                              </text>
                            ))}
                          </g>

                          {/* Section 3: Barramento 0V (5 conexões elétricas com indicação 0V) */}
                          <g transform="translate(6, 110)">
                            <rect x="0" y="0" width="182" height="48" rx="4" fill="#082f49" stroke="#0369a1" strokeWidth="1" />
                            <rect x="0" y="0" width="182" height="13" rx="3" fill="#075985" />
                            <text x="8" y="10" fill="#bae6fd" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono'">
                              5x RETORNOS: 0V GND
                            </text>
                            <text x="174" y="10" fill="#93c5fd" fontSize="7" fontWeight="bold" textAnchor="end" fontFamily="'JetBrains Mono'">
                              COMUM [-]
                            </text>
                            {/* Visual guide labels under the 5 knobs */}
                            {[20, 58, 97, 136, 174].map((tx, idx) => (
                              <text key={idx} x={tx} y="44" fill="#38bdf8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
                                0V
                              </text>
                            ))}
                          </g>
                        </g>
                      );
                    })()}

                    {/* ------------------------------------------------ */}
                    {/* PORTS RENDERING (Connection Knobs) */}
                    {/* ------------------------------------------------ */}
                    {comp.ports.map((port) => {
                      const px = (comp.width * port.x) / 100;
                      const py = (comp.height * port.y) / 100;
                      const isPneumatic = port.type === 'pneumatic';
                      const isTarget = connectingStart && connectingStart.port.type === port.type;
                      const isGround = port.functionType === 'ground_0v' || port.name.includes('0V');

                      return (
                        <g
                          key={port.id}
                          transform={`translate(${px}, ${py})`}
                          onClick={(e) => handlePortClick(comp, port, e)}
                          onMouseEnter={() => setHoveredPort(port)}
                          onMouseLeave={() => setHoveredPort(null)}
                          className="cursor-pointer group/port"
                        >
                          {/* Hover highlight circle */}
                          <circle
                            r="11"
                            fill="transparent"
                            stroke={isTarget ? '#38bdf8' : '#ffffff'}
                            strokeWidth={isTarget ? 2 : 0}
                            className="group-hover/port:stroke-white group-hover/port:stroke-1"
                          />

                          {/* Outer Brass / Nylon Fitting / Banana Socket */}
                          <circle
                            r="6.5"
                            fill="#0f172a"
                            stroke={isPneumatic ? '#0284c7' : isGround ? '#2563eb' : '#e11d48'}
                            strokeWidth="2.5"
                          />

                          {/* Inner Hole */}
                          <circle
                            r="2.5"
                            fill={isPneumatic ? '#38bdf8' : isGround ? '#60a5fa' : '#fda4af'}
                          />

                          {/* Port Technical Label */}
                          <text
                            x="0"
                            y={py > comp.height / 2 ? -10 : 16}
                            fill={isGround ? '#93c5fd' : isPneumatic ? '#94a3b8' : '#fca5a5'}
                            fontSize="8"
                            fontWeight="700"
                            fontFamily="'JetBrains Mono', monospace"
                            textAnchor="middle"
                            className="pointer-events-none"
                          >
                            {port.name.split(' ')[0]}
                          </text>
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
          </svg>
        </div>
      </main>

      {/* Right Sidebar: Selected Component Properties & Physical Tweaks */}
      {selectedComponent && (
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
                onClick={() => onSelectComponent(null)}
                className="text-slate-400 hover:text-white"
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
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          Conexões 0V (GND):
                        </span>
                        <span className="font-mono font-bold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800 text-blue-200">
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

              {/* Health and Cycles Info */}
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Saúde do Componente:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedComponent.state.healthPercent || 98}%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onDeleteComponent(selectedComponent.id)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 font-semibold text-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remover da Bancada</span>
          </button>
        </aside>
      )}
    </div>
  );
};
