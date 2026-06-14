"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { criarLancamento, atualizarStatusLancamento } from "@/lib/actions/contabilidade";

type DbLancamento = {
  id: string;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: Date;
  vencimento: Date | null;
  status: string;
  formaPagamento: string | null;
  referencia: string | null;
  competencia: string;
  fornecedor: string | null;
  observacoes: string;
  criadoEm: Date;
};

const CATEGORIA_LABELS: Record<string, string> = {
  servicos:   "Serviços",
  comissoes:  "Comissões",
  imoveis:    "Imóveis",
  aluguel:    "Aluguel",
  folha:      "Folha de Pagamento",
  impostos:   "Impostos / Taxas",
  marketing:  "Marketing",
  outros:     "Outros",
};

const STATUS_CONFIG = {
  pendente:  { label: "Pendente",  bg: "bg-yellow-100", text: "text-yellow-700", icon: Clock },
  pago:      { label: "Pago",      bg: "bg-green-100",  text: "text-green-700",  icon: CheckCircle2 },
  cancelado: { label: "Cancelado", bg: "bg-red-100",    text: "text-red-600",    icon: XCircle },
};

interface ContabilidadeClientProps {
  lancamentos: DbLancamento[];
}

export function ContabilidadeClient({ lancamentos }: ContabilidadeClientProps) {
  const [tipoFilter, setTipoFilter] = useState<"todos" | "receita" | "despesa">("todos");
  const [showForm, setShowForm] = useState(false);

  const filtered = lancamentos.filter((l) => tipoFilter === "todos" || l.tipo === tipoFilter);

  const totalReceita = lancamentos.filter((l) => l.tipo === "receita" && l.status !== "cancelado").reduce((s, l) => s + l.valor, 0);
  const totalDespesa = lancamentos.filter((l) => l.tipo === "despesa" && l.status !== "cancelado").reduce((s, l) => s + l.valor, 0);
  const saldo = totalReceita - totalDespesa;
  const pendente = lancamentos.filter((l) => l.status === "pendente").reduce((s, l) => s + l.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <BackButton className="mb-1" />
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Contabilidade</h1>
          <p className="text-gray-400 text-sm mt-0.5">{lancamentos.length} lançamentos · Controle financeiro da empresa</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
        >
          <Plus size={14} /> Novo Lançamento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Saldo",    value: formatCurrency(saldo),        icon: DollarSign,  color: saldo >= 0 ? "text-green-700" : "text-red-600", bg: saldo >= 0 ? "bg-green-100" : "bg-red-100" },
          { label: "Receitas", value: formatCurrency(totalReceita),  icon: TrendingUp,   color: "text-green-700", bg: "bg-green-100" },
          { label: "Despesas", value: formatCurrency(totalDespesa),  icon: TrendingDown, color: "text-red-600",   bg: "bg-red-100" },
          { label: "Pendente", value: formatCurrency(pendente),      icon: Clock,        color: "text-orange-600", bg: "bg-orange-100" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className={`w-8 h-8 ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className={`font-black text-lg leading-none ${color}`}>{value}</p>
            <p className="text-gray-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* New lancamento form */}
      {showForm && (
        <div className="bg-white border border-[var(--brand-yellow)] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Novo Lançamento</p>
          <form
            action={async (fd) => { await criarLancamento(fd); setShowForm(false); }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo *</label>
              <select name="tipo" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Categoria *</label>
              <select name="categoria" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                {Object.entries(CATEGORIA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select name="status" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago / Recebido</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição *</label>
              <input name="descricao" type="text" required placeholder="Ex: Comissão venda — Rua das Flores 120" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
              <input name="valor" type="number" step="0.01" required placeholder="0,00" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data *</label>
              <input name="data" type="date" required className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento</label>
              <input name="vencimento" type="date" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Forma de Pagamento</label>
              <select name="formaPagamento" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                <option value="">— Selecione —</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="boleto">Boleto</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fornecedor / Parte</label>
              <input name="fornecedor" type="text" placeholder="Nome do fornecedor ou cliente" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nº Documento / Referência</label>
              <input name="referencia" type="text" placeholder="NF, recibo, protocolo..." className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 justify-end border-t border-gray-100 pt-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold uppercase text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2 transition-colors">
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: "todos",   label: `Todos (${lancamentos.length})` },
          { key: "receita", label: `Receitas (${lancamentos.filter((l) => l.tipo === "receita").length})` },
          { key: "despesa", label: `Despesas (${lancamentos.filter((l) => l.tipo === "despesa").length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTipoFilter(key)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
              tipoFilter === key
                ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
          <DollarSign size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum lançamento encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Use o botão "Novo Lançamento" para registrar.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-dark)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Descrição</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden lg:table-cell">Data</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Valor</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((l) => {
                  const scfg = STATUS_CONFIG[l.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pendente;
                  const isReceita = l.tipo === "receita";
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isReceita
                            ? <TrendingUp size={13} className="text-green-500 shrink-0" />
                            : <TrendingDown size={13} className="text-red-400 shrink-0" />
                          }
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--brand-dark)] truncate">{l.descricao}</p>
                            {l.fornecedor && <p className="text-xs text-gray-400 truncate">{l.fornecedor}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">{CATEGORIA_LABELS[l.categoria] ?? l.categoria}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                        {new Date(l.data).toLocaleDateString("pt-BR")}
                        {l.vencimento && (
                          <span className="block text-gray-400">Venc. {new Date(l.vencimento).toLocaleDateString("pt-BR")}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isReceita ? "text-green-600" : "text-red-500"}`}>
                        {isReceita ? "+" : "-"}{formatCurrency(l.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${scfg.bg} ${scfg.text}`}>{scfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {l.status === "pendente" && (
                          <form action={atualizarStatusLancamento}>
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="status" value="pago" />
                            <button type="submit" className="text-xs font-bold text-green-600 hover:underline">
                              {isReceita ? "Receber" : "Pagar"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
