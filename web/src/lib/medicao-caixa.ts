// Pedido de 18/10 — medição no formato da CAIXA (PLS, Repactuação de Prazo e
// Alteração de Projeto). Mesmo arquivo em
// Grupo-Santa-Fe/web/src/lib/obras/medicao-caixa.ts.
//
// Aqui ficam só os tipos, opções e validações dos campos que o usuário
// preenche na medição. A leitura da PCI e a geração do .xls/.pdf ficam no
// servidor (server/caixa/).

export type TipoMedicao = "pls" | "repactuacao" | "alteracao";

export const TIPOS_MEDICAO: { valor: TipoMedicao; rotulo: string }[] = [
  { valor: "pls", rotulo: "PLS" },
  { valor: "repactuacao", rotulo: "Repactuação de prazo" },
  { valor: "alteracao", rotulo: "Alteração de projeto" },
];

export function rotuloTipoMedicao(tipo: string | null | undefined): string {
  return TIPOS_MEDICAO.find((t) => t.valor === tipo)?.rotulo ?? "PLS";
}

export const SIM_NAO = ["Sim", "Não"] as const;
export const OPCOES_COMODOS_SERVICOS = ["Inclusão", "Exclusão", "Não se aplica"] as const;
export const OPCOES_MONTAGEM = ["Pré-fabricadas em canteiro", "In loco", "Em fábrica"] as const;
export const OPCOES_FORMAS = ["Metálica", "Madeira", "EPS", "Não se aplica"] as const;
export const OPCOES_FORMAS_INCORPORADAS = ["Sim", "Não", "Não se aplica"] as const;
export const OPCOES_EXECUTOR = ["Construtora", "Profissional Autônomo"] as const;
export const OPCOES_SISTEMA_CONSTRUTIVO = [
  "Conv:Estrut Concreto, Aço ou Madeira/Vedação blocos cerâmico ou de concreto",
  "Conv:Paredes de concreto moldada no local NBR nº 16055",
  "Conv:Painéis de Paredes de concreto Pré-moldado NBR nº 16475",
  "Conv:Painéis de PVC preenchidos com concreto NBR nº 16823",
  "Conv:Light Wood Frame NBR nº 16936",
  "Conv:Light Steel Framing NBR nº 16970",
  "Conv:Painel leve modular - pré-fabricado_NBR 15575",
  "Conv:Parede Concreto Celular moldada no local NBR nº 16055",
  "Inovador:especificar sistema",
  "Outros (escolher se não encontrou na lista a solução convencional que pretende usar)",
] as const;

/** Campos da PLS (Planilha de Levantamento de Serviços). Datas em ISO aaaa-mm-dd. */
export interface DadosPls {
  dataLevantamento: string;
  houveRepactuacao: boolean;
  etapasRepactuadas: number | null;
  condicoesContratadas: boolean;
  placaAfixada: boolean;
  projetoCumprido: boolean;
  prevencaoDanos: boolean;
  alvaraEmissao: string | null;
  alvaraVigencia: string | null;
  seloCasaAzul: boolean;
  observacoes: string;
}

/** Campos da aba Repactuação_Prazo. Percentuais por etapa (índice = nº da etapa). */
export interface DadosRepactuacao {
  dataRepactuacao: string;
  prazoOriginal: number | null;
  prazoProposto: number | null;
  /** % acumulado previsto no cronograma original (vazio = o da PCI). */
  previstoOriginal: (number | null)[];
  /** % acumulado proposto para as próximas etapas. */
  acumuladoProposto: (number | null)[];
  motivo: string;
}

export interface ServicoAdicional {
  descricao: string;
  custo: number | null;
}

/** Campos da aba Alteração_Projeto_Especific. */
export interface DadosAlteracao {
  justificativa: string;
  alteraEspecificacoes: string;
  alteraArea: string;
  novaAreaCoberta: number | null;
  novaAreaPermeavel: number | null;
  novaAreaAcessoria: number | null;
  comodos: string;
  comodosQuais: string;
  servicos: string;
  servicosQuais: string;
  alteraSistema: string;
  novoSistema: string;
  especificacaoSistema: string;
  montagemParedes: string;
  tipoFormas: string;
  formasIncorporadas: string;
  paredesEstruturais: string;
  docComplementar: string;
  /** Custos (R$) dos serviços 1 a 19; o 20 é a soma dos serviços adicionais. */
  custos: (number | null)[];
  bdi: number | null;
  executor: string;
  adicionais: ServicoAdicional[];
}

export interface DadosMedicaoCaixa {
  pls: DadosPls;
  repactuacao: DadosRepactuacao | null;
  alteracao: DadosAlteracao | null;
}

export const LIMITE_TEXTO_LONGO = 2000;
export const LIMITE_TEXTO_CURTO = 250;
export const MAX_ETAPAS = 48;
export const MAX_ADICIONAIS = 4;
export const SERVICOS_ALTERACAO = 19;

export function hojeIso(agora = new Date()): string {
  return agora.toISOString().slice(0, 10);
}

export function dadosPlsPadrao(opcoes: { alvaraEmissao?: string | null; alvaraVigencia?: string | null; seloCasaAzul?: boolean } = {}): DadosPls {
  return {
    dataLevantamento: hojeIso(),
    houveRepactuacao: false,
    etapasRepactuadas: null,
    condicoesContratadas: true,
    placaAfixada: true,
    projetoCumprido: true,
    prevencaoDanos: true,
    alvaraEmissao: opcoes.alvaraEmissao ?? null,
    alvaraVigencia: opcoes.alvaraVigencia ?? null,
    seloCasaAzul: opcoes.seloCasaAzul ?? false,
    observacoes: "",
  };
}

export function dadosRepactuacaoPadrao(prazoOriginal: number | null = null): DadosRepactuacao {
  return { dataRepactuacao: hojeIso(), prazoOriginal, prazoProposto: null, previstoOriginal: [], acumuladoProposto: [], motivo: "" };
}

export function dadosAlteracaoPadrao(): DadosAlteracao {
  return {
    justificativa: "",
    alteraEspecificacoes: "Não",
    alteraArea: "Não",
    novaAreaCoberta: null,
    novaAreaPermeavel: null,
    novaAreaAcessoria: null,
    comodos: "Não se aplica",
    comodosQuais: "",
    servicos: "Não se aplica",
    servicosQuais: "",
    alteraSistema: "Não",
    novoSistema: "",
    especificacaoSistema: "",
    montagemParedes: "",
    tipoFormas: "",
    formasIncorporadas: "",
    paredesEstruturais: "",
    docComplementar: "",
    custos: Array.from({ length: SERVICOS_ALTERACAO }, () => null),
    bdi: null,
    executor: "Construtora",
    adicionais: [],
  };
}

export function dadosMedicaoPadrao(tipo: TipoMedicao, pls: DadosPls, prazoOriginal: number | null = null): DadosMedicaoCaixa {
  return {
    pls,
    repactuacao: tipo === "repactuacao" ? dadosRepactuacaoPadrao(prazoOriginal) : null,
    alteracao: tipo === "alteracao" ? dadosAlteracaoPadrao() : null,
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v: unknown) => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
const numeroOuNulo = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));
const percentualOuNulo = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100);
const textoAte = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const umaDas = (v: unknown, lista: readonly string[]) => typeof v === "string" && (v === "" || lista.includes(v));

/** Valida os campos da medição CAIXA. Lista vazia = válido. */
export function validarDadosMedicao(tipo: TipoMedicao, d: DadosMedicaoCaixa): string[] {
  const erros: string[] = [];
  const p = d.pls;
  if (!p) return ["Dados da PLS ausentes."];
  if (!dataValida(p.dataLevantamento)) erros.push("Data do levantamento inválida.");
  for (const [rotulo, v] of [["Emissão do alvará", p.alvaraEmissao], ["Vigência do alvará", p.alvaraVigencia]] as const) {
    if (v !== null && !dataValida(v)) erros.push(`${rotulo}: data inválida.`);
  }
  if (p.houveRepactuacao && (p.etapasRepactuadas === null || !Number.isInteger(p.etapasRepactuadas) || p.etapasRepactuadas < 1 || p.etapasRepactuadas > MAX_ETAPAS)) {
    erros.push("Informe o total de etapas após a repactuação.");
  }
  if (!textoAte(p.observacoes, LIMITE_TEXTO_LONGO)) erros.push("Observações muito longas.");

  if (tipo === "repactuacao") {
    const r = d.repactuacao;
    if (!r) erros.push("Preencha os dados da repactuação.");
    else {
      if (!dataValida(r.dataRepactuacao)) erros.push("Data da repactuação inválida.");
      for (const [rotulo, v] of [["Prazo original", r.prazoOriginal], ["Prazo proposto", r.prazoProposto]] as const) {
        if (v === null || !Number.isInteger(v) || v < 1 || v > MAX_ETAPAS) erros.push(`${rotulo}: informe em meses (1 a ${MAX_ETAPAS}).`);
      }
      if (r.previstoOriginal.length > MAX_ETAPAS + 1 || !r.previstoOriginal.every(percentualOuNulo)) erros.push("% acumulado previsto inválido.");
      if (r.acumuladoProposto.length > MAX_ETAPAS + 1 || !r.acumuladoProposto.every(percentualOuNulo)) erros.push("% acumulado proposto inválido.");
      if (!r.motivo.trim()) erros.push("Informe o motivo/justificativa da repactuação.");
      if (!textoAte(r.motivo, LIMITE_TEXTO_LONGO)) erros.push("Motivo muito longo.");
    }
  }

  if (tipo === "alteracao") {
    const a = d.alteracao;
    if (!a) erros.push("Preencha os dados da alteração de projeto.");
    else {
      if (!a.justificativa.trim()) erros.push("Informe a justificativa técnica.");
      if (!textoAte(a.justificativa, LIMITE_TEXTO_LONGO)) erros.push("Justificativa muito longa.");
      for (const [rotulo, v, lista] of [
        ["Alteração de especificações", a.alteraEspecificacoes, SIM_NAO],
        ["Alteração de área", a.alteraArea, SIM_NAO],
        ["Cômodos", a.comodos, OPCOES_COMODOS_SERVICOS],
        ["Serviços", a.servicos, OPCOES_COMODOS_SERVICOS],
        ["Alteração do sistema construtivo", a.alteraSistema, SIM_NAO],
        ["Novo sistema", a.novoSistema, OPCOES_SISTEMA_CONSTRUTIVO],
        ["Montagem das paredes", a.montagemParedes, OPCOES_MONTAGEM],
        ["Tipo de fôrmas", a.tipoFormas, OPCOES_FORMAS],
        ["Fôrmas incorporadas", a.formasIncorporadas, OPCOES_FORMAS_INCORPORADAS],
        ["Paredes estruturais", a.paredesEstruturais, SIM_NAO],
        ["Documentação complementar", a.docComplementar, SIM_NAO],
        ["Executor da obra", a.executor, OPCOES_EXECUTOR],
      ] as const) {
        if (!umaDas(v, lista)) erros.push(`${rotulo}: opção inválida.`);
      }
      for (const v of [a.comodosQuais, a.servicosQuais, a.especificacaoSistema]) {
        if (!textoAte(v, LIMITE_TEXTO_LONGO)) erros.push("Texto muito longo.");
      }
      for (const v of [a.novaAreaCoberta, a.novaAreaPermeavel, a.novaAreaAcessoria]) {
        if (!numeroOuNulo(v) || (v !== null && v < 0)) erros.push("Área inválida.");
      }
      if (a.custos.length !== SERVICOS_ALTERACAO || !a.custos.every((c) => c === null || (Number.isFinite(c) && c >= 0))) erros.push("Custos dos serviços inválidos.");
      if (a.bdi !== null && !(Number.isFinite(a.bdi) && a.bdi >= 0 && a.bdi <= 100)) erros.push("BDI inválido.");
      if (a.adicionais.length > MAX_ADICIONAIS) erros.push(`No máximo ${MAX_ADICIONAIS} serviços adicionais.`);
      for (const s of a.adicionais) {
        if (!textoAte(s.descricao, LIMITE_TEXTO_CURTO) || !(s.custo === null || (Number.isFinite(s.custo) && s.custo >= 0))) erros.push("Serviço adicional inválido.");
      }
    }
  }
  return erros;
}

/** Total de quadros de foto de cada modelo da CAIXA. */
export const QUADROS_FOTO: Record<TipoMedicao, number> = { pls: 12, repactuacao: 6, alteracao: 6 };

/** Mínimo de fotos exigido pela CAIXA na PLS (Cartilha Habitação PF). */
export function avisoFotosPls(qtd: number, progresso: number): string | null {
  const minimo = progresso <= 10.1 ? 6 : 12;
  return qtd < minimo ? `A CAIXA pede no mínimo ${minimo} fotos nesta etapa (enviadas: ${qtd}).` : null;
}

// ----- normalização do que chega do formulário (servidor) -----

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = LIMITE_TEXTO_LONGO) => (typeof v === "string" ? v.slice(0, max + 1) : "");
const strOuNulo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);
const numOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);

export function ehTipoMedicao(v: unknown): v is TipoMedicao {
  return v === "pls" || v === "repactuacao" || v === "alteracao";
}

/** Converte a entrada (JSON) nos tipos esperados; a validação vem depois. */
export function normalizarDadosMedicao(tipo: TipoMedicao, entrada: unknown): DadosMedicaoCaixa {
  const e = obj(entrada);
  const p = obj(e.pls);
  const base = dadosPlsPadrao();
  const pls: DadosPls = {
    dataLevantamento: typeof p.dataLevantamento === "string" ? p.dataLevantamento : base.dataLevantamento,
    houveRepactuacao: bool(p.houveRepactuacao, false),
    etapasRepactuadas: numOuNulo(p.etapasRepactuadas),
    condicoesContratadas: bool(p.condicoesContratadas, true),
    placaAfixada: bool(p.placaAfixada, true),
    projetoCumprido: bool(p.projetoCumprido, true),
    prevencaoDanos: bool(p.prevencaoDanos, true),
    alvaraEmissao: strOuNulo(p.alvaraEmissao),
    alvaraVigencia: strOuNulo(p.alvaraVigencia),
    seloCasaAzul: bool(p.seloCasaAzul, false),
    observacoes: str(p.observacoes),
  };
  let repactuacao: DadosRepactuacao | null = null;
  if (tipo === "repactuacao") {
    const r = obj(e.repactuacao);
    repactuacao = {
      dataRepactuacao: typeof r.dataRepactuacao === "string" ? r.dataRepactuacao : hojeIso(),
      prazoOriginal: numOuNulo(r.prazoOriginal),
      prazoProposto: numOuNulo(r.prazoProposto),
      previstoOriginal: lista(r.previstoOriginal, MAX_ETAPAS + 2).map(numOuNulo),
      acumuladoProposto: lista(r.acumuladoProposto, MAX_ETAPAS + 2).map(numOuNulo),
      motivo: str(r.motivo),
    };
  }
  let alteracao: DadosAlteracao | null = null;
  if (tipo === "alteracao") {
    const a = obj(e.alteracao);
    const custos = lista(a.custos, SERVICOS_ALTERACAO).map(numOuNulo);
    while (custos.length < SERVICOS_ALTERACAO) custos.push(null);
    alteracao = {
      justificativa: str(a.justificativa),
      alteraEspecificacoes: str(a.alteraEspecificacoes, 40),
      alteraArea: str(a.alteraArea, 40),
      novaAreaCoberta: numOuNulo(a.novaAreaCoberta),
      novaAreaPermeavel: numOuNulo(a.novaAreaPermeavel),
      novaAreaAcessoria: numOuNulo(a.novaAreaAcessoria),
      comodos: str(a.comodos, 40),
      comodosQuais: str(a.comodosQuais),
      servicos: str(a.servicos, 40),
      servicosQuais: str(a.servicosQuais),
      alteraSistema: str(a.alteraSistema, 40),
      novoSistema: str(a.novoSistema, 120),
      especificacaoSistema: str(a.especificacaoSistema),
      montagemParedes: str(a.montagemParedes, 60),
      tipoFormas: str(a.tipoFormas, 40),
      formasIncorporadas: str(a.formasIncorporadas, 40),
      paredesEstruturais: str(a.paredesEstruturais, 40),
      docComplementar: str(a.docComplementar, 40),
      custos,
      bdi: numOuNulo(a.bdi),
      executor: str(a.executor, 40),
      adicionais: lista(a.adicionais, MAX_ADICIONAIS + 1).map((s) => ({ descricao: str(obj(s).descricao, LIMITE_TEXTO_CURTO), custo: numOuNulo(obj(s).custo) })),
    };
  }
  return { pls, repactuacao, alteracao };
}

/** Compara a incidência de cada serviço sem arredondar para as quatro casas da tela. */
export function incidenciasCorrespondem(itens: { chave: string; incidencia: string }[], chaves: readonly string[], incidencias: readonly number[]): boolean {
  if (itens.length !== chaves.length || incidencias.length !== chaves.length || new Set(itens.map(i => i.chave)).size !== chaves.length) return false;
  const mapa = new Map(itens.map(i => [i.chave, Number(i.incidencia)]));
  return chaves.every((chave, k) => Number.isFinite(mapa.get(chave)) && Math.abs(mapa.get(chave)! - incidencias[k]) <= 1e-12);
}
