import { redirect } from "next/navigation";
import { centavosDe } from "@/lib/financeiro/obra";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { empreiteiroDaSessao } from "@/lib/obras/acesso-empreiteiro";
import { carregarListaObras } from "@/lib/obras/lista-dados";
import { PortalEmpreiteiroClient } from "./_components/portal-empreiteiro-client";

// Portal do Empreiteiro (pedido de 15/10/2026). "Minhas Obras": a mesma lista do
// painel (filtros sem "Responsável", sem Excluir), só com as obras vinculadas a
// ele. "Relatórios": somas de todas essas obras — o lucro previsto DELE, o VGV e
// o valor a receber do banco. Gêmeo de client/src/pages/EmpreiteiroPortal.tsx.
export default async function EmpreiteiroPage() {
  const emp = await empreiteiroDaSessao();
  if (!emp) redirect("/login");
  const obras = await carregarListaObras({ empreiteiroId: emp.id });
  const indicadores = await Promise.all(obras.map(async (o) => {
    const r = await carregarResumoObra(o.id);
    return {
      id: o.id,
      nome: o.nome,
      vgvCentavos: r ? centavosDe(r.valores.vgv) : null,
      receberBanco: r?.calculo.receberBanco ?? { ok: false as const, motivo: "Obra sem dados" },
      lucroEmpreiteiro: r?.calculo.lucroEmpreiteiro ?? { ok: false as const, motivo: "Obra sem dados" },
    };
  }));
  return <PortalEmpreiteiroClient obras={obras} indicadores={indicadores} />;
}
