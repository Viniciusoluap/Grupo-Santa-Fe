"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, LineChart, AlertTriangle } from "lucide-react";
import {
  resumoCronogramaObra,
  type MedicaoMensal,
  type RiscoExecucao,
} from "@/lib/incorporacao/cronograma-obra";
import { salvarCronogramaObra } from "@/lib/actions/incorporacao";
import { PercentInput } from "@/components/ui/percent-input";
import type { EstudoData } from "./incorporacao-detail";
import { montarPremissasLoteamento } from "@/lib/incorporacao/premissas-loteamento";

// Cronograma Físico-Financeiro (5.3 Projetos Executivos e Obras) — curva S
// física (medições reais em obra) x financeira (desembolso linear
// projetado a partir da duração de obra definida na Viabilidade, 2.5).

interface Dados {
  medicoes: MedicaoMensal[];
  riscos: RiscoExecucao[];
}

function defaults(): Dados {
  return { medicoes: [], riscos: [] };
}

function novaMedicao(proximoMes: number): MedicaoMensal {
  return { id: Math.random().toString(36).slice(2), mes: proximoMes, avancoFisicoAcumuladoPct: 0 };
}

function duracaoObraDoEstudo(estudo: EstudoData): number | null {
  const premissas = montarPremissasLoteamento(estudo);
  return premissas && premissas.duracaoObraMeses > 0 ? premissas.duracaoObraMeses : null;
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";
const numCls = "w-full text-sm border border-gray-200 px-2 py-1.5 text-right focus:outline-none focus:border-[var(--brand-yellow)]";

function fmtPct(v: number | null) {
  return v != null ? `${v}%` : "—";
}

export function CronogramaObraTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.cronogramaObraJson) {
      try {
        const salvo = JSON.parse(estudo.cronogramaObraJson) as Partial<Dados>;
        return {
          medicoes: Array.isArray(salvo.medicoes) ? salvo.medicoes : [],
          riscos: Array.isArray(salvo.riscos) ? salvo.riscos : [],
        };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const duracaoObraMeses = useMemo(() => duracaoObraDoEstudo(estudo), [estudo]);
  const resumo = useMemo(() => resumoCronogramaObra(dados.medicoes, duracaoObraMeses), [dados, duracaoObraMeses]);

  function marcarAlterado() { setSalvo(false); }

  function addMedicao() {
    const proximoMes = dados.medicoes.length > 0 ? Math.max(...dados.medicoes.map((m) => m.mes)) + 1 : 0;
    setDados((d) => ({ ...d, medicoes: [...d.medicoes, novaMedicao(proximoMes)] }));
    marcarAlterado();
  }
  function removerMedicao(id: string) {
    setDados((d) => ({ ...d, medicoes: d.medicoes.filter((m) => m.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof MedicaoMensal>(id: string, campo: K, valor: MedicaoMensal[K]) {
    setDados((d) => ({ ...d, medicoes: d.medicoes.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)) }));
    marcarAlterado();
  }

  function updRisco<K extends keyof RiscoExecucao>(id: string, campo: K, valor: RiscoExecucao[K]) {
    setDados((d) => ({ ...d, riscos: d.riscos.map((r) => r.id === id ? { ...r, [campo]: valor } : r) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarCronogramaObra(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <LineChart size={13} /> Cronograma Físico-Financeiro
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 max-w-xl">
          Registre o avanço físico acumulado por mês de obra. O avanço financeiro projetado (desembolso linear) vem automaticamente da duração de obra já definida na Viabilidade (2.5){duracaoObraMeses ? `: ${duracaoObraMeses} meses` : ", quando ela estiver preenchida"}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Avanço físico atual" valor={fmtPct(resumo.avancoFisicoAtualPct)} />
        <Kpi label="Avanço financeiro projetado" valor={fmtPct(resumo.avancoFinanceiroProjetadoAtualPct)} />
        <Kpi
          label="Desvio (físico - financeiro)"
          valor={resumo.desvioAtualPct != null ? `${resumo.desvioAtualPct > 0 ? "+" : ""}${resumo.desvioAtualPct}%` : "—"}
          destaque
          negativo={resumo.desvioAtualPct != null && resumo.desvioAtualPct < -10}
        />
      </div>

      {resumo.desvioAtualPct != null && resumo.desvioAtualPct < -10 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            A obra está {Math.abs(resumo.desvioAtualPct)} pontos percentuais atrasada em relação ao desembolso financeiro projetado.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[760px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-24">Mês da obra</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Avanço físico (%)</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Financeiro projetado</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Data</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-40">Responsável</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resumo.itens.map((m) => (
                <tr key={m.id}>
                  <td className="px-1 py-1"><input type="number" value={m.mes} onChange={(e) => upd(m.id, "mes", parseFloat(e.target.value) || 0)} className={numCls} /></td>
                  <td className="px-1 py-1"><PercentInput value={m.avancoFisicoAcumuladoPct} onValueChange={(v) => upd(m.id, "avancoFisicoAcumuladoPct", v)} className={numCls} /></td>
                  <td className="px-1 py-1 text-right text-gray-600">{fmtPct(m.avancoFinanceiroProjetadoPct)}</td>
                  <td className="px-1 py-1"><input type="date" value={m.data ?? ""} onChange={(e) => upd(m.id, "data", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1"><select value={m.responsavelId ?? ""} onChange={(e) => upd(m.id, "responsavelId", e.target.value)} className={inputCls}>
                    <option value="">Não atribuído</option>
                    {(estudo.colaboradores ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select></td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerMedicao(m.id)} className="text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addMedicao} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar medição
        </button>
      </div>
      <div className="bg-white border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--brand-dark)]">Riscos de execução</h3>
          <button type="button" onClick={() => { setDados((d) => ({ ...d, riscos: [...d.riscos, { id: crypto.randomUUID(), descricao: "", impacto: "medio", mitigacao: "", status: "aberto" }] })); marcarAlterado(); }}
            className="text-xs font-bold text-blue-700"><Plus size={12} className="inline" /> Adicionar risco</button>
        </div>
        <p className="text-xs text-gray-500">Descreva riscos de obra ou lançamento, a mitigação e o responsável. Esses dados são independentes dos riscos de mercado.</p>
        {dados.riscos.map((r) => <div key={r.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-gray-100 p-3">
          <input aria-label="Descrição do risco" placeholder="Descrição do risco" value={r.descricao} onChange={(e) => updRisco(r.id, "descricao", e.target.value)} className={inputCls} />
          <input aria-label="Mitigação" placeholder="Plano de mitigação" value={r.mitigacao} onChange={(e) => updRisco(r.id, "mitigacao", e.target.value)} className={inputCls} />
          <select aria-label="Impacto" value={r.impacto} onChange={(e) => updRisco(r.id, "impacto", e.target.value as RiscoExecucao["impacto"])} className={inputCls}>
            <option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option>
          </select>
          <select aria-label="Responsável pelo risco" value={r.responsavelId ?? ""} onChange={(e) => updRisco(r.id, "responsavelId", e.target.value)} className={inputCls}>
            <option value="">Não atribuído</option>
            {(estudo.colaboradores ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select aria-label="Situação do risco" value={r.status} onChange={(e) => updRisco(r.id, "status", e.target.value as RiscoExecucao["status"])} className={inputCls}>
            <option value="aberto">Aberto</option><option value="mitigado">Mitigado</option>
          </select>
          <button type="button" onClick={() => { setDados((d) => ({ ...d, riscos: d.riscos.filter((x) => x.id !== r.id) })); marcarAlterado(); }}
            className="text-red-700 text-xs text-left">Remover risco</button>
        </div>)}
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque, negativo }: { label: string; valor: string; destaque?: boolean; negativo?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-300" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? (negativo ? "text-red-400" : "text-[var(--brand-yellow)]") : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
