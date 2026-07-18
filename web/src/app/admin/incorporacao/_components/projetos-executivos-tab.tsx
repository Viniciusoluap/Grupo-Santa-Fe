"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, FileCode2 } from "lucide-react";
import {
  resumoProjetosExecutivos,
  DISCIPLINAS_EXECUTIVO,
  type DisciplinaExecutivo,
  type ProjetoExecutivo,
  type StatusProjetoExecutivo,
} from "@/lib/incorporacao/projetos-executivos";
import { salvarProjetosExecutivos } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Projetos Executivos (5.1 Projetos Executivos e Obras) — repositório dos
// projetos executivos de engenharia liberados para obra, antecedendo os
// orçamentos reais (5.2) e o cronograma físico-financeiro (5.3).

const STATUS: { value: StatusProjetoExecutivo; label: string }[] = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_elaboracao", label: "Em elaboração" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "liberado_para_obra", label: "Liberado para obra" },
];

interface Dados {
  projetos: ProjetoExecutivo[];
}

function defaults(): Dados {
  return { projetos: [] };
}

function novoProjeto(): ProjetoExecutivo {
  return { id: Math.random().toString(36).slice(2), disciplina: "Arquitetura Executiva", status: "nao_iniciado" };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function ProjetosExecutivosTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.projetosExecutivosJson) {
      try {
        const salvo = JSON.parse(estudo.projetosExecutivosJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoProjetosExecutivos(dados.projetos), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addProjeto() {
    setDados((d) => ({ projetos: [...d.projetos, novoProjeto()] }));
    marcarAlterado();
  }
  function removerProjeto(id: string) {
    setDados((d) => ({ projetos: d.projetos.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ProjetoExecutivo>(id: string, campo: K, valor: ProjetoExecutivo[K]) {
    setDados((d) => ({ projetos: d.projetos.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarProjetosExecutivos(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <FileCode2 size={13} /> Projetos Executivos
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um projeto por disciplina. A etapa fica concluída quando todos os projetos cadastrados estiverem liberados para obra.
        </p>
      </div>

      {dados.projetos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Projetos" valor={String(resumo.total)} />
          <Kpi label="Liberados para obra" valor={String(resumo.liberados)} />
          <Kpi label="% liberado" valor={`${resumo.pctLiberado}%`} destaque />
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[640px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-56">Disciplina</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Link do arquivo</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Data de liberação</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.projetos.map((p) => (
                <tr key={p.id}>
                  <td className="px-1 py-1">
                    <select value={p.disciplina} onChange={(e) => upd(p.id, "disciplina", e.target.value as DisciplinaExecutivo)} className={inputCls}>
                      {DISCIPLINAS_EXECUTIVO.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={p.url ?? ""} onChange={(e) => upd(p.id, "url", e.target.value)} className={inputCls} placeholder="https://..." /></td>
                  <td className="px-1 py-1"><input type="date" value={p.dataLiberacao ?? ""} onChange={(e) => upd(p.id, "dataLiberacao", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1">
                    <select value={p.status} onChange={(e) => upd(p.id, "status", e.target.value as StatusProjetoExecutivo)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerProjeto(p.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addProjeto} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar projeto
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border p-3 ${destaque ? "bg-[var(--brand-dark)] border-transparent" : "bg-white border-gray-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-400">{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
