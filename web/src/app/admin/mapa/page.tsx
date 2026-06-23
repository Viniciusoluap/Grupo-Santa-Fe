import { prisma } from "@/lib/db";
import { MapaClient } from "./_components/mapa-client";

export default async function AdminMapaPage() {
  const imoveis = await prisma.imovel.findMany({
    where: { status: { notIn: ["vendido", "locado"] } },
    select: { id: true, titulo: true, tipo: true, bairro: true, preco: true, slug: true, quartos: true, banheiros: true, area: true, latitude: true, longitude: true },
    orderBy: { criadoEm: "desc" },
  });
  return <MapaClient imoveis={imoveis} />;
}
