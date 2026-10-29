/**
 * Lote 03, correção 10 — estrutura de uma versão do modelo oficial da PCI e
 * relatório de compatibilidade entre versões.
 *
 * Ao enviar uma nova versão em Integrações › PCI da CAIXA, o sistema lê as abas,
 * o estado das células-chave do mapeamento (entrada, fórmula ou ausente) e as
 * listas de validação (DV no .xls; `dataValidations` no .xlsm; o .xlsb não traz
 * as listas legíveis), compara com a versão anterior e com as listas que o
 * sistema usa (shared/pci-listas.ts). Mudança crítica (aba da proposta/PLS
 * removida, célula do mapeamento que deixou de ser entrada, lista de um campo
 * do sistema alterada) exige confirmação explícita do admin antes de a versão
 * virar a atual.
 *
 * Só leitura: nada aqui altera o arquivo. Gêmeo em
 * Prospecta/server/caixa/pci-modelo-estrutura.ts.
 */
import { unzipSync } from "fflate";
import {
  ABA_PROPOSTA_PCI,
  CAMPOS_PCI,
  COLUNA_CUSTO_PCI,
  LINHA_ADICIONAL_PCI,
  LINHA_CRONOGRAMA_PCI,
  LINHA_CUSTO_PCI,
  MAX_ETAPAS_PCI,
  SERVICOS_CUSTO_PCI,
  TOTAL_ADICIONAIS_PCI,
  type FormatoModeloPci,
} from "@/lib/pci-gerador";
import { LISTAS_PCI } from "@/lib/pci-listas";
import { PastaBiff8, type ValidacaoDados } from "./biff8";
import { PastaXlsx } from "./pci-gerador";
import { ABA_PLS } from "./pci";
import { PastaXlsb } from "./xlsb";

export type EstadoCelulaPci = "entrada" | "formula" | "ausente";

export interface ListaEstruturaPci {
  aba: string;
  intervalo: string;
  opcoes: string[] | null;
  referencia: string | null;
}

export interface EstruturaModeloPci {
  formato: FormatoModeloPci;
  abas: string[];
  /** "Aba!Célula" → estado da célula-chave do mapeamento. */
  celulas: Record<string, EstadoCelulaPci>;
  /** Listas de validação; null = formato sem leitura de validações (.xlsb). */
  listas: ListaEstruturaPci[] | null;
}

/** Células da PLS usadas pela geração da medição (./medicao-xls.ts). */
const CELULAS_PLS = ["S51", "AQ77", "AL78", "AV78", "AL81", "AN82", "AV82", "AU84", "AS85", "AS88", "AS89", "AI87", "AS87", "AS170", "G113", "H301", "Y106", "V85", "V104", "AF95", "AJ95"];

/** Células-chave do mapeamento (aba da proposta + PLS). */
export function celulasChavePci(): string[] {
  const proposta = new Set<string>();
  for (const campo of CAMPOS_PCI) {
    if (campo.celula) proposta.add(campo.celula);
    if (campo.celulaHemisferio) proposta.add(campo.celulaHemisferio);
  }
  SERVICOS_CUSTO_PCI.forEach((_, i) => proposta.add(`${COLUNA_CUSTO_PCI}${LINHA_CUSTO_PCI + i}`));
  for (let i = 0; i < TOTAL_ADICIONAIS_PCI; i++) { proposta.add(`I${LINHA_ADICIONAL_PCI + i}`); proposta.add(`Z${LINHA_ADICIONAL_PCI + i}`); }
  for (let k = 0; k < MAX_ETAPAS_PCI; k++) proposta.add(`AI${LINHA_CRONOGRAMA_PCI + k}`);
  return [...Array.from(proposta).map((c) => `${ABA_PROPOSTA_PCI}!${c}`), ...CELULAS_PLS.map((c) => `${ABA_PLS}!${c}`)];
}

interface LeitorEstrutura {
  abas: string[];
  estado(aba: string, celula: string): EstadoCelulaPci;
  listas: ((aba: string) => ValidacaoDados[]) | null;
}

function leitor(bytes: Uint8Array, formato: FormatoModeloPci): LeitorEstrutura {
  if (formato === "xls") {
    const p = PastaBiff8.abrir(bytes);
    return {
      abas: p.abas.map((a) => a.nome),
      estado: (aba, celula) => (p.ehFormula(aba, celula) ? "formula" : existeBiff8(p, aba, celula) ? "entrada" : "ausente"),
      listas: (aba) => p.validacoesDeDados(aba),
    };
  }
  if (formato === "xlsb") {
    const p = new PastaXlsb(bytes);
    return {
      abas: p.abas,
      // O leitor .xlsb não distingue fórmula de valor: célula lida conta como presente.
      estado: (aba, celula) => (p.ler(aba, celula) !== null ? "entrada" : "ausente"),
      listas: null,
    };
  }
  const p = new PastaXlsx(unzipSync(bytes));
  return {
    abas: p.abas,
    estado: (aba, celula) => (p.ehFormula(aba, celula) ? "formula" : p.temCelula(aba, celula) ? "entrada" : "ausente"),
    listas: (aba) => p.validacoesDeDados(aba),
  };
}

/** No .xls, a célula de entrada existe como registro (mesmo em branco, com a formatação roxa). */
function existeBiff8(p: PastaBiff8, aba: string, celula: string): boolean {
  try {
    return p.temCelula(aba, celula);
  } catch {
    return false;
  }
}

/** Lê a estrutura de uma versão do modelo (abas, células-chave e listas). */
export function lerEstruturaModeloPci(bytes: Uint8Array, formato: FormatoModeloPci): EstruturaModeloPci {
  const l = leitor(bytes, formato);
  const celulas: Record<string, EstadoCelulaPci> = {};
  for (const chave of celulasChavePci()) {
    const [aba, celula] = chave.split("!");
    celulas[chave] = l.abas.includes(aba) ? l.estado(aba, celula) : "ausente";
  }
  let listas: ListaEstruturaPci[] | null = null;
  if (l.listas) {
    listas = [];
    for (const aba of l.abas) {
      for (const v of l.listas(aba)) if (v.tipo === 3) listas.push({ aba, intervalo: v.intervalo, opcoes: v.opcoes, referencia: v.referencia });
    }
  }
  return { formato, abas: l.abas, celulas, listas };
}

export interface RelatorioCompatibilidadePci {
  /** Versão comparada (anterior); null = primeira versão. */
  versaoAnterior: number | null;
  formatoNovo: FormatoModeloPci;
  abasAdicionadas: string[];
  abasRemovidas: string[];
  /** Células-chave cujo estado mudou (ex.: entrada → fórmula/ausente). */
  celulasAlteradas: { celula: string; antes: EstadoCelulaPci; depois: EstadoCelulaPci }[];
  listasAdicionadas: string[];
  listasRemovidas: string[];
  listasAlteradas: { lista: string; antes: string[] | null; depois: string[] | null }[];
  /** Listas dos campos do sistema que não batem com o mapeamento (shared/pci-listas.ts). */
  listasDivergentesDoSistema: { celula: string; esperado: readonly string[]; encontrado: string[] }[];
  /** Mudanças que exigem confirmação explícita do admin. */
  criticas: string[];
  avisos: string[];
  critico: boolean;
}

const chaveLista = (l: ListaEstruturaPci) => `${l.aba}!${l.intervalo}`;
/** Opções legíveis (cache de fórmula zerado no arquivo vira "0": não dá para comparar o conteúdo). */
const opcoesLegiveis = (o: string[] | null, referencia: string | null = null) =>
  !!o && o.length > 0 && (referencia === null ? o.some((x) => x.trim() !== "") : o.every((x) => x !== "0" && x.trim() !== ""));
const semEspacos = (o: readonly string[] | null) => (o ?? []).map((x) => x.trim());
const iguais = (a: readonly string[] | null, b: readonly string[] | null) => JSON.stringify(a) === JSON.stringify(b);

/** Intervalo "AI47:AJ47 Q63:V66" cobre a célula "AI47"? */
function cobre(intervalo: string, celula: string): boolean {
  const pos = (e: string) => {
    const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(e);
    if (!m) return null;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c, r: Number(m[2]) };
  };
  const alvo = pos(celula);
  if (!alvo) return false;
  return intervalo.split(/\s+/).some((parte) => {
    const [a, b] = parte.split(":");
    const p1 = pos(a);
    const p2 = pos(b ?? a);
    return !!p1 && !!p2 && alvo.c >= p1.c && alvo.c <= p2.c && alvo.r >= p1.r && alvo.r <= p2.r;
  });
}

/** Compara a nova versão com a anterior (null = primeira) e com o mapeamento do sistema. */
export function compararEstruturasPci(anterior: { versao: number; estrutura: EstruturaModeloPci } | null, nova: EstruturaModeloPci): RelatorioCompatibilidadePci {
  const r: RelatorioCompatibilidadePci = {
    versaoAnterior: anterior?.versao ?? null, formatoNovo: nova.formato, abasAdicionadas: [], abasRemovidas: [], celulasAlteradas: [],
    listasAdicionadas: [], listasRemovidas: [], listasAlteradas: [], listasDivergentesDoSistema: [], criticas: [], avisos: [], critico: false,
  };
  for (const aba of [ABA_PROPOSTA_PCI, ABA_PLS]) if (!nova.abas.includes(aba)) r.criticas.push(`A aba "${aba}" não existe nesta versão.`);
  // Células-chave que não são entrada nesta versão (o sistema grava nelas).
  const semEntrada = Object.entries(nova.celulas).filter(([, e]) => e !== "entrada").map(([c]) => c);
  if (anterior) {
    const a = anterior.estrutura;
    r.abasAdicionadas = nova.abas.filter((x) => !a.abas.includes(x));
    r.abasRemovidas = a.abas.filter((x) => !nova.abas.includes(x));
    for (const [celula, antes] of Object.entries(a.celulas)) {
      const depois = nova.celulas[celula] ?? "ausente";
      if (antes !== depois) r.celulasAlteradas.push({ celula, antes, depois });
    }
    for (const c of r.celulasAlteradas) {
      if (c.antes === "entrada") r.criticas.push(`Célula do mapeamento ${c.celula} deixou de ser campo de entrada (agora: ${c.depois === "formula" ? "fórmula" : "não existe"}).`);
    }
    for (const aba of r.abasRemovidas) if (aba !== ABA_PROPOSTA_PCI && aba !== ABA_PLS) r.avisos.push(`Aba "${aba}" removida.`);
    if (a.listas && nova.listas) {
      const antes = new Map(a.listas.map((l) => [chaveLista(l), l]));
      const depois = new Map(nova.listas.map((l) => [chaveLista(l), l]));
      for (const [k, l] of Array.from(depois)) {
        const x = antes.get(k);
        if (!x) r.listasAdicionadas.push(k);
        else if (opcoesLegiveis(x.opcoes, x.referencia) && opcoesLegiveis(l.opcoes, l.referencia) ? !iguais(x.opcoes, l.opcoes) : x.referencia !== l.referencia || (x.opcoes?.length ?? 0) !== (l.opcoes?.length ?? 0)) {
          r.listasAlteradas.push({ lista: k, antes: x.opcoes, depois: l.opcoes });
        }
      }
      for (const k of Array.from(antes.keys())) if (!depois.has(k)) r.listasRemovidas.push(k);
    } else if (!nova.listas) {
      r.avisos.push("Formato .xlsb: as listas de validação não são lidas; compare as listas pela versão .xls/.xlsm.");
    }
  } else {
    for (const c of semEntrada) r.criticas.push(`Célula do mapeamento ${c} não é campo de entrada neste modelo.`);
  }
  // Listas dos campos do sistema (aba da proposta) contra o mapeamento oficial.
  if (nova.listas) {
    for (const esperado of LISTAS_PCI) {
      if (esperado.aba !== ABA_PROPOSTA_PCI || !esperado.campoSistema || !CAMPOS_PCI.some((c) => c.celula === esperado.celula && c.tipo === "lista")) continue;
      const achada = nova.listas.find((l) => l.aba === ABA_PROPOSTA_PCI && cobre(l.intervalo, esperado.celula));
      if (!achada) {
        r.listasDivergentesDoSistema.push({ celula: esperado.celula, esperado: esperado.opcoes, encontrado: [] });
        continue;
      }
      if (!opcoesLegiveis(achada.opcoes, achada.referencia)) {
        // Cache das fórmulas da lista zerado no arquivo: confere só a quantidade de opções.
        if ((achada.opcoes?.length ?? 0) !== esperado.opcoes.length) r.listasDivergentesDoSistema.push({ celula: esperado.celula, esperado: esperado.opcoes, encontrado: achada.opcoes ?? [] });
        continue;
      }
      if (iguais(achada.opcoes, [...esperado.opcoes])) continue;
      if (iguais(semEspacos(achada.opcoes), semEspacos(esperado.opcoes))) {
        r.avisos.push(`Lista da célula ${esperado.celula}: mesmas opções do mapeamento, com diferença só de espaços; o sistema grava o texto do mapeamento oficial.`);
        continue;
      }
      r.listasDivergentesDoSistema.push({ celula: esperado.celula, esperado: esperado.opcoes, encontrado: achada.opcoes ?? [] });
    }
    for (const d of r.listasDivergentesDoSistema) {
      r.criticas.push(d.encontrado.length ? `Lista da célula ${d.celula} mudou em relação ao mapeamento do sistema (${d.encontrado.length} opções; o sistema usa ${d.esperado.length}).` : `A célula ${d.celula} não tem mais lista de validação.`);
    }
  }
  if (nova.formato !== "xls") r.avisos.push(`Modelo .${nova.formato}: a PCI continua sendo gerada em .xls, a partir da versão .xls compatível mais recente.`);
  r.critico = r.criticas.length > 0;
  return r;
}

/**
 * Uma versão .xls serve de base de saída para um modelo .xlsm/.xlsb se tiver as
 * mesmas abas da proposta/PLS e as mesmas células-chave como entrada.
 */
export function xlsCompativelCom(xls: EstruturaModeloPci, referencia: EstruturaModeloPci): boolean {
  if (xls.formato !== "xls") return false;
  for (const aba of [ABA_PROPOSTA_PCI, ABA_PLS]) if (referencia.abas.includes(aba) !== xls.abas.includes(aba)) return false;
  for (const [celula, estado] of Object.entries(referencia.celulas)) {
    // .xlsb não distingue fórmula: só exige que a célula presente lá exista como entrada no .xls.
    const noXls = xls.celulas[celula] ?? "ausente";
    if (referencia.formato === "xlsb" ? estado === "entrada" && noXls === "ausente" : estado !== noXls) return false;
  }
  return true;
}
