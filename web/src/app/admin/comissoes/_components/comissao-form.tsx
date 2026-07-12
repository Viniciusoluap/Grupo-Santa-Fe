"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { criarComissao, editarComissao } from "@/lib/actions/comissoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyInput } from "@/components/ui/currency-input";

type Corretor = { id: string; nome: string };
type NegocioItem = { id: string; label: string };

type ComissaoData = {
  id: string;
  beneficiario: string;
  tipoNegocio: string;
  corretorId: string | null;
  imovel: string;
  valor: number;
  percentual: number;
  status: string;
  vencimento: Date;
  pagamentoEm: Date | null;
  notas: string;
};

interface Props {
  corretores: Corretor[];
  comissao?: ComissaoData;
  negociosPorTipo: Record<string, NegocioItem[]>;
  onClose: () => void;
}

const TIPO_COMISSAO_OPTIONS = [
  { value: "venda",         label: "Comissão de Venda" },
  { value: "aluguel",       label: "Comissão de Aluguel" },
  { value: "financiamento", label: "Comissão de Financiamento" },
  { value: "obra",          label: "Comissão por Obra", somenteCorretor: true },
  { value: "extra",         label: "Extra" },
];

const STATUS_OPTIONS = [
  { value: "pendente",  label: "Pendente" },
  { value: "aprovada",  label: "Aprovada" },
  { value: "paga",      label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function ComissaoForm({ corretores, comissao, negociosPorTipo, onClose }: Props) {
  const isEdit = !!comissao;
  const [beneficiario, setBeneficiario] = useState(comissao?.beneficiario ?? "corretor");
  const [tipoNegocio, setTipoNegocio] = useState(comissao?.tipoNegocio ?? "venda");
  const [imovelLabel, setImovelLabel] = useState(comissao?.imovel ?? "");

  const tipoComissaoOpcoes = TIPO_COMISSAO_OPTIONS.filter(
    (t) => !t.somenteCorretor || beneficiario === "corretor"
  );
  const itens = negociosPorTipo[tipoNegocio] ?? [];

  function handleBeneficiarioChange(valor: string) {
    setBeneficiario(valor);
    // "Comissão por Obra" só existe para corretor — evita ficar com um tipo
    // selecionado que sumiu da lista ao trocar para Empresa.
    if (valor !== "corretor" && tipoNegocio === "obra") {
      setTipoNegocio("venda");
      setImovelLabel("");
    }
  }

  function handleNegocioChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const opt = itens.find((i) => i.id === e.target.value);
    if (opt) setImovelLabel(`${opt.label} [${TIPO_COMISSAO_OPTIONS.find((t) => t.value === tipoNegocio)?.label ?? tipoNegocio}]`);
    else setImovelLabel("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">
            {isEdit ? "Editar Comissão" : "Nova Comissão"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form action={isEdit ? editarComissao : criarComissao} className="p-6 space-y-4">
          {isEdit && <input type="hidden" name="id" value={comissao.id} />}
          <input type="hidden" name="imovel" value={imovelLabel} />
          <input type="hidden" name="tipoNegocio" value={tipoNegocio} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Beneficiário */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Beneficiário *</label>
              <div className="flex gap-3">
                {[
                  { value: "corretor", label: "Corretor" },
                  { value: "empresa",  label: "Empresa" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="beneficiario"
                      value={opt.value}
                      checked={beneficiario === opt.value}
                      onChange={() => handleBeneficiarioChange(opt.value)}
                      className="accent-[var(--brand-yellow)]"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Corretor — só quando beneficiário = corretor */}
            {beneficiario === "corretor" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Corretor *</label>
                <select name="corretorId" required={beneficiario === "corretor"}
                  defaultValue={comissao?.corretorId ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione um corretor</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de Negócio */}
            {!isEdit && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Comissão *</label>
                  <select value={tipoNegocio} onChange={(e) => { setTipoNegocio(e.target.value); setImovelLabel(""); }}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                    {tipoComissaoOpcoes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {tipoNegocio === "extra" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição *</label>
                    <input type="text" required placeholder="Descreva o serviço ou negócio..."
                      value={imovelLabel} onChange={(e) => setImovelLabel(e.target.value)}
                      className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                      {TIPO_COMISSAO_OPTIONS.find((t) => t.value === tipoNegocio)?.label ?? "Negócio"} *
                    </label>
                    {itens.length > 0 ? (
                      <select required onChange={handleNegocioChange} defaultValue=""
                        className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                        <option value="">Selecione...</option>
                        {itens.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-2">Nenhum registro encontrado para este tipo.</p>
                    )}
                  </div>
                )}
              </>
            )}

            {isEdit && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Imóvel / Negócio *</label>
                <input type="text" value={imovelLabel} onChange={(e) => setImovelLabel(e.target.value)} required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor da Comissão *</label>
              <CurrencyInput name="valor" required defaultValue={comissao?.valor}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Percentual (%)</label>
              <input type="number" name="percentual" step="0.01" min="0" max="100" placeholder="6"
                defaultValue={comissao?.percentual ?? "6"}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select name="status" defaultValue={comissao?.status ?? "pendente"}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento *</label>
              <input type="date" name="vencimento" required
                defaultValue={toDateInputValue(comissao?.vencimento)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data de Pagamento</label>
              <input type="date" name="pagamentoEm"
                defaultValue={toDateInputValue(comissao?.pagamentoEm)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
              <textarea name="notas" rows={3} placeholder="Notas adicionais..."
                defaultValue={comissao?.notas ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText={isEdit ? "Salvando..." : "Cadastrando..."}
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEdit ? "Salvar Alterações" : "Cadastrar Comissão"}
            </SubmitButton>
            <button type="button" onClick={onClose}
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
