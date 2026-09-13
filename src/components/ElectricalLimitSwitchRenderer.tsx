import React from 'react';
import { BenchComponent } from '../types';

interface ElectricalLimitSwitchRendererProps {
  comp: BenchComponent;
  onToggleRoller?: (componentId: string) => void;
  isSimulating?: boolean;
}

export const ElectricalLimitSwitchRenderer: React.FC<ElectricalLimitSwitchRendererProps> = ({
  comp,
  onToggleRoller,
}) => {
  const isRollerPressed = Boolean(comp.state?.isRollerPressed || comp.state?.manualRollerPressed);

  const handleRollerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleRoller) {
      onToggleRoller(comp.id);
    }
  };

  return (
    <g id={`electrical-limit-switch-${comp.id}`} className="select-none">
      {/* ------------------------------------------------------------- */}
      {/* DEFINIÇÕES DE GRADIENTES E FILTROS METÁLICOS                   */}
      {/* ------------------------------------------------------------- */}
      <defs>
        {/* Placa de Fixação Cinza (no mesmo padrão dos sensores e perfis industriais) */}
        <linearGradient id={`switch-plate-grad-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="25%" stopColor="#64748b" />
          <stop offset="60%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        {/* Haste de Alavanca de Latão / Dourada */}
        <linearGradient id={`brass-lever-grad-${comp.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#eab308" />
          <stop offset="80%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>

        {/* Rolete de Nylon / Metal Torneado */}
        <radialGradient id={`roller-wheel-grad-${comp.id}`} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e2e8f0" />
          <stop offset="90%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </radialGradient>

        {/* Cabeça dos Parafusos Industriais */}
        <radialGradient id={`screw-head-grad-${comp.id}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="90%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </radialGradient>

        {/* Sombra de Projeção Suave */}
        <filter id={`switch-drop-shadow-${comp.id}`} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#090d16" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* ------------------------------------------------------------- */}
      {/* 1. PLACA BASE DE FIXAÇÃO CINZA COM 4 CANTOS CHANFRADOS 45°     */}
      {/* ------------------------------------------------------------- */}
      {/* Base: 140x140px, cantos chanfrados em 16px na cor cinza industrial */}
      <polygon
        points="16,0 124,0 140,16 140,124 124,140 16,140 0,124 0,16"
        fill={`url(#switch-plate-grad-${comp.id})`}
        stroke="#1e293b"
        strokeWidth="1.4"
        filter={`url(#switch-drop-shadow-${comp.id})`}
      />

      {/* Filete de Chanfro e Brilho Especular Interno */}
      <polygon
        points="18,3 122,3 137,18 137,122 122,137 18,137 3,122 3,18"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.0"
        opacity="0.45"
      />

      {/* Friso Ranhurado Traseiro de Encaixe na Guia */}
      <rect x="6" y="6" width="128" height="128" rx="4" fill="none" stroke="#64748b" strokeWidth="0.6" strokeDasharray="4 2" opacity="0.4" />

      {/* ------------------------------------------------------------- */}
      {/* 2. PARAFUSOS PHILLIPS INDUSTRIAIS DE FIXAÇÃO (Conforme Foto)   */}
      {/* ------------------------------------------------------------- */}
      {/* Parafuso Superior Direito (cx=105, cy=32) */}
      <g transform="translate(105, 32)">
        {/* Arruela usinada */}
        <circle cx="0" cy="0" r="7.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="6.2" fill={`url(#screw-head-grad-${comp.id})`} />
        {/* Fenda Phillips */}
        <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="0" cy="0" r="1.2" fill="#0f172a" />
      </g>

      {/* Parafuso Inferior Esquerdo (cx=36, cy=58) */}
      <g transform="translate(36, 58)">
        {/* Arruela usinada */}
        <circle cx="0" cy="0" r="7.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="6.2" fill={`url(#screw-head-grad-${comp.id})`} />
        {/* Fenda Phillips com ângulo para realismo */}
        <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="0" cy="0" r="1.2" fill="#0f172a" />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* 3. ETIQUETA SERIGRAFADA COM O DIAGRAMA DO CONTATO DE COMUTAÇÃO */}
      {/* ------------------------------------------------------------- */}
      {/* Plaqueta Técnica Branca/Cinza Claro com Cantos Arredondados */}
      <rect
        x="18"
        y="14"
        width="66"
        height="38"
        rx="3"
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth="0.9"
        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))"
      />

      {/* Desenho do Contato Reversor / Comutação (SPDT - DIN EN 50005) */}
      <g id="schematic-symbol" transform="translate(22, 16)">
        {/* Borne 1: Comum (à esquerda) */}
        <text x="6" y="24" fill="#0f172a" fontSize="7.5" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
          1
        </text>
        <circle cx="16" cy="21" r="2.2" fill="#0f172a" />
        <line x1="9" y1="21" x2="14" y2="21" stroke="#0f172a" strokeWidth="1.2" />

        {/* Linha mecânica de acoplamento do rolete (tracejada para a lâmina) */}
        <line x1="28" y1="5" x2="28" y2="18" stroke="#64748b" strokeWidth="0.9" strokeDasharray="2 1.5" />
        {/* Pequeno rolete esquemático no topo da linha tracejada */}
        <circle cx="28" cy="4" r="2.2" fill="none" stroke="#64748b" strokeWidth="0.9" />

        {/* Borne 2: Contato Fechado (NF - parte superior) */}
        <circle cx="44" cy="11" r="2.2" fill="#0f172a" />
        <line x1="46" y1="11" x2="52" y2="11" stroke="#0f172a" strokeWidth="1.2" />
        <text x="54" y="14" fill="#0f172a" fontSize="7.5" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
          2
        </text>

        {/* Borne 4: Contato Aberto (NA - parte inferior) */}
        <circle cx="44" cy="30" r="2.2" fill="#0f172a" />
        <line x1="46" y1="30" x2="52" y2="30" stroke="#0f172a" strokeWidth="1.2" />
        <text x="54" y="33" fill="#0f172a" fontSize="7.5" fontWeight="900" fontFamily="'JetBrains Mono', monospace">
          4
        </text>

        {/* Lâmina Móvel de Comutação:
            Em repouso: Lâmina toca o contato 2 (NF).
            Quando acionado pelo rolete: Lâmina comuta e toca o contato 4 (NA). */}
        {isRollerPressed ? (
          // Comutado: conectado ao 4 (NA)
          <g>
            <line
              x1="16"
              y1="21"
              x2="43"
              y2="29.5"
              stroke="#16a34a"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Brilho verde de condução no contato 1-4 */}
            <circle cx="44" cy="30" r="3.5" fill="none" stroke="#22c55e" strokeWidth="1.2" opacity="0.8" />
            <circle cx="16" cy="21" r="3.5" fill="none" stroke="#22c55e" strokeWidth="1.2" opacity="0.8" />
          </g>
        ) : (
          // Repouso: conectado ao 2 (NF)
          <g>
            <line
              x1="16"
              y1="21"
              x2="43"
              y2="11.5"
              stroke="#0f172a"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Indicação sutil de contato fechado 1-2 em repouso */}
            <circle cx="44" cy="11" r="3" fill="none" stroke="#3b82f6" strokeWidth="0.8" opacity="0.6" />
          </g>
        )}
      </g>

      {/* ------------------------------------------------------------- */}
      {/* 4. PLAQUETA DE IDENTIFICAÇÃO E NUMERAÇÃO DOS BORNES (1, 2, 4) */}
      {/* ------------------------------------------------------------- */}
      {/* Plaqueta central técnica neutra (sem logomarcas) */}
      <rect
        x="50"
        y="58"
        width="76"
        height="36"
        rx="3"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="0.8"
      />

      {/* Identificação Técnica Industrial Normalizada (DIN EN 50005) */}
      <g transform="translate(88, 71)">
        <text
          x="0"
          y="0"
          fill="#334155"
          fontSize="9"
          fontWeight="900"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.8"
          textAnchor="middle"
        >
          LIMIT SWITCH
        </text>
        <line x1="-30" y1="3" x2="30" y2="3" stroke="#64748b" strokeWidth="0.8" />
      </g>

      {/* Numeração dos Terminais alinhada verticalmente com os bornes:
          Borne 1 (Comum): x = 42% (58.8px)
          Borne 2 (NF):    x = 67% (93.8px)
          Borne 4 (NA):    x = 89% (124.6px) */}
      <g transform="translate(0, 88)">
        {/* Terminal 1 (Comum) */}
        <text
          x="58.8"
          y="0"
          fill="#0f172a"
          fontSize="9"
          fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
        >
          1
        </text>

        {/* Terminal 2 (NF - Contato Fechado) */}
        <text
          x="93.8"
          y="0"
          fill="#0f172a"
          fontSize="9"
          fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
        >
          2
        </text>

        {/* Terminal 4 (NA - Contato Aberto) */}
        <text
          x="124.6"
          y="0"
          fill="#0f172a"
          fontSize="9"
          fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
        >
          4
        </text>
      </g>

      {/* ------------------------------------------------------------- */}
      {/* 5. TRÊS BORNES FÊMEA DE SEGURANÇA 4MM (Pretos c/ Bucha Latão)  */}
      {/* ------------------------------------------------------------- */}
      {/* Borne 1: Comum (x=58.8, y=117.6) */}
      <g transform="translate(58.8, 117.6)">
        {/* Corpo externo preto de nylon antichama */}
        <circle cx="0" cy="0" r="10.5" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="9" fill="#1e293b" />
        <circle cx="0" cy="0" r="7.5" fill="#090d16" />
        {/* Bucha de contato interna de latão dourado 4mm */}
        <circle cx="0" cy="0" r="4.2" fill="#eab308" stroke="#ca8a04" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="2.6" fill="#171717" />
        {/* Destaque sutil de estado */}
        <text x="0" y="17" fill="#475569" fontSize="6" fontWeight="bold" textAnchor="middle">
          COM
        </text>
      </g>

      {/* Borne 2: Contato Fechado NF (x=93.8, y=117.6) */}
      <g transform="translate(93.8, 117.6)">
        {/* Corpo externo preto de nylon antichama */}
        <circle cx="0" cy="0" r="10.5" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="9" fill="#1e293b" />
        <circle cx="0" cy="0" r="7.5" fill="#090d16" />
        {/* Bucha de contato interna de latão dourado 4mm */}
        <circle cx="0" cy="0" r="4.2" fill="#eab308" stroke="#ca8a04" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="2.6" fill="#171717" />
        {/* Destaque sutil de estado */}
        <text x="0" y="17" fill={!isRollerPressed ? '#0284c7' : '#64748b'} fontSize="6" fontWeight="bold" textAnchor="middle">
          NF
        </text>
      </g>

      {/* Borne 4: Contato Aberto NA (x=124.6, y=117.6) */}
      <g transform="translate(124.6, 117.6)">
        {/* Corpo externo preto de nylon antichama */}
        <circle cx="0" cy="0" r="10.5" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="9" fill="#1e293b" />
        <circle cx="0" cy="0" r="7.5" fill="#090d16" />
        {/* Bucha de contato interna de latão dourado 4mm */}
        <circle cx="0" cy="0" r="4.2" fill="#eab308" stroke="#ca8a04" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="2.6" fill="#171717" />
        {/* Destaque sutil de estado */}
        <text x="0" y="17" fill={isRollerPressed ? '#16a34a' : '#64748b'} fontSize="6" fontWeight="bold" textAnchor="middle">
          NA
        </text>
      </g>

      {/* ------------------------------------------------------------- */}
      {/* 6. MECANISMO DA ALAVANCA ARTICULADA E ROLETE MECÂNICO         */}
      {/* ------------------------------------------------------------- */}
      {/* Bloco pivotante interno no canto superior esquerdo */}
      <rect x="14" y="16" width="16" height="14" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="0.8" />
      <circle cx="22" cy="23" r="3.2" fill="#64748b" stroke="#1e293b" strokeWidth="0.8" />
      <circle cx="22" cy="23" r="1.5" fill="#0f172a" />

      {/* Haste articulada com rolete giratório no topo esquerdo */}
      {/* Ao clicar no rolete ou acionar pelo cilindro, a alavanca se inclina */}
      {/* Haste alongada para posicionar o rolete 32px acima da placa de fixação, */}
      {/* evitando qualquer sobreposição visual entre a placa e a haste/êmbolo do cilindro. */}
      <g
        id={`limit-switch-roller-lever-${comp.id}`}
        onClick={handleRollerClick}
        className="cursor-pointer group"
        transform={
          isRollerPressed
            ? 'rotate(20, 22, 23)' // Pressionado / acionado pelo cilindro ou clique
            : 'rotate(0, 22, 23)'  // Em repouso (ângulo natural da mola)
        }
        style={{ transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <title>Rolete do fim de curso (Clique para comutar contato manualmente)</title>
        {/* Mola de torção metálica visível no eixo */}
        <path d="M 20 20 Q 23 17 25 21 Q 20 24 23 27" fill="none" stroke="#94a3b8" strokeWidth="0.9" />

        {/* Braço/Haste metálica de latão ALONGADA (Golden Brass Extended Lever) */}
        <polygon
          points="22,23 7,-30 13,-34 26,20"
          fill={`url(#brass-lever-grad-${comp.id})`}
          stroke="#854d0e"
          strokeWidth="0.9"
        />

        {/* Nervura de reforço da haste metálica */}
        <line x1="24" y1="21" x2="10" y2="-32" stroke="#fef08a" strokeWidth="1" opacity="0.75" />

        {/* Eixo e Suporte do Rolete na ponta da haste alongada */}
        <circle cx="10" cy="-32" r="3.8" fill="#ca8a04" stroke="#854d0e" strokeWidth="0.9" />

        {/* Rolete Cilíndrico de Nylon / Metal Torneado (Ø22mm) */}
        <circle
          cx="10"
          cy="-32"
          r="11"
          fill={`url(#roller-wheel-grad-${comp.id})`}
          stroke="#334155"
          strokeWidth="1.4"
          filter="drop-shadow(0 3px 6px rgba(0,0,0,0.45))"
          className="group-hover:stroke-cyan-400 transition-colors"
        />

        {/* Ranhura / Centro do Rolete com pino rebite */}
        <circle cx="10" cy="-32" r="4.8" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.7" />
        <circle cx="10" cy="-32" r="2.2" fill="#ca8a04" />
        <circle cx="10" cy="-32" r="0.9" fill="#451a03" />

        {/* Brilho indicador ao passar o mouse sobre o rolete */}
        <circle
          cx="10"
          cy="-32"
          r="13"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.4"
          strokeDasharray="2 2"
          opacity="0"
          className="group-hover:opacity-90 transition-opacity"
        />
      </g>

      {/* ------------------------------------------------------------- */}
      {/* 7. ETIQUETA COM A TAG INDUSTRIAL E STATUS ATIVO DO CONTATO    */}
      {/* ------------------------------------------------------------- */}
      {/* Tag do Componente (ex: 1S1 ou 1S_FC) */}
      <g transform="translate(18, 126)">
        <rect
          x="0"
          y="-14"
          width="28"
          height="12"
          rx="2"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="0.7"
        />
        <text
          x="14"
          y="-5.5"
          fill="#38bdf8"
          fontSize="7"
          fontWeight="bold"
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
        >
          {comp.tag || '1S1'}
        </text>
      </g>

      {/* Indicador Luminoso de Estado do Contato */}
      <g transform="translate(68, 6)">
        {isRollerPressed ? (
          <g>
            <rect x="0" y="0" width="46" height="10" rx="2" fill="#14532d" stroke="#22c55e" strokeWidth="0.8" />
            <circle cx="6" cy="5" r="2.2" fill="#22c55e" />
            <text x="24" y="7.5" fill="#86efac" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
              1-4 ATIVO
            </text>
          </g>
        ) : (
          <g>
            <rect x="0" y="0" width="46" height="10" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="0.8" />
            <circle cx="6" cy="5" r="2.2" fill="#0284c7" />
            <text x="24" y="7.5" fill="#93c5fd" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="'JetBrains Mono'">
              1-2 REPOUSO
            </text>
          </g>
        )}
      </g>
    </g>
  );
};
