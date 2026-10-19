// Estrutura de pastas do Google Drive: nomes legíveis em português, iguais na
// Prospecta e no Grupo Santa Fé (gêmeo em Prospecta/shared/drive-estrutura.ts).
//
//   <raiz do sistema>/
//     Clientes/<Nome do cliente (nº id)>/<Atendimento|Financiamento|Jurídico|…>/<Tipo — dd-mm-aaaa.ext>
//     Incorporação/<Nome do estudo (nº id)>/<Etapa>/<Documento — dd-mm-aaaa.ext>
//     Imóveis/<Título do imóvel (nº id)>/01 - Fotos/<Foto 01 — dd-mm-aaaa.jpg>
//                                     /02 - Documentos do imóvel, 03 - Plantas e projetos, 04 - Propostas e contratos
//     Obras/<Nome da obra (nº id)>/Medições CAIXA/<PCI original | PLS … — dd-mm-aaaa.xls/.pdf>
//
// Cada pasta criada pelo sistema leva uma etiqueta interna do Drive
// (appProperties[PROPRIEDADE_PASTA] = chave). A pasta é achada pela etiqueta,
// nunca pelo nome: renomear o cliente renomeia a pasta, sem duplicar.

export const PROPRIEDADE_PASTA = "pastaSistema";
export const CHAVE_RAIZ = "raiz";
export const CHAVE_CLIENTES = "clientes";
export const CHAVE_INCORPORACAO = "incorporacao";
export const PASTA_CLIENTES = "Clientes";
export const PASTA_INCORPORACAO = "Incorporação";
export const CHAVE_IMOVEIS = "imoveis";
export const PASTA_IMOVEIS = "Imóveis";
export const CHAVE_OBRAS = "obras";
export const PASTA_OBRAS = "Obras";
export const PASTA_MEDICOES_CAIXA = "Medições CAIXA";

/**
 * Pedido de 15/10: checklist fixo de pastas de cada imóvel, numeradas para
 * aparecerem sempre na mesma ordem no Drive. O sistema grava as fotos em
 * "01 - Fotos"; as demais ficam prontas para uso manual.
 */
export const PASTAS_IMOVEL = [
  { chave: "fotos", nome: "01 - Fotos" },
  { chave: "documentos", nome: "02 - Documentos do imóvel" },
  { chave: "plantas", nome: "03 - Plantas e projetos" },
  { chave: "negociacao", nome: "04 - Propostas e contratos" },
] as const;
export type PastaImovel = (typeof PASTAS_IMOVEL)[number]["chave"];

export type AreaCliente =
  | "atendimento" | "financiamento" | "juridico" | "regularizacao"
  | "obras" | "projetos" | "avaliacao" | "outros";

export const NOME_AREA: Record<AreaCliente, string> = {
  atendimento: "Atendimento",
  financiamento: "Financiamento",
  juridico: "Jurídico",
  regularizacao: "Regularização",
  obras: "Obras",
  projetos: "Projetos",
  avaliacao: "Avaliação",
  outros: "Outros serviços",
};

const AREA_DO_SERVICO: Record<string, AreaCliente> = {
  financiamento_habitacional: "financiamento",
  consorcio: "financiamento",
  regularizacao: "regularizacao",
  despachante: "regularizacao",
  juridico: "juridico",
  obra_cliente: "obras",
  vistoria_medicao: "obras",
  projeto_tecnico: "projetos",
  avaliacao: "avaliacao",
};

/** Documento sem serviço vinculado fica em "Atendimento". */
export function areaDoServico(tipoServico: string | null | undefined): AreaCliente {
  if (!tipoServico) return "atendimento";
  return AREA_DO_SERVICO[tipoServico] ?? "outros";
}

/** Rótulos dos tipos de documento do cliente usados no nome do arquivo. */
export const ROTULO_DOCUMENTO: Record<string, string> = {
  rg: "RG",
  cnh: "CNH",
  address_proof: "Comprovante de endereço",
  income_proof_formal: "Comprovante de renda",
  income_proof_irpf: "Declaração de IR",
  fgts: "Extrato do FGTS",
  spouse_docs: "Documentos do cônjuge",
  pis: "PIS",
  other: "Outro documento",
};

/** Tira barras e caracteres de controle e limita o tamanho (nome de pasta/arquivo). */
export function limparNome(texto: string | null | undefined, maximo = 120): string {
  return (texto ?? "")
    .replace(/[\\/\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo)
    .trim();
}

export function nomeComNumero(nome: string | null | undefined, numero: string | number): string {
  return `${limparNome(nome) || "Sem nome"} (nº ${numero})`;
}

/** dd-mm-aaaa no horário de Brasília. */
export function dataArquivo(data: Date): string {
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
    .formatToParts(data);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("day")}-${parte("month")}-${parte("year")}`;
}

const EXTENSAO_DO_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.ms-excel": ".xls",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/csv": ".csv",
  "text/plain": ".txt",
};

export function extensaoArquivo(nomeOriginal: string | null | undefined, mime: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(nomeOriginal ?? "");
  if (m) return `.${m[1].toLowerCase()}`;
  return EXTENSAO_DO_MIME[mime] ?? "";
}

/** "RG — 15-10-2026.jpg" */
export function nomeArquivo(rotulo: string, data: Date, nomeOriginal: string | null | undefined, mime: string): string {
  return `${limparNome(rotulo, 150) || "Documento"} — ${dataArquivo(data)}${extensaoArquivo(nomeOriginal, mime)}`;
}

export const chaveCliente = (id: string | number) => `cliente:${id}`;
export const chaveArea = (id: string | number, area: AreaCliente) => `cliente:${id}:${area}`;
export const chaveEstudo = (id: string | number) => `incorporacao:${id}`;
export const chaveEtapaEstudo = (id: string | number, etapa: string) => `incorporacao:${id}:${etapa}`;
export const chaveImovel = (id: string | number) => `imovel:${id}`;
export const chavePastaImovel = (id: string | number, pasta: PastaImovel) => `imovel:${id}:${pasta}`;
export const chaveObra = (id: string | number) => `obra:${id}`;
export const chaveMedicoesObra = (id: string | number) => `obra:${id}:medicoes-caixa`;

/** Um nível da árvore: a etiqueta interna e o nome exibido. */
export interface PastaAlvo { chave: string; nome: string }

export function caminhoCliente(cliente: { id: string | number; numero: string | number; nome: string | null }, area: AreaCliente): PastaAlvo[] {
  return [
    { chave: CHAVE_CLIENTES, nome: PASTA_CLIENTES },
    { chave: chaveCliente(cliente.id), nome: nomeComNumero(cliente.nome, cliente.numero) },
    { chave: chaveArea(cliente.id, area), nome: NOME_AREA[area] },
  ];
}

export function caminhoEstudo(estudo: { id: string | number; numero: string | number; nome: string | null }, etapa: { chave: string; nome: string }): PastaAlvo[] {
  return [
    { chave: CHAVE_INCORPORACAO, nome: PASTA_INCORPORACAO },
    { chave: chaveEstudo(estudo.id), nome: nomeComNumero(estudo.nome, estudo.numero) },
    { chave: chaveEtapaEstudo(estudo.id, etapa.chave), nome: limparNome(etapa.nome) || "Documentos" },
  ];
}

export function caminhoImovel(imovel: { id: string | number; numero: string | number; nome: string | null }, pasta: PastaImovel): PastaAlvo[] {
  const sub = PASTAS_IMOVEL.find((p) => p.chave === pasta)!;
  return [
    { chave: CHAVE_IMOVEIS, nome: PASTA_IMOVEIS },
    { chave: chaveImovel(imovel.id), nome: nomeComNumero(imovel.nome, imovel.numero) },
    { chave: chavePastaImovel(imovel.id, pasta), nome: sub.nome },
  ];
}

/**
 * Pedido de 18/10: a PCI enviada (original, intacta) e cada medição preenchida
 * (.xls e .pdf) ficam em Obras/<Obra (nº)>/Medições CAIXA, uma cópia por versão.
 */
export function caminhoMedicoesObra(obra: { id: string | number; numero: string | number; nome: string | null }): PastaAlvo[] {
  return [
    { chave: CHAVE_OBRAS, nome: PASTA_OBRAS },
    { chave: chaveObra(obra.id), nome: nomeComNumero(obra.nome, obra.numero) },
    { chave: chaveMedicoesObra(obra.id), nome: PASTA_MEDICOES_CAIXA },
  ];
}

/** "Foto 01 — 15-10-2026.jpg": numeradas na ordem em que aparecem no anúncio. */
export function nomeFotoImovel(ordem: number, data: Date, mime: string): string {
  return `Foto ${String(ordem).padStart(2, "0")} — ${dataArquivo(data)}${extensaoArquivo(null, mime)}`;
}

/** Nomes que o sistema dava às pastas antes desta estrutura (cliente-19, incorporacao-3/-ckx…). */
const NOME_LEGADO = /^(cliente-\d+|incorporacao-[A-Za-z0-9]+)$/;

/**
 * Pasta antiga criada pelo sistema: sem etiqueta E com nome do formato antigo.
 * Pasta criada pelo dono (sem etiqueta, outro nome) nunca entra na limpeza.
 */
export function pastaLegada(pasta: { name?: string; appProperties?: Record<string, string> | null }): boolean {
  return !pasta.appProperties?.[PROPRIEDADE_PASTA] && NOME_LEGADO.test(pasta.name ?? "");
}
