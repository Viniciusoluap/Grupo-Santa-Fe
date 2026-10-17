"use client";

import { useState } from "react";
import { X, Calculator } from "lucide-react";
import { criarComissao, editarComissao } from "@/lib/actions/comissoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { PercentInput } from "@/components/ui/percent-input";
import { formatCurrency, maskCurrency, currencyToFloat, mascararDinheiro } from "@/lib/utils";
import {
  TIPOS_COMISSAO,
  calcularValorComissao,
  encontrarNegocio,
  normalizarTipoComissao,
  rotuloNegocio,
  type NegocioItem,
} from "@/lib/comissoes/calculo";

type Corretor = { id: string; nome: string };

type ComissaoData = {
  id: string;
  beneficiario: string;
  tipoNegocio: string;
  corretorId: string | null;
  imovel: string;
  negocioId: string | null;
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

const STATUS_OPTIONS = [
  { value: "pendente",  label: "Pendente" },
  { value: "aprovada",  label: "Aprovada" },
  { value: "paga",      label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

const LEGADO = "__legado__";

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function valorParaDisplay(v: number | null | undefined): string {
  return v ? maskCurrency(String(Math.round(v * 100))) : "";
}

export function ComissaoForm({ corretores, comissao, negociosPorTipo, onClose }: Props) {
  const isEdit = !!comissao;
  const tipoInicial = normalizarTipoComissao(comissao?.tipoNegocio);
  const negocioInicial = comissao && tipoInicial !== "extra"
    ? encontrarNegocio(negociosPorTipo[tipoInicial] ?? [], tipoInicial, comissao.imovel, comissao.negocioId)
    : null;

  const [beneficiario, setBeneficiario] = useState(comissao?.beneficiario ?? "corretor");
  const [tipoNegocio, setTipoNegocio] = useState(tipoInicial);
  // Edição de registro antigo (texto livre que não bate com nenhum cadastro):
  // mantém o texto como opção "legado" até o usuário escolher um negócio real.
  const [negocioId, setNegocioId] = useState(
    negocioInicial?.id ?? (comissao && tipoInicial !== "extra" && comissao.imovel ? LEGADO : ""),
  );
  const [descricaoExtra, setDescricaoExtra] = useState(tipoInicial === "extra" ? comissao?.imovel ?? "" : "");
  const [percentual, setPercentual] = useState(comissao?.percentual ?? 5);
  const [valorDisplay, setValorDisplay] = useState(valorParaDisplay(comissao?.valor));

  const tipoComissaoOpcoes = TIPOS_COMISSAO.filter(
    (t) => !("somenteCorretor" in t && t.somenteCorretor) || beneficiario === "corretor"
  );
  const tipoCfg = TIPOS_COMISSAO.find((t) => t.value === tipoNegocio);
  const itens = negociosPorTipo[tipoNegocio] ?? [];
  const negocio = itens.find((i) => i.id === negocioId) ?? null;

  const imovelGravado =
    tipoNegocio === "extra"
      ? descricaoExtra
      : negocioId === LEGADO
        ? comissao?.imovel ?? ""
        : negocio ? rotuloNegocio(negocio, tipoNegocio) : "";

  // ID real do negócio (rótulos podem se repetir). Registro antigo mantido
  // como texto: preserva o ID já gravado, se houver; "extra" não tem negócio.
  const negocioIdGravado =
    tipoNegocio === "extra"
      ? ""
      : negocioId === LEGADO
        ? comissao?.negocioId ?? ""
        : negocio?.id ?? "";

  const valorSugerido = calcularValorComissao(negocio?.valorBase, percentual);

  // Valor = percentual × valor do negócio vinculado; recalculado quando o
  // negócio ou o percentual mudam, e continua editável à mão depois.
  function recalcular(item: NegocioItem | null, pct: number) {
    const v = calcularValorComissao(item?.valorBase, pct);
    if (v != null) setValorDisplay(valorParaDisplay(v));
  }

  function handleBeneficiarioChange(valor: string) {
    setBeneficiario(valor);
    // "Obra" só existe para corretor — evita ficar com um tipo que sumiu da lista.
    if (valor !== "corretor" && tipoNegocio === "obra") {
      setTipoNegocio("venda");
      setNegocioId("");
    }
  }

  function handleTipoChange(tipo: string) {
    setTipoNegocio(tipo);
    setNegocioId("");
    setDescricaoExtra("");
  }

  function handleNegocioChange(id: string) {
    setNegocioId(id);
    recalcular(itens.find((i) => i.id === id) ?? null, percentual);
  }

  function handlePercentualChange(pct: number) {
    setPercentual(pct);
    recalcular(negocio, pct);
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
          <input type="hidden" name="imovel" value={imovelGravado} />
          <input type="hidden" name="negocioId" value={negocioIdGravado} />
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

            {/* Tipo de comissão + negócio pré-cadastrado (criação e edição) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Comissão *</label>
              <select value={tipoNegocio} onChange={(e) => handleTipoChange(e.target.value)}
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
                  value={descricaoExtra} onChange={(e) => setDescricaoExtra(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  {tipoNegocio === "obra" ? "Obra cadastrada" : tipoNegocio === "financiamento" ? "Financiamento cadastrado" : "Imóvel cadastrado"} *
                </label>
                {itens.length > 0 || negocioId === LEGADO ? (
                  <select required value={negocioId} onChange={(e) => handleNegocioChange(e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                    <option value="">Selecione...</option>
                    {negocioId === LEGADO && (
                      <option value={LEGADO}>{comissao?.imovel} (registro antigo)</option>
                    )}
                    {itens.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}{item.valorBase ? ` — ${formatCurrency(item.valorBase)}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-600 italic py-2">
                    Nenhum registro cadastrado para este tipo. Cadastre primeiro no módulo correspondente.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Percentual (%)</label>
              <PercentInput name="percentual" placeholder="5"
                value={percentual} onValueChange={handlePercentualChange}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor da Comissão *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm pointer-events-none">R$</span>
                <input type="text" inputMode="numeric" required placeholder="0,00"
                  value={valorDisplay} onChange={(e) => setValorDisplay(mascararDinheiro(e.target.value).texto)}
                  className="w-full border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                <input type="hidden" name="valor" value={currencyToFloat(valorDisplay)} />
              </div>
            </div>

            {tipoCfg?.base && (
              <div className="sm:col-span-2 -mt-2 flex items-start gap-1.5 text-[11px] text-gray-500">
                <Calculator size={12} className="mt-0.5 shrink-0 text-[var(--brand-yellow)]" />
                {valorSugerido != null ? (
                  <span>
                    Calculado: {percentual}% × {formatCurrency(negocio!.valorBase!)} ({tipoCfg.base}) = <strong>{formatCurrency(valorSugerido)}</strong>. Pode ajustar o valor manualmente.
                  </span>
                ) : (
                  <span>O valor é calculado automaticamente (percentual × {tipoCfg.base}) ao escolher o negócio — editável depois.</span>
                )}
              </div>
            )}

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
