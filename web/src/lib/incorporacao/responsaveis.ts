import "server-only";
import { prisma } from "@/lib/db";

// Correção 08 (Lote 2): o responsável do estudo é um usuário ativo com papel
// admin ou colaborador. Engenheiro = colaborador com perfil de engenheiro ativo
// (AD-02) e aparece com essa etiqueta.
export interface ResponsavelOpcao {
  id: string;
  nome: string;
  papel: string;
  engenheiro: boolean;
  ativo: boolean;
}

/** Usuários elegíveis + o responsável atual (mesmo inativo), para não sumir da tela. */
export async function listarResponsaveisEstudo(atualId?: string | null): Promise<ResponsavelOpcao[]> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      OR: [
        { ativo: true, papel: { in: ["admin", "colaborador"] } },
        ...(atualId ? [{ id: atualId }] : []),
      ],
    },
    select: { id: true, nome: true, papel: true, ativo: true, perfilEngenheiro: { select: { ativo: true } } },
    orderBy: { nome: "asc" },
  });
  return usuarios.map((u) => ({ id: u.id, nome: u.nome, papel: u.papel, ativo: u.ativo, engenheiro: u.perfilEngenheiro?.ativo === true }));
}
