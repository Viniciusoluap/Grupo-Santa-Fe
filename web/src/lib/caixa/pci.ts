/**
 * PCI (Proposta de Construção Individual) da CAIXA — leitura dos dados.
 *
 * Pedido de 18/10: as incidências da obra vêm EXATAMENTE da 1ª aba da PCI
 * enviada (Proposta_Constr_Individual, coluna "Incidência", itens 1 a 20),
 * com todas as casas decimais, para que o total feche 100%. A identificação
 * (proponente, responsáveis técnicos, imóvel) e os dados do contrato também
 * são lidos daqui para o PDF da medição.
 */
import { PastaBiff8, type ValorCelula } from "./biff8";
import { PastaXlsb } from "./xlsb";

export const ABA_PROPOSTA = "Proposta_Constr_Individual";
export const ABA_PLS = "PLS";
export const ABA_REPACTUACAO = "Repactuação_Prazo";
export const ABA_ALTERACAO = "Alteração_Projeto_Especific";

/** Linhas dos 20 serviços na aba da proposta (coluna X = incidência). */
export const LINHA_PRIMEIRO_SERVICO_PCI = 120;
export const TOTAL_SERVICOS_PCI = 20;

export interface IdentificacaoPci {
  proponente: string;
  emailProponente: string;
  cpfProponente: string;
  telefoneProponente: string;
  rtpNome: string;
  rtpEmail: string;
  rtpRegistro: string;
  rtpUf: string;
  rtpCpf: string;
  rtpTelefone: string;
  rteNome: string;
  rteEmail: string;
  rteRegistro: string;
  rteUf: string;
  rteCpf: string;
  rteTelefone: string;
  endereco: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  matricula: string;
  cartorio: string;
  latitude: string;
  longitude: string;
  construtora: string;
  cnpjConstrutora: string;
  finalidade: string;
}

export interface DadosPci {
  formato: "xls" | "xlsb";
  /** Incidências (%) dos 20 serviços, com a precisão completa da planilha. */
  incidencias: number[];
  identificacao: IdentificacaoPci;
  contrato: string;
  valorImovel: number | null;
  /** Datas em ISO (aaaa-mm-dd). */
  dataContratacao: string | null;
  prazoMeses: number | null;
  alvaraEmissao: string | null;
  alvaraVigencia: string | null;
  seloCasaAzul: boolean;
  /** % acumulado proposto por etapa (0..n), do cronograma da proposta. */
  cronogramaProposto: number[];
  /** Curva de referência da CAIXA (% acumulado por etapa). */
  curvaReferencia: number[];
  /** Curvas lenta, normal e rápida da PLS (% acumulado por etapa). */
  curvaLenta: number[];
  curvaNormal: number[];
  curvaRapida: number[];
  /** Faixa de incidência aceitável (%) de cada um dos 20 serviços. */
  incidenciaMinima: number[];
  incidenciaMaxima: number[];
}

interface Planilha {
  ler(aba: string, endereco: string): ValorCelula;
  abas: string[];
}

function abrir(arquivo: Uint8Array): { planilha: Planilha; formato: "xls" | "xlsb" } {
  const zip = arquivo[0] === 0x50 && arquivo[1] === 0x4b;
  const ole = arquivo[0] === 0xd0 && arquivo[1] === 0xcf;
  if (ole) {
    const p = PastaBiff8.abrir(arquivo);
    return { planilha: { ler: (a, e) => p.ler(a, e), abas: p.abas.map((x) => x.nome) }, formato: "xls" };
  }
  if (zip) {
    const p = new PastaXlsb(arquivo);
    return { planilha: p, formato: "xlsb" };
  }
  throw new Error("Envie a PCI em .xls ou .xlsb (planilha da CAIXA).");
}

/** Número de série do Excel (dias desde 1899-12-30) → ISO. */
export function serialParaIso(v: ValorCelula): string | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 1) return null;
  const ms = Math.round((v - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO (aaaa-mm-dd) → número de série do Excel. */
export function isoParaSerial(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 86400000) + 25569;
}

function texto(v: ValorCelula): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}
const digitos = (v: ValorCelula) => (typeof v === "number" ? String(Math.round(v)) : String(v ?? "").replace(/\D/g, ""));

/** CPF/CNPJ guardado como número na planilha → com máscara. */
function documento(v: ValorCelula): string {
  if (typeof v !== "number") return texto(v);
  const d = digitos(v);
  if (d.length <= 11) return d.padStart(11, "0").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d.padStart(14, "0").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
function telefone(ddd: ValorCelula, numeroTel: ValorCelula): string {
  const n = typeof numeroTel === "number" ? digitos(numeroTel) : texto(numeroTel);
  const fmt = /^\d{8,9}$/.test(n) ? n.replace(/(\d{4,5})(\d{4})$/, "$1-$2") : n;
  return [texto(ddd), fmt].filter(Boolean).join(" ");
}
function cep(v: ValorCelula): string {
  if (typeof v !== "number") return texto(v);
  return digitos(v).padStart(8, "0").replace(/(\d{5})(\d{3})/, "$1-$2");
}

function numero(v: ValorCelula): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v.replace(",", ".")))) return Number(v.replace(",", "."));
  return null;
}

export function lerPci(arquivo: Uint8Array): DadosPci {
  const { planilha, formato } = abrir(arquivo);
  if (!planilha.abas.includes(ABA_PROPOSTA)) {
    throw new Error(`A planilha não tem a aba "${ABA_PROPOSTA}". Confira se é a PCI da CAIXA.`);
  }
  const p = (e: string) => planilha.ler(ABA_PROPOSTA, e);
  const incidencias: number[] = [];
  for (let k = 0; k < TOTAL_SERVICOS_PCI; k++) {
    const v = numero(p(`X${LINHA_PRIMEIRO_SERVICO_PCI + k}`));
    incidencias.push(v ?? 0);
  }
  const soma = incidencias.reduce((s, v) => s + v, 0);
  if (soma <= 0) throw new Error("A PCI não tem as incidências preenchidas (coluna Incidência, itens 1 a 20).");

  const pls = planilha.abas.includes(ABA_PLS) ? (e: string) => planilha.ler(ABA_PLS, e) : () => null;
  const identificacao: IdentificacaoPci = {
    proponente: texto(p("G44")),
    emailProponente: texto(p("Y44")),
    cpfProponente: documento(p("AK44")),
    telefoneProponente: telefone(p("AQ44"), p("AS44")),
    rtpNome: texto(p("G47")),
    rtpEmail: texto(p("Q47")),
    rtpRegistro: texto(p("AB47")),
    rtpUf: texto(p("AI47")),
    rtpCpf: documento(p("AK47")),
    rtpTelefone: telefone(p("AQ47"), p("AS47")),
    rteNome: texto(p("G50")),
    rteEmail: texto(p("Q50")),
    rteRegistro: texto(p("AB50")),
    rteUf: texto(p("AI50")),
    rteCpf: documento(p("AK50")),
    rteTelefone: telefone(p("AQ50"), p("AS50")),
    endereco: texto(p("G54")),
    complemento: texto(p("AJ54")),
    bairro: texto(p("G56")),
    cep: cep(p("V56")),
    municipio: texto(p("AA56")),
    uf: texto(p("AV56")),
    matricula: texto(p("G58")),
    cartorio: texto(p("M58")),
    latitude: [texto(p("T58")), texto(p("X58"))].filter(Boolean).join(" "),
    longitude: [texto(p("Y58")), "W"].filter(Boolean).join(" "),
    construtora: texto(p("AD58")),
    cnpjConstrutora: documento(p("AK58")),
    finalidade: texto(p("AQ58")),
  };

  const cronogramaProposto: number[] = [];
  const curvaReferencia: number[] = [];
  for (let k = 0; k < 25; k++) {
    const etapa = numero(p(`AD${165 + k}`));
    const proposto = numero(p(`AI${165 + k}`));
    if (etapa !== null && proposto !== null) cronogramaProposto.push(proposto);
    const ref = numero(p(`AP${165 + k}`));
    if (ref !== null) curvaReferencia.push(ref);
  }

  const curvaLenta: number[] = [];
  const curvaNormal: number[] = [];
  const curvaRapida: number[] = [];
  for (let k = 0; k <= 72; k++) {
    const l = numero(pls(`BG${95 + k}`));
    const n = numero(pls(`BH${95 + k}`));
    const r = numero(pls(`BI${95 + k}`));
    if (l === null && n === null && r === null) break;
    curvaLenta.push(l ?? 0);
    curvaNormal.push(n ?? 0);
    curvaRapida.push(r ?? 0);
  }
  const incidenciaMinima: number[] = [];
  const incidenciaMaxima: number[] = [];
  for (let k = 0; k < TOTAL_SERVICOS_PCI; k++) {
    incidenciaMinima.push(numero(p(`AN${LINHA_PRIMEIRO_SERVICO_PCI + k}`)) ?? 0);
    incidenciaMaxima.push(numero(p(`AS${LINHA_PRIMEIRO_SERVICO_PCI + k}`)) ?? 0);
  }

  return {
    formato,
    incidencias,
    curvaLenta,
    curvaNormal,
    curvaRapida,
    incidenciaMinima,
    incidenciaMaxima,
    identificacao,
    contrato: texto(pls("S51")),
    valorImovel: numero(pls("AQ77")),
    dataContratacao: serialParaIso(pls("AL78")),
    prazoMeses: numero(pls("AV78")) ?? numero(p("T161")),
    alvaraEmissao: serialParaIso(pls("AI87")),
    alvaraVigencia: serialParaIso(pls("AS87")),
    seloCasaAzul: texto(pls("AS170")).toLowerCase() === "sim",
    cronogramaProposto,
    curvaReferencia,
  };
}
