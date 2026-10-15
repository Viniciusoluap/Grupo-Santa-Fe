import { exigirModuloPagina } from "@/lib/auth/modulos";
import { carregarListaObras } from "@/lib/obras/lista-dados";
import { ObrasClient } from "./_components/obras-client";

export default async function ObrasPage() {
  await exigirModuloPagina("obras");
  return <ObrasClient obras={await carregarListaObras()} />;
}
