import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { criarAvaliacao } from "@/lib/actions/avaliacoes";

export default function NovaAvaliacaoPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/avaliacoes" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)] mb-2">
          <ArrowLeft size={14} /> Avaliações
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">Nova Avaliação</h1>
      </div>

      <form action={criarAvaliacao} className="bg-white border border-gray-100 p-6 space-y-6">
        {/* Tipo e finalidade */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Tipo de Avaliação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Laudo *</label>
              <select name="tipo" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="mercado">Avaliação de Mercado</option>
                <option value="locacao">Avaliação para Locação</option>
                <option value="judicial">Avaliação Judicial</option>
                <option value="parecer_tecnico">Parecer Técnico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Finalidade *</label>
              <select name="finalidade" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
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
              <select name="metodologia" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="comparativo">Método Comparativo</option>
                <option value="renda">Método da Renda</option>
                <option value="custo">Método do Custo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Avaliador Responsável *</label>
              <input name="avaliador" type="text" required placeholder="Nome do avaliador / CREA" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dados do Solicitante</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo *</label>
              <input name="clienteNome" type="text" required placeholder="Nome do solicitante" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
              <input name="clienteCpf" type="text" placeholder="000.000.000-00" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone *</label>
              <input name="clienteTel" type="text" required placeholder="(94) 9 9999-9999" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
              <input name="clienteEmail" type="email" placeholder="email@exemplo.com" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Imóvel */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dados do Imóvel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Endereço *</label>
              <input name="endereco" type="text" required placeholder="Rua, número, complemento" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bairro *</label>
              <input name="bairro" type="text" required placeholder="Bairro" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cidade</label>
              <input name="cidade" type="text" defaultValue="Canaã dos Carajás" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área Construída (m²)</label>
              <input name="areaConstruida" type="number" step="0.01" placeholder="Ex: 120" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área do Terreno (m²)</label>
              <input name="areaTerreno" type="number" step="0.01" placeholder="Ex: 300" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Quartos</label>
              <input name="quartos" type="number" min="0" placeholder="0" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banheiros</label>
              <input name="banheiros" type="number" min="0" placeholder="0" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data da Vistoria</label>
            <input name="dataVistoria" type="date" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prazo de Entrega</label>
            <input name="prazoEntrega" type="date" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
          <textarea name="observacoes" rows={3} placeholder="Informações adicionais sobre o imóvel ou solicitação..." className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
            Abrir Avaliação
          </button>
          <Link href="/admin/avaliacoes" className="px-4 py-2.5 border border-gray-200 text-xs font-bold uppercase text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
