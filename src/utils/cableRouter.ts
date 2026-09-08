/**
 * Sistema de Roteamento de Tubos Pneumáticos e Cabos Elétricos com Curvas Naturais Bezier
 * 
 * Atende com precisão absoluta aos requisitos:
 * 1. Curvas Naturais dos Tubos: Mantém a estética original de caimento por gravidade e flexibilidade
 *    (curvas cúbicas Bezier suaves, sem cantos retos artificiais ou dutos ortogonais rígidos).
 * 2. Desvio de Equipamentos: Evita que tubos e cabos passem por cima de equipamentos intermediários,
 *    adaptando dinamicamente o caimento (sag profundo / arco superior / canais livres da bancada).
 * 3. Acomodação Inteligente: Em feixes ou passagens compartilhadas, aplica defasagens suaves (offsets)
 *    para evitar que cabos e mangueiras fiquem sobrepostos uns aos outros.
 */

import { BenchComponent, ComponentPort, VirtualConnection } from '../types';
import { getPortWorldCoordinates } from '../components/BenchCanvas';

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleRect {
  id: string;
  type: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RoutedConnection {
  connection: VirtualConnection;
  coords: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    sourceComp: BenchComponent;
    targetComp: BenchComponent;
    sourcePort: ComponentPort;
    targetPort: ComponentPort;
  };
  waypoints: Point[];
  pathD: string;
  isPneumatic: boolean;
  isGroundWire: boolean;
  laneIndex: number;
  controlHandle: Point;
  lengthMm: number;
}

/**
 * Calcula o comprimento total aproximado de uma curva/polilinha em milímetros
 */
export function calculatePolylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.round(len);
}

/**
 * Obtém os retângulos delimitadores de todos os equipamentos (obstáculos),
 * excluindo os componentes de origem e destino da conexão em análise.
 */
export function getComponentObstacles(
  components: BenchComponent[],
  sourceCompId: string,
  targetCompId: string
): ObstacleRect[] {
  return components
    .filter(
      (comp) =>
        comp.id !== sourceCompId &&
        comp.id !== targetCompId &&
        !comp.type.startsWith('terminal_strip')
    )
    .map((comp) => {
      let right = comp.x + comp.width;
      let bottom = comp.y + comp.height;

      // Cilindros pneumáticos possuem trilho de guia e curso da haste que se estendem à direita
      if (comp.type === 'double_acting_cylinder') {
        right += 345;
        bottom = Math.max(bottom, comp.y + 155);
      } else if (comp.type === 'single_acting_cylinder') {
        right += 245;
        bottom = Math.max(bottom, comp.y + 145);
      }

      return {
        id: comp.id,
        type: comp.type,
        left: comp.x - 3,
        top: comp.y - 3,
        right: right + 3,
        bottom: bottom + 3,
      };
    });
}

/**
 * Amostra pontos ao longo de uma curva cúbica Bezier para detecção de colisão
 */
export function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps = 24): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

/**
 * Verifica se um conjunto de pontos intercepta algum equipamento delimitado
 */
export function checkCollision(pts: Point[], obstacles: ObstacleRect[]): boolean {
  for (const obs of obstacles) {
    // Verifica os pontos intermediários da trajetória (ignora extremos de engate)
    for (let i = 1; i < pts.length - 1; i++) {
      const pt = pts[i];
      if (pt.x >= obs.left && pt.x <= obs.right && pt.y >= obs.top && pt.y <= obs.bottom) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gera a curva Bezier adaptativa para a conexão, garantindo caimento natural e desvio de obstáculos.
 * Permite controle interativo pelo usuário (customControlPoint e customSag) para desvio manual e ajuste de comprimento.
 */
export function generateCurvedPath(
  p1: Point,
  p2: Point,
  obstacles: ObstacleRect[],
  connIndex = 0,
  customControlPoint?: { x: number; y: number },
  customSag?: number
): { pathD: string; waypoints: Point[] } {
  // -------------------------------------------------------------
  // CONTROLE MANUAL DO USUÁRIO 1: Ponto de Controle Interativo (Desvio manual livre)
  // -------------------------------------------------------------
  if (customControlPoint) {
    const H = customControlPoint;
    const midChord = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    // Curva cúbica Bezier que passa exatamente pelo ponto H puxado pelo usuário
    const Cx = 2 * H.x - midChord.x;
    const Cy = 2 * H.y - midChord.y;
    const cx1 = p1.x + (2 / 3) * (Cx - p1.x);
    const cy1 = p1.y + (2 / 3) * (Cy - p1.y);
    const cx2 = p2.x + (2 / 3) * (Cx - p2.x);
    const cy2 = p2.y + (2 / 3) * (Cy - p2.y);
    const pts = sampleCubicBezier(p1, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, p2);
    return {
      pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
      waypoints: pts,
    };
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Caimento natural de tubos e cabos suspensos (catenária/Bezier)
  const defaultSag = Math.min(105, Math.max(25, dist * 0.22));
  
  // Defasagem de acomodação para que conexões vizinhas não fiquem exatamente sobrepostas
  const laneOffset = ((connIndex % 5) - 2) * 5;

  // -------------------------------------------------------------
  // CONTROLE MANUAL DO USUÁRIO 2: Ajuste de Folga / Sag Customizado
  // -------------------------------------------------------------
  if (customSag !== undefined && customSag !== 0) {
    const effectiveSag = Math.max(0, defaultSag + laneOffset + customSag);
    const cx1 = p1.x + dx * 0.3;
    const cy1 = p1.y + effectiveSag;
    const cx2 = p2.x - dx * 0.3;
    const cy2 = p2.y + effectiveSag;
    const pts = sampleCubicBezier(p1, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, p2);
    return {
      pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
      waypoints: pts,
    };
  }

  // -------------------------------------------------------------
  // NÍVEL 1: Curva Bezier Simples com Caimento Padrão Natural
  // -------------------------------------------------------------
  let cx1 = p1.x + dx * 0.3;
  let cy1 = p1.y + defaultSag + laneOffset;
  let cx2 = p2.x - dx * 0.3;
  let cy2 = p2.y + defaultSag + laneOffset;
  let pts = sampleCubicBezier(p1, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, p2);

  if (!checkCollision(pts, obstacles)) {
    return {
      pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
      waypoints: pts,
    };
  }

  // -------------------------------------------------------------
  // NÍVEL 2: Ajuste Dinâmico do Caimento / Arco para Desvio
  // -------------------------------------------------------------
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const relevantObs = obstacles.filter((o) => o.right >= minX - 10 && o.left <= maxX + 10);
  const maxBottom = relevantObs.length > 0 ? Math.max(...relevantObs.map((o) => o.bottom)) : Math.max(p1.y, p2.y);
  const minTop = relevantObs.length > 0 ? Math.min(...relevantObs.map((o) => o.top)) : Math.min(p1.y, p2.y);

  // Tentativa 2A: Curva mais profunda por baixo do equipamento intermediário (ex: desvio de reguladora de fluxo)
  const neededDrop = maxBottom - Math.min(p1.y, p2.y) + 35;
  const deepSag = Math.max(defaultSag * 1.8, neededDrop / 0.75) + laneOffset;
  if (Math.max(p1.y, p2.y) + deepSag * 0.75 <= 750) {
    cx1 = p1.x + dx * 0.25;
    cy1 = p1.y + deepSag;
    cx2 = p2.x - dx * 0.25;
    cy2 = p2.y + deepSag;
    pts = sampleCubicBezier(p1, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, p2);
    if (!checkCollision(pts, obstacles)) {
      return {
        pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
        waypoints: pts,
      };
    }
  }

  // Tentativa 2B: Arco por cima do equipamento intermediário
  const neededRise = Math.max(p1.y, p2.y) - minTop + 35;
  const archSag = -Math.max(defaultSag * 1.5, neededRise / 0.75) + laneOffset;
  if (Math.min(p1.y, p2.y) + archSag * 0.75 >= 15) {
    cx1 = p1.x + dx * 0.25;
    cy1 = p1.y + archSag;
    cx2 = p2.x - dx * 0.25;
    cy2 = p2.y + archSag;
    pts = sampleCubicBezier(p1, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, p2);
    if (!checkCollision(pts, obstacles)) {
      return {
        pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
        waypoints: pts,
      };
    }
  }

  // -------------------------------------------------------------
  // NÍVEL 3: Curvas Contínuas Multi-Arco pelos Canais Livres da Bancada
  // -------------------------------------------------------------
  // Caso 3A: Rack Superior (y <= 205) para Painel Inferior (y > 240)
  if (p1.y <= 205 && p2.y > 240) {
    if (p2.y > 450) {
      // Destino no rodapé do painel (sensores magnéticos reed no trilho inferior)
      const channelY = 222 + (connIndex % 4) * 5;
      const lowerY = 540 + (connIndex % 4) * 6;
      const gapX = 368 + (connIndex % 2) * 6;

      const pB = { x: gapX, y: channelY };
      const pC = { x: gapX, y: lowerY };

      const b1 = sampleCubicBezier(p1, { x: p1.x, y: channelY - 10 }, { x: p1.x + 30, y: channelY }, pB);
      const b2 = sampleCubicBezier(pB, { x: gapX, y: channelY + 40 }, { x: gapX, y: lowerY - 40 }, pC);
      const b3 = sampleCubicBezier(pC, { x: gapX + 40, y: lowerY }, { x: p2.x, y: lowerY }, p2);
      const allPts = [...b1, ...b2, ...b3];
      const d = `M ${p1.x} ${p1.y} C ${p1.x} ${channelY - 10}, ${p1.x + 30} ${channelY}, ${pB.x} ${pB.y} C ${gapX} ${channelY + 40}, ${gapX} ${lowerY - 40}, ${pC.x} ${pC.y} C ${gapX + 40} ${lowerY}, ${p2.x} ${lowerY}, ${p2.x} ${p2.y}`;
      return { pathD: d, waypoints: allPts };
    } else {
      // Destino na parte superior do painel pneumático (solenoides das válvulas)
      const channelY = 222 + (connIndex % 4) * 5;
      const midX = p2.x > p1.x ? Math.max(368, p2.x - 25) : Math.min(368, p2.x + 25);
      const b1 = sampleCubicBezier(p1, { x: p1.x + 20, y: channelY }, { x: midX - 30, y: channelY }, { x: midX, y: channelY });
      const b2 = sampleCubicBezier({ x: midX, y: channelY }, { x: midX + 15, y: channelY }, { x: p2.x - 10, y: 260 }, p2);
      const allPts = [...b1, ...b2];
      const d = `M ${p1.x} ${p1.y} C ${p1.x + 20} ${channelY}, ${midX - 30} ${channelY}, ${midX} ${channelY} C ${midX + 15} ${channelY}, ${p2.x - 10} ${260}, ${p2.x} ${p2.y}`;
      return { pathD: d, waypoints: allPts };
    }
  }

  // Caso 3B: Conexão distante dentro do rack elétrico superior separada por módulos
  if (p1.y <= 205 && p2.y <= 205 && Math.abs(p2.x - p1.x) > 200) {
    const channelY = 222 + (connIndex % 4) * 5;
    const midX = (p1.x + p2.x) / 2;
    const b1 = sampleCubicBezier(p1, { x: p1.x + 10, y: channelY }, { x: p1.x + 80, y: channelY }, { x: midX, y: channelY });
    const b2 = sampleCubicBezier({ x: midX, y: channelY }, { x: p2.x - 40, y: channelY }, { x: p2.x, y: channelY }, p2);
    const allPts = [...b1, ...b2];
    const d = `M ${p1.x} ${p1.y} C ${p1.x + 10} ${channelY}, ${p1.x + 80} ${channelY}, ${midX} ${channelY} C ${p2.x - 40} ${channelY}, ${p2.x} ${channelY}, ${p2.x} ${p2.y}`;
    return { pathD: d, waypoints: allPts };
  }

  // Caso 3C: Conexão no painel inferior que cruza sob o cilindro (ex: sensor magnético para solenoide da válvula)
  if (p1.y > 450 && p2.y <= 350) {
    const lowerY = 540 + (connIndex % 3) * 6;
    const midX = 800;
    const b1 = sampleCubicBezier(p1, { x: p1.x - 80, y: lowerY }, { x: midX + 80, y: lowerY }, { x: midX, y: lowerY });
    const b2 = sampleCubicBezier({ x: midX, y: lowerY }, { x: 520, y: lowerY }, { x: 520, y: 320 }, p2);
    const allPts = [...b1, ...b2];
    const d = `M ${p1.x} ${p1.y} C ${p1.x - 80} ${lowerY}, ${midX + 80} ${lowerY}, ${midX} ${lowerY} C 520 ${lowerY}, 520 320, ${p2.x} ${p2.y}`;
    return { pathD: d, waypoints: allPts };
  }

  // Fallback suave
  return {
    pathD: `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`,
    waypoints: pts,
  };
}

/**
 * Função principal de cálculo do roteamento de todas as conexões da bancada.
 */
export function calculateRoutedConnections(
  connections: VirtualConnection[],
  components: BenchComponent[]
): RoutedConnection[] {
  return connections.map((conn, index) => {
    const sourceComp = components.find((c) => c.id === conn.fromComponentId);
    const targetComp = components.find((c) => c.id === conn.toComponentId);

    if (!sourceComp || !targetComp) {
      return {
        connection: conn,
        coords: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          sourceComp: sourceComp || components[0],
          targetComp: targetComp || components[0],
          sourcePort: sourceComp?.ports[0] || ({} as ComponentPort),
          targetPort: targetComp?.ports[0] || ({} as ComponentPort),
        },
        waypoints: [],
        pathD: 'M 0 0',
        isPneumatic: true,
        isGroundWire: false,
        laneIndex: index,
        controlHandle: { x: 0, y: 0 },
        lengthMm: 0,
      };
    }

    const sourcePort = sourceComp.ports.find((p) => p.id === conn.fromPortId) || sourceComp.ports[0];
    const targetPort = targetComp.ports.find((p) => p.id === conn.toPortId) || targetComp.ports[0];

    const p1 = getPortWorldCoordinates(sourceComp, sourcePort);
    const p2 = getPortWorldCoordinates(targetComp, targetPort);

    const isPneumatic = sourcePort.type === 'pneumatic';
    const isGroundWire =
      !isPneumatic &&
      (sourcePort.functionType === 'ground_0v' ||
        targetPort.functionType === 'ground_0v' ||
        sourcePort.name.includes('0V') ||
        targetPort.name.includes('0V') ||
        sourceComp.type === 'terminal_strip_0v' ||
        targetComp.type === 'terminal_strip_0v');

    const obstacles = getComponentObstacles(components, sourceComp.id, targetComp.id);
    const { pathD, waypoints } = generateCurvedPath(
      p1,
      p2,
      obstacles,
      index,
      conn.customControlPoint,
      conn.customSag
    );

    const lengthMm = calculatePolylineLength(waypoints);
    const midIdx = Math.floor(waypoints.length / 2);
    const controlHandle = conn.customControlPoint || (waypoints[midIdx] || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });

    return {
      connection: conn,
      coords: {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        sourceComp,
        targetComp,
        sourcePort,
        targetPort,
      },
      waypoints,
      pathD,
      isPneumatic,
      isGroundWire,
      laneIndex: index,
      controlHandle,
      lengthMm,
    };
  });
}
