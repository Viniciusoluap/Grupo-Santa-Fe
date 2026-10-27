// Quadro de áreas do Estudo de Massa (correção 10 do Lote 02).
//
// Função PURA, idêntica nos dois sistemas (Prospecta e Grupo Santa Fé). Cada
// área entra em UMA única parcela — sem subtração dupla:
//
//   área bruta = não parceláveis (APP + supressão vegetal + faixa de transmissão
//                + faixa de servidão + outras)          ← informadas uma única vez
//              + área parcelável
//   área parcelável = área líquida vendável (lotes)
//                   + área verde + área institucional   ← lotes convertidos em doação
//                   + sistema viário (vias e sobras de quadra = o restante)
//   área pública total = sistema viário + área verde + área institucional
//
// As não parceláveis são somadas uma vez e limitadas à área bruta; se a soma
// passar da gleba, o quadro avisa (sobreposição provável entre restrições).

export interface RestricoesNaoParcelaveis {
  appM2: number;
  supressaoVegetalM2: number;
  faixaTransmissaoM2: number;
  faixaServidaoM2: number;
  outrasNaoParcelaveisM2: number;
}

export interface EntradaQuadroAreas {
  areaBrutaM2: number;
  restricoes: RestricoesNaoParcelaveis;
  areaVendavelM2: number;
  nLotesVendaveis: number;
  areaInstitucionalM2: number;
  areaVerdeM2: number;
  precoM2Lote: number;
}

export interface QuadroAreasMassa {
  areaBrutaM2: number;
  appM2: number;
  supressaoVegetalM2: number;
  faixaTransmissaoM2: number;
  faixaServidaoM2: number;
  outrasNaoParcelaveisM2: number;
  totalNaoParcelavelM2: number;
  areaParcelavelM2: number;
  sistemaViarioM2: number;
  areaVerdeM2: number;
  areaInstitucionalM2: number;
  areaPublicaTotalM2: number;
  areaLiquidaVendavelM2: number;
  nLotes: number;
  areaMediaLoteM2: number;
  /** Área líquida vendável ÷ área bruta (0..1). */
  aproveitamento: number;
  /** Área líquida vendável ÷ área parcelável (0..1). */
  aproveitamentoParcelavel: number;
  vgv: number;
  avisos: string[];
}

export const RESTRICOES_VAZIAS: RestricoesNaoParcelaveis = {
  appM2: 0,
  supressaoVegetalM2: 0,
  faixaTransmissaoM2: 0,
  faixaServidaoM2: 0,
  outrasNaoParcelaveisM2: 0,
};

const positivo = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Soma das restrições (cada uma conta uma única vez). */
export function totalRestricoes(r: RestricoesNaoParcelaveis): number {
  return positivo(r.appM2) + positivo(r.supressaoVegetalM2) + positivo(r.faixaTransmissaoM2)
    + positivo(r.faixaServidaoM2) + positivo(r.outrasNaoParcelaveisM2);
}

export function calcularQuadroAreasMassa(e: EntradaQuadroAreas): QuadroAreasMassa {
  const avisos: string[] = [];
  const areaBruta = positivo(e.areaBrutaM2);
  const r = {
    appM2: positivo(e.restricoes.appM2),
    supressaoVegetalM2: positivo(e.restricoes.supressaoVegetalM2),
    faixaTransmissaoM2: positivo(e.restricoes.faixaTransmissaoM2),
    faixaServidaoM2: positivo(e.restricoes.faixaServidaoM2),
    outrasNaoParcelaveisM2: positivo(e.restricoes.outrasNaoParcelaveisM2),
  };
  let naoParcelavel = totalRestricoes(r);
  if (naoParcelavel > areaBruta) {
    avisos.push("A soma das áreas não parceláveis passa da área bruta — verifique sobreposição entre APP, supressão e faixas (cada área deve ser informada uma única vez).");
    naoParcelavel = areaBruta;
  }
  const areaParcelavel = Math.max(0, areaBruta - naoParcelavel);
  const vendavel = positivo(e.areaVendavelM2);
  const verde = positivo(e.areaVerdeM2);
  const institucional = positivo(e.areaInstitucionalM2);
  let viario = areaParcelavel - vendavel - verde - institucional;
  if (viario < -0.5) {
    avisos.push("Lotes e doações somam mais que a área parcelável — o cenário ocupa áreas não parceláveis. Revise as restrições ou gere novos cenários.");
  }
  viario = Math.max(0, viario);
  const nLotes = Math.max(0, Math.floor(positivo(e.nLotesVendaveis)));
  return {
    areaBrutaM2: r2(areaBruta),
    appM2: r2(r.appM2),
    supressaoVegetalM2: r2(r.supressaoVegetalM2),
    faixaTransmissaoM2: r2(r.faixaTransmissaoM2),
    faixaServidaoM2: r2(r.faixaServidaoM2),
    outrasNaoParcelaveisM2: r2(r.outrasNaoParcelaveisM2),
    totalNaoParcelavelM2: r2(naoParcelavel),
    areaParcelavelM2: r2(areaParcelavel),
    sistemaViarioM2: r2(viario),
    areaVerdeM2: r2(verde),
    areaInstitucionalM2: r2(institucional),
    areaPublicaTotalM2: r2(viario + verde + institucional),
    areaLiquidaVendavelM2: r2(vendavel),
    nLotes,
    areaMediaLoteM2: nLotes > 0 ? r2(vendavel / nLotes) : 0,
    aproveitamento: areaBruta > 0 ? vendavel / areaBruta : 0,
    aproveitamentoParcelavel: areaParcelavel > 0 ? vendavel / areaParcelavel : 0,
    vgv: Math.round(vendavel * positivo(e.precoM2Lote)),
    avisos,
  };
}

/** Linhas do quadro na ordem de exibição (tela, PDF e relatórios). */
export function linhasQuadroAreas(q: QuadroAreasMassa): { rotulo: string; m2: number; destaque?: boolean }[] {
  return [
    { rotulo: "Área bruta da gleba", m2: q.areaBrutaM2, destaque: true },
    { rotulo: "APP", m2: q.appM2 },
    { rotulo: "Supressão vegetal", m2: q.supressaoVegetalM2 },
    { rotulo: "Faixa de transmissão", m2: q.faixaTransmissaoM2 },
    { rotulo: "Faixa de servidão", m2: q.faixaServidaoM2 },
    { rotulo: "Outras não parceláveis", m2: q.outrasNaoParcelaveisM2 },
    { rotulo: "Área parcelável", m2: q.areaParcelavelM2, destaque: true },
    { rotulo: "Sistema viário (inclui sobras de quadra)", m2: q.sistemaViarioM2 },
    { rotulo: "Área verde", m2: q.areaVerdeM2 },
    { rotulo: "Área institucional", m2: q.areaInstitucionalM2 },
    { rotulo: "Área pública total", m2: q.areaPublicaTotalM2, destaque: true },
    { rotulo: "Área líquida vendável", m2: q.areaLiquidaVendavelM2, destaque: true },
  ];
}
