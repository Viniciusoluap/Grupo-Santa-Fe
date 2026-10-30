// Lote 3, item 17 (29/10/2026): lançamento "Cadastro livre" → cliente do CRM.
// Regras puras (sem banco/rede). Gêmeo da Prospecta: shared/financeiro/bpo-vinculo-cliente.ts.
//
// Prioridade dos sinais: 1) ID interno (lead do registro operacional vinculado) → 2) referência da
// integração (cliente já atribuído à movimentação bancária/Asaas) → 3) CPF/CNPJ → 4) telefone
// normalizado → 5) nome normalizado com similaridade alta. Vínculo automático SÓ quando existe
// exatamente um candidato com sinal forte (1 a 4); nome parecido nunca vincula sozinho.

export type GrauSugestao = "forte" | "media";
export type MotivoSugestao = "id_interno" | "integracao" | "documento" | "telefone" | "nome";

export type CandidatoCliente = {
  /** Chave estável: "l:<leadId>" (lead, com ou sem cliente BPO) ou "c:<clienteId>" (cliente BPO sem lead). */
  chave: string;
  clienteId: string | null;
  leadId: string | null;
  nome: string;
  documentos: (string | null | undefined)[];
  telefones: (string | null | undefined)[];
};

export type SinaisLancamento = {
  /** Leads ligados ao registro operacional do lançamento (obra, regularização, projeto…). */
  leadIds?: (string | null | undefined)[];
  /** Clientes BPO já atribuídos pela integração (movimentação bancária/Asaas/regra por titular). */
  clienteIdsIntegracao?: (string | null | undefined)[];
  /** Nome livre gravado no lançamento (ou titular do extrato). */
  nome?: string | null;
  /** Textos onde procurar CPF/CNPJ e telefone (nome livre, descrição, titular). */
  textos?: (string | null | undefined)[];
};

export type SugestaoCliente = {
  candidato: CandidatoCliente;
  motivos: MotivoSugestao[];
  grau: GrauSugestao;
  /** 1 = maior prioridade. */
  prioridade: number;
  /** Texto para a tela: "mesmo telefone", "mesmo CPF/CNPJ"… */
  descricao: string;
  similaridade?: number;
};

export type ResultadoSugestao = { sugestoes: SugestaoCliente[]; automatico: SugestaoCliente | null; ambiguo: boolean };

const PRIORIDADE: Record<MotivoSugestao, number> = { id_interno: 1, integracao: 2, documento: 3, telefone: 4, nome: 5 };
const TEXTO_MOTIVO: Record<MotivoSugestao, string> = {
  id_interno: "registro operacional do lançamento",
  integracao: "referência da integração bancária",
  documento: "mesmo CPF/CNPJ",
  telefone: "mesmo telefone",
  nome: "nome muito parecido",
};
export const SIMILARIDADE_MINIMA = 0.9;

const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** CPF (11) ou CNPJ (14) só com dígitos; outro tamanho → "". */
export function normalizarDocumento(doc: string | null | undefined): string {
  const d = soDigitos(doc);
  return d.length === 11 || d.length === 14 ? d : "";
}

/** Telefone brasileiro como DDD + número (10 ou 11 dígitos), sem +55 nem zero de operadora. */
export function normalizarTelefone(tel: string | null | undefined): string {
  let d = soDigitos(tel);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 || d.length === 11 ? d : "";
}

/** Formas equivalentes do telefone (com e sem o nono dígito) para comparar números antigos e novos. */
export function variantesTelefone(tel: string | null | undefined): string[] {
  const n = normalizarTelefone(tel);
  if (!n) return [];
  if (n.length === 11 && n[2] === "9") return [n, n.slice(0, 2) + n.slice(3)];
  if (n.length === 10) return [n, `${n.slice(0, 2)}9${n.slice(2)}`];
  return [n];
}

/** Documentos e telefones escritos em textos livres ("Maria — 123.456.789-00 — (91) 98888-7777"). */
export function extrairIdentificadores(textos: (string | null | undefined)[]) {
  const documentos = new Set<string>();
  const telefones = new Set<string>();
  for (const t of textos) {
    const texto = String(t ?? "");
    for (const m of texto.match(/\d[\d.\-/() +]{8,22}\d/g) ?? []) {
      const doc = normalizarDocumento(m);
      if (doc) documentos.add(doc);
      for (const v of variantesTelefone(m)) telefones.add(v);
    }
  }
  return { documentos: Array.from(documentos), telefones: Array.from(telefones) };
}

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "ltda", "me", "epp", "eireli", "sa"]);

/** Nome comparável: sem acento, minúsculo, sem números/pontuação e sem conectivos. */
export function normalizarNome(nome: string | null | undefined): string {
  return String(nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .split(/\s+/).filter(p => p && !STOP.has(p)).join(" ");
}

function bigramas(s: string) {
  const out = new Map<string, number>();
  const t = s.replace(/ /g, "_");
  for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); out.set(b, (out.get(b) ?? 0) + 1); }
  return out;
}

/** Similaridade 0..1 (Dice sobre bigramas do nome normalizado; mesma ordem de palavras não importa). */
export function similaridadeNome(a: string | null | undefined, b: string | null | undefined): number {
  const x = normalizarNome(a), y = normalizarNome(b);
  if (!x || !y) return 0;
  const ordenado = (s: string) => s.split(" ").sort().join(" ");
  if (x === y || ordenado(x) === ordenado(y)) return 1;
  const ba = bigramas(ordenado(x)), bb = bigramas(ordenado(y));
  let comum = 0, ta = 0, tb = 0;
  ba.forEach(n => { ta += n; });
  bb.forEach(n => { tb += n; });
  ba.forEach((n, k) => { comum += Math.min(n, bb.get(k) ?? 0); });
  return ta + tb ? (2 * comum) / (ta + tb) : 0;
}

/**
 * Sugere clientes para um lançamento "Cadastro livre". Retorna os candidatos (mais fortes primeiro),
 * com motivo e grau, e o `automatico` apenas quando há exatamente um candidato com sinal forte.
 */
export function sugerirClientesParaLancamento(sinais: SinaisLancamento, candidatos: CandidatoCliente[]): ResultadoSugestao {
  const porChave = new Map<string, { candidato: CandidatoCliente; motivos: Set<MotivoSugestao>; similaridade?: number }>();
  const marcar = (c: CandidatoCliente, m: MotivoSugestao, similaridade?: number) => {
    const e = porChave.get(c.chave) ?? { candidato: c, motivos: new Set<MotivoSugestao>() };
    e.motivos.add(m);
    if (similaridade != null) e.similaridade = Math.max(e.similaridade ?? 0, similaridade);
    porChave.set(c.chave, e);
  };
  const leadIds = new Set((sinais.leadIds ?? []).filter(Boolean).map(String));
  const clientesIntegracao = new Set((sinais.clienteIdsIntegracao ?? []).filter(Boolean).map(String));
  const { documentos, telefones } = extrairIdentificadores([sinais.nome, ...(sinais.textos ?? [])]);
  const docs = new Set(documentos), tels = new Set(telefones);
  const nome = normalizarNome(sinais.nome);
  const tokensNome = new Set(nome.split(" ").filter(t => t.length >= 3));

  for (const c of candidatos) {
    if (c.leadId && leadIds.has(String(c.leadId))) marcar(c, "id_interno");
    if (c.clienteId && clientesIntegracao.has(String(c.clienteId))) marcar(c, "integracao");
    if (docs.size && c.documentos.some(d => docs.has(normalizarDocumento(d)))) marcar(c, "documento");
    if (tels.size && c.telefones.some(t => variantesTelefone(t).some(v => tels.has(v)))) marcar(c, "telefone");
    if (tokensNome.size) {
      const alvo = normalizarNome(c.nome);
      if (alvo.split(" ").some(t => tokensNome.has(t))) {
        const s = similaridadeNome(nome, alvo);
        if (s >= SIMILARIDADE_MINIMA) marcar(c, "nome", s);
      }
    }
  }

  const sugestoes: SugestaoCliente[] = Array.from(porChave.values()).map(({ candidato, motivos, similaridade }): SugestaoCliente => {
    const lista = Array.from(motivos).sort((a, b) => PRIORIDADE[a] - PRIORIDADE[b]);
    const forte = lista.some(m => m !== "nome");
    return {
      candidato,
      motivos: lista,
      grau: forte ? "forte" : "media",
      prioridade: PRIORIDADE[lista[0]],
      descricao: lista.map(m => TEXTO_MOTIVO[m]).join(" + "),
      ...(similaridade != null ? { similaridade: Math.round(similaridade * 100) / 100 } : {}),
    };
  }).sort((a, b) => a.prioridade - b.prioridade || b.motivos.length - a.motivos.length || (b.similaridade ?? 0) - (a.similaridade ?? 0) || a.candidato.nome.localeCompare(b.candidato.nome));

  const fortes = sugestoes.filter(s => s.grau === "forte");
  return { sugestoes, automatico: fortes.length === 1 ? fortes[0] : null, ambiguo: fortes.length > 1 || (fortes.length === 0 && sugestoes.length > 1) };
}

/** Une clientes BPO e leads do CRM numa lista de candidatos sem duplicar (lead com cliente = 1 candidato). */
export function montarCandidatos(
  clientes: { id: string | number; razaoSocial: string; cpf?: string | null; cnpj?: string | null; telefone?: string | null; leadId?: string | number | null }[],
  leads: { id: string | number; nome: string; cpf?: string | null; telefone?: string | null }[],
): CandidatoCliente[] {
  const porLead = new Map<string, (typeof clientes)[number]>();
  const out: CandidatoCliente[] = [];
  for (const c of clientes) {
    if (c.leadId != null) porLead.set(String(c.leadId), c);
    else out.push({ chave: `c:${c.id}`, clienteId: String(c.id), leadId: null, nome: c.razaoSocial, documentos: [c.cpf, c.cnpj], telefones: [c.telefone] });
  }
  const vistos = new Set<string>();
  for (const l of leads) {
    const id = String(l.id);
    vistos.add(id);
    const c = porLead.get(id);
    out.push({
      chave: `l:${id}`, clienteId: c ? String(c.id) : null, leadId: id, nome: l.nome,
      documentos: [l.cpf, c?.cpf, c?.cnpj], telefones: [l.telefone, c?.telefone],
    });
  }
  // Cliente ligado a lead que não está mais na lista (excluído/arquivado) continua elegível como cliente.
  porLead.forEach((c, leadId) => {
    if (!vistos.has(leadId)) out.push({ chave: `c:${c.id}`, clienteId: String(c.id), leadId: null, nome: c.razaoSocial, documentos: [c.cpf, c.cnpj], telefones: [c.telefone] });
  });
  return out;
}
