import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Wrench, 
  DollarSign, 
  RefreshCw,
  UserCheck,
  FileCheck
} from 'lucide-react';
import { MaintenanceRecord } from '../types';

interface MaintenanceStats {
  total: number;
  completed: number;
  pending: number;
  totalCostBRL: number;
  mtbfHours: number;
  mttrHours: number;
}

export const CloudMaintenanceView: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [stats, setStats] = useState<MaintenanceStats>({
    total: 0,
    completed: 0,
    pending: 0,
    totalCostBRL: 0,
    mtbfHours: 850,
    mttrHours: 1.8
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form state
  const [newOrderNumber, setNewOrderNumber] = useState(`OS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [newTag, setNewTag] = useState('1A');
  const [newName, setNewName] = useState('Cilindro Dupla Ação');
  const [newType, setNewType] = useState<'Preventiva' | 'Corretiva' | 'Preditiva'>('Preventiva');
  const [newStatus, setNewStatus] = useState<'Concluída' | 'Em Andamento' | 'Agendada'>('Concluída');
  const [newTechnician, setNewTechnician] = useState('Prof. Carlos Silva (SENAI)');
  const [newDescription, setNewDescription] = useState('Inspeção periódica e troca de vedações');
  const [newParts, setNewParts] = useState('Kit Gaxetas NBR Ø32mm');
  const [newHours, setNewHours] = useState(120);
  const [newCost, setNewCost] = useState(85.00);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/maintenance');
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: newOrderNumber,
          componentTag: newTag,
          componentName: newName,
          type: newType,
          status: newStatus,
          technician: newTechnician,
          description: newDescription,
          partsReplaced: newParts ? newParts.split(',').map(s => s.trim()) : [],
          operatingHours: Number(newHours),
          costEstimateBRL: Number(newCost)
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to create maintenance record:', err);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
      fetchRecords();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.componentTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.componentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.technician.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Banco em Nuvem: Histórico de Manutenções & Ordens de Serviço (OS)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registro perene de intervenções preventivas, corretivas e preditivas da bancada didática com cálculo de MTBF e MTTR.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Ordem de Serviço (OS)</span>
            </button>
          </div>
        </div>

        {/* Stats Summary Bento Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">Total de OS</span>
            <p className="text-xl font-mono font-bold text-white mt-1">{stats.total}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">Concluídas</span>
            <p className="text-xl font-mono font-bold text-emerald-400 mt-1">{stats.completed}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">Pendentes / Agendadas</span>
            <p className="text-xl font-mono font-bold text-amber-400 mt-1">{stats.pending}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">Custo Total (R$)</span>
            <p className="text-xl font-mono font-bold text-cyan-400 mt-1">
              R$ {stats.totalCostBRL.toFixed(2)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">MTBF Médio</span>
            <p className="text-xl font-mono font-bold text-purple-400 mt-1">{stats.mtbfHours} h</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="text-[11px] text-slate-400">MTTR Médio</span>
            <p className="text-xl font-mono font-bold text-blue-400 mt-1">{stats.mttrHours} h</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por TAG (ex: 1A, 1V), Ordem, Técnico ou Descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-slate-200 placeholder-slate-500 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">Todos os Tipos</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Corretiva">Corretiva</option>
              <option value="Preditiva">Preditiva</option>
            </select>
          </div>
        </div>

        {/* Maintenance Records List */}
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
              Nenhuma ordem de serviço encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredRecords.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                      {item.orderNumber}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-slate-800">
                      TAG: {item.componentTag}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      item.type === 'Preventiva'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : item.type === 'Corretiva'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}>
                      {item.type}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      item.status === 'Concluída'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.date}
                    </span>
                    <button
                      onClick={() => handleDeleteRecord(item.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                      title="Excluir Registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">
                    {item.componentName}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Sub-details: parts, cost, hours */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      <strong className="text-slate-300">Técnico:</strong> {item.technician}
                    </span>
                    <span>
                      <strong className="text-slate-300">Horas Op.:</strong> {item.operatingHours} h
                    </span>
                    {item.partsReplaced && item.partsReplaced.length > 0 && (
                      <span>
                        <strong className="text-slate-300">Peças Trocadas:</strong> {item.partsReplaced.join(', ')}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-mono text-cyan-400 font-semibold">
                      Custo: R$ {item.costEstimateBRL?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Nova Ordem de Serviço */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <span>Cadastrar Ordem de Serviço (OS)</span>
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRecord} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium">Número da OS</label>
                    <input
                      type="text"
                      value={newOrderNumber}
                      onChange={(e) => setNewOrderNumber(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium">TAG do Componente</label>
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="ex: 1A, 1V, 0Z"
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Nome do Componente</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium">Tipo de Intervenção</label>
                    <select
                      value={newType}
                      onChange={(e: any) => setNewType(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Preventiva">Preventiva</option>
                      <option value="Corretiva">Corretiva</option>
                      <option value="Preditiva">Preditiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium">Status da OS</label>
                    <select
                      value={newStatus}
                      onChange={(e: any) => setNewStatus(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Concluída">Concluída</option>
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Agendada">Agendada</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Técnico Responsável</label>
                  <input
                    type="text"
                    value={newTechnician}
                    onChange={(e) => setNewTechnician(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Descrição dos Serviços Executados</label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium">Peças Substituídas (separar por vírgula)</label>
                    <input
                      type="text"
                      value={newParts}
                      onChange={(e) => setNewParts(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium">Custo Estimado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCost}
                      onChange={(e) => setNewCost(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  >
                    Salvar no Banco em Nuvem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
