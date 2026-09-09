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
        <style>{`
          @keyframes airFlowDashPos2_${comp.id} {
            from { stroke-dashoffset: 24; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes airFlowDashPos1_${comp.id} {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 24; }
          }
          @keyframes ledPulse_${comp.id} {
            0%, 100% { opacity: 0.88; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }
          .animate-flow-dash-2-${comp.id} {
            animation: airFlowDashPos2_${comp.id} 0.65s linear infinite;
          }
          .animate-flow-dash-1-${comp.id} {
            animation: airFlowDashPos1_${comp.id} 0.65s linear infinite;
          }
        `}</style>

        {/* Aluminum Machined Body Texture */}
        <linearGradient id={`alu-body-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="20%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="80%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Polished Chrome Spool */}
        <linearGradient id={`spool-metal-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="75%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Ultra-Clear Laboratory Borosilicate Glass Gradient */}
        <linearGradient id={`glass-shine-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="20%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.08" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.18" />
        </linearGradient>

        {/* Internal Chamber Depth Gradient */}
        <linearGradient id={`chamber-depth-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#050811" />
          <stop offset="50%" stopColor="#0b1329" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>

        {/* High-Pressure Air Flow Gradient (P -> Red/Orange) */}
        <linearGradient id={`flow-pressure-${comp.id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ea580c" stopOpacity="0.88" />
          <stop offset="80%" stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0.95" />
        </linearGradient>

        {/* Exhaust Air Flow Gradient (Exhaust -> Blue/Cyan) */}
        <linearGradient id={`flow-exhaust-${comp.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#0284c7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#1e40af" stopOpacity="0.8" />
        </linearGradient>

        {/* Solenoid Coil Dark Resin Gradient */}
        <linearGradient id={`coil-resin-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#090d16" />
          <stop offset="15%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="85%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#050811" />
        </linearGradient>

        {/* Transparent Polycarbonate DIN Plug Glass */}
        <linearGradient id={`din-glass-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.6" />
          <stop offset="35%" stopColor="#94a3b8" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#cbd5e1" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#475569" stopOpacity="0.35" />
        </linearGradient>

        {/* Machined Brass Hex Body for Silencers & Fittings */}
        <linearGradient id={`brass-hex-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="25%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        {/* Sintered Bronze Porous Silencer Filter Element */}
        <linearGradient id={`sintered-bronze-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#78350f" />
          <stop offset="20%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="80%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>

        {/* Glow filter for active solenoid & LED */}
        <filter id={`led-glow-${comp.id}`} x="-40%" y="-40%" width="180%" height="180%">
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

      {/* Bottom Ports: 5 (S) com Silenciador de Bronze, 1 (P) Engate Rápido, 3 (R) com Silenciador de Bronze */}
      <g id="pneumatic-ports-bottom">
        {/* Port 5 (S) - Silenciador Pneumático de Bronze Sinterizado G1/8" (Escape da câmara A) */}
        <g transform="translate(75, 126)">
          <title>Silenciador Pneumático G1/8" em Bronze Sinterizado (Exaustão 5/S - NR-15)</title>
          {/* Base roscada no bloco da válvula */}
          <rect x="-9" y="0" width="18" height="6" rx="1.5" fill="#334155" stroke="#475569" strokeWidth="0.8" />
          {/* Corpo sextavado de latão industrial */}
          <rect x="-8" y="5" width="16" height="6" rx="1" fill={`url(#brass-hex-${comp.id})`} stroke="#78350f" strokeWidth="0.8" />
          <line x1="-4" y1="5" x2="-4" y2="11" stroke="#fef08a" strokeWidth="0.7" opacity="0.8" />
          <line x1="4" y1="5" x2="4" y2="11" stroke="#78350f" strokeWidth="0.7" opacity="0.8" />
          {/* Cartucho cônico de bronze sinterizado poroso */}
          <path
            d="M -7 11 L -5.5 25 Q 0 28 5.5 25 L 7 11 Z"
            fill={`url(#sintered-bronze-${comp.id})`}
            stroke="#78350f"
            strokeWidth="0.9"
          />
          {/* Ranhuras de difusão e textura de porosidade sinterizada */}
          <line x1="-5" y1="14" x2="5" y2="14" stroke="#fef08a" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.6" />
          <line x1="-5.5" y1="18" x2="5.5" y2="18" stroke="#451a03" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.8" />
          <line x1="-4.5" y1="22" x2="4.5" y2="22" stroke="#fef08a" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.5" />
          {/* Difusão de ar no escape quando ativo */}
          {!isLeftPos && (
            <g opacity="0.85">
              <line x1="-9" y1="18" x2="-13" y2="18" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
              <line x1="9" y1="18" x2="13" y2="18" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
              <line x1="0" y1="29" x2="0" y2="33" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
            </g>
          )}
          <text x="0" y="36" fill="#ca8a04" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            5 (S)
          </text>
        </g>

        {/* Port 1 (P) - Entrada de Ar Comprimido Principal (Engate Festo QS) */}
        <g transform="translate(125, 126)">
          <rect x="-12" y="0" width="24" height="14" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <circle cx="0" cy="14" r="9.5" fill="#1e293b" stroke="#ef4444" strokeWidth="1.8" />
          <circle cx="0" cy="14" r="6.5" fill="#0f172a" />
          <circle cx="0" cy="14" r="4" fill="#ef4444" />
          <text x="0" y="28" fill="#ef4444" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="'JetBrains Mono'">
            1 (P)
          </text>
        </g>

        {/* Port 3 (R) - Silenciador Pneumático de Bronze Sinterizado G1/8" (Escape da câmara B) */}
        <g transform="translate(175, 126)">
          <title>Silenciador Pneumático G1/8" em Bronze Sinterizado (Exaustão 3/R - NR-15)</title>
          {/* Base roscada no bloco da válvula */}
          <rect x="-9" y="0" width="18" height="6" rx="1.5" fill="#334155" stroke="#475569" strokeWidth="0.8" />
          {/* Corpo sextavado de latão industrial */}
          <rect x="-8" y="5" width="16" height="6" rx="1" fill={`url(#brass-hex-${comp.id})`} stroke="#78350f" strokeWidth="0.8" />
          <line x1="-4" y1="5" x2="-4" y2="11" stroke="#fef08a" strokeWidth="0.7" opacity="0.8" />
          <line x1="4" y1="5" x2="4" y2="11" stroke="#78350f" strokeWidth="0.7" opacity="0.8" />
          {/* Cartucho cônico de bronze sinterizado poroso */}
          <path
            d="M -7 11 L -5.5 25 Q 0 28 5.5 25 L 7 11 Z"
            fill={`url(#sintered-bronze-${comp.id})`}
            stroke="#78350f"
            strokeWidth="0.9"
          />
          {/* Ranhuras de difusão e textura de porosidade sinterizada */}
          <line x1="-5" y1="14" x2="5" y2="14" stroke="#fef08a" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.6" />
          <line x1="-5.5" y1="18" x2="5.5" y2="18" stroke="#451a03" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.8" />
          <line x1="-4.5" y1="22" x2="4.5" y2="22" stroke="#fef08a" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.5" />
          {/* Difusão de ar no escape quando ativo */}
          {isLeftPos && (
            <g opacity="0.85">
              <line x1="-9" y1="18" x2="-13" y2="18" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
              <line x1="9" y1="18" x2="13" y2="18" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
              <line x1="0" y1="29" x2="0" y2="33" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
            </g>
          )}
          <text x="0" y="36" fill="#ca8a04" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
            3 (R)
          </text>
        </g>
      </g>

      {/* ------------------------------------------------------------------- */}
      {/* 3. TRANSPARENT GLASS CUTAWAY BODY ("CORPO DE VIDRO TRANSPARENTE")   */}
      {/* ------------------------------------------------------------------- */}
      {showGlassCutaway ? (
        <g id="glass-cutaway-view">
          {/* Glass Chamber Deep Bore Cavity (Câmara Cilíndrica Retificada de Alta Precisão) */}
          <rect
            x="58"
            y="62"
            width="134"
            height="58"
            rx="5"
            fill={`url(#chamber-depth-${comp.id})`}
            stroke="#38bdf8"
            strokeWidth="1.6"
          />

          {/* Internal Chamber Machined Bore Corridor */}
          <rect
            x="60"
            y="70"
            width="130"
            height="42"
            rx="3"
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="0.8"
          />

          {/* Machined Internal Annular Galleries (5 Galerias Anulares Usinadas) */}
          {/* Gallery 4 (Top Left - Trabalho A) */}
          <rect x="89" y="62" width="12" height="12" fill={isLeftPos ? `url(#flow-pressure-${comp.id})` : `url(#flow-exhaust-${comp.id})`} opacity="0.9" />
          {/* Gallery 2 (Top Right - Trabalho B) */}
          <rect x="149" y="62" width="12" height="12" fill={!isLeftPos ? `url(#flow-pressure-${comp.id})` : `url(#flow-exhaust-${comp.id})`} opacity="0.9" />
          {/* Gallery 5 (Bottom Left - Escape S/EB) */}
          <rect x="69" y="106" width="12" height="14" fill={!isLeftPos ? `url(#flow-exhaust-${comp.id})` : '#0f172a'} opacity={!isLeftPos ? 0.9 : 0.4} />
          {/* Gallery 1 (Bottom Center - Alimentação P 6 bar) */}
          <rect x="119" y="106" width="12" height="14" fill={`url(#flow-pressure-${comp.id})`} opacity="0.95" />
          {/* Gallery 3 (Bottom Right - Escape R/EA) */}
          <rect x="169" y="106" width="12" height="14" fill={isLeftPos ? `url(#flow-exhaust-${comp.id})` : '#0f172a'} opacity={isLeftPos ? 0.9 : 0.4} />

          {/* DYNAMIC AIR FLOW PATHS INSIDE CHAMBER (Real-time fluid dynamic streams) */}
          {isLeftPos ? (
            // POSIÇÃO 2 (ENERGIZADA): 1 -> 4 (Pressão) & 2 -> 3 (Escape)
            <g id="fluid-channels-pos2">
              {/* Pressurized air from 1 (P) flowing into 4 (A) */}
              <path
                d="M 125 110 L 125 90 Q 125 78 110 78 L 100 78 Q 95 78 95 64"
                fill="none"
                stroke={`url(#flow-pressure-${comp.id})`}
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.88"
              />
              {/* Animated high-speed dashed stream */}
              <path
                d="M 125 110 L 125 90 Q 125 78 110 78 L 100 78 Q 95 78 95 64"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="6 4"
                className={`animate-flow-dash-2-${comp.id}`}
                opacity="0.9"
              />
              <polygon points="95,64 91,73 99,73" fill="#fef08a" />

              {/* Exhaust air from 2 (B) flowing down into 3 (S) */}
              <path
                d="M 155 64 L 155 82 Q 155 94 165 94 L 170 94 Q 175 94 175 110"
                fill="none"
                stroke={`url(#flow-exhaust-${comp.id})`}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.85"
              />
              <path
                d="M 155 64 L 155 82 Q 155 94 165 94 L 170 94 Q 175 94 175 110"
                fill="none"
                stroke="#bae6fd"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="5 4"
                className={`animate-flow-dash-2-${comp.id}`}
                opacity="0.9"
              />
              <polygon points="175,110 171,101 179,101" fill="#38bdf8" />

              {/* Port 5 (S) Blocked seal indicator */}
              <g transform="translate(75, 96)">
                <circle cx="0" cy="0" r="5" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.2" />
                <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.2" />
                <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.2" />
              </g>
            </g>
          ) : (
            // POSIÇÃO 1 (DESENERGIZADA / MOLA): 1 -> 2 (Pressão) & 4 -> 5 (Escape)
            <g id="fluid-channels-pos1">
              {/* Pressurized air from 1 (P) flowing into 2 (B) */}
              <path
                d="M 125 110 L 125 90 Q 125 78 140 78 L 150 78 Q 155 78 155 64"
                fill="none"
                stroke={`url(#flow-pressure-${comp.id})`}
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.88"
              />
              <path
                d="M 125 110 L 125 90 Q 125 78 140 78 L 150 78 Q 155 78 155 64"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="6 4"
                className={`animate-flow-dash-1-${comp.id}`}
                opacity="0.9"
              />
              <polygon points="155,64 151,73 159,73" fill="#fef08a" />

              {/* Exhaust air from 4 (A) flowing down into 5 (R) */}
              <path
                d="M 95 64 L 95 82 Q 95 94 85 94 L 80 94 Q 75 94 75 110"
                fill="none"
                stroke={`url(#flow-exhaust-${comp.id})`}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.85"
              />
              <path
                d="M 95 64 L 95 82 Q 95 94 85 94 L 80 94 Q 75 94 75 110"
                fill="none"
                stroke="#bae6fd"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="5 4"
                className={`animate-flow-dash-1-${comp.id}`}
                opacity="0.9"
              />
              <polygon points="75,110 71,101 79,101" fill="#38bdf8" />

              {/* Port 3 (R) Blocked seal indicator */}
              <g transform="translate(175, 96)">
                <circle cx="0" cy="0" r="5" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.2" />
                <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.2" />
                <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.2" />
              </g>
            </g>
          )}

          {/* --------------------------------------------------------------- */}
          {/* PILOT ARMATURE MECHANISMS (INDUTO DO PILOTO DO SOLENOIDE)       */}
          {/* --------------------------------------------------------------- */}
          {/* Left Pilot Plunger (Y1) - Moves right when coil energizes */}
          <g
            id="pilot-plunger-left"
            transform={`translate(${y1Active ? 6 : 0}, 0)`}
            className="transition-transform duration-200"
          >
            {/* Plunger core steel pin */}
            <rect x="46" y="87" width="10" height="8" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
            {/* Rubber sealing seat tip */}
            <rect x="54" y="88.5" width="2.5" height="5" rx="1" fill={y1Active ? '#22c55e' : '#ef4444'} />
            {/* Small pilot spring */}
            <path d="M 46 91 L 43 89 L 41 93 L 39 89 L 37 91" fill="none" stroke="#94a3b8" strokeWidth="1" />
          </g>

          {/* Right Pilot Plunger (Y2) for Double Solenoid */}
          {isDouble && (
            <g
              id="pilot-plunger-right"
              transform={`translate(${y2Active ? -6 : 0}, 0)`}
              className="transition-transform duration-200"
            >
              <rect x="194" y="87" width="10" height="8" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
              <rect x="193.5" y="88.5" width="2.5" height="5" rx="1" fill={y2Active ? '#22c55e' : '#ef4444'} />
              <path d="M 204 91 L 207 89 L 209 93 L 211 89 L 213 91" fill="none" stroke="#94a3b8" strokeWidth="1" />
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
              x="60"
              y="88"
              width="130"
              height="6"
              rx="2"
              fill={`url(#spool-metal-${comp.id})`}
              stroke="#334155"
              strokeWidth="0.8"
            />

            {/* Êmbolo 1 (Left Piston Land) */}
            <g transform="translate(73, 71)">
              <rect x="0" y="0" width="16" height="40" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1.2" />
              {/* O-Ring Seals (Anéis de Vedação NBR Vulcanizados Pretos com Brilho) */}
              <rect x="2" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <rect x="10.5" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <line x1="8" y1="2" x2="8" y2="38" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
            </g>

            {/* Êmbolo 2 (Center Piston Land) */}
            <g transform="translate(117, 71)">
              <rect x="0" y="0" width="16" height="40" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1.2" />
              <rect x="2" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <rect x="10.5" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <line x1="8" y1="2" x2="8" y2="38" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
            </g>

            {/* Êmbolo 3 (Right Piston Land) */}
            <g transform="translate(161, 71)">
              <rect x="0" y="0" width="16" height="40" rx="2" fill={`url(#spool-metal-${comp.id})`} stroke="#1e293b" strokeWidth="1.2" />
              <rect x="2" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <rect x="10.5" y="0" width="3.5" height="40" rx="1.2" fill="#090d16" stroke="#1e293b" strokeWidth="0.5" />
              <line x1="8" y1="2" x2="8" y2="38" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
            </g>

            {/* Left Solenoid Push Rod (Induzido / Haste de contato Y1) */}
            <rect x="50" y="89" width="12" height="4" rx="1" fill="#f1f5f9" stroke="#475569" strokeWidth="0.6" />

            {/* Right Actuator Push Rod / Spring guide */}
            <rect x="187" y="89" width="11" height="4" rx="1" fill="#f1f5f9" stroke="#475569" strokeWidth="0.6" />
          </g>

          {/* Mechanical Return Spring (for 5/2 Single Solenoid Monoestável 4V210) */}
          {!isDouble && (
            <g id="helical-return-spring" transform="translate(182, 91)">
              {/* Helical wire coils with 3D depth and dynamic compression */}
              {isLeftPos ? (
                // COMPRESSED SPRING (Mola Comprimida - Pos 2 Energizada)
                <g className="transition-all duration-300">
                  <path
                    d="M 0 0 L 2 -11 L 4 11 L 6 -11 L 8 11 L 10 -11 L 12 11 L 14 -11 L 16 0"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 0 0 L 2 -11 L 4 11 L 6 -11 L 8 11 L 10 -11 L 12 11 L 14 -11 L 16 0"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  <circle cx="16" cy="0" r="3.2" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
                </g>
              ) : (
                // RELAXED EXPANDED SPRING (Mola Distendida - Pos 1 Normal)
                <g className="transition-all duration-300">
                  <path
                    d="M 0 0 L 4 -12 L 8 12 L 12 -12 L 16 12 L 20 -12 L 24 12 L 28 0"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 0 0 L 4 -12 L 8 12 L 12 -12 L 16 12 L 20 -12 L 24 12 L 28 0"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  <circle cx="28" cy="0" r="3.2" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
                </g>
              )}
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

          {/* Glass Edges Bevel & Technical Refraction Highlights */}
          <line x1="60" y1="64" x2="190" y2="64" stroke="#ffffff" strokeWidth="1.2" opacity="0.85" />
          <line x1="60" y1="118" x2="190" y2="118" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
          <line x1="60" y1="64" x2="60" y2="118" stroke="#ffffff" strokeWidth="0.8" opacity="0.4" />
          <line x1="190" y1="64" x2="190" y2="118" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />

          {/* Laser-etched Micro-labels on Glass Surface */}
          <text x="64" y="69" fill="#38bdf8" fontSize="5.2" fontWeight="bold" fontFamily="'JetBrains Mono'" opacity="0.75">
            CORPO VIDRO ÓPTICO BOROSILICATO
          </text>
          <text x="186" y="69" fill="#94a3b8" fontSize="4.8" textAnchor="end" fontFamily="'JetBrains Mono'" opacity="0.75">
            Ø CARRETEL 16mm
          </text>

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

        {/* Transparent Polycarbonate DIN 43650 Connector Plug (Conector transparente com bornes 24V e 0V fisicamente separados) */}
        <g id="din-plug-y1" transform="translate(4, 0)">
          {/* Cable Gland (Prensa-cabo branco/creme) */}
          <rect x="-6" y="8" width="8" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
          <line x1="-3" y1="9" x2="-3" y2="21" stroke="#cbd5e1" strokeWidth="1" />

          {/* Translucent Plug Case ampliado para acomodar bornes separados */}
          <rect
            x="2"
            y="0"
            width="38"
            height="44"
            rx="3"
            fill={`url(#din-glass-${comp.id})`}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          {/* Central Screw (Parafuso central de fixação) */}
          <circle cx="21" cy="20" r="4" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          <line x1="18.5" y1="20" x2="23.5" y2="20" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="21" y1="17.5" x2="21" y2="22.5" stroke="#e2e8f0" strokeWidth="1" />

          {/* Terminal +24V (A1) Superior/Esquerdo */}
          <rect x="1" y="0" width="8" height="8" rx="2" fill="#ef4444" opacity="0.3" />
          <circle cx="5" cy="4" r="3.5" fill="#ef4444" stroke="#fca5a5" strokeWidth="0.8" />
          <text x="5" y="4" fill="#ffffff" fontSize="5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="'JetBrains Mono'">
            +
          </text>

          {/* Terminal 0V (A2) Inferior/Direito - Separado fisicamente */}
          <rect x="29" y="36" width="8" height="8" rx="2" fill="#1e3a8a" opacity="0.3" />
          <circle cx="33" cy="40" r="3.5" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="0.8" />
          <text x="33" y="40" fill="#ffffff" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="'JetBrains Mono'">
            -
          </text>

          {/* DIN Plug Indicator LED */}
          <g transform="translate(10, 28)">
            <circle
              cx="0"
              cy="0"
              r="3.5"
              fill={y1Active ? '#22c55e' : '#334155'}
              stroke={y1Active ? '#86efac' : '#1e293b'}
              strokeWidth="1"
              filter={y1Active ? `url(#led-glow-${comp.id})` : undefined}
            />
            {y1Active && <circle cx="0" cy="0" r="1.2" fill="#ffffff" />}
          </g>
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

          {/* Transparent Polycarbonate DIN 43650 Connector Plug Y2 (Bornes separados) */}
          <g id="din-plug-y2" transform="translate(0, 0)">
            <rect
              x="0"
              y="0"
              width="38"
              height="44"
              rx="3"
              fill={`url(#din-glass-${comp.id})`}
              stroke="#94a3b8"
              strokeWidth="1.2"
            />
            {/* Cable Gland */}
            <rect x="36" y="8" width="8" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
            <line x1="39" y1="9" x2="39" y2="21" stroke="#cbd5e1" strokeWidth="1" />

            {/* Central Screw */}
            <circle cx="19" cy="20" r="4" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
            <line x1="16.5" y1="20" x2="21.5" y2="20" stroke="#e2e8f0" strokeWidth="1" />
            <line x1="19" y1="17.5" x2="19" y2="22.5" stroke="#e2e8f0" strokeWidth="1" />

            {/* Terminal +24V (A1) Superior/Direito (x: 94%, y: 13%) */}
            <rect x="30" y="0" width="8" height="8" rx="2" fill="#ef4444" opacity="0.3" />
            <circle cx="34" cy="4" r="3.5" fill="#ef4444" stroke="#fca5a5" strokeWidth="0.8" />
            <text x="34" y="4" fill="#ffffff" fontSize="5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="'JetBrains Mono'">
              +
            </text>

            {/* Terminal 0V (A2) Inferior/Esquerdo (x: 82%, y: 38%) */}
            <rect x="2" y="36" width="8" height="8" rx="2" fill="#1e3a8a" opacity="0.3" />
            <circle cx="6" cy="40" r="3.5" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="0.8" />
            <text x="6" y="40" fill="#ffffff" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="'JetBrains Mono'">
              -
            </text>

            {/* Indicator LED */}
            <g transform="translate(28, 28)">
              <circle
                cx="0"
                cy="0"
                r="3.5"
                fill={y2Active ? '#22c55e' : '#334155'}
                stroke={y2Active ? '#86efac' : '#1e293b'}
                strokeWidth="1"
                filter={y2Active ? `url(#led-glow-${comp.id})` : undefined}
              />
              {y2Active && <circle cx="0" cy="0" r="1.2" fill="#ffffff" />}
            </g>
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
