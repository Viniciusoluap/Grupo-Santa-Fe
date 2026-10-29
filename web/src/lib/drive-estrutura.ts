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
// Pedido de 29/10 (organização completa — SPEC-DRIVE-ORGANIZACAO.md):
//     Clientes/<Nome (nº id)>/Atendimento/WhatsApp/<Mídia — dd-mm-aaaa.ext>
//     WhatsApp sem cliente/<+55 número>/<Mídia — dd-mm-aaaa.ext>
//     Obras/<Obra (nº id)>/Fotos/<Medição 01 — dd-mm-aaaa | Sem medição>/<Foto 01 — dd-mm-aaaa.jpg>
//     Obras/<Obra (nº id)>/Gerador de PCI/<PCI gerada — dd-mm-aaaa.xls|.xlsm|.pdf>
//     Incorporação/<Estudo (nº id)>/Orçamento/<Planilha importada — dd-mm-aaaa.xlsx>
//     Equipe/<Nome do usuário (nº id)>/<Documento pessoal|Anuidade CREA|Carteirinha CREA|Outros>/<Rótulo — dd-mm-aaaa.ext>
//     Modelos/PCI CAIXA/<PCI modelo v01 — dd-mm-aaaa.ext>
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
export const CHAVE_EQUIPE = "equipe";
export const PASTA_EQUIPE = "Equipe";
export const CHAVE_MODELOS = "modelos";
export const PASTA_MODELOS = "Modelos";
export const CHAVE_MODELOS_PCI = "modelos:pci";
export const PASTA_MODELOS_PCI = "PCI CAIXA";
export const PASTA_FOTOS_OBRA = "Fotos";
export const PASTA_SEM_MEDICAO = "Sem medição";
export const PASTA_GERADOR_PCI = "Gerador de PCI";
export const PASTA_WHATSAPP = "WhatsApp";
export const CHAVE_WHATSAPP_SEM_CLIENTE = "whatsapp-sem-cliente";
export const PASTA_WHATSAPP_SEM_CLIENTE = "WhatsApp sem cliente";
export const PASTA_ORCAMENTO = "Orçamento";

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
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel.sheet.macroEnabled.12": ".xlsm",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12": ".xlsb",
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
export const chaveFotosObra = (id: string | number) => `obra:${id}:fotos`;
export const chaveFotosMedicao = (id: string | number, medicaoId: string | number | null) => `obra:${id}:fotos:medicao:${medicaoId ?? "sem"}`;
export const chaveGeradorPci = (id: string | number) => `obra:${id}:gerador-pci`;
export const chaveEquipe = (id: string | number) => `equipe:${id}`;
export const chaveCategoriaEquipe = (id: string | number, categoria: CategoriaEquipe) => `equipe:${id}:${categoria}`;
export const chaveWhatsappCliente = (id: string | number) => `cliente:${id}:atendimento:whatsapp`;
export const chaveWhatsappSemCliente = (numero: string) => `whatsapp-sem-cliente:${apenasDigitos(numero)}`;
export const chaveOrcamentoEstudo = (id: string | number) => `incorporacao:${id}:orcamento`;

/** Categorias dos documentos do usuário (mesmas chaves de engenheiro.ts). */
export const NOME_CATEGORIA_EQUIPE = {
  documento_pessoal: "Documento pessoal",
  anuidade_crea: "Anuidade CREA",
  carteirinha_crea: "Carteirinha CREA",
  outros: "Outros",
} as const;
export type CategoriaEquipe = keyof typeof NOME_CATEGORIA_EQUIPE;

const apenasDigitos = (numero: string) => (numero ?? "").replace(/\D/g, "") || "sem-numero";
const doisDigitos = (n: number) => String(n).padStart(2, "0");

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

// ─── Pedido de 29/10: novos tipos de arquivo ─────────────────────────────────

type Entidade = { id: string | number; numero: string | number; nome: string | null };

/** Obras/<Obra (nº)>/Fotos/<Medição 01 — dd-mm-aaaa | Sem medição> */
export function caminhoFotosObra(obra: Entidade, medicao: { id: string | number; ordem: number; data: Date } | null): PastaAlvo[] {
  return [
    { chave: CHAVE_OBRAS, nome: PASTA_OBRAS },
    { chave: chaveObra(obra.id), nome: nomeComNumero(obra.nome, obra.numero) },
    { chave: chaveFotosObra(obra.id), nome: PASTA_FOTOS_OBRA },
    medicao
      ? { chave: chaveFotosMedicao(obra.id, medicao.id), nome: `Medição ${doisDigitos(medicao.ordem)} — ${dataArquivo(medicao.data)}` }
      : { chave: chaveFotosMedicao(obra.id, null), nome: PASTA_SEM_MEDICAO },
  ];
}

/** Obras/<Obra (nº)>/Gerador de PCI */
export function caminhoGeradorPci(obra: Entidade): PastaAlvo[] {
  return [
    { chave: CHAVE_OBRAS, nome: PASTA_OBRAS },
    { chave: chaveObra(obra.id), nome: nomeComNumero(obra.nome, obra.numero) },
    { chave: chaveGeradorPci(obra.id), nome: PASTA_GERADOR_PCI },
  ];
}

/** Equipe/<Nome do usuário (nº)>/<Categoria> */
export function caminhoEquipe(usuario: Entidade, categoria: string): PastaAlvo[] {
  const cat: CategoriaEquipe = categoria in NOME_CATEGORIA_EQUIPE ? (categoria as CategoriaEquipe) : "outros";
  return [
    { chave: CHAVE_EQUIPE, nome: PASTA_EQUIPE },
    { chave: chaveEquipe(usuario.id), nome: nomeComNumero(usuario.nome, usuario.numero) },
    { chave: chaveCategoriaEquipe(usuario.id, cat), nome: NOME_CATEGORIA_EQUIPE[cat] },
  ];
}

/** Modelos/PCI CAIXA */
export function caminhoModeloPci(): PastaAlvo[] {
  return [
    { chave: CHAVE_MODELOS, nome: PASTA_MODELOS },
    { chave: CHAVE_MODELOS_PCI, nome: PASTA_MODELOS_PCI },
  ];
}

/** Clientes/<Nome (nº)>/Atendimento/WhatsApp */
export function caminhoWhatsappCliente(cliente: Entidade): PastaAlvo[] {
  return [...caminhoCliente(cliente, "atendimento"), { chave: chaveWhatsappCliente(cliente.id), nome: PASTA_WHATSAPP }];
}

/** WhatsApp sem cliente/<+55 número> */
export function caminhoWhatsappSemCliente(numero: string): PastaAlvo[] {
  return [
    { chave: CHAVE_WHATSAPP_SEM_CLIENTE, nome: PASTA_WHATSAPP_SEM_CLIENTE },
    { chave: chaveWhatsappSemCliente(numero), nome: `+${apenasDigitos(numero)}` },
  ];
}

/** Incorporação/<Estudo (nº)>/Orçamento */
export function caminhoOrcamentoEstudo(estudo: Entidade): PastaAlvo[] {
  return caminhoEstudo(estudo, { chave: "orcamento", nome: PASTA_ORCAMENTO });
}

/** "Foto 01 — 15-10-2026.jpg" (fotos de obra, numeradas dentro da medição). */
export function nomeFotoObra(ordem: number, data: Date, mime: string): string {
  return `Foto ${doisDigitos(ordem)} — ${dataArquivo(data)}${extensaoArquivo(null, mime)}`;
}

/** "PCI gerada — 29-10-2026.xls" */
export function nomePciGerada(data: Date, formato: string): string {
  return nomeArquivo("PCI gerada", data, `pci.${formato}`, "");
}

/** "PCI modelo v01 — 29-10-2026.xls" */
export function nomeModeloPci(versao: number, data: Date, nomeOriginal: string | null, mime: string): string {
  return nomeArquivo(`PCI modelo v${doisDigitos(versao)}`, data, nomeOriginal, mime);
}

/** "Mídia — 29-10-2026.jpg" */
export function nomeMidiaWhatsapp(data: Date, nomeOriginal: string | null, mime: string): string {
  return nomeArquivo("Mídia", data, nomeOriginal, (mime ?? "").split(";")[0].trim());
}

/** "Planilha importada — 29-10-2026.xlsx" */
export function nomePlanilhaOrcamento(data: Date, nomeOriginal: string | null, mime: string): string {
  return nomeArquivo("Planilha importada", data, nomeOriginal, mime);
}

/** "Documento pessoal — 29-10-2026.pdf" */
export function nomeDocumentoEquipe(categoria: string, data: Date, nomeOriginal: string | null, mime: string): string {
  const rotulo = categoria in NOME_CATEGORIA_EQUIPE ? NOME_CATEGORIA_EQUIPE[categoria as CategoriaEquipe] : NOME_CATEGORIA_EQUIPE.outros;
  return nomeArquivo(rotulo, data, nomeOriginal, mime);
}

/**
 * Pastas de topo que o sincronizador varre atrás de órfãs (registro apagado).
 * A etiqueta da pasta da entidade é sempre "<prefixo>:<id>" (sem outro ":").
 */
export const TOPOS_ORFAOS = [
  { chave: CHAVE_CLIENTES, prefixo: "cliente" },
  { chave: CHAVE_OBRAS, prefixo: "obra" },
  { chave: CHAVE_INCORPORACAO, prefixo: "incorporacao" },
  { chave: CHAVE_IMOVEIS, prefixo: "imovel" },
  { chave: CHAVE_EQUIPE, prefixo: "equipe" },
] as const;
export type PrefixoEntidade = (typeof TOPOS_ORFAOS)[number]["prefixo"];

/** "cliente:abc" → { prefixo: "cliente", id: "abc" }; subpastas ("cliente:abc:juridico") e outras etiquetas → null. */
export function entidadeDaChave(chave: string | null | undefined): { prefixo: PrefixoEntidade; id: string } | null {
  const m = /^(cliente|obra|incorporacao|imovel|equipe):([^:]+)$/.exec(chave ?? "");
  return m ? { prefixo: m[1] as PrefixoEntidade, id: m[2] } : null;
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
