// Pesquisa primária com compradores (aprimora a 2.2 Inteligência de Mercado)
// — questionário de perfil e interesse aplicado a potenciais compradores,
// seguindo a metodologia Carolina Caribé (grupos: perguntas eliminatórias,
// identificação de interesses e teste de produto). Os resultados agregados
// (perfil dominante, tipologias preferidas, disposição por atributo)
// complementam a pesquisa de mercado feita por IA.

export type FaixaEtaria = "18-25" | "26-35" | "36-45" | "46-55" | "56+";
export type FaixaRenda = "ate_2sm" | "2_4sm" | "4_8sm" | "8_15sm" | "acima_15sm";
export type TipoImovel = "apartamento" | "casa_condominio" | "casa_rua_aberta" | "lote";
export type NivelImportancia = "importante_paga_mais" | "decisivo_sem_pagar_mais" | "pouco_importante";

export const ITENS_CONDOMINIO = [
  "Cerca elétrica",
  "Portão eletrônico",
  "Playground",
  "Piscina",
  "Churrasqueira",
  "Área gourmet",
  "Porteiro 24h",
  "Salão de festas",
  "Varanda",
] as const;
export type ItemCondominio = (typeof ITENS_CONDOMINIO)[number];

export interface Entrevistado {
  id: string;
  nome: string;
  contato?: string;
  faixaEtaria: FaixaEtaria | "";
  faixaRenda: FaixaRenda | "";
  temImovelProprio: boolean;
  interesseComprar12Meses: boolean;
  tiposInteresse: TipoImovel[];
  notaApartamento: number; // 0 (não avaliado) a 5
  notaCasaCondominio: number;
  notaCasaRuaAberta: number;
  tamanhoIdealM2: number;
  quartosNecessarios: number;
  itensImportancia: Partial<Record<ItemCondominio, NivelImportancia>>;
}

export interface ResumoPesquisaPrimaria {
  totalEntrevistados: number;
  pctInteresseComprar12Meses: number;
  pctComImovelProprio: number;
  distribuicaoTipoImovel: { tipo: TipoImovel; pct: number }[];
  notaMediaApartamento: number;
  notaMediaCasaCondominio: number;
  notaMediaCasaRuaAberta: number;
  tamanhoIdealMedioM2: number;
  quartosModaNecessarios: number;
  rankingItens: { item: ItemCondominio; pctImportantePagaMais: number }[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(contagem: number, total: number): number {
  return total > 0 ? round1((contagem / total) * 100) : 0;
}

function media(valores: number[]): number {
  const validos = valores.filter((v) => v > 0);
  return validos.length > 0 ? round1(validos.reduce((s, v) => s + v, 0) / validos.length) : 0;
}

function moda(valores: number[]): number {
  const validos = valores.filter((v) => v > 0);
  if (validos.length === 0) return 0;
  const contagem = new Map<number, number>();
  for (const v of validos) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  let maisFrequente = validos[0];
  let maiorContagem = 0;
  for (const [valor, c] of contagem) {
    if (c > maiorContagem) {
      maiorContagem = c;
      maisFrequente = valor;
    }
  }
  return maisFrequente;
}

const TIPOS_IMOVEL: TipoImovel[] = ["apartamento", "casa_condominio", "casa_rua_aberta", "lote"];

export function resumoPesquisaPrimaria(entrevistados: Entrevistado[]): ResumoPesquisaPrimaria {
  const total = entrevistados.length;

  const distribuicaoTipoImovel = TIPOS_IMOVEL.map((tipo) => ({
    tipo,
    pct: pct(entrevistados.filter((e) => e.tiposInteresse.includes(tipo)).length, total),
  }));

  const rankingItens = ITENS_CONDOMINIO.map((item) => ({
    item,
    pctImportantePagaMais: pct(
      entrevistados.filter((e) => e.itensImportancia[item] === "importante_paga_mais").length,
      total
    ),
  })).sort((a, b) => b.pctImportantePagaMais - a.pctImportantePagaMais);

  return {
    totalEntrevistados: total,
    pctInteresseComprar12Meses: pct(entrevistados.filter((e) => e.interesseComprar12Meses).length, total),
    pctComImovelProprio: pct(entrevistados.filter((e) => e.temImovelProprio).length, total),
    distribuicaoTipoImovel,
    notaMediaApartamento: media(entrevistados.map((e) => e.notaApartamento)),
    notaMediaCasaCondominio: media(entrevistados.map((e) => e.notaCasaCondominio)),
    notaMediaCasaRuaAberta: media(entrevistados.map((e) => e.notaCasaRuaAberta)),
    tamanhoIdealMedioM2: media(entrevistados.map((e) => e.tamanhoIdealM2)),
    quartosModaNecessarios: moda(entrevistados.map((e) => e.quartosNecessarios)),
    rankingItens,
  };
}

/** Lê o JSON salvo e diz se já existe ao menos um entrevistado — usado no progresso automático da 2.2. */
export function pesquisaPrimariaPreenchidaDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { entrevistados?: Entrevistado[] };
    return Array.isArray(dados.entrevistados) && dados.entrevistados.length > 0;
  } catch {
    return false;
  }
}
