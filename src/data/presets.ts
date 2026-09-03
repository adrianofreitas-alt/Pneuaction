import { BenchComponent, VirtualConnection } from '../types';
import { COMPONENT_TEMPLATES, createComponentFromTemplate } from './componentLibrary';

export interface PresetCircuit {
  id: string;
  name: string;
  category: string;
  description: string;
  build: () => { components: BenchComponent[]; connections: VirtualConnection[] };
}

export const PRESET_CIRCUITS: PresetCircuit[] = [
  {
    id: 'preset_auto_cycle',
    name: 'Ciclo Automático Contínuo A+ A- (Biestável 5/2 com Sensores Reed)',
    category: 'Eletropneumática Industrial',
    description: 'Circuito industrial clássico com Cilindro Dupla Ação 1A, Válvula 5/2 biestável (Y1/Y2), Sensores magnéticos de fim de curso 1S1 (recuado) e 1S2 (avançado) e Botão de Emergência NR-12.',
    build: () => {
      const frlTpl = COMPONENT_TEMPLATES.find(t => t.type === 'frl_unit')!;
      const manifoldTpl = COMPONENT_TEMPLATES.find(t => t.type === 'air_manifold')!;
      const psTpl = COMPONENT_TEMPLATES.find(t => t.type === 'power_supply_24v')!;
      const cylTpl = COMPONENT_TEMPLATES.find(t => t.type === 'double_acting_cylinder')!;
      const valve52Tpl = COMPONENT_TEMPLATES.find(t => t.type === 'valve_5_2_double_solenoid')!;
      const emergTpl = COMPONENT_TEMPLATES.find(t => t.type === 'emergency_stop_button')!;
      const throttleTpl = COMPONENT_TEMPLATES.find(t => t.type === 'flow_control_throttle')!;
      const sensorTpl = COMPONENT_TEMPLATES.find(t => t.type === 'reed_switch_sensor')!;
      const buttonTpl = COMPONENT_TEMPLATES.find(t => t.type === 'push_button_station')!;

      const frl = createComponentFromTemplate(frlTpl, 40, 40, 1);
      const manifold = createComponentFromTemplate(manifoldTpl, 220, 50, 1);
      const ps = createComponentFromTemplate(psTpl, 420, 40, 1);
      const emerg = createComponentFromTemplate(emergTpl, 600, 50, 1);
      const btn = createComponentFromTemplate(buttonTpl, 770, 40, 1);

      const valve = createComponentFromTemplate(valve52Tpl, 220, 260, 1);
      const throttle = createComponentFromTemplate(throttleTpl, 470, 280, 1);
      const cyl = createComponentFromTemplate(cylTpl, 630, 260, 1);

      const sensor1 = createComponentFromTemplate(sensorTpl, 630, 420, 1);
      sensor1.tag = '1S1';
      sensor1.state.detectionPosition = 0; // recuado

      const sensor2 = createComponentFromTemplate(sensorTpl, 800, 420, 2);
      sensor2.tag = '1S2';
      sensor2.state.detectionPosition = 100; // avançado

      const components: BenchComponent[] = [frl, manifold, ps, emerg, btn, valve, throttle, cyl, sensor1, sensor2];

      // Connections:
      // FRL saída -> Manifold entrada
      const c1: VirtualConnection = {
        id: 'conn_p1',
        type: 'pneumatic',
        fromComponentId: frl.id,
        fromPortId: frl.ports[1].id, // 1 Saída
        toComponentId: manifold.id,
        toPortId: manifold.ports[0].id, // 1 Entrada
        pressureBar: 6.0,
        active: true
      };

      // Manifold P1 -> Válvula 5/2 Orifício 1(P)
      const c2: VirtualConnection = {
        id: 'conn_p2',
        type: 'pneumatic',
        fromComponentId: manifold.id,
        fromPortId: manifold.ports[1].id,
        toComponentId: valve.id,
        toPortId: valve.ports[0].id, // 1 (P)
        pressureBar: 6.0,
        active: true
      };

      // Válvula 4(A) -> Reguladora de fluxo entrada
      const c3: VirtualConnection = {
        id: 'conn_p3',
        type: 'pneumatic',
        fromComponentId: valve.id,
        fromPortId: valve.ports[2].id, // 4 (A)
        toComponentId: throttle.id,
        toPortId: throttle.ports[0].id,
        pressureBar: 6.0,
        active: true
      };

      // Reguladora saída -> Cilindro 1 (Avanço)
      const c4: VirtualConnection = {
        id: 'conn_p4',
        type: 'pneumatic',
        fromComponentId: throttle.id,
        fromPortId: throttle.ports[1].id,
        toComponentId: cyl.id,
        toPortId: cyl.ports[0].id, // 1 Avanço
        pressureBar: 6.0,
        active: true
      };

      // Válvula 2(B) -> Cilindro 2 (Recuo)
      const c5: VirtualConnection = {
        id: 'conn_p5',
        type: 'pneumatic',
        fromComponentId: valve.id,
        fromPortId: valve.ports[1].id, // 2 (B)
        toComponentId: cyl.id,
        toPortId: cyl.ports[1].id, // 2 Recuo
        pressureBar: 0,
        active: false
      };

      // Elétrica: Fonte 24V -> Emergência NF(21)
      const c6: VirtualConnection = {
        id: 'conn_e1',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[0].id, // +24V
        toComponentId: emerg.id,
        toPortId: emerg.ports[0].id, // NF 21
        voltageV: 24,
        active: true
      };

      // Emergência NF(22) -> Botão NA(13)
      const c7: VirtualConnection = {
        id: 'conn_e2',
        type: 'electrical',
        fromComponentId: emerg.id,
        fromPortId: emerg.ports[1].id, // NF 22
        toComponentId: btn.id,
        toPortId: btn.ports[0].id, // NA 13
        voltageV: 24,
        active: true
      };

      // Sensor 1S1 Sinal -> Solenoide Y1 (+)
      const c8: VirtualConnection = {
        id: 'conn_e3',
        type: 'electrical',
        fromComponentId: sensor1.id,
        fromPortId: sensor1.ports[2].id, // BK Sinal
        toComponentId: valve.id,
        toPortId: valve.ports[5].id, // Y1 (+) A1
        voltageV: 24,
        active: false
      };

      // Sensor 1S2 Sinal -> Solenoide Y2 (+)
      const c9: VirtualConnection = {
        id: 'conn_e4',
        type: 'electrical',
        fromComponentId: sensor2.id,
        fromPortId: sensor2.ports[2].id, // BK Sinal
        toComponentId: valve.id,
        toPortId: valve.ports[7].id, // Y2 (+) A1
        voltageV: 0,
        active: false
      };

      // 0V comum -> Y1 (-) e Y2 (-)
      const c10: VirtualConnection = {
        id: 'conn_e5',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[2].id, // 0V
        toComponentId: valve.id,
        toPortId: valve.ports[6].id, // Y1 (-) A2
        voltageV: 0,
        active: true
      };

      const c11: VirtualConnection = {
        id: 'conn_e6',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[3].id, // 0V
        toComponentId: valve.id,
        toPortId: valve.ports[8].id, // Y2 (-) A2
        voltageV: 0,
        active: true
      };

      return {
        components,
        connections: [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11]
      };
    }
  },
  {
    id: 'preset_direct_single_acting',
    name: 'Acionamento Direto Cilindro Simples Ação (Válvula 3/2 NF)',
    category: 'Pneumática Básica',
    description: 'Comando direto de avanço e recuo de cilindro com mola através de válvula botão 3/2 NF e regulador FRL.',
    build: () => {
      const frlTpl = COMPONENT_TEMPLATES.find(t => t.type === 'frl_unit')!;
      const v32Tpl = COMPONENT_TEMPLATES.find(t => t.type === 'valve_3_2_button')!;
      const cylTpl = COMPONENT_TEMPLATES.find(t => t.type === 'single_acting_cylinder')!;
      const throttleTpl = COMPONENT_TEMPLATES.find(t => t.type === 'flow_control_throttle')!;

      const frl = createComponentFromTemplate(frlTpl, 80, 100, 1);
      const v32 = createComponentFromTemplate(v32Tpl, 320, 120, 1);
      const throttle = createComponentFromTemplate(throttleTpl, 520, 130, 1);
      const cyl = createComponentFromTemplate(cylTpl, 720, 120, 1);

      const c1: VirtualConnection = {
        id: 'c_p1',
        type: 'pneumatic',
        fromComponentId: frl.id,
        fromPortId: frl.ports[1].id,
        toComponentId: v32.id,
        toPortId: v32.ports[0].id,
        pressureBar: 6.0,
        active: true
      };

      const c2: VirtualConnection = {
        id: 'c_p2',
        type: 'pneumatic',
        fromComponentId: v32.id,
        fromPortId: v32.ports[1].id,
        toComponentId: throttle.id,
        toPortId: throttle.ports[0].id,
        pressureBar: 0,
        active: false
      };

      const c3: VirtualConnection = {
        id: 'c_p3',
        type: 'pneumatic',
        fromComponentId: throttle.id,
        fromPortId: throttle.ports[1].id,
        toComponentId: cyl.id,
        toPortId: cyl.ports[0].id,
        pressureBar: 0,
        active: false
      };

      return {
        components: [frl, v32, throttle, cyl],
        connections: [c1, c2, c3]
      };
    }
  },
  {
    id: 'preset_relay_seal',
    name: 'Comando com Relé K1 e Autorretenção (Selo Elétrico Industrial)',
    category: 'Eletropneumática com Relés',
    description: 'Circuito com comando elétrico industrial de memória usando relé K1 com autorretenção pelos contatos 13-14, botão liga (NA), botão desliga (NF) e acionamento de solenoide 5/2 monoestável.',
    build: () => {
      const frlTpl = COMPONENT_TEMPLATES.find(t => t.type === 'frl_unit')!;
      const psTpl = COMPONENT_TEMPLATES.find(t => t.type === 'power_supply_24v')!;
      const btnTpl = COMPONENT_TEMPLATES.find(t => t.type === 'push_button_station')!;
      const relayTpl = COMPONENT_TEMPLATES.find(t => t.type === 'industrial_relay')!;
      const valveTpl = COMPONENT_TEMPLATES.find(t => t.type === 'valve_5_2_single_solenoid')!;
      const cylTpl = COMPONENT_TEMPLATES.find(t => t.type === 'double_acting_cylinder')!;
      const emergTpl = COMPONENT_TEMPLATES.find(t => t.type === 'emergency_stop_button')!;

      const frl = createComponentFromTemplate(frlTpl, 40, 50, 1);
      const ps = createComponentFromTemplate(psTpl, 220, 50, 1);
      const emerg = createComponentFromTemplate(emergTpl, 400, 50, 1);
      const btn = createComponentFromTemplate(btnTpl, 570, 50, 1);
      const relay = createComponentFromTemplate(relayTpl, 760, 50, 1);

      const valve = createComponentFromTemplate(valveTpl, 350, 260, 1);
      const cyl = createComponentFromTemplate(cylTpl, 640, 260, 1);

      const c1: VirtualConnection = {
        id: 'c_p1',
        type: 'pneumatic',
        fromComponentId: frl.id,
        fromPortId: frl.ports[1].id,
        toComponentId: valve.id,
        toPortId: valve.ports[0].id,
        pressureBar: 6.0,
        active: true
      };

      const c2: VirtualConnection = {
        id: 'c_p2',
        type: 'pneumatic',
        fromComponentId: valve.id,
        fromPortId: valve.ports[2].id, // 4 (A)
        toComponentId: cyl.id,
        toPortId: cyl.ports[0].id, // Avanço
        pressureBar: 0,
        active: false
      };

      const c3: VirtualConnection = {
        id: 'c_p3',
        type: 'pneumatic',
        fromComponentId: valve.id,
        fromPortId: valve.ports[1].id, // 2 (B)
        toComponentId: cyl.id,
        toPortId: cyl.ports[1].id, // Recuo
        pressureBar: 6.0,
        active: true
      };

      // Electrical: +24V -> Emergência NF -> Botões -> Relé A1
      const c4: VirtualConnection = {
        id: 'c_e1',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[0].id,
        toComponentId: emerg.id,
        toPortId: emerg.ports[0].id,
        voltageV: 24,
        active: true
      };

      const c5: VirtualConnection = {
        id: 'c_e2',
        type: 'electrical',
        fromComponentId: emerg.id,
        fromPortId: emerg.ports[1].id,
        toComponentId: btn.id,
        toPortId: btn.ports[0].id, // NA 13
        voltageV: 24,
        active: true
      };

      const c6: VirtualConnection = {
        id: 'c_e3',
        type: 'electrical',
        fromComponentId: btn.id,
        fromPortId: btn.ports[1].id, // NA 14
        toComponentId: relay.id,
        toPortId: relay.ports[0].id, // A1
        voltageV: 0,
        active: false
      };

      const c7: VirtualConnection = {
        id: 'c_e4',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[2].id, // 0V
        toComponentId: relay.id,
        toPortId: relay.ports[1].id, // A2
        voltageV: 0,
        active: true
      };

      // Relé contato NA -> Válvula Y1 (+)
      const c8: VirtualConnection = {
        id: 'c_e5',
        type: 'electrical',
        fromComponentId: relay.id,
        fromPortId: relay.ports[3].id, // NA 14
        toComponentId: valve.id,
        toPortId: valve.ports[5].id, // Y1 (+) A1
        voltageV: 0,
        active: false
      };

      const c9: VirtualConnection = {
        id: 'c_e6',
        type: 'electrical',
        fromComponentId: ps.id,
        fromPortId: ps.ports[3].id, // 0V
        toComponentId: valve.id,
        toPortId: valve.ports[6].id, // Y1 (-) A2
        voltageV: 0,
        active: true
      };

      return {
        components: [frl, ps, emerg, btn, relay, valve, cyl],
        connections: [c1, c2, c3, c4, c5, c6, c7, c8, c9]
      };
    }
  }
];
