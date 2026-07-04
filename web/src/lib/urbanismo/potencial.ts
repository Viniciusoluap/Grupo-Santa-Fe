// Potencial construtivo — cálculos urbanísticos a partir dos parâmetros do
// Plano Diretor municipal. Funções puras, testáveis isoladamente.
//
// Fórmulas clássicas:
//   área edificável máxima  = área do terreno × coeficiente de aproveitamento (CA)
//   projeção máxima (térreo) = área do terreno × taxa de ocupação (TO)
//   área loteável líquida    = área × (1 - %institucional - %verde - %viário)
//   nº máx. de lotes         = área loteável líquida / lote mínimo
//   nº máx. de unidades      = área edificável / área média da unidade
//   vagas exigidas           = unidades × vagas por unidade

export interface ParametrosUrbanisticos {
  zona: string;
  /** Taxa de ocupação máxima (0..1). Ex.: 0.6 = 60%. */
  taxaOcupacao: number;
  /** Coeficiente de aproveitamento (básico ou máximo). Ex.: 2.0. */
  coefAproveitamento: number;
  /** Recuos mínimos em metros. */
  recuoFrontalM: number;
  recuoLateralM: number;
  recuoFundosM: number;
  /** Lote mínimo (m²) e testada mínima (m) para parcelamento. */
  loteMinimoM2: number;
  testadaMinimaM: number;
  /** Gabarito máximo (nº de pavimentos). */
  gabaritoPavimentos: number;
  /** Percentuais de doação obrigatória em loteamentos (0..1). */
  percentInstitucional: number;
  percentAreaVerde: number;
  percentViario: number;
  /** Vagas de estacionamento exigidas por unidade. */
  vagasPorUnidade: number;
}

export interface PotencialConstrutivo {
  areaEdificavelMaxM2: number;
  projecaoMaxTerreoM2: number;
  areaLoteavelLiquidaM2: number;
  areaDoacaoM2: number;
  lotesMax: number;
  unidadesMaxVertical: number | null; // null se areaMediaUnidade não informada
  vagasExigidas: number | null;
}

/** Calcula o potencial construtivo do terreno segundo o Plano Diretor. */
export function calcularPotencial(
  areaTerrenoM2: number,
  p: ParametrosUrbanisticos,
  areaMediaUnidadeM2?: number
): PotencialConstrutivo {
  const areaEdificavelMaxM2 = round2(areaTerrenoM2 * p.coefAproveitamento);
  const projecaoMaxTerreoM2 = round2(areaTerrenoM2 * p.taxaOcupacao);

  const fracaoDoacao = Math.min(
    1,
    Math.max(0, p.percentInstitucional + p.percentAreaVerde + p.percentViario)
  );
  const areaDoacaoM2 = round2(areaTerrenoM2 * fracaoDoacao);
  const areaLoteavelLiquidaM2 = round2(areaTerrenoM2 - areaDoacaoM2);

  const lotesMax = p.loteMinimoM2 > 0 ? Math.floor(areaLoteavelLiquidaM2 / p.loteMinimoM2) : 0;

  const unidadesMaxVertical =
    areaMediaUnidadeM2 && areaMediaUnidadeM2 > 0
      ? Math.floor(areaEdificavelMaxM2 / areaMediaUnidadeM2)
      : null;

  const vagasExigidas =
    unidadesMaxVertical != null ? Math.ceil(unidadesMaxVertical * p.vagasPorUnidade) : null;

  return {
    areaEdificavelMaxM2,
    projecaoMaxTerreoM2,
    areaLoteavelLiquidaM2,
    areaDoacaoM2,
    lotesMax,
    unidadesMaxVertical,
    vagasExigidas,
  };
}

/** Parâmetros default conservadores (típicos de zonas residenciais no interior do PA). */
export const PARAMETROS_DEFAULT: ParametrosUrbanisticos = {
  zona: "",
  taxaOcupacao: 0.6,
  coefAproveitamento: 1.2,
  recuoFrontalM: 3,
  recuoLateralM: 1.5,
  recuoFundosM: 3,
  loteMinimoM2: 250,
  testadaMinimaM: 10,
  gabaritoPavimentos: 2,
  percentInstitucional: 0.05,
  percentAreaVerde: 0.1,
  percentViario: 0.2,
  vagasPorUnidade: 1,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
