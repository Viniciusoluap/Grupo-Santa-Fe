import "server-only";
import { prisma } from "@/lib/db";
import { recusaAindaVisivel } from "@/lib/portal-corretor";
import { lerFotos } from "@/lib/imovel-fotos";

// Portal do Corretor (pedido de 18/10, igual à Prospecta: server/broker-portal-router.ts).
// Catálogo = imóveis aprovados + os cadastros do próprio corretor. O recusado
// aparece por 3 dias e depois some; recusado excluído pela equipe continua como
// aviso (só título e "Recusado", sem preço nem local) até completar os 3 dias.

export type ImovelDoPortal = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  preco: number;
  area: number;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string;
  cidade: string;
  estado: string;
  rua: string;
  fotos: string[];
  revisaoStatus: string;
  meuCadastro: boolean;
  excluido: boolean;
};

export async function imoveisDoPortal(usuarioId: string, agora: Date = new Date()): Promise<ImovelDoPortal[]> {
  const [linhas, avisos] = await Promise.all([
    prisma.imovel.findMany({
      where: { OR: [{ revisaoStatus: "aprovado" }, { cadastradoPorId: usuarioId }] },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true, titulo: true, descricao: true, tipo: true, preco: true, area: true, quartos: true, banheiros: true,
        vagas: true, bairro: true, cidade: true, estado: true, rua: true, imagens: true, revisaoStatus: true,
        revisadoEm: true, atualizadoEm: true, cadastradoPorId: true,
      },
    }),
    prisma.imovelRecusadoAviso.findMany({ where: { usuarioId }, orderBy: { recusadoEm: "desc" } }),
  ]);
  const visiveis = linhas.filter((l) => l.revisaoStatus !== "recusado" || recusaAindaVisivel(l.revisadoEm ?? l.atualizadoEm, agora));
  return [
    ...avisos
      .filter((a) => recusaAindaVisivel(a.recusadoEm, agora))
      .map((a) => ({
        id: `aviso-${a.id}`, titulo: a.titulo, descricao: "", tipo: "", preco: 0, area: 0, quartos: null, banheiros: null,
        vagas: null, bairro: "", cidade: "", estado: "", rua: "", fotos: [], revisaoStatus: "recusado", meuCadastro: true, excluido: true,
      })),
    ...visiveis.map((l) => ({
      id: l.id, titulo: l.titulo, descricao: l.descricao, tipo: l.tipo, preco: l.preco, area: l.area, quartos: l.quartos,
      banheiros: l.banheiros, vagas: l.vagas, bairro: l.bairro, cidade: l.cidade, estado: l.estado, rua: l.rua,
      fotos: lerFotos(l.imagens), revisaoStatus: l.revisaoStatus, meuCadastro: l.cadastradoPorId === usuarioId, excluido: false,
    })),
  ];
}

/** Comissões cadastradas para o corretor (beneficiário corretor), por vencimento. */
export async function comissoesDoPortal(corretorId: string | null) {
  if (!corretorId) return [];
  return prisma.comissao.findMany({
    where: { corretorId, beneficiario: "corretor" },
    orderBy: { vencimento: "asc" },
    select: { id: true, imovel: true, valor: true, status: true, vencimento: true },
  });
}
