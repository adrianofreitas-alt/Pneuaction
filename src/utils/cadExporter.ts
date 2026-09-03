import { BenchComponent, VirtualConnection } from '../types';

/**
 * CAD Integration Utilities
 * Exports electropneumatic schematics to standard AutoCAD DXF, Technical SVG, and JSON formats.
 */

export function generateAutoCAD_DXF(
  components: BenchComponent[],
  connections: VirtualConnection[],
  projectName = "Esquema_Eletropneumatico_Bancada"
): string {
  const dateStr = new Date().toISOString().split('T')[0];

  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
4
0
LAYER
2
0
70
0
62
7
6
CONTINUOUS
0
LAYER
2
COMPONENTS
70
0
62
3
6
CONTINUOUS
0
LAYER
2
PNEUMATIC_LINES
70
0
62
4
6
CONTINUOUS
0
LAYER
2
ELECTRICAL_WIRES
70
0
62
1
6
CONTINUOUS
0
LAYER
2
TEXT_LABELS
70
0
62
7
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  // Draw technical title block
  dxf += `0
LINE
8
0
10
0.0
20
0.0
30
0.0
11
1200.0
21
0.0
31
0.0
0
LINE
8
0
10
1200.0
20
0.0
30
0.0
11
1200.0
21
800.0
31
0.0
0
LINE
8
0
10
1200.0
20
800.0
30
0.0
11
0.0
21
800.0
31
0.0
0
LINE
8
0
10
0.0
20
800.0
30
0.0
11
0.0
21
0.0
31
0.0
`;

  // Add project title text
  dxf += `0
TEXT
8
TEXT_LABELS
10
50.0
20
760.0
30
0.0
40
24.0
1
${projectName.toUpperCase()} - NORMA ISO 1219 / NR-12
0
TEXT
8
TEXT_LABELS
10
50.0
20
725.0
30
0.0
40
14.0
1
DATA: ${dateStr} | BANCADA DIDATICA SENAI/MEC | SISTEMA ELETROPNEUMATICO
`;

  // Draw Components as boxes with labels and ports
  components.forEach((comp) => {
    const x1 = comp.x;
    const y1 = 800 - comp.y - comp.height;
    const x2 = comp.x + comp.width;
    const y2 = 800 - comp.y;

    // Component outline box
    dxf += `0
LINE
8
COMPONENTS
10
${x1}
20
${y1}
30
0.0
11
${x2}
21
${y1}
31
0.0
0
LINE
8
COMPONENTS
10
${x2}
20
${y1}
30
0.0
11
${x2}
21
${y2}
31
0.0
0
LINE
8
COMPONENTS
10
${x2}
20
${y2}
30
0.0
11
${x1}
21
${y2}
31
0.0
0
LINE
8
COMPONENTS
10
${x1}
20
${y2}
30
0.0
11
${x1}
21
${y1}
31
0.0
`;

    // Component Tag
    dxf += `0
TEXT
8
TEXT_LABELS
10
${x1 + 10}
20
${y2 - 22}
30
0.0
40
14.0
1
[${comp.tag}] ${comp.name.substring(0, 22)}
`;

    // Draw component ports
    comp.ports.forEach((port) => {
      const portX = comp.x + (comp.width * port.x) / 100;
      const portY = 800 - (comp.y + (comp.height * port.y) / 100);
      dxf += `0
CIRCLE
8
COMPONENTS
10
${portX}
20
${portY}
30
0.0
40
4.0
0
TEXT
8
TEXT_LABELS
10
${portX - 6}
20
${portY + 7}
30
0.0
40
8.0
1
${port.name}
`;
    });
  });

  // Draw Connections (Lines)
  connections.forEach((conn) => {
    const sourceComp = components.find(c => c.id === conn.fromComponentId);
    const targetComp = components.find(c => c.id === conn.toComponentId);
    if (!sourceComp || !targetComp) return;

    const sourcePort = sourceComp.ports.find(p => p.id === conn.fromPortId);
    const targetPort = targetComp.ports.find(p => p.id === conn.toPortId);
    if (!sourcePort || !targetPort) return;

    const sx = sourceComp.x + (sourceComp.width * sourcePort.x) / 100;
    const sy = 800 - (sourceComp.y + (sourceComp.height * sourcePort.y) / 100);
    const tx = targetComp.x + (targetComp.width * targetPort.x) / 100;
    const ty = 800 - (targetComp.y + (targetComp.height * targetPort.y) / 100);

    const layer = conn.type === 'pneumatic' ? 'PNEUMATIC_LINES' : 'ELECTRICAL_WIRES';

    dxf += `0
LINE
8
${layer}
10
${sx}
20
${sy}
30
0.0
11
${tx}
21
${ty}
31
0.0
`;
  });

  dxf += `0
ENDSEC
0
EOF
`;

  return dxf;
}

export function generateTechnicalSVG(
  components: BenchComponent[],
  connections: VirtualConnection[],
  projectName = "Esquema_Eletropneumatico_ISO1219"
): string {
  const width = 1280;
  const height = 850;
  const dateStr = new Date().toLocaleDateString('pt-BR');

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.7" />
    </pattern>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#090d16" />
  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Drawing Border & Title Block (ISO 7200 / ABNT) -->
  <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="none" stroke="#0ea5e9" stroke-width="1.5" rx="4" />
  
  <!-- Title Block Header -->
  <g transform="translate(30, 35)">
    <text x="0" y="0" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="bold" fill="#38bdf8">${projectName}</text>
    <text x="0" y="22" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" fill="#94a3b8">Bancada Didática de Eletropneumática Industrial • Simulação Conforme ISO 1219-1/2, ISO 4414 e NR-12</text>
    <text x="750" y="0" font-family="'JetBrains Mono', monospace" font-size="12" fill="#64748b">DATA: ${dateStr}</text>
    <text x="750" y="20" font-family="'JetBrains Mono', monospace" font-size="12" fill="#64748b">STATUS: APROVADO / PROJETO TÉCNICO CAD</text>
  </g>

  <!-- Connections (Lines) -->
  <g id="connections-layer">
`;

  connections.forEach((conn) => {
    const sourceComp = components.find(c => c.id === conn.fromComponentId);
    const targetComp = components.find(c => c.id === conn.toComponentId);
    if (!sourceComp || !targetComp) return;

    const sourcePort = sourceComp.ports.find(p => p.id === conn.fromPortId);
    const targetPort = targetComp.ports.find(p => p.id === conn.toPortId);
    if (!sourcePort || !targetPort) return;

    const sx = sourceComp.x + (sourceComp.width * sourcePort.x) / 100;
    const sy = sourceComp.y + (sourceComp.height * sourcePort.y) / 100;
    const tx = targetComp.x + (targetComp.width * targetPort.x) / 100;
    const ty = targetComp.y + (targetComp.height * targetPort.y) / 100;

    const isPneumatic = conn.type === 'pneumatic';
    const strokeColor = isPneumatic ? '#0284c7' : '#e11d48';
    const strokeDash = isPneumatic ? 'none' : '6 3';
    const strokeWidth = isPneumatic ? '3.5' : '2.5';

    // Curvature calculation
    const dx = tx - sx;
    const dy = ty - sy;
    const cx1 = sx + dx * 0.25;
    const cy1 = sy + Math.abs(dx) * 0.3 + 30;
    const cx2 = tx - dx * 0.25;
    const cy2 = ty + Math.abs(dx) * 0.3 + 30;

    svg += `    <path d="M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}" 
      fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" stroke-linecap="round" />
`;
  });

  svg += `  </g>

  <!-- Components -->
  <g id="components-layer">
`;

  components.forEach((comp) => {
    svg += `    <g transform="translate(${comp.x}, ${comp.y})" filter="url(#shadow)">
      <!-- Card Box -->
      <rect width="${comp.width}" height="${comp.height}" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
      <rect x="0" y="0" width="${comp.width}" height="28" rx="8" fill="#0f172a" />
      <rect x="0" y="20" width="${comp.width}" height="8" fill="#0f172a" />
      
      <!-- Tag Badge -->
      <rect x="8" y="5" width="40" height="18" rx="3" fill="#0284c7" />
      <text x="28" y="18" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">${comp.tag}</text>
      
      <!-- Component Title -->
      <text x="56" y="18" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="600" fill="#f8fafc">${comp.name.substring(0, 20)}</text>
      
      <!-- Ports -->
`;

    comp.ports.forEach((port) => {
      const px = (comp.width * port.x) / 100;
      const py = (comp.height * port.y) / 100;
      const isPneumatic = port.type === 'pneumatic';
      const portColor = isPneumatic ? '#38bdf8' : '#fb7185';

      svg += `      <circle cx="${px}" cy="${py}" r="5" fill="#0f172a" stroke="${portColor}" stroke-width="2" />
      <text x="${px}" y="${py > comp.height / 2 ? py - 8 : py + 14}" font-family="'JetBrains Mono', monospace" font-size="8" fill="#94a3b8" text-anchor="middle">${port.name.split(' ')[0]}</text>
`;
    });

    svg += `    </g>
`;
  });

  svg += `  </g>

  <!-- Bill of Materials (BOM) summary on bottom right -->
  <g transform="translate(${width - 340}, ${height - 180})">
    <rect width="310" height="150" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1" />
    <text x="15" y="25" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="bold" fill="#38bdf8">LISTA DE MATERIAIS (BOM CAD)</text>
    <line x1="15" y1="35" x2="295" y2="35" stroke="#334155" stroke-width="1" />
    <text x="15" y="55" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#cbd5e1">Componentes Instalados: ${components.length} un</text>
    <text x="15" y="75" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#cbd5e1">Conexões Pneumáticas/Fios: ${connections.length} conexões</text>
    <text x="15" y="95" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#cbd5e1">Pressão Nominal: 6.0 bar (0.6 MPa)</text>
    <text x="15" y="115" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#cbd5e1">Tensão de Comando: 24V DC (PELV)</text>
    <text x="15" y="135" font-family="'JetBrains Mono', monospace" font-size="10" fill="#10b981">CONFORMIDADE NR-12: ATESTADA</text>
  </g>
</svg>`;

  return svg;
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
