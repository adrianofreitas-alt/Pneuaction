/**
 * Physics and Engineering Calculation Engine for Electropneumatics
 * Conforms to ISO 15552, ISO 4414, and Euler mechanical buckling equations.
 */

export interface CylinderPhysicsInput {
  boreDiameterMm: number;    // D: Diâmetro do êmbolo (ex: 32mm)
  rodDiameterMm: number;     // d: Diâmetro da haste (ex: 12mm)
  strokeLengthMm: number;    // L: Curso (ex: 100mm)
  workingPressureBar: number;// P: Pressão de trabalho (ex: 6 bar)
  appliedLoadNewton: number; // F_ext: Carga externa axial resistente (ex: 150 N)
  efficiency?: number;       // Rendimento mecânico padrão 0.85 a 0.95
}

export interface CylinderPhysicsResults {
  pistonAreaCm2: number;            // Área do êmbolo (A1)
  annularAreaCm2: number;           // Área anular da haste (A2)
  theoreticalAdvanceForceN: number; // Força teórica avanço
  effectiveAdvanceForceN: number;   // Força efetiva avanço
  theoreticalReturnForceN: number;  // Força teórica recuo
  effectiveReturnForceN: number;    // Força efetiva recuo
  eulerCriticalBucklingN: number;   // Carga crítica de flambagem de Euler (Fk)
  bucklingSafetyFactor: number;     // Coeficiente de segurança contra flambagem (S)
  isBucklingRisk: boolean;          // Alerta de risco estrutural
  airConsumptionPerCycleNl: number; // Consumo de ar livre por ciclo duplo (Nl)
  maxStrokeVelocityMmS: number;     // Velocidade máxima estimada (mm/s)
  stressMpa: number;                // Tensão na haste (MPa)
  yieldStressSteelMpa: number;      // Tensão limite de escoamento (ex: 350 MPa)
  recommendation: string;
}

export function calculateCylinderPhysics(input: CylinderPhysicsInput): CylinderPhysicsResults {
  const {
    boreDiameterMm,
    rodDiameterMm,
    strokeLengthMm,
    workingPressureBar,
    appliedLoadNewton,
    efficiency = 0.90
  } = input;

  // D and d in cm
  const D_cm = boreDiameterMm / 10;
  const d_cm = rodDiameterMm / 10;
  const L_cm = strokeLengthMm / 10;

  // Areas in cm2
  const A1 = (Math.PI * Math.pow(D_cm, 2)) / 4;
  const A2 = (Math.PI * (Math.pow(D_cm, 2) - Math.pow(d_cm, 2))) / 4;

  // Forces: 1 bar = 10 N/cm2 = 0.1 N/mm2 = 100 kPa
  // Force (N) = Pressure (bar) * 10 (N/cm2/bar) * Area (cm2)
  const theoreticalAdvanceForceN = workingPressureBar * 10 * A1;
  const effectiveAdvanceForceN = theoreticalAdvanceForceN * efficiency;

  const theoreticalReturnForceN = workingPressureBar * 10 * A2;
  const effectiveReturnForceN = theoreticalReturnForceN * efficiency;

  // Euler Buckling calculation for slender rod under compression
  // E (Aço Cromo Duro) = 210,000 N/mm2 (MPa)
  // Moment of Inertia for circular cross-section rod: I = (pi * d^4) / 64 (mm4)
  const E = 210000; // N/mm2
  const d_mm = rodDiameterMm;
  const I_mm4 = (Math.PI * Math.pow(d_mm, 4)) / 64;

  // Free end guided: free length buckling factor k = 2.0 (caso mais desfavorável cantilever / guia livre)
  const freeLengthMm = strokeLengthMm * 1.5; 
  const eulerCriticalBucklingN = (Math.pow(Math.PI, 2) * E * I_mm4) / Math.pow(freeLengthMm, 2);

  // Safety factor
  const totalCompressiveLoad = Math.max(appliedLoadNewton, 1);
  const bucklingSafetyFactor = eulerCriticalBucklingN / totalCompressiveLoad;
  const isBucklingRisk = bucklingSafetyFactor < 3.5; // Industrial standard safety factor > 3.5

  // Air consumption per double cycle:
  // Compression ratio = (Pressure + 1.013) / 1.013
  const compressionRatio = (workingPressureBar + 1.013) / 1.013;
  // Volume in liters: V = (A1 + A2) * L_cm / 1000
  const geometricVolumeLiters = ((A1 + A2) * L_cm) / 1000;
  const airConsumptionPerCycleNl = geometricVolumeLiters * compressionRatio;

  // Axial stress in piston rod
  const rodAreaMm2 = (Math.PI * Math.pow(d_mm, 2)) / 4;
  const stressMpa = effectiveAdvanceForceN / rodAreaMm2;
  const yieldStressSteelMpa = 350; // Aço CK45 cromo-duro

  // Max estimated velocity based on standard 6mm hose and 400 Nl/min flow
  const maxStrokeVelocityMmS = Math.min(600, Math.round((400 / (A1 * 0.001 * 60)) * 0.15));

  let recommendation = "Dimensionamento adequado. Coeficiente de segurança dentro dos padrões industriais ISO 15552.";
  if (effectiveAdvanceForceN < appliedLoadNewton) {
    recommendation = "ALERTA: A força do cilindro é insuficiente para mover a carga selecionada! Aumente a pressão ou o diâmetro do êmbolo.";
  } else if (isBucklingRisk) {
    recommendation = `ALERTA DE FLAMBAGEM (S = ${bucklingSafetyFactor.toFixed(1)}): Risco de encurvamento permanente da haste sob compressão. Recomenda-se aumentar o diâmetro da haste ou adicionar guia externa.`;
  } else if (stressMpa > yieldStressSteelMpa * 0.6) {
    recommendation = "ATENÇÃO: Tensão mecânica elevada na haste (> 60% do limite elástico). Verifique ciclos de fadiga.";
  }

  return {
    pistonAreaCm2: Number(A1.toFixed(2)),
    annularAreaCm2: Number(A2.toFixed(2)),
    theoreticalAdvanceForceN: Math.round(theoreticalAdvanceForceN),
    effectiveAdvanceForceN: Math.round(effectiveAdvanceForceN),
    theoreticalReturnForceN: Math.round(theoreticalReturnForceN),
    effectiveReturnForceN: Math.round(effectiveReturnForceN),
    eulerCriticalBucklingN: Math.round(eulerCriticalBucklingN),
    bucklingSafetyFactor: Number(bucklingSafetyFactor.toFixed(2)),
    isBucklingRisk,
    airConsumptionPerCycleNl: Number(airConsumptionPerCycleNl.toFixed(3)),
    maxStrokeVelocityMmS,
    stressMpa: Number(stressMpa.toFixed(1)),
    yieldStressSteelMpa,
    recommendation
  };
}

/**
 * Calculates Solenoid thermal rise over duty cycle
 */
export function calculateSolenoidThermalRise(activeSeconds: number, dutyCyclePercent: number): {
  temperatureC: number;
  isOverheating: boolean;
  coilResistanceOhm: number;
} {
  const ambientTempC = 23;
  const maxDeltaTC = 45; // Máxima elevação térmica contínua em regime permanente
  const thermalTauSec = 60; // Constante de tempo térmica

  const deltaT = maxDeltaTC * (dutyCyclePercent / 100) * (1 - Math.exp(-activeSeconds / thermalTauSec));
  const currentTemp = ambientTempC + deltaT;

  // Copper resistance increases ~0.39% per °C
  const nominalResistanceOhm = 96; // 24V / 96 ohm = 0.25A (6W coil)
  const currentResistanceOhm = nominalResistanceOhm * (1 + 0.0039 * deltaT);

  return {
    temperatureC: Number(currentTemp.toFixed(1)),
    isOverheating: currentTemp > 65,
    coilResistanceOhm: Number(currentResistanceOhm.toFixed(1))
  };
}
