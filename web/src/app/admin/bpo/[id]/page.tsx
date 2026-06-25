import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { criarLancamentoBpo, marcarLancamentoPago, atualizarStatusBpoCliente } from "@/lib/actions/bpo";

const STATUS_CONFIG = {
  ativo:     { label: "Ativo",     bg: "bg-green-100",  text: "text-green-700" },
  pausado:   { label: "Pausado",   bg: "bg-yellow-100", text: "text-yellow-700" },
  encerrado: { label: "Encerrado", bg: "bg-gray-100",   text: "text-gray-500" },
};

const SERVICO_LABELS: Record<string, string> = {
  contas_pagar:   "Contas a Pagar",
  contas_receber: "Contas a Receber",
  conciliacao:    "Conciliação",
  folha:          "Folha de Pagamento",
  fiscal:         "Obrigações Fiscais",
  honorarios:     "Honorários",
};

interface PageProps { params: Promise<{ id: string }> }

export default async function BpoClientePage({ params }: PageProps) {
  const { id } = await params;
  const cliente = await prisma.bpoCliente.findUnique({
    where: { id },
    include: { lancamentos: { orderBy: { vencimento: "desc" } } },
  });
  if (!cliente) notFound();

  let servicos: string[] = [];
  try { servicos = JSON.parse(cliente.servicos) as string[]; } catch { /* ignore */ }

  const cfg = STATUS_CONFIG[cliente.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ativo;
  const pendentes = cliente.lancamentos.filter((l) => !l.pago);
  const pagos = cliente.lancamentos.filter((l) => l.pago);
  const totalPendente = pendentes.reduce((s, l) => s + l.valor, 0);
  const totalPago = pagos.reduce((s, l) => s + l.valor, 0);

  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/bpo" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> BPO Financeiro
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">{cliente.razaoSocial}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: client details */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dados do Cliente</p>
            {cliente.cnpj && <p className="text-sm text-gray-600"><span className="text-gray-400">CNPJ:</span> {cliente.cnpj}</p>}
            {cliente.cpf && <p className="text-sm text-gray-600"><span className="text-gray-400">CPF:</span> {cliente.cpf}</p>}
            <p className="text-sm text-gray-600"><span className="text-gray-400">Responsável:</span> {cliente.responsavel}</p>
            <a href={`tel:${cliente.telefone}`} className="flex items-center gap-2 text-sm text-[var(--brand-dark)] hover:text-[var(--brand-yellow)]">
              <Phone size={13} /> {formatTelefone(cliente.telefone)}
            </a>
            {cliente.email && (
              <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 text-sm text-[var(--brand-dark)] hover:text-[var(--brand-yellow)]">
                <Mail size={13} /> {cliente.email}
              </a>
            )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600"><span className="text-gray-400">Início:</span> {new Date(cliente.dataInicio).toLocaleDateString("pt-BR")}</p>
              <p className="text-sm text-gray-600 mt-1"><span className="text-gray-400">Vencimento:</span> dia {cliente.diaVencimento}</p>
              <p className="text-sm font-bold text-[var(--brand-dark)] mt-1">{formatCurrency(cliente.honorarios)}/mês</p>
            </div>
            {cliente.observacoes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">{cliente.observacoes}</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Serviços</p>
            <div className="space-y-1.5">
              {servicos.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-green-500" />
                  <span className="text-sm text-gray-700">{SERVICO_LABELS[s] ?? s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 p-4 text-center">
              <p className="font-black text-[var(--brand-dark)] text-lg">{formatCurrency(totalPendente)}</p>
              <p className="text-xs text-orange-500 font-bold mt-0.5">Pendente</p>
            </div>
            <div className="bg-white border border-gray-100 p-4 text-center">
              <p className="font-black text-green-600 text-lg">{formatCurrency(totalPago)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Pago</p>
            </div>
          </div>

          {/* Status change */}
          <div className="bg-white border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Alterar Status</p>
            <div className="space-y-2">
              {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([s, c]) => (
                <form key={s} action={atualizarStatusBpoCliente}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={cliente.status === s}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-default ${c.bg} ${c.text} hover:opacity-80`}
                  >
                    {c.label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

        {/* Right: lancamentos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add lancamento */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Registrar Lançamento</p>
            <form action={criarLancamentoBpo} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="hidden" name="clienteId" value={id} />
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo *</label>
                <select name="tipo" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                  <option value="honorario">Honorário Mensal</option>
                  <option value="despesa">Despesa do Cliente</option>
                  <option value="reembolso">Reembolso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Competência *</label>
                <input name="competencia" type="month" defaultValue={competencia} required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição *</label>
                <input name="descricao" type="text" required placeholder="Ex: Honorários BPO — junho/2026" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
                <input name="valor" type="number" step="0.01" required defaultValue={cliente.honorarios} className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento *</label>
                <input name="vencimento" type="date" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" className="bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-5 py-2 hover:bg-[var(--brand-yellow-dark)] transition-colors">
                  Registrar
                </button>
              </div>
            </form>
          </div>

          {/* Lancamentos list */}
          <div className="bg-white border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lançamentos ({cliente.lancamentos.length})</p>
            </div>
            {cliente.lancamentos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento registrado.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {cliente.lancamentos.map((l) => (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{l.descricao}</p>
                      <p className="text-xs text-gray-400">{l.competencia} · Venc. {new Date(l.vencimento).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <p className="font-bold text-[var(--brand-dark)] shrink-0">{formatCurrency(l.valor)}</p>
                    {l.pago ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 shrink-0">
                        <CheckCircle2 size={11} /> Pago
                      </span>
                    ) : (
                      <form action={marcarLancamentoPago}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="clienteId" value={id} />
                        <button type="submit" className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 hover:bg-orange-100 transition-colors">
                          <Clock size={11} /> Pagar
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
