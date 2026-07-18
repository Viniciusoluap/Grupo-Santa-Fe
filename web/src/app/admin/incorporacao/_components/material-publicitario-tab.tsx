"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Megaphone } from "lucide-react";
import {
  resumoMaterialPublicitario,
  TIPOS_PECA_PUBLICITARIA,
  type PecaPublicitaria,
  type StatusPeca,
  type TipoPecaPublicitaria,
} from "@/lib/incorporacao/material-publicitario";
import { salvarMaterialPublicitario } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Material Publicitário (4.3 Lançamento, Marketing e Vendas) — repositório
// e aprovação das peças publicitárias do lançamento.

const STATUS: { value: StatusPeca; label: string }[] = [
  { value: "em_producao", label: "Em produção" },
  { value: "em_aprovacao", label: "Em aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
];

interface Dados {
  pecas: PecaPublicitaria[];
}

function defaults(): Dados {
  return { pecas: [] };
}

function novaPeca(): PecaPublicitaria {
  return { id: Math.random().toString(36).slice(2), tipo: "Site", nome: "", status: "em_producao" };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function MaterialPublicitarioTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.materialPublicitarioJson) {
      try {
        const salvo = JSON.parse(estudo.materialPublicitarioJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoMaterialPublicitario(dados.pecas), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addPeca() {
    setDados((d) => ({ pecas: [...d.pecas, novaPeca()] }));
    marcarAlterado();
  }
  function removerPeca(id: string) {
    setDados((d) => ({ pecas: d.pecas.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof PecaPublicitaria>(id: string, campo: K, valor: PecaPublicitaria[K]) {
    setDados((d) => ({ pecas: d.pecas.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarMaterialPublicitario(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Megaphone size={13} /> Material Publicitário
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Uma peça por linha. A etapa fica concluída quando todas as peças cadastradas estiverem aprovadas.
        </p>
      </div>

      {dados.pecas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Peças" valor={String(resumo.total)} />
          <Kpi label="Em aprovação" valor={String(resumo.emAprovacao)} />
          <Kpi label="Aprovadas" valor={`${resumo.pctAprovado}%`} destaque />
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[640px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Tipo</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Nome/Descrição</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Link do arquivo</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.pecas.map((p) => (
                <tr key={p.id}>
                  <td className="px-1 py-1">
                    <select value={p.tipo} onChange={(e) => upd(p.id, "tipo", e.target.value as TipoPecaPublicitaria)} className={inputCls}>
                      {TIPOS_PECA_PUBLICITARIA.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={p.nome} onChange={(e) => upd(p.id, "nome", e.target.value)} className={inputCls} placeholder="Ex.: Vídeo de 30s para Instagram" /></td>
                  <td className="px-1 py-1"><input value={p.url ?? ""} onChange={(e) => upd(p.id, "url", e.target.value)} className={inputCls} placeholder="https://..." /></td>
                  <td className="px-1 py-1">
                    <select value={p.status} onChange={(e) => upd(p.id, "status", e.target.value as StatusPeca)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerPeca(p.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addPeca} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar peça
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
