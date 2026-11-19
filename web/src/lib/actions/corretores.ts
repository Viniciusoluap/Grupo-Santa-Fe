"use server";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Paridade 17/11 (EPIC-023 S-A da Prospecta): a tela "Corretores" foi unificada em "Usuários e acesso" e o
// cadastro de corretores fica só com o admin (decisão do dono em 15/11). Criar e editar corretor passaram para
// `criarUsuario` e `salvarDadosCorretor` (src/lib/actions/usuarios.ts); aqui fica só a exclusão.
export async function excluirCorretor(id: string) {
  await exigirAdminAtivo();
  const corretor = await prisma.corretor.findUnique({ where: { id }, select: { usuarioId: true } });
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.visita.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.comissao.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.financiamento.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.imovel.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.corretor.delete({ where: { id } }),
    // Remove tambem o acesso de login vinculado - um corretor excluido nao deveria
    // continuar conseguindo entrar no sistema (antes, os dois registros eram
    // completamente desligados e o Usuario sobrevivia por conta propria).
    ...(corretor?.usuarioId ? [prisma.usuario.delete({ where: { id: corretor.usuarioId } })] : []),
  ]);
  // Pedido de 29/10: pasta Equipe/<Nome (nº)> do acesso excluído → lixeira do Drive.
  if (corretor?.usuarioId) {
    const { lixeiraDaPasta } = await import("@/lib/drive-organizacao");
    const { chaveEquipe } = await import("@/lib/drive-estrutura");
    await lixeiraDaPasta(chaveEquipe(corretor.usuarioId));
  }
  revalidatePath("/admin/configuracoes");
}
