/**
 * Gera o anexo (PDF) antes de registrar a solicitação. A reserva impede envios concorrentes.
 * Lote 02, correção 01: a PLS/medição deixou de ser gerada em XLS — só o PDF segue por e-mail.
 * A PCI continua em Excel (fluxo próprio, intocado).
 */
export const DESTINO_MEDICOES = "atendimento@prospectaconstrucoes.com";
export const AVISO_EMAIL = "Solicitação registrada e administrador notificado, mas o e-mail não foi enviado. Use Reenviar e-mail para tentar novamente.";
export type AnexoMedicao = { filename: string; content: Buffer; contentType: string };
type Arquivo = { ok: true; bytes: Uint8Array; nome: string; mime: string } | { ok: false; error: string };
export async function solicitarComAnexos(deps: {
  gerar: (formato: "pdf") => Promise<Arquivo>;
  reservar: () => Promise<boolean>;
  enviar: (anexos: AnexoMedicao[]) => Promise<boolean>;
  concluir: (enviado: boolean) => Promise<void>;
}) {
  const anexos: AnexoMedicao[] = [];
  for (const formato of ["pdf"] as const) {
    const arquivo = await deps.gerar(formato);
    if (!arquivo.ok) throw new Error(arquivo.error);
    anexos.push({ filename: arquivo.nome, content: Buffer.from(arquivo.bytes), contentType: arquivo.mime });
  }
  if (!await deps.reservar()) throw new Error("Esta solicitação já foi enviada ou está sendo processada.");
  let enviado = false;
  try { enviado = await deps.enviar(anexos); } catch { /* Falha persistida para reenvio explícito. */ }
  await deps.concluir(enviado);
  return { aviso: enviado ? undefined : AVISO_EMAIL };
}
