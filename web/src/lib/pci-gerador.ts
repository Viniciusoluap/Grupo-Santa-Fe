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
export const CAMPOS_PCI: CampoPci[] = [
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

export const CAMPO_POR_ID = new Map(CAMPOS_PCI.map((campo) => [campo.id, campo]));

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

/**
 * Formulário pré-preenchido. Prioridade: (1) dados da PCI já vinculada à obra
 * (a proposta oficial enviada), (2) cadastro do cliente/lead e da obra, que
 * completam só o que faltar. Nada é inventado: sem fonte, o campo fica vazio.
 */
export function preencherPciAutomatico(f: FontesPreenchimentoPci): FormularioPci {
  const form = f.pci ? normalizarFormularioPci(f.pci) : formularioPciVazio();
  const definir = (id: string, v: unknown) => {
    const campo = CAMPO_POR_ID.get(id);
    if (!campo || !vazio(form.campos[id])) return;
    form.campos[id] = normalizarValorCampo(campo, v);
  };
  const cli = f.cliente;
  if (cli) {
    definir("proponenteNome", cli.nome);
    definir("proponenteEmail", cli.email);
    definir("proponenteCpf", cli.cpf);
    const tel = separarTelefone(cli.telefone);
    definir("proponenteDdd", tel.ddd);
    definir("proponenteTelefone", tel.numero);
  }
  definir("endereco", f.obra.endereco ?? cli?.endereco ?? null);
  definir("bairro", cli?.bairro ?? null);
  definir("municipio", f.obra.cidade);
  definir("uf", f.obra.uf);
  definir("areaCoberta", f.obra.area);
  definir("valorImovel", f.obra.valorImovel);
  definir("valorTerreno", f.obra.valorTerreno);
  definir("valorFinanciado", f.obra.valorFinanciado);
  definir("prazoMeses", prazoEmMeses(f.obra.inicio, f.obra.termino));
  if (f.coordenadas) {
    definir("latitude", coordenadaDecimalParaPci(f.coordenadas.lat, "lat"));
    definir("longitude", coordenadaDecimalParaPci(f.coordenadas.lng, "lng"));
  }
  return form;
}

/**
 * Seleção do engenheiro em RTP/RTE: nome, e-mail, telefone e CREA/UF vêm do
 * perfil. Sem CREA no perfil, o registro fica vazio (nunca inventado). CPF não
 * existe no perfil e é mantido como digitado.
 */
export function aplicarEngenheiroPci(form: FormularioPci, papel: "rtp" | "rte", engenheiroId: string | null, eng: EngenheiroPci | null): FormularioPci {
  const campos = { ...form.campos };
  const novo: FormularioPci = { ...form, campos, [papel === "rtp" ? "rtpEngenheiroId" : "rteEngenheiroId"]: engenheiroId };
  if (!eng) return novo;
  const tel = separarTelefone(eng.telefone);
  campos[`${papel}Nome`] = eng.nome?.trim() || null;
  campos[`${papel}Email`] = eng.email?.trim() || null;
  campos[`${papel}Registro`] = eng.crea?.trim() || null;
  campos[`${papel}Uf`] = eng.creaUf?.trim() || null;
  campos[`${papel}Ddd`] = tel.ddd;
  campos[`${papel}Telefone`] = tel.numero;
  return novo;
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
