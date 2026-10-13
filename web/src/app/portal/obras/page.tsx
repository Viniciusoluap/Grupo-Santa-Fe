import { auth } from "@/auth";
import { getPortalObras } from "@/lib/data/portal-real";
import { BackButton } from "@/components/ui/back-button";
import { redirect } from "next/navigation";

export default async function MinhasObrasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; leadId?: string };
  if (user.role !== "cliente") redirect("/admin");
  const obras = user.leadId ? await getPortalObras(user.leadId) : [];

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Minhas obras</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe o progresso e as fotos das suas obras.</p>
      </div>
      {obras.length === 0 ? (
        <div className="bg-white border border-gray-100 p-8 text-gray-600">Nenhuma obra vinculada ao seu cadastro.</div>
      ) : obras.map((obra) => {
        const progresso = obra.progressoMedido == null ? obra.progresso : Number(obra.progressoMedido);
        const percentual = Number.isFinite(progresso) ? Math.min(100, Math.max(0, progresso)) : 0;
        return (
          <section key={obra.id} className="bg-white border border-gray-100 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--brand-dark)]">{obra.nome}</h2>
              <p className="text-sm text-gray-600">{obra.status}{obra.endereco ? ` · ${obra.endereco}` : ""}</p>
              {obra.dataPrevisaoFim && <p className="text-sm text-gray-600">Previsão: {obra.dataPrevisaoFim.toLocaleDateString("pt-BR")}</p>}
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-700 mb-1"><span>Progresso</span><strong>{percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong></div>
              <div className="h-2 bg-gray-200 rounded-full"><div className="h-full bg-[var(--brand-yellow)] rounded-full" style={{ width: `${percentual}%` }} /></div>
            </div>
            {obra.fotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {obra.fotos.map((foto) => (
                  <a key={foto.id} href={`/api/obras/fotos/${foto.id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0">
                    {/* O endpoint verifica a sessão e o lead proprietário em cada acesso. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/obras/fotos/${foto.id}`} alt={foto.legenda || `Foto da obra de ${foto.tiradaEm.toLocaleDateString("pt-BR")}`} className="w-full aspect-video object-cover" />
                    <span className="block text-xs text-gray-600 mt-1 break-words">{foto.legenda || foto.tiradaEm.toLocaleDateString("pt-BR")}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
