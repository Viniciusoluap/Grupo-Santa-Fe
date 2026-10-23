// Pedido de 23/10 — Mapa Operacional: imóveis disponíveis + obras com ponto
// conhecido. Gêmeo de mapaRouter.list (Prospecta/server/operacional-router.ts).
// Imóvel vinculado a uma obra mostra o VGV e o endereço da obra; obra sem imóvel
// vinculado entra com as coordenadas da PCI da CAIXA, sem criar imóvel.
// Coordenada ausente ou ilegível não é inventada.
import { prisma } from "@/lib/db";
import { coordenadasDaPci, enderecoCompleto } from "@/lib/obra-localizacao";

export type PontoMapa = {
  key: string;
  id: string;
  kind: "imovel" | "obra";
  obraId: string | null;
  titulo: string;
  tipo: string;
  status: string;
  endereco: string | null;
  valor: number | null;
  latitude: number | null;
  longitude: number | null;
  href: string | null;
};

const numero = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function pontosDoMapa(): Promise<PontoMapa[]> {
  const [imoveis, obras] = await Promise.all([
    prisma.imovel.findMany({
      where: { status: { notIn: ["vendido", "locado"] } },
      select: { id: true, titulo: true, tipo: true, status: true, rua: true, bairro: true, cidade: true, estado: true, preco: true, slug: true, latitude: true, longitude: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.obra.findMany({
      select: {
        id: true, nome: true, endereco: true, vgv: true, imovelId: true,
        leadVinculado: { select: { valorAprovado: true, orcamento: true } },
        pci: { select: { versao: { select: { parsed: true } } } },
      },
    }),
  ]);
  const vgvDaObra = (o: (typeof obras)[number]) => numero(o.vgv) ?? numero(o.leadVinculado?.valorAprovado) ?? numero(o.leadVinculado?.orcamento);
  const obraDoImovel = new Map(obras.filter((o) => o.imovelId).map((o) => [o.imovelId!, o]));
  const pontosImoveis: PontoMapa[] = imoveis.map((p) => {
    const obra = obraDoImovel.get(p.id);
    const valido = p.latitude !== null && p.longitude !== null && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);
    return {
      key: `imovel-${p.id}`,
      id: p.id,
      kind: "imovel",
      obraId: obra?.id ?? null,
      titulo: p.titulo,
      tipo: p.tipo,
      status: p.status,
      endereco: enderecoCompleto(obra ? [obra.endereco] : [p.rua, p.bairro, p.cidade, p.estado]),
      valor: obra ? vgvDaObra(obra) : p.preco,
      latitude: valido ? p.latitude : null,
      longitude: valido ? p.longitude : null,
      href: obra ? `/admin/obras/${obra.id}` : `/admin/imoveis/${p.slug}`,
    };
  });
  const pontosObras: PontoMapa[] = obras.filter((o) => !o.imovelId).flatMap((o) => {
    const id = (o.pci?.versao.parsed as { identificacao?: { latitude?: unknown; longitude?: unknown } } | null)?.identificacao;
    const ponto = id ? coordenadasDaPci(id.latitude, id.longitude) : null;
    if (!ponto) return [];
    return [{
      key: `obra-${o.id}`,
      id: o.id,
      kind: "obra" as const,
      obraId: o.id,
      titulo: `Obra — ${o.nome}`,
      tipo: "obra",
      status: "obra",
      endereco: enderecoCompleto([o.endereco]),
      valor: vgvDaObra(o),
      latitude: ponto.lat,
      longitude: ponto.lng,
      href: `/admin/obras/${o.id}`,
    }];
  });
  return [...pontosImoveis, ...pontosObras];
}
