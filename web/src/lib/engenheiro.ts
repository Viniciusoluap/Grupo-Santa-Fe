// Correção 04 (lote 2, AD-02): perfil Engenheiro = colaborador + dados profissionais.
// Regras puras (sem banco) compartilhadas por servidor e tela. Mesma regra no
// Prospecta em shared/engenheiro.ts.
import { zipSync } from "fflate";
import { formatCPF, validateCPF } from "./cpf";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type Uf = (typeof UFS)[number];
export const ehUf = (v: unknown): v is Uf => typeof v === "string" && (UFS as readonly string[]).includes(v);

export const CATEGORIAS_DOCUMENTO_USUARIO = ["documento_pessoal", "anuidade_crea", "carteirinha_crea", "outros"] as const;
export type CategoriaDocumentoUsuario = (typeof CATEGORIAS_DOCUMENTO_USUARIO)[number];
export const ROTULO_CATEGORIA_DOCUMENTO: Record<CategoriaDocumentoUsuario, string> = {
  documento_pessoal: "Documento pessoal",
  anuidade_crea: "Anuidade CREA",
  carteirinha_crea: "Carteirinha CREA",
  outros: "Outros",
};
export const ehCategoriaDocumento = (v: unknown): v is CategoriaDocumentoUsuario =>
  typeof v === "string" && (CATEGORIAS_DOCUMENTO_USUARIO as readonly string[]).includes(v);

/** 15 MB por arquivo (enviado e baixado em partes de 1 MB por causa do limite da Vercel). */
export const LIMITE_DOCUMENTO_USUARIO_BYTES = 15 * 1024 * 1024;
export const PARTE_DOCUMENTO_USUARIO_BYTES = 1024 * 1024;

/** Extensões aceitas → MIME gravado (o MIME do navegador não é confiável). */
export const TIPOS_DOCUMENTO_USUARIO: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const ACCEPT_DOCUMENTO_USUARIO = Object.keys(TIPOS_DOCUMENTO_USUARIO).map(e => `.${e}`).join(",");
/** Só PDF e imagem abrem no navegador; o resto é sempre baixado. */
const VISUALIZAVEIS = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const podeVisualizarNoNavegador = (mime: string) => VISUALIZAVEIS.has(mime);

export function nomeArquivoSeguro(nome: string): string {
  const limpo = String(nome ?? "").replace(/[\\/\x00-\x1f\x7f]/g, "_").replace(/^\.+/, "").trim();
  return (limpo || "documento").slice(0, 255);
}

/** Valida nome + bytes do arquivo e devolve o MIME a gravar. */
export function validarArquivoDocumento(nome: string, bytes: Uint8Array): { ok: true; mime: string; nome: string } | { ok: false; erro: string } {
  const seguro = nomeArquivoSeguro(nome);
  const ext = seguro.includes(".") ? seguro.split(".").pop()!.toLowerCase() : "";
  const mime = TIPOS_DOCUMENTO_USUARIO[ext];
  if (!mime) return { ok: false, erro: "Envie PDF, JPG, PNG, WEBP, DOC, DOCX, XLS ou XLSX." };
  if (!bytes.length) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.length > LIMITE_DOCUMENTO_USUARIO_BYTES) return { ok: false, erro: "Envie arquivos de até 15 MB." };
  const b = bytes;
  const confere =
    mime === "application/pdf" ? b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
    : mime === "image/jpeg" ? b[0] === 0xff && b[1] === 0xd8
    : mime === "image/png" ? b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    : mime === "image/webp" ? b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45
    : ext === "docx" || ext === "xlsx" ? b[0] === 0x50 && b[1] === 0x4b
    : b[0] === 0xd0 && b[1] === 0xcf; // .doc/.xls (OLE)
  if (!confere) return { ok: false, erro: "O conteúdo do arquivo não corresponde ao formato informado." };
  return { ok: true, mime, nome: seguro };
}

/** Content-Disposition com o nome original (ASCII + UTF-8). */
export function contentDisposition(nome: string, inline: boolean): string {
  const seguro = nomeArquivoSeguro(nome);
  const ascii = seguro.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(seguro)}`;
}

// ─── CREA ────────────────────────────────────────────────────────────────────

export type CreaAdicional = { numero: string; uf: Uf };

/** Número do CREA: dígitos com separadores usuais (ex.: 1234567890, 12345/D, 123.456-7). */
export function normalizarNumeroCrea(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().toUpperCase().replace(/\s+/g, "");
  if (!v) return null;
  if (v.length > 30 || !/^[0-9A-Z./-]+$/.test(v) || (v.match(/\d/g)?.length ?? 0) < 3) return null;
  return v;
}

export const formatarCrea = (numero: string | null | undefined, uf: string | null | undefined) =>
  numero ? `CREA${uf ? `-${uf}` : ""} ${numero}` : "";

/**
 * Ao trocar o engenheiro escolhido, a habilitação técnica segue o CREA do novo
 * perfil. Sem CREA no perfil, não inventa: limpa só se o texto atual era o CREA
 * preenchido automaticamente do engenheiro anterior; senão mantém o digitado.
 */
export function creaAoTrocarEngenheiro(
  atual: string,
  anterior: { crea: string | null; creaUf: string | null } | null | undefined,
  novo: { crea: string | null; creaUf: string | null } | null | undefined,
): string {
  if (novo?.crea) return formatarCrea(novo.crea, novo.creaUf);
  const automatico = anterior?.crea ? formatarCrea(anterior.crea, anterior.creaUf) : "";
  return automatico && atual.trim() === automatico ? "" : atual;
}

// ─── Perfil ──────────────────────────────────────────────────────────────────

export type PerfilEngenheiroDados = {
  /** Ausente preserva o valor gravado; null limpa explicitamente. */
  cpf?: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: Uf | null;
  crea: string | null;
  creaUf: Uf | null;
  creasAdicionais: CreaAdicional[];
};

const texto = (v: unknown, max: number) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

/** Valida e normaliza o formulário do perfil. Campos vazios ficam null (nada é inventado). */
export function validarPerfilEngenheiro(entrada: Record<string, unknown>): { ok: true; dados: PerfilEngenheiroDados } | { ok: false; erro: string } {
  let cpf: string | null | undefined;
  if (entrada.cpf !== undefined) {
    if (entrada.cpf !== null && typeof entrada.cpf !== "string") return { ok: false, erro: "CPF inválido." };
    const bruto = (entrada.cpf as string | null)?.trim() ?? "";
    if (bruto) {
      if (!/^[0-9.\-\s]+$/.test(bruto) || !validateCPF(bruto).valid) return { ok: false, erro: "CPF inválido. Confira os 11 dígitos." };
      cpf = formatCPF(bruto);
    } else cpf = null;
  }
  const telefone = texto(entrada.telefone, 20);
  if (telefone && !/^[0-9()+\-.\s]{8,20}$/.test(telefone)) return { ok: false, erro: "Telefone inválido." };
  const cepBruto = texto(entrada.cep, 12);
  let cep: string | null = null;
  if (cepBruto) {
    const d = cepBruto.replace(/\D/g, "");
    if (d.length !== 8) return { ok: false, erro: "CEP deve ter 8 dígitos." };
    cep = `${d.slice(0, 5)}-${d.slice(5)}`;
  }
  const ufBruta = texto(entrada.uf, 2)?.toUpperCase() ?? null;
  if (ufBruta && !ehUf(ufBruta)) return { ok: false, erro: "UF do endereço inválida." };

  const creaBruto = texto(entrada.crea, 40);
  const crea = creaBruto ? normalizarNumeroCrea(creaBruto) : null;
  if (creaBruto && !crea) return { ok: false, erro: "Número do CREA inválido." };
  const creaUfBruta = texto(entrada.creaUf, 2)?.toUpperCase() ?? null;
  if (creaUfBruta && !ehUf(creaUfBruta)) return { ok: false, erro: "UF do CREA inválida." };
  if (crea && !creaUfBruta) return { ok: false, erro: "Informe a UF do CREA." };
  if (!crea && creaUfBruta) return { ok: false, erro: "Informe o número do CREA." };

  const lista = Array.isArray(entrada.creasAdicionais) ? entrada.creasAdicionais : [];
  if (lista.length > UFS.length) return { ok: false, erro: "CREAs adicionais demais." };
  const creasAdicionais: CreaAdicional[] = [];
  for (const item of lista) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const numBruto = texto(obj.numero, 40);
    const ufItem = texto(obj.uf, 2)?.toUpperCase() ?? null;
    if (!numBruto && !ufItem) continue; // linha em branco
    const numero = numBruto ? normalizarNumeroCrea(numBruto) : null;
    if (!numero) return { ok: false, erro: "Número de CREA adicional inválido." };
    if (!ehUf(ufItem)) return { ok: false, erro: "UF de CREA adicional inválida." };
    if (!crea) return { ok: false, erro: "Informe o CREA principal antes dos adicionais." };
    if (ufItem === creaUfBruta) return { ok: false, erro: `O CREA adicional deve ser de outro estado (o principal já é ${ufItem}).` };
    if (creasAdicionais.some(c => c.uf === ufItem)) return { ok: false, erro: `CREA de ${ufItem} informado mais de uma vez.` };
    creasAdicionais.push({ numero, uf: ufItem });
  }

  return {
    ok: true,
    dados: {
      ...(cpf !== undefined ? { cpf } : {}),
      telefone,
      cep,
      logradouro: texto(entrada.logradouro, 255),
      numero: texto(entrada.numero, 20),
      complemento: texto(entrada.complemento, 120),
      bairro: texto(entrada.bairro, 120),
      cidade: texto(entrada.cidade, 120),
      uf: (ufBruta as Uf | null) ?? null,
      crea,
      creaUf: (creaUfBruta as Uf | null) ?? null,
      creasAdicionais,
    },
  };
}

/** Lê o JSON gravado de CREAs adicionais, descartando o que não for válido. */
export function lerCreasAdicionais(valor: unknown): CreaAdicional[] {
  let lista: unknown = valor;
  if (typeof valor === "string") { try { lista = JSON.parse(valor); } catch { return []; } }
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const numero = normalizarNumeroCrea(o.numero);
    return numero && ehUf(o.uf) ? [{ numero, uf: o.uf }] : [];
  });
}

// ─── Acesso ──────────────────────────────────────────────────────────────────

/**
 * Quem vê os documentos/perfil de um usuário: admin ativo (gestão de usuários é
 * exclusiva do admin) e o próprio usuário. Gerenciar (enviar, substituir,
 * excluir, editar o perfil) é só do admin.
 */
export function acessoDocumentosUsuario(ator: { id: number | string; papel?: string | null; ativo?: boolean | null }, alvoId: number | string): { ver: boolean; gerenciar: boolean } {
  if (ator.ativo === false) return { ver: false, gerenciar: false };
  if (ator.papel === "admin") return { ver: true, gerenciar: true };
  return { ver: String(ator.id) === String(alvoId), gerenciar: false };
}

// ─── ZIP ─────────────────────────────────────────────────────────────────────

/**
 * ZIP com todos os documentos (uma pasta por categoria, nome original preservado;
 * nomes repetidos ganham " (2)", " (3)"…). Datas fixas → mesmo conteúdo, mesmo ZIP.
 */
export function montarZipDocumentos(arquivos: { nome: string; categoria: string; bytes: Uint8Array }[]): Uint8Array {
  const usados = new Set<string>();
  const entradas: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const mtime = new Date(Date.UTC(2020, 0, 1));
  for (const a of arquivos) {
    const pasta = ehCategoriaDocumento(a.categoria) ? ROTULO_CATEGORIA_DOCUMENTO[a.categoria] : "Outros";
    const nome = nomeArquivoSeguro(a.nome);
    const ponto = nome.lastIndexOf(".");
    const base = ponto > 0 ? nome.slice(0, ponto) : nome;
    const ext = ponto > 0 ? nome.slice(ponto) : "";
    let caminho = `${pasta}/${nome}`;
    for (let n = 2; usados.has(caminho.toLowerCase()); n++) caminho = `${pasta}/${base} (${n})${ext}`;
    usados.add(caminho.toLowerCase());
    entradas[caminho] = [a.bytes, { mtime }];
  }
  return zipSync(entradas, { level: 6 });
}

export function nomeZipDocumentos(nomeUsuario: string | null | undefined): string {
  const base = (nomeUsuario ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `documentos-${base || "usuario"}.zip`;
}
