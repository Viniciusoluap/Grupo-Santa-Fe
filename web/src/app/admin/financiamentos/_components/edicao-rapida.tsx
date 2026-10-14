"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/ui/currency-input";
import { STATUS_CONFIG, type FinanciamentoStatus } from "@/lib/types/financiamento";
import { alterarStatusFinanciamento, atualizarValoresFinanciamento } from "@/lib/actions/financiamentos";

// Pedido A9 (14/10/2026, paridade com a Prospecta): etapa, valor total e valor
// financiado editados direto na lista, sem abrir o financiamento. A etapa é só
// do financiamento — não muda a etapa do lead no CRM.

const ETAPAS = (Object.entries(STATUS_CONFIG) as [FinanciamentoStatus, (typeof STATUS_CONFIG)[FinanciamentoStatus]][])
  .filter(([s]) => s !== "aguardando_configuracao")
  .sort(([, a], [, b]) => a.order - b.order);

// Registros sem etapa da lista: "Pendente de configuração" e a etapa antiga
// "analise_credito" (padrão inicial do banco). O usuário escolhe a etapa atual.
const ETAPA_FORA_DA_LISTA: Record<string, string> = {
  aguardando_configuracao: "Escolha a etapa",
  analise_credito: "Etapa antiga: Análise de crédito",
};

export function EtapaRapida({ id, status, cliente }: { id: string; status: string; cliente: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div>
      <select
        aria-label={`Etapa de ${cliente}`}
        value={ETAPAS.some(([s]) => s === status) ? status : ""}
        disabled={pendente}
        onChange={(e) => start(async () => {
          setErro(null);
          try { await alterarStatusFinanciamento(id, e.target.value); router.refresh(); }
          catch (err) { setErro(err instanceof Error ? err.message : "Falha ao mudar a etapa."); }
        })}
        className="w-40 border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-[var(--brand-dark)] focus:border-[var(--brand-yellow)] focus:outline-none"
      >
        {!ETAPAS.some(([s]) => s === status) && <option value="" disabled>{ETAPA_FORA_DA_LISTA[status] ?? "Escolha a etapa"}</option>}
        {ETAPAS.map(([s, cfg]) => <option key={s} value={s}>{cfg.label}</option>)}
      </select>
      {erro && <p role="alert" className="mt-1 text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}

export function ValoresRapidos({ id, valorImovel, valorFinanciado, cliente }: { id: string; valorImovel: number | null; valorFinanciado: number | null; cliente: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [total, setTotal] = useState(valorImovel ?? 0);
  const [financiado, setFinanciado] = useState(valorFinanciado ?? 0);
  const [erro, setErro] = useState<string | null>(null);
  const alterado = total !== (valorImovel ?? 0) || financiado !== (valorFinanciado ?? 0);
  const invalido = financiado > total;
  const campo = "w-36 border border-gray-200 bg-white py-1.5 pr-2 text-xs text-[var(--brand-dark)] focus:border-[var(--brand-yellow)] focus:outline-none";
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-500">Total
        <span aria-label={`Valor total de ${cliente}`}><CurrencyInput value={total} onValueChange={setTotal} className={campo} /></span>
      </label>
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-500">Financiado
        <span aria-label={`Valor financiado de ${cliente}`}><CurrencyInput value={financiado} onValueChange={setFinanciado} className={campo} /></span>
      </label>
      <button
        type="button"
        disabled={!alterado || invalido || pendente}
        onClick={() => start(async () => {
          setErro(null);
          const r = await atualizarValoresFinanciamento(id, total, financiado);
          if (r && "erroAcao" in r) setErro(String(r.erroAcao)); else router.refresh();
        })}
        className="bg-[var(--brand-yellow)] px-3 py-1 text-[10px] font-black uppercase text-[var(--brand-dark)] disabled:opacity-40"
      >
        {pendente ? "Salvando..." : "Salvar valores"}
      </button>
      {invalido && <p className="text-[11px] text-red-600">O financiado não pode superar o total.</p>}
      {erro && <p role="alert" className="text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}
