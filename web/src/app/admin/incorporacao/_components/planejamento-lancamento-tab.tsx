"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, Loader2, CheckCircle2, Rocket, AlertTriangle } from "lucide-react";
import {
  resumoPlanejamentoLancamento,
  MARCOS_PADRAO_LANCAMENTO,
  type MarcoLancamento,
  type StatusMarco,
} from "@/lib/incorporacao/planejamento-lancamento";
import { salvarPlanejamentoLancamento } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Planejamento do Lançamento (4.1 Lançamento, Marketing e Vendas) —
// cronograma de marcos pré-preenchido automaticamente (regra do projeto:
// nada manual quando dá para o sistema já entregar pronto).

interface Dados {
  marcos: MarcoLancamento[];
}

function defaults(): Dados {
  return {
    marcos: MARCOS_PADRAO_LANCAMENTO.map((nome, i) => ({
      id: `padrao-${i}`,
      nome,
      status: "pendente" as StatusMarco,
    })),
  };
}

const STATUS: { value: StatusMarco; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

const inputCls = "min-w-0 max-w-full w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function PlanejamentoLancamentoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.planejamentoLancamentoJson) {
      try {
        const salvo = JSON.parse(estudo.planejamentoLancamentoJson) as Partial<Dados>;
        if (salvo.marcos?.length) return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoPlanejamentoLancamento(dados.marcos), [dados]);

  function upd(id: string, campo: "status" | "dataPrevista" | "dataRealizada" | "responsavelId", valor: string) {
    setDados((d) => ({ marcos: d.marcos.map((m) => (m.id === id ? { ...m, [campo]: valor } : m)) }));
    setSalvo(false);
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarPlanejamentoLancamento(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Rocket size={13} /> Planejamento do Lançamento
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 max-w-xl">
          Cronograma padrão do lançamento comercial, já pré-preenchido. A etapa fica concluída quando todos os marcos estiverem concluídos.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Marcos" valor={String(resumo.total)} />
        <Kpi label="Atrasados" valor={String(resumo.atrasados.length)} negativo={resumo.atrasados.length > 0} />
        <Kpi label="Concluído" valor={`${resumo.pctConcluido}%`} destaque />
      </div>

      {resumo.atrasados.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            {resumo.atrasados.length} marco(s) com data prevista vencida: {resumo.atrasados.map((m) => m.nome).join(", ")}.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="block w-full text-xs 2xl:table 2xl:table-fixed">
            <thead className="hidden 2xl:table-header-group">
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-72">Marco</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Data prevista</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Data realizada</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-40">Responsável pelo marco</th>
              </tr>
            </thead>
            <tbody className="grid gap-3 2xl:table-row-group">
              {dados.marcos.map((m) => (
                <tr key={m.id} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 2xl:table-row 2xl:border-0 2xl:p-0 [&>td]:min-w-0">
                  <td data-label="Marco" className="px-1 py-1.5 text-gray-600 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">{m.nome}</td>
                  <td data-label="Data prevista" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><input type="date" value={m.dataPrevista ?? ""} onChange={(e) => upd(m.id, "dataPrevista", e.target.value)} className={inputCls} /></td>
                  <td data-label="Data realizada" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><input type="date" value={m.dataRealizada ?? ""} onChange={(e) => upd(m.id, "dataRealizada", e.target.value)} className={inputCls} /></td>
                  <td data-label="Status" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">
                    <select value={m.status} onChange={(e) => upd(m.id, "status", e.target.value)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td data-label="Responsável pelo marco" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><select value={m.responsavelId ?? ""} onChange={(e) => upd(m.id, "responsavelId", e.target.value)} className={inputCls}>
                    <option value="">Não atribuído</option>
                    {(estudo.colaboradores ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque, negativo }: { label: string; valor: string; destaque?: boolean; negativo?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-300" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : negativo ? "text-red-500" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
