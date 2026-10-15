import { notFound } from "next/navigation";
import { ObraDetalhe } from "@/components/obras/obra-detalhe";
import { empreiteiroDaSessao, obraEhDoEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";

interface PageProps { params: Promise<{ id: string }> }

// "Ver Detalhes" do Portal do Empreiteiro: a mesma página do painel, só para obra vinculada a ele.
export default async function EmpreiteiroObraPage({ params }: PageProps) {
  const { id } = await params;
  const emp = await empreiteiroDaSessao();
  if (!emp || !(await obraEhDoEmpreiteiro(id, emp.id))) notFound();
  return <ObraDetalhe id={id} voltarHref="/empreiteiro" voltarRotulo="Minhas Obras" diarioSomenteLeitura />;
}
