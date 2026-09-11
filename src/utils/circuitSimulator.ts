import { BenchComponent, ComponentPort, SensorTechnology, SensorWireCount, VirtualConnection } from '../types';

/**
 * Retorna a lista de portas normalizada segundo o padrão industrial IEC 60947-5-2
 * para sensores de 2 fios, 3 fios ou 4 fios, preservando IDs de portas existentes.
 */
export function getSensorPorts(
  wireCount: SensorWireCount = '3_wires',
  existingPorts?: ComponentPort[]
): ComponentPort[] {
  const findPortId = (match: string) => {
    const existing = existingPorts?.find(p => p.name.toLowerCase().includes(match.toLowerCase()));
    return existing ? existing.id : `port_s_${match.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`;
  };

  if (wireCount === '2_wires') {
    return [
      {
        id: findPortId('BN'),
        name: 'BN (+24V / L+)',
        type: 'electrical',
        functionType: 'power_24v',
        x: 32,
        y: 91
      },
      {
        id: findPortId('BU') || findPortId('Sinal'),
        name: 'BU (Sinal / Carga)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 68,
        y: 91
      }
    ];
  }

  if (wireCount === '4_wires') {
    return [
      {
        id: findPortId('BN'),
        name: 'BN (+24V)',
        type: 'electrical',
        functionType: 'power_24v',
        x: 15,
        y: 91
      },
      {
        id: findPortId('WH') || findPortId('NF'),
        name: 'WH (Sinal NF)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 38,
        y: 91
      },
      {
        id: findPortId('BK') || findPortId('NA') || findPortId('Sinal'),
        name: 'BK (Sinal NA)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 62,
        y: 91
      },
      {
        id: findPortId('BU'),
        name: 'BU (0V)',
        type: 'electrical',
        functionType: 'ground_0v',
        x: 85,
        y: 91
      }
    ];
  }

  // Default: 3 fios (Standard Industrial PNP)
  return [
    {
      id: findPortId('BN'),
      name: 'BN (+24V)',
      type: 'electrical',
      functionType: 'power_24v',
      x: 18,
      y: 91
    },
    {
      id: findPortId('BU'),
      name: 'BU (0V)',
      type: 'electrical',
      functionType: 'ground_0v',
      x: 82,
      y: 91
    },
    {
      id: findPortId('BK') || findPortId('Sinal'),
      name: 'BK (Sinal)',
      type: 'electrical',
      functionType: 'sensor_sig',
      x: 50,
      y: 91
    }
  ];
}

export interface CircuitEvaluationResult {
  hasElectricalPower: boolean;
  nodes24V: Set<string>; // Set of port IDs energized with +24V
  nodes0V: Set<string>;   // Set of port IDs connected to 0V ground
  sensorStatuses: Map<string, {
    isPowerCorrect: boolean;
    errorDetail?: string;
    isDetected: boolean;
    outputNAactive: boolean;
    outputNFactive: boolean;
  }>;
  relayStatuses?: Map<string, {
    isCoilEnergized: boolean;
    isPowered?: boolean;
  }>;
  solenoidY1Active: boolean;
  solenoidY2Active: boolean;
}

/**
 * Avalia a malha elétrica da bancada em tempo real com base na IEC 60204-1 / NR-12:
 * - Rastreia a propagação de +24V e 0V
 * - Avalia se cada sensor possui alimentação correta (BN no +24V e BU no 0V)
 * - Determina a comutação das saídas (BK/WH) e energização das solenoides (Y1/Y2)
 */
export function evaluateCircuitElectricalState(
  components: BenchComponent[],
  connections: VirtualConnection[],
  isEmergencyActive: boolean
): CircuitEvaluationResult {
  const powerSupply = components.find(c => c.type === 'power_supply_24v');
  const isPsOn = powerSupply ? powerSupply.state.activated !== false : true;
  const hasElectricalPower = !isEmergencyActive && isPsOn;

  const nodes24V = new Set<string>();
  const nodes0V = new Set<string>();

  // Map to easily look up which component owns a port
  const portToCompMap = new Map<string, { comp: BenchComponent; port: ComponentPort }>();
  components.forEach(comp => {
    comp.ports.forEach(port => {
      portToCompMap.set(port.id, { comp, port });
    });
  });

  // Helper to get connected ports for a given port ID
  const getNeighbors = (portId: string): string[] => {
    const neighbors: string[] = [];
    connections.forEach(conn => {
      if (conn.type !== 'electrical') return;
      if (conn.fromPortId === portId) neighbors.push(conn.toPortId);
      if (conn.toPortId === portId) neighbors.push(conn.fromPortId);
    });
    return neighbors;
  };

  // 1. Seed 0V nodes from Power Supply 0V ports
  if (powerSupply) {
    powerSupply.ports.forEach(p => {
      if (p.functionType === 'ground_0v' || p.name.includes('0V')) {
        nodes0V.add(p.id);
      }
    });
  }

  // Propagate 0V through electrical connections and 0V bus terminal strips
  const queue0V = Array.from(nodes0V);
  const process0VQueue = () => {
    while (queue0V.length > 0) {
      const current = queue0V.shift()!;
      const neighbors = getNeighbors(current);
      for (const n of neighbors) {
        if (!nodes0V.has(n)) {
          nodes0V.add(n);
          queue0V.push(n);
        }
      }
    }
  };
  process0VQueue();

  // Equipotential bus for 0V Terminal Strip (todos os bornes interligados internamente)
  const strip0V = components.find(c => c.type === 'terminal_strip_0v');
  if (strip0V && strip0V.ports.some(p => nodes0V.has(p.id))) {
    strip0V.ports.forEach(p => {
      if (!nodes0V.has(p.id)) {
        nodes0V.add(p.id);
        queue0V.push(p.id);
      }
    });
    process0VQueue();
  }

  // 2. Seed +24V nodes from Power Supply +24V ports (only if active)
  if (hasElectricalPower && powerSupply) {
    powerSupply.ports.forEach(p => {
      if (p.functionType === 'power_24v' || p.name.includes('+24V')) {
        nodes24V.add(p.id);
      }
    });
  }

  // Helper to expand +24V through direct connections and closed contacts
  const expand24V = () => {
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
      changed = false;
      iterations++;

      // Equipotential bus bridging for +24V Terminal Strip (todos os bornes interligados internamente)
      const strip24V = components.find(c => c.type === 'terminal_strip_24v');
      if (strip24V && hasElectricalPower && strip24V.ports.some(p => nodes24V.has(p.id))) {
        strip24V.ports.forEach(p => {
          if (!nodes24V.has(p.id)) {
            nodes24V.add(p.id);
            changed = true;
          }
        });
      }

      // Direct wire propagation
      const current24 = Array.from(nodes24V);
      for (const pId of current24) {
        const neighbors = getNeighbors(pId);
        for (const n of neighbors) {
          if (!nodes24V.has(n)) {
            nodes24V.add(n);
            changed = true;
          }
        }
      }

      // Component internal contact bridging
      components.forEach(comp => {
        // Emergency Stop Button: NF 21-22 closed when NOT triggered
        if (comp.type === 'emergency_stop_button') {
          const p21 = comp.ports.find(p => p.name.includes('21'));
          const p22 = comp.ports.find(p => p.name.includes('22'));
          const isClosed = !isEmergencyActive && !comp.state.isEmergencyTriggered;
          if (p21 && p22 && isClosed) {
            if (nodes24V.has(p21.id) && !nodes24V.has(p22.id)) {
              nodes24V.add(p22.id);
              changed = true;
            } else if (nodes24V.has(p22.id) && !nodes24V.has(p21.id)) {
              nodes24V.add(p21.id);
              changed = true;
            }
          }
        }

        // Push Button Station: NA 13-14 (closed when pressed) and NF 21-22 (closed when NOT pressed)
        if (comp.type === 'push_button_station') {
          const p13 = comp.ports.find(p => p.name.includes('13'));
          const p14 = comp.ports.find(p => p.name.includes('14'));
          if (p13 && p14 && comp.state.buttonNApressed) {
            if (nodes24V.has(p13.id) && !nodes24V.has(p14.id)) {
              nodes24V.add(p14.id);
              changed = true;
            } else if (nodes24V.has(p14.id) && !nodes24V.has(p13.id)) {
              nodes24V.add(p13.id);
              changed = true;
            }
          }

          const p21 = comp.ports.find(p => p.name.includes('21'));
          const p22 = comp.ports.find(p => p.name.includes('22'));
          if (p21 && p22 && !comp.state.buttonNFpressed) {
            if (nodes24V.has(p21.id) && !nodes24V.has(p22.id)) {
              nodes24V.add(p22.id);
              changed = true;
            } else if (nodes24V.has(p22.id) && !nodes24V.has(p21.id)) {
              nodes24V.add(p21.id);
              changed = true;
            }
          }
        }

        // Industrial Relay: 4 Contatos Reversíveis (COM, NA, NF)
        if (comp.type === 'industrial_relay') {
          const pA1 = comp.ports.find(p => p.name.includes('A1'));
          const pA2 = comp.ports.find(p => p.name.includes('A2'));
          const isCoilEnergized = Boolean(pA1 && pA2 && nodes24V.has(pA1.id) && nodes0V.has(pA2.id));
          const isRelayOn = isCoilEnergized || Boolean(comp.state?.isRelaySwitched);

          const bridge = (portA?: { id: string }, portB?: { id: string }) => {
            if (!portA || !portB) return;
            if (nodes24V.has(portA.id) && !nodes24V.has(portB.id)) {
              nodes24V.add(portB.id);
              changed = true;
            } else if (nodes24V.has(portB.id) && !nodes24V.has(portA.id)) {
              nodes24V.add(portA.id);
              changed = true;
            }
          };

          // Contato 1: COM, NA, NF
          const p11 = comp.ports.find(p => p.name.includes('COM 1') || p.name.includes('11') || p.name.includes('13') || (p.name.includes('COM') && !p.name.includes('2') && !p.name.includes('3') && !p.name.includes('4')));
          const p14 = comp.ports.find(p => p.name.includes('NA 1') || p.name.includes('14') || (p.name.includes('NA') && !p.name.includes('2') && !p.name.includes('3') && !p.name.includes('4')));
          const p12 = comp.ports.find(p => p.name.includes('NF 1') || p.name.includes('12') || (p.name.includes('NF') && !p.name.includes('2') && !p.name.includes('3') && !p.name.includes('4')));
          if (isRelayOn) {
            bridge(p11, p14);
          } else {
            bridge(p11, p12);
          }

          // Contato 2: COM, NA, NF
          const p21 = comp.ports.find(p => p.name.includes('COM 2') || p.name.includes('21'));
          const p24 = comp.ports.find(p => p.name.includes('NA 2') || p.name.includes('24'));
          const p22 = comp.ports.find(p => p.name.includes('NF 2') || p.name.includes('22'));
          if (isRelayOn) {
            bridge(p21, p24);
          } else {
            bridge(p21, p22);
          }

          // Contato 3: COM, NA, NF
          const p31 = comp.ports.find(p => p.name.includes('COM 3') || p.name.includes('31'));
          const p34 = comp.ports.find(p => p.name.includes('NA 3') || p.name.includes('34'));
          const p32 = comp.ports.find(p => p.name.includes('NF 3') || p.name.includes('32'));
          if (isRelayOn) {
            bridge(p31, p34);
          } else {
            bridge(p31, p32);
          }

          // Contato 4: COM, NA, NF
          const p41 = comp.ports.find(p => p.name.includes('COM 4') || p.name.includes('41'));
          const p44 = comp.ports.find(p => p.name.includes('NA 4') || p.name.includes('44'));
          const p42 = comp.ports.find(p => p.name.includes('NF 4') || p.name.includes('42'));
          if (isRelayOn) {
            bridge(p41, p44);
          } else {
            bridge(p41, p42);
          }
        }

        // Timer Relays: On-Delay e Off-Delay (2 Contatos Reversíveis COM, NF, NA)
        if (comp.type === 'industrial_relay_on_delay' || comp.type === 'industrial_relay_off_delay') {
          const isSwitched = Boolean(comp.state?.isRelaySwitched);

          const bridge = (portA?: { id: string }, portB?: { id: string }) => {
            if (!portA || !portB) return;
            if (nodes24V.has(portA.id) && !nodes24V.has(portB.id)) {
              nodes24V.add(portB.id);
              changed = true;
            } else if (nodes24V.has(portB.id) && !nodes24V.has(portA.id)) {
              nodes24V.add(portA.id);
              changed = true;
            }
          };

          // Contato 1: COM 1, NA 1, NF 1
          const p11 = comp.ports.find(p => p.name.includes('COM 1'));
          const p14 = comp.ports.find(p => p.name.includes('NA 1'));
          const p12 = comp.ports.find(p => p.name.includes('NF 1'));
          if (isSwitched) {
            bridge(p11, p14);
          } else {
            bridge(p11, p12);
          }

          // Contato 2: COM 2, NA 2, NF 2
          const p21 = comp.ports.find(p => p.name.includes('COM 2'));
          const p24 = comp.ports.find(p => p.name.includes('NA 2'));
          const p22 = comp.ports.find(p => p.name.includes('NF 2'));
          if (isSwitched) {
            bridge(p21, p24);
          } else {
            bridge(p21, p22);
          }
        }
      });
    }
  };

  // First expansion of 24V from source to buttons/sensors
  expand24V();

  // 3. Evaluate Sensors: check physical proximity and power supply compliance
  const sensorStatuses = new Map<string, {
    isPowerCorrect: boolean;
    errorDetail?: string;
    isDetected: boolean;
    outputNAactive: boolean;
    outputNFactive: boolean;
  }>();

  // Find cylinder to evaluate physical proximity
  const cyl = components.find(c => c.category === 'actuators');
  const cylPos = cyl?.state.position || 0;
  const cylRot = cyl?.rotation || 0;
  const strokeTravel = cyl?.type === 'single_acting_cylinder' ? 200 : 300;
  const strokeOffset = cyl?.type === 'single_acting_cylinder' ? 20 : 25;
  const rawSphereX = (cyl?.width || 250) + strokeOffset + (cylPos / 100) * strokeTravel;
  const rawSphereY = cyl?.type === 'single_acting_cylinder' ? 50 : 60;

  let sphereX = (cyl?.x || 0) + rawSphereX;
  let sphereY = (cyl?.y || 0) + rawSphereY;
  if (cyl && cylRot) {
    const cx = cyl.width / 2;
    const cy = cyl.height / 2;
    const dx = rawSphereX - cx;
    const dy = rawSphereY - cy;
    const rad = (cylRot * Math.PI) / 180;
    sphereX = cyl.x + cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
    sphereY = cyl.y + cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
  }

  const sensorComps = components.filter(c => c.category === 'sensors' || c.type === 'reed_switch_sensor');

  sensorComps.forEach(sensor => {
    const wires = sensor.state.sensorWires || '3_wires';

    // Atuação de sensores industriais de proximidade (Indutivo, Magnético, Óptico, Capacitivo):
    // A atuação ocorre quando a esfera da haste do cilindro estiver próxima do sensor e
    // alinhada pelo centro da tampa do sensor e o alinhamento vertical do centro da esfera.
    // Sem precisar haver contato físico (entreferro de ar visível dentro da faixa de detecção Sn).
    const sensorCapCenterX = sensor.x + sensor.width / 2; // Centro da tampa (X = 55 no sensor)
    const sensorCapCenterY = sensor.y + 15; // Centro da tampa do sensor
    const sensorCapTopY = sensor.y + 12; // Face externa/topo da tampa do sensor
    const sphereRadius = cyl?.type === 'single_acting_cylinder' ? 9 : 10;
    const sphereBottomY = sphereY + sphereRadius;

    // 1. Alinhamento vertical: centro da esfera alinhado com o centro da tampa do sensor
    const isVerticalAligned = Math.abs(sphereX - sensorCapCenterX) <= 16;

    // 2. Proximidade sem contato físico: esfera posicionada acima da tampa do sensor,
    // com entreferro livre de ar (sem colisão mecânica nem sobreposição) e dentro do alcance útil
    const verticalCenterDist = sensorCapCenterY - sphereY;
    const airGap = sensorCapTopY - sphereBottomY;
    const isNearWithoutContact = airGap >= 3 && verticalCenterDist >= 20 && verticalCenterDist <= 60;

    const isPhysicalMatch = isVerticalAligned && isNearWithoutContact;

    const bnPort = sensor.ports.find(p => p.name.includes('BN'));
    const buPort = sensor.ports.find(p => p.name.includes('BU'));
    const bkPort = sensor.ports.find(p => p.name.includes('BK'));
    const whPort = sensor.ports.find(p => p.name.includes('WH'));

    const hasBn24V = bnPort ? nodes24V.has(bnPort.id) : false;
    const hasBu0V = buPort ? nodes0V.has(buPort.id) : false;

    let isPowerCorrect = false;
    let errorDetail: string | undefined;
    let isDetected = false;
    let outputNAactive = false;
    let outputNFactive = false;

    if (!hasElectricalPower) {
      isPowerCorrect = false;
      errorDetail = isEmergencyActive ? 'Parada de Emergência Ativada' : 'Fonte 24V Desligada';
    } else if (wires === '3_wires') {
      if (hasBn24V && hasBu0V) {
        isPowerCorrect = true;
        if (isPhysicalMatch) {
          isDetected = true;
          outputNAactive = true;
          if (bkPort) nodes24V.add(bkPort.id);
        }
      } else {
        isPowerCorrect = false;
        if (!hasBn24V && !hasBu0V) {
          errorDetail = 'Desconectado: Ligue +24V no BN (Marrom) e 0V no BU (Azul)';
        } else if (!hasBn24V) {
          errorDetail = 'Falta ligar +24V no borne BN (Marrom)';
        } else {
          errorDetail = 'Falta ligar 0V (GND) no borne BU (Azul)';
        }
      }
    } else if (wires === '4_wires') {
      if (hasBn24V && hasBu0V) {
        isPowerCorrect = true;
        if (isPhysicalMatch) {
          isDetected = true;
          outputNAactive = true;
          outputNFactive = false;
          if (bkPort) nodes24V.add(bkPort.id);
        } else {
          isDetected = false;
          outputNAactive = false;
          outputNFactive = true;
          if (whPort) nodes24V.add(whPort.id);
        }
      } else {
        isPowerCorrect = false;
        if (!hasBn24V && !hasBu0V) {
          errorDetail = 'Desconectado: Ligue +24V no BN e 0V no BU';
        } else if (!hasBn24V) {
          errorDetail = 'Falta ligar +24V no borne BN (Marrom)';
        } else {
          errorDetail = 'Falta ligar 0V no borne BU (Azul)';
        }
      }
    } else if (wires === '2_wires') {
      // 2 Fios: sensor em série com a carga
      // BN deve ter +24V
      if (hasBn24V) {
        isPowerCorrect = true;
        if (isPhysicalMatch) {
          isDetected = true;
          outputNAactive = true;
          if (buPort) nodes24V.add(buPort.id);
        }
      } else {
        isPowerCorrect = false;
        errorDetail = 'Falta ligar +24V no borne BN (Marrom)';
      }
    }

    sensorStatuses.set(sensor.id, {
      isPowerCorrect,
      errorDetail,
      isDetected,
      outputNAactive,
      outputNFactive
    });
  });

  // Second expansion of 24V from energized sensor outputs to solenoids/loads
  expand24V();

  // 4. Evaluate Valve Solenoids Y1 and Y2
  const valve = components.find(c => c.category === 'valves');
  let solenoidY1Active = false;
  let solenoidY2Active = false;

  if (valve) {
    // Solenoid Y1: Port 5 is (+) A1, Port 6 is (-) A2
    const y1Pos = valve.ports.find(p => p.name.includes('Y1 (+)') || p.name.includes('14 (Y1)'));
    const y1Neg = valve.ports.find(p => p.name.includes('Y1 (-)') || (p.functionType === 'ground_0v' && p.name.includes('Y1')));
    if (y1Pos && y1Neg) {
      if (nodes24V.has(y1Pos.id) && nodes0V.has(y1Neg.id)) {
        solenoidY1Active = true;
      }
    }

    // Solenoid Y2: Port 7 is (+) A1, Port 8 is (-) A2
    const y2Pos = valve.ports.find(p => p.name.includes('Y2 (+)') || p.name.includes('12 (Y2)'));
    const y2Neg = valve.ports.find(p => p.name.includes('Y2 (-)') || (p.functionType === 'ground_0v' && p.name.includes('Y2')));
    if (y2Pos && y2Neg) {
      if (nodes24V.has(y2Pos.id) && nodes0V.has(y2Neg.id)) {
        solenoidY2Active = true;
      }
    }
  }

  // 5. Evaluate Relays Coil and Power Status
  const relayStatuses = new Map<string, { isCoilEnergized: boolean; isPowered?: boolean }>();
  components.filter(c => c.type === 'industrial_relay' || c.type === 'industrial_relay_on_delay' || c.type === 'industrial_relay_off_delay').forEach(r => {
    const pA1 = r.ports.find(p => p.name.includes('A1'));
    const pA2 = r.ports.find(p => p.name.includes('A2'));
    const isCoilEnergized = Boolean(pA1 && pA2 && nodes24V.has(pA1.id) && nodes0V.has(pA2.id));

    // Para relés temporizadores: verificar alimentação nos bornes 24VCC e 0V
    let isPowered = true;
    if (r.type === 'industrial_relay_on_delay' || r.type === 'industrial_relay_off_delay') {
      const p24V = r.ports.find(p => p.name.includes('24V'));
      const p0V = r.ports.find(p => p.name.includes('0V'));
      isPowered = Boolean(p24V && p0V && nodes24V.has(p24V.id) && nodes0V.has(p0V.id));
    }

    relayStatuses.set(r.id, { isCoilEnergized, isPowered });
  });

  return {
    hasElectricalPower,
    nodes24V,
    nodes0V,
    sensorStatuses,
    relayStatuses,
    solenoidY1Active,
    solenoidY2Active
  };
}

export interface ConnectionFlowResult {
  activeConnIds: Set<string>;
  exhaustConnIds: Set<string>;
}

/**
 * Determina se cada conexão física (tubo pneumático ou cabo elétrico)
 * possui fluxo de ar ativo ou circulação contínua de corrente elétrica.
 * Conexões com fluxo ativo exibem os traços brancos animados (stroke="#ffffff").
 * Conexões de exaustão de ar do cilindro para a eletroválvula são identificadas
 * para coloração amarela (#fef08a a #eab308) com traços no fluxo correto.
 * Conexões sem fluxo ou sem circulação de corrente permanecem na cor sólida original
 * do tubo de poliuretano e do isolamento do cabo elétrico, sem traços brancos.
 */
export function evaluateConnectionFlows(
  connections: VirtualConnection[],
  components: BenchComponent[],
  circuitEval: ReturnType<typeof evaluateCircuitElectricalState>,
  isSimulating: boolean
): ConnectionFlowResult {
  const activeConnIds = new Set<string>();
  const exhaustConnIds = new Set<string>();
  if (!isSimulating) return { activeConnIds, exhaustConnIds };

  const { nodes24V, nodes0V, hasElectricalPower } = circuitEval;

  // =========================================================================
  // 1. AVALIAÇÃO NÓ A NÓ DE CONDUÇÃO ELÉTRICA CONTÍNUA (MALHA FECHADA)
  // =========================================================================
  if (hasElectricalPower) {
    // 1.1 Localizar os bornes de saída de alimentação (+24V e 0V) da Fonte
    const powerSupply = components.find(c => c.type === 'power_supply_24v');
    const source24Ports = new Set<string>();
    const ground0Ports = new Set<string>();

    if (powerSupply) {
      powerSupply.ports.forEach(p => {
        if (p.functionType === 'power_24v' || p.name.includes('+24V')) {
          source24Ports.add(p.id);
        }
        if (p.functionType === 'ground_0v' || p.name.includes('0V')) {
          ground0Ports.add(p.id);
        }
      });
    }

    // 1.2 Mapear todas as cargas ativas (possuem 24V no polo positivo E 0V no polo negativo)
    const activeLoads: Array<{ posPortId: string; negPortId: string }> = [];

    components.forEach(comp => {
      // Bobina de Relé K1
      if (comp.type === 'industrial_relay') {
        const pA1 = comp.ports.find(p => p.name.includes('A1'));
        const pA2 = comp.ports.find(p => p.name.includes('A2'));
        if (pA1 && pA2 && nodes24V.has(pA1.id) && nodes0V.has(pA2.id)) {
          activeLoads.push({ posPortId: pA1.id, negPortId: pA2.id });
        }
      }

      // Relés Temporizadores TON / TOF
      if (comp.type === 'industrial_relay_on_delay' || comp.type === 'industrial_relay_off_delay') {
        const pA1 = comp.ports.find(p => p.name.includes('A1'));
        const pA2 = comp.ports.find(p => p.name.includes('A2'));
        if (pA1 && pA2 && nodes24V.has(pA1.id) && nodes0V.has(pA2.id)) {
          activeLoads.push({ posPortId: pA1.id, negPortId: pA2.id });
        }
        const p24V = comp.ports.find(p => p.name.includes('24V'));
        const p0V = comp.ports.find(p => p.name.includes('0V'));
        if (p24V && p0V && nodes24V.has(p24V.id) && nodes0V.has(p0V.id)) {
          activeLoads.push({ posPortId: p24V.id, negPortId: p0V.id });
        }
      }

      // Solenoides Y1 e Y2
      if (comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') {
        const y1Pos = comp.ports.find(p => p.name.includes('Y1 (+)') || p.name.includes('14 (Y1)'));
        const y1Neg = comp.ports.find(p => p.name.includes('Y1 (-)') || (p.functionType === 'ground_0v' && p.name.includes('Y1')));
        if (y1Pos && y1Neg && nodes24V.has(y1Pos.id) && nodes0V.has(y1Neg.id)) {
          activeLoads.push({ posPortId: y1Pos.id, negPortId: y1Neg.id });
        }

        const y2Pos = comp.ports.find(p => p.name.includes('Y2 (+)') || p.name.includes('12 (Y2)'));
        const y2Neg = comp.ports.find(p => p.name.includes('Y2 (-)') || (p.functionType === 'ground_0v' && p.name.includes('Y2')));
        if (y2Pos && y2Neg && nodes24V.has(y2Pos.id) && nodes0V.has(y2Neg.id)) {
          activeLoads.push({ posPortId: y2Pos.id, negPortId: y2Neg.id });
        }
      }

      // Sensores Industriais de Proximidade (Alimentação BN e BU)
      if (comp.type === 'reed_switch_sensor' || comp.category === 'sensors') {
        const bn = comp.ports.find(p => p.name.includes('BN'));
        const bu = comp.ports.find(p => p.name.includes('BU'));
        if (bn && bu && nodes24V.has(bn.id) && nodes0V.has(bu.id)) {
          activeLoads.push({ posPortId: bn.id, negPortId: bu.id });
        }
      }

      // Módulo de Sinalização Visual (LEDs) e Sonoro (Buzzer)
      if (comp.type === 'status_beacon_indicator') {
        const p0V = comp.ports.find(p => p.name.includes('0V'));
        if (p0V && nodes0V.has(p0V.id)) {
          const indicators = ['LED 1', 'LED 2', 'LED 3', 'LED 4', 'Buzina', 'Buzzer'];
          indicators.forEach(name => {
            const pInd = comp.ports.find(p => p.name.includes(name));
            if (pInd && nodes24V.has(pInd.id)) {
              activeLoads.push({ posPortId: pInd.id, negPortId: p0V.id });
            }
          });
        }
      }
    });

    // 1.3 Construir grafo de condução para o domínio 24V e domínio 0V
    // Aresta = { neighborId: string, connId: string | null }
    const graph24 = new Map<string, Array<{ neighborId: string; connId: string | null }>>();
    const graph0V = new Map<string, Array<{ neighborId: string; connId: string | null }>>();

    const addEdge = (
      graph: Map<string, Array<{ neighborId: string; connId: string | null }>>,
      u: string,
      v: string,
      connId: string | null
    ) => {
      if (!graph.has(u)) graph.set(u, []);
      if (!graph.has(v)) graph.set(v, []);
      graph.get(u)!.push({ neighborId: v, connId });
      graph.get(v)!.push({ neighborId: u, connId });
    };

    // Arestas de conexões físicas elétricas
    connections.forEach(conn => {
      if (conn.type !== 'electrical') return;
      if (nodes24V.has(conn.fromPortId) && nodes24V.has(conn.toPortId)) {
        addEdge(graph24, conn.fromPortId, conn.toPortId, conn.id);
      }
      if (nodes0V.has(conn.fromPortId) && nodes0V.has(conn.toPortId)) {
        addEdge(graph0V, conn.fromPortId, conn.toPortId, conn.id);
      }
    });

    // Arestas de pontes condutivas internas em componentes
    components.forEach(comp => {
      // Régua de bornes 24V: todos os bornes são interligados na barra equipotencial
      if (comp.type === 'terminal_strip_24v') {
        for (let i = 0; i < comp.ports.length; i++) {
          for (let j = i + 1; j < comp.ports.length; j++) {
            if (nodes24V.has(comp.ports[i].id) && nodes24V.has(comp.ports[j].id)) {
              addEdge(graph24, comp.ports[i].id, comp.ports[j].id, null);
            }
          }
        }
      }

      // Régua de bornes 0V: todos os bornes são interligados na barra equipotencial
      if (comp.type === 'terminal_strip_0v') {
        for (let i = 0; i < comp.ports.length; i++) {
          for (let j = i + 1; j < comp.ports.length; j++) {
            if (nodes0V.has(comp.ports[i].id) && nodes0V.has(comp.ports[j].id)) {
              addEdge(graph0V, comp.ports[i].id, comp.ports[j].id, null);
            }
          }
        }
      }

      // Botão de Emergência: NF 21-22 conduz quando não acionado
      if (comp.type === 'emergency_stop_button') {
        const p21 = comp.ports.find(p => p.name.includes('21'));
        const p22 = comp.ports.find(p => p.name.includes('22'));
        if (p21 && p22 && !comp.state.isEmergencyTriggered && nodes24V.has(p21.id) && nodes24V.has(p22.id)) {
          addEdge(graph24, p21.id, p22.id, null);
        }
      }

      // Botoeira Industrial: NA 13-14 (quando pressionado) e NF 21-22 (quando não pressionado)
      if (comp.type === 'push_button_station') {
        const p13 = comp.ports.find(p => p.name.includes('13'));
        const p14 = comp.ports.find(p => p.name.includes('14'));
        if (p13 && p14 && comp.state.buttonNApressed && nodes24V.has(p13.id) && nodes24V.has(p14.id)) {
          addEdge(graph24, p13.id, p14.id, null);
        }

        const p21 = comp.ports.find(p => p.name.includes('21'));
        const p22 = comp.ports.find(p => p.name.includes('22'));
        if (p21 && p22 && !comp.state.buttonNFpressed && nodes24V.has(p21.id) && nodes24V.has(p22.id)) {
          addEdge(graph24, p21.id, p22.id, null);
        }
      }

      // Relé K1: 4 contatos reversíveis
      if (comp.type === 'industrial_relay') {
        const pA1 = comp.ports.find(p => p.name.includes('A1'));
        const pA2 = comp.ports.find(p => p.name.includes('A2'));
        const isCoilEnergized = Boolean(pA1 && pA2 && nodes24V.has(pA1.id) && nodes0V.has(pA2.id));
        const isRelayOn = isCoilEnergized || Boolean(comp.state?.isRelaySwitched);

        const bridge = (portA?: ComponentPort, portB?: ComponentPort) => {
          if (portA && portB && nodes24V.has(portA.id) && nodes24V.has(portB.id)) {
            addEdge(graph24, portA.id, portB.id, null);
          }
        };

        const p11 = comp.ports.find(p => p.name.includes('COM 1') || p.name.includes('11') || p.name.includes('13'));
        const p14 = comp.ports.find(p => p.name.includes('NA 1') || p.name.includes('14'));
        const p12 = comp.ports.find(p => p.name.includes('NF 1') || p.name.includes('12'));
        if (isRelayOn) bridge(p11, p14); else bridge(p11, p12);

        const p21 = comp.ports.find(p => p.name.includes('COM 2') || p.name.includes('21'));
        const p24 = comp.ports.find(p => p.name.includes('NA 2') || p.name.includes('24'));
        const p22 = comp.ports.find(p => p.name.includes('NF 2') || p.name.includes('22'));
        if (isRelayOn) bridge(p21, p24); else bridge(p21, p22);

        const p31 = comp.ports.find(p => p.name.includes('COM 3') || p.name.includes('31'));
        const p34 = comp.ports.find(p => p.name.includes('NA 3') || p.name.includes('34'));
        const p32 = comp.ports.find(p => p.name.includes('NF 3') || p.name.includes('32'));
        if (isRelayOn) bridge(p31, p34); else bridge(p31, p32);

        const p41 = comp.ports.find(p => p.name.includes('COM 4') || p.name.includes('41'));
        const p44 = comp.ports.find(p => p.name.includes('NA 4') || p.name.includes('44'));
        const p42 = comp.ports.find(p => p.name.includes('NF 4') || p.name.includes('42'));
        if (isRelayOn) bridge(p41, p44); else bridge(p41, p42);
      }

      // Relés Temporizadores TON / TOF
      if (comp.type === 'industrial_relay_on_delay' || comp.type === 'industrial_relay_off_delay') {
        const isSwitched = Boolean(comp.state?.isRelaySwitched);
        const bridge = (portA?: ComponentPort, portB?: ComponentPort) => {
          if (portA && portB && nodes24V.has(portA.id) && nodes24V.has(portB.id)) {
            addEdge(graph24, portA.id, portB.id, null);
          }
        };

        const p11 = comp.ports.find(p => p.name.includes('COM 1'));
        const p14 = comp.ports.find(p => p.name.includes('NA 1'));
        const p12 = comp.ports.find(p => p.name.includes('NF 1'));
        if (isSwitched) bridge(p11, p14); else bridge(p11, p12);

        const p21 = comp.ports.find(p => p.name.includes('COM 2'));
        const p24 = comp.ports.find(p => p.name.includes('NA 2'));
        const p22 = comp.ports.find(p => p.name.includes('NF 2'));
        if (isSwitched) bridge(p21, p24); else bridge(p21, p22);
      }

      // Sensores de Proximidade: condução eletrônica interna BN -> BK (quando detectado) ou BN -> WH (NF)
      if (comp.category === 'sensors' || comp.type === 'reed_switch_sensor') {
        const bn = comp.ports.find(p => p.name.includes('BN'));
        const bk = comp.ports.find(p => p.name.includes('BK'));
        const wh = comp.ports.find(p => p.name.includes('WH'));
        const bu = comp.ports.find(p => p.name.includes('BU'));
        const sensorStatus = circuitEval.sensorStatuses.get(comp.id);

        if (sensorStatus?.isDetected && bn && bk && nodes24V.has(bn.id) && nodes24V.has(bk.id)) {
          addEdge(graph24, bn.id, bk.id, null);
        }
        if (sensorStatus?.outputNFactive && bn && wh && nodes24V.has(bn.id) && nodes24V.has(wh.id)) {
          addEdge(graph24, bn.id, wh.id, null);
        }
        // Sensor 2 fios
        if (sensorStatus?.isDetected && comp.state.sensorWires === '2_wires' && bn && bu && nodes24V.has(bn.id) && nodes24V.has(bu.id)) {
          addEdge(graph24, bn.id, bu.id, null);
        }
      }
    });

    // 1.4 Rastrear cabos que alimentam (+24V) e que retornam (0V) para cada carga ativa
    const tracePathToTargets = (
      startNodeId: string,
      targetNodeIds: Set<string>,
      graph: Map<string, Array<{ neighborId: string; connId: string | null }>>
    ) => {
      const queue: string[] = [startNodeId];
      const visited = new Set<string>([startNodeId]);
      const parentMap = new Map<string, { prevNode: string; connId: string | null }>();

      let reachedTarget: string | null = null;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (targetNodeIds.has(curr)) {
          reachedTarget = curr;
          break;
        }
        const edges = graph.get(curr) || [];
        for (const edge of edges) {
          if (!visited.has(edge.neighborId)) {
            visited.add(edge.neighborId);
            parentMap.set(edge.neighborId, { prevNode: curr, connId: edge.connId });
            queue.push(edge.neighborId);
          }
        }
      }

      if (reachedTarget) {
        let curr = reachedTarget;
        while (curr !== startNodeId) {
          const info = parentMap.get(curr);
          if (!info) break;
          if (info.connId) {
            activeConnIds.add(info.connId);
          }
          curr = info.prevNode;
        }
      }
    };

    activeLoads.forEach(load => {
      // Rastrear caminho do polo positivo até a saída +24V da fonte
      tracePathToTargets(load.posPortId, source24Ports, graph24);
      // Rastrear caminho do polo negativo até o borne 0V (GND) da fonte
      tracePathToTargets(load.negPortId, ground0Ports, graph0V);
    });
  }

  // =========================================================================
  // 2. AVALIAÇÃO NÓ A NÓ DE FLUXO PNEUMÁTICO (PRESSÃO E VAZÃO DE AR)
  // =========================================================================
  const frl = components.find(c => c.type === 'frl_unit');
  const hasAirSupply = !frl || frl.state.activated !== false;

  if (hasAirSupply) {
    const pressurizedPorts = new Set<string>();

    // 2.1 Fontes primárias de pressão pneumática
    if (frl && frl.state.activated !== false) {
      // Saída FRL: Port 'S' ou Port 2
      const frlOutlet = frl.ports.find(p => p.name.includes('S') || p.name.includes('2') || p.name.includes('Saída')) || frl.ports[1];
      if (frlOutlet) {
        pressurizedPorts.add(frlOutlet.id);
      }
    }

    // Bloco Distribuidor Manifold: se não houver FRL na bancada, o distribuidor atua com ar direto da linha principal
    const manifold = components.find(c => c.type === 'air_manifold');
    if (manifold && !frl) {
      manifold.ports.forEach(p => pressurizedPorts.add(p.id));
    }

    // 2.2 Propagação nó a nó em cascata (Iterativo para cobrir filtros, válvulas, estranguladores e cilindros)
    let changed = true;
    let iteration = 0;

    while (changed && iteration < 15) {
      changed = false;
      iteration++;

      // Propagação através dos tubos pneumáticos físicos conectados
      connections.forEach(conn => {
        if (conn.type !== 'pneumatic') return;

        if (pressurizedPorts.has(conn.fromPortId) && !pressurizedPorts.has(conn.toPortId)) {
          pressurizedPorts.add(conn.toPortId);
          activeConnIds.add(conn.id);
          changed = true;
        } else if (pressurizedPorts.has(conn.toPortId) && !pressurizedPorts.has(conn.fromPortId)) {
          pressurizedPorts.add(conn.fromPortId);
          activeConnIds.add(conn.id);
          changed = true;
        } else if (pressurizedPorts.has(conn.fromPortId) && pressurizedPorts.has(conn.toPortId)) {
          if (!activeConnIds.has(conn.id)) {
            activeConnIds.add(conn.id);
            changed = true;
          }
        }
      });

      // Propagação interna através de componentes lógicos e válvulas
      components.forEach(comp => {
        // Manifold Distribuidor de Pressão: quando a entrada 1(P) é pressurizada, todas as saídas P1..P8 são pressurizadas
        if (comp.type === 'air_manifold') {
          const pIn = comp.ports.find(p => p.name.includes('Entrada') || p.name.includes('1')) || comp.ports[0];
          if (pIn && pressurizedPorts.has(pIn.id)) {
            comp.ports.forEach(p => {
              if (p.id !== pIn.id && !pressurizedPorts.has(p.id)) {
                pressurizedPorts.add(p.id);
                changed = true;
              }
            });
          }
        }

        // Válvula Direcional 5/2 (Duplo ou Simples Solenoide):
        // Orifício 1(P) comuta internamente para 4(A) (carretel 'left') ou 2(B) (carretel 'right')
        if (comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') {
          const portP = comp.ports.find(p => p.name.includes('1') || p.name.includes('(P)') || p.functionType === 'pressure');
          const port4 = comp.ports.find(p => p.name.includes('4') || p.name.includes('(A)') || p.functionType === 'work_a');
          const port2 = comp.ports.find(p => p.name.includes('2') || p.name.includes('(B)') || p.functionType === 'work_b');

          if (portP && pressurizedPorts.has(portP.id)) {
            const valvePos = comp.state.valvePosition || 'left';
            if (valvePos === 'left' && port4 && !pressurizedPorts.has(port4.id)) {
              pressurizedPorts.add(port4.id);
              changed = true;
            } else if (valvePos === 'right' && port2 && !pressurizedPorts.has(port2.id)) {
              pressurizedPorts.add(port2.id);
              changed = true;
            }
          }
        }

        // Válvula Direcional 3/2 Botão Pulsador:
        // Orifício 1(P) comuta para 2(A) quando acionada
        if (comp.type === 'valve_3_2_button') {
          const portP = comp.ports.find(p => p.name.includes('1') || p.name.includes('(P)'));
          const port2 = comp.ports.find(p => p.name.includes('2') || p.name.includes('(A)'));
          if (portP && pressurizedPorts.has(portP.id) && comp.state.activated) {
            if (port2 && !pressurizedPorts.has(port2.id)) {
              pressurizedPorts.add(port2.id);
              changed = true;
            }
          }
        }

        // Válvula Reguladora de Fluxo Unidirecional (Estranguladora):
        // Comunicação bidirecional entre orifícios 1 e 2
        if (comp.type === 'flow_control_throttle') {
          const p1 = comp.ports[0];
          const p2 = comp.ports[1];
          if (p1 && p2) {
            if (pressurizedPorts.has(p1.id) && !pressurizedPorts.has(p2.id)) {
              pressurizedPorts.add(p2.id);
              changed = true;
            } else if (pressurizedPorts.has(p2.id) && !pressurizedPorts.has(p1.id)) {
              pressurizedPorts.add(p1.id);
              changed = true;
            }
          }
        }

        // Válvula de Escape Rápido:
        // Orifício 1(P) -> 2(A)
        if (comp.type === 'quick_exhaust_valve') {
          const p1 = comp.ports.find(p => p.name.includes('1'));
          const p2 = comp.ports.find(p => p.name.includes('2'));
          if (p1 && p2 && pressurizedPorts.has(p1.id) && !pressurizedPorts.has(p2.id)) {
            pressurizedPorts.add(p2.id);
            changed = true;
          }
        }

        // Válvula Alternadora Elemento OU:
        // Pressuriza a saída 2(A) se a entrada 1(X) OU 1(Y) estiver pressurizada
        if (comp.type === 'shuttle_valve_or') {
          const pX = comp.ports.find(p => p.name.includes('X') || p.name.includes('1 (X)'));
          const pY = comp.ports.find(p => p.name.includes('Y') || p.name.includes('1 (Y)'));
          const pA = comp.ports.find(p => p.name.includes('A') || p.name.includes('2'));
          if (pA && !pressurizedPorts.has(pA.id)) {
            if ((pX && pressurizedPorts.has(pX.id)) || (pY && pressurizedPorts.has(pY.id))) {
              pressurizedPorts.add(pA.id);
              changed = true;
            }
          }
        }

        // Válvula de Simultaneidade Elemento E:
        // Pressuriza a saída 2(A) somente se AMBAS as entradas 1(X) E 1(Y) estiverem pressurizadas
        if (comp.type === 'dual_pressure_and') {
          const pX = comp.ports.find(p => p.name.includes('X') || p.name.includes('1 (X)'));
          const pY = comp.ports.find(p => p.name.includes('Y') || p.name.includes('1 (Y)'));
          const pA = comp.ports.find(p => p.name.includes('A') || p.name.includes('2'));
          if (pA && !pressurizedPorts.has(pA.id)) {
            if (pX && pressurizedPorts.has(pX.id) && pY && pressurizedPorts.has(pY.id)) {
              pressurizedPorts.add(pA.id);
              changed = true;
            }
          }
        }
      });
    }

    // 2.3 Identificação dos pórticos das eletroválvulas em estado de EXAUSTÃO
    const exhaustPortIds = new Set<string>();

    components.forEach(comp => {
      // Eletroválvula 5/2 (duplo ou simples solenoide):
      if (comp.type === 'valve_5_2_double_solenoid' || comp.type === 'valve_5_2_single_solenoid') {
        const portP = comp.ports.find(p => p.name.includes('1') || p.name.includes('(P)') || p.functionType === 'pressure');
        const port4 = comp.ports.find(p => p.name.includes('4') || p.name.includes('(A)') || p.functionType === 'work_a');
        const port2 = comp.ports.find(p => p.name.includes('2') || p.name.includes('(B)') || p.functionType === 'work_b');

        if (portP && pressurizedPorts.has(portP.id)) {
          const valvePos = comp.state.valvePosition || 'left';
          // Se carretel está à esquerda (alimenta 4): pórtico 2(B) está internamente conectado ao escape 3(R)
          if (valvePos === 'left' && port2) {
            exhaustPortIds.add(port2.id);
          }
          // Se carretel está à direita (alimenta 2): pórtico 4(A) está internamente conectado ao escape 5(S)
          else if (valvePos === 'right' && port4) {
            exhaustPortIds.add(port4.id);
          }
        }
      }

      // Válvula Direcional 3/2 Botão Pulsador:
      if (comp.type === 'valve_3_2_button') {
        const portP = comp.ports.find(p => p.name.includes('1') || p.name.includes('(P)'));
        const port2 = comp.ports.find(p => p.name.includes('2') || p.name.includes('(A)'));
        if (portP && pressurizedPorts.has(portP.id) && !comp.state.activated && port2) {
          // Quando em repouso com pressão em 1, pórtico 2 comunica com o escape 3
          exhaustPortIds.add(port2.id);
        }
      }
    });

    // 2.4 Rastreamento da linha de exaustão conectando a eletroválvula ao cilindro pneumático
    // Apenas as tubulações que interligam o pórtico de escape da válvula a uma câmara de cilindro
    // (diretamente ou via estranguladores / válvulas de escape rápido) são classificadas como exaustão!
    if (exhaustPortIds.size > 0) {
      const pneuGraph = new Map<string, Array<{ neighborPortId: string; connId: string | null }>>();
      const addPneuEdge = (pA: string, pB: string, cId: string | null) => {
        if (!pneuGraph.has(pA)) pneuGraph.set(pA, []);
        if (!pneuGraph.has(pB)) pneuGraph.set(pB, []);
        pneuGraph.get(pA)!.push({ neighborPortId: pB, connId: cId });
        pneuGraph.get(pB)!.push({ neighborPortId: pA, connId: cId });
      };

      // Conexões físicas pneumáticas
      connections.forEach(conn => {
        if (conn.type === 'pneumatic') {
          addPneuEdge(conn.fromPortId, conn.toPortId, conn.id);
        }
      });

      // Passagens internas em componentes intermediários (válvula estranguladora / escape rápido)
      components.forEach(comp => {
        if (comp.type === 'flow_control_throttle') {
          if (comp.ports[0] && comp.ports[1]) {
            addPneuEdge(comp.ports[0].id, comp.ports[1].id, null);
          }
        } else if (comp.type === 'quick_exhaust_valve') {
          const p1 = comp.ports.find(p => p.name.includes('1'));
          const p2 = comp.ports.find(p => p.name.includes('2'));
          if (p1 && p2) {
            addPneuEdge(p1.id, p2.id, null);
          }
        }
      });

      // Identificar todos os pórticos pertencentes a cilindros
      const cylinderPortIds = new Set<string>();
      components.forEach(c => {
        if (c.type.includes('cylinder') || c.category === 'actuators') {
          c.ports.forEach(p => {
            if (p.type === 'pneumatic') {
              cylinderPortIds.add(p.id);
            }
          });
        }
      });

      // Para cada pórtico de escape da eletroválvula, fazer BFS para encontrar conexões até o cilindro
      exhaustPortIds.forEach(startExhaustPort => {
        const queue: string[] = [startExhaustPort];
        const visited = new Set<string>([startExhaustPort]);
        const parentMap = new Map<string, { prevPort: string; connId: string | null }>();

        const reachedCylinderPorts: string[] = [];

        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (cylinderPortIds.has(curr)) {
            reachedCylinderPorts.push(curr);
          }

          const edges = pneuGraph.get(curr) || [];
          for (const edge of edges) {
            if (!visited.has(edge.neighborPortId)) {
              visited.add(edge.neighborPortId);
              parentMap.set(edge.neighborPortId, { prevPort: curr, connId: edge.connId });
              if (!cylinderPortIds.has(edge.neighborPortId)) {
                queue.push(edge.neighborPortId);
              }
            }
          }
        }

        // Se alcançou um cilindro pneumático, marca todos os tubos do trajeto como exaustão ativa!
        reachedCylinderPorts.forEach(cylPort => {
          let curr = cylPort;
          while (curr !== startExhaustPort) {
            const info = parentMap.get(curr);
            if (!info) break;
            if (info.connId) {
              exhaustConnIds.add(info.connId);
              activeConnIds.add(info.connId);
            }
            curr = info.prevPort;
          }
        });
      });
    }
  }

  return { activeConnIds, exhaustConnIds };
}

