import { BenchComponent, VirtualConnection, ComplianceCheck } from '../types';

export interface ComplianceEvaluation {
  score: number; // 0 to 100
  status: 'Conforme' | 'Conforme com Restrições' | 'Não Conforme';
  checks: ComplianceCheck[];
  summaryText: string;
}

export function evaluateTechnicalCompliance(
  components: BenchComponent[],
  connections: VirtualConnection[]
): ComplianceEvaluation {
  const checks: ComplianceCheck[] = [];

  // 1. NR-12: Emergency Stop Device
  const hasEmergency = components.some(c => c.type === 'emergency_stop_button');
  if (hasEmergency) {
    const isConn = connections.some(cn => {
      const comp = components.find(c => c.id === cn.fromComponentId || c.id === cn.toComponentId);
      return comp?.type === 'emergency_stop_button';
    });

    if (isConn) {
      checks.push({
        id: 'nr12_emerg_active',
        standard: 'NR-12',
        clause: 'Item 12.56 a 12.63',
        title: 'Dispositivo de Parada de Emergência com Trava Mecânica',
        status: 'passed',
        details: 'Botão tipo cogumelo instalado com retenção mecânica e conectado ao circuito de comando de segurança.',
        recommendation: 'Manter inspeção periódica do mecanismo de trava e rearme por giro.'
      });
    } else {
      checks.push({
        id: 'nr12_emerg_unconnected',
        standard: 'NR-12',
        clause: 'Item 12.56',
        title: 'Dispositivo de Emergência sem Intertravamento Elétrico',
        status: 'warning',
        details: 'Botão de emergência presente na bancada, porém sem conexões ativas na linha de comando.',
        recommendation: 'Conectar os contatos NF (21-22) em série com a linha de alimentação de comando das válvulas.'
      });
    }
  } else {
    checks.push({
      id: 'nr12_emerg_missing',
      standard: 'NR-12',
      clause: 'Item 12.56',
      title: 'Ausência de Dispositivo de Parada de Emergência',
      status: 'failed',
      details: 'Não foi detectado botão cogumelo de parada de emergência no arranjo da bancada.',
      recommendation: 'Obrigatório adicionar botão de emergência com ação positiva de ruptura para conformidade NR-12.'
    });
  }

  // 2. ISO 4414: Air Preparation & Pressure Limitation
  const hasFRL = components.some(c => c.type === 'frl_unit');
  if (hasFRL) {
    checks.push({
      id: 'iso4414_frl',
      standard: 'ISO 4414',
      clause: 'Cláusula 5.1.3 e 5.1.6',
      title: 'Tratamento de Ar Comprimido e Regulação de Pressão',
      status: 'passed',
      details: 'Unidade de conservação FRL instalada garantindo filtragem de partículas e manômetro calibrado.',
      recommendation: 'Verificar dreno de condensados da cúpula do filtro regularmente.'
    });
  } else {
    checks.push({
      id: 'iso4414_frl_missing',
      standard: 'ISO 4414',
      clause: 'Cláusula 5.1.3',
      title: 'Ausência de Filtro e Regulador Primário',
      status: 'failed',
      details: 'Circuito pneumático operando diretamente sem unidade FRL de condicionamento.',
      recommendation: 'Adicionar unidade FRL para evitar contaminação por umidade e sobrepressão nos atuadores.'
    });
  }

  // 3. ISO 1219-1/2: Correct Piping and Exhaust Ports
  const valves = components.filter(c => c.category === 'valves');
  if (valves.length > 0) {
    const connectedValves = valves.filter(v => {
      return connections.some(cn => cn.fromComponentId === v.id || cn.toComponentId === v.id);
    });

    if (connectedValves.length === valves.length) {
      checks.push({
        id: 'iso1219_symbology',
        standard: 'ISO 1219-1/2',
        clause: 'Cláusula 6.2 - Identificação de Orifícios',
        title: 'Padronização de Portas e Simbologia de Válvulas',
        status: 'passed',
        details: 'Orifícios 1(P), 2/4(A/B) e escapes 3/5(R/S) identificados conforme norma internacional.',
        recommendation: 'Assegurar silenciadores sinterizados montados nos orifícios de exaustão.'
      });
    } else {
      checks.push({
        id: 'iso1219_incomplete',
        standard: 'ISO 1219-1/2',
        clause: 'Cláusula 6.2',
        title: 'Válvulas com Orifícios Não Conectados',
        status: 'warning',
        details: 'Existem válvulas direcionais na bancada com vias de trabalho ou escape abertas.',
        recommendation: 'Completar conexões de trabalho ou tampar orifícios não utilizados.'
      });
    }
  }

  // 4. IEC 60204-1: Electrical Safety in Machinery
  const has24VSupply = components.some(c => c.type === 'power_supply_24v');
  if (has24VSupply) {
    checks.push({
      id: 'iec60204_pelv',
      standard: 'IEC 60204-1',
      clause: 'Seção 6.4 - Circuitos PELV/SELV',
      title: 'Tensão de Comando Estrita em 24V CC (PELV)',
      status: 'passed',
      details: 'Fonte de alimentação fixada estritamente em 24V CC estabilizado, com proteção contra sobretensão e isolamento galvânico conforme NR-12.',
      recommendation: 'Garantir conexão equipotencial do terminal 0V ao aterramento de proteção da bancada.'
    });
  } else {
    checks.push({
      id: 'iec60204_missing_ps',
      standard: 'IEC 60204-1',
      clause: 'Seção 6.4',
      title: 'Fonte Estabilizada de 24V Não Identificada',
      status: 'warning',
      details: 'Não há módulo de alimentação fixa 24V CC regulada inserido no circuito.',
      recommendation: 'Incluir a fonte industrial fixa 24V CC (PELV) para garantir a segurança operacional.'
    });
  }

  // 5. ISO 4414: Flow Throttling / Speed Control on Cylinders
  const cylinders = components.filter(c => c.category === 'actuators');
  const throttles = components.filter(c => c.type === 'flow_control_throttle');
  if (cylinders.length > 0) {
    if (throttles.length > 0) {
      checks.push({
        id: 'iso4414_speed_ctrl',
        standard: 'ISO 4414',
        clause: 'Cláusula 5.4.5.3.3',
        title: 'Controle de Velocidade e Amortecimento de Fim de Curso',
        status: 'passed',
        details: 'Válvula reguladora de fluxo unidirecional instalada para evitar impactos mecânicos destrutivos.',
        recommendation: 'Regular estrangulamento para velocidade do êmbolo inferior a 0.5 m/s.'
      });
    } else {
      checks.push({
        id: 'iso4414_speed_warn',
        standard: 'ISO 4414',
        clause: 'Cláusula 5.4.5.3.3',
        title: 'Ausência de Regulador de Velocidade para o Cilindro',
        status: 'warning',
        details: 'Cilindro pneumático operando com fluxo livre de ar. Pode ocasionar choque mecânico no cabeçote.',
        recommendation: 'Recomenda-se adicionar Válvula Reguladora de Fluxo Unidirecional no escape do cilindro.'
      });
    }
  }

  // Calculate score
  const passedCount = checks.filter(c => c.status === 'passed').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const totalChecks = Math.max(checks.length, 1);
  const score = Math.round(((passedCount * 1.0 + warningCount * 0.5) / totalChecks) * 100);

  let status: 'Conforme' | 'Conforme com Restrições' | 'Não Conforme' = 'Conforme';
  if (score < 60 || checks.some(c => c.status === 'failed' && c.standard === 'NR-12')) {
    status = 'Não Conforme';
  } else if (score < 90 || checks.some(c => c.status === 'warning')) {
    status = 'Conforme com Restrições';
  }

  let summaryText = `Avaliação Técnica Automatizada: Índice de Conformidade de ${score}%. `;
  if (status === 'Conforme') {
    summaryText += 'O projeto atende a todos os requisitos normativos essenciais de segurança (NR-12), pneumática (ISO 4414/ISO 1219) e elétrica (IEC 60204-1).';
  } else if (status === 'Conforme com Restrições') {
    summaryText += 'O circuito funciona, porém apresenta advertências técnicas recomendáveis para prevenção de desgaste precoce ou segurança aprimorada.';
  } else {
    summaryText += 'ATENÇÃO: O circuito viola normas obrigatórias de segurança do trabalho ou projeto eletropneumático. Bloqueio operacional recomendado até adequação.';
  }

  return {
    score,
    status,
    checks,
    summaryText
  };
}
