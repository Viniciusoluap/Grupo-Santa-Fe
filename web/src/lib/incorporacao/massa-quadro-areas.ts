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
// Com viário GEOMÉTRICO (motor v2): sistema viário = área das vias desenhadas e
//   área parcelável = vendável + verde + institucional + viário + sobras de quadra,
// onde as sobras são o remanescente que o desenho não aproveita (nunca "viário" fictício).
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

/**
 * Regra do dono (16/11/2026): APP, faixas de servidão e demais áreas que não podem virar lote devem ser
 * aproveitadas, sempre que permitido, para cumprir as áreas que o loteamento tem de destinar (área verde e área
 * institucional) — em vez de serem reservadas por fora e ainda se tirar mais terra loteável para a doação.
 * Cada tipo de restrição tem um destino: conta como área verde, como área institucional, ou não conta.
 */
export type DestinoRestricao = "verde" | "institucional" | "nenhum";
export const DESTINOS_RESTRICAO: { value: DestinoRestricao; label: string }[] = [
  { value: "verde", label: "Conta como área verde" },
  { value: "institucional", label: "Conta como área institucional" },
  { value: "nenhum", label: "Não conta (só não parcelável)" },
];
export type DestinosDasRestricoes = Record<keyof RestricoesNaoParcelaveis, DestinoRestricao>;
/**
 * Padrão: APP, vegetação a preservar e faixas não edificáveis contam como área verde (uso compatível: não se
 * constrói nelas). Nenhuma conta como institucional por padrão, porque a área institucional recebe equipamento
 * público e precisa ser edificável; "outras" não contam, por não se saber o que são. A legislação municipal manda:
 * a tela deixa trocar o destino de cada uma.
 */
export const DESTINOS_PADRAO: DestinosDasRestricoes = {
  appM2: "verde", supressaoVegetalM2: "verde", faixaTransmissaoM2: "verde", faixaServidaoM2: "verde", outrasNaoParcelaveisM2: "nenhum",
};

export interface AproveitamentoDasRestricoes {
  /** Restrições que contam como área verde / institucional, e as que ficam só como não parceláveis (m²). */
  comoVerdeM2: number; comoInstitucionalM2: number; semAproveitamentoM2: number;
  /** Mínimo exigido pelos percentuais, sobre a área parcelável. */
  exigidoVerdeM2: number; exigidoInstitucionalM2: number;
  /** Quanto ainda precisa sair da terra loteável para completar cada mínimo. */
  verdeEmAreaLoteavelM2: number; institucionalEmAreaLoteavelM2: number;
  /** Total a destinar em cada uso (a restrição aproveitada + o complemento). */
  alvoVerdeM2: number; alvoInstitucionalM2: number;
  /** Terra loteável que deixou de ser doada por causa do aproveitamento. */
  economiaM2: number;
}

/** Fecha a conta do aproveitamento das áreas restritas nas doações obrigatórias. */
export function aproveitarRestricoes(
  restricoes: RestricoesNaoParcelaveis, destinos: Partial<DestinosDasRestricoes> | undefined,
  areaBrutaM2: number, percentVerde: number, percentInstitucional: number,
): AproveitamentoDasRestricoes {
  const d = { ...DESTINOS_PADRAO, ...(destinos ?? {}) };
  // Se as restrições somam mais que a gleba, todas são reduzidas na mesma proporção (o quadro avisa).
  const total = totalRestricoes(restricoes), fator = total > areaBrutaM2 && total > 0 ? Math.max(0, areaBrutaM2) / total : 1;
  let comoVerde = 0, comoInstitucional = 0, sem = 0;
  for (const k of Object.keys(DESTINOS_PADRAO) as (keyof RestricoesNaoParcelaveis)[]) {
    const v = positivo(restricoes[k]) * fator;
    if (d[k] === "verde") comoVerde += v; else if (d[k] === "institucional") comoInstitucional += v; else sem += v;
  }
  const parcelavel = Math.max(0, areaBrutaM2 - (comoVerde + comoInstitucional + sem));
  const exigidoVerde = Math.max(0, percentVerde) * parcelavel, exigidoInstitucional = Math.max(0, percentInstitucional) * parcelavel;
  const verdeEmLoteavel = Math.max(0, exigidoVerde - comoVerde), instEmLoteavel = Math.max(0, exigidoInstitucional - comoInstitucional);
  return {
    comoVerdeM2: r2(comoVerde), comoInstitucionalM2: r2(comoInstitucional), semAproveitamentoM2: r2(sem),
    exigidoVerdeM2: r2(exigidoVerde), exigidoInstitucionalM2: r2(exigidoInstitucional),
    verdeEmAreaLoteavelM2: r2(verdeEmLoteavel), institucionalEmAreaLoteavelM2: r2(instEmLoteavel),
    alvoVerdeM2: r2(comoVerde + verdeEmLoteavel), alvoInstitucionalM2: r2(comoInstitucional + instEmLoteavel),
    economiaM2: r2(Math.min(exigidoVerde, comoVerde) + Math.min(exigidoInstitucional, comoInstitucional)),
  };
}

export interface EntradaQuadroAreas {
  areaBrutaM2: number;
  restricoes: RestricoesNaoParcelaveis;
  areaVendavelM2: number;
  nLotesVendaveis: number;
  areaInstitucionalM2: number;
  areaVerdeM2: number;
  precoM2Lote: number;
  /**
   * Área do sistema viário DESENHADO (geométrica). Quando informada, o sistema viário do
   * quadro é exatamente essa área e o que sobra da área parcelável vira "sobras de quadra"
   * (remanescente não aproveitado). Quando ausente, mantém o cálculo legado: viário = resto.
   */
  sistemaViarioM2?: number;
  /** Modo de definição da área viária e valor manual (quando houver) — só para exibição/auditoria. */
  modoSistemaViario?: "automatico" | "manual";
  sistemaViarioInformadoM2?: number;
  /**
   * Restrições aproveitadas como área verde/institucional (`aproveitarRestricoes`). Essas áreas já estão dentro
   * de `areaVerdeM2`/`areaInstitucionalM2` E dentro das restrições: o quadro desconta a parte repetida para o
   * sistema viário e as sobras fecharem.
   */
  aproveitamento?: AproveitamentoDasRestricoes;
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
  /** Sobras de quadra / remanescente não aproveitado (só no cálculo com viário geométrico). */
  sobrasM2?: number;
  modoSistemaViario?: "automatico" | "manual";
  sistemaViarioInformadoM2?: number;
  /** Parte da área verde/institucional que está em APP ou faixa aproveitada (não ocupa terra parcelável). */
  areaVerdeEmRestricaoM2?: number;
  areaInstitucionalEmRestricaoM2?: number;
  /** Mínimos exigidos pelos percentuais e a terra loteável poupada pelo aproveitamento das restrições. */
  areaVerdeExigidaM2?: number;
  areaInstitucionalExigidaM2?: number;
  economiaPorAproveitamentoM2?: number;
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
  const geometrico = e.sistemaViarioM2 !== undefined && Number.isFinite(e.sistemaViarioM2);
  // A parte da área verde/institucional que está em cima de APP ou faixa (aproveitada) não ocupa terra parcelável.
  const verdeEmRestricao = Math.min(verde, positivo(e.aproveitamento?.comoVerdeM2 ?? 0));
  const institucionalEmRestricao = Math.min(institucional, positivo(e.aproveitamento?.comoInstitucionalM2 ?? 0));
  let viario = areaParcelavel - vendavel - (verde - verdeEmRestricao) - (institucional - institucionalEmRestricao);
  let sobras: number | undefined;
  if (geometrico) {
    const viarioGeo = positivo(e.sistemaViarioM2);
    sobras = viario - viarioGeo;
    if (sobras < -0.5) {
      avisos.push(`Vias desenhadas (${r2(viarioGeo)} m²), lotes e doações somam mais que a área parcelável em ${r2(-sobras)} m² — as áreas não parceláveis informadas não cabem fora do desenho. Revise as restrições.`);
    }
    sobras = Math.max(0, sobras);
    viario = viarioGeo;
  } else if (viario < -0.5) {
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
    ...(e.aproveitamento ? {
      areaVerdeEmRestricaoM2: r2(verdeEmRestricao), areaInstitucionalEmRestricaoM2: r2(institucionalEmRestricao),
      areaVerdeExigidaM2: e.aproveitamento.exigidoVerdeM2, areaInstitucionalExigidaM2: e.aproveitamento.exigidoInstitucionalM2,
      economiaPorAproveitamentoM2: e.aproveitamento.economiaM2,
    } : {}),
    ...(geometrico ? {
      sobrasM2: r2(sobras ?? 0),
      modoSistemaViario: e.modoSistemaViario ?? "automatico",
      ...(e.sistemaViarioInformadoM2 !== undefined ? { sistemaViarioInformadoM2: r2(positivo(e.sistemaViarioInformadoM2)) } : {}),
    } : {}),
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
    { rotulo: q.sobrasM2 !== undefined ? "Sistema viário (desenhado)" : "Sistema viário (inclui sobras de quadra)", m2: q.sistemaViarioM2 },
    { rotulo: "Área verde", m2: q.areaVerdeM2 },
    ...(q.areaVerdeEmRestricaoM2 ? [{ rotulo: "  da qual em APP/faixas (aproveitada)", m2: q.areaVerdeEmRestricaoM2 }] : []),
    { rotulo: "Área institucional", m2: q.areaInstitucionalM2 },
    ...(q.areaInstitucionalEmRestricaoM2 ? [{ rotulo: "  da qual em APP/faixas (aproveitada)", m2: q.areaInstitucionalEmRestricaoM2 }] : []),
    { rotulo: "Área pública total", m2: q.areaPublicaTotalM2, destaque: true },
    { rotulo: "Área líquida vendável", m2: q.areaLiquidaVendavelM2, destaque: true },
    ...(q.sobrasM2 !== undefined ? [{ rotulo: "Sobras de quadra (remanescente)", m2: q.sobrasM2 }] : []),
  ];
}
