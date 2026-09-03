import { BenchComponent, ComponentCategory } from '../types';

export interface ComponentTemplate {
  type: string;
  name: string;
  category: ComponentCategory;
  width: number;
  height: number;
  tagPrefix: string;
  description: string;
  defaultPorts: Array<{
    name: string;
    type: 'pneumatic' | 'electrical';
    functionType: any;
    x: number;
    y: number;
  }>;
  defaultState: Record<string, any>;
}

export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  // SUPPLY
  {
    type: 'frl_unit',
    name: 'Unidade de Conservação FRL (Filtro-Regulador-Lubrificador)',
    category: 'supply',
    width: 140,
    height: 180,
    tagPrefix: '0Z',
    description: 'Filtro centrífugo de 5µm, regulador com manômetro 0-10 bar e válvula de corte 3/2 com alívio.',
    defaultPorts: [
      { name: 'P (Entrada Rede)', type: 'pneumatic', functionType: 'pressure', x: 15, y: 75 },
      { name: '1 (Saída Regulada)', type: 'pneumatic', functionType: 'pressure', x: 85, y: 75 },
    ],
    defaultState: {
      pressureP: 6.0, // 6 bar
      isLocked: false,
      flowThrottlePercent: 100,
      temperatureC: 22,
    }
  },
  {
    type: 'air_manifold',
    name: 'Bloco Coletor Distribuidor de Pressão (8 Saídas)',
    category: 'supply',
    width: 170,
    height: 90,
    tagPrefix: '0P',
    description: 'Distribuidor pneumático múltiplo com conexões instantâneas 6mm.',
    defaultPorts: [
      { name: '1 (Entrada P)', type: 'pneumatic', functionType: 'pressure', x: 15, y: 50 },
      { name: 'P1', type: 'pneumatic', functionType: 'pressure', x: 35, y: 30 },
      { name: 'P2', type: 'pneumatic', functionType: 'pressure', x: 55, y: 30 },
      { name: 'P3', type: 'pneumatic', functionType: 'pressure', x: 75, y: 30 },
      { name: 'P4', type: 'pneumatic', functionType: 'pressure', x: 92, y: 30 },
      { name: 'P5', type: 'pneumatic', functionType: 'pressure', x: 35, y: 70 },
      { name: 'P6', type: 'pneumatic', functionType: 'pressure', x: 55, y: 70 },
      { name: 'P7', type: 'pneumatic', functionType: 'pressure', x: 75, y: 70 },
      { name: 'P8', type: 'pneumatic', functionType: 'pressure', x: 92, y: 70 },
    ],
    defaultState: {
      pressureP: 6.0
    }
  },
  {
    type: 'power_supply_24v',
    name: 'Fonte',
    category: 'supply',
    width: 210,
    height: 180,
    tagPrefix: '0G',
    description: 'Fonte de alimentação 24V CC com chave liga/desliga e barramento de distribuição (5 bornes de 24V e 5 bornes de 0V).',
    defaultPorts: [
      { name: '+24V (1)', type: 'electrical', functionType: 'power_24v', x: 16.2, y: 53.0 },
      { name: '+24V (2)', type: 'electrical', functionType: 'power_24v', x: 34.3, y: 53.0 },
      { name: '+24V (3)', type: 'electrical', functionType: 'power_24v', x: 52.8, y: 53.0 },
      { name: '+24V (4)', type: 'electrical', functionType: 'power_24v', x: 71.4, y: 53.0 },
      { name: '+24V (5)', type: 'electrical', functionType: 'power_24v', x: 89.5, y: 53.0 },
      { name: '0V (1)', type: 'electrical', functionType: 'ground_0v', x: 16.2, y: 80.0 },
      { name: '0V (2)', type: 'electrical', functionType: 'ground_0v', x: 34.3, y: 80.0 },
      { name: '0V (3)', type: 'electrical', functionType: 'ground_0v', x: 52.8, y: 80.0 },
      { name: '0V (4)', type: 'electrical', functionType: 'ground_0v', x: 71.4, y: 80.0 },
      { name: '0V (5)', type: 'electrical', functionType: 'ground_0v', x: 89.5, y: 80.0 },
    ],
    defaultState: {
      activated: true,
      voltageV: 24.0,
      fixedVoltageOnly: true,
      currentAmperes: 0.25,
      isEmergencyTriggered: false
    }
  },

  // ACTUATORS
  {
    type: 'double_acting_cylinder',
    name: 'Cilindro Dupla Ação com Amortecimento (ISO 15552)',
    category: 'actuators',
    width: 250,
    height: 120,
    tagPrefix: '1A',
    description: 'Cilindro Ø32mm, curso 100mm, com êmbolo magnético para sensores de proximidade.',
    defaultPorts: [
      { name: '1 (Avanço)', type: 'pneumatic', functionType: 'work_a', x: 22, y: 88 },
      { name: '2 (Recuo)', type: 'pneumatic', functionType: 'work_b', x: 78, y: 88 },
    ],
    defaultState: {
      position: 0, // 0 = fully retracted, 100 = fully advanced
      targetPosition: 0,
      speed: 150, // mm/s
      boreDiameterMm: 32,
      rodDiameterMm: 12,
      strokeLengthMm: 100,
      appliedLoadN: 120,
      pressureA: 0,
      pressureB: 0,
      cyclesTotal: 42,
      healthPercent: 98
    }
  },
  {
    type: 'single_acting_cylinder',
    name: 'Cilindro Simples Ação com Retorno por Mola (ISO 6432)',
    category: 'actuators',
    width: 210,
    height: 100,
    tagPrefix: '2A',
    description: 'Cilindro Ø20mm, curso 50mm com mola interna de retorno.',
    defaultPorts: [
      { name: '1 (Avanço)', type: 'pneumatic', functionType: 'work_a', x: 25, y: 85 },
    ],
    defaultState: {
      position: 0,
      targetPosition: 0,
      speed: 180,
      boreDiameterMm: 20,
      rodDiameterMm: 8,
      strokeLengthMm: 50,
      appliedLoadN: 40,
      pressureA: 0,
      cyclesTotal: 18,
      healthPercent: 100
    }
  },
  {
    type: 'rotary_actuator',
    name: 'Atuador Rotativo Pinhão e Cremalheira (0 - 180°)',
    category: 'actuators',
    width: 180,
    height: 120,
    tagPrefix: '3A',
    description: 'Atuador oscilante com torque nominal 1.8 Nm e batentes ajustáveis.',
    defaultPorts: [
      { name: '1 (Giro Horário)', type: 'pneumatic', functionType: 'work_a', x: 30, y: 85 },
      { name: '2 (Giro Anti-horário)', type: 'pneumatic', functionType: 'work_b', x: 70, y: 85 },
    ],
    defaultState: {
      position: 0, // 0 to 180 deg
      targetPosition: 0,
      appliedLoadN: 25,
      pressureA: 0,
      pressureB: 0,
      cyclesTotal: 10,
      healthPercent: 99
    }
  },

  // DIRECTIONAL VALVES
  {
    type: 'valve_5_2_double_solenoid',
    name: 'Válvula 5/2 Vias Duplo Solenoide (Biestável)',
    category: 'valves',
    width: 220,
    height: 150,
    tagPrefix: '1V',
    description: 'Válvula direcional pilotada eletricamente por solenoides Y1 (14) e Y2 (12) 24VDC com acionamento manual auxiliar.',
    defaultPorts: [
      { name: '1 (P)', type: 'pneumatic', functionType: 'pressure', x: 50, y: 88 },
      { name: '2 (B)', type: 'pneumatic', functionType: 'work_b', x: 32, y: 15 },
      { name: '4 (A)', type: 'pneumatic', functionType: 'work_a', x: 68, y: 15 },
      { name: '3 (R)', type: 'pneumatic', functionType: 'exhaust_r', x: 26, y: 88 },
      { name: '5 (S)', type: 'pneumatic', functionType: 'exhaust_s', x: 74, y: 88 },
      // Electrical coils
      { name: 'Y1 (+) A1', type: 'electrical', functionType: 'signal_in', x: 12, y: 35 },
      { name: 'Y1 (-) A2', type: 'electrical', functionType: 'ground_0v', x: 12, y: 65 },
      { name: 'Y2 (+) A1', type: 'electrical', functionType: 'signal_in', x: 88, y: 35 },
      { name: 'Y2 (-) A2', type: 'electrical', functionType: 'ground_0v', x: 88, y: 65 },
    ],
    defaultState: {
      valvePosition: 'left', // 'left' = P->4 & 2->3 (avançado), 'right' = P->2 & 4->5 (recuado)
      solenoidLeftActive: false,
      solenoidRightActive: false,
      manualOverride: false,
      pressureP: 0,
      temperatureC: 24,
      healthPercent: 100
    }
  },
  {
    type: 'valve_5_2_single_solenoid',
    name: 'Válvula 5/2 Vias Simples Solenoide / Mola (Monoestável)',
    category: 'valves',
    width: 200,
    height: 150,
    tagPrefix: '2V',
    description: 'Válvula 5/2 vias acionada por solenoide Y1 e retorno mecânico por mola.',
    defaultPorts: [
      { name: '1 (P)', type: 'pneumatic', functionType: 'pressure', x: 50, y: 88 },
      { name: '2 (B)', type: 'pneumatic', functionType: 'work_b', x: 35, y: 15 },
      { name: '4 (A)', type: 'pneumatic', functionType: 'work_a', x: 65, y: 15 },
      { name: '3 (R)', type: 'pneumatic', functionType: 'exhaust_r', x: 28, y: 88 },
      { name: '5 (S)', type: 'pneumatic', functionType: 'exhaust_s', x: 72, y: 88 },
      { name: 'Y1 (+) A1', type: 'electrical', functionType: 'signal_in', x: 12, y: 35 },
      { name: 'Y1 (-) A2', type: 'electrical', functionType: 'ground_0v', x: 12, y: 65 },
    ],
    defaultState: {
      valvePosition: 'right', // Normal por mola: P->2, 4->5
      solenoidLeftActive: false,
      pressureP: 0,
      temperatureC: 23,
      healthPercent: 100
    }
  },
  {
    type: 'valve_3_2_button',
    name: 'Válvula 3/2 Vias NF Acionamento por Botão Pulsador / Mola',
    category: 'valves',
    width: 140,
    height: 140,
    tagPrefix: '3V',
    description: 'Válvula pneumática manual 3/2 NF para comando direto ou piloto.',
    defaultPorts: [
      { name: '1 (P)', type: 'pneumatic', functionType: 'pressure', x: 30, y: 88 },
      { name: '2 (A)', type: 'pneumatic', functionType: 'work_a', x: 50, y: 15 },
      { name: '3 (R)', type: 'pneumatic', functionType: 'exhaust_r', x: 70, y: 88 },
    ],
    defaultState: {
      activated: false,
      valvePosition: 'right',
      pressureP: 0
    }
  },

  // FLOW & LOGIC
  {
    type: 'flow_control_throttle',
    name: 'Válvula Reguladora de Fluxo Unidirecional (Estranguladora)',
    category: 'flow_logic',
    width: 130,
    height: 90,
    tagPrefix: '1V_FL',
    description: 'Regulagem micrométrica de vazão com retenção livre no sentido inverso (Controle de velocidade do atuador).',
    defaultPorts: [
      { name: '1 (Entrada)', type: 'pneumatic', functionType: 'pressure', x: 18, y: 50 },
      { name: '2 (Saída Regulada)', type: 'pneumatic', functionType: 'work_a', x: 82, y: 50 },
    ],
    defaultState: {
      flowThrottlePercent: 40 // 40% open
    }
  },
  {
    type: 'quick_exhaust_valve',
    name: 'Válvula de Escape Rápido (Quick Exhaust)',
    category: 'flow_logic',
    width: 120,
    height: 100,
    tagPrefix: '1V_QE',
    description: 'Acelera o escape de ar na câmara do cilindro diretamente para a atmosfera.',
    defaultPorts: [
      { name: '1 (P)', type: 'pneumatic', functionType: 'pressure', x: 18, y: 50 },
      { name: '2 (A)', type: 'pneumatic', functionType: 'work_a', x: 82, y: 50 },
      { name: '3 (R)', type: 'pneumatic', functionType: 'exhaust_r', x: 50, y: 88 },
    ],
    defaultState: {}
  },
  {
    type: 'shuttle_valve_or',
    name: 'Válvula Alternadora (Elemento OU / Shuttle Valve)',
    category: 'flow_logic',
    width: 130,
    height: 90,
    tagPrefix: '1V_OR',
    description: 'Saída 2 é pressurizada se houver sinal em 1 ou em 1(3).',
    defaultPorts: [
      { name: '1 (X)', type: 'pneumatic', functionType: 'work_a', x: 15, y: 50 },
      { name: '1 (Y)', type: 'pneumatic', functionType: 'work_b', x: 85, y: 50 },
      { name: '2 (A)', type: 'pneumatic', functionType: 'pressure', x: 50, y: 15 },
    ],
    defaultState: {}
  },
  {
    type: 'dual_pressure_and',
    name: 'Válvula de Simultaneidade (Elemento E / Dual Pressure Valve)',
    category: 'flow_logic',
    width: 130,
    height: 90,
    tagPrefix: '1V_AND',
    description: 'Saída 2 somente é pressurizada quando AMBAS entradas 1(X) e 1(Y) tiverem pressão simultânea.',
    defaultPorts: [
      { name: '1 (X)', type: 'pneumatic', functionType: 'work_a', x: 15, y: 50 },
      { name: '1 (Y)', type: 'pneumatic', functionType: 'work_b', x: 85, y: 50 },
      { name: '2 (A)', type: 'pneumatic', functionType: 'pressure', x: 50, y: 15 },
    ],
    defaultState: {}
  },

  // ELECTRICAL CONTROLS
  {
    type: 'push_button_station',
    name: 'Estação de Botões de Comando (NA Verde / NF Vermelho)',
    category: 'electrical',
    width: 160,
    height: 180,
    tagPrefix: '1S',
    description: 'Botão pulsador verde normalmente aberto (13-14) e botão vermelho normalmente fechado (11-12).',
    defaultPorts: [
      { name: 'NA (13)', type: 'electrical', functionType: 'signal_in', x: 25, y: 35 },
      { name: 'NA (14)', type: 'electrical', functionType: 'signal_out', x: 75, y: 35 },
      { name: 'NF (11)', type: 'electrical', functionType: 'signal_in', x: 25, y: 75 },
      { name: 'NF (12)', type: 'electrical', functionType: 'signal_out', x: 75, y: 75 },
    ],
    defaultState: {
      buttonNApressed: false,
      buttonNFpressed: false,
    }
  },
  {
    type: 'emergency_stop_button',
    name: 'Botão Cogumelo de Parada de Emergência (Conforme NR-12)',
    category: 'electrical',
    width: 140,
    height: 180,
    tagPrefix: '0S',
    description: 'Botão de emergência com trava mecânica, ação positiva de ruptura e rearme por giro.',
    defaultPorts: [
      { name: 'NF (21)', type: 'electrical', functionType: 'signal_in', x: 30, y: 80 },
      { name: 'NF (22)', type: 'electrical', functionType: 'signal_out', x: 70, y: 80 },
    ],
    defaultState: {
      isEmergencyTriggered: false
    }
  },
  {
    type: 'industrial_relay',
    name: 'Módulo Relé Eletromecânico Industrial (Bobina + 2 Contatos Reversíveis)',
    category: 'electrical',
    width: 160,
    height: 180,
    tagPrefix: 'K1',
    description: 'Relé de acoplamento 24VDC com bobina A1/A2, contato NA (13-14) para autorretenção e NF (21-22).',
    defaultPorts: [
      { name: 'A1 (+24V)', type: 'electrical', functionType: 'signal_in', x: 25, y: 25 },
      { name: 'A2 (0V)', type: 'electrical', functionType: 'ground_0v', x: 75, y: 25 },
      { name: 'Comum (11)', type: 'electrical', functionType: 'signal_in', x: 25, y: 55 },
      { name: 'NA (14)', type: 'electrical', functionType: 'signal_out', x: 75, y: 55 },
      { name: 'Comum (21)', type: 'electrical', functionType: 'signal_in', x: 25, y: 85 },
      { name: 'NF (22)', type: 'electrical', functionType: 'signal_out', x: 75, y: 85 },
    ],
    defaultState: {
      activated: false,
      temperatureC: 25
    }
  },
  {
    type: 'reed_switch_sensor',
    name: 'Sensor Magnético de Proximidade Reed Switch (Fim de Curso)',
    category: 'sensors',
    width: 140,
    height: 90,
    tagPrefix: '1S_RS',
    description: 'Sensor montado na camisa do cilindro para detecção de posição avançado/recuado por ímã.',
    defaultPorts: [
      { name: 'BN (+24V)', type: 'electrical', functionType: 'power_24v', x: 20, y: 35 },
      { name: 'BU (0V)', type: 'electrical', functionType: 'ground_0v', x: 20, y: 70 },
      { name: 'BK (Sinal)', type: 'electrical', functionType: 'sensor_sig', x: 80, y: 50 },
    ],
    defaultState: {
      sensorDetected: false,
      targetCylinderTag: '1A',
      detectionPosition: 100 // 100% = avançado, 0% = recuado
    }
  },
  {
    type: 'status_beacon_indicator',
    name: 'Módulo Sinalizador Visual LED & Sonoro (Buzzer)',
    category: 'electrical',
    width: 130,
    height: 180,
    tagPrefix: '1H',
    description: 'Indicadores luminosos Verde (OK), Vermelho (Falha/Alarme) e aviso acústico.',
    defaultPorts: [
      { name: 'LED Verde (+)', type: 'electrical', functionType: 'signal_in', x: 25, y: 35 },
      { name: 'LED Verm. (+)', type: 'electrical', functionType: 'signal_in', x: 25, y: 70 },
      { name: '0V Comum', type: 'electrical', functionType: 'ground_0v', x: 75, y: 50 },
    ],
    defaultState: {
      ledGreenActive: false,
      ledRedActive: false,
      buzzerActive: false
    }
  }
];

export function createComponentFromTemplate(template: ComponentTemplate, x: number, y: number, index: number): BenchComponent {
  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: template.type,
    name: template.name,
    tag: `${template.tagPrefix}${index > 0 ? index : ''}`,
    category: template.category,
    x,
    y,
    width: template.width,
    height: template.height,
    ports: template.defaultPorts.map((p, idx) => ({
      id: `port_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      name: p.name,
      type: p.type,
      functionType: p.functionType,
      x: p.x,
      y: p.y,
    })),
    state: { ...template.defaultState },
    faults: {
      isLeaking: false,
      isStuck: false,
      isCoilBurned: false,
      isLowPressure: false
    }
  };
}
