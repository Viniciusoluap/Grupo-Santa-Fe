import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { criarBpoCliente } from "@/lib/actions/bpo";

const SERVICOS = [
  { value: "contas_pagar",   label: "Contas a Pagar" },
  { value: "contas_receber", label: "Contas a Receber" },
  { value: "conciliacao",    label: "Conciliação Bancária" },
  { value: "folha",          label: "Folha de Pagamento" },
  { value: "fiscal",         label: "Obrigações Fiscais" },
  { value: "honorarios",     label: "Gestão de Honorários" },
];

export default function NovoBpoClientePage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/bpo" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)] mb-2">
          <ArrowLeft size={14} /> BPO Financeiro
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">Novo Cliente BPO</h1>
      </div>

      <form action={criarBpoCliente} className="bg-white border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Razão Social / Nome *</label>
            <input name="razaoSocial" type="text" required placeholder="Nome da empresa ou pessoa física" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CNPJ</label>
            <input name="cnpj" type="text" placeholder="00.000.000/0001-00" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF (Pessoa Física)</label>
            <input name="cpf" type="text" placeholder="000.000.000-00" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Responsável *</label>
            <input name="responsavel" type="text" required placeholder="Nome do contato" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone *</label>
            <input name="telefone" type="text" required placeholder="(94) 9 9999-9999" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">E-mail</label>
            <input name="email" type="email" placeholder="contato@empresa.com.br" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Serviços Contratados *</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICOS.map((s) => (
              <label key={s.value} className="flex items-center gap-2 p-2.5 border border-gray-200 cursor-pointer hover:border-[var(--brand-yellow)] transition-colors">
                <input type="checkbox" name="servicos" value={s.value} className="accent-[var(--brand-yellow)]" />
                <span className="text-sm text-gray-700">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Honorários Mensais (R$) *</label>
            <input name="honorarios" type="number" step="0.01" required placeholder="Ex: 1500" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Dia de Vencimento *</label>
            <input name="diaVencimento" type="number" min="1" max="28" defaultValue="10" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data de Início *</label>
            <input name="dataInicio" type="date" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações</label>
          <textarea name="observacoes" rows={3} placeholder="Notas sobre o contrato de BPO, escopo, particularidades..." className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none" />
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
            Cadastrar Cliente
          </button>
          <Link href="/admin/bpo" className="px-4 py-2.5 border border-gray-200 text-xs font-bold uppercase text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
