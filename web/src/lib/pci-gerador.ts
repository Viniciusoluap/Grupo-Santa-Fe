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
  | "coordenada"; // 05° 29' 18" S ↔ número 52918 + hemisfério na célula vizinha

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
  /** Para coordenadas: célula do hemisfério (N/S, W/E). */
  celulaHemisferio?: string;
  largo?: boolean;
}

const c = (id: string, rotulo: string, secao: SecaoPci, celula: string | null, tipo: TipoCampoPci = "texto", extra: Partial<CampoPci> = {}): CampoPci =>
  ({ id, rotulo, secao, celula, tipo, ...extra });

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
  c("rtpUf", "UF do registro", "rtp", "AI47"),
  c("rtpCpf", "CPF", "rtp", "AK47", "documento"),
  c("rtpDdd", "DDD", "rtp", "AQ47", "inteiro"),
  c("rtpTelefone", "Telefone", "rtp", "AS47", "telefone"),

  c("rteNome", "Nome do RTE", "rte", "G50", "texto", { largo: true }),
  c("rteEmail", "E-mail", "rte", "Q50"),
  c("rteRegistro", "Nº CAU/CREA/CFT", "rte", "AB50", "registro"),
  c("rteUf", "UF do registro", "rte", "AI50"),
  c("rteCpf", "CPF", "rte", "AK50", "documento"),
  c("rteDdd", "DDD", "rte", "AQ50", "inteiro"),
  c("rteTelefone", "Telefone", "rte", "AS50", "telefone"),

  c("endereco", "Endereço", "imovel", "G54", "texto", { largo: true }),
  c("complemento", "Complemento", "imovel", "AJ54"),
  c("bairro", "Bairro", "imovel", "G56"),
  c("cep", "CEP", "imovel", "V56", "cep"),
  c("municipio", "Município", "imovel", "AA56"),
  c("uf", "UF", "imovel", "AV56"),

  c("matricula", "Matrícula", "matricula", "G58", "registro"),
  c("cartorio", "ORI (Registro de Imóveis)", "matricula", "M58"),
  c("latitude", "Latitude", "matricula", "T58", "coordenada", { celulaHemisferio: "X58" }),
  c("longitude", "Longitude", "matricula", "Y58", "coordenada", { celulaHemisferio: "AC58" }),
  c("construtora", "Construtora (se houver)", "matricula", "AD58"),
  c("cnpjConstrutora", "CNPJ da construtora", "matricula", "AK58", "documento"),
  c("finalidade", "Finalidade", "matricula", "AQ58"),

  c("alvaraSituacao", "Alvará/Licença da obra", "documentacao", "Q64"),
  c("alvaraValidade", "Validade do alvará", "documentacao", "AF64", "data"),
  c("terrenoProprio", "Terreno é próprio", "documentacao", "AR64"),
  c("artProjetoSituacao", "ART/RRT/TRT de projeto", "documentacao", "Q65"),
  c("artProjetoNumero", "Número da ART de projeto", "documentacao", "AF65"),
  c("artExecucaoSituacao", "ART/RRT/TRT de execução", "documentacao", "Q66"),
  c("artExecucaoNumero", "Número da ART de execução", "documentacao", "AF66"),
  c("projetoLegalSituacao", "Projeto legal aprovado", "documentacao", "Q67"),

  c("areaCoberta", "Área coberta padrão (m²)", "areas", "G73", "numero"),
  c("areaPermeavel", "Área permeável (m²)", "areas", "N73", "numero"),
  c("areaAcessoria", "Área acessória coberta (m²)", "areas", "U73", "numero"),
  c("areaTerreno", "Área do terreno (m²)", "areas", "AJ73", "numero"),
  c("valorTerreno", "Valor proposto do terreno (R$)", "areas", "AR73", "numero"),
  c("destinacao", "Destinação do imóvel", "areas", "O74"),
  c("valorImovel", "Valor proposto do imóvel (R$)", "areas", "AK74", "numero"),
  c("valorFinanciado", "Valor financiado (R$) — informativo, só no PDF", "areas", null, "numero"),

  c("padraoAcabamento", "Padrão de acabamento", "memorial", "M96"),
  c("implantacao", "Implantação/Inserção", "memorial", "AM96"),
  c("cobertura", "Cobertura", "memorial", "G98"),
  c("teto", "Teto", "memorial", "V98"),
  c("pavimentos", "Pavimentos", "memorial", "AC98", "inteiro"),
  c("quartos", "Quartos", "memorial", "AF98", "inteiro"),
  c("suites", "Suítes", "memorial", "AI98", "inteiro"),
  c("salas", "Salas", "memorial", "AL98", "inteiro"),
  c("vagas", "Vagas", "memorial", "AO98", "inteiro"),
  c("tipoVagas", "Tipo de vagas", "memorial", "AR98"),
  c("paredesExternas", "Acabamento paredes externas", "memorial", "G100"),
  c("loucasMetais", "Louças e metais", "memorial", "V100"),
  c("areaServico", "Área de serviço", "memorial", "AC100"),
  c("cozinha", "Cozinha", "memorial", "AI100"),
  c("paredesInternas", "Acabamento paredes internas", "memorial", "G102"),
  c("paredesAreasSecas", "Paredes/painéis áreas secas", "memorial", "V102"),
  c("calefacao", "Calefação", "memorial", "AC102"),
  c("aguaQuente", "Água quente", "memorial", "AI102"),
  c("itensSustentabilidade", "Itens de sustentabilidade", "memorial", "AP102"),
  c("revestParedeMolhadas", "Revest. parede áreas molhadas", "memorial", "G104"),
  c("pisoAreasSecas", "Revest. piso áreas secas", "memorial", "O104"),
  c("pisoAreasMolhadas", "Revest. piso áreas molhadas", "memorial", "V104"),
  c("divisaoInterna", "Divisão interna (ambientes)", "memorial", "AC104", "texto", { largo: true }),
  c("esquadriasExternas", "Esquadrias externas", "memorial", "G106"),
  c("esquadriasInternas", "Esquadrias internas", "memorial", "O106"),
  c("outrosEspecificar", "Outros (especificar)", "memorial", "AC107", "texto", { largo: true }),

  c("sistemaConstrutivo", "Sistema construtivo", "sistema", "S75", "texto", { largo: true }),
  c("especificacaoSistema", "Especificação do sistema construtivo", "sistema", "Q80", "texto", { largo: true }),
  c("usoEps", "Previsão de uso de EPS", "sistema", "AB81"),
  c("montagemParedes", "Montagem/fabricação das paredes", "sistema", "AP81"),
  c("paredesEstruturais", "Paredes com função estrutural", "sistema", "Q84"),
  c("tipoFormas", "Tipo de fôrmas", "sistema", "AA84"),
  c("formasPermanecem", "Fôrmas permanecem nas paredes", "sistema", "AS84"),
  c("seloCasaAzul", "Optante pelo Selo Casa Azul", "sistema", "Y93"),
  c("docSeloCasaAzul", "Documentação complementar do selo", "sistema", "AS93"),

  c("abastecimentoAgua", "Abastecimento d'água", "instalacoes", "V106"),
  c("drenagem", "Drenagem", "instalacoes", "G108"),
  c("esgoto", "Coleta/tratamento de esgoto", "instalacoes", "O108"),
  c("energiaAlternativa", "Geração alternativa de energia", "instalacoes", "V108"),
  c("esgotoDistancias", "Esgoto atende localização e distâncias", "instalacoes", "AR109"),
  c("esgotoContaminacao", "Solução impede contaminação", "instalacoes", "AR110"),
  c("esgotoDescricao", "Descrição da solução de esgoto", "instalacoes", "G112", "texto", { largo: true }),

  c("bdi", "BDI (%)", "custos", "X141", "numero"),
  c("prazoMeses", "Prazo de execução (meses)", "cronograma", "T161", "inteiro"),
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

/** "1.234,56" / "1234.56" / 1234.56 → número; vazio/ilegível → null. */
export function numeroPci(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let t = v.trim().replace(/\s|R\$|%/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
  if (Array.isArray(e.cronograma)) base.cronograma = (e.cronograma as unknown[]).slice(0, MAX_ETAPAS_PCI).map(numeroPci);
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

/** Avisos (não bloqueiam): o que a CAIXA costuma recusar. */
export function pendenciasPci(form: FormularioPci): string[] {
  const p: string[] = [];
  const obrig = ["proponenteNome", "proponenteCpf", "rteNome", "rteRegistro", "endereco", "municipio", "uf"];
  for (const id of obrig) if (vazio(form.campos[id])) p.push(`${CAMPO_POR_ID.get(id)?.rotulo ?? id} não preenchido.`);
  const t = calcularTotaisPci(form);
  if (t.totalServicos <= 0) p.push("Custos dos serviços não preenchidos (as incidências ficam zeradas).");
  const prazo = numeroPci(form.campos.prazoMeses);
  if (prazo && form.cronograma.length < prazo) p.push("Cronograma com menos etapas que o prazo.");
  if (prazo && form.cronograma.length >= prazo && form.cronograma[prazo - 1] !== 100) p.push("A última etapa do cronograma deve chegar a 100%.");
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
  "O modelo atual está em .xlsb, formato que o sistema só consegue ler. Para gerar a PCI, envie em Integrações › Sub PCI atual a versão .xls ou .xlsm do mesmo modelo oficial da CAIXA.";

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
