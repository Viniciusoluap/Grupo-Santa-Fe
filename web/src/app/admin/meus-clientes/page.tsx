import { redirect } from "next/navigation";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { ETAPAS_ACOMPANHAMENTO, etapaParaCorretor } from "@/lib/portal-corretor";

export const dynamic = "force-dynamic";

// Pedido de 15/10: o corretor acompanha a etapa do CRM dos clientes vinculados a
// ele — somente leitura. Gêmeo do "Acompanhamento dos meus clientes" do Portal do
// Corretor da Prospecta.
export default async function MeusClientesPage() {
  const u = await usuarioAtual();
  if (!u || !u.ativo) redirect("/login");
  if (u.perfil !== "corretor") redirect(destinoDoUsuario(u));

  const leads = u.corretorId
    ? await prisma.lead.findMany({
        where: { corretorId: u.corretorId, excluidoEm: null },
        select: { id: true, nome: true, etapaOperacional: true, status: true, arquivadoEm: true, excluidoEm: true, atualizadoEm: true },
        orderBy: { atualizadoEm: "desc" },
      })
    : [];
  const ativos = leads.filter(leadNoPipelineAtivo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Meus clientes</h1>
        <p className="text-sm text-gray-500">Etapa atual de cada cliente vinculado a você no CRM. Somente consulta.</p>
      </div>
      {ativos.length === 0 && (
        <div className="bg-white border border-gray-100 p-10 text-center text-sm text-gray-500">
          Nenhum cliente vinculado a você no momento.
        </div>
      )}
      <div className="space-y-3">
        {ativos.map((lead) => {
          const etapa = etapaParaCorretor(lead);
          return (
            <div key={lead.id} className="bg-white border border-gray-100 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-[var(--brand-dark)]">{lead.nome}</p>
                <span className="bg-[var(--brand-dark)] px-2 py-0.5 text-xs font-bold text-white">{etapa.nome}</span>
              </div>
              <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={`Etapas de ${lead.nome}`}>
                {ETAPAS_ACOMPANHAMENTO.map((e, i) => (
                  <li key={e.chave} className="min-w-0" aria-current={i === etapa.indice ? "step" : undefined}>
                    <div className={`h-2 ${i === etapa.indice ? "bg-[var(--brand-yellow)]" : etapa.indice >= 0 && i < etapa.indice ? "bg-[var(--brand-dark)]" : "bg-gray-200"}`} />
                    <p className={`mt-1 hidden text-[10px] leading-tight md:block ${i === etapa.indice ? "font-bold text-[var(--brand-dark)]" : "text-gray-500"}`}>{e.nome}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-gray-500">Atualizado em {lead.atualizadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
