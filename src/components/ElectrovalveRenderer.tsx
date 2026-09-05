import React, { useState } from 'react';
import { BenchComponent } from '../types';

interface ElectrovalveRendererProps {
  comp: BenchComponent;
  onTriggerManualOverride: (componentId: string) => void;
  isSimulating?: boolean;
}

export const ElectrovalveRenderer: React.FC<ElectrovalveRendererProps> = ({
  comp,
  onTriggerManualOverride,
}) => {
  const isDouble = comp.type === 'valve_5_2_double_solenoid';
  const isLeftPos = comp.state.valvePosition === 'left'; // Pos 2 (Energizada): 1->4 & 2->3
  const y1Active = !!comp.state.solenoidLeftActive;
  const y2Active = !!comp.state.solenoidRightActive;
  const isManual = !!comp.state.manualOverride;

  // View mode: default is true (Glass cutaway transparent mode as requested)
  const [showGlassCutaway, setShowGlassCutaway] = useState<boolean>(
    comp.state.transparentGlassMode !== false
  );

  // Spool physical shift in pixels:
  // Pos 1 (right / desenergizada): spool shifted left (-14px)
  // Pos 2 (left / energizada): spool shifted right (+14px)
  const spoolShift = isLeftPos ? 14 : -14;

  // Spring compression factor (for single solenoid spring return)
  // Pos 1: relaxed (longer coils)
  // Pos 2: compressed (tighter coils)
  const springCoils = isLeftPos ? 7 : 5;
  const springWidth = isLeftPos ? 16 : 28;

  const modelName = isDouble ? '4V220-06' : '4V210-06';
  const valveTypeLabel = isDouble ? '5/2 BI-ESTÁVEL' : '5/2 MONO-ESTÁVEL';

  return (
    <g id={`electrovalve-${comp.id}`} className="select-none">
      {/* ------------------------------------------------------------------- */}
      {/* SVG DEFINITIONS & GRADIENTS                                         */}
      {/* ------------------------------------------------------------------- */}
      <defs>
        {/* Aluminum Machined Body Texture */}
        <linearGradient id={`alu-body-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="25%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="75%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>

        {/* Polished Chrome Spool */}
        <linearGradient id={`spool-metal-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="30%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="85%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Glass Reflection Gradient */}
        <linearGradient id={`glass-shine-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="25%" stopColor="#bae6fd" stopOpacity="0.12" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="75%" stopColor="#0284c7" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.22" />
        </linearGradient>

        {/* High-Pressure Air Flow Gradient (P -> Red/Orange) */}
        <linearGradient id={`flow-pressure-${comp.id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0.9" />
        </linearGradient>

        {/* Exhaust Air Flow Gradient (Exhaust -> Blue/Cyan) */}
        <linearGradient id={`flow-exhaust-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.75" />
        </linearGradient>

        {/* Solenoid Coil Dark Resin Gradient */}
        <linearGradient id={`coil-resin-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="20%" stopColor="#1e293b" />
          <stop offset="60%" stopColor="#334155" />
          <stop offset="85%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>

        {/* Transparent Polycarbonate DIN Plug Glass */}
        <linearGradient id={`din-glass-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.5" />
          <stop offset="40%" stopColor="#94a3b8" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#cbd5e1" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.3" />
        </linearGradient>

        {/* Glow filter for active solenoid & LED */}
        <filter id={`led-glow-${comp.id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ------------------------------------------------------------------- */}
      {/* 1. CENTRAL INDUSTRIAL ALUMINUM VALVE BODY (CARCAÇA PRINCIPAL)       */}
      {/* ------------------------------------------------------------------- */}
      <g id="valve-chassis">
        {/* Drop shadow / mounting plate backer */}
        <rect
          x="54"
          y="42"
          width="142"
          height="86"
          rx="5"
          fill="#090d16"
          opacity="0.5"
        />

        {/* Solid Machined Aluminum Block */}
        <rect
          x="54"
          y="44"
          width="142"
          height="82"
          rx="4"
          fill={`url(#alu-body-${comp.id})`}
          stroke="#475569"
          strokeWidth="1.2"
        />

        {/* Chamfered edge lines on aluminum body */}
        <line x1="56" y1="46" x2="194" y2="46" stroke="#f1f5f9" strokeWidth="1" opacity="0.8" />
        <line x1="56" y1="124" x2="194" y2="124" stroke="#334155" strokeWidth="1.2" />

        {/* 4 Corner Mounting Holes with hex socket screws */}
        {[
          { cx: 62, cy: 52 },
          { cx: 188, cy: 52 },
          { cx: 62, cy: 118 },
          { cx: 188, cy: 118 },
        ].map((hole, i) => (
          <g key={`bolt-${i}`} transform={`translate(${hole.cx}, ${hole.cy})`}>
            <circle cx="0" cy="0" r="3.8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" />
            <polygon points="-1.8,-1 0,-2.2 1.8,-1 1.8,1 0,2.2 -1.8,1" fill="#475569" />
          </g>
        ))}

        {/* Technical Nameplate Label (Model, Pressure, ISO symbol) */}
        <g id="valve-nameplate" transform="translate(68, 48)">
          <rect x="0" y="0" width="114" height="12" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
          <text
            x="6"
            y="9"
            fill="#38bdf8"
            fontSize="6.5"
            fontWeight="bold"
            fontFamily="'JetBrains Mono', monospace"
          >
            MODEL: {modelName}
          </text>
          <text
            x="76"
            y="9"
            fill="#94a3b8"
            fontSize="5.8"
            fontFamily="'JetBrains Mono', monospace"
          >
            0.15-0.8 MPa
          </text>
        </g>
      </g>

      {/* ------------------------------------------------------------------- */}
      {/* 2. PNEUMATIC PORTS (ROSCAS METÁLICAS COM IDENTIFICAÇÃO)            */}
      {/* ------------------------------------------------------------------- */}
      {/* Top Ports: 4 (A) at left, 2 (B) at right */}
      <g id="pneumatic-ports-top">
        {/* Port 4 (A) - Saída para avanço */}
        <g transform="translate(95, 22)">
          {/* External threaded fitting collar */}
          <rect x="-11" y="8" width="22" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <rect x="-9" y="10" width="18" height="10" rx="1" fill="#475569" />
          <circle cx="0" cy="8" r="8.5" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="0" cy="8" r="6" fill="#0f172a" />
          <circle cx="0" cy="8" r="3.5" fill={isLeftPos ? '#ef4444' : '#38bdf8'} />
          <text x="0" y="-1" fill="#38bdf8" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
            4 (A)
          </text>
          <text x="0" y="6" fill="#94a3b8" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            G1/8"
          </text>
        </g>

        {/* Port 2 (B) - Saída para recuo */}
        <g transform="translate(155, 22)">
          <rect x="-11" y="8" width="22" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <rect x="-9" y="10" width="18" height="10" rx="1" fill="#475569" />
          <circle cx="0" cy="8" r="8.5" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="0" cy="8" r="6" fill="#0f172a" />
          <circle cx="0" cy="8" r="3.5" fill={!isLeftPos ? '#ef4444' : '#38bdf8'} />
          <text x="0" y="-1" fill="#38bdf8" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
            2 (B)
          </text>
          <text x="0" y="6" fill="#94a3b8" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            G1/8"
          </text>
        </g>
      </g>

      {/* Bottom Ports: 5 (R), 1 (P), 3 (S) */}
      <g id="pneumatic-ports-bottom">
        {/* Port 5 (R) - Escape da câmara A */}
        <g transform="translate(75, 126)">
          <rect x="-10" y="0" width="20" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <circle cx="0" cy="14" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="0" cy="14" r="5.5" fill="#0f172a" />
          {/* Silenciador de bronze sinterizado / escape */}
          <rect x="-5" y="11" width="10" height="6" rx="1" fill="#b45309" opacity="0.8" />
          <text x="0" y="27" fill="#94a3b8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            5 (R)
          </text>
        </g>

        {/* Port 1 (P) - Entrada de Ar Comprimido Principal */}
        <g transform="translate(125, 126)">
          <rect x="-12" y="0" width="24" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <circle cx="0" cy="14" r="9.5" fill="#1e293b" stroke="#ef4444" strokeWidth="1.8" />
          <circle cx="0" cy="14" r="6.5" fill="#0f172a" />
          <circle cx="0" cy="14" r="4" fill="#ef4444" />
          <text x="0" y="27" fill="#ef4444" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
            1 (P)
          </text>
        </g>

        {/* Port 3 (S) - Escape da câmara B */}
        <g transform="translate(175, 126)">
          <rect x="-10" y="0" width="20" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <circle cx="0" cy="14" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="0" cy="14" r="5.5" fill="#0f172a" />
          <rect x="-5" y="11" width="10" height="6" rx="1" fill="#b45309" opacity="0.8" />
          <text x="0" y="27" fill="#94a3b8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            3 (S)
          </text>
        </g>
      </g>

      {/* ------------------------------------------------------------------- */}
      {/* 3. TRANSPARENT GLASS CUTAWAY BODY ("CORPO DE VIDRO TRANSPARENTE")   */}
      {/* ------------------------------------------------------------------- */}
      {showGlassCutaway ? (
        <g id="glass-cutaway-view">
          {/* Glass Window Frame Chamfer */}
          <rect
            x="58"
            y="62"
            width="134"
            height="58"
            rx="5"
            fill="#020617"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="none"
          />

          {/* Precision Machined Bore Background Corridor */}
          <rect
            x="60"
            y="70"
            width="130"
            height="42"
            rx="3"
            fill="#090d16"
          />

          {/* Vertical Gallery Ports connecting Bore to Exterior */}
          {/* Port 4 Gallery (Top Left) */}
          <rect x="91" y="62" width="8" height="12" fill={isLeftPos ? 'url(#flow-pressure-' + comp.id + ')' : 'url(#flow-exhaust-' + comp.id + ')'} opacity="0.85" />
          {/* Port 2 Gallery (Top Right) */}
          <rect x="151" y="62" width="8" height="12" fill={!isLeftPos ? 'url(#flow-pressure-' + comp.id + ')' : 'url(#flow-exhaust-' + comp.id + ')'} opacity="0.85" />
          {/* Port 5 Gallery (Bottom Left) */}
          <rect x="71" y="106" width="8" height="14" fill={!isLeftPos ? 'url(#flow-exhaust-' + comp.id + ')' : '#1e293b'} opacity={!isLeftPos ? 0.85 : 0.4} />
          {/* Port 1 Gallery (Bottom Center) - Always supply */}
          <rect x="121" y="106" width="8" height="14" fill={`url(#flow-pressure-${comp.id})`} opacity="0.9" />
          {/* Port 3 Gallery (Bottom Right) */}
          <rect x="171" y="106" width="8" height="14" fill={isLeftPos ? 'url(#flow-exhaust-' + comp.id + ')' : '#1e293b'} opacity={isLeftPos ? 0.85 : 0.4} />

          {/* DYNAMIC AIR FLOW PATHS INSIDE CHAMBER (Real-time dynamic fluidics) */}
          {isLeftPos ? (
            // POSIÇÃO 2 (ENERGIZADA):
            // 1 conecta em 4 (Pressão: vermelho / subindo)
            // 2 conecta em 3 (Escape: azul / descendo)
            // 5 está bloqueado
            <g id="fluid-channels-pos2">
              {/* Pressurized air from 1 (x=125, y=110) flowing into 4 (x=95, y=66) */}
              <path
                d="M 125 110 L 125 91 Q 125 78 110 78 L 100 78 Q 95 78 95 64"
                fill="none"
                stroke={`url(#flow-pressure-${comp.id})`}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Animated pressure arrows flowing 1 -> 4 */}
              <circle cx="125" cy="100" r="2.5" fill="#ffffff" />
              <polygon points="95,64 91,72 99,72" fill="#fef08a" />

              {/* Exhaust air from 2 (x=155, y=64) flowing down into 3 (x=175, y=110) */}
              <path
                d="M 155 64 L 155 82 Q 155 94 165 94 L 170 94 Q 175 94 175 110"
                fill="none"
                stroke={`url(#flow-exhaust-${comp.id})`}
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.8"
              />
              <polygon points="175,110 171,102 179,102" fill="#38bdf8" />

              {/* Port 5 Blocked indicator */}
              <g transform="translate(75, 96)">
                <circle cx="0" cy="0" r="4.5" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1" />
                <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#ffffff" strokeWidth="1" />
                <line x1="2.5" y1="-2.5" x2="-2.5" y2="2.5" stroke="#ffffff" strokeWidth="1" />
              </g>
            </g>
          ) : (
            // POSIÇÃO 1 (DESENERGIZADA):
            // 1 conecta em 2 (Pressão: vermelho / subindo)
            // 4 conecta em 5 (Escape: azul / descendo)
            // 3 está bloqueado
            <g id="fluid-channels-pos1">
              {/* Pressurized air from 1 (x=125, y=110) flowing into 2 (x=155, y=64) */}
              <path
                d="M 125 110 L 125 91 Q 125 78 140 78 L 150 78 Q 155 78 155 64"
                fill="none"
                stroke={`url(#flow-pressure-${comp.id})`}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.85"
              />
              <circle cx="125" cy="100" r="2.5" fill="#ffffff" />
              <polygon points="155,64 151,72 159,72" fill="#fef08a" />

              {/* Exhaust air from 4 (x=95, y=64) flowing down into 5 (x=75, y=110) */}
              <path
                d="M 95 64 L 95 82 Q 95 94 85 94 L 80 94 Q 75 94 75 110"
                fill="none"
                stroke={`url(#flow-exhaust-${comp.id})`}
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.8"
              />
              <polygon points="75,110 71,102 79,102" fill="#38bdf8" />

              {/* Port 3 Blocked indicator */}
              <g transform="translate(175, 96)">
                <circle cx="0" cy="0" r="4.5" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1" />
                <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#ffffff" strokeWidth="1" />
                <line x1="2.5" y1="-2.5" x2="-2.5" y2="2.5" stroke="#ffffff" strokeWidth="1" />
              </g>
            </g>
          )}

          {/* --------------------------------------------------------------- */}
          {/* MOVING SPOOL ASSEMBLY (CARRETEL DESLIZANTE COM 3 ÊMBOLOS)       */}
          {/* --------------------------------------------------------------- */}
          <g
            id="internal-moving-spool"
            transform={`translate(${spoolShift}, 0)`}
            className="transition-transform duration-300 ease-out"
          >
            {/* Polished Chrome Central Shaft */}
            <rect
              x="62"
              y="88"
              width="126"
              height="6"
              rx="2"
              fill={`url(#spool-metal-${comp.id})`}
              stroke="#334155"
              strokeWidth="0.8"
            />

            {/* Êmbolo 1 (Left Piston Land) */}
            <g transform="translate(74, 72)">
              <rect x="0" y="0" width="15" height="38" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1" />
              {/* O-Ring Seals (Anéis de Vedação) */}
              <rect x="2" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              <rect x="10" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              {/* Metallic highlight */}
              <line x1="7.5" y1="2" x2="7.5" y2="36" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Êmbolo 2 (Center Piston Land) */}
            <g transform="translate(118, 72)">
              <rect x="0" y="0" width="15" height="38" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1" />
              <rect x="2" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              <rect x="10" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              <line x1="7.5" y1="2" x2="7.5" y2="36" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Êmbolo 3 (Right Piston Land) */}
            <g transform="translate(162, 72)">
              <rect x="0" y="0" width="15" height="38" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1" />
              <rect x="2" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              <rect x="10" y="0" width="3" height="38" rx="1" fill="#0f172a" />
              <line x1="7.5" y1="2" x2="7.5" y2="36" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Left Solenoid Push Rod (Induzido / Haste de contato Y1) */}
            <rect x="52" y="89" width="12" height="4" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="0.5" />

            {/* Right Actuator Push Rod / Spring guide */}
            <rect x="186" y="89" width="10" height="4" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="0.5" />
          </g>

          {/* Mechanical Return Spring (for 5/2 Single Solenoid Monoestável) */}
          {!isDouble && (
            <g id="helical-return-spring" transform="translate(182, 91)">
              {/* Helical wire coils that physically compress/expand */}
              <path
                d={
                  isLeftPos
                    ? "M 0 0 L 2 -10 L 5 10 L 8 -10 L 11 10 L 14 -10 L 16 0"
                    : "M 0 0 L 5 -12 L 10 12 L 15 -12 L 20 12 L 25 -12 L 28 0"
                }
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
              <circle cx={isLeftPos ? 16 : 28} cy="0" r="3" fill="#64748b" />
            </g>
          )}

          {/* Front Glass Layer: Specular Refraction & Shine Effect */}
          <rect
            x="58"
            y="62"
            width="134"
            height="58"
            rx="5"
            fill={`url(#glass-shine-${comp.id})`}
            pointerEvents="none"
          />

          {/* Top highlight line of the glass window */}
          <line x1="62" y1="64" x2="188" y2="64" stroke="#ffffff" strokeWidth="1.2" opacity="0.75" />
          <line x1="62" y1="118" x2="188" y2="118" stroke="#38bdf8" strokeWidth="0.8" opacity="0.5" />

          {/* Real-time status badge inside the glass */}
          <g transform="translate(125, 114)">
            <rect
              x="-60"
              y="0"
              width="120"
              height="11"
              rx="2.5"
              fill="#0f172a"
              stroke={isLeftPos ? '#f59e0b' : '#38bdf8'}
              strokeWidth="0.8"
              opacity="0.95"
            />
            <text
              x="0"
              y="8"
              fill={isLeftPos ? '#fcd34d' : '#bae6fd'}
              fontSize="6"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {isLeftPos
                ? 'POSIÇÃO 2: ENERGIZADA (1→4 / 2→3)'
                : 'POSIÇÃO 1: NORMAL MOLA (1→2 / 4→5)'}
            </text>
          </g>
        </g>
      ) : (
        /* Solid Industrial Shell Mode with Inspection Window */
        <g id="solid-chassis-view">
          <rect x="62" y="66" width="126" height="50" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          {/* ISO 1219 Valve Schematic Stamp */}
          <g transform="translate(85, 74)">
            <rect x="0" y="0" width="38" height="34" fill="#0f172a" stroke="#475569" strokeWidth="1" />
            <rect x="38" y="0" width="38" height="34" fill="#0f172a" stroke="#475569" strokeWidth="1" />
            {/* Box 1 (1->4 & 2->3) */}
            <line x1="12" y1="28" x2="12" y2="6" stroke="#38bdf8" strokeWidth="1.2" />
            <line x1="26" y1="6" x2="26" y2="28" stroke="#38bdf8" strokeWidth="1.2" />
            {/* Box 2 (1->2 & 4->5) */}
            <line x1="48" y1="28" x2="66" y2="6" stroke="#94a3b8" strokeWidth="1.2" />
            <line x1="66" y1="28" x2="48" y2="6" stroke="#94a3b8" strokeWidth="1.2" />
          </g>
          <text x="125" y="114" fill="#94a3b8" fontSize="6.5" textAnchor="middle" fontFamily="'JetBrains Mono'">
            CARCAÇA BLINDADA IP65
          </text>
        </g>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. SOLENOID ASSEMBLY Y1 (ESQUERDA - MODELO 4V220 / 4V210)          */}
      {/* ------------------------------------------------------------------- */}
      <g id="solenoid-y1" transform="translate(8, 20)">
        {/* Knurled Thumb Retaining Nut (Porca serrilhada traseira) */}
        <rect x="-4" y="52" width="10" height="34" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <line x1="-1" y1="54" x2="-1" y2="84" stroke="#64748b" strokeWidth="0.8" />
        <line x1="2" y1="54" x2="2" y2="84" stroke="#64748b" strokeWidth="0.8" />

        {/* Black Molded Coil Body (Corpo da Bobina) */}
        <rect
          x="6"
          y="42"
          width="40"
          height="54"
          rx="4"
          fill={`url(#coil-resin-${comp.id})`}
          stroke="#334155"
          strokeWidth="1.2"
        />

        {/* Coil Technical Stamp */}
        <g transform="translate(26, 60)">
          <text x="0" y="0" fill="#f8fafc" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            Y1
          </text>
          <text x="0" y="8" fill="#94a3b8" fontSize="5" textAnchor="middle" fontFamily="'JetBrains Mono'">
            24V DC 4.8W
          </text>
          <text x="0" y="15" fill="#64748b" fontSize="4.5" textAnchor="middle" fontFamily="'JetBrains Mono'">
            100% ED IP65
          </text>
          <text x="0" y="24" fill="#94a3b8" fontSize="5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            CE
          </text>
        </g>

        {/* Active Electromagnetic Flux Aura (Glow when energized) */}
        {y1Active && (
          <g filter={`url(#led-glow-${comp.id})`}>
            <rect x="6" y="42" width="40" height="54" rx="4" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8" />
            <line x1="8" y1="56" x2="44" y2="56" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 2" />
            <line x1="8" y1="82" x2="44" y2="82" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 2" />
          </g>
        )}

        {/* Transparent Polycarbonate DIN 43650 Connector Plug (Conector transparente) */}
        <g id="din-plug-y1" transform="translate(8, 0)">
          {/* Cable Gland (Prensa-cabo branco/creme) */}
          <rect x="-8" y="10" width="10" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
          <line x1="-5" y1="11" x2="-5" y2="23" stroke="#cbd5e1" strokeWidth="1" />

          {/* Translucent Plug Case */}
          <rect
            x="2"
            y="2"
            width="34"
            height="40"
            rx="3"
            fill={`url(#din-glass-${comp.id})`}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          {/* Central Screw (Parafuso central de fixação) */}
          <circle cx="19" cy="18" r="4.5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          <line x1="16.5" y1="18" x2="21.5" y2="18" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="19" y1="15.5" x2="19" y2="20.5" stroke="#e2e8f0" strokeWidth="1" />

          {/* Internal Brass Terminals */}
          <rect x="7" y="6" width="6" height="8" rx="1" fill="#d97706" />
          <rect x="7" y="26" width="6" height="8" rx="1" fill="#475569" />

          {/* DIN Plug Indicator LED */}
          <g transform="translate(28, 30)">
            <circle
              cx="0"
              cy="0"
              r="4"
              fill={y1Active ? '#22c55e' : '#334155'}
              stroke={y1Active ? '#86efac' : '#1e293b'}
              strokeWidth="1"
              filter={y1Active ? `url(#led-glow-${comp.id})` : undefined}
            />
            {y1Active && <circle cx="0" cy="0" r="1.5" fill="#ffffff" />}
          </g>

          {/* Terminal labels */}
          <text x="10" y="4" fill="#ef4444" fontSize="5.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
            +
          </text>
          <text x="10" y="38" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
            -
          </text>
        </g>
      </g>

      {/* ------------------------------------------------------------------- */}
      {/* 5. RIGHT ACTUATOR: SOLENOID Y2 OR SPRING HOUSING                   */}
      {/* ------------------------------------------------------------------- */}
      {isDouble ? (
        // DOUBLE SOLENOID Y2 (DIREITA)
        <g id="solenoid-y2" transform="translate(196, 20)">
          {/* Black Molded Coil Body */}
          <rect
            x="0"
            y="42"
            width="40"
            height="54"
            rx="4"
            fill={`url(#coil-resin-${comp.id})`}
            stroke="#334155"
            strokeWidth="1.2"
          />

          {/* Knurled Thumb Retaining Nut (Porca traseira) */}
          <rect x="40" y="52" width="10" height="34" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <line x1="43" y1="54" x2="43" y2="84" stroke="#64748b" strokeWidth="0.8" />
          <line x1="46" y1="54" x2="46" y2="84" stroke="#64748b" strokeWidth="0.8" />

          {/* Coil Technical Stamp */}
          <g transform="translate(20, 60)">
            <text x="0" y="0" fill="#f8fafc" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
              Y2
            </text>
            <text x="0" y="8" fill="#94a3b8" fontSize="5" textAnchor="middle" fontFamily="'JetBrains Mono'">
              24V DC 4.8W
            </text>
            <text x="0" y="15" fill="#64748b" fontSize="4.5" textAnchor="middle" fontFamily="'JetBrains Mono'">
              100% ED IP65
            </text>
            <text x="0" y="24" fill="#94a3b8" fontSize="5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
              CE
            </text>
          </g>

          {/* Active Electromagnetic Flux Aura for Y2 */}
          {y2Active && (
            <g filter={`url(#led-glow-${comp.id})`}>
              <rect x="0" y="42" width="40" height="54" rx="4" fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.8" />
              <line x1="2" y1="56" x2="38" y2="56" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="2" y1="82" x2="38" y2="82" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 2" />
            </g>
          )}

          {/* Transparent Polycarbonate DIN 43650 Connector Plug Y2 */}
          <g id="din-plug-y2" transform="translate(4, 0)">
            <rect
              x="0"
              y="2"
              width="34"
              height="40"
              rx="3"
              fill={`url(#din-glass-${comp.id})`}
              stroke="#94a3b8"
              strokeWidth="1.2"
            />
            {/* Cable Gland */}
            <rect x="34" y="10" width="10" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
            <line x1="37" y1="11" x2="37" y2="23" stroke="#cbd5e1" strokeWidth="1" />

            {/* Central Screw */}
            <circle cx="15" cy="18" r="4.5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
            <line x1="12.5" y1="18" x2="17.5" y2="18" stroke="#e2e8f0" strokeWidth="1" />
            <line x1="15" y1="15.5" x2="15" y2="20.5" stroke="#e2e8f0" strokeWidth="1" />

            {/* Terminals */}
            <rect x="21" y="6" width="6" height="8" rx="1" fill="#d97706" />
            <rect x="21" y="26" width="6" height="8" rx="1" fill="#475569" />

            {/* Indicator LED */}
            <g transform="translate(7, 30)">
              <circle
                cx="0"
                cy="0"
                r="4"
                fill={y2Active ? '#22c55e' : '#334155'}
                stroke={y2Active ? '#86efac' : '#1e293b'}
                strokeWidth="1"
                filter={y2Active ? `url(#led-glow-${comp.id})` : undefined}
              />
              {y2Active && <circle cx="0" cy="0" r="1.5" fill="#ffffff" />}
            </g>

            <text x="24" y="4" fill="#ef4444" fontSize="5.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
              +
            </text>
            <text x="24" y="38" fill="#38bdf8" fontSize="6.5" fontWeight="bold" fontFamily="'JetBrains Mono'">
              -
            </text>
          </g>
        </g>
      ) : (
        // SINGLE SOLENOID: SPRING RETURN HOUSING (TAMPA DA MOLA)
        <g id="spring-housing" transform="translate(196, 62)">
          <rect
            x="0"
            y="0"
            width="32"
            height="54"
            rx="4"
            fill={`url(#alu-body-${comp.id})`}
            stroke="#475569"
            strokeWidth="1.2"
          />
          {/* Spring Retaining Cap End-Plate */}
          <rect x="26" y="6" width="6" height="42" rx="1.5" fill="#334155" stroke="#64748b" strokeWidth="0.8" />
          <circle cx="29" cy="14" r="2" fill="#0f172a" />
          <circle cx="29" cy="40" r="2" fill="#0f172a" />
          {/* Internal Spring Graphic Icon on cap */}
          <path
            d="M 6 27 L 10 18 L 14 36 L 18 18 L 22 27"
            fill="none"
            stroke="#1e293b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text x="14" y="46" fill="#475569" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            MOLA
          </text>
        </g>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 6. MANUAL OVERRIDE BUTTONS (BOTOEIRAS MANUAIS AZUIS DA FOTO)        */}
      {/* ------------------------------------------------------------------- */}
      {/* Left Blue Manual Button (Pino azul de acionamento manual próximo a Y1) */}
      <g
        id="manual-override-btn-left"
        transform="translate(56, 75)"
        onClick={(e) => {
          e.stopPropagation();
          onTriggerManualOverride(comp.id);
        }}
        className="cursor-pointer hover:scale-110 transition-transform"
      >
        <title>Acionamento Manual Auxiliar (Clique para comutar a válvula)</title>
        {/* Brass collar ring */}
        <circle cx="0" cy="0" r="6.5" fill="#d97706" stroke="#92400e" strokeWidth="0.8" />
        {/* Blue push pin */}
        <circle
          cx="0"
          cy="0"
          r="4.8"
          fill={isManual || isLeftPos ? '#0284c7' : '#0ea5e9'}
          stroke="#ffffff"
          strokeWidth="1"
        />
        <circle cx="-1.5" cy="-1.5" r="1.5" fill="#bae6fd" />
        {/* MAN Label */}
        <text x="0" y="14" fill="#0284c7" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
          MAN
        </text>
      </g>

      {/* Right Blue Manual Button (for Double Solenoid) */}
      {isDouble && (
        <g
          id="manual-override-btn-right"
          transform="translate(194, 75)"
          onClick={(e) => {
            e.stopPropagation();
            onTriggerManualOverride(comp.id);
          }}
          className="cursor-pointer hover:scale-110 transition-transform"
        >
          <title>Acionamento Manual Auxiliar Y2 (Clique para comutar a válvula)</title>
          <circle cx="0" cy="0" r="6.5" fill="#d97706" stroke="#92400e" strokeWidth="0.8" />
          <circle
            cx="0"
            cy="0"
            r="4.8"
            fill={!isLeftPos ? '#0284c7' : '#0ea5e9'}
            stroke="#ffffff"
            strokeWidth="1"
          />
          <circle cx="-1.5" cy="-1.5" r="1.5" fill="#bae6fd" />
          <text x="0" y="14" fill="#0284c7" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
            MAN
          </text>
        </g>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 7. GLASS CUTAWAY TOGGLE BUTTON (Alternar Vidro Transparente)        */}
      {/* ------------------------------------------------------------------- */}
      <g
        id="toggle-glass-btn"
        transform="translate(125, 43)"
        onClick={(e) => {
          e.stopPropagation();
          setShowGlassCutaway(!showGlassCutaway);
        }}
        className="cursor-pointer hover:opacity-100 opacity-80"
      >
        <rect
          x="-36"
          y="-6"
          width="72"
          height="12"
          rx="3"
          fill={showGlassCutaway ? '#0369a1' : '#334155'}
          stroke="#38bdf8"
          strokeWidth="0.8"
        />
        <text
          x="0"
          y="2"
          fill="#ffffff"
          fontSize="5.5"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
        >
          {showGlassCutaway ? '🔍 CORPO DE VIDRO ATIVO' : '⚙️ VER INTERIOR (VIDRO)'}
        </text>
      </g>
    </g>
  );
};
