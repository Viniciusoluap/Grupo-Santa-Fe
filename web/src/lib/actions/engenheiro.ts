"use server";
// Lote 2, correção 04 (AD-02): perfil Engenheiro e documentos do usuário. Envio e
// download dos arquivos ficam em /api/usuarios/[id]/documentos (partes de 1 MB).
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { acessoDocumentosUsuario, lerCreasAdicionais, podeVisualizarNoNavegador, validarPerfilEngenheiro } from "@/lib/engenheiro";
import { gravarPerfilEngenheiro } from "@/lib/engenheiros";
import { lixeiraDeArquivosSemUso } from "@/lib/drive-organizacao";

async function acessar(usuarioId: string, gerenciar: boolean) {
  const u = await usuarioAtual();
  if (!u || !u.ativo) throw new Error("Não autorizado.");
  const acesso = acessoDocumentosUsuario({ id: u.id, papel: u.perfil, ativo: u.ativo }, usuarioId);
  if (gerenciar ? !acesso.gerenciar : !acesso.ver) throw new Error("Sem permissão para os dados deste usuário.");
  return { u, acesso };
}

/** Perfil + lista de documentos (admin, ou o próprio usuário só para consulta). */
export async function obterPerfilEngenheiro(usuarioId: string) {
  try {
    const { acesso } = await acessar(usuarioId, false);
    const alvo = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true, nome: true, email: true, papel: true, telefone: true, perfilEngenheiro: true,
        documentosUsuario: {
          select: { id: true, categoria: true, nomeOriginal: true, mime: true, tamanho: true, enviadoEm: true, enviadoPor: { select: { nome: true } } },
          orderBy: [{ categoria: "asc" }, { enviadoEm: "desc" }],
        },
      },
    });
    if (!alvo) return { erro: "Usuário não encontrado." };
    const p = alvo.perfilEngenheiro;
    return {
      usuario: { id: alvo.id, nome: alvo.nome, email: alvo.email, papel: alvo.papel },
      podeGerenciar: acesso.gerenciar,
      engenheiro: alvo.papel === "colaborador" && p?.ativo === true,
      perfil: {
        telefone: p?.telefone ?? alvo.telefone ?? null, cep: p?.cep ?? null, logradouro: p?.logradouro ?? null, numero: p?.numero ?? null,
        complemento: p?.complemento ?? null, bairro: p?.bairro ?? null, cidade: p?.cidade ?? null, uf: p?.uf ?? null,
        crea: p?.crea ?? null, creaUf: p?.creaUf ?? null, creasAdicionais: lerCreasAdicionais(p?.creasAdicionais),
      },
      documentos: alvo.documentosUsuario.map((d) => ({
        id: d.id, categoria: d.categoria, nome: d.nomeOriginal, mime: d.mime, tamanho: d.tamanho,
        enviadoEm: d.enviadoEm.toISOString(), enviadoPorNome: d.enviadoPor?.nome ?? null, visualizavel: podeVisualizarNoNavegador(d.mime),
      })),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao carregar o perfil." };
  }
}

export async function salvarPerfilEngenheiro(usuarioId: string, entrada: Record<string, unknown>) {
  try {
    const { u } = await acessar(usuarioId, true);
    const alvo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { papel: true } });
    if (!alvo) return { erro: "Usuário não encontrado." };
    if (alvo.papel !== "colaborador") return { erro: "O perfil Engenheiro é de colaborador. Altere o perfil do usuário para Engenheiro antes." };
    const v = validarPerfilEngenheiro(entrada);
    if (!v.ok) return { erro: v.erro };
    await gravarPerfilEngenheiro(usuarioId, v.dados, u.id);
    revalidatePath("/admin/configuracoes");
    return { ok: true as const };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao salvar." };
  }
}

export async function excluirDocumentoUsuario(usuarioId: string, documentoId: string) {
  try {
    await acessar(usuarioId, true);
    const doc = await prisma.documentoUsuario.findFirst({ where: { id: documentoId, usuarioId }, select: { driveFileId: true } });
    const r = await prisma.documentoUsuario.deleteMany({ where: { id: documentoId, usuarioId } });
    if (!r.count) return { erro: "Documento não encontrado." };
    // Pedido de 29/10: a cópia no Drive vai para a lixeira (depois da exclusão no banco).
    await lixeiraDeArquivosSemUso([doc?.driveFileId]);
    return { ok: true as const };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao excluir." };
  }
}
