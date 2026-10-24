import { exigirModuloPagina } from "@/lib/auth/modulos";
import { pontosDoMapa } from "@/lib/mapa-operacional";
import { MapaClient } from "./_components/mapa-client";

export default async function AdminMapaPage() {
  await exigirModuloPagina("mapa");
  return <MapaClient pontos={await pontosDoMapa()} />;
}
