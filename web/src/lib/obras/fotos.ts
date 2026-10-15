// EPIC-020 Lote 4 (item 28) — regras das fotos da obra.
// Mesmo arquivo em Prospecta/shared/obra-fotos.ts.
//
// As fotos ficam no próprio banco (sem storage externo) e são servidas por rota
// autenticada. O navegador reduz a imagem antes do envio (ver
// comprimir-imagem.ts) para caber no limite de corpo das funções da Vercel.

export const LIMITE_FOTO_BYTES = 3 * 1024 * 1024;
export const LIMITE_LEGENDA = 300;
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

/** Tipo real pelo conteúdo (assinatura), nunca pela extensão ou pelo que o cliente declarou. */
export function detectarTipoImagem(b: Uint8Array): TipoFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

/** Separa um data URL em base64 ("data:image/jpeg;base64,...."). */
export function lerDataUrl(dataUrl: unknown): string | null {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:[\w.+/-]*;base64,([A-Za-z0-9+/=\s]+)$/);
  return m ? m[1].replace(/\s/g, "") : null;
}

export type ValidacaoFoto = { ok: true; mime: TipoFoto } | { ok: false; erro: string };

export function validarFotoObra(bytes: Uint8Array, legenda: string | null | undefined): ValidacaoFoto {
  if (bytes.length === 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.length > LIMITE_FOTO_BYTES)
    return { ok: false, erro: `A foto ficou com ${(bytes.length / 1024 / 1024).toFixed(1).replace(".", ",")} MB após a compressão; o limite é 3 MB.` };
  const mime = detectarTipoImagem(bytes);
  if (!mime) return { ok: false, erro: "Formato não suportado. Envie JPG, PNG ou WEBP (fotos do iPhone são convertidas automaticamente)." };
  if (legenda && legenda.length > LIMITE_LEGENDA) return { ok: false, erro: `A legenda pode ter até ${LIMITE_LEGENDA} caracteres.` };
  return { ok: true, mime };
}

export interface UsuarioFoto {
  id: number | string;
  papel: string;
  /** Lead do cliente logado no portal (quando houver). */
  leadId?: number | string | null;
  /**
   * Item 06: acesso ao módulo Obras (admin ou colaborador com o módulo liberado,
   * conta ativa), calculado pelo chamador com a regra de shared/perfis-acesso.
   */
  acessoObras?: boolean;
}
export interface ObraFotoDona {
  /** Cliente dono da obra (cadastro antigo) — quando houver. */
  usuarioId?: number | string | null;
  leadId?: number | string | null;
  /** Empreiteiro vinculado à obra (pedido de 15/10: ele cuida das fotos da própria obra). */
  empreiteiroId?: number | string | null;
}

const ehEmpreiteiroDaObra = (u: UsuarioFoto, obra: ObraFotoDona | undefined) =>
  u.papel === "empreiteiro" && obra?.empreiteiroId != null && String(obra.empreiteiroId) === String(u.id);

/**
 * Quem pode VER as fotos: admin, equipe com o módulo Obras e o cliente da obra (portal).
 * Enviar/editar/excluir: admin e equipe com o módulo Obras.
 * O empreiteiro vinculado vê e gerencia as fotos da própria obra.
 */
export function podeVerFotosDaObra(u: UsuarioFoto | null, obra: ObraFotoDona): boolean {
  if (!u) return false;
  if (u.papel === "admin" || u.acessoObras === true) return true;
  if (ehEmpreiteiroDaObra(u, obra)) return true;
  if (obra.usuarioId != null && String(obra.usuarioId) === String(u.id)) return true;
  const cliente = u.papel === "cliente" || u.papel === "user";
  return cliente && u.leadId != null && obra.leadId != null && String(u.leadId) === String(obra.leadId);
}

export function podeGerenciarFotos(u: UsuarioFoto | null, obra?: ObraFotoDona): boolean {
  if (!u) return false;
  return u.papel === "admin" || u.acessoObras === true || ehEmpreiteiroDaObra(u, obra);
}
