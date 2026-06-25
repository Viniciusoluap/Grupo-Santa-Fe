import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { COMMISSION_STATUS_CONFIG } from "@/lib/types/corretor";
import { formatCurrency, formatTelefone } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

export default async function CorretorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const c = await prisma.corretor.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { criadoEm: "desc" } },
      imoveis: { orderBy: { criadoEm: "desc" }, take: 5 },
      comissoes: { orderBy: { vencimento: "desc" } },
    },
  });
  if (!c) notFound();

  let especialidades: string[] = [];
  try { especialidades = JSON.parse(c.especialidades) as string[]; } catch { /* ignore */ }

  const totalComissao = c.comissoes.reduce((s, cm) => s + cm.valor, 0);
  const pago = c.comissoes.filter((cm) => cm.status === "pago").reduce((s, cm) => s + cm.valor, 0);
  const pendente = c.comissoes.filter((cm) => cm.status === "pendente").reduce((s, cm) => s + cm.valor, 0);

  const leadsCount = c.leads.length;
  const imoveisCount = c.imoveis.length;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/corretores" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Corretores
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">{c.nome}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${c.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {c.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Performance */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Leads", value: leadsCount, color: "text-blue-500" },
                { label: "Imóveis", value: imoveisCount, color: "text-green-500" },
                { label: "Total Comissão", value: formatCurrency(totalComissao), color: "text-[var(--brand-dark)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 p-3 text-center">
                  <p className={`font-black text-xl ${color}`}>{value}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Commissions table */}
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Comissões ({c.comissoes.length})</h2>
            </div>
            {c.comissoes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma comissão cadastrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Imóvel</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase hidden md:table-cell">%</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {c.comissoes.map((cm) => {
                      const cfg = COMMISSION_STATUS_CONFIG[cm.status as keyof typeof COMMISSION_STATUS_CONFIG] ?? {
                        label: cm.status,
                        bgColor: "bg-gray-100",
                        color: "text-gray-600",
                      };
                      return (
                        <tr key={cm.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--brand-dark)]">{cm.imovel}</p>
                            <p className="text-xs text-gray-400">Vence: {new Date(cm.vencimento).toLocaleDateString("pt-BR")}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{cm.percentual}%</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(cm.valor)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leads recentes */}
          {c.leads.length > 0 && (
            <div className="bg-white border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Leads ({c.leads.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Serviço</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {c.leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--brand-dark)]">{lead.nome}</p>
                          <p className="text-xs text-gray-400">{formatTelefone(lead.telefone ?? "")}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                          {(() => { try { return (JSON.parse(lead.servico) as string[]).join(", "); } catch { return lead.servico; } })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 uppercase bg-gray-100 text-gray-600">{lead.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-[var(--brand-dark)] p-5">
            <div className="w-16 h-16 bg-[var(--brand-yellow)] flex items-center justify-center mb-4">
              <span className="text-[var(--brand-dark)] font-black text-2xl">{c.nome[0]}</span>
            </div>
            <p className="text-white font-bold">{c.nome}</p>
            <p className="text-gray-400 text-xs mt-0.5">{c.creci}</p>
            {especialidades.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {especialidades.map((s) => (
                  <span key={s} className="text-[9px] font-bold bg-white/10 text-gray-300 px-2 py-0.5 uppercase">{s}</span>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <a href={`tel:${c.telefone}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors">
                <Phone size={14} /> {formatTelefone(c.telefone ?? "")}
              </a>
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors">
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Total comissões", value: formatCurrency(totalComissao), color: "text-[var(--brand-dark)]" },
              { label: "Já pago", value: formatCurrency(pago), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(pendente), color: "text-orange-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`font-bold text-sm ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Informações</p>
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Cadastrado em</p>
                <p className="text-sm font-medium">{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
