"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Headset } from "lucide-react";
import {
  resumoAtendimentoClientes,
  TIPOS_CHAMADO,
  type ChamadoAtendimento,
  type StatusChamado,
  type TipoChamado,
} from "@/lib/incorporacao/atendimento-clientes";
import { salvarAtendimentoClientes } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Atendimento aos Clientes (5.4 Projetos Executivos e Obras) — central de
// atendimento pós-venda: repasses bancários, assembleias de condomínio,
// entrega de chaves, assistência técnica e documentação.

const STATUS: { value: StatusChamado; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

interface Dados {
  chamados: ChamadoAtendimento[];
}

function defaults(): Dados {
  return { chamados: [] };
}

function novoChamado(): ChamadoAtendimento {
  return { id: Math.random().toString(36).slice(2), cliente: "", tipo: "Entrega de Chaves", status: "aberto" };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function AtendimentoClientesTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.atendimentoClientesJson) {
      try {
        const salvo = JSON.parse(estudo.atendimentoClientesJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoAtendimentoClientes(dados.chamados), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addChamado() {
    setDados((d) => ({ chamados: [...d.chamados, novoChamado()] }));
    marcarAlterado();
  }
  function removerChamado(id: string) {
    setDados((d) => ({ chamados: d.chamados.filter((c) => c.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ChamadoAtendimento>(id: string, campo: K, valor: ChamadoAtendimento[K]) {
    setDados((d) => ({ chamados: d.chamados.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarAtendimentoClientes(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Headset size={13} /> Atendimento aos Clientes
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um chamado por cliente/solicitação. A etapa fica concluída quando todos os chamados cadastrados estiverem concluídos.
        </p>
      </div>

      {dados.chamados.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Chamados" valor={String(resumo.total)} />
          <Kpi label="Abertos" valor={String(resumo.abertos)} />
          <Kpi label="Em andamento" valor={String(resumo.emAndamento)} />
          <Kpi label="Concluídos" valor={`${resumo.pctConcluido}%`} destaque />
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[680px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Cliente</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-28">Unidade</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-44">Tipo</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.chamados.map((c) => (
                <tr key={c.id}>
                  <td className="px-1 py-1"><input value={c.cliente} onChange={(e) => upd(c.id, "cliente", e.target.value)} className={inputCls} placeholder="Nome do cliente" /></td>
                  <td className="px-1 py-1"><input value={c.unidade ?? ""} onChange={(e) => upd(c.id, "unidade", e.target.value)} className={inputCls} placeholder="Ex.: Lote 12" /></td>
                  <td className="px-1 py-1">
                    <select value={c.tipo} onChange={(e) => upd(c.id, "tipo", e.target.value as TipoChamado)} className={inputCls}>
                      {TIPOS_CHAMADO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select value={c.status} onChange={(e) => upd(c.id, "status", e.target.value as StatusChamado)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerChamado(c.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addChamado} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar chamado
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
