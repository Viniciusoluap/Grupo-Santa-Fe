"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { editarProjeto } from "@/lib/actions/projetos";
import { PhoneInput } from "@/components/ui/phone-input";
import ProjetoDetailClient from "../../_components/projeto-detail-client";
import { creaAoTrocarEngenheiro, formatarCrea } from "@/lib/engenheiro";
import { ORGAOS_APROVACAO } from "@/lib/incorporacao/aprovacao-projeto";
import { STATUS_APROVACAO_EXTERNA } from "@/lib/incorporacao/projeto-sincronizacao";

/** Correção 07: processo de Incorporação › Projeto Aprovado vinculado a este projeto. */
export interface AprovacaoVinculada { estudoId: string; estudoNome: string; orgao: string; protocolo: string; status: string; observacoes: string }

const campo = "w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";
const rotulo = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";

interface Engenheiro { id: string; nome: string; papel: string; crea?: string | null; creaUf?: string | null }

/**
 * Item 07 — valida os tipos antes de enviar, mostra o erro em português e
 * mantém tudo o que foi digitado (sem recarregar a página). Engenheiro é um
 * colaborador escolhido por ID, com busca.
 */
export function EditarProjetoForm({ projeto, tiposSelecionados, prazo, engenheiros, cliente, aprovacao = null }: {
  projeto: { id: string; nome: string; status: string; clienteNome: string; clienteTel: string | null; engenheiro: string | null; engenheiroId: string | null; engenheiroRegistro: string | null; valorProjeto: number | null; descricao: string; checklist: string; arquivos: string };
  tiposSelecionados: string[];
  prazo: string;
  engenheiros: Engenheiro[];
  /** Cartão do cliente vinculado ao CRM (quando houver). */
  cliente: ReactNode | null;
  aprovacao?: AprovacaoVinculada | null;
}) {
  const [tipos, setTipos] = useState<string[]>(tiposSelecionados);
  const [engenheiroId, setEngenheiroId] = useState(projeto.engenheiroId ?? "");
  // Lote 2, correção 04: o CREA do perfil Engenheiro preenche a habilitação (sem inventar quando não houver).
  const [registro, setRegistro] = useState(projeto.engenheiroRegistro ?? "");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const legado = !projeto.engenheiroId && projeto.engenheiro ? projeto.engenheiro : null;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    if (!tipos.length) { setErro("Selecione ao menos um tipo de projeto."); return; }
    if (!engenheiroId && !legado) { setErro("Escolha o engenheiro responsável entre os colaboradores."); return; }
    const dados = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await editarProjeto(dados);
      if (r && "erroAcao" in r) setErro(r.erroAcao);
    });
  }

  const visiveis = engenheiros.filter((u) => !busca.trim() || u.nome.toLowerCase().includes(busca.trim().toLowerCase()) || u.id === engenheiroId);

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <input type="hidden" name="id" value={projeto.id} />
      {erro && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={rotulo}>Nome do Projeto *</label>
          <input name="nome" type="text" required defaultValue={projeto.nome} className={campo} />
        </div>
        <div>
          <label className={rotulo}>Status</label>
          <select name="status" defaultValue={projeto.status} className={`${campo} appearance-none`}>
            {Object.entries(PROJETO_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className={rotulo}>Prazo de Entrega</label>
          <input name="prazoEntrega" type="date" defaultValue={prazo} className={campo} />
        </div>
        {aprovacao ? (
          <div className="sm:col-span-2 border border-sky-100 bg-sky-50 px-3 py-2 text-sm">
            <span className="font-bold">Empreendimento (da Incorporação):</span> {aprovacao.estudoNome}{" "}
            <Link href={`/admin/incorporacao/${aprovacao.estudoId}`} className="underline">Abrir o estudo</Link>
          </div>
        ) : cliente ?? (
          <>
            <div>
              <label className={rotulo}>Cliente *</label>
              <input name="clienteNome" type="text" required defaultValue={projeto.clienteNome} className={campo} />
            </div>
            <div>
              <label className={rotulo}>Telefone do Cliente</label>
              <PhoneInput name="clienteTel" defaultValue={projeto.clienteTel ?? ""} className={campo} />
            </div>
          </>
        )}
        <div>
          <label className={rotulo} htmlFor="busca-engenheiro">Engenheiro Responsável *</label>
          <input id="busca-engenheiro" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar colaborador" className={campo} />
          <select name="engenheiroId" aria-label="Engenheiro responsável" value={engenheiroId} onChange={(e) => {
            const anterior = engenheiros.find((u) => u.id === engenheiroId);
            const novo = engenheiros.find((u) => u.id === e.target.value);
            setRegistro((atual) => creaAoTrocarEngenheiro(atual, anterior ? { crea: anterior.crea ?? null, creaUf: anterior.creaUf ?? null } : null, novo ? { crea: novo.crea ?? null, creaUf: novo.creaUf ?? null } : null));
            setEngenheiroId(e.target.value);
          }} className={`${campo} mt-1`}>
            <option value="">{legado ? `Registro anterior: ${legado}` : "Selecione um colaborador"}</option>
            {visiveis.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.papel === "admin" ? " (admin)" : ""}{u.crea ? ` · ${formatarCrea(u.crea, u.creaUf)}` : ""}</option>)}
          </select>
          {legado && <input type="hidden" name="engenheiro" value={legado} />}
        </div>
        <div>
          <label className={rotulo}>Habilitação técnica (CREA/CAU)</label>
          <input name="engenheiroRegistro" type="text" maxLength={60} value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="Se necessário" className={campo} />
        </div>

      </div>

      {aprovacao && (
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-sky-100 p-4">
          <legend className="px-1 text-xs font-bold text-gray-500 uppercase tracking-wide">Aprovação externa (sincronizada com a Incorporação)</legend>
          <div>
            <label className={rotulo}>Órgão</label>
            <select name="aprovacaoOrgao" defaultValue={aprovacao.orgao} className={`${campo} appearance-none`}>
              {ORGAOS_APROVACAO.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Protocolo</label>
            <input name="aprovacaoProtocolo" type="text" maxLength={120} defaultValue={aprovacao.protocolo} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Situação de aprovação externa</label>
            <select name="aprovacaoStatus" defaultValue={aprovacao.status} className={`${campo} appearance-none`}>
              {STATUS_APROVACAO_EXTERNA.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Observações do processo</label>
            <input name="aprovacaoObservacoes" type="text" maxLength={2000} defaultValue={aprovacao.observacoes} className={campo} />
          </div>
          <p className="sm:col-span-2 text-xs text-gray-600">O status acima é o andamento técnico interno; esta situação é a do órgão. Prazo e engenheiro também voltam ao processo.</p>
        </fieldset>
      )}

      <fieldset>
        <legend className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipos de Projeto *</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROJETO_TIPO_CONFIG).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" name="tipos" value={k} checked={tipos.includes(k)}
                onChange={(e) => setTipos((t) => e.target.checked ? [...t, k] : t.filter((x) => x !== k))}
                className="accent-[var(--brand-yellow)]" />
              <span className="text-xs text-gray-600">{v.icon} {v.label}</span>
            </label>
          ))}
        </div>
        {!tipos.length && <p className="mt-1 text-xs text-amber-700">Obrigatório: selecione ao menos um tipo.</p>}
      </fieldset>

      <div>
        <label className={rotulo}>Descrição</label>
        <textarea name="descricao" rows={3} defaultValue={projeto.descricao} className={`${campo} resize-none`} />
      </div>

      <ProjetoDetailClient projetoId={projeto.id} checklistJson={projeto.checklist} arquivosJson={projeto.arquivos} tipos={tipos} readOnly={false} />
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="submit" disabled={pendente}
          className="inline-flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {pendente && <Loader2 size={13} className="animate-spin" />}{pendente ? "Salvando..." : "Salvar Alterações"}
        </button>
        <Link href={`/admin/projetos/${projeto.id}`} className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
