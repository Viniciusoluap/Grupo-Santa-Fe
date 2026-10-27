"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Stamp, AlertTriangle, ExternalLink } from "lucide-react";
import { creaAoTrocarEngenheiro, formatarCrea } from "@/lib/engenheiro";
import { PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import {
  resumoAprovacaoProjeto,
  ORGAOS_APROVACAO,
  type OrgaoAprovacao,
  type ProcessoAprovacao,
  type StatusAprovacao,
} from "@/lib/incorporacao/aprovacao-projeto";
import { dadosProjetosDaAprovacao, salvarAprovacaoProjeto } from "@/lib/actions/incorporacao";
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
type Engenheiro = { id: string; nome: string; crea: string | null; creaUf: string | null };
type Vinculo = { processoId: string; projetoId: string; status: string };

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

const inputCls = "min-w-0 max-w-full w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]";

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
  // Correção 07: cada processo salvo é também um registro em Projetos.
  const [erro, setErro] = useState<string | null>(null);
  const [engenheiros, setEngenheiros] = useState<Engenheiro[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  useEffect(() => {
    let ativo = true;
    dadosProjetosDaAprovacao(estudo.id).then((r) => {
      if (!ativo || "erroAcao" in r) return;
      setEngenheiros(r.engenheiros);
      setVinculos(r.vinculos);
    }).catch(() => { /* sem lista: o seletor fica vazio, o salvamento continua */ });
    return () => { ativo = false; };
  }, [estudo.id]);
  const projetoDoProcesso = useMemo(() => new Map(vinculos.map((v) => [v.processoId, v])), [vinculos]);

  function escolherEngenheiro(id: string, valor: string) {
    setDados((d) => ({
      processos: d.processos.map((p) => {
        if (p.id !== id) return p;
        const anterior = engenheiros.find((u) => u.id === p.engenheiroId);
        const novo = engenheiros.find((u) => u.id === valor);
        const registro = creaAoTrocarEngenheiro(p.engenheiroRegistro ?? "", anterior, novo);
        return { ...p, engenheiroId: novo?.id, engenheiro: novo?.nome, engenheiroRegistro: registro || undefined };
      }),
    }));
    marcarAlterado();
  }

  function marcarAlterado() { setSalvo(false); }

  function addProcesso() {
    setDados((d) => ({ processos: [...d.processos, novoProcesso()] }));
    marcarAlterado();
  }
  function removerProcesso(id: string) {
    // Correção 07: o projeto vinculado não é apagado — perde o vínculo e fica cancelado, com documentos preservados.
    if (projetoDoProcesso.has(id) && !window.confirm("Excluir este processo? Ao salvar, o projeto vinculado em Projetos será arquivado como cancelado (checklist e documentos são preservados).")) return;
    setDados((d) => ({ processos: d.processos.filter((p) => p.id !== id) }));
    marcarAlterado();
  }
  function upd<K extends keyof ProcessoAprovacao>(id: string, campo: K, valor: ProcessoAprovacao[K]) {
    setDados((d) => ({ processos: d.processos.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)) }));
    marcarAlterado();
  }

  function salvarDados() {
    startTransition(async () => {
      setErro(null);
      const r = await salvarAprovacaoProjeto(estudo.id, JSON.stringify(dados));
      if ("erroAcao" in r) { setErro(r.erroAcao); return; }
      setVinculos(r.vinculos);
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
        <p className="text-[11px] text-gray-600 max-w-xl">
          Um processo por órgão. A etapa fica concluída quando todos os processos cadastrados estiverem aprovados.
          Cada processo salvo aparece também em Projetos (checklist, documentos e revisões).
        </p>
        {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
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
          <table className="block w-full text-xs 2xl:table 2xl:table-fixed">
            <thead className="hidden 2xl:table-header-group">
              <tr>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-52">Órgão</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Protocolo</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Prazo previsto</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-32">Status</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-40">Observações</th>
                <th className="text-left text-[10px] font-bold text-gray-600 uppercase tracking-wide px-1 pb-1 w-44">Engenheiro</th>
                <th />
              </tr>
            </thead>
            <tbody className="grid gap-3 2xl:table-row-group">
              {dados.processos.map((p) => (
                <tr key={p.id} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 2xl:table-row 2xl:border-0 2xl:p-0 [&>td]:min-w-0">
                  <td data-label="Órgão" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">
                    <select value={p.orgao} onChange={(e) => upd(p.id, "orgao", e.target.value as OrgaoAprovacao)} className={inputCls}>
                      {ORGAOS_APROVACAO.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td data-label="Protocolo" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><input value={p.numeroProtocolo ?? ""} onChange={(e) => upd(p.id, "numeroProtocolo", e.target.value)} className={inputCls} placeholder="Nº" /></td>
                  <td data-label="Prazo previsto" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><input type="date" value={p.prazoPrevisto ?? ""} onChange={(e) => upd(p.id, "prazoPrevisto", e.target.value)} className={inputCls} /></td>
                  <td data-label="Status" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">
                    <select value={p.status} onChange={(e) => upd(p.id, "status", e.target.value as StatusAprovacao)} className={inputCls}>
                      {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td data-label="Observações" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden"><input value={p.observacoes ?? ""} onChange={(e) => upd(p.id, "observacoes", e.target.value)} className={inputCls} placeholder="Observações" /></td>
                  <td data-label="Engenheiro" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">
                    <select value={p.engenheiroId ?? ""} onChange={(e) => escolherEngenheiro(p.id, e.target.value)} className={inputCls} aria-label="Engenheiro do processo">
                      <option value="">{p.engenheiro && !p.engenheiroId ? p.engenheiro : "Selecione"}</option>
                      {engenheiros.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.crea ? ` · ${formatarCrea(u.crea, u.creaUf)}` : ""}</option>)}
                    </select>
                  </td>
                  <td data-label="Ações" className="px-1 py-1 block 2xl:table-cell before:mb-1 before:block before:text-[10px] before:font-bold before:uppercase before:tracking-wide before:text-gray-500 before:content-[attr(data-label)] 2xl:before:hidden">
                    <div className="flex items-center gap-2">
                      {projetoDoProcesso.get(p.id) && (
                        <Link href={`/admin/projetos/${projetoDoProcesso.get(p.id)!.projetoId}`}
                          title={`Abrir em Projetos — andamento: ${PROJETO_STATUS_CONFIG[projetoDoProcesso.get(p.id)!.status as keyof typeof PROJETO_STATUS_CONFIG]?.label ?? projetoDoProcesso.get(p.id)!.status}`}
                          className="text-gray-500 hover:text-[var(--brand-dark)]"><ExternalLink size={14} /></Link>
                      )}
                      <button type="button" onClick={() => removerProcesso(p.id)} title="Excluir processo (o projeto vinculado é arquivado como cancelado)" className="text-gray-500 hover:text-red-500 flex justify-center"><Trash2 size={14} /></button>
                    </div>
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
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-gray-400" : "text-gray-600"}`}>{label}</p>
      <p className={`font-black text-base leading-tight ${destaque ? "text-[var(--brand-yellow)]" : "text-[var(--brand-dark)]"}`}>{valor}</p>
    </div>
  );
}
