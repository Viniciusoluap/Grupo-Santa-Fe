// Registro da Incorporação (3.4 Incorporação e Produto) — checklist dos
// documentos exigidos pelo art. 32 da Lei 4.591/64 para o registro da
// incorporação em cartório de imóveis.

export type StatusDocumento = "pendente" | "em_providencia" | "obtido";

export interface DocumentoRegistro {
  id: string;
  nome: string;
  status: StatusDocumento;
  dataObtencao?: string; // ISO yyyy-mm-dd
  observacoes?: string;
}

/** Checklist padrão (art. 32, Lei 4.591/64) — pré-preenchido automaticamente. */
export const DOCUMENTOS_PADRAO_REGISTRO: string[] = [
  "Título de propriedade do terreno",
  "Certidão negativa de ações reais referentes ao imóvel",
  "Certidão negativa de ônus reais referentes ao imóvel",
  "Certidões negativas de ações cíveis, criminais, trabalhistas e fiscais dos incorporadores",
  "Histórico dos títulos de propriedade dos últimos 20 anos",
  "Projeto de construção aprovado pela prefeitura",
  "Memorial descritivo das especificações da obra",
  "Discriminação das frações ideais de terreno e áreas comuns",
  "Minuta da futura convenção de condomínio",
  "Avaliação do custo global da obra",
  "Quadro-resumo conforme NBR 12721",
  "Declaração de idoneidade financeira dos incorporadores",
  "Certidão de matrícula atualizada do imóvel",
];

export interface ResumoRegistro {
  total: number;
  obtidos: number;
  emProvidencia: number;
  pendentes: DocumentoRegistro[];
  pctObtido: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoRegistro(documentos: DocumentoRegistro[]): ResumoRegistro {
  const total = documentos.length;
  const obtidos = documentos.filter((d) => d.status === "obtido").length;
  const emProvidencia = documentos.filter((d) => d.status === "em_providencia").length;
  const pendentes = documentos.filter((d) => d.status === "pendente");
  return {
    total,
    obtidos,
    emProvidencia,
    pendentes,
    pctObtido: total > 0 ? round1((obtidos / total) * 100) : 0,
  };
}

/** Lê o JSON salvo e diz se todos os documentos do checklist já foram obtidos — usado no progresso automático. */
export function registroCompletoDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { documentos?: DocumentoRegistro[] };
    return Array.isArray(dados.documentos) && dados.documentos.length > 0 && dados.documentos.every((d) => d.status === "obtido");
  } catch {
    return false;
  }
}
