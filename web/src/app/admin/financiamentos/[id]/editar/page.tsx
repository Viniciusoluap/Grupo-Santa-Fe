import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { TIPO_CONFIG, BANCO_CONFIG } from "@/lib/types/financiamento";
import { editarFinanciamento } from "@/lib/actions/financiamentos";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarFinanciamentoPage({ params }: PageProps) {
  const { id } = await params;
  const f = await prisma.financiamento.findUnique({ where: { id } });
  if (!f) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/financiamentos/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Financiamento
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Financiamento</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={editarFinanciamento} className="space-y-5">
          <input type="hidden" name="id" value={id} />

          {/* Dados do Cliente */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Dados do Cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Cliente *</label>
                <input name="clienteNome" type="text" required defaultValue={f.clienteNome}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                <PhoneInput name="clienteTel" defaultValue={f.clienteTel ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
                <input name="clienteEmail" type="email" defaultValue={f.clienteEmail ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
                <input name="clienteCpf" type="text" defaultValue={f.clienteCpf ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

          {/* Imóvel */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Imóvel</p>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome / Endereço do Imóvel *</label>
              <input name="imovel" type="text" required defaultValue={f.imovel}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>

          {/* Tipo e Banco */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Tipo e Banco</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Financiamento *</label>
                <select name="tipo" required defaultValue={f.tipo}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banco / Convênio *</label>
                <select name="banco" required defaultValue={f.banco}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                  {Object.entries(BANCO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Valores</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Imóvel *</label>
                <CurrencyInput name="valorImovel" required defaultValue={f.valorImovel}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Financiamento *</label>
                <CurrencyInput name="valorFinanciado" required defaultValue={f.valorFinanciado}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Entrada</label>
                <CurrencyInput name="entrada" defaultValue={f.entrada}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Taxa de Juros (% a.a.) *</label>
                <input name="taxa" type="number" step="0.01" required defaultValue={f.taxa}
                  className="w-full px-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo (meses) *</label>
                <input name="prazo" type="number" required defaultValue={f.prazo}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Salvando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Salvar Alterações
            </SubmitButton>
            <Link href={`/admin/financiamentos/${id}`}
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
