import { notFound } from "next/navigation";
import { EditarObraPagina } from "@/components/obras/editar-obra-pagina";
import { empreiteiroDaSessao, obraEhDoEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";

interface PageProps { params: Promise<{ id: string }> }

// "Editar Obra" do Portal do Empreiteiro: o painel do admin com Informações,
// Valores e Custos previstos só leitura, só para obra vinculada a ele.
export default async function EmpreiteiroEditarObraPage({ params }: PageProps) {
  const { id } = await params;
  const emp = await empreiteiroDaSessao();
  if (!emp || !(await obraEhDoEmpreiteiro(id, emp.id))) notFound();
  return <EditarObraPagina id={id} modo="empreiteiro" />;
}
