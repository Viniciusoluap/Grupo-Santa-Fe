import "server-only";
import { prisma } from "@/lib/db";
import { enviarParaLixeira } from "@/lib/incorporacao/registro-drive";
import { recusaAindaVisivel } from "@/lib/portal-corretor";

// Item 8 (18/10): exclusão definitiva de imóvel (equipe e corretor dono). O
// imóvel sai do banco (fotos em cascata) e as fotos vão para a lixeira do Drive.
// Se ele tinha sido recusado e foi cadastrado por um corretor, fica um aviso para
// o corretor continuar vendo "Recusado" até 3 dias após a recusa — só o título,
// sem preço nem local. Gêmeo de server/imovel-exclusao.ts da Prospecta.

/** `avisarCorretor`: false quando é o próprio corretor quem exclui. */
export async function excluirImovelDefinitivo(id: string, { avisarCorretor = true } = {}): Promise<{ excluido: boolean }> {
  const imovel = await prisma.imovel.findUnique({
    where: { id },
    select: { titulo: true, cadastradoPorId: true, revisaoStatus: true, revisadoEm: true, atualizadoEm: true },
  });
  if (!imovel) return { excluido: false };
  const fotos = await prisma.imovelFoto.findMany({ where: { imovelId: id }, select: { driveFileId: true } });
  const recusadoEm = imovel.revisadoEm ?? imovel.atualizadoEm;
  const aviso = avisarCorretor && imovel.revisaoStatus === "recusado" && imovel.cadastradoPorId && recusaAindaVisivel(recusadoEm);
  await prisma.$transaction([
    ...(aviso ? [prisma.imovelRecusadoAviso.create({ data: { usuarioId: imovel.cadastradoPorId!, titulo: imovel.titulo, recusadoEm } })] : []),
    prisma.imovel.delete({ where: { id } }),
  ]);
  for (const foto of fotos) if (foto.driveFileId) await enviarParaLixeira(foto.driveFileId).catch(() => undefined);
  return { excluido: true };
}
