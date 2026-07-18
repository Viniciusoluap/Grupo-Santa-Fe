// Quadro de Áreas (padrão NBR 12721) — usado tanto no Estudo de Massa de
// produto vertical (2.3) quanto no registro formal da incorporação (3.3).
// A área computável de cada pavimento é um dado de entrada (depende de
// julgamento legal/municipal sobre o que conta para o coeficiente de
// aproveitamento — não é derivável por fórmula única), fiel à planilha de
// referência "Calculadora de VGV" (Incorporação na Prática).
//
// Função pura, sem I/O — testável isoladamente.

export interface ItemQuadroAreas {
  pavimento: string;
  areaConstCobertaM2: number;
  areaConstDescobertaM2: number;
  areaUrbanizadaM2: number;
  areaDescontarM2: number; // área comum a descontar (referência)
  areaComputavelM2: number; // conta para o coeficiente de aproveitamento
  areaPrivativaM2: number; // área privativa (APV)
}

export interface ResultadoQuadroAreas {
  areaConstCobertaTotalM2: number; // ACC
  areaConstDescobertaTotalM2: number;
  areaConstTotalM2: number; // ACT = ACC + descoberta
  areaUrbanizadaTotalM2: number;
  areaPrivativaTotalM2: number; // APV
  areaComputavelTotalM2: number;
  indiceApvAcc: number; // eficiência: APV / ACC
  areaComputavelMaximaM2: number; // área do terreno × coeficiente de aproveitamento
  aproveitamentoPct: number; // área computável usada / área computável máxima
  excedeCoeficiente: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularQuadroAreas(
  itens: ItemQuadroAreas[],
  areaTerrenoM2: number,
  coeficienteAproveitamento: number
): ResultadoQuadroAreas {
  const areaConstCobertaTotalM2 = itens.reduce((s, it) => s + it.areaConstCobertaM2, 0);
  const areaConstDescobertaTotalM2 = itens.reduce((s, it) => s + it.areaConstDescobertaM2, 0);
  const areaConstTotalM2 = areaConstCobertaTotalM2 + areaConstDescobertaTotalM2;
  const areaUrbanizadaTotalM2 = itens.reduce((s, it) => s + it.areaUrbanizadaM2, 0);
  const areaPrivativaTotalM2 = itens.reduce((s, it) => s + it.areaPrivativaM2, 0);
  const areaComputavelTotalM2 = itens.reduce((s, it) => s + it.areaComputavelM2, 0);
  const indiceApvAcc = areaConstCobertaTotalM2 > 0 ? areaPrivativaTotalM2 / areaConstCobertaTotalM2 : 0;
  const areaComputavelMaximaM2 = Math.max(0, areaTerrenoM2) * Math.max(0, coeficienteAproveitamento);

  return {
    areaConstCobertaTotalM2: round2(areaConstCobertaTotalM2),
    areaConstDescobertaTotalM2: round2(areaConstDescobertaTotalM2),
    areaConstTotalM2: round2(areaConstTotalM2),
    areaUrbanizadaTotalM2: round2(areaUrbanizadaTotalM2),
    areaPrivativaTotalM2: round2(areaPrivativaTotalM2),
    areaComputavelTotalM2: round2(areaComputavelTotalM2),
    indiceApvAcc,
    areaComputavelMaximaM2: round2(areaComputavelMaximaM2),
    aproveitamentoPct: areaComputavelMaximaM2 > 0 ? areaComputavelTotalM2 / areaComputavelMaximaM2 : 0,
    excedeCoeficiente: areaComputavelMaximaM2 > 0 && areaComputavelTotalM2 > areaComputavelMaximaM2,
  };
}
