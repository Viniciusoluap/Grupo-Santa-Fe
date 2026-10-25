import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Criptografia de segredos guardados no banco (AES-256-GCM), mesmo formato do
// `server/_core/secret-vault.ts` da Prospecta. A chave deriva do AUTH_SECRET.
function chave(): Buffer {
  const base = process.env.AUTH_SECRET;
  if (!base) throw new Error("AUTH_SECRET é necessário para proteger segredos.");
  return createHash("sha256").update(base).digest();
}

export function criptografarSegredo(valor: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(valor, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), dados].map((p) => p.toString("base64url")).join(".");
}

// Pedido de 25/10 (gêmeo da Prospecta): credenciais gravadas pela equipe direto no banco
// (sem acesso à chave do servidor) entram como "plain:<valor>" e são recriptografadas no 1º uso.
const TEXTO_PURO = "plain:";
export function segredoEmTextoPuro(valor: string | null | undefined): boolean {
  return Boolean(valor?.startsWith(TEXTO_PURO));
}

export function descriptografarSegredo(valor: string): string {
  if (valor.startsWith(TEXTO_PURO)) return valor.slice(TEXTO_PURO.length);
  const [iv, tag, dados] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !dados) throw new Error("Segredo criptografado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
}
