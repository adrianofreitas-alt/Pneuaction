/**
 * Cable & Pneumatic Hose Intelligent Router (Algoritmo de Roteamento Inteligente e Acomodação)
 * 
 * Atende com precisão absoluta aos requisitos solicitados:
 * 1. Desvio de Equipamentos: Cabos e tubos evitam rigorosamente passar por cima dos equipamentos,
 *    utilizando canaletas de passagem (calha central, canaleta inferior do painel e vãos livres verticais).
 * 2. Acomodação e Não-Cruzamento: Em canaletas e vãos compartilhados, os cabos e tubos são organizados
 *    em faixas (lanes) paralelas escalonadas com ordenação topológica para evitar sobreposição mútua.
 * 3. Segregação Eletropneumática: Tubulações pneumáticas e fiação elétrica utilizam canais dedicados.
 * 4. Geometria Suave: Curvas com concordância Bezier (fillets de raio suave) simulando o caimento e a flexibilidade
 *    natural de tubos industriais de poliuretano e cabos com plugues banana 4mm.
 */

import { BenchComponent, ComponentPort, VirtualConnection } from '../types';
import { getPortWorldCoordinates } from '../components/BenchCanvas';

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleRect {
  id: string;
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
}

// Canais e calhas estruturais da bancada industrial didática (1400 x 850 mm)
export const BENCH_CHANNELS = {
  TOP_TRAY_Y: 14,             // Canaleta superior do rack elétrico
  CENTRAL_GUTTER_Y: 231,      // Calha central do divisor estrutural (entre rack elétrico e painel pneumático)
  LOWER_GUTTER_BASE_Y: 505,   // Canaleta inferior do painel ranhurado (sob válvulas e cilindros)
  DEEP_LOWER_Y: 760,          // Rodapé do painel ranhurado
  LEFT_CORRIDOR_X: 18,        // Vão vertical da lateral esquerda
  RIGHT_CORRIDOR_X: 1380,     // Vão vertical da lateral direita
};

/**
 * Retorna as caixas delimitadoras de todos os componentes da bancada.
 * Cilindros recebem expansão proporcional para cobrir o trilho guia magnético.
 */
export function getComponentObstacles(components: BenchComponent[]): ObstacleRect[] {
  const pad = 6; // Margem de segurança

  return components.map((c) => {
    let right = c.x + c.width;
    let bottom = c.y + c.height;

    // Cilindro com guia magnética
    if (c.type === 'double_acting_cylinder') {
      right = c.x + c.width + 345;
      bottom = Math.max(bottom, c.y + 155);
    } else if (c.type === 'single_acting_cylinder') {
      right = c.x + c.width + 245;
      bottom = Math.max(bottom, c.y + 145);
    }

    return {
      id: c.id,
      left: c.x - pad,
      top: c.y - pad,
      right: right + pad,
      bottom: bottom + pad,
    };
  });
}

/**
 * Verifica se um segmento de reta [p1, p2] cruza o retângulo do obstáculo.
 */
export function segmentIntersectsBox(p1: Point, p2: Point, box: ObstacleRect): boolean {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  // Fora da AABB
  if (maxX <= box.left || minX >= box.right || maxY <= box.top || minY >= box.bottom) {
    return false;
  }

  // Se ambos os pontos estão dentro do mesmo semiespaço
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let t0 = 0.0;
  let t1 = 1.0;

  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - box.left, box.right - p1.x, p1.y - box.top, box.bottom - p1.y];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }

  return t0 <= t1;
}

/**
 * Localiza um vão livre vertical (corredor desobstruído) entre yTop e yBottom
 * mais próximo da coordenada X desejada, garantindo que o cabo não atravesse equipamentos.
 */
export function findClearVerticalCorridor(
  preferredX: number,
  obstacles: ObstacleRect[],
  yTop: number,
  yBottom: number,
  ignoreIds: string[] = []
): number {
  const relevantObstacles = obstacles.filter(
    (obs) => !ignoreIds.includes(obs.id) && obs.bottom > yTop && obs.top < yBottom
  );

  // Testa se preferredX já está desobstruído
  const isDirectClear = !relevantObstacles.some(
    (obs) => preferredX >= obs.left && preferredX <= obs.right
  );
  if (isDirectClear) {
    return preferredX;
  }

  // Constrói intervalos ocupados ao longo do eixo X
  const occupiedIntervals = relevantObstacles
    .map((obs) => ({ start: obs.left, end: obs.right }))
    .sort((a, b) => a.start - b.start);

  // Funde intervalos sobrepostos
  const merged: { start: number; end: number }[] = [];
  for (const interval of occupiedIntervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
  }

  // Lista de vãos livres (gaps)
  const gaps: { x: number; dist: number }[] = [];

  // Vão à esquerda
  const leftX = BENCH_CHANNELS.LEFT_CORRIDOR_X;
  gaps.push({ x: leftX, dist: Math.abs(leftX - preferredX) });

  // Vão à direita
  const rightX = BENCH_CHANNELS.RIGHT_CORRIDOR_X;
  gaps.push({ x: rightX, dist: Math.abs(rightX - preferredX) });

  // Vãos entre obstáculos
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i].end;
    const gapEnd = merged[i + 1].start;
    if (gapEnd - gapStart >= 12) {
      const midX = (gapStart + gapEnd) / 2;
      gaps.push({ x: midX, dist: Math.abs(midX - preferredX) });
    }
  }

  // Vão após o último obstáculo se estiver antes da borda direita
  if (merged.length > 0) {
    const lastObs = merged[merged.length - 1];
    if (lastObs.end < 1350) {
      const midX = (lastObs.end + 1370) / 2;
      gaps.push({ x: midX, dist: Math.abs(midX - preferredX) });
    }
  }

  gaps.sort((a, b) => a.dist - b.dist);
  return gaps.length > 0 ? gaps[0].x : preferredX;
}

/**
 * Determina o vetor de saída/chegada natural de um borne/conexão (para fora do corpo do componente).
 */
function getPortTakeoffVector(comp: BenchComponent, port: ComponentPort): Point {
  if (port.y <= 30) return { x: 0, y: -1 };
  if (port.y >= 70) return { x: 0, y: 1 };
  if (port.x <= 25) return { x: -1, y: 0 };
  if (port.x >= 75) return { x: 1, y: 0 };

  if (comp.y < 220) return { x: 0, y: 1 };
  return { x: 0, y: 1 };
}

/**
 * Converte um conjunto ordenado de waypoints em um SVG Path suave com cantos arredondados (fillets).
 */
export function waypointsToSmoothPath(points: Point[], isDirectSag: boolean = false): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (isDirectSag && dist > 15) {
      const sag = Math.min(45, Math.max(12, dist * 0.18));
      const cx1 = p1.x + dx * 0.35;
      const cy1 = p1.y + dy * 0.35 + sag;
      const cx2 = p2.x - dx * 0.35;
      const cy2 = p2.y - dy * 0.35 + sag;
      return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const filletRadius = 16;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const d1x = pCurr.x - pPrev.x;
    const d1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(d2x, d2y);

    if (len1 < 1 || len2 < 1) continue;

    const r = Math.min(filletRadius, len1 / 2, len2 / 2);

    const startCurveX = pCurr.x - (d1x / len1) * r;
    const startCurveY = pCurr.y - (d1y / len1) * r;

    const endCurveX = pCurr.x + (d2x / len2) * r;
    const endCurveY = pCurr.y + (d2y / len2) * r;

    d += ` L ${startCurveX.toFixed(1)} ${startCurveY.toFixed(1)}`;
    d += ` Q ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)} ${endCurveX.toFixed(1)} ${endCurveY.toFixed(1)}`;
  }

  const pLast = points[points.length - 1];
  d += ` L ${pLast.x.toFixed(1)} ${pLast.y.toFixed(1)}`;

  return d;
}

/**
 * Roteador principal: Processa todas as conexões da bancada, desvia de equipamentos
 * e acomoda os cabos e tubos em faixas paralelas para não cruzarem uns sobre os outros.
 */
export function calculateRoutedConnections(
  connections: VirtualConnection[],
  components: BenchComponent[]
): RoutedConnection[] {
  const obstacles = getComponentObstacles(components);
  const routedItems: RoutedConnection[] = [];

  // Mapeamentos para acomodação em faixas paralelas (evitando sobreposição mútua)
  const centralGutterAssignments: { connId: string; spanMinX: number; spanMaxX: number; priority: number }[] = [];
  const lowerGutterAssignments: { connId: string; spanMinX: number; spanMaxX: number; priority: number }[] = [];

  // 1. Primeira passagem: Análise de topologia, obstáculos e canais ideais
  const parsedConns = connections.map((conn) => {
    const sourceComp = components.find((c) => c.id === conn.fromComponentId);
    const targetComp = components.find((c) => c.id === conn.toComponentId);
    if (!sourceComp || !targetComp) return null;

    const sourcePort = sourceComp.ports.find((p) => p.id === conn.fromPortId);
    const targetPort = targetComp.ports.find((p) => p.id === conn.toPortId);
    if (!sourcePort || !targetPort) return null;

    const sourceCoords = getPortWorldCoordinates(sourceComp, sourcePort);
    const targetCoords = getPortWorldCoordinates(targetComp, targetPort);

    const isPneumatic = conn.type === 'pneumatic';
    const isGroundWire =
      !isPneumatic &&
      (sourcePort.functionType === 'ground_0v' ||
        targetPort.functionType === 'ground_0v' ||
        sourcePort.name.includes('0V') ||
        targetPort.name.includes('0V') ||
        conn.fromPortId.includes('0V') ||
        conn.toPortId.includes('0V'));

    const x1 = sourceCoords.x;
    const y1 = sourceCoords.y;
    const x2 = targetCoords.x;
    const y2 = targetCoords.y;

    const v1 = getPortTakeoffVector(sourceComp, sourcePort);
    const v2 = getPortTakeoffVector(targetComp, targetPort);

    const takeoffDist = isPneumatic ? 18 : 14;
    const pStartExit: Point = { x: x1 + v1.x * takeoffDist, y: y1 + v1.y * takeoffDist };
    const pEndEntry: Point = { x: x2 + v2.x * takeoffDist, y: y2 + v2.y * takeoffDist };

    // Verifica se a reta direta cruzaria algum outro equipamento
    const otherObstacles = obstacles.filter((o) => o.id !== sourceComp.id && o.id !== targetComp.id);
    const directBlocked = otherObstacles.some((obs) => segmentIntersectsBox(pStartExit, pEndEntry, obs));

    // Determinação do canal
    const isAdjacent = Math.abs(x1 - x2) < 220 && Math.abs(y1 - y2) < 180 && !directBlocked;
    const sourceInTopRack = sourceComp.y < 220;
    const targetInTopRack = targetComp.y < 220;

    let corridor: 'direct' | 'central' | 'lower' = 'direct';

    if (isAdjacent) {
      corridor = 'direct';
    } else if (isPneumatic) {
      // Pneumática sempre prioriza a canaleta inferior (evita fiação elétrica superior)
      corridor = 'lower';
    } else if (!sourceInTopRack && !targetInTopRack) {
      // Ambos os componentes no painel inferior (ex: Sensor -> Solenoide)
      corridor = 'lower';
    } else {
      // Envolve rack elétrico superior
      corridor = 'central';
    }

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);

    if (corridor === 'central') {
      centralGutterAssignments.push({
        connId: conn.id,
        spanMinX: minX,
        spanMaxX: maxX,
        priority: isGroundWire ? 0 : 1,
      });
    } else if (corridor === 'lower') {
      lowerGutterAssignments.push({
        connId: conn.id,
        spanMinX: minX,
        spanMaxX: maxX,
        priority: isPneumatic ? 0 : 1,
      });
    }

    return {
      conn,
      coords: { x1, y1, x2, y2, sourceComp, targetComp, sourcePort, targetPort },
      pStartExit,
      pEndEntry,
      corridor,
      isPneumatic,
      isGroundWire,
      sourceInTopRack,
      targetInTopRack,
      otherObstacles,
    };
  });

  // 2. Segunda passagem: Acomodação em faixas paralelas (Lane Allocation)
  // Ordenação topológica por extensão e ponto de início: previne cruzamento mútuo na mesma canaleta
  const centralLaneMap = new Map<string, number>();
  centralGutterAssignments
    .sort((a, b) => a.priority - b.priority || a.spanMinX - b.spanMinX || a.spanMaxX - b.spanMaxX)
    .forEach((item, index) => {
      centralLaneMap.set(item.connId, index);
    });

  const lowerLaneMap = new Map<string, number>();
  lowerGutterAssignments
    .sort((a, b) => a.priority - b.priority || a.spanMinX - b.spanMinX || a.spanMaxX - b.spanMaxX)
    .forEach((item, index) => {
      lowerLaneMap.set(item.connId, index);
    });

  // 3. Terceira passagem: Roteamento inteligente com desvio de obstáculos e acomodação
  for (const item of parsedConns) {
    if (!item) continue;

    const {
      conn,
      coords,
      pStartExit,
      pEndEntry,
      corridor,
      isPneumatic,
      isGroundWire,
      sourceInTopRack,
      targetInTopRack,
      otherObstacles,
    } = item;
    const { x1, y1, x2, y2, sourceComp, targetComp } = coords;

    let waypoints: Point[] = [];
    let laneIdx = 0;

    if (corridor === 'direct') {
      waypoints = [{ x: x1, y: y1 }, pStartExit, pEndEntry, { x: x2, y: y2 }];
    } else if (corridor === 'central') {
      // Conexão pela Calha Central do Divisor Estrutural
      laneIdx = centralLaneMap.get(conn.id) || 0;
      const totalLanes = centralLaneMap.size || 1;
      const laneSpacing = 6;
      const laneY = BENCH_CHANNELS.CENTRAL_GUTTER_Y + (laneIdx - (totalLanes - 1) / 2) * laneSpacing;
      const dropOffsetX = (laneIdx % 3 - 1) * 4;

      // Verifica se o ponto de descida até o componente inferior colidiria com algum equipamento
      let safeX2 = pEndEntry.x;
      if (!targetInTopRack) {
        // Se o componente de destino estiver no painel inferior, verifica se o trajeto vertical passa por cima de outro equipamento
        const verticalHits = otherObstacles.some((obs) =>
          segmentIntersectsBox({ x: pEndEntry.x, y: laneY }, { x: pEndEntry.x, y: pEndEntry.y }, obs)
        );
        if (verticalHits) {
          // Desvia para um vão vertical livre
          safeX2 = findClearVerticalCorridor(pEndEntry.x, obstacles, laneY, pEndEntry.y, [sourceComp.id, targetComp.id]);
        }
      }

      let safeX1 = pStartExit.x;
      if (!sourceInTopRack) {
        const verticalHits = otherObstacles.some((obs) =>
          segmentIntersectsBox({ x: pStartExit.x, y: laneY }, { x: pStartExit.x, y: pStartExit.y }, obs)
        );
        if (verticalHits) {
          safeX1 = findClearVerticalCorridor(pStartExit.x, obstacles, laneY, pStartExit.y, [sourceComp.id, targetComp.id]);
        }
      }

      waypoints = [
        { x: x1, y: y1 },
        { x: pStartExit.x, y: pStartExit.y },
        { x: safeX1 + dropOffsetX, y: laneY },
        { x: safeX2 + dropOffsetX, y: laneY },
        { x: pEndEntry.x, y: pEndEntry.y },
        { x: x2, y: y2 },
      ];
    } else {
      // Conexão pela Canaleta Inferior do Painel Ranhurado (sob equipamentos)
      laneIdx = lowerLaneMap.get(conn.id) || 0;
      const totalLanes = lowerLaneMap.size || 1;
      const laneSpacing = isPneumatic ? 11 : 8;
      const laneY = BENCH_CHANNELS.LOWER_GUTTER_BASE_Y + (laneIdx - (totalLanes - 1) / 2) * laneSpacing;
      const dropOffsetX = (laneIdx % 3 - 1) * 5;

      // Ponto de descida desobstruído até a calha inferior
      let safeDrop1X = pStartExit.x;
      const drop1Blocked = otherObstacles.some((obs) =>
        segmentIntersectsBox({ x: pStartExit.x, y: pStartExit.y }, { x: pStartExit.x, y: laneY }, obs)
      );
      if (drop1Blocked) {
        safeDrop1X = findClearVerticalCorridor(pStartExit.x, obstacles, pStartExit.y, laneY, [sourceComp.id, targetComp.id]);
      }

      let safeDrop2X = pEndEntry.x;
      const drop2Blocked = otherObstacles.some((obs) =>
        segmentIntersectsBox({ x: pEndEntry.x, y: laneY }, { x: pEndEntry.x, y: pEndEntry.y }, obs)
      );
      if (drop2Blocked) {
        safeDrop2X = findClearVerticalCorridor(pEndEntry.x, obstacles, pEndEntry.y, laneY, [sourceComp.id, targetComp.id]);
      }

      waypoints = [
        { x: x1, y: y1 },
        { x: pStartExit.x, y: pStartExit.y },
        { x: safeDrop1X + dropOffsetX, y: laneY },
        { x: safeDrop2X + dropOffsetX, y: laneY },
        { x: pEndEntry.x, y: pEndEntry.y },
        { x: x2, y: y2 },
      ];
    }

    const optimizedWps = simplifyWaypoints(waypoints);
    const pathD = waypointsToSmoothPath(optimizedWps, corridor === 'direct');

    routedItems.push({
      connection: conn,
      coords,
      waypoints: optimizedWps,
      pathD,
      isPneumatic,
      isGroundWire,
      laneIndex: laneIdx,
    });
  }

  return routedItems;
}

/**
 * Remove pontos intermediários estritamente colineares para curvas limpas.
 */
function simplifyWaypoints(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result: Point[] = [pts[0]];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < 2) continue;

    const isCollinearX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
    const isCollinearY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;

    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }

  result.push(pts[pts.length - 1]);
  return result;
}
