import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TIPO_CONFIG, BANCO_CONFIG } from "@/lib/types/financiamento";
import { leads } from "@/lib/data/leads";

export default function NovoFinanciamentoPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/financiamentos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Financiamentos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Novo Financiamento</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form className="space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Dados do Cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Lead / Cliente *</label>
                <select required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione um lead...</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Imóvel *</label>
                <input type="text" required placeholder="Endereço / nome do imóvel" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Tipo e Banco</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Financiamento *</label>
                <select required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione...</option>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banco / Convênio *</label>
                <select required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  <option value="">Selecione...</option>
                  {Object.entries(BANCO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Valores</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Valor do Imóvel *", placeholder: "280000" },
                { label: "Valor do Financiamento *", placeholder: "250000" },
                { label: "Entrada", placeholder: "30000" },
                { label: "FGTS", placeholder: "0" },
                { label: "Renda Familiar Bruta *", placeholder: "0" },
                { label: "Prazo (meses) *", placeholder: "360" },
              ].map(({ label, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" placeholder={placeholder} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
            <textarea rows={3} placeholder="Informações adicionais..." className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cadastrar Financiamento
            </button>
            <Link href="/admin/financiamentos" className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
