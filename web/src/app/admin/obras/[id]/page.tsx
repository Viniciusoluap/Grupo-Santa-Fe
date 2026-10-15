import { exigirModuloPagina } from "@/lib/auth/modulos";
import { ObraDetalhe } from "@/components/obras/obra-detalhe";

interface PageProps { params: Promise<{ id: string }> }

export default async function ObraDetailPage({ params }: PageProps) {
  await exigirModuloPagina("obras");
  const { id } = await params;
  return <ObraDetalhe id={id} />;
}
