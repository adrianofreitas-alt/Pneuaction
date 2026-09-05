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
        x: 88,
        y: 34
      },
      {
        id: findPortId('BU') || findPortId('Sinal'),
        name: 'BU (Sinal / Carga)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 88,
        y: 66
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
        x: 88,
        y: 18
      },
      {
        id: findPortId('WH') || findPortId('NF'),
        name: 'WH (Sinal NF)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 88,
        y: 39
      },
      {
        id: findPortId('BK') || findPortId('NA') || findPortId('Sinal'),
        name: 'BK (Sinal NA)',
        type: 'electrical',
        functionType: 'sensor_sig',
        x: 88,
        y: 61
      },
      {
        id: findPortId('BU'),
        name: 'BU (0V)',
        type: 'electrical',
        functionType: 'ground_0v',
        x: 88,
        y: 82
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
      x: 88,
      y: 24
    },
    {
      id: findPortId('BU'),
      name: 'BU (0V)',
      type: 'electrical',
      functionType: 'ground_0v',
      x: 88,
      y: 76
    },
    {
      id: findPortId('BK') || findPortId('Sinal'),
      name: 'BK (Sinal)',
      type: 'electrical',
      functionType: 'sensor_sig',
      x: 88,
      y: 50
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

  // Propagate 0V through electrical connections
  const queue0V = Array.from(nodes0V);
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

        // Industrial Relay: Contacts 13-14 (NA) and 21-22 (NF)
        if (comp.type === 'industrial_relay') {
          const isRelayOn = comp.state.activated || false;
          const p13 = comp.ports.find(p => p.name.includes('13'));
          const p14 = comp.ports.find(p => p.name.includes('14'));
          if (p13 && p14 && isRelayOn) {
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
          if (p21 && p22 && !isRelayOn) {
            if (nodes24V.has(p21.id) && !nodes24V.has(p22.id)) {
              nodes24V.add(p22.id);
              changed = true;
            } else if (nodes24V.has(p22.id) && !nodes24V.has(p21.id)) {
              nodes24V.add(p21.id);
              changed = true;
            }
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
  const strokeTravel = cyl?.type === 'single_acting_cylinder' ? 150 : 200;
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

    // Physical position check: center of the sensing cap is at (13, 50)
    const sRot = sensor.rotation || 0;
    const rawFaceX = 13;
    const rawFaceY = 50;
    let sensorFaceX = sensor.x + rawFaceX;
    let sensorFaceY = sensor.y + rawFaceY;
    if (sRot) {
      const cx = sensor.width / 2;
      const cy = sensor.height / 2;
      const dx = rawFaceX - cx;
      const dy = rawFaceY - cy;
      const rad = (sRot * Math.PI) / 180;
      sensorFaceX = sensor.x + cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
      sensorFaceY = sensor.y + cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
    }

    const distToSphere = Math.hypot(sphereX - sensorFaceX, sphereY - sensorFaceY);
    // Requisito estrito: o sensor só atua quando a esfera da haste estiver muito próxima da tampa,
    // alinhada centro da esfera com o centro da tampa do sensor (raio de tolerância <= 26px)
    const isPhysicalMatch = distToSphere <= 26;

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

  return {
    hasElectricalPower,
    nodes24V,
    nodes0V,
    sensorStatuses,
    solenoidY1Active,
    solenoidY2Active
  };
}
