"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { editarProjeto } from "@/lib/actions/projetos";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";

const campo = "w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";
const rotulo = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";

interface Engenheiro { id: string; nome: string; papel: string }

/**
 * Item 07 — valida os tipos antes de enviar, mostra o erro em português e
 * mantém tudo o que foi digitado (sem recarregar a página). Engenheiro é um
 * colaborador escolhido por ID, com busca.
 */
export function EditarProjetoForm({ projeto, tiposSelecionados, prazo, engenheiros, cliente }: {
  projeto: { id: string; nome: string; status: string; clienteNome: string; clienteTel: string | null; engenheiro: string | null; engenheiroId: string | null; engenheiroRegistro: string | null; valorProjeto: number | null; descricao: string };
  tiposSelecionados: string[];
  prazo: string;
  engenheiros: Engenheiro[];
  /** Cartão do cliente vinculado ao CRM (quando houver). */
  cliente: ReactNode | null;
}) {
  const [tipos, setTipos] = useState<string[]>(tiposSelecionados);
  const [engenheiroId, setEngenheiroId] = useState(projeto.engenheiroId ?? "");
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
        {cliente ?? (
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
          <select name="engenheiroId" aria-label="Engenheiro responsável" value={engenheiroId} onChange={(e) => setEngenheiroId(e.target.value)} className={`${campo} mt-1`}>
            <option value="">{legado ? `Registro anterior: ${legado}` : "Selecione um colaborador"}</option>
            {visiveis.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.papel === "admin" ? " (admin)" : ""}</option>)}
          </select>
          {legado && <input type="hidden" name="engenheiro" value={legado} />}
        </div>
        <div>
          <label className={rotulo}>Habilitação técnica (CREA/CAU)</label>
          <input name="engenheiroRegistro" type="text" maxLength={60} defaultValue={projeto.engenheiroRegistro ?? ""} placeholder="Se necessário" className={campo} />
        </div>
        <div>
          <label className={rotulo}>Valor do Projeto *</label>
          <CurrencyInput name="valorProjeto" required defaultValue={projeto.valorProjeto} className={campo} />
        </div>
      </div>

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
