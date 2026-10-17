import { exigirModuloPagina } from "@/lib/auth/modulos";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ClienteVinculadoInfo } from "@/components/crm/cliente-vinculado-info";
import { editarClienteRegularizacao } from "@/lib/actions/regularizacoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarRegularizacaoPage({ params }: PageProps) {
  await exigirModuloPagina("regularizacao");

  const { id } = await params;
  const r = await prisma.regularizacao.findUnique({ where: { id } , include: { leadVinculado: { select: { id: true, nome: true, telefone: true, email: true } } } });
  if (!r) notFound();
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/admin/regularizacao/${id}`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Regularização
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Dados do processo</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        {/* Pedido de 16/10: só os dados que vêm do lead (cliente e telefone). Os demais
            campos saíram da tela; os valores já gravados ficam preservados. */}
        {r.leadVinculado ? (
          <div className="space-y-3">
            <ClienteVinculadoInfo lead={r.leadVinculado} />
            <p className="text-xs text-gray-600">Dados do cadastro do lead no CRM. Para alterar, edite o lead.</p>
            <Link href={`/admin/regularizacao/${id}`}
              className="inline-block border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
              Voltar
            </Link>
          </div>
        ) : (
          <form action={editarClienteRegularizacao} className="space-y-5">
            <input type="hidden" name="id" value={id} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
                <input name="clienteNome" type="text" required minLength={2} defaultValue={r.clienteNome}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone do Cliente</label>
                <PhoneInput name="clienteTel" defaultValue={r.clienteTel ?? ""}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
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
        )}
      </div>
    </div>
  );
}
