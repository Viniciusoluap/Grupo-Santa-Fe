import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { listarComissoesDeObras } from "@/lib/comissoes/obras";
import { comissoesDoPortal } from "@/lib/corretor/portal";
import { ETAPAS_ACOMPANHAMENTO, etapaParaCorretor } from "@/lib/portal-corretor";

// Início do Portal do Corretor (igual à Prospecta): imóveis disponíveis, minhas
// comissões e o acompanhamento dos clientes vinculados a ele no CRM.
export default async function CorretorInicioPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  const [disponiveis, manuais, deObras, leads] = await Promise.all([
    prisma.imovel.count({ where: { revisaoStatus: "aprovado" } }),
    comissoesDoPortal(u.corretorId),
    u.corretorId ? listarComissoesDeObras(u.corretorId) : Promise.resolve([]),
    u.corretorId
      ? prisma.lead.findMany({
          where: { corretorId: u.corretorId, excluidoEm: null },
          select: { id: true, nome: true, etapaOperacional: true, status: true, arquivadoEm: true, excluidoEm: true, atualizadoEm: true },
          orderBy: { atualizadoEm: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const ativos = leads.filter(leadNoPipelineAtivo);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Imóveis disponíveis</h2>
        <p className="mt-4 text-4xl font-black text-[var(--brand-dark)]">{disponiveis}</p>
      </section>
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Minhas comissões</h2>
        <p className="mt-4 text-4xl font-black text-[var(--brand-dark)]">{manuais.length + deObras.length}</p>
      </section>
      <section className="rounded-xl border bg-white p-6 shadow-sm md:col-span-2">
        <h2 className="font-semibold">Acompanhamento dos meus clientes</h2>
        <p className="text-sm text-slate-600">Etapa atual de cada cliente vinculado a você no CRM. Somente consulta.</p>
        <div className="mt-4 space-y-4">
          {ativos.length === 0 && <p className="py-6 text-center text-sm text-slate-600">Nenhum cliente vinculado a você no momento.</p>}
          {ativos.map((lead) => {
            const etapa = etapaParaCorretor(lead);
            return (
              <div key={lead.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{lead.nome}</p>
                  <span className="rounded-md bg-[var(--brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{etapa.nome}</span>
                </div>
                <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={`Etapas de ${lead.nome}`}>
                  {ETAPAS_ACOMPANHAMENTO.map((e, i) => (
                    <li key={e.chave} className="min-w-0" aria-current={i === etapa.indice ? "step" : undefined}>
                      <div className={`h-2 rounded-full ${i === etapa.indice ? "bg-[var(--brand-yellow)]" : etapa.indice >= 0 && i < etapa.indice ? "bg-[var(--brand-dark)]" : "bg-slate-200"}`} />
                      <p className={`mt-1 hidden text-[10px] leading-tight md:block ${i === etapa.indice ? "font-bold text-[var(--brand-dark)]" : "text-slate-600"}`}>{e.nome}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-slate-600">Atualizado em {lead.atualizadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
