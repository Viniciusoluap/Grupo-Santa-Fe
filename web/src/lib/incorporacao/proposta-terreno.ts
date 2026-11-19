// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-06 (`server/incorporacao-proposta-router.ts`): proposta formal de
// aquisição do terreno: PDF para baixar e envio por e-mail com o MESMO PDF. O PDF é sempre montado no servidor pelo
// gerador único (`proposta-terreno-pdf.ts`) a partir do que está gravado na negociação; os envios ficam em
// `estudos_incorporacao_propostas_envios` (fora do JSON que a aba reescreve). Enviar NÃO muda a situação da proposta.
// E-mail: o `sendEmail` (SMTP) que o Santa Fé já usa.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { parseNegociacao } from "./negociacao";
import { dimensoesDoPng } from "./logotipo";
import { bytesDoLogo } from "./logotipo-db";
import { EMPRESA_PROPONENTE, dataBr, gerarPdfPropostaTerreno, nomeArquivoProposta, type DadosPropostaTerreno } from "./proposta-terreno-pdf";

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Hoje em Brasília (AAAA-MM-DD). */
export function hojeBrasil(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** A emissão é a data de hoje (ou de até 2 dias atrás: prévia aberta na véspera); nunca no futuro. */
export function conferirEmissao(data: string | undefined, agora = new Date()): string {
  const hoje = hojeBrasil(agora);
  if (!data) return hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data de emissão inválida. Gere a prévia de novo.");
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${data}T00:00:00Z`)) / 86_400_000;
  if (!(dias >= 0 && dias <= 2)) throw new Error("Data de emissão inválida. Gere a prévia de novo.");
  return data;
}

/** Mesma regra do zod `email()` da Prospecta para o destinatário (aparado e em minúsculas). */
export function normalizarDestinatario(v: unknown): string {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!e || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new Error("E-mail do destinatário inválido.");
  return e;
}

type Usuario = { id: string; nome?: string | null };

/** Logotipo do empreendimento no cabeçalho; PNG inválido fica de fora (a proposta sai sem ele, nunca dá erro). */
function logoDaProposta(png: Uint8Array | undefined | null) {
  const medidas = png ? dimensoesDoPng(png) : null;
  return png && medidas ? { png, ...medidas } : null;
}

/** Monta os dados e o PDF da proposta gravada. Mesma entrada → mesmos bytes (download = anexo). */
export async function montarPdfProposta(estudoId: string, propostaId: string, dataEmissao: string, usuario: Usuario) {
  if (typeof propostaId !== "string" || !propostaId || propostaId.length > 80) throw new Error("Proposta não encontrada — salve a negociação e tente de novo.");
  const estudo = await prisma.estudoIncorporacao.findUnique({
    where: { id: estudoId },
    select: { nome: true, municipio: true, estado: true, endereco: true, tipoIncorporacao: true, areaM2: true, matriculaImovel: true, negociacaoTerrenoJson: true },
  });
  if (!estudo) throw new Error("Estudo não encontrado.");
  const negociacao = parseNegociacao(estudo.negociacaoTerrenoJson ?? null);
  const proposta = negociacao?.propostas.find((p) => p.id === propostaId);
  if (!negociacao || !proposta) throw new Error("Proposta não encontrada — salve a negociação e tente de novo.");
  if (proposta.autor !== "grupo_santa_fe")
    throw new Error("Esta proposta foi registrada como do proprietário. O PDF formal é emitido só para propostas do Grupo Santa Fé.");
  const logo = await bytesDoLogo(estudoId, "exibicao").catch(() => null);
  const dados: DadosPropostaTerreno = {
    empreendimento: { nome: estudo.nome, cidade: estudo.municipio, uf: estudo.estado, endereco: estudo.endereco, tipo: estudo.tipoIncorporacao },
    terreno: { areaM2: Number.isFinite(estudo.areaM2) ? estudo.areaM2 : null, matricula: estudo.matriculaImovel },
    proprietario: { nome: negociacao.proprietarioNome, contato: negociacao.proprietarioContato, email: negociacao.proprietarioEmail },
    proposta,
    proponente: { empresa: EMPRESA_PROPONENTE, responsavel: usuario.nome ?? null },
    dataEmissao,
    logoEmpreendimento: logoDaProposta(logo?.dados),
  };
  const pdf = gerarPdfPropostaTerreno(dados);
  return { pdf, dados, nomeArquivo: nomeArquivoProposta(dados), sha256: sha256(pdf) };
}

export function emailDaProposta(d: DadosPropostaTerreno) {
  const nome = (d.proprietario.nome ?? "").trim();
  return {
    subject: `Proposta de aquisição do terreno — ${d.empreendimento.nome}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1A2332">
<p>${nome ? `Prezado(a) ${escapar(nome)},` : "Prezado(a),"}</p>
<p>Encaminhamos em anexo a proposta formal de aquisição do terreno referente ao empreendimento
<strong>${escapar(d.empreendimento.nome)}</strong>, emitida em ${dataBr(d.dataEmissao)}.</p>
<p>Permanecemos à disposição para esclarecimentos.</p>
<p>Atenciosamente,<br>${escapar(d.proponente.empresa)}${d.proponente.responsavel ? `<br>${escapar(d.proponente.responsavel)}` : ""}</p>
</body></html>`,
  };
}

/** PDF para baixar (e prévia antes do envio). */
export async function pdfDaPropostaTerreno(estudoId: string, propostaId: string, usuario: Usuario, dataEmissaoPedida?: string) {
  const dataEmissao = conferirEmissao(dataEmissaoPedida);
  const r = await montarPdfProposta(estudoId, propostaId, dataEmissao, usuario);
  return { base64: Buffer.from(r.pdf).toString("base64"), nomeArquivo: r.nomeArquivo, dataEmissao, sha256: r.sha256 };
}

export const ERRO_PROPOSTA_MUDOU = "A proposta mudou desde a prévia; gere a prévia de novo.";

/**
 * Revisão do PR #263: o anexo tem de ser o PDF que a pessoa conferiu. A prévia devolve o `sha256` do PDF gerado no
 * servidor; a confirmação manda esse hash de volta e o servidor recusa se o PDF gerado agora for outro (a negociação
 * mudou depois da prévia). Hash ausente ou malformado também recusa. Nada é enviado nem registrado nesse caso (como as
 * demais validações de entrada, que também não gravam envio).
 */
export function conferirPdfDaPrevia(pdfSha256Previa: unknown, pdfSha256Atual: string) {
  if (typeof pdfSha256Previa !== "string" || !/^[0-9a-f]{64}$/.test(pdfSha256Previa) || pdfSha256Previa !== pdfSha256Atual)
    throw new Error(ERRO_PROPOSTA_MUDOU);
}

/** Envia o PDF (o mesmo da prévia: mesma data de emissão e mesmo hash) e registra data, destinatário e situação. */
export async function enviarPropostaTerrenoPorEmail(
  estudoId: string, propostaId: string, destinatarioBruto: unknown, usuario: Usuario, dataEmissaoPedida: string | undefined,
  pdfSha256Previa: unknown, enviar: typeof sendEmail = sendEmail,
) {
  const destinatario = normalizarDestinatario(destinatarioBruto);
  const dataEmissao = conferirEmissao(dataEmissaoPedida);
  const r = await montarPdfProposta(estudoId, propostaId, dataEmissao, usuario);
  conferirPdfDaPrevia(pdfSha256Previa, r.sha256);
  const { subject, html } = emailDaProposta(r.dados);
  const smtpConfigurado = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const ok = await enviar({ to: destinatario, subject, html, attachments: [{ filename: r.nomeArquivo, content: Buffer.from(r.pdf), contentType: "application/pdf" }] });
  const motivo = ok ? null : smtpConfigurado
    ? "O servidor de e-mail recusou o envio. Tente de novo."
    : "Servidor de e-mail (SMTP) não configurado. Baixe o PDF e envie por outro meio.";
  const envio = await prisma.estudoPropostaEnvio.create({
    data: {
      estudoId, propostaId, destinatario, status: ok ? "enviado" : "falhou", motivo, dataEmissao, pdfSha256: r.sha256,
      enviadoPorId: usuario.id, enviadoPorNome: usuario.nome ?? null,
    },
  });
  return { ok, motivo, envio: { ...envio, criadoEm: envio.criadoEm.toISOString() } };
}

/** Envios do estudo, do mais recente para o mais antigo. Sem a tabela (migração não aplicada): lista vazia. */
export async function enviosDasPropostasTerreno(estudoId: string) {
  try {
    const linhas = await prisma.estudoPropostaEnvio.findMany({ where: { estudoId }, orderBy: { criadoEm: "desc" } });
    return linhas.map((e) => ({ ...e, criadoEm: e.criadoEm.toISOString() }));
  } catch (e) {
    console.warn("[proposta-terreno] envios indisponíveis:", e instanceof Error ? e.message : e);
    return [];
  }
}
