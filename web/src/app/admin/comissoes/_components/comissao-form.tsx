"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { criarComissao, editarComissao } from "@/lib/actions/comissoes";
import { SubmitButton } from "@/components/ui/submit-button";

type Corretor = { id: string; nome: string };

type ComissaoData = {
  id: string;
  corretorId: string;
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
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovada", label: "Aprovada" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().split("T")[0];
}

export function ComissaoForm({ corretores, comissao, onClose }: Props) {
  const isEdit = !!comissao;

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Corretor *</label>
              <select name="corretorId" required defaultValue={comissao?.corretorId ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                <option value="">Selecione um corretor</option>
                {corretores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Imóvel / Negócio *</label>
              <input type="text" name="imovel" required placeholder="Ex: Apto 302, Residencial Aurora"
                defaultValue={comissao?.imovel ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor da Comissão *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input type="number" name="valor" required step="0.01" min="0" placeholder="0,00"
                  defaultValue={comissao?.valor ?? ""}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
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
