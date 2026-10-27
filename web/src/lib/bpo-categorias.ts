// LOTE C (25/10, paridade Prospecta): categorias padrão do BPO Financeiro para as movimentações
// bancárias e os lançamentos gerados por elas, com sugestão automática por palavras-chave.
// Regras puras (sem banco/rede). Também concentra as regras de "o que entra no resultado".
import { saldoLancamento, valorRealizado } from "@/lib/bpo-parciais";

export const TRANSFERENCIA_INTERNA = "Transferência interna";

export const CATEGORIAS_BPO = [
  "Recebimento de cliente",
  "Financiamento/CAIXA",
  "Material",
  "Mão de obra",
  "Projetos e taxas",
  "Impostos",
  "Tarifas bancárias",
  "Pró-labore",
  "Administrativo",
  TRANSFERENCIA_INTERNA,
  "Outros",
] as const;

export type CategoriaBpo = (typeof CATEGORIAS_BPO)[number];

export function categoriaValida(v: unknown): v is CategoriaBpo {
  return typeof v === "string" && (CATEGORIAS_BPO as readonly string[]).includes(v);
}

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Regra = { categoria: CategoriaBpo; padrao: RegExp; tipo?: "credito" | "debito" };

// A ordem importa: a primeira regra que casar vence.
const REGRAS: Regra[] = [
  { categoria: TRANSFERENCIA_INTERNA, padrao: /\b(entre contas|mesma titularidade|conta propria|contas proprias|transferencia interna|transf\.? interna|aplicacao automatica|resgate automatico)\b/ },
  { categoria: "Tarifas bancárias", padrao: /\b(tarifa|tarifas|tar\.?|cesta de servicos|pacote de servicos|manutencao de conta|anuidade|iof|juros|encargos|taxa bancaria|mensalidade conta|taxas? (do |de |da )?(boleto|pix|ted|doc|transferencia|cobranca|saque)|payment_fee|fee)\b/ },
  { categoria: "Financiamento/CAIXA", padrao: /\b(caixa economica|cef|caixa|financiamento|fgts|habitacional|mcmv|minha casa)\b/, tipo: "credito" },
  { categoria: "Impostos", padrao: /\b(das simples|das mei|pgto das|pagamento das? simples|documento de arrecadacao|darf|gps|inss|fgts|iss|issqn|irpj|csll|cofins|pis|simples nacional|imposto|impostos|tributo|tributos|receita federal|sefaz|gru)\b/, tipo: "debito" },
  { categoria: "Pró-labore", padrao: /\b(pro.?labore|prolabore|retirada socio|retirada de socio)\b/, tipo: "debito" },
  { categoria: "Mão de obra", padrao: /\b(mao de obra|diaria|diarias|empreiteir\w*|pedreiro|servente|eletricista|encanador|pintor|folha|salario|salarios|ferias|rescisao|13o)\b/, tipo: "debito" },
  { categoria: "Material", padrao: /\b(material|materiais|construcao|cimento|areia|brita|tijolo|bloco|ferragem|ferro|madeireira|madeira|home center|leroy|telha|tinta|tintas|deposito|hidraulica|eletrica|vidracaria|ceramica|piso)\b/, tipo: "debito" },
  { categoria: "Financiamento/CAIXA", padrao: /\b(caixa economica|cef|financiamento|habitacional)\b/ },
  { categoria: "Projetos e taxas", padrao: /\b(projeto|projetos|art|rrt|crea|cau|prefeitura|alvara|cartorio|registro de imoveis|habite.?se|taxa|taxas|emolumentos|licenca)\b/, tipo: "debito" },
  { categoria: "Administrativo", padrao: /\b(aluguel|energia|equatorial|celpa|agua|cosanpa|saneamento|internet|telefone|telefonia|vivo|claro|tim|contador|contabilidade|escritorio|software|assinatura|google|microsoft|combustivel|posto|papelaria|correios|marketing)\b/, tipo: "debito" },
];

/**
 * Sugere a categoria de uma movimentação pela descrição (e pela categoria do provedor, se houver).
 * Entrada sem palavra conhecida: crédito → "Recebimento de cliente"; débito → "Outros".
 */
export function sugerirCategoria(descricao: string, tipo: "credito" | "debito" | string, dica?: string | null): CategoriaBpo {
  const texto = sem(`${descricao ?? ""} ${dica ?? ""}`);
  for (const r of REGRAS) {
    if (r.tipo && r.tipo !== tipo) continue;
    if (r.padrao.test(texto)) return r.categoria;
  }
  return tipo === "credito" ? "Recebimento de cliente" : "Outros";
}

/** Tipo do lançamento do BPO gerado por uma movimentação bancária. */
export const tipoLancamentoDaTransacao = (tipo: string) => (tipo === "credito" ? "recebimento" : "despesa");

/** Lançamento de saída (aba Despesas): "despesa" e as variações "despesa_*" do formulário. */
export const ehDespesa = (tipo: string) => tipo === "despesa" || tipo.startsWith("despesa_");

/** Transferência interna (entre contas da empresa) não é receita nem despesa. */
export const contaNoResultado = (l: { categoria?: string | null }) => l.categoria !== TRANSFERENCIA_INTERNA;

/** Nome comparável para regras automáticas de classificação por titular. */
export function normalizarTitular(nome: string | null | undefined): string {
  return sem(String(nome ?? ""))
    .replace(/[\d.\-/*]{6,}/g, " ")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

/** Monta a descrição sem perder o titular original do Pix. */
export function descricaoComTitular(partes: (string | null | undefined)[]): string {
  const saida: string[] = [];
  for (const parte of partes) {
    const texto = String(parte ?? "").replace(/\s+/g, " ").trim();
    if (!texto) continue;
    const normal = sem(texto);
    if (saida.some((atual) => sem(atual).includes(normal))) continue;
    saida.push(texto);
  }
  return (saida.join(" — ") || "Movimentação bancária").slice(0, 500);
}

export function resumoPorCliente(lancamentos: { clienteId: string | null; tipo: string; valor: number; pago: boolean; valorRecebido?: number; categoria?: string | null }[]) {
  const totais = new Map<string, { recebido: number; emAberto: number }>();
  for (const lancamento of lancamentos) {
    if (!lancamento.clienteId || ehDespesa(lancamento.tipo) || !contaNoResultado(lancamento)) continue;
    const atual = totais.get(lancamento.clienteId) ?? { recebido: 0, emAberto: 0 };
    atual.recebido += Math.round(valorRealizado(lancamento) * 100);
    atual.emAberto += Math.round(saldoLancamento(lancamento) * 100);
    totais.set(lancamento.clienteId, atual);
  }
  return new Map(Array.from(totais, ([id, valor]) => [id, {
    recebido: valor.recebido / 100,
    emAberto: valor.emAberto / 100,
  }]));
}
