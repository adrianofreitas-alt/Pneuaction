import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory / JSON-backed maintenance database
const MAINTENANCE_FILE = path.join(process.cwd(), "maintenance_db.json");

interface MaintenanceItem {
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

const INITIAL_MAINTENANCE: MaintenanceItem[] = [
  {
    id: "maint_001",
    orderNumber: "OS-2026-089",
    date: "2026-08-28",
    componentTag: "1A",
    componentName: "Cilindro Dupla Ação ISO 15552",
    type: "Preventiva",
    status: "Concluída",
    technician: "Prof. Carlos Silva (SENAI Mecatrônica)",
    description: "Substituição do conjunto de gaxetas de poliuretano e anel raspador da haste. Lubrificação com graxa ISO VG 32.",
    partsReplaced: ["Kit de Vedações NBR/PU Ø32mm", "Anel Raspador da Haste"],
    operatingHours: 1240,
    costEstimateBRL: 145.00,
    nextDueDate: "2026-11-28"
  },
  {
    id: "maint_002",
    orderNumber: "OS-2026-092",
    date: "2026-09-01",
    componentTag: "1V",
    componentName: "Válvula 5/2 Vias Duplo Solenoide",
    type: "Corretiva",
    status: "Concluída",
    technician: "Adriano Freitas (Docente)",
    description: "Identificado aquecimento anormal na bobina Y1 (curto parcial entre espiras). Substituição da bobina solenoide 24VDC 6W.",
    partsReplaced: ["Bobina Solenoide 24V CC Form B", "Mola de Centralização"],
    operatingHours: 980,
    costEstimateBRL: 89.50,
    nextDueDate: "2026-12-01"
  },
  {
    id: "maint_003",
    orderNumber: "OS-2026-095",
    date: "2026-09-03",
    componentTag: "0Z",
    componentName: "Unidade de Conservação FRL",
    type: "Preditiva",
    status: "Agendada",
    technician: "Equipe de Laboratório Automação",
    description: "Drenagem de condensados e inspeção do elemento filtrante sinterizado 5 microns. Verificação da calibração do manômetro 0-10 bar.",
    partsReplaced: [],
    operatingHours: 2100,
    costEstimateBRL: 50.00,
    nextDueDate: "2026-09-10"
  }
];

function loadMaintenanceDb(): MaintenanceItem[] {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const data = fs.readFileSync(MAINTENANCE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading maintenance_db.json:", err);
  }
  return INITIAL_MAINTENANCE;
}

function saveMaintenanceDb(records: MaintenanceItem[]) {
  try {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing maintenance_db.json:", err);
  }
}

// Ensure initial file exists
if (!fs.existsSync(MAINTENANCE_FILE)) {
  saveMaintenanceDb(INITIAL_MAINTENANCE);
}

// REST API ROUTES
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Maintenance Records API
app.get("/api/maintenance", (req, res) => {
  const records = loadMaintenanceDb();
  res.json({
    records,
    stats: {
      total: records.length,
      completed: records.filter(r => r.status === "Concluída").length,
      pending: records.filter(r => r.status === "Em Andamento" || r.status === "Agendada").length,
      totalCostBRL: records.reduce((acc, r) => acc + r.costEstimateBRL, 0),
      mtbfHours: 850,
      mttrHours: 1.8
    }
  });
});

app.post("/api/maintenance", (req, res) => {
  const newRecord: MaintenanceItem = {
    id: `maint_${Date.now()}`,
    orderNumber: `OS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    date: req.body.date || new Date().toISOString().split("T")[0],
    componentTag: req.body.componentTag || "GERAL",
    componentName: req.body.componentName || "Componente da Bancada",
    type: req.body.type || "Preventiva",
    status: req.body.status || "Agendada",
    technician: req.body.technician || "Técnico Responsável",
    description: req.body.description || "Manutenção registrada via simulador",
    partsReplaced: req.body.partsReplaced || [],
    operatingHours: req.body.operatingHours || 100,
    costEstimateBRL: Number(req.body.costEstimateBRL) || 0,
    nextDueDate: req.body.nextDueDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]
  };

  const records = loadMaintenanceDb();
  records.unshift(newRecord);
  saveMaintenanceDb(records);

  res.status(201).json({ success: true, record: newRecord });
});

app.delete("/api/maintenance/:id", (req, res) => {
  const { id } = req.params;
  let records = loadMaintenanceDb();
  records = records.filter(r => r.id !== id);
  saveMaintenanceDb(records);
  res.json({ success: true });
});

// Telemetry state endpoint
let currentTelemetry = {
  mainPressureBar: 6.0,
  flowRateNlMin: 180,
  totalAirConsumedLiters: 1450,
  voltage24V: 24.1,
  currentAmperes: 0.45,
  powerWatts: 10.8,
  manifoldTempC: 24.5,
  totalCycles: 184,
  cycleFrequencyHz: 0.5,
  healthIndexScore: 97,
  emergencyStatus: false,
  iotGatewayOnline: true,
  lastUpdated: new Date().toISOString()
};

app.get("/api/telemetry", (req, res) => {
  res.json(currentTelemetry);
});

app.post("/api/telemetry", (req, res) => {
  currentTelemetry = {
    ...currentTelemetry,
    ...req.body,
    lastUpdated: new Date().toISOString()
  };
  res.json({ success: true, telemetry: currentTelemetry });
});

// Gemini AI Diagnostic & Compliance Analysis
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { components, connections, faults, physicsData, complianceScore } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is required on server",
        aiReport: "Chave de API Gemini não configurada. A análise automatizada por IA requer a chave configurada em Settings > Secrets."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const prompt = `
Você é um Engenheiro Especialista em Eletropneumática Industrial, Segurança de Máquinas (NR-12, ISO 4414, ISO 1219-1/2 e IEC 60204-1) e Manutenção Preditiva.
Analise a seguinte bancada didática eletropneumática montada pelo operador/aluno:

DADOS DO CIRCUITO:
- Total de Componentes: ${components?.length || 0}
- Lista de Componentes: ${(components || []).map((c: any) => `[${c.tag}] ${c.name}`).join(", ")}
- Total de Conexões (Mangueiras e Fios): ${connections?.length || 0}
- Falhas Detectadas Atualmente: ${JSON.stringify(faults || [])}
- Dados Físicos de Resistência Mecânica: ${JSON.stringify(physicsData || {})}
- Índice Atual de Conformidade Técnica: ${complianceScore || 0}%

Por favor, forneça um parecer técnico pericial detalhado em português com a seguinte estrutura formatada:
1. **DIAGNÓSTICO TÉCNICO E CAUSA RAIZ**: Avaliação detalhada do funcionamento e de eventuais falhas identificadas.
2. **ANÁLISE DE RESISTÊNCIA MECÂNICA E FÍSICA**: Comente sobre a força de avanço/recuo, risco de flambagem de Euler na haste e estresse térmico dos componentes.
3. **AUDITORIA DE CONFORMIDADE NORMATIVA**: Avalie a conformidade com a NR-12 (parada de emergência), ISO 4414 (segurança pneumática) e ISO 1219.
4. **PLANO DE AÇÃO E RECOMENDAÇÕES CORRETIVAS**: Passos claros para os alunos/técnicos corrigirem falhas ou otimizarem o circuito.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
      }
    });

    res.json({
      success: true,
      analysis: response.text || "Análise concluída com sucesso."
    });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({
      error: error?.message || "Falha ao processar análise com Gemini",
      fallback: "Não foi possível contatar o serviço de IA no momento."
    });
  }
});

// Vite middleware / production serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bancada Eletropneumatica server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
