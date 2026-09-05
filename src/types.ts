export type PortType = 'pneumatic' | 'electrical';

export type PneumaticPortFunction = 
  | 'pressure'    // 1 (P)
  | 'work_a'      // 4 (A)
  | 'work_b'      // 2 (B)
  | 'exhaust_r'   // 3 (R)
  | 'exhaust_s'   // 5 (S)
  | 'pilot_14'    // 14 (Z)
  | 'pilot_12';   // 12 (Y)

export type ElectricalPortFunction = 
  | 'power_24v'   // +24V
  | 'ground_0v'   // 0V
  | 'signal_in'   // Input / Coil A1
  | 'signal_out'  // Output / Coil A2 / Contact
  | 'sensor_sig'; // Sensor output

export interface ComponentPort {
  id: string;
  name: string;
  type: PortType;
  functionType: PneumaticPortFunction | ElectricalPortFunction;
  x: number; // relative percentage 0-100 inside component
  y: number; // relative percentage 0-100 inside component
  pressureBar?: number;
  voltageV?: number;
  connectedTo?: string; // connection ID
}

export type ComponentCategory = 
  | 'supply'      // FRL, Fonte 24V, Coletor
  | 'actuators'   // Cilindros, Atuadores rotativos
  | 'valves'      // 3/2, 5/2, 5/3
  | 'flow_logic'  // Reguladora de fluxo, escape rápido, E, OU
  | 'electrical'  // Botões, Relés, Sensores, Sinalizadores
  | 'sensors';    // Sensores de fim de curso

export type SensorTechnology = 'magnetic' | 'inductive' | 'capacitive' | 'optical';
export type SensorWireCount = '2_wires' | '3_wires' | '4_wires';

export interface BenchComponent {
  id: string;
  type: string;
  name: string;
  tag: string; // e.g. "1A", "1V1", "1S1", "+24V"
  category: ComponentCategory;
  x: number; // position on bench canvas (px)
  y: number; // position on bench canvas (px)
  width: number;
  height: number;
  rotation?: number; // 0, 90, 180, 270 degrees
  ports: ComponentPort[];
  state: {
    activated?: boolean;
    position?: number; // 0 to 100% for cylinder stroke
    targetPosition?: number;
    speed?: number; // %/sec
    pressureA?: number; // bar
    pressureB?: number; // bar
    pressureP?: number; // bar
    valvePosition?: 'left' | 'center' | 'right';
    solenoidLeftActive?: boolean;
    solenoidRightActive?: boolean;
    manualOverride?: boolean;
    transparentGlassMode?: boolean;
    isEmergencyTriggered?: boolean;
    isLocked?: boolean;
    flowThrottlePercent?: number; // 1 to 100%
    contactClosed?: boolean;
    ledActive?: boolean;
    buzzerActive?: boolean;
    sensorDetected?: boolean;
    buttonNApressed?: boolean;
    buttonNFpressed?: boolean;
    detectionPosition?: number;
    voltageV?: number;
    fixedVoltageOnly?: boolean;
    currentAmperes?: number;
    // Sensor parameters and diagnostics
    sensorTech?: SensorTechnology;
    sensorWires?: SensorWireCount;
    isPowerCorrect?: boolean;
    powerErrorDetail?: string;
    outputNAactive?: boolean;
    outputNFactive?: boolean;
    // Physical parameters
    boreDiameterMm?: number; // Diâmetro do êmbolo (ex: 32mm)
    rodDiameterMm?: number;  // Diâmetro da haste (ex: 12mm)
    strokeLengthMm?: number; // Curso (ex: 100mm)
    appliedLoadN?: number;   // Carga aplicada em Newtons (ex: 150N)
    temperatureC?: number;   // Temperatura (°C)
    cyclesTotal?: number;    // Contador de ciclos
    healthPercent?: number;  // Saúde do componente (100%)
  };
  faults?: {
    isLeaking?: boolean;
    isStuck?: boolean;
    isCoilBurned?: boolean;
    isLowPressure?: boolean;
  };
}

export interface VirtualConnection {
  id: string;
  type: PortType;
  fromComponentId: string;
  fromPortId: string;
  toComponentId: string;
  toPortId: string;
  color?: string;
  active?: boolean;
  pressureBar?: number;
  voltageV?: number;
  flowRateLmin?: number;
  isLeaking?: boolean;
}

export interface DiagnosticFault {
  id: string;
  componentId?: string;
  componentTag: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  message: string;
  symptom: string;
  rootCause: string;
  recommendedAction: string;
  standardReference?: string;
}

export type FaultDiagnostic = DiagnosticFault;

export interface MaintenanceRecord {
  id: string;
  orderNumber: string;
  date: string;
  componentTag: string;
  componentName: string;
  type: 'Preventiva' | 'Corretiva' | 'Preditiva';
  status: 'Concluída' | 'Em Andamento' | 'Agendada';
  technician: string;
  description: string;
  partsReplaced: string[];
  operatingHours: number;
  costEstimateBRL: number;
  nextDueDate: string;
}

export interface ComplianceCheck {
  id: string;
  standard: 'NR-12' | 'ISO 1219-1/2' | 'ISO 4414' | 'IEC 60204-1';
  clause: string;
  title: string;
  status: 'passed' | 'warning' | 'failed';
  details: string;
  recommendation: string;
}

export interface TelemetryMetrics {
  mainPressureBar: number;
  flowRateNlMin: number;
  totalAirConsumedLiters: number;
  voltage24V: number;
  currentAmperes: number;
  powerWatts: number;
  manifoldTempC: number;
  totalCycles: number;
  cycleFrequencyHz: number;
  healthIndexScore: number;
  emergencyStatus: boolean;
  iotGatewayOnline: boolean;
  lastUpdated?: string;
}

export interface TestSessionReport {
  sessionId: string;
  title: string;
  operator: string;
  institution: string;
  date: string;
  durationSeconds: number;
  componentsCount: number;
  connectionsCount: number;
  totalCyclesExecuted: number;
  peakPressureBar: number;
  avgCycleTimeSec: number;
  maxForceNewton: number;
  faultsDetected: FaultDiagnostic[];
  complianceScore: number;
  complianceChecks: ComplianceCheck[];
  physicsSummary: {
    cylinder1AFactorOfSafety: number;
    eulerBucklingLoadN: number;
    ratedWorkForceN: number;
    solenoidThermalStressPercent: number;
    recommendedAirQualityClass: string;
  };
  aiReportSummary?: string;
}
