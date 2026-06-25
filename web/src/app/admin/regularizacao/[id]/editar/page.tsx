import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { REG_STATUS_CONFIG, REG_TIPO_CONFIG } from "@/lib/types/regularizacao";
import { editarRegularizacao } from "@/lib/actions/regularizacoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarRegularizacaoPage({ params }: PageProps) {
  const { id } = await params;
  const r = await prisma.regularizacao.findUnique({ where: { id } });
  if (!r) notFound();

  const previsaoValue = r.previsaoFim ? new Date(r.previsaoFim).toISOString().split("T")[0] : "";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/regularizacao/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Regularização
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Regularização</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={editarRegularizacao} className="space-y-5">
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome do Processo *</label>
              <input name="nome" type="text" required defaultValue={r.nome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
              <select name="tipo" defaultValue={r.tipo}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {Object.entries(REG_TIPO_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select name="status" defaultValue={r.status}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {Object.entries(REG_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
              <input name="clienteNome" type="text" required defaultValue={r.clienteNome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone do Cliente</label>
              <PhoneInput name="clienteTel" defaultValue={r.clienteTel ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço / Imóvel *</label>
              <input name="endereco" type="text" required defaultValue={r.endereco}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Matrícula</label>
              <input name="matricula" type="text" defaultValue={r.matricula ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Responsável *</label>
              <input name="responsavel" type="text" required defaultValue={r.responsavel}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Serviço *</label>
              <CurrencyInput name="valorServico" required defaultValue={r.valorServico}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Previsão de Conclusão</label>
              <input name="previsaoFim" type="date" defaultValue={previsaoValue}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
              <textarea name="descricao" rows={3} defaultValue={r.descricao}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <SubmitButton
              pendingText="Salvando..."
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Salvar Alterações
            </SubmitButton>
            <Link href={`/admin/regularizacao/${id}`}
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
