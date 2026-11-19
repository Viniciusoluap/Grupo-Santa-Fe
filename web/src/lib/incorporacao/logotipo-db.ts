// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02 (`server/incorporacao-logo-router.ts`): logotipo de cada
// empreendimento na tabela `estudos_incorporacao_logos` (migração 20261117220000). Nunca na linha do estudo. O original
// sobe em partes (`documento_upload_partes`, tipo "inc-logo", item = estudo); o PNG de exibição vai no pedido final e é o
// único servido aos cartões pela rota `/api/incorporacao/logo/[id]`.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { limparPartes, montarPartes } from "@/lib/documentos-upload-partes";
import {
  LADO_EXIBICAO, LIMITE_EXIBICAO_BYTES, LIMITE_LOGO_BYTES, MENSAGEM_LOGO_PDF, TIPOS_LOGO_ENVIO, dimensoesDoPng, ehPng, tipoDoLogo, tipoPelaExtensao,
} from "./logotipo";

export const TIPO_PARTES_LOGO = "inc-logo";
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const nomeSeguro = (nome: string) => nome.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").slice(0, 200) || "logotipo";

const META = {
  id: true, estudoId: true, mime: true, nome: true, origem: true, tamanho: true, sha256: true,
  exibicaoSha256: true, largura: true, altura: true, criadoEm: true,
} as const;

/** Metadados do logotipo ativo (sem bytes). `versao` = hash do PNG de exibição (vai na URL da imagem). */
export async function logoAtivo(estudoId: string) {
  const l = await prisma.estudoLogotipo.findFirst({ where: { estudoId, excluidoEm: null }, orderBy: { criadoEm: "desc" }, select: META });
  if (!l) return null;
  const { exibicaoSha256, ...resto } = l;
  return { ...resto, versao: exibicaoSha256 };
}

/** Bytes do logotipo ativo para as rotas de imagem/download (`exibicao` ou `original`). */
export async function bytesDoLogo(estudoId: string, qual: "exibicao" | "original") {
  const l = await prisma.estudoLogotipo.findFirst({
    where: { estudoId, excluidoEm: null }, orderBy: { criadoEm: "desc" },
    select: { exibicaoPng: qual === "exibicao", original: qual === "original", exibicaoSha256: true, sha256: true, mime: true, nome: true },
  });
  if (!l) return null;
  const dados = qual === "exibicao" ? l.exibicaoPng : l.original;
  return { dados: Buffer.from(dados ?? new Uint8Array()), etag: qual === "exibicao" ? l.exibicaoSha256 : l.sha256, mime: l.mime, nome: l.nome };
}

/**
 * Versão (hash do PNG) dos logotipos ativos, para os cartões da listagem — sem bytes. Sem a tabela (migração ainda
 * não aplicada) devolve lista vazia: a listagem nunca quebra por causa do logotipo.
 */
export async function versoesDosLogos(): Promise<{ estudoId: string; versao: string; largura: number | null; altura: number | null }[]> {
  try {
    const linhas = await prisma.estudoLogotipo.findMany({
      where: { excluidoEm: null }, orderBy: { criadoEm: "asc" },
      select: { estudoId: true, exibicaoSha256: true, largura: true, altura: true },
    });
    return linhas.map((l) => ({ estudoId: l.estudoId, versao: l.exibicaoSha256, largura: l.largura, altura: l.altura }));
  } catch (e) {
    console.warn("[incorporacao-logo] logotipos indisponíveis na listagem:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface EntradaSalvarLogo {
  uploadId: string;
  nome: string;
  exibicaoBase64: string;
  largura: number;
  altura: number;
}

/** Confere o envio e grava (ou troca) o logotipo do estudo. O anterior fica marcado como excluído. */
export async function salvarLogoDoEnvio(estudoId: string, usuarioId: string, input: EntradaSalvarLogo) {
  if (typeof input.nome !== "string" || !input.nome || input.nome.length > 255) throw new Error("Nome de arquivo inválido.");
  if (typeof input.exibicaoBase64 !== "string" || input.exibicaoBase64.length < 8 || input.exibicaoBase64.length > Math.ceil(LIMITE_EXIBICAO_BYTES / 3) * 4 + 4)
    throw new Error(`A imagem de exibição precisa ser um PNG válido de até 1,5 MB e ${LADO_EXIBICAO} px de lado.`);
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true } });
  if (!estudo) throw new Error("Estudo não encontrado.");
  let original: Buffer;
  try {
    original = (await montarPartes(input.uploadId, usuarioId, TIPO_PARTES_LOGO, estudoId)).bytes;
  } finally {
    await limparPartes(input.uploadId, usuarioId, TIPO_PARTES_LOGO, estudoId).catch(() => undefined);
  }
  if (original.length > LIMITE_LOGO_BYTES) throw new Error("Logotipo acima de 10 MB.");
  const mime = tipoDoLogo(original);
  if (!mime) throw new Error("O arquivo não é PNG, JPG, SVG ou PDF válido.");
  if (!TIPOS_LOGO_ENVIO.includes(mime)) throw new Error(MENSAGEM_LOGO_PDF);
  const esperado = tipoPelaExtensao(input.nome);
  if (esperado && esperado !== mime) throw new Error("O conteúdo do arquivo não corresponde à extensão.");
  const exibicao = Buffer.from(input.exibicaoBase64, "base64");
  // As medidas valem as do próprio PNG (cabeçalho IHDR), não as que o navegador declarou.
  const medidas = exibicao.length <= LIMITE_EXIBICAO_BYTES ? dimensoesDoPng(exibicao) : null;
  if (!ehPng(exibicao) || !medidas || medidas.largura > LADO_EXIBICAO || medidas.altura > LADO_EXIBICAO)
    throw new Error(`A imagem de exibição precisa ser um PNG válido de até 1,5 MB e ${LADO_EXIBICAO} px de lado.`);
  // Troca numa transação só: dois envios ao mesmo tempo não podem arquivar o logotipo um do outro e deixar o
  // empreendimento sem nenhum (o último a gravar fica ativo).
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS travado FROM pg_advisory_xact_lock(hashtext(${`incorporacao-logo:${estudoId}`}))`;
    await tx.estudoLogotipo.updateMany({ where: { estudoId, excluidoEm: null }, data: { excluidoEm: new Date() } });
    await tx.estudoLogotipo.create({
      data: {
        estudoId, mime, nome: nomeSeguro(input.nome), origem: "envio", sha256: sha256(original), tamanho: original.length,
        original: new Uint8Array(original), exibicaoPng: new Uint8Array(exibicao), exibicaoSha256: sha256(exibicao),
        largura: medidas.largura, altura: medidas.altura, enviadoPorId: usuarioId,
      },
    });
  });
  return logoAtivo(estudoId);
}

export async function excluirLogoDoEstudo(estudoId: string) {
  await prisma.estudoLogotipo.updateMany({ where: { estudoId, excluidoEm: null }, data: { excluidoEm: new Date() } });
  return { ok: true as const };
}
