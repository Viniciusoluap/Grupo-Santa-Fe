/**
 * Lote 02, correção 03 (AD-06) — Gerador de PCI (Proposta de Construção
 * Individual da CAIXA). Regras puras compartilhadas pelo cliente e pelo
 * servidor: campos do formulário, mapa de células do modelo, normalização,
 * pré-preenchimento automático e seleção do engenheiro (RT).
 *
 * Gêmeo em Prospecta/shared/pci-gerador.ts (mesmo texto).
 *
 * As coordenadas das células são AS MESMAS que o leitor `web/src/lib/caixa/pci.ts`
 * (`lerPci`) usa, para que a PCI gerada seja lida de volta com os dados digitados.
 * Campos sem célula (`celula: null`) só aparecem no PDF.
 */

import { curvasPadraoPci, etapaCemPorCentoPci, incrementoMaximoEtapaPci } from "@/lib/pci-curvas";
import { opcaoExataPci, opcoesPci } from "@/lib/pci-listas";
import { lerNumero } from "@/lib/numero-mascara";
import { isValidCPF } from "@/lib/cpf";

export const ABA_PROPOSTA_PCI = "Proposta_Constr_Individual";

export type TipoCampoPci =
  | "texto" // texto livre
  | "numero" // número decimal
  | "inteiro"
  | "data" // ISO aaaa-mm-dd ↔ número de série do Excel
  | "documento" // CPF/CNPJ (texto com máscara)
  | "registro" // CREA, matrícula: só dígitos vira número; com letras fica texto
  | "cep" // 00000-000 ↔ número
  | "telefone" // só dígitos ↔ número
  | "coordenada" // 05° 29' 18" S ↔ número 52918 + hemisfério na célula vizinha
  | "lista"; // Lote 03, correção 07: lista (validação de dados) do modelo oficial — `opcoes` exatas

export type SecaoPci =
  | "proponente"
  | "rtp"
  | "rte"
  | "imovel"
  | "matricula"
  | "documentacao"
  | "areas"
  | "memorial"
  | "sistema"
  | "instalacoes"
  | "custos"
  | "cronograma"
  | "localizacao";

export const SECOES_PCI: { id: SecaoPci; titulo: string }[] = [
  { id: "proponente", titulo: "Proponente / cadastro" },
  { id: "rtp", titulo: "RT pelo projeto (RTP)" },
  { id: "rte", titulo: "RT pela execução da obra (RTE)" },
  { id: "imovel", titulo: "Terreno / imóvel" },
  { id: "matricula", titulo: "Matrícula / cartório" },
  { id: "documentacao", titulo: "Documentação técnica" },
  { id: "areas", titulo: "Áreas e características" },
  { id: "memorial", titulo: "Padrão / memorial descritivo" },
  { id: "sistema", titulo: "Sistema construtivo" },
  { id: "instalacoes", titulo: "Instalações / infraestrutura" },
  { id: "custos", titulo: "Custos" },
  { id: "cronograma", titulo: "Cronograma físico-financeiro" },
  { id: "localizacao", titulo: "Imagem de localização" },
];

export interface CampoPci {
  id: string;
  rotulo: string;
  secao: SecaoPci;
  /** Célula na aba Proposta_Constr_Individual; null = só no PDF. */
  celula: string | null;
  tipo: TipoCampoPci;
  /** Para coordenadas: célula do hemisfério (N/S). */
  celulaHemisferio?: string;
  /** Para coordenadas: hemisfério fixo do modelo (longitude: AC58 é o rótulo travado "W"). */
  hemisferioFixo?: string;
  /** Tipo "lista": opções EXATAS do modelo oficial (shared/pci-listas.ts). */
  opcoes?: readonly string[];
  /** Linhas que as macros do modelo só mostram em certas respostas (§1.1 do mapeamento). */
  visivel?: (campos: Record<string, ValorCampoPci>) => boolean;
  largo?: boolean;
  /**
   * EPIC-024 S-09: campo técnico que um modelo de preenchimento pode levar para outra obra.
   * Vem da lista de PERMISSÃO `CAMPOS_COPIAVEIS_MODELO_PCI` — o que não está nela nunca é copiado.
   */
  copiavel?: boolean;
}

const c = (id: string, rotulo: string, secao: SecaoPci, celula: string | null, tipo: TipoCampoPci = "texto", extra: Partial<CampoPci> = {}): CampoPci =>
  ({ id, rotulo, secao, celula, tipo, ...extra });
/** Campo de lista: as opções vêm da validação de dados da própria célula no modelo oficial. */
const l = (id: string, rotulo: string, secao: SecaoPci, celula: string, extra: Partial<CampoPci> = {}): CampoPci =>
  c(id, rotulo, secao, celula, "lista", { opcoes: opcoesPci(celula), ...extra });

export const SISTEMA_INOVADOR_PCI = "Inovador:especificar sistema";
export const SISTEMA_OUTROS_PCI = "Outros (escolher se não encontrou na lista a solução convencional que pretende usar)";
export const ESGOTO_REDE_PCI = "Rede de Esgoto";
const sistemaE = (valor: string) => (f: Record<string, ValorCampoPci>) => f.sistemaConstrutivo === valor;

/** Campos de digitação do modelo (cores roxas), na ordem da planilha. */
const CAMPOS_BASE_PCI: CampoPci[] = [
  c("proponenteNome", "Proponente", "proponente", "G44", "texto", { largo: true }),
  c("proponenteEmail", "E-mail", "proponente", "Y44"),
  c("proponenteCpf", "CPF/CNPJ", "proponente", "AK44", "documento"),
  c("proponenteDdd", "DDD", "proponente", "AQ44", "inteiro"),
  c("proponenteTelefone", "Telefone", "proponente", "AS44", "telefone"),

  c("rtpNome", "Nome do RTP", "rtp", "G47", "texto", { largo: true }),
  c("rtpEmail", "E-mail", "rtp", "Q47"),
  c("rtpRegistro", "Nº CAU/CREA/CFT", "rtp", "AB47", "registro"),
  l("rtpUf", "UF do registro", "rtp", "AI47"),
  c("rtpCpf", "CPF", "rtp", "AK47", "documento"),
  c("rtpDdd", "DDD", "rtp", "AQ47", "inteiro"),
  c("rtpTelefone", "Telefone", "rtp", "AS47", "telefone"),

  c("rteNome", "Nome do RTE", "rte", "G50", "texto", { largo: true }),
  c("rteEmail", "E-mail", "rte", "Q50"),
  c("rteRegistro", "Nº CAU/CREA/CFT", "rte", "AB50", "registro"),
  l("rteUf", "UF do registro", "rte", "AI50"),
  c("rteCpf", "CPF", "rte", "AK50", "documento"),
  c("rteDdd", "DDD", "rte", "AQ50", "inteiro"),
  c("rteTelefone", "Telefone", "rte", "AS50", "telefone"),

  c("endereco", "Endereço", "imovel", "G54", "texto", { largo: true }),
  c("complemento", "Complemento", "imovel", "AJ54"),
  c("bairro", "Bairro", "imovel", "G56"),
  c("cep", "CEP", "imovel", "V56", "cep"),
  c("municipio", "Município", "imovel", "AA56"),
  l("uf", "UF", "imovel", "AV56"),

  c("matricula", "Matrícula", "matricula", "G58", "registro"),
  c("cartorio", "ORI (Registro de Imóveis)", "matricula", "M58"),
  // Hemisfério da latitude em X58 (lista N/S do modelo).
  c("latitude", "Latitude", "matricula", "T58", "coordenada", { celulaHemisferio: "X58" }),
  // Lote 03, correção 07: AC58 é rótulo travado ("W") — o sistema não grava nele.
  c("longitude", "Longitude", "matricula", "Y58", "coordenada", { hemisferioFixo: "W" }),
  c("construtora", "Construtora (se houver)", "matricula", "AD58"),
  c("cnpjConstrutora", "CNPJ da construtora", "matricula", "AK58", "documento"),
  l("finalidade", "Finalidade", "matricula", "AQ58"),

  l("certidaoMatricula", "Certidão de matrícula do imóvel", "documentacao", "Q63"),
  l("projetoArquitetonico", "Projeto legal/arquitetônico com divisões", "documentacao", "AL63"),
  l("alvaraSituacao", "Alvará/Licença da obra", "documentacao", "Q64"),
  // Lote 03, correção 07: a validade fica em AH64 (AF64 está dentro do rótulo AC64:AG64).
  c("alvaraValidade", "Validade do alvará", "documentacao", "AH64", "data"),
  l("terrenoProprio", "Terreno é próprio", "documentacao", "AR64"),
  l("artProjetoSituacao", "ART/RRT/TRT de projeto", "documentacao", "Q65"),
  c("artProjetoNumero", "Número da ART de projeto", "documentacao", "AF65"),
  l("artExecucaoSituacao", "ART/RRT/TRT de execução", "documentacao", "Q66"),
  c("artExecucaoNumero", "Número da ART de execução", "documentacao", "AF66"),
  l("projetoLegalSituacao", "Projeto legal aprovado", "documentacao", "Q67", { largo: true }),

  c("areaCoberta", "Área coberta padrão (m²)", "areas", "G73", "numero"),
  c("areaPermeavel", "Área permeável (m²)", "areas", "N73", "numero"),
  c("areaAcessoria", "Área acessória coberta (m²)", "areas", "U73", "numero"),
  c("areaTerreno", "Área do terreno (m²)", "areas", "AJ73", "numero"),
  c("valorTerreno", "Valor proposto do terreno (R$)", "areas", "AR73", "numero"),
  l("destinacao", "Destinação do imóvel", "areas", "O74"),
  c("valorImovel", "Valor proposto do imóvel (R$)", "areas", "AK74", "numero"),
  c("valorFinanciado", "Valor financiado (R$) — informativo, só no PDF", "areas", null, "numero"),

  l("padraoAcabamento", "Padrão de acabamento", "memorial", "M96"),
  l("implantacao", "Implantação/Inserção", "memorial", "AM96"),
  l("cobertura", "Cobertura", "memorial", "G98"),
  l("teto", "Teto", "memorial", "V98"),
  // Lote 03, correção 07: no modelo os cômodos são listas com "4+" (não inteiros livres).
  l("pavimentos", "Pavimentos", "memorial", "AC98"),
  l("quartos", "Quartos", "memorial", "AF98"),
  l("suites", "Suítes", "memorial", "AI98"),
  l("salas", "Salas", "memorial", "AL98"),
  l("vagas", "Vagas", "memorial", "AO98"),
  l("tipoVagas", "Tipo de vagas", "memorial", "AR98"),
  l("paredesExternas", "Acabamento paredes externas", "memorial", "G100"),
  l("loucasMetais", "Louças e metais", "memorial", "V100"),
  l("areaServico", "Área de serviço", "memorial", "AC100"),
  l("cozinha", "Cozinha", "memorial", "AI100"),
  l("paredesInternas", "Acabamento paredes internas", "memorial", "G102"),
  l("paredesAreasSecas", "Paredes/painéis áreas secas", "memorial", "V102"),
  l("calefacao", "Calefação", "memorial", "AC102"),
  l("aguaQuente", "Água quente", "memorial", "AI102"),
  l("itensSustentabilidade", "Itens de sustentabilidade", "memorial", "AP102"),
  l("revestParedeMolhadas", "Revest. parede áreas molhadas", "memorial", "G104"),
  l("pisoAreasSecas", "Revest. piso áreas secas", "memorial", "O104"),
  l("pisoAreasMolhadas", "Revest. piso áreas molhadas", "memorial", "V104"),
  c("divisaoInterna", "Divisão interna (ambientes)", "memorial", "AC104", "texto", { largo: true }),
  l("esquadriasExternas", "Esquadrias externas", "memorial", "G106"),
  // O106 não tem validação de dados no modelo: texto livre.
  c("esquadriasInternas", "Esquadrias internas", "memorial", "O106"),
  c("outrosEspecificar", "Outros (especificar)", "memorial", "AC107", "texto", { largo: true }),

  l("sistemaConstrutivo", "Sistema construtivo", "sistema", "S75", { largo: true }),
  // Linhas 76–78 (Espec_DATec): a macro mostra quando o sistema é "Inovador".
  c("datecNumero", "DATec — nº", "sistema", "N76", "texto", { visivel: sistemaE(SISTEMA_INOVADOR_PCI) }),
  c("datecDetentor", "DATec — detentor", "sistema", "X76", "texto", { visivel: sistemaE(SISTEMA_INOVADOR_PCI) }),
  c("datecValidade", "DATec — validade", "sistema", "N77", "texto", { visivel: sistemaE(SISTEMA_INOVADOR_PCI) }),
  c("datecSistema", "DATec — nome do sistema", "sistema", "X77", "texto", { visivel: sistemaE(SISTEMA_INOVADOR_PCI) }),
  // Linha 79 (Espec_outros): a macro mostra quando o sistema é "Outros".
  c("normaAbnt", "Norma ABNT (nº)", "sistema", "L79", "texto", { visivel: sistemaE(SISTEMA_OUTROS_PCI) }),
  c("normaTitulo", "Norma ABNT (título)", "sistema", "V79", "texto", { visivel: sistemaE(SISTEMA_OUTROS_PCI) }),
  c("especificacaoSistema", "Especificação do sistema construtivo", "sistema", "Q80", "texto", { largo: true }),
  l("usoEps", "Previsão de uso de EPS", "sistema", "AB81"),
  l("montagemParedes", "Montagem/fabricação das paredes", "sistema", "AP81"),
  // Linhas 82–83 (fabricante): a macro mostra quando há uso de EPS.
  c("fabricanteEps", "Fabricante/sistemista do EPS", "sistema", "G83", "texto", { largo: true, visivel: (f) => f.usoEps === "Sim" }),
  l("paredesEstruturais", "Paredes com função estrutural", "sistema", "Q84"),
  l("tipoFormas", "Tipo de fôrmas", "sistema", "AA84"),
  l("formasPermanecem", "Fôrmas permanecem nas paredes", "sistema", "AS84"),
  l("docSistemaInovador", "Apresentou doc. complementar do sistema inovador", "sistema", "AS89"),
  l("seloCasaAzul", "Optante pelo Selo Casa Azul", "sistema", "Y93"),
  l("docSeloCasaAzul", "Documentação complementar do selo", "sistema", "AS93"),

  l("abastecimentoAgua", "Abastecimento d'água", "instalacoes", "V106"),
  l("drenagem", "Drenagem", "instalacoes", "G108"),
  l("esgoto", "Coleta/tratamento de esgoto", "instalacoes", "O108"),
  l("energiaAlternativa", "Geração alternativa de energia", "instalacoes", "V108"),
  // Linhas 109–112 (Trat_esgoto): a macro mostra quando o esgoto não é "Rede de Esgoto".
  l("esgotoDistancias", "Esgoto atende localização e distâncias", "instalacoes", "AR109", { visivel: (f) => f.esgoto !== ESGOTO_REDE_PCI }),
  l("esgotoContaminacao", "Solução impede contaminação", "instalacoes", "AR110", { visivel: (f) => f.esgoto !== ESGOTO_REDE_PCI }),
  c("esgotoDescricao", "Descrição da solução de esgoto", "instalacoes", "G112", "texto", { largo: true, visivel: (f) => f.esgoto !== ESGOTO_REDE_PCI }),

  // Lote 03, correção 07: o executor (AN140) define o limite do BDI (AN141: Construtora 18; Profissional Autônomo 6).
  l("executor", "Executor da obra", "custos", "AN140"),
  c("bdi", "BDI (%)", "custos", "X141", "numero"),
  c("justificativaIncidencias", "Justificativa (incidências/BDI fora da referência)", "custos", "AG155", "texto", { largo: true }),
  c("prazoMeses", "Prazo de execução (meses)", "cronograma", "T161", "inteiro"),
  c("preExecutado", "Obra pré-executada — etapa 0 (%)", "cronograma", "AS161", "numero"),
  // Linhas 162–163 (Just_Prazo): a macro mostra quando o prazo foge das referências (Z161).
  l("justificativaPrazo", "Tem justificativa para o prazo?", "cronograma", "M163", { visivel: (f) => alertaPrazoPci(f) !== null }),
  c("justificativaPrazoTexto", "Justificativa técnica do prazo", "cronograma", "AA163", "texto", { largo: true, visivel: (f) => alertaPrazoPci(f) !== null }),
  c("obrasPreExistentes", "Obras pré-existentes (descrição)", "cronograma", "G165", "texto", { largo: true }),
  c("observacoes", "Outras observações", "cronograma", "G245", "texto", { largo: true }),
  c("localData", "Local e data (assinatura)", "cronograma", "H258", "texto", { largo: true }),
];

/**
 * EPIC-024 S-09: lista de PERMISSÃO dos campos que um modelo de preenchimento leva de uma obra
 * para outra — só o técnico do projeto padrão (memorial, sistema construtivo, áreas da casa,
 * executor/BDI e prazo). Ficam de fora, sempre: proponente, RTP/RTE, endereço, bairro, CEP,
 * município/UF, matrícula/cartório/coordenadas, construtora, documentação da obra, área e valor
 * do terreno, valores do imóvel, abastecimento/drenagem/esgoto (dependem do lote), pré-executado,
 * obras pré-existentes, observações, local/data e a imagem. Campo novo entra fora do modelo até
 * ser incluído aqui de propósito.
 */
export const CAMPOS_COPIAVEIS_MODELO_PCI: readonly string[] = [
  "areaCoberta", "areaAcessoria", "destinacao",
  "padraoAcabamento", "implantacao", "cobertura", "teto", "pavimentos", "quartos", "suites", "salas", "vagas", "tipoVagas",
  "paredesExternas", "loucasMetais", "areaServico", "cozinha", "paredesInternas", "paredesAreasSecas", "calefacao", "aguaQuente",
  "itensSustentabilidade", "revestParedeMolhadas", "pisoAreasSecas", "pisoAreasMolhadas", "divisaoInterna", "esquadriasExternas",
  "esquadriasInternas", "outrosEspecificar",
  "sistemaConstrutivo", "datecNumero", "datecDetentor", "datecValidade", "datecSistema", "normaAbnt", "normaTitulo",
  "especificacaoSistema", "usoEps", "montagemParedes", "fabricanteEps", "paredesEstruturais", "tipoFormas", "formasPermanecem",
  "docSistemaInovador", "seloCasaAzul", "docSeloCasaAzul",
  "energiaAlternativa",
  "executor", "bdi", "justificativaIncidencias",
  "prazoMeses", "justificativaPrazo", "justificativaPrazoTexto",
];
const COPIAVEIS_PCI = new Set(CAMPOS_COPIAVEIS_MODELO_PCI);

export const CAMPOS_PCI: CampoPci[] = CAMPOS_BASE_PCI.map((campo) => (COPIAVEIS_PCI.has(campo.id) ? { ...campo, copiavel: true } : campo));

export const CAMPO_POR_ID = new Map(CAMPOS_PCI.map((campo) => [campo.id, campo]));

/**
 * EPIC-024 S-09 (portão de QA): cada PESSOA da PCI é um bloco — nome, CPF, e-mail, telefone e, no
 * RT, registro/UF e o engenheiro escolhido. Um bloco vem sempre de UMA pessoa: nunca o CPF de um
 * ao lado do nome de outro.
 */
export type PessoaPci = "proponente" | "rtp" | "rte";
export const PESSOAS_PCI: Record<PessoaPci, { rotulo: string; chaves: string[] }> = {
  proponente: { rotulo: "Proponente", chaves: CAMPOS_PCI.filter((c) => c.secao === "proponente").map((c) => c.id) },
  rtp: { rotulo: "RT pelo projeto (RTP)", chaves: ["rtpEngenheiroId", ...CAMPOS_PCI.filter((c) => c.secao === "rtp").map((c) => c.id)] },
  rte: { rotulo: "RT pela execução (RTE)", chaves: ["rteEngenheiroId", ...CAMPOS_PCI.filter((c) => c.secao === "rte").map((c) => c.id)] },
};
const CHAVES_PESSOA_PCI = [...PESSOAS_PCI.proponente.chaves, ...PESSOAS_PCI.rtp.chaves, ...PESSOAS_PCI.rte.chaves];

/** Pessoa a que a chave pertence, ou null (campo técnico, imóvel etc.). */
export function pessoaDaChavePci(chave: string): PessoaPci | null {
  for (const p of ["proponente", "rtp", "rte"] as const) if (PESSOAS_PCI[p].chaves.includes(chave)) return p;
  return null;
}

function valorDaChavePessoa(form: FormularioPci, chave: string): ValorCampoPci {
  if (chave === "rtpEngenheiroId" || chave === "rteEngenheiroId") return form[chave];
  return form.campos[chave] ?? null;
}

/** Serviços 1..19 da tabela de custos (o 20 "Outros" é a soma dos serviços adicionais). */
export const SERVICOS_CUSTO_PCI = [
  "Barracão+lig. provisórias(água/luz)+projetos/aprovs.", "Infraestrutura (estacas, brocas, baldrames, sapatas)",
  "Supraestrutura (Vigas, pilares, cintas, escadas)", "Paredes e Painéis", "Esquadrias", "Vidros e Plásticos",
  "Coberturas (estrutura e telhas)", "Impermeabilizações", "Revestimentos Internos", "Forros", "Revestimentos Externos",
  "Pinturas", "Pisos", "Acabamentos (soleiras, rodapés, peitoril etc.)", "Instalações Elétricas e Telefônicas",
  "Instalações Hidráulicas", "Instalações: Esgoto e Águas Pluviais", "Louças e Metais", "Complementos (limpeza final e calafete)",
];
export const SERVICO_OUTROS_PCI = "Outros (discriminar em Serviços Adicionais, abaixo)";
export const LINHA_CUSTO_PCI = 120; // AB120..AB138 (digitação), AB139 = fórmula (soma dos adicionais)
export const COLUNA_CUSTO_PCI = "AB";
export const LINHA_ADICIONAL_PCI = 149; // I/Z 149..158
export const TOTAL_ADICIONAIS_PCI = 10;
export const LINHA_CRONOGRAMA_PCI = 166; // AI166.. = etapa 1..n (etapa 0 é fórmula)
export const MAX_ETAPAS_PCI = 24;
/** Quadro da poligonal/localização na aba da proposta (base zero, inclusive). */
export const QUADRO_LOCALIZACAO_PCI = { coluna1: 6, linha1: 193, coluna2: 48, linha2: 213 } as const;
export const LIMITE_IMAGEM_PCI_BYTES = 1.5 * 1024 * 1024;

export type ValorCampoPci = string | number | null;

export interface ServicoAdicionalPci {
  descricao: string;
  valor: number | null;
}

export interface ImagemPci {
  tipo: "png" | "jpeg";
  /** Conteúdo em base64 (sem o prefixo data:). */
  base64: string;
}

export interface FormularioPci {
  campos: Record<string, ValorCampoPci>;
  /** Custos [R$] dos serviços 1..19. */
  custos: (number | null)[];
  adicionais: ServicoAdicionalPci[];
  /** % acumulado proposto por etapa (1..prazo). */
  cronograma: (number | null)[];
  /** Engenheiro escolhido para cada responsabilidade técnica (id do usuário). */
  rtpEngenheiroId: string | null;
  rteEngenheiroId: string | null;
  imagem: ImagemPci | null;
  /** EPIC-024 S-09: modelo de preenchimento aplicado nesta obra (só referência; os dados ficam na obra). */
  modeloOrigem?: OrigemModeloPci | null;
  /**
   * EPIC-024 S-09 (portão de QA): de onde veio cada dado de PESSOA (proponente, RTP, RTE) —
   * "manual", "engenheiro:7", "crm", "pci"… Gravado no rascunho; a geração recusa nome e CPF de
   * origens diferentes (`misturaPessoaPci`). Ausente = rascunho antigo (sem informação).
   */
  procedencia?: Record<string, string>;
  /**
   * EPIC-024 S-09 (portão de QA, iteração 2): confirmações "nome e CPF são da mesma pessoa" — quem
   * (id do usuário, gravado pelo servidor), quando e a marca de nome + CPF confirmados.
   */
  confirmacoes?: Partial<Record<PessoaPci, ConfirmacaoPessoaPci>>;
}

export interface ConfirmacaoPessoaPci {
  /** Usuário que confirmou (o servidor grava; null = ainda não registrado no servidor). Santa Fé: id texto (cuid). */
  por: string | null;
  /** ISO 8601. */
  em: string;
  /** `marcaPessoaPci`: a confirmação vale só para o nome e o CPF confirmados. */
  marca: string;
}

export interface OrigemModeloPci {
  /** Santa Fé: id texto (cuid) do modelo de preenchimento. */
  id: string;
  nome: string;
  versao: number;
}

export function formularioPciVazio(): FormularioPci {
  return {
    campos: Object.fromEntries(CAMPOS_PCI.map((campo) => [campo.id, null])),
    custos: SERVICOS_CUSTO_PCI.map(() => null),
    adicionais: Array.from({ length: TOTAL_ADICIONAIS_PCI }, () => ({ descricao: "", valor: null })),
    cronograma: [],
    rtpEngenheiroId: null,
    rteEngenheiroId: null,
    imagem: null,
    modeloOrigem: null,
    procedencia: {},
  };
}

// ─── normalização ────────────────────────────────────────────────────────────

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/**
 * Número digitado ou importado no padrão pt-BR, com a mesma regra de `lerNumero`
 * da máscara (Lote 03, correção 06): "1.000,50" → 1000,5; "101.000" → 101000
 * (ponto de milhar); "1234.56" → 1234,56; "R$ 1.234,56" → 1234,56. Vazio/ilegível → null.
 */
export function numeroPci(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  return lerNumero(v);
}

/** Arredonda para 2 casas (percentuais do cronograma), sem o erro de 1.005.toFixed(2). */
export function duasCasasPci(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function formatarCep(v: unknown): string {
  const d = soDigitos(v);
  if (!d) return "";
  return d.length <= 8 ? d.padStart(8, "0").replace(/(\d{5})(\d{3})/, "$1-$2") : String(v).trim();
}

function dataIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

/** Valor de um campo no formato do formulário (o mesmo que a leitura devolve). */
export function normalizarValorCampo(campo: CampoPci, v: unknown): ValorCampoPci {
  if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null;
  switch (campo.tipo) {
    case "numero":
      return numeroPci(v);
    case "inteiro": {
      const n = numeroPci(v);
      return n === null ? null : Math.round(n);
    }
    case "data":
      return dataIso(v);
    case "cep":
      return formatarCep(v) || null;
    case "telefone": {
      const d = soDigitos(v);
      return d || String(v).trim().slice(0, 40) || null;
    }
    case "lista": {
      // Valor gravado = opção EXATA do modelo. Valor legado fora da lista é mantido
      // (para a pessoa ver e corrigir) e bloqueia a geração em `errosPci`.
      const t = typeof v === "number" ? String(v) : String(v);
      return opcaoExataPci(campo.opcoes ?? [], t) ?? t.trim().slice(0, 2000);
    }
    case "registro":
    case "documento":
    case "coordenada":
    case "texto":
    default:
      return String(v).trim().slice(0, 2000) || null;
  }
}

/**
 * Aceita o JSON vindo do navegador (ou do banco) e devolve um formulário
 * completo e limpo — campos desconhecidos são descartados.
 */
export function normalizarFormularioPci(entrada: unknown): FormularioPci {
  const base = formularioPciVazio();
  if (!entrada || typeof entrada !== "object") return base;
  const e = entrada as Partial<Record<keyof FormularioPci, unknown>>;
  const campos = (e.campos && typeof e.campos === "object" ? e.campos : {}) as Record<string, unknown>;
  for (const campo of CAMPOS_PCI) base.campos[campo.id] = normalizarValorCampo(campo, campos[campo.id]);
  if (Array.isArray(e.custos)) base.custos = SERVICOS_CUSTO_PCI.map((_, i) => numeroPci((e.custos as unknown[])[i]));
  if (Array.isArray(e.adicionais)) {
    base.adicionais = base.adicionais.map((_, i) => {
      const a = (e.adicionais as unknown[])[i] as { descricao?: unknown; valor?: unknown } | undefined;
      return { descricao: typeof a?.descricao === "string" ? a.descricao.trim().slice(0, 500) : "", valor: numeroPci(a?.valor) };
    });
  }
  if (Array.isArray(e.cronograma)) base.cronograma = (e.cronograma as unknown[]).slice(0, MAX_ETAPAS_PCI).map((v) => { const n = numeroPci(v); return n === null ? null : duasCasasPci(n); });
  const id = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : typeof v === "number" && Number.isInteger(v) ? String(v) : null);
  base.rtpEngenheiroId = id(e.rtpEngenheiroId);
  base.rteEngenheiroId = id(e.rteEngenheiroId);
  const mo = e.modeloOrigem as { id?: unknown; nome?: unknown; versao?: unknown } | null | undefined;
  if (mo && typeof mo.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(mo.id) && typeof mo.nome === "string" && Number.isInteger(mo.versao)) {
    base.modeloOrigem = { id: mo.id, nome: mo.nome.trim().slice(0, 120), versao: Number(mo.versao) };
  }
  // Procedência só das chaves de pessoa com valor (o resto é descartado).
  const proc = e.procedencia && typeof e.procedencia === "object" ? (e.procedencia as Record<string, unknown>) : {};
  for (const chave of CHAVES_PESSOA_PCI) {
    const v = proc[chave];
    if (typeof v === "string" && v.trim() && !vazio(valorDaChavePessoa(base, chave))) base.procedencia![chave] = v.trim().slice(0, 120);
  }
  const conf = e.confirmacoes && typeof e.confirmacoes === "object" ? (e.confirmacoes as Record<string, unknown>) : {};
  for (const pessoa of ["proponente", "rtp", "rte"] as const) {
    const c = conf[pessoa] as { por?: unknown; em?: unknown; marca?: unknown } | undefined;
    if (!c || typeof c !== "object" || typeof c.marca !== "string" || !/^[0-9a-f]{8}$/.test(c.marca) || typeof c.em !== "string" || Number.isNaN(Date.parse(c.em))) continue;
    const por = typeof c.por === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(c.por) ? c.por : null;
    base.confirmacoes = { ...(base.confirmacoes ?? {}), [pessoa]: { por, em: new Date(c.em).toISOString(), marca: c.marca } };
  }
  const img = e.imagem as { tipo?: unknown; base64?: unknown } | null | undefined;
  if (img && (img.tipo === "png" || img.tipo === "jpeg") && typeof img.base64 === "string" && /^[A-Za-z0-9+/]+=*$/.test(img.base64)) {
    if ((img.base64.length / 4) * 3 > LIMITE_IMAGEM_PCI_BYTES) throw new Error("A imagem de localização deve ter até 1,5 MB.");
    base.imagem = { tipo: img.tipo, base64: img.base64 };
  }
  return base;
}

// ─── coordenadas ─────────────────────────────────────────────────────────────

/** Graus decimais → texto no padrão da PCI (`05° 29' 18" S`), 0,1" de precisão. */
export function coordenadaDecimalParaPci(valor: number, eixo: "lat" | "lng"): string {
  const h = eixo === "lat" ? (valor < 0 ? "S" : "N") : valor < 0 ? "W" : "E";
  let decimos = Math.round(Math.abs(valor) * 36000); // décimos de segundo
  const g = Math.floor(decimos / 36000);
  decimos -= g * 36000;
  const m = Math.floor(decimos / 600);
  const s = (decimos - m * 600) / 10;
  const seg = Number.isInteger(s) ? String(s).padStart(2, "0") : s.toFixed(1).padStart(4, "0");
  return `${String(g).padStart(2, "0")}° ${String(m).padStart(2, "0")}' ${seg}" ${h}`;
}

/**
 * Texto `05° 29' 18.4" S` (ou decimal) → número compacto da planilha (52918.4)
 * e hemisfério. Ilegível → null.
 */
export function coordenadaPciParaCelula(texto: string, eixo: "lat" | "lng"): { numero: number; hemisferio: string } | null {
  const t = texto.trim().toUpperCase().replace(/,/g, ".");
  const dms = /^(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['´’′]\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|''|”|″)?\s*([NSEWLO])?$/.exec(t);
  let g: number, m: number, s: number, h: string;
  if (dms) {
    g = Number(dms[1]); m = Number(dms[2]); s = Number(dms[3]);
    h = dms[4] ?? (eixo === "lat" ? "S" : "W");
  } else if (/^-?\d{1,3}(\.\d+)?$/.test(t)) {
    const partes = coordenadaDecimalParaPci(Number(t), eixo);
    return coordenadaPciParaCelula(partes, eixo);
  } else return null;
  if (m >= 60 || s >= 60) return null;
  if (h === "O") h = "W";
  if (h === "L") h = "E";
  if (eixo === "lat" ? !"NS".includes(h) : !"EW".includes(h)) return null;
  return { numero: Math.round((g * 10000 + m * 100 + s) * 10) / 10, hemisferio: h };
}

// ─── pré-preenchimento ───────────────────────────────────────────────────────

export interface EngenheiroPci {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  crea: string | null;
  creaUf: string | null;
  /**
   * EPIC-024 S-09: CPF do perfil de Engenheiro, buscado no servidor só para o engenheiro
   * escolhido (nunca vem na lista). `undefined` = não consultado (mantém o que está digitado).
   */
  cpf?: string | null;
  /** false = perfil de Engenheiro desativado (CPF/CREA/telefone do perfil não são usados). */
  perfilAtivo?: boolean;
  /** false = o usuário não tem perfil de Engenheiro. */
  temPerfil?: boolean;
}

/** Engenheiro escolhido para RTP/RTE e de onde veio a escolha (rascunho, PCI gerada, projeto). */
export interface EngenheiroDaObraPci {
  id: string;
  dados: EngenheiroPci;
  fonte: string;
  /** true = escolha explícita nesta obra (vem antes da PCI vinculada nas opções); false = inferido. */
  escolhido: boolean;
}

export interface FontesPreenchimentoPci {
  obra: {
    titulo: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    area: number | null;
    valorImovel: number | null;
    valorTerreno: number | null;
    valorFinanciado: number | null;
    /** ISO */
    inicio: string | null;
    termino: string | null;
  };
  cliente: { nome: string | null; cpf: string | null; email: string | null; telefone: string | null; endereco: string | null; bairro: string | null } | null;
  coordenadas: { lat: number; lng: number } | null;
  /** Campos lidos da PCI já vinculada à obra (mesmo mapa de células). */
  pci: FormularioPci | null;
  /** EPIC-024 S-09: engenheiros da obra, quando há fonte legítima. */
  rtp?: EngenheiroDaObraPci | null;
  rte?: EngenheiroDaObraPci | null;
  /** Nomes das fontes, para mostrar de onde veio cada valor. */
  rotulos?: { cliente?: string; pci?: string };
  /** Por que uma fonte não existe (ex.: "A obra não tem cliente do CRM vinculado."). */
  motivos?: Partial<Record<"cliente" | "pci" | "coordenadas" | "rtp" | "rte", string>>;
}

/** Telefone brasileiro → DDD + número (sem o +55). */
export function separarTelefone(v: string | null | undefined): { ddd: number | null; numero: string | null } {
  let d = soDigitos(v);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) return { ddd: Number(d.slice(0, 2)), numero: d.slice(2) };
  return { ddd: null, numero: d || null };
}

/** Meses entre início e término previstos (arredonda para cima), ou null. */
export function prazoEmMeses(inicio: string | null, termino: string | null): number | null {
  if (!inicio || !termino) return null;
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = termino.split("-").map(Number);
  if (![a1, m1, d1, a2, m2, d2].every(Number.isFinite)) return null;
  const meses = (a2 - a1) * 12 + (m2 - m1) + (d2 > d1 ? 1 : 0);
  return meses >= 1 && meses <= MAX_ETAPAS_PCI ? meses : null;
}

const vazio = (v: ValorCampoPci | undefined) => v === null || v === undefined || v === "";

// ─── sugestões com fonte e comparação (EPIC-024 S-09) ────────────────────────

/**
 * Chave de uma sugestão: id de um campo de `CAMPOS_PCI` ou um dos grupos abaixo
 * (tabelas inteiras e a escolha do engenheiro).
 */
export const GRUPOS_PCI = {
  custos: "Custos dos serviços (itens 1 a 19)",
  adicionais: "Serviços adicionais",
  cronograma: "Cronograma (% acumulado por etapa)",
  rtpEngenheiroId: "Engenheiro escolhido para o RTP",
  rteEngenheiroId: "Engenheiro escolhido para o RTE",
} as const;
export type GrupoPci = keyof typeof GRUPOS_PCI;

export interface SugestaoPci {
  chave: string;
  valor: unknown;
  /** De onde veio o valor (ex.: "Cliente do CRM (lead nº 5)"). */
  fonte: string;
  /** Quem é a fonte ("engenheiro:7", "crm", "pci"…); padrão = `fonte`. Uma pessoa vem de uma origem. */
  origem?: string;
}

export interface AusenciaPci {
  chave: string;
  rotulo: string;
  motivo: string;
}

export interface ItemPreenchidoPci {
  chave: string;
  rotulo: string;
  valor: string;
  fonte: string;
}

/** Conflito de campo que NÃO é de pessoa (técnico, imóvel, valores): confirmação por campo. */
export interface ConflitoPci {
  chave: string;
  rotulo: string;
  atual: string;
  sugerido: string;
  fonte: string;
  /** Valor já normalizado, aplicado só com confirmação (`aplicarEscolhasPci`). */
  valor: unknown;
}

/** Uma pessoa inteira sugerida por uma fonte (ou por fontes que provadamente são a mesma pessoa). */
export interface OpcaoPessoaPci {
  id: string;
  origem: string;
  fonte: string;
  /** Valores normalizados das chaves da pessoa (as ausentes ficam vazias ao escolher). */
  valores: Record<string, unknown>;
  resumo: string;
}

/** Escolha de pessoa: manter o que está na tela ou trocar a pessoa INTEIRA por uma das opções. */
export interface EscolhaPessoaPci {
  pessoa: PessoaPci;
  rotulo: string;
  atual: string;
  atualVazio: boolean;
  motivo: string;
  opcoes: OpcaoPessoaPci[];
}

export interface ResultadoPreenchimentoPci {
  /** Formulário com SÓ os campos vazios completados — nada preenchido é trocado. */
  formulario: FormularioPci;
  preenchidos: ItemPreenchidoPci[];
  /** Já estavam com o mesmo valor da fonte. */
  iguais: ItemPreenchidoPci[];
  /** Campos (não de pessoa) preenchidos com valor diferente: só trocam com confirmação. */
  conflitos: ConflitoPci[];
  /** Pessoas que precisam da escolha de quem é (nunca resolvidas campo a campo). */
  pessoas: EscolhaPessoaPci[];
  /** Não encontrados em nenhuma fonte (e ainda vazios), com o motivo. */
  naoEncontrados: AusenciaPci[];
  /** Fontes não usadas por trazerem outra pessoa. */
  avisos: string[];
}

export const rotuloChavePci = (chave: string) => (GRUPOS_PCI as Record<string, string>)[chave] ?? CAMPO_POR_ID.get(chave)?.rotulo ?? chave;

const brlTexto = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor normalizado de uma chave, ou null quando a fonte não tem nada útil. */
function normalizarSugestao(chave: string, v: unknown): unknown {
  if (chave === "custos") {
    if (!Array.isArray(v)) return null;
    const c = SERVICOS_CUSTO_PCI.map((_, i) => numeroPci(v[i]));
    return c.some((x) => x !== null) ? c : null;
  }
  if (chave === "adicionais") {
    if (!Array.isArray(v)) return null;
    const a = normalizarFormularioPci({ adicionais: v }).adicionais;
    return a.some((x) => x.descricao || x.valor !== null) ? a : null;
  }
  if (chave === "cronograma") {
    if (!Array.isArray(v)) return null;
    const c = normalizarFormularioPci({ cronograma: v }).cronograma;
    return c.some((x) => x !== null) ? c : null;
  }
  if (chave === "rtpEngenheiroId" || chave === "rteEngenheiroId") return typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : null;
  const campo = CAMPO_POR_ID.get(chave);
  return campo ? normalizarValorCampo(campo, v) : null;
}

function valorAtualPci(form: FormularioPci, chave: string): unknown {
  if (chave === "custos") return form.custos.some((x) => x !== null) ? form.custos : null;
  if (chave === "adicionais") return form.adicionais.some((x) => x.descricao || x.valor !== null) ? form.adicionais : null;
  if (chave === "cronograma") return form.cronograma.some((x) => x !== null) ? form.cronograma : null;
  if (chave === "rtpEngenheiroId" || chave === "rteEngenheiroId") return form[chave];
  const v = form.campos[chave];
  return vazio(v) ? null : v;
}

function gravarValorPci(form: FormularioPci, chave: string, valor: unknown): FormularioPci {
  if (chave === "custos") return { ...form, custos: [...(valor as (number | null)[])] };
  if (chave === "adicionais") return { ...form, adicionais: (valor as ServicoAdicionalPci[]).map((a) => ({ ...a })) };
  if (chave === "cronograma") return { ...form, cronograma: [...(valor as (number | null)[])] };
  if (chave === "rtpEngenheiroId" || chave === "rteEngenheiroId") return { ...form, [chave]: (valor as string | null) ?? null };
  return { ...form, campos: { ...form.campos, [chave]: (valor as ValorCampoPci) ?? null } };
}

/** Texto curto do valor, para a tela mostrar o que foi preenchido ou o que mudaria. */
export function textoValorPci(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (chave === "custos") {
    const c = v as (number | null)[];
    return `${c.filter((x) => x !== null).length} serviço(s), total R$ ${brlTexto(c.reduce<number>((s, x) => s + (x ?? 0), 0))}`;
  }
  if (chave === "adicionais") {
    const a = (v as ServicoAdicionalPci[]).filter((x) => x.descricao || x.valor !== null);
    return `${a.length} serviço(s) adicional(is), total R$ ${brlTexto(a.reduce((s, x) => s + (x.valor ?? 0), 0))}`;
  }
  if (chave === "cronograma") return (v as (number | null)[]).map((x) => (x === null ? "—" : `${brlTexto(x)}%`)).join(" · ");
  if (chave === "rtpEngenheiroId" || chave === "rteEngenheiroId") return `usuário nº ${String(v)}`;
  return typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v);
}

const iguaisPci = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ─── pessoas: um bloco por pessoa, sem mistura ───────────────────────────────

const nomeNormalizado = (v: unknown) =>
  typeof v === "string" ? v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim() : "";

/**
 * Procedência de quem confirmou na tela que os dados são da mesma pessoa (botão de confirmação ou
 * opção "nome igual nas duas fontes"). O servidor registra quem e quando (`registrarConfirmacoesPci`).
 */
export const ORIGEM_CONFIRMADA_PCI = "manual:confirmado";

/** Como se provou que dois blocos são a mesma pessoa (ou null: pessoas diferentes ou desconhecidas). */
export type ProvaPessoaPci = "engenheiro" | "cpf" | "nome" | null;

/**
 * Prova de que dois blocos são a MESMA pessoa: mesmo engenheiro escolhido; senão, mesmo CPF (só
 * dígitos) quando os dois têm CPF; senão, mesmo nome completo (sem acento, maiúsculas) quando os
 * dois têm nome. O nome sozinho é a prova mais fraca: homônimos existem (ver `compararPreenchimentoPci`).
 */
export function provaMesmaPessoaPci(pessoa: PessoaPci, a: Record<string, unknown>, b: Record<string, unknown>): ProvaPessoaPci {
  if (pessoa !== "proponente") {
    const ia = a[`${pessoa}EngenheiroId`], ib = b[`${pessoa}EngenheiroId`];
    if (ia && ib) return ia === ib ? "engenheiro" : null;
  }
  const ca = soDigitos(a[`${pessoa}Cpf`]), cb = soDigitos(b[`${pessoa}Cpf`]);
  if (ca && cb) return ca === cb ? "cpf" : null;
  const na = nomeNormalizado(a[`${pessoa}Nome`]), nb = nomeNormalizado(b[`${pessoa}Nome`]);
  return na && nb && na === nb ? "nome" : null;
}

export function mesmaPessoaPci(pessoa: PessoaPci, a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return provaMesmaPessoaPci(pessoa, a, b) !== null;
}

/** Valor de um dado de pessoa pronto para comparar (sem acento/caixa no nome, só dígitos no CPF/telefone…). */
function comparavelPessoa(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (chave.endsWith("Nome")) return nomeNormalizado(v);
  if (chave.endsWith("Cpf") || chave.endsWith("Telefone") || chave.endsWith("Ddd")) return soDigitos(v).replace(/^0+(?=\d)/, "");
  if (chave.endsWith("Email")) return String(v).trim().toLowerCase();
  if (chave.endsWith("Registro")) return String(v).toUpperCase().replace(/[^0-9A-Z]/g, "");
  return String(v).trim().toUpperCase();
}

/** Chaves que os DOIS blocos têm e com valores diferentes (já normalizados). */
export function divergenciasPessoaPci(pessoa: PessoaPci, a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return PESSOAS_PCI[pessoa].chaves.filter((k) => {
    const x = comparavelPessoa(k, a[k]), y = comparavelPessoa(k, b[k]);
    return x !== "" && y !== "" && x !== y;
  });
}

const temCpf = (pessoa: PessoaPci, v: Record<string, unknown>) => !!soDigitos(v[`${pessoa}Cpf`]);

function valoresPessoaForm(form: FormularioPci, pessoa: PessoaPci): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const chave of PESSOAS_PCI[pessoa].chaves) {
    const x = valorDaChavePessoa(form, chave);
    if (!vazio(x)) v[chave] = x;
  }
  return v;
}

const resumoPessoa = (valores: Record<string, unknown>, pessoa: PessoaPci) =>
  PESSOAS_PCI[pessoa].chaves.filter((k) => valores[k] !== undefined && valores[k] !== null && !k.endsWith("EngenheiroId"))
    .map((k) => `${rotuloChavePci(k)}: ${textoValorPci(k, valores[k])}`).join(" · ") || "(vazio)";

/** Impressão digital de nome + CPF da pessoa (a confirmação vale só para estes dados). */
export function marcaPessoaPci(form: FormularioPci, pessoa: PessoaPci): string {
  const t = `${nomeNormalizado(form.campos[`${pessoa}Nome`])}|${soDigitos(form.campos[`${pessoa}Cpf`])}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** Marca a confirmação na tela; quem e quando ficam a cargo do servidor (`registrarConfirmacoesPci`). */
function anotarConfirmacaoPci(form: FormularioPci, pessoa: PessoaPci, agora: Date): FormularioPci {
  return { ...form, confirmacoes: { ...(form.confirmacoes ?? {}), [pessoa]: { por: null, em: agora.toISOString(), marca: marcaPessoaPci(form, pessoa) } } };
}

/** Troca a pessoa INTEIRA: chaves sem valor na opção ficam vazias; a procedência é uma só. */
function gravarPessoaPci(form: FormularioPci, pessoa: PessoaPci, valores: Record<string, unknown>, origem: string): FormularioPci {
  let f: FormularioPci = { ...form, campos: { ...form.campos }, procedencia: { ...(form.procedencia ?? {}) } };
  for (const chave of PESSOAS_PCI[pessoa].chaves) {
    const v = valores[chave] ?? null;
    f = gravarValorPci(f, chave, v);
    if (v === null) delete f.procedencia![chave];
    else f.procedencia![chave] = origem;
  }
  return origem === ORIGEM_CONFIRMADA_PCI ? anotarConfirmacaoPci(f, pessoa, new Date()) : f;
}

/** Carimba a mesma procedência em todos os dados preenchidos da pessoa (pessoa provada ou confirmada). */
function carimbarPessoaPci(form: FormularioPci, pessoa: PessoaPci, origem: string): FormularioPci {
  const procedencia = { ...(form.procedencia ?? {}) };
  for (const chave of PESSOAS_PCI[pessoa].chaves) if (!vazio(valorDaChavePessoa(form, chave))) procedencia[chave] = origem;
  return { ...form, procedencia };
}

type BlocoPessoa = { origem: string; fonte: string; valores: Record<string, unknown>; fontes: Record<string, string> };

/** Homônimo: dois blocos com o mesmo nome e nada mais que prove ser a mesma pessoa. */
type HomonimoPessoa = { a: BlocoPessoa; b: BlocoPessoa; divergentes: string[] };

export const ROTULO_NOME_IGUAL_PCI = "nome igual nas duas fontes; confira se é a mesma pessoa";

/** Opção montada com duas fontes (só quando nada diverge): rotulada e, se escolhida, vale como confirmação. */
function blocoCombinado(a: BlocoPessoa, b: BlocoPessoa): BlocoPessoa {
  const valores = { ...a.valores }, fontes = { ...a.fontes };
  for (const [k, v] of Object.entries(b.valores)) if (!(k in valores)) { valores[k] = v; fontes[k] = b.fontes[k]; }
  return { origem: ORIGEM_CONFIRMADA_PCI, fonte: `${a.fonte} + ${b.fonte} (${ROTULO_NOME_IGUAL_PCI})`, valores, fontes };
}

function motivoHomonimo(pessoa: PessoaPci, divergentes: string[]): string {
  const dif = divergentes.length
    ? `Os outros dados são diferentes (${divergentes.map(rotuloChavePci).join(", ")}): os dois valores estão nas opções.`
    : "Só uma das fontes tem CPF: juntar as duas poria esse CPF ao lado dos dados da outra fonte.";
  return `${PESSOAS_PCI[pessoa].rotulo}: o nome é igual, mas só o nome não prova que é a mesma pessoa. ${dif}`;
}

/**
 * Compara as sugestões com o formulário atual. Campos que não são de pessoa: completa SÓ o vazio,
 * separa o igual e o diferente (conflito por campo, nunca trocado sem confirmação). Pessoas
 * (proponente, RTP, RTE): cada fonte forma um bloco; blocos só se juntam quando provadamente são a
 * mesma pessoa (`provaMesmaPessoaPci`): mesmo engenheiro ou mesmo CPF; com o NOME sozinho, só quando
 * nenhum dado presente nos dois lados diverge e a junção não acrescenta um CPF a quem não tinha. Um
 * bloco só preenche em silêncio quando a pessoa está vazia na tela e há um único candidato, ou quando
 * a tela já tem a MESMA pessoa (provada) e só faltam dados; em qualquer outro caso a pessoa vai
 * inteira para escolha (`pessoas`), com as duas opções à vista. Assim nenhum caminho põe o CPF de uma
 * pessoa ao lado do nome de outra, e nenhum valor diferente some sem aviso.
 */
export function compararPreenchimentoPci(form: FormularioPci, sugestoes: SugestaoPci[], ausencias: AusenciaPci[] = []): ResultadoPreenchimentoPci {
  const r: ResultadoPreenchimentoPci = { formulario: form, preenchidos: [], iguais: [], conflitos: [], pessoas: [], naoEncontrados: [], avisos: [] };
  let novo: FormularioPci = { ...form, campos: { ...form.campos }, procedencia: { ...(form.procedencia ?? {}) } };
  const vistas = new Set<string>();
  const blocos: Record<PessoaPci, BlocoPessoa[]> = { proponente: [], rtp: [], rte: [] };
  for (const s of sugestoes) {
    const valor = normalizarSugestao(s.chave, s.valor);
    if (valor === null) continue;
    const pessoa = pessoaDaChavePci(s.chave);
    if (pessoa) {
      const origem = s.origem ?? s.fonte;
      let b = blocos[pessoa].find((x) => x.origem === origem);
      if (!b) blocos[pessoa].push((b = { origem, fonte: s.fonte, valores: {}, fontes: {} }));
      if (!(s.chave in b.valores)) { b.valores[s.chave] = valor; b.fontes[s.chave] = s.fonte; }
      continue;
    }
    if (vistas.has(s.chave)) continue;
    vistas.add(s.chave);
    const rotulo = rotuloChavePci(s.chave);
    const atual = valorAtualPci(form, s.chave);
    if (atual === null) {
      novo = gravarValorPci(novo, s.chave, valor);
      r.preenchidos.push({ chave: s.chave, rotulo, valor: textoValorPci(s.chave, valor), fonte: s.fonte });
    } else if (iguaisPci(atual, valor)) r.iguais.push({ chave: s.chave, rotulo, valor: textoValorPci(s.chave, valor), fonte: s.fonte });
    else r.conflitos.push({ chave: s.chave, rotulo, atual: textoValorPci(s.chave, atual), sugerido: textoValorPci(s.chave, valor), fonte: s.fonte, valor });
  }

  const comBloco = new Set<string>();
  for (const pessoa of ["proponente", "rtp", "rte"] as const) {
    const rotulo = PESSOAS_PCI[pessoa].rotulo;
    // Junta só o que é provadamente a mesma pessoa: o primeiro bloco (maior prioridade) vence; o outro completa.
    const candidatos: BlocoPessoa[] = [];
    const homonimos: HomonimoPessoa[] = [];
    for (const b of blocos[pessoa]) {
      for (const k of Object.keys(b.valores)) comBloco.add(k);
      let juntou = false;
      for (const c of candidatos) {
        const prova = provaMesmaPessoaPci(pessoa, c.valores, b.valores);
        if (!prova) continue;
        const divergentes = divergenciasPessoaPci(pessoa, c.valores, b.valores);
        if (prova === "nome" && (divergentes.length || temCpf(pessoa, c.valores) !== temCpf(pessoa, b.valores))) {
          homonimos.push({ a: c, b, divergentes });
          continue;
        }
        // Mesma pessoa provada: o valor diferente da fonte de menor prioridade é dito, nunca some calado.
        for (const k of divergentes) r.avisos.push(`${rotulo}: "${b.fonte}" traz ${rotuloChavePci(k).toLowerCase()} diferente (${textoValorPci(k, b.valores[k])}); ficou o de "${c.fonte}" (${textoValorPci(k, c.valores[k])}).`);
        for (const [k, v] of Object.entries(b.valores)) if (!(k in c.valores)) { c.valores[k] = v; c.fontes[k] = b.fontes[k]; }
        c.origem = `${c.origem}+${b.origem}`;
        c.fonte = `${c.fonte} + ${b.fonte}`;
        juntou = true;
        break;
      }
      if (!juntou) candidatos.push({ ...b, valores: { ...b.valores }, fontes: { ...b.fontes } });
    }
    if (!candidatos.length) continue;
    const atual = valoresPessoaForm(form, pessoa);
    const opcao = (c: BlocoPessoa, i: number): OpcaoPessoaPci => ({ id: `${pessoa}-${i}`, origem: c.origem, fonte: c.fonte, valores: c.valores, resumo: resumoPessoa(c.valores, pessoa) });
    const escolha = (opcoes: BlocoPessoa[], motivo: string) =>
      r.pessoas.push({ pessoa, rotulo, atual: resumoPessoa(atual, pessoa), atualVazio: !Object.keys(atual).length, motivo, opcoes: opcoes.map(opcao) });
    const preencher = (c: BlocoPessoa, chaves: string[]) => {
      for (const k of chaves) r.preenchidos.push({ chave: k, rotulo: `${rotuloChavePci(k)} (${rotulo})`, valor: textoValorPci(k, c.valores[k]), fonte: c.fontes[k] });
    };

    if (!Object.keys(atual).length) {
      if (candidatos.length > 1) {
        // Homônimos sem divergência: além de cada fonte sozinha, a opção com as duas (rotulada).
        const combinados = homonimos.filter((h) => !h.divergentes.length && candidatos.includes(h.a)).map((h) => blocoCombinado(h.a, candidatos.find((c) => c.origem === h.b.origem) ?? h.b));
        const motivo = homonimos.length
          ? `${motivoHomonimo(pessoa, homonimos[0].divergentes)} Escolha uma opção (os dados vêm todos dela).`
          : "As fontes trazem pessoas diferentes: escolha uma (os dados vêm todos dela).";
        escolha([...candidatos, ...combinados], motivo);
        continue;
      }
      const c = candidatos[0];
      novo = gravarPessoaPci(novo, pessoa, c.valores, c.origem);
      preencher(c, PESSOAS_PCI[pessoa].chaves.filter((k) => k in c.valores));
      continue;
    }
    const provas = candidatos.map((c) => provaMesmaPessoaPci(pessoa, atual, c.valores));
    const mesma = candidatos.filter((_, i) => provas[i]);
    for (const c of candidatos) if (!mesma.includes(c)) r.avisos.push(`${rotulo}: "${c.fonte}" traz outra pessoa (${resumoPessoa(c.valores, pessoa)}) e não foi usada.`);
    if (!mesma.length) {
      escolha(candidatos, "A tela já tem dados desta pessoa e a fonte não confirma que é a mesma (CPF ou nome completo iguais). Escolha manter ou trocar a pessoa inteira.");
      continue;
    }
    const c = mesma[0];
    const prova = provas[candidatos.indexOf(c)];
    const chaves = PESSOAS_PCI[pessoa].chaves.filter((k) => k in c.valores);
    // Comparação normalizada (acento/caixa no nome, pontuação no CPF/telefone não contam como diferença).
    const diferentes = divergenciasPessoaPci(pessoa, atual, c.valores);
    const faltando = chaves.filter((k) => !(k in atual));
    if (prova === "nome") {
      const divergentes = diferentes;
      if (divergentes.length) {
        escolha([c], `${motivoHomonimo(pessoa, divergentes)} Escolha manter a tela ou trocar a pessoa inteira.`);
        continue;
      }
      if (faltando.length && temCpf(pessoa, atual) !== temCpf(pessoa, c.valores)) {
        const tela: BlocoPessoa = { origem: "tela", fonte: "o que está na tela", valores: atual, fontes: {} };
        escolha([c, blocoCombinado(tela, c)], `${motivoHomonimo(pessoa, [])} Escolha manter a tela, trocar a pessoa inteira ou juntar as duas.`);
        continue;
      }
    }
    if (diferentes.length) {
      escolha([c], `Mesma pessoa (${prova === "nome" ? "nome igual" : prova === "cpf" ? "CPF igual" : "mesmo engenheiro"}), com dados diferentes em: ${diferentes.map(rotuloChavePci).join(", ")}. Escolha manter ou trocar a pessoa inteira.`);
      continue;
    }
    for (const k of chaves.filter((k) => k in atual)) r.iguais.push({ chave: k, rotulo: `${rotuloChavePci(k)} (${rotulo})`, valor: textoValorPci(k, c.valores[k]), fonte: c.fontes[k] });
    if (faltando.length) {
      for (const k of faltando) novo = gravarValorPci(novo, k, c.valores[k]);
      novo = carimbarPessoaPci(novo, pessoa, c.origem);
      preencher(c, faltando);
    }
  }
  r.formulario = novo;
  const ja = new Set<string>();
  for (const a of ausencias) {
    if (vistas.has(a.chave) || comBloco.has(a.chave) || ja.has(a.chave) || valorAtualPci(novo, a.chave) !== null) continue;
    ja.add(a.chave);
    r.naoEncontrados.push(a);
  }
  return r;
}

/**
 * Aplica as escolhas da pessoa: conflitos de campo marcados (só campos que NÃO são de pessoa — os de
 * pessoa são ignorados aqui) e, por pessoa, a opção escolhida, que troca a pessoa INTEIRA. `null` ou
 * ausente = manter o que está na tela. Nenhuma combinação deixa uma pessoa com dados de duas fontes.
 */
export function aplicarEscolhasPci(form: FormularioPci, escolhas: { conflitos?: Pick<ConflitoPci, "chave" | "valor">[]; pessoas?: Partial<Record<PessoaPci, Pick<OpcaoPessoaPci, "valores" | "origem"> | null>> }): FormularioPci {
  let f = (escolhas.conflitos ?? []).filter((c) => !pessoaDaChavePci(c.chave)).reduce((acc, c) => gravarValorPci(acc, c.chave, c.valor), form);
  for (const pessoa of ["proponente", "rtp", "rte"] as const) {
    const o = escolhas.pessoas?.[pessoa];
    if (o) f = gravarPessoaPci(f, pessoa, o.valores, o.origem);
  }
  return f;
}

/** Digitação na tela: o dado de pessoa passa a ser "manual" (a geração confere a mistura). */
export function definirCampoPci(form: FormularioPci, chave: string, valor: ValorCampoPci): FormularioPci {
  const f: FormularioPci = { ...form, campos: { ...form.campos, [chave]: valor } };
  if (!pessoaDaChavePci(chave)) return f;
  const procedencia = { ...(form.procedencia ?? {}) };
  if (vazio(valor)) delete procedencia[chave];
  else procedencia[chave] = "manual";
  return { ...f, procedencia };
}

/**
 * "Confirmo que são da mesma pessoa": todos os dados preenchidos da pessoa ficam com a mesma
 * procedência e a confirmação é anotada (quando e a marca de nome + CPF); quem confirmou é gravado
 * pelo servidor ao salvar ou gerar (`registrarConfirmacoesPci`).
 */
export function confirmarMesmaPessoaPci(form: FormularioPci, pessoa: PessoaPci, agora: Date = new Date()): FormularioPci {
  return anotarConfirmacaoPci(carimbarPessoaPci(form, pessoa, ORIGEM_CONFIRMADA_PCI), pessoa, agora);
}

export interface MisturaPessoaPci {
  pessoa: PessoaPci;
  /** "origens": nome e CPF de fontes diferentes; "legado": rascunho anterior à conferência de origem. */
  motivo: "origens" | "legado";
  mensagem: string;
}

/**
 * Guarda da geração: nome e CPF da mesma pessoa com procedências diferentes (ex.: nome do CRM e CPF
 * da PCI vinculada, ou nome digitado ao lado do CPF de outra fonte). Nome e CPF SEM procedência
 * (rascunho salvo antes da conferência de origem — o código anterior podia pôr o CPF do CRM ao lado
 * do nome da PCI vinculada) também pedem a confirmação, uma vez por pessoa.
 */
export function misturaPessoaPci(form: FormularioPci): MisturaPessoaPci[] {
  const p = form.procedencia ?? {};
  const r: MisturaPessoaPci[] = [];
  const botao = 'confirme (botão "Confirmo que nome e CPF são da mesma pessoa"), ou corrija';
  for (const pessoa of ["proponente", "rtp", "rte"] as const) {
    const nome = `${pessoa}Nome`, cpf = `${pessoa}Cpf`;
    if (vazio(form.campos[nome]) || vazio(form.campos[cpf]) || (p[nome] && p[cpf] && p[nome] === p[cpf])) continue;
    const rotulo = PESSOAS_PCI[pessoa].rotulo;
    if (!p[nome] || !p[cpf]) {
      r.push({ pessoa, motivo: "legado", mensagem: `${rotulo}: rascunho anterior à conferência de origem — não há registro de onde vieram o nome e o CPF (a versão anterior do sistema podia juntar dados de fontes diferentes). Confira se são da mesma pessoa e ${botao}.` });
      continue;
    }
    r.push({ pessoa, motivo: "origens", mensagem: `${rotulo}: o nome e o CPF vieram de fontes diferentes. Confira se são da mesma pessoa e ${botao}.` });
  }
  return r;
}

/**
 * Servidor (portão de QA, iteração 2): grava QUEM confirmou e QUANDO. Confirmação nova (ou de outro
 * nome/CPF) recebe o usuário e a hora do servidor; a já registrada para o mesmo nome + CPF fica como
 * estava. Pessoa que não está mais confirmada perde o registro. `novas` = pessoas a registrar no log.
 */
export function registrarConfirmacoesPci(form: FormularioPci, anterior: FormularioPci | null, usuarioId: string, agora: Date): { formulario: FormularioPci; novas: PessoaPci[] } {
  const p = form.procedencia ?? {};
  const confirmacoes: Partial<Record<PessoaPci, ConfirmacaoPessoaPci>> = {};
  const novas: PessoaPci[] = [];
  for (const pessoa of ["proponente", "rtp", "rte"] as const) {
    const nome = `${pessoa}Nome`, cpf = `${pessoa}Cpf`;
    if (vazio(form.campos[nome]) || vazio(form.campos[cpf]) || p[nome] !== ORIGEM_CONFIRMADA_PCI || p[cpf] !== ORIGEM_CONFIRMADA_PCI) continue;
    const marca = marcaPessoaPci(form, pessoa);
    const antes = anterior?.confirmacoes?.[pessoa];
    if (antes && antes.por && antes.marca === marca) { confirmacoes[pessoa] = antes; continue; }
    confirmacoes[pessoa] = { por: usuarioId, em: agora.toISOString(), marca };
    novas.push(pessoa);
  }
  const { confirmacoes: _descartadas, ...resto } = form;
  return { formulario: Object.keys(confirmacoes).length ? { ...resto, confirmacoes } : resto, novas };
}

// Santa Fé: o id do engenheiro é texto (cuid), não número como na Prospecta.
const ORIGEM_CONFERIVEL_PCI = /^(engenheiro:[A-Za-z0-9_-]{1,64}|crm|pci)$/;

/**
 * Servidor (portão de QA, iteração 2): não confia na procedência que vem do navegador. Uma origem
 * conferível ("engenheiro:7", "crm", "pci", ou a junção "pci+crm") só fica se o valor do campo for
 * igual ao que essa fonte tem hoje (`sugestoes`, as mesmas de "Dados automáticos"); senão — ou
 * origem desconhecida — vira "manual". "manual" e a confirmação ficam como estão.
 */
export function conferirProcedenciaPci(form: FormularioPci, sugestoes: SugestaoPci[]): { formulario: FormularioPci; rebaixadas: string[] } {
  const p = { ...(form.procedencia ?? {}) };
  const daFonte = new Map<string, unknown>();
  for (const s of sugestoes) {
    const k = `${s.origem ?? s.fonte}|${s.chave}`;
    if (daFonte.has(k)) continue;
    const v = normalizarSugestao(s.chave, s.valor);
    if (v !== null) daFonte.set(k, v);
  }
  const rebaixadas: string[] = [];
  for (const [chave, origem] of Object.entries(p)) {
    if (origem === "manual" || origem === ORIGEM_CONFIRMADA_PCI) continue;
    const partes = origem.split("+");
    const atual = valorDaChavePessoa(form, chave);
    const confere = partes.every((o) => ORIGEM_CONFERIVEL_PCI.test(o)) && partes.some((o) => daFonte.has(`${o}|${chave}`) && iguaisPci(daFonte.get(`${o}|${chave}`), atual));
    if (!confere) { p[chave] = "manual"; rebaixadas.push(chave); }
  }
  return { formulario: { ...form, procedencia: p }, rebaixadas };
}

const PAPEL_PCI = { rtp: "RTP", rte: "RTE" } as const;

/** Sugestões dos campos de RTP/RTE vindas do perfil do engenheiro (uma origem só). */
function sugestoesEngenheiroPci(papel: "rtp" | "rte", e: EngenheiroDaObraPci): SugestaoPci[] {
  const fonte = `${e.fonte} — perfil de ${e.dados.nome ?? "engenheiro"}`;
  const origem = `engenheiro:${e.id}`;
  const tel = separarTelefone(e.dados.telefone);
  return ([
    [`${papel}EngenheiroId`, e.id], [`${papel}Nome`, e.dados.nome], [`${papel}Cpf`, e.dados.cpf ?? null], [`${papel}Email`, e.dados.email],
    [`${papel}Registro`, e.dados.crea], [`${papel}Uf`, e.dados.creaUf], [`${papel}Ddd`, tel.ddd], [`${papel}Telefone`, tel.numero],
  ] as const).map(([chave, valor]) => ({ chave, valor, fonte: chave.endsWith("EngenheiroId") ? e.fonte : fonte, origem }));
}

type FonteEsperadaPci = "cliente" | "obra" | "coordenadas" | "rtp" | "rte" | "pci";

/** Campos que a tela informa quando nenhuma fonte trouxe valor. */
const ESPERADOS_PCI: { chave: string; fonte: FonteEsperadaPci; motivo?: string }[] = [
  ...["proponenteNome", "proponenteCpf", "proponenteEmail", "proponenteTelefone"].map((chave) => ({ chave, fonte: "cliente" as const })),
  { chave: "endereco", fonte: "obra", motivo: "A obra e o cliente do CRM estão sem endereço." },
  { chave: "bairro", fonte: "cliente", motivo: "O bairro vem só do cliente do CRM ou da PCI vinculada." },
  { chave: "municipio", fonte: "obra", motivo: "A obra está sem cidade." },
  { chave: "uf", fonte: "obra", motivo: "A obra está sem UF." },
  { chave: "latitude", fonte: "coordenadas" },
  { chave: "longitude", fonte: "coordenadas" },
  { chave: "areaCoberta", fonte: "obra", motivo: "A obra está sem área construída." },
  { chave: "valorImovel", fonte: "obra", motivo: "Sem VGV na obra e sem valor de simulação no cliente do CRM." },
  { chave: "valorTerreno", fonte: "obra", motivo: "A obra está sem custo do lote." },
  { chave: "prazoMeses", fonte: "obra", motivo: "A obra está sem início e término previstos (ou o prazo passa de 24 meses)." },
  ...(["rtp", "rte"] as const).flatMap((papel) => ["Nome", "Cpf", "Registro", "Uf", "Email", "Telefone"].map((s) => ({ chave: `${papel}${s}`, fonte: papel }))),
  { chave: "custos", fonte: "pci", motivo: "Os custos vêm só da PCI vinculada ou de um modelo de preenchimento." },
  { chave: "cronograma", fonte: "pci", motivo: "O cronograma vem só da PCI vinculada ou de um modelo de preenchimento." },
];

/** Motivo de um dado do engenheiro não ter vindo — perfil desativado/ausente é dito como tal. */
function motivoEngenheiroPci(e: EngenheiroDaObraPci, chave: string): string {
  const nome = e.dados.nome ?? "engenheiro";
  if (e.dados.temPerfil === false) return `${nome} não tem perfil de Engenheiro (Configurações › Usuários).`;
  if (e.dados.perfilAtivo === false) return `O perfil de Engenheiro de ${nome} está desativado: CPF, CREA e telefone do perfil não são usados. Reative em Configurações › Usuários.`;
  return `O perfil de ${nome} não tem ${rotuloChavePci(chave).toLowerCase()} cadastrado (Configurações › Usuários).`;
}

/**
 * Sugestões de "Dados automáticos", em ordem de prioridade: (1) engenheiro escolhido nesta obra,
 * (2) PCI já vinculada à obra (a proposta oficial enviada), (3) cadastro do cliente/lead e da obra,
 * localização e engenheiro inferido. Cada fonte leva sua `origem`: pessoas não se misturam
 * (`compararPreenchimentoPci`). Nada é inventado: sem fonte, o campo entra em `ausencias`.
 */
export function sugestoesAutomaticasPci(f: FontesPreenchimentoPci): { sugestoes: SugestaoPci[]; ausencias: AusenciaPci[] } {
  const s: SugestaoPci[] = [];
  const engenheiros = (["rtp", "rte"] as const).map((papel) => [papel, f[papel] ?? null] as const);
  for (const [papel, e] of engenheiros) if (e?.escolhido) s.push(...sugestoesEngenheiroPci(papel, e));
  if (f.pci) {
    const p = normalizarFormularioPci(f.pci);
    const fonte = f.rotulos?.pci ?? "PCI vinculada à obra";
    const add = (chave: string, valor: unknown) => s.push({ chave, valor, fonte, origem: "pci" });
    for (const campo of CAMPOS_PCI) add(campo.id, p.campos[campo.id]);
    add("custos", p.custos);
    add("adicionais", p.adicionais);
    add("cronograma", p.cronograma);
  }
  const cli = f.cliente;
  const fonteCli = f.rotulos?.cliente ?? "Cliente do CRM";
  const addCli = (chave: string, valor: unknown) => s.push({ chave, valor, fonte: fonteCli, origem: "crm" });
  if (cli) {
    addCli("proponenteNome", cli.nome);
    addCli("proponenteEmail", cli.email);
    addCli("proponenteCpf", cli.cpf);
    const tel = separarTelefone(cli.telefone);
    addCli("proponenteDdd", tel.ddd);
    addCli("proponenteTelefone", tel.numero);
  }
  const add = (chave: string, valor: unknown, fonte: string) => s.push({ chave, valor, fonte });
  const fonteObra = "Cadastro da obra";
  if (f.obra.endereco) add("endereco", f.obra.endereco, fonteObra);
  else if (cli?.endereco) add("endereco", cli.endereco, fonteCli);
  if (cli) add("bairro", cli.bairro, fonteCli);
  add("municipio", f.obra.cidade, fonteObra);
  add("uf", f.obra.uf, fonteObra);
  add("areaCoberta", f.obra.area, fonteObra);
  add("valorImovel", f.obra.valorImovel, fonteObra);
  add("valorTerreno", f.obra.valorTerreno, fonteObra);
  add("valorFinanciado", f.obra.valorFinanciado, fonteObra);
  add("prazoMeses", prazoEmMeses(f.obra.inicio, f.obra.termino), "Cadastro da obra (início e término previstos)");
  if (f.coordenadas) {
    add("latitude", coordenadaDecimalParaPci(f.coordenadas.lat, "lat"), "Localização da obra (mapa)");
    add("longitude", coordenadaDecimalParaPci(f.coordenadas.lng, "lng"), "Localização da obra (mapa)");
  }
  for (const [papel, e] of engenheiros) if (e && !e.escolhido) s.push(...sugestoesEngenheiroPci(papel, e));

  const ausencias: AusenciaPci[] = [];
  const temValor = new Set(s.filter((x) => normalizarSugestao(x.chave, x.valor) !== null).map((x) => x.chave));
  for (const esp of ESPERADOS_PCI) {
    if (temValor.has(esp.chave)) continue;
    let motivo = esp.motivo ?? "";
    if (esp.fonte === "cliente") motivo = cli ? `O cliente do CRM não tem ${rotuloChavePci(esp.chave).toLowerCase()} cadastrado.` : f.motivos?.cliente ?? "A obra não tem cliente do CRM vinculado.";
    if (esp.fonte === "coordenadas") motivo = f.motivos?.coordenadas ?? "A obra não tem localização no mapa.";
    if (esp.fonte === "rtp" || esp.fonte === "rte") {
      const e = f[esp.fonte];
      motivo = e ? motivoEngenheiroPci(e, esp.chave) : f.motivos?.[esp.fonte] ?? `Nenhum engenheiro escolhido para o ${PAPEL_PCI[esp.fonte]} nesta obra.`;
    }
    if (esp.fonte === "pci" && f.motivos?.pci) motivo = `${motivo} ${f.motivos.pci}`;
    const papel = esp.fonte === "rtp" || esp.fonte === "rte" ? ` (${PAPEL_PCI[esp.fonte]})` : "";
    ausencias.push({ chave: esp.chave, rotulo: `${rotuloChavePci(esp.chave)}${papel}`, motivo });
  }
  return { sugestoes: s, ausencias };
}

/**
 * Formulário pré-preenchido (abertura da tela sem rascunho): as mesmas fontes de "Dados
 * automáticos" aplicadas num formulário vazio. Pessoa com fontes divergentes fica vazia (a tela
 * mostra a escolha). Nada é inventado: sem fonte, o campo fica vazio.
 */
export function preencherPciAutomatico(f: FontesPreenchimentoPci): FormularioPci {
  return compararPreenchimentoPci(formularioPciVazio(), sugestoesAutomaticasPci(f).sugestoes).formulario;
}

/**
 * Seleção do engenheiro em RTP/RTE: nome, CPF, e-mail, telefone e CREA/UF vêm do perfil. Sem
 * CREA/CPF no perfil, o campo fica vazio (nunca inventado nem herdado do engenheiro anterior).
 * `cpf` não consultado (`undefined`) mantém o CPF digitado — e aí a geração confere a mistura.
 */
export function aplicarEngenheiroPci(form: FormularioPci, papel: "rtp" | "rte", engenheiroId: string | null, eng: EngenheiroPci | null): FormularioPci {
  const campos = { ...form.campos };
  const procedencia = { ...(form.procedencia ?? {}) };
  const novo: FormularioPci = { ...form, campos, procedencia, [papel === "rtp" ? "rtpEngenheiroId" : "rteEngenheiroId"]: engenheiroId };
  if (!eng) { delete procedencia[`${papel}EngenheiroId`]; return novo; }
  const tel = separarTelefone(eng.telefone);
  campos[`${papel}Nome`] = eng.nome?.trim() || null;
  campos[`${papel}Email`] = eng.email?.trim() || null;
  campos[`${papel}Registro`] = eng.crea?.trim() || null;
  campos[`${papel}Uf`] = eng.creaUf?.trim() || null;
  if (eng.cpf !== undefined) campos[`${papel}Cpf`] = eng.cpf?.trim() || null;
  campos[`${papel}Ddd`] = tel.ddd;
  campos[`${papel}Telefone`] = tel.numero;
  const origem = `engenheiro:${engenheiroId ?? "?"}`;
  for (const chave of PESSOAS_PCI[papel].chaves) {
    if (chave === `${papel}Cpf` && eng.cpf === undefined) continue;
    if (vazio(valorDaChavePessoa(novo, chave))) delete procedencia[chave];
    else procedencia[chave] = origem;
  }
  return novo;
}

/** Campos de RTP/RTE já preenchidos que a escolha do engenheiro trocaria (para confirmar antes). */
export function camposTrocadosPorEngenheiroPci(form: FormularioPci, papel: "rtp" | "rte", eng: EngenheiroPci): string[] {
  const depois = aplicarEngenheiroPci(form, papel, null, eng).campos;
  return ["Nome", "Cpf", "Email", "Registro", "Uf", "Ddd", "Telefone"]
    .map((s) => `${papel}${s}`)
    .filter((id) => !vazio(form.campos[id]) && String(form.campos[id]) !== String(depois[id] ?? ""))
    .map((id) => CAMPO_POR_ID.get(id)?.rotulo ?? id);
}

/** O que falta no perfil do engenheiro para a PCI (a tela avisa; nada é inventado). */
export function faltasPerfilEngenheiroPci(eng: EngenheiroPci): string[] {
  const f: string[] = [];
  if (!eng.cpf) f.push("CPF");
  if (!eng.crea) f.push("CREA");
  if (!eng.creaUf) f.push("UF do CREA");
  if (!eng.telefone) f.push("telefone");
  if (!eng.email) f.push("e-mail");
  return f;
}

// ─── modelos de preenchimento (EPIC-024 S-09) ────────────────────────────────

/** Só os dados técnicos que um modelo de preenchimento guarda (lista de permissão). */
export interface DadosModeloPreenchimentoPci {
  campos: Record<string, ValorCampoPci>;
  custos: (number | null)[];
  adicionais: ServicoAdicionalPci[];
  cronograma: (number | null)[];
}

export const LIMITE_NOME_MODELO_PCI = 120;

/**
 * Extrai de um formulário (ou de um JSON gravado) SÓ o que está na lista de permissão
 * `CAMPOS_COPIAVEIS_MODELO_PCI`, mais custos, serviços adicionais e cronograma. Proponente,
 * RTP/RTE, endereço, coordenadas, matrícula, imagem, engenheiros escolhidos e qualquer campo
 * desconhecido ficam de fora — também na leitura (defesa contra JSON antigo ou adulterado).
 * Campo de lista só entra com uma opção EXATA do modelo oficial (texto livre fora da lista, não).
 */
export function extrairModeloPreenchimentoPci(entrada: unknown): DadosModeloPreenchimentoPci {
  const e = entrada && typeof entrada === "object" ? (entrada as Record<string, unknown>) : {};
  const proprio = (k: string) => (Object.prototype.hasOwnProperty.call(e, k) ? e[k] : undefined);
  const f = normalizarFormularioPci({ campos: proprio("campos"), custos: proprio("custos"), adicionais: proprio("adicionais"), cronograma: proprio("cronograma") });
  const campos: Record<string, ValorCampoPci> = {};
  for (const campo of CAMPOS_PCI) {
    const v = f.campos[campo.id];
    if (!campo.copiavel || vazio(v)) continue;
    if (campo.tipo === "lista" && !(campo.opcoes ?? []).includes(String(v))) continue;
    campos[campo.id] = v;
  }
  return { campos, custos: f.custos, adicionais: f.adicionais, cronograma: f.cronograma };
}

/** Sugestões de um modelo para a comparação (mesmo tratamento de conflito de "Dados automáticos"). */
export function sugestoesDoModeloPci(dados: unknown, fonte: string): SugestaoPci[] {
  const m = extrairModeloPreenchimentoPci(dados);
  return [
    ...Object.entries(m.campos).map(([chave, valor]) => ({ chave, valor, fonte })),
    { chave: "custos", valor: m.custos, fonte },
    { chave: "adicionais", valor: m.adicionais, fonte },
    { chave: "cronograma", valor: m.cronograma, fonte },
  ];
}

/** O que o modelo leva (para a lista). */
export function resumoModeloPreenchimentoPci(dados: DadosModeloPreenchimentoPci): string {
  const partes = [`${Object.keys(dados.campos).length} campo(s) técnico(s)`];
  if (dados.custos.some((x) => x !== null)) partes.push("custos");
  if (dados.adicionais.some((x) => x.descricao || x.valor !== null)) partes.push("serviços adicionais");
  if (dados.cronograma.some((x) => x !== null)) partes.push("cronograma");
  return partes.join(", ");
}

export function validarNomeModeloPreenchimentoPci(nome: unknown): string {
  const t = typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "";
  if (!t) throw new Error("Dê um nome ao modelo (ex.: Casa padrão 70 m²).");
  if (t.length > LIMITE_NOME_MODELO_PCI) throw new Error(`O nome do modelo deve ter até ${LIMITE_NOME_MODELO_PCI} caracteres.`);
  return t;
}

/** CNPJ numérico com dígitos verificadores (o alfanumérico não aparece em texto livre de memorial). */
function cnpjNumericoValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => { const r = Array.from(base).reduce((s, c, i) => s + Number(c) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  return Number(d[12]) === dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) && Number(d[13]) === dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

export type TipoDadoPessoalPci = "CPF" | "CNPJ" | "e-mail" | "telefone";

export interface AchadoPessoalPci {
  tipo: TipoDadoPessoalPci;
  /** Trecho onde foi achado, com o meio mascarado (para a pessoa localizar num memorial longo). */
  trecho: string;
  /** false = só aviso (CNPJ é dado de empresa, não pessoal). */
  bloqueia: boolean;
}

/** Mascara o meio do valor achado: mantém os 3 primeiros e os 2 últimos caracteres (letras/dígitos). */
export function mascararMeioPci(valor: string): string {
  const pos = Array.from(valor).map((c, i) => (/[0-9A-Za-zÀ-ÿ]/.test(c) ? i : -1)).filter((i) => i >= 0);
  const ini = pos.length > 6 ? 3 : 1, fim = pos.length > 6 ? 2 : 1;
  const ocultos = new Set(pos.slice(ini, Math.max(ini, pos.length - fim)));
  return Array.from(valor).map((c, i) => (ocultos.has(i) ? "•" : c)).join("");
}

/** Trecho para a mensagem: até 14 caracteres antes (contexto, ex.: "CPF:") + o valor mascarado. */
function trechoPci(texto: string, inicio: number, valor: string): string {
  const corte = inicio > 14;
  const antes = texto.slice(Math.max(0, inicio - 14), inicio).replace(corte ? /^\S*\s/ : /^$/, "").replace(/\s+/g, " ");
  return `${corte ? "…" : ""}${antes}${mascararMeioPci(valor)}`;
}

const SEM_DIGITO_ANTES = String.raw`(?<![\d.,\/-])`;
const SEM_DIGITO_DEPOIS = String.raw`(?!\d|[.,\/-]\d)`;
/** DDD brasileiro (11–99, sem zero) para os padrões de telefone sem contexto escrito. */
const dddValido = (d: string) => /^[1-9][1-9]/.test(d);

/**
 * Dados pessoais num texto livre. CPF (dígitos verificadores conferidos; com pontos, traços ou sem
 * separador; separado por espaços só logo depois de "CPF"), e-mail (também "(arroba)", "[at]"),
 * telefone SÓ com sinal de telefone — "tel/fone/cel/whats", DDD entre parênteses, "+55", celular de 9
 * dígitos ou fixo com separadores (número técnico de 10–11 dígitos corrido, como ART ou lote, não é
 * telefone) — e CNPJ (dado de empresa: só aviso, `bloqueia: false`).
 */
export function achadosPessoaisNoTextoPci(texto: string): AchadoPessoalPci[] {
  const r: AchadoPessoalPci[] = [];
  const cpfs = new Set<string>();
  const add = (tipo: TipoDadoPessoalPci, inicio: number, valor: string) => {
    const trecho = trechoPci(texto, inicio, valor);
    if (!r.some((x) => x.tipo === tipo && x.trecho === trecho)) r.push({ tipo, trecho, bloqueia: tipo !== "CNPJ" });
  };
  for (const m of Array.from(texto.matchAll(new RegExp(`${SEM_DIGITO_ANTES}\\d{2}[.\\s]?\\d{3}[.\\s]?\\d{3}[\\/\\s]?\\d{4}[-\\s]?\\d{2}(?![\\d\\/-])`, "g")))) {
    if (cnpjNumericoValido(soDigitos(m[0]))) add("CNPJ", m.index!, m[0]);
  }
  for (const m of Array.from(texto.matchAll(new RegExp(`${SEM_DIGITO_ANTES}\\d{3}[.\\s-]?\\d{3}[.\\s-]?\\d{3}[.\\s-]?\\d{2}(?![\\d\\/]|[.-]\\d)`, "g")))) {
    const d = soDigitos(m[0]);
    if (!isValidCPF(d)) continue;
    if (/\s/.test(m[0]) && !/cpf\W{0,3}$/i.test(texto.slice(Math.max(0, m.index! - 8), m.index!))) continue;
    cpfs.add(d);
    add("CPF", m.index!, m[0]);
  }
  const arroba = String.raw`(?:@|\(\s*(?:arroba|at)\s*\)|\[\s*(?:arroba|at)\s*\])`;
  const ponto = String.raw`(?:\.|\(\s*ponto\s*\)|\[\s*ponto\s*\])`;
  for (const m of Array.from(texto.matchAll(new RegExp(`[\\w.+-]+\\s*${arroba}\\s*[\\w-]+(?:\\s*${ponto}\\s*[\\w-]+)*\\s*${ponto}\\s*[a-z]{2,}\\b`, "gi")))) add("e-mail", m.index!, m[0]);
  const numero = String.raw`(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}`;
  const telefones: { re: RegExp; ddd: boolean }[] = [
    { re: new RegExp(String.raw`\b(?:tel|telefone|fone|cel|celular|whats|whatsapp|wpp|zap)\b\.?\s*:?\s*(${numero})(?!\d)`, "gi"), ddd: false },
    { re: new RegExp(String.raw`\(\d{2}\)\s?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)`, "g"), ddd: false },
    { re: new RegExp(String.raw`\+55[\s.-]?\(?\d{2}\)?[\s.-]?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)`, "g"), ddd: false },
    // Celular: DDD + 9 + 8 dígitos, com separador entre os blocos finais ("41 9 9999 0000", "41 99999-0000").
    { re: new RegExp(String.raw`${SEM_DIGITO_ANTES}\d{2}[\s.-]?9[\s.-]?\d{4}[\s.-]\d{4}${SEM_DIGITO_DEPOIS}`, "g"), ddd: true },
    // Fixo: DDD + 4 + 4 com separadores ("41 3333 4444").
    { re: new RegExp(String.raw`${SEM_DIGITO_ANTES}\d{2}[\s.-][2-5]\d{3}[\s.-]\d{4}${SEM_DIGITO_DEPOIS}`, "g"), ddd: true },
  ];
  for (const { re, ddd } of telefones) {
    for (const m of Array.from(texto.matchAll(re))) {
      const valor = m[1] ?? m[0];
      const inicio = m.index! + m[0].lastIndexOf(valor);
      const d = soDigitos(valor);
      if (d.length < 8 || d.length > 13 || cpfs.has(d) || isValidCPF(d) || (ddd && !dddValido(d))) continue;
      if (r.some((x) => x.tipo === "telefone" && soDigitos(x.trecho).endsWith(d.slice(-2)) && x.trecho.includes(mascararMeioPci(valor)))) continue;
      add("telefone", inicio, valor);
    }
  }
  return r;
}

/** Tipos achados no texto (CPF, CNPJ, e-mail, telefone), sem repetir. */
export function dadosPessoaisNoTextoPci(texto: string): string[] {
  return Array.from(new Set(achadosPessoaisNoTextoPci(texto).map((a) => a.tipo)));
}

function textosDoModeloPci(m: { nome?: string | null; observacao?: string | null; dados: DadosModeloPreenchimentoPci }): [string, string][] {
  const textos: [string, string][] = [];
  if (m.nome) textos.push(["Nome do modelo", m.nome]);
  if (m.observacao) textos.push(["Observação do modelo", m.observacao]);
  for (const [id, v] of Object.entries(m.dados.campos)) if (typeof v === "string") textos.push([CAMPO_POR_ID.get(id)?.rotulo ?? id, v]);
  m.dados.adicionais.forEach((a, i) => { if (a.descricao) textos.push([`Serviço adicional ${i + 1}`, a.descricao]); });
  return textos;
}

/**
 * Confere nome, observação e TODO texto livre do modelo (campos de texto, descrições dos serviços
 * adicionais). Só o que bloqueia (CPF, e-mail, telefone), com o trecho mascarado; o salvamento é
 * recusado com a lista — nada é apagado em silêncio.
 */
export function dadosPessoaisNoModeloPci(m: { nome?: string | null; observacao?: string | null; dados: DadosModeloPreenchimentoPci }): { campo: string; tipos: string[]; trechos: string[] }[] {
  return textosDoModeloPci(m).map(([campo, t]) => {
    const a = achadosPessoaisNoTextoPci(t).filter((x) => x.bloqueia);
    return { campo, tipos: Array.from(new Set(a.map((x) => x.tipo))), trechos: a.map((x) => x.trecho) };
  }).filter((x) => x.tipos.length);
}

/** CNPJ no texto do modelo: é dado de empresa (fornecedor), não bloqueia — vira aviso para conferir. */
export function avisosEmpresaNoModeloPci(m: { nome?: string | null; observacao?: string | null; dados: DadosModeloPreenchimentoPci }): string[] {
  return textosDoModeloPci(m).flatMap(([campo, t]) => achadosPessoaisNoTextoPci(t).filter((x) => !x.bloqueia)
    .map((x) => `${campo}: CNPJ "${x.trecho}" ficou no modelo (dado de empresa, não pessoal). Confira se deve mesmo ir para outras obras.`));
}

// ─── cálculos (os mesmos das fórmulas do modelo) ─────────────────────────────

export interface TotaisPci {
  outros: number;
  totalServicos: number;
  valorBdi: number;
  totalComBdi: number;
  /** Incidência (%) de cada um dos 20 serviços (19 + Outros). */
  incidencias: number[];
  /** % acumulado das incidências (coluna "% Ac."). */
  acumulado: number[];
  areaConstruida: number | null;
  custoProducao: number;
}

export function calcularTotaisPci(form: FormularioPci): TotaisPci {
  const outros = form.adicionais.reduce((s, a) => s + (a.valor ?? 0), 0);
  const valores = [...form.custos.map((v) => v ?? 0), outros];
  const totalServicos = valores.reduce((s, v) => s + v, 0);
  const bdi = numeroPci(form.campos.bdi) ?? 0;
  const valorBdi = (totalServicos * bdi) / 100;
  const incidencias = valores.map((v) => (totalServicos > 0 ? (v / totalServicos) * 100 : 0));
  let soma = 0;
  const acumulado = incidencias.map((v) => (soma += v));
  const ac = numeroPci(form.campos.areaCoberta);
  const aa = numeroPci(form.campos.areaAcessoria);
  const terreno = numeroPci(form.campos.valorTerreno) ?? 0;
  return {
    outros, totalServicos, valorBdi, totalComBdi: totalServicos + valorBdi, incidencias, acumulado,
    areaConstruida: ac === null && aa === null ? null : (ac ?? 0) + (aa ?? 0),
    custoProducao: terreno + totalServicos + valorBdi,
  };
}

// ─── cronograma físico-financeiro (Lote 03, correção 06) ─────────────────────

/** Limite do pré-executado (AX161: "Ultrapassa limite permitido" acima de 70%). */
export const LIMITE_PRE_EXECUTADO_PCI = 70;

export interface ProblemaCronogramaPci {
  /** Etapa (0 = pré-executado); null = cronograma como um todo. */
  etapa: number | null;
  mensagem: string;
  /** "valor": valor inválido (bloqueia salvar e gerar); "incompleto": bloqueia só gerar. */
  tipo: "valor" | "incompleto";
}

export interface AnaliseCronogramaPci {
  prazo: number;
  /** % acumulado da etapa 0 (pré-executado, AS161). */
  etapa0: number;
  /** Incremental de cada etapa 1..prazo = AI(k) − AI(k−1) (etapa 0 = pré-executado). Nunca soma acumulados. */
  incrementais: (number | null)[];
  erros: ProblemaCronogramaPci[];
  /** Avisos da coluna AX do modelo (não bloqueiam), por etapa. */
  avisos: { etapa: number; mensagem: string }[];
}

const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * Regras do cronograma: cada etapa 1..prazo é o % ACUMULADO proposto (AI166..),
 * entre 0,00 e 100,00, sem diminuir em relação à etapa anterior (a etapa 0 é o
 * pré-executado, AS161), e a última etapa (T161) termina em 100,00. O modelo
 * da CAIXA não valida isso (formato General); a validação é do sistema. Os
 * avisos de curva lenta/rápida e de incremento máximo (23/17/14 p.p.) seguem a
 * coluna AX do modelo e não bloqueiam.
 */
export function analisarCronogramaPci(form: FormularioPci): AnaliseCronogramaPci {
  const prazoBruto = numeroPci(form.campos.prazoMeses);
  const prazo = prazoBruto === null ? 0 : Math.max(0, Math.round(prazoBruto));
  const erros: ProblemaCronogramaPci[] = [];
  const avisos: { etapa: number; mensagem: string }[] = [];
  const pre = numeroPci(form.campos.preExecutado);
  if (pre !== null && (pre < 0 || pre > LIMITE_PRE_EXECUTADO_PCI)) {
    erros.push({ etapa: 0, tipo: "valor", mensagem: `Obra pré-executada (etapa 0): ${pct(pre)} fora do limite permitido (0,00% a ${pct(LIMITE_PRE_EXECUTADO_PCI)}).` });
  }
  if (prazoBruto !== null && prazo > MAX_ETAPAS_PCI) {
    erros.push({ etapa: null, tipo: "valor", mensagem: `Prazo de ${prazo} meses ultrapassa o limite contratual de ${MAX_ETAPAS_PCI} meses: a proposta é inviável.` });
  }
  if (prazoBruto !== null && prazo < 1) erros.push({ etapa: null, tipo: "valor", mensagem: "O prazo de execução deve ser de pelo menos 1 mês." });
  const etapa0 = pre !== null && pre >= 0 && pre <= 100 ? pre : 0;
  const n = Math.min(prazo, MAX_ETAPAS_PCI);
  const valorImovel = numeroPci(form.campos.valorImovel);
  const curvas = curvasPadraoPci(valorImovel);
  const incMax = incrementoMaximoEtapaPci(valorImovel);
  const incrementais: (number | null)[] = [];
  let anterior: number | null = etapa0;
  let anteriorEtapa = 0;
  for (let k = 1; k <= n; k++) {
    const v = form.cronograma[k - 1] ?? null;
    if (v === null) {
      incrementais.push(null);
      erros.push({ etapa: k, tipo: "incompleto", mensagem: `Etapa ${k}: informe o % acumulado proposto.` });
      continue;
    }
    if (v < 0 || v > 100) {
      incrementais.push(null);
      erros.push({ etapa: k, tipo: "valor", mensagem: `Etapa ${k}: ${pct(v)} fora da faixa 0,00% a 100,00% (é o % ACUMULADO da obra até esta etapa).` });
      anterior = null;
      continue;
    }
    if (anterior !== null && v + 1e-9 < anterior) {
      erros.push({ etapa: k, tipo: "valor", mensagem: `Etapa ${k}: ${pct(v)} é menor que a etapa ${anteriorEtapa} (${pct(anterior)}). O acumulado não pode diminuir.` });
    }
    const inc = anterior === null ? null : duasCasasPci(v - anterior);
    incrementais.push(inc);
    // Coluna AX do modelo (avisos).
    if (v !== 0) {
      if (etapa0 > 0 && incMax !== null && inc !== null && inc > incMax) avisos.push({ etapa: k, mensagem: `Etapa ${k}: avanço de ${pct(inc)} na etapa excede o limite de ${incMax} p.p. (obra com pré-executado).` });
      else if (etapa0 <= 0 && curvas) {
        if (v > curvas.rapida[k]) avisos.push({ etapa: k, mensagem: `Etapa ${k}: ${pct(v)} supera o limite da curva rápida da CAIXA (${pct(curvas.rapida[k])}).` });
        else if (v < curvas.lenta[k]) avisos.push({ etapa: k, mensagem: `Etapa ${k}: ${pct(v)} abaixo do mínimo da curva lenta da CAIXA (${pct(curvas.lenta[k])}).` });
      }
    }
    anterior = v;
    anteriorEtapa = k;
  }
  if (n >= 1) {
    const ultima = form.cronograma[n - 1] ?? null;
    if (ultima !== null && ultima >= 0 && ultima <= 100 && Math.abs(ultima - 100) > 1e-9) {
      erros.push({ etapa: n, tipo: "incompleto", mensagem: `Etapa ${n} (última do prazo): o acumulado deve terminar em 100,00% (está ${pct(ultima)}).` });
    }
  }
  return { prazo: n, etapa0, incrementais, erros, avisos };
}

/**
 * Alerta de prazo do modelo (Z161/G162): acima de 24 meses é inviável; maior que
 * a etapa em que a curva lenta chega a 100% pede justificativa; menor que a da
 * curva rápida pede avaliação. Sem prazo ou sem valor do imóvel → null.
 */
export function alertaPrazoPci(campos: Record<string, ValorCampoPci>): string | null {
  const prazo = numeroPci(campos.prazoMeses);
  if (prazo === null || prazo <= 0) return null;
  if (prazo > MAX_ETAPAS_PCI) return `Prazo de construção ultrapassa o limite contratual (${MAX_ETAPAS_PCI} meses): a proposta é inviável.`;
  const curvas = curvasPadraoPci(numeroPci(campos.valorImovel));
  if (!curvas) return null;
  const lenta = etapaCemPorCentoPci(curvas.lenta);
  const rapida = etapaCemPorCentoPci(curvas.rapida);
  if (lenta !== null && prazo > lenta) return `Prazo maior que as referências da CAIXA (curva lenta conclui em ${lenta} meses): informe a justificativa técnica.`;
  if (rapida !== null && prazo < rapida) return `Prazo menor que as referências da CAIXA (curva rápida conclui em ${rapida} meses): avalie o prazo ou justifique.`;
  return null;
}

/** Limite de BDI do modelo (AN141): Construtora 18; Profissional Autônomo 6; sem executor → null. */
export function limiteBdiPci(executor: ValorCampoPci): number | null {
  return executor === "Construtora" ? 18 : executor === "Profissional Autônomo" ? 6 : null;
}

/**
 * Erros que BLOQUEIAM. `paraGerar=false` (salvar rascunho): só valores inválidos
 * (fora da lista, fora de 0–100, acumulado diminuindo). `paraGerar=true`: também
 * etapas vazias e última etapa diferente de 100,00%.
 */
export function errosPci(form: FormularioPci, opcoes: { paraGerar: boolean }): string[] {
  const e: string[] = [];
  for (const campo of CAMPOS_PCI) {
    if (campo.tipo !== "lista") continue;
    const v = form.campos[campo.id];
    if (vazio(v)) continue;
    if (!(campo.opcoes ?? []).includes(String(v))) {
      e.push(`${campo.rotulo}: "${String(v).trim()}" não é uma opção do modelo oficial da CAIXA (${campo.celula}). Escolha uma das opções da lista.`);
    }
  }
  for (const p of analisarCronogramaPci(form).erros) {
    if (p.tipo === "valor" || opcoes.paraGerar) e.push(p.mensagem);
  }
  // EPIC-024 S-09: a PCI oficial não sai com nome e CPF de uma pessoa vindos de fontes diferentes.
  if (opcoes.paraGerar) for (const m of misturaPessoaPci(form)) e.push(m.mensagem);
  return e;
}

/** Avisos (não bloqueiam): o que a CAIXA costuma recusar. */
export function pendenciasPci(form: FormularioPci): string[] {
  const p: string[] = [];
  const obrig = ["proponenteNome", "proponenteCpf", "rteNome", "rteRegistro", "endereco", "municipio", "uf"];
  for (const id of obrig) if (vazio(form.campos[id])) p.push(`${CAMPO_POR_ID.get(id)?.rotulo ?? id} não preenchido.`);
  const t = calcularTotaisPci(form);
  if (t.totalServicos <= 0) p.push("Custos dos serviços não preenchidos (as incidências ficam zeradas).");
  const cron = analisarCronogramaPci(form);
  for (const e of cron.erros) if (e.tipo === "incompleto") p.push(e.mensagem);
  for (const a of cron.avisos) p.push(a.mensagem);
  const alerta = alertaPrazoPci(form.campos);
  if (alerta && vazio(form.campos.justificativaPrazoTexto)) p.push(alerta);
  if (vazio(form.campos.executor)) p.push("Executor da obra não informado (define o limite do BDI).");
  const limite = limiteBdiPci(form.campos.executor);
  const bdi = numeroPci(form.campos.bdi);
  if (limite !== null && bdi !== null && bdi > limite && vazio(form.campos.justificativaIncidencias)) p.push(`BDI de ${pct(bdi)} ultrapassa o limite de referência (${limite}%) para ${String(form.campos.executor)}: justifique.`);
  const lng = typeof form.campos.longitude === "string" ? coordenadaPciParaCelula(form.campos.longitude, "lng") : null;
  if (lng && lng.hemisferio !== "W") p.push("Longitude: o modelo da CAIXA só aceita hemisfério W (oeste).");
  return p;
}

// ─── modelos ─────────────────────────────────────────────────────────────────

export type FormatoModeloPci = "xls" | "xlsm" | "xlsb";
export const LIMITE_MODELO_PCI_BYTES = 8 * 1024 * 1024;
export const MIME_MODELO_PCI: Record<FormatoModeloPci, string> = {
  xls: "application/vnd.ms-excel",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
};
export const MENSAGEM_XLSB_SO_LEITURA =
  "O modelo atual está em .xlsb, formato que o sistema só consegue ler. A PCI é gerada sempre em .xls: envie em Integrações › PCI da CAIXA a versão .xls do mesmo modelo oficial.";
/** Lote 03, correção 10: saída obrigatória em .xls real (BIFF8). */
export const MENSAGEM_SAIDA_XLS_PCI =
  "Envie a versão .xls do modelo oficial. A PCI é gerada sempre em .xls (formato aceito pela CAIXA) e não há versão .xls do modelo compatível com o modelo atual.";

/** Formato pela extensão, conferido pela assinatura do arquivo. */
export function formatoModeloPci(nome: string, bytes: Uint8Array): FormatoModeloPci {
  const ext = /\.(xls|xlsm|xlsb)$/i.exec(nome)?.[1]?.toLowerCase() as FormatoModeloPci | undefined;
  if (!ext) throw new Error("Envie o modelo em .xls, .xlsm ou .xlsb (planilha oficial da CAIXA).");
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (ext === "xls" ? !ole : !zip) throw new Error(`O arquivo não é um .${ext} válido.`);
  return ext;
}

/** Validação de uma parte do envio do modelo (mesmos limites do envio de PCI da obra). */
export function validarNomeModeloPci(nome: unknown): string {
  if (typeof nome !== "string" || !/\.(xls|xlsm|xlsb)$/i.test(nome) || nome.length > 255) throw new Error("Envie o modelo em .xls, .xlsm ou .xlsb.");
  return nome;
}

export function nomeArquivoPciGerada(proponente: ValorCampoPci, obraTitulo: string | null, versao: number, ext: string): string {
  const base = String(proponente || obraTitulo || "obra").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
  return `PCI_${base}_v${versao}.${ext}`;
}
