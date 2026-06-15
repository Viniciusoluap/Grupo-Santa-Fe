import Link from "next/link";
import { Plus, Briefcase, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";

const STATUS_CONFIG = {
  ativo:     { label: "Ativo",     bg: "bg-green-100",  text: "text-green-700",  icon: CheckCircle2 },
  pausado:   { label: "Pausado",   bg: "bg-yellow-100", text: "text-yellow-700", icon: PauseCircle },
  encerrado: { label: "Encerrado", bg: "bg-gray-100",   text: "text-gray-500",   icon: XCircle },
};

const SERVICO_LABELS: Record<string, string> = {
  contas_pagar:    "Contas a Pagar",
  contas_receber:  "Contas a Receber",
  conciliacao:     "Conciliação",
  folha:           "Folha de Pagamento",
  fiscal:          "Obrigações Fiscais",
  honorarios:      "Honorários",
};

export default async function BpoPage() {
  const clientes = await prisma.bpoCliente.findMany({
    orderBy: { criadoEm: "desc" },
    include: { lancamentos: true },
  });

  const ativos = clientes.filter((c) => c.status === "ativo");
  const receitaMensal = ativos.reduce((s, c) => s + c.honorarios, 0);
  const totalPendente = clientes.flatMap((c) => c.lancamentos).filter((l) => !l.pago).reduce((s, l) => s + l.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <BackButton className="mb-1" />
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">BPO Financeiro</h1>
          <p className="text-gray-400 text-sm mt-0.5">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} · Terceirização de processos financeiros</p>
        </div>
        <Link
          href="/admin/bpo/novo"
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
        >
          <Plus size={14} /> Novo Cliente
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clientes ativos", value: ativos.length, icon: Briefcase, color: "text-[var(--brand-dark)]", bg: "bg-[var(--brand-yellow)]" },
          { label: "Receita mensal", value: formatCurrency(receitaMensal), icon: CheckCircle2, color: "text-green-700", bg: "bg-green-100" },
          { label: "Total de clientes", value: clientes.length, icon: Briefcase, color: "text-blue-700", bg: "bg-blue-100" },
          { label: "Pendente receber", value: formatCurrency(totalPendente), icon: PauseCircle, color: "text-orange-600", bg: "bg-orange-100" },
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

      {/* Client list */}
      {clientes.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cliente BPO cadastrado</p>
          <p className="text-gray-400 text-sm mt-1">
            <Link href="/admin/bpo/novo" className="text-[var(--brand-yellow)] hover:underline">Cadastrar primeiro cliente</Link>
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-dark)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Serviços</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Honorários/mês</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Venc.</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.map((c) => {
                  const cfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ativo;
                  let servicos: string[] = [];
                  try { servicos = JSON.parse(c.servicos) as string[]; } catch { /* ignore */ }
                  const pendente = c.lancamentos.filter((l) => !l.pago).reduce((s, l) => s + l.valor, 0);

                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--brand-dark)]">{c.razaoSocial}</p>
                        <p className="text-xs text-gray-400">{c.responsavel} · {c.telefone}</p>
                        {pendente > 0 && <p className="text-xs text-orange-500 font-bold">{formatCurrency(pendente)} pendente</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {servicos.slice(0, 3).map((s) => (
                            <span key={s} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 uppercase">
                              {SERVICO_LABELS[s] ?? s}
                            </span>
                          ))}
                          {servicos.length > 3 && <span className="text-[9px] text-gray-400">+{servicos.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)]">{formatCurrency(c.honorarios)}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">dia {c.diaVencimento}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/admin/bpo/${c.id}`} className="text-xs font-bold text-[var(--brand-yellow)] hover:underline">
                          Ver
                        </Link>
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
