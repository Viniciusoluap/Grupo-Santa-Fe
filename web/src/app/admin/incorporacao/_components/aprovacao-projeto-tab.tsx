"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Stamp, AlertTriangle } from "lucide-react";
import {
  resumoAprovacaoProjeto,
  ORGAOS_APROVACAO,
  type OrgaoAprovacao,
  type ProcessoAprovacao,
  type StatusAprovacao,
} from "@/lib/incorporacao/aprovacao-projeto";
import { salvarAprovacaoProjeto } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

// Projeto Aprovado (3.2 Incorporação e Produto) — controle da aprovação do
// projeto legal junto à prefeitura e demais órgãos competentes, antecedendo
// o Quadro da NBR 12721 (3.3) e o registro da incorporação (3.4).

const STATUS: { value: StatusAprovacao; label: string }[] = [
  { value: "nao_protocolado", label: "Não protocolado" },
  { value: "protocolado", label: "Protocolado" },
  { value: "em_analise", label: "Em análise" },
  { value: "exigencia", label: "Exigência" },
  { value: "aprovado", label: "Aprovado" },
  { value: "indeferido", label: "Indeferido" },
];

interface Dados {
  processos: ProcessoAprovacao[];
}

function defaults(): Dados {
  return { processos: [] };
}

function novoProcesso(): ProcessoAprovacao {
  return {
    id: Math.random().toString(36).slice(2),
    orgao: "Prefeitura (projeto arquitetônico)",
    status: "nao_protocolado",
  };
}

const inputCls = "w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

export function AprovacaoProjetoTab({ estudo }: { estudo: EstudoData }) {
  const [dados, setDados] = useState<Dados>(() => {
    if (estudo.aprovacaoProjetoJson) {
      try {
        const salvo = JSON.parse(estudo.aprovacaoProjetoJson) as Partial<Dados>;
        return { ...defaults(), ...salvo };
      } catch { /* JSON corrompido → defaults */ }
    }
    return defaults();
  });
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);

  const resumo = useMemo(() => resumoAprovacaoProjeto(dados.processos), [dados]);

  function marcarAlterado() { setSalvo(false); }

  function addProcesso() {
    setDados((d) => ({ processos: [...d.processos, novoProcesso()] }));
    marcarAlterado();
  }
  function removerProcesso(id: string) {
    setDados((d) => ({ processos: d.processos.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ProcessoAprovacao>(id: string, campo: K, valor: ProcessoAprovacao[K]) {
    setDados((d) => ({ processos: d.processos.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      await salvarAprovacaoProjeto(estudo.id, JSON.stringify(dados));
      setSalvo(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Stamp size={13} /> Projeto Aprovado
          </p>
          <button onClick={salvarDados} disabled={pending}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 shrink-0">
            {pending ? <Loader2 size={13} className="animate-spin" /> : salvo ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {pending ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-xl">
          Um processo por órgão. A etapa fica concluída quando todos os processos cadastrados estiverem aprovados.
        </p>
      </div>

      {dados.processos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Processos" valor={String(resumo.total)} />
          <Kpi label="Protocolados" valor={String(resumo.protocolados)} />
          <Kpi label="Com exigência" valor={String(resumo.comExigencia.length)} />
          <Kpi label="Aprovados" valor={`${resumo.pctAprovado}%`} destaque />
        </div>
      )}

      {resumo.atrasados.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            {resumo.atrasados.length} processo(s) com prazo previsto vencido: {resumo.atrasados.map((p) => p.orgao).join(", ")}.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-[760px] w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-52">Órgão</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Protocolo</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Prazo previsto</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 pb-1 w-40">Observações</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.processos.map((p) => (
                <tr key={p.id}>
                  <td className="px-1 py-1">
                    <select value={p.orgao} onChange={(e) => upd(p.id, "orgao", e.target.value as OrgaoAprovacao)} className={inputCls}>
                      {ORGAOS_APROVACAO.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={p.numeroProtocolo ?? ""} onChange={(e) => upd(p.id, "numeroProtocolo", e.target.value)} className={inputCls} placeholder="Nº" /></td>
                  <td className="px-1 py-1"><input type="date" value={p.prazoPrevisto ?? ""} onChange={(e) => upd(p.id, "prazoPrevisto", e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1">
                    <select value={p.status} onChange={(e) => upd(p.id, "status", e.target.value as StatusAprovacao)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={p.observacoes ?? ""} onChange={(e) => upd(p.id, "observacoes", e.target.value)} className={inputCls} placeholder="Observações" /></td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerProcesso(p.id)} className="text-gray-300 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addProcesso} className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
          <Plus size={12} /> Adicionar processo
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
