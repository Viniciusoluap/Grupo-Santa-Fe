import { exigirModuloPagina } from "@/lib/auth/modulos";
import { EditarObraPagina } from "@/components/obras/editar-obra-pagina";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarObraPage({ params }: PageProps) {
  await exigirModuloPagina("obras");
  const { id } = await params;
  return <EditarObraPagina id={id} />;
}
