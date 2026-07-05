"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, X } from "lucide-react";
import { editarContrato, excluirContrato } from "@/lib/actions/contratos";

const TIPOS_CONTRATO = [
  { value: "compra_venda",             label: "Compra e Venda" },
  { value: "locacao",                  label: "Locação" },
  { value: "permuta",                  label: "Permuta" },
  { value: "comodato",                 label: "Comodato" },
  { value: "assessoria_imobiliaria",   label: "Assessoria Imobiliária" },
  { value: "administracao_imovel",     label: "Administração de Imóvel" },
  { value: "avaliacao_imobiliaria",    label: "Avaliação Imobiliária" },
  { value: "regularizacao_imovel",     label: "Regularização de Imóvel" },
  { value: "financiamento_imobiliario",label: "Financiamento Imobiliário" },
  { value: "bpo_financeiro",           label: "BPO Financeiro" },
  { value: "prestacao_servicos",       label: "Prestação de Serviços" },
  { value: "consultoria_juridica",     label: "Consultoria Jurídica" },
  { value: "parceria",                 label: "Parceria" },
  { value: "outro",                    label: "Outro" },
];

const STATUS_OPCOES = [
  { value: "rascunho",  label: "Rascunho" },
  { value: "ativo",     label: "Ativo" },
  { value: "concluido", label: "Concluído" },
  { value: "vencido",   label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

export interface ContratoEditavel {
  id: string;
  numero: string;
  tipo: string;
  parteA: string;
  parteADoc: string | null;
  parteB: string;
  parteBDoc: string | null;
  valor: number;
  descricao: string | null;
  clausulas: string | null;
  status: string;
  vencimento: string | null; // ISO yyyy-mm-dd (ou null)
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";

export function ContratoEditarExcluir({ contrato }: { contrato: ContratoEditavel }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSalvar(formData: FormData) {
    startTransition(async () => {
      await editarContrato(formData);
      setAberto(false);
      router.refresh();
    });
  }

  function handleExcluir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    startTransition(async () => {
      await excluirContrato(contrato.id);
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Pencil size={10} /> Editar
        </button>
        <button
          type="button"
          onClick={handleExcluir}
          onBlur={() => setConfirmando(false)}
          disabled={pending}
          title={`Excluir o contrato ${contrato.numero}`}
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 transition-colors disabled:opacity-50 ${
            confirmando ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}
        >
          {pending && confirmando ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          {confirmando ? "Confirmar" : "Excluir"}
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-white w-full max-w-2xl my-8 border border-gray-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">
                Editar contrato <span className="font-mono text-gray-400">{contrato.numero}</span>
              </p>
              <button type="button" onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <form action={handleSalvar} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="hidden" name="id" value={contrato.id} />

              <Campo label="Tipo">
                <select name="tipo" defaultValue={contrato.tipo} className={inputCls}>
                  {TIPOS_CONTRATO.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Status">
                <select name="status" defaultValue={contrato.status} className={inputCls}>
                  {STATUS_OPCOES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Parte A (Contratante)">
                <input name="parteA" required defaultValue={contrato.parteA} className={inputCls} />
              </Campo>
              <Campo label="Doc. Parte A">
                <input name="parteADoc" defaultValue={contrato.parteADoc ?? ""} className={inputCls} />
              </Campo>

              <Campo label="Parte B (Contratado)">
                <input name="parteB" required defaultValue={contrato.parteB} className={inputCls} />
              </Campo>
              <Campo label="Doc. Parte B">
                <input name="parteBDoc" defaultValue={contrato.parteBDoc ?? ""} className={inputCls} />
              </Campo>

              <Campo label="Valor (R$)">
                <input name="valor" type="number" step="0.01" defaultValue={contrato.valor} className={inputCls} />
              </Campo>
              <Campo label="Vencimento">
                <input name="vencimento" type="date" defaultValue={contrato.vencimento ?? ""} className={inputCls} />
              </Campo>

              <div className="sm:col-span-2">
                <Campo label="Descrição">
                  <input name="descricao" defaultValue={contrato.descricao ?? ""} className={inputCls} />
                </Campo>
              </div>

              <div className="sm:col-span-2">
                <Campo label="Cláusulas">
                  <textarea name="clausulas" rows={4} defaultValue={contrato.clausulas ?? ""} className={inputCls} />
                </Campo>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="text-xs font-bold px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center gap-1.5 text-xs font-bold px-5 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {pending && <Loader2 size={12} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
