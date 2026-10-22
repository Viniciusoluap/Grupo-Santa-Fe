import { prisma } from "@/lib/db";
import { LIMITE_DOCUMENTO_BYTES, PARTE_DOCUMENTO_BYTES } from "./documentos-upload-partes-limites";

export { LIMITE_DOCUMENTO_BYTES, PARTE_DOCUMENTO_BYTES };
export const MAX_PARTES_DOCUMENTO = LIMITE_DOCUMENTO_BYTES / PARTE_DOCUMENTO_BYTES;

let ready: Promise<void> | undefined;
async function tabela() {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS documento_upload_partes (
      upload_id varchar(64) NOT NULL, parte integer NOT NULL CHECK (parte >= 0 AND parte < 20),
      total integer NOT NULL CHECK (total >= 1 AND total <= 20), usuario_id text NOT NULL,
      tipo varchar(20) NOT NULL, item_id text NOT NULL, nome varchar(255) NOT NULL,
      dados bytea NOT NULL CHECK (octet_length(dados) > 0 AND octet_length(dados) <= 1048576),
      criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (upload_id, parte))`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS documento_upload_partes_expira ON documento_upload_partes(criado_em)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE documento_upload_partes ENABLE ROW LEVEL SECURITY`);
  })().catch(error => { ready = undefined; throw error; });
  await ready;
}

export function validarParte(entrada: Record<string, unknown>) {
  const { uploadId, parte, total, nome, chunk } = entrada;
  if (typeof uploadId !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(uploadId)) throw new Error("Identificador inválido.");
  if (!Number.isInteger(total) || Number(total) < 1 || Number(total) > MAX_PARTES_DOCUMENTO || !Number.isInteger(parte) || Number(parte) < 0 || Number(parte) >= Number(total)) throw new Error("Parte inválida.");
  if (typeof nome !== "string" || !nome || nome.length > 255 || /[\\/\x00-\x1f]/.test(nome)) throw new Error("Nome de arquivo inválido.");
  if (typeof chunk !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(chunk) || chunk.length > Math.ceil(PARTE_DOCUMENTO_BYTES / 3) * 4) throw new Error("Parte inválida.");
  const bytes = Buffer.from(chunk, "base64");
  if (!bytes.length || bytes.length > PARTE_DOCUMENTO_BYTES) throw new Error("Parte inválida.");
  return { uploadId, parte: Number(parte), total: Number(total), nome, chunk };
}

export async function guardarParte(entrada: Record<string, unknown>, usuarioId: string, tipo: string, itemId: string) {
  const parte = validarParte(entrada);
  await tabela();
  await prisma.$executeRaw`DELETE FROM documento_upload_partes WHERE criado_em < now() - interval '30 minutes'`;
  const rows = await prisma.$queryRaw<{ parte: number }[]>`INSERT INTO documento_upload_partes
    (upload_id, parte, total, usuario_id, tipo, item_id, nome, dados)
    VALUES (${parte.uploadId}, ${parte.parte}, ${parte.total}, ${usuarioId}, ${tipo}, ${itemId}, ${parte.nome}, decode(${parte.chunk}, 'base64'))
    ON CONFLICT(upload_id, parte) DO UPDATE SET dados = EXCLUDED.dados
    WHERE documento_upload_partes.usuario_id = EXCLUDED.usuario_id AND documento_upload_partes.tipo = EXCLUDED.tipo
      AND documento_upload_partes.item_id = EXCLUDED.item_id AND documento_upload_partes.nome = EXCLUDED.nome
      AND documento_upload_partes.total = EXCLUDED.total RETURNING parte`;
  if (!rows.length) throw new Error("Envio pertence a outro item ou usuário.");
}

export async function montarPartes(uploadId: string, usuarioId: string, tipo: string, itemId: string) {
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(uploadId)) throw new Error("Identificador inválido.");
  await tabela();
  const rows = await prisma.$queryRaw<{ parte: number; total: number; nome: string; dados: Buffer }[]>`
    SELECT parte, total, nome, dados FROM documento_upload_partes
    WHERE upload_id = ${uploadId} AND usuario_id = ${usuarioId} AND tipo = ${tipo} AND item_id = ${itemId}
      AND criado_em > now() - interval '30 minutes' ORDER BY parte`;
  if (!rows.length || rows.length !== rows[0].total || rows.length > MAX_PARTES_DOCUMENTO || rows.some((row, i) => row.parte !== i || row.total !== rows.length || row.nome !== rows[0].nome)) throw new Error("Envio incompleto. Tente novamente.");
  const bytes = Buffer.concat(rows.map(row => row.dados));
  if (!bytes.length || bytes.length > LIMITE_DOCUMENTO_BYTES) throw new Error("Envie um arquivo de até 20 MiB.");
  return { nome: rows[0].nome, bytes };
}

export async function limparPartes(uploadId: string, usuarioId: string, tipo: string, itemId: string) {
  await prisma.$executeRaw`DELETE FROM documento_upload_partes WHERE upload_id = ${uploadId} AND usuario_id = ${usuarioId} AND tipo = ${tipo} AND item_id = ${itemId}`;
}
