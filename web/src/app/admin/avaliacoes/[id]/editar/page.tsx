import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { editarAvaliacao } from "@/lib/actions/avaliacoes";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhoneInput } from "@/components/ui/phone-input";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarAvaliacaoPage({ params }: PageProps) {
  const { id } = await params;
  const [a, leads] = await Promise.all([
    prisma.avaliacao.findUnique({ where: { id } }),
    prisma.lead.findMany({ select: { id: true, nome: true, telefone: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!a) notFound();

  const fmt = (d: Date | null) => d ? d.toISOString().slice(0, 10) : "";

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href={`/admin/avaliacoes/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)] mb-2">
          <ArrowLeft size={14} /> {a.numero}
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">Editar Avaliação</h1>
      </div>

      <form action={editarAvaliacao} className="bg-white border border-gray-100 p-6 space-y-6">
        <input type="hidden" name="id" value={id} />

        {/* Tipo e finalidade */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tipo de Avaliação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Laudo *</label>
              <select name="tipo" required defaultValue={a.tipo} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="mercado">Avaliação de Mercado</option>
                <option value="locacao">Avaliação para Locação</option>
                <option value="judicial">Avaliação Judicial</option>
                <option value="parecer_tecnico">Parecer Técnico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Finalidade *</label>
              <select name="finalidade" required defaultValue={a.finalidade} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="compra_venda">Compra e Venda</option>
                <option value="locacao">Locação</option>
                <option value="judicial">Processo Judicial</option>
                <option value="garantia">Garantia Bancária</option>
                <option value="inventario">Inventário</option>
                <option value="seguro">Seguro Patrimonial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Metodologia</label>
              <select name="metodologia" defaultValue={a.metodologia} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="comparativo">Método Comparativo</option>
                <option value="renda">Método da Renda</option>
                <option value="custo">Método do Custo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Avaliador Responsável *</label>
              <input name="avaliador" type="text" required defaultValue={a.avaliador}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Solicitante */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dados do Solicitante</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vincular a Lead Cadastrado</label>
              <select name="leadId" defaultValue={a.leadId ?? ""} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="">— Nenhum lead vinculado —</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome} · {l.telefone}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo *</label>
              <input name="clienteNome" type="text" required defaultValue={a.clienteNome}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
              <input name="clienteCpf" type="text" defaultValue={a.clienteCpf ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone *</label>
              <PhoneInput name="clienteTel" required defaultValue={a.clienteTel}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
              <input name="clienteEmail" type="email" defaultValue={a.clienteEmail ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Imóvel */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Imóvel Avaliado</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
              <input name="endereco" type="text" required defaultValue={a.endereco}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bairro *</label>
              <input name="bairro" type="text" required defaultValue={a.bairro}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cidade</label>
              <input name="cidade" type="text" defaultValue={a.cidade}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área Construída (m²)</label>
              <input name="areaConstruida" type="number" step="0.01" defaultValue={a.areaConstruida ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área do Terreno (m²)</label>
              <input name="areaTerreno" type="number" step="0.01" defaultValue={a.areaTerreno ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Quartos</label>
              <input name="quartos" type="number" min="0" defaultValue={a.quartos ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banheiros</label>
              <input name="banheiros" type="number" min="0" defaultValue={a.banheiros ?? ""}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data da Vistoria</label>
            <input name="dataVistoria" type="date" defaultValue={fmt(a.dataVistoria)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo de Entrega</label>
            <input name="prazoEntrega" type="date" defaultValue={fmt(a.prazoEntrega)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
        </div>

        {/* Valor do Serviço */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cobrança do Serviço</p>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor do Serviço (R$)</label>
            <input name="valorServico" type="number" step="0.01" min="0" placeholder="Ex: 1500,00"
              defaultValue={a.valorServico ?? ""}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            <p className="text-[10px] text-gray-400 mt-1">Ao marcar como entregue, uma cobrança será criada automaticamente no BPO Financeiro.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
          <textarea name="observacoes" rows={3} defaultValue={a.observacoes}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <SubmitButton
            pendingText="Salvando..."
            className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Salvar Alterações
          </SubmitButton>
          <Link href={`/admin/avaliacoes/${id}`} className="px-4 py-2.5 border border-gray-200 text-xs font-bold uppercase text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
