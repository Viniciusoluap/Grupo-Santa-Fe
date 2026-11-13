// Pedido de 12/11: importar o backup ZIP do Conta Azul Pro ("Meu Plano > Backup") no BPO Financeiro.
// Regras puras (sem banco/rede). Paridade BPO (13/11): gêmeo de Prospecta/shared/financeiro/conta-azul.ts
// (mesma regra; aqui os ids são texto/cuid e as categorias vêm de @/lib/bpo-categorias).
//
// O ZIP traz CSVs em UTF-8, separados por vírgula, com aspas no padrão RFC 4180:
//   pessoas.csv     tipo (Cliente/Fornecedor/Vendedor), nome, razao_social, tipo_pessoa (F/J), cpf_cnpj, fones, e-mail...
//   financeiro.csv  id, tipo (REVENUE/EXPENSE), status (ACQUITTED/PENDING), valor (ponto decimal), datas AAAA-MM-DD,
//                   nome_do_negociador, categoria, centro_de_custo, conta_financeira, metodo_de_pagamento...
//   propostas_comerciais, lista_precos, nfes, negociacoes, produtos — sem equivalente no BPO (só contados).
//
// Particularidades conferidas no backup real (05/05/2026, 1.912 linhas):
// - Um lançamento com mais de uma categoria vem em várias linhas com o MESMO id, cada uma com o valor da categoria.
// - O mesmo id também se repete com a MESMA categoria e o MESMO valor, mudando só o centro de custo. Somar essas
//   linhas dobraria o valor; o lançamento entra uma vez, com os centros de custo juntos ("A / B").
// - Transferências entre contas/empresas do grupo não são receita nem despesa (mesma regra do extrato bancário).

import { ehDespesa, normalizarTitular, sugerirCategoria, TRANSFERENCIA_INTERNA, type CategoriaBpo } from "@/lib/bpo-categorias";

export const ARQUIVOS_CONTA_AZUL = [
  "pessoas.csv", "financeiro.csv", "propostas_comerciais.csv", "lista_precos.csv", "nfes.csv", "negociacoes.csv", "produtos.csv",
] as const;
/** Limite de texto aceito por arquivo (o financeiro real tem ~0,6 MB). */
export const LIMITE_ARQUIVO_CONTA_AZUL = 3_000_000;

const COLUNAS_FINANCEIRO = ["id", "valor", "tipo", "status", "data_de_vencimento", "data_de_competencia"] as const;
const COLUNAS_PESSOAS = ["tipo", "nome"] as const;

/** CSV RFC 4180: vírgula, aspas duplas (com "" escapado), quebras de linha dentro de aspas, BOM e CRLF. */
export function parseCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const linhas: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); if (linha.length > 1 || linha[0] !== "") linhas.push(linha); }
  return linhas;
}

/** Linhas como objetos pelo cabeçalho (nomes de coluna em minúsculas, sem espaços nas pontas). */
export function registrosCsv(texto: string): { colunas: string[]; registros: Record<string, string>[] } {
  const [cab = [], ...resto] = parseCsv(texto);
  const colunas = cab.map(c => c.trim().toLowerCase());
  return {
    colunas,
    registros: resto.map(l => Object.fromEntries(colunas.map((c, i) => [c, (l[i] ?? "").trim()]))),
  };
}

/** "1234.56" (formato do backup) ou "1.234,56"/"1234,56" → "1234.56"; inválido/negativo → null. */
export function valorContaAzul(v: string): string | null {
  const s = v.replace(/[R$\s]/g, "");
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(norm)) return null;
  const n = Math.round(Number(norm) * 100);
  return Number.isFinite(n) ? (n / 100).toFixed(2) : null;
}

/** AAAA-MM-DD (formato do backup) ou DD/MM/AAAA → AAAA-MM-DD válido; senão null. */
export function dataContaAzul(v: string): string | null {
  const s = v.trim().slice(0, 10);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Transferência entre contas ou entre empresas do grupo (inclusive empréstimo entre elas): fora do resultado. */
export function ehTransferenciaContaAzul(categoria: string): boolean {
  const c = sem(categoria);
  return /transferencia/.test(c) || /entre empresas/.test(c) || /entre contas/.test(c);
}

/** Categorias usuais do plano do Conta Azul que as palavras-chave do extrato não cobrem. */
const REGRAS_CONTA_AZUL: { padrao: RegExp; categoria: CategoriaBpo; tipo?: "receita" | "despesa" }[] = [
  { padrao: /\b(saldo inicial|aporte|emprestimos?|factoring|estornos?|devolucao|devolucoes|antecipacao de lucros|dividas?)\b/, categoria: "Outros" },
  { padrao: /\b(servicos terceirizados - obra|terceirizados.*obra|empreitada)\b/, categoria: "Mão de obra", tipo: "despesa" },
  { padrao: /\bmultas? de transito\b/, categoria: "Administrativo", tipo: "despesa" },
  { padrao: /\b(despachante|engenheiro|projetista|registros?|certidao|certidoes|itbi|ancca|cnd|cartorio)\b/, categoria: "Projetos e taxas", tipo: "despesa" },
  { padrao: /\b(honorarios?|telefonia|salarios?|folha|escritorio|softwares?|sistemas?|combustive(l|is)|veiculos?|marketing|publicidade|trafego pago|viagens?|transporte|plano de saude|vale|adiantamento salarial|comisso(es)?|associacoes|manutencao|fretes?|limpeza)\b/, categoria: "Administrativo", tipo: "despesa" },
  { padrao: /\b(tarifas?|juros|multas?)\b/, categoria: "Tarifas bancárias", tipo: "despesa" },
];

/**
 * Categoria do BPO para a categoria do Conta Azul (o nome original fica nas observações do lançamento).
 * A categoria do Conta Azul manda; a descrição só decide quando a categoria não diz nada.
 */
export function categoriaDoContaAzul(categoria: string, descricao: string, tipo: "receita" | "despesa"): CategoriaBpo {
  if (ehTransferenciaContaAzul(categoria)) return TRANSFERENCIA_INTERNA;
  const mov = tipo === "receita" ? "credito" : "debito";
  const padrao = tipo === "receita" ? "Recebimento de cliente" : "Outros";
  const c = sem(categoria);
  for (const r of REGRAS_CONTA_AZUL) if ((!r.tipo || r.tipo === tipo) && r.padrao.test(c)) return r.categoria;
  const pelaCategoria = sugerirCategoria(categoria, mov);
  if (pelaCategoria !== padrao && pelaCategoria !== TRANSFERENCIA_INTERNA) return pelaCategoria;
  if (/\b(a identificar|outras|outros|diversas)\b/.test(c) || !c) {
    const pelaDescricao = sugerirCategoria(descricao, mov);
    if (pelaDescricao !== TRANSFERENCIA_INTERNA) return pelaDescricao;
  }
  return padrao;
}

export type PessoaContaAzul = {
  papel: string; // Cliente, Fornecedor, Vendedor
  nome: string;
  razaoSocial: string;
  tipoPessoa: "F" | "J" | null;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string;
  ativo: boolean;
  chaveNome: string;
};

export type MovimentoContaAzul = {
  /** Chave idempotente (vai no request_key do lançamento): reimportar o mesmo backup não duplica. */
  chave: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: string;
  vencimento: string;
  competencia: string;
  pago: boolean;
  pagoEm: string | null;
  negociador: string;
  categoriaOriginal: string;
  categoria: CategoriaBpo;
  centrosCusto: string[];
  conta: string;
  metodo: string;
};

export type BackupContaAzul = {
  pessoas: PessoaContaAzul[];
  movimentos: MovimentoContaAzul[];
  /** Linhas repetidas em outro centro de custo com o mesmo valor (entram uma vez). */
  repetidasPorCentro: number;
  /** Transferências entre contas/empresas: não viram lançamento (não são receita nem despesa). */
  transferencias: { quantidade: number; total: string };
  erros: string[];
  outrosArquivos: { arquivo: string; linhas: number }[];
  arquivosAusentes: string[];
};

/** FNV-1a 32 bits em hexadecimal — só para compor a chave estável da linha. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const METODOS: Record<string, string> = {
  OTHER: "Outro", BANKING_TRANSFER: "Transferência bancária", INSTANT_PAYMENT: "Pix", BANKING_BILLET: "Boleto",
  CASH: "Dinheiro", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", CHECK: "Cheque",
};
export const rotuloMetodoContaAzul = (m: string) => METODOS[m] ?? m;

function lerPessoas(texto: string, erros: string[]): PessoaContaAzul[] {
  const { colunas, registros } = registrosCsv(texto);
  const faltam = COLUNAS_PESSOAS.filter(c => !colunas.includes(c));
  if (faltam.length) { erros.push(`pessoas.csv sem as colunas: ${faltam.join(", ")}.`); return []; }
  const out: PessoaContaAzul[] = [];
  registros.forEach((r, i) => {
    const nome = (r.nome || r.razao_social || "").replace(/\s+/g, " ").trim();
    if (!nome) { erros.push(`pessoas.csv, linha ${i + 2}: sem nome (ignorada).`); return; }
    const doc = (r.cpf_cnpj ?? "").replace(/\D/g, "");
    const tipoPessoa = r.tipo_pessoa === "F" || r.tipo_pessoa === "J" ? r.tipo_pessoa : doc.length === 11 ? "F" : doc.length === 14 ? "J" : null;
    out.push({
      papel: r.tipo || "Cliente",
      nome: nome.slice(0, 255),
      razaoSocial: (r.razao_social || "").trim().slice(0, 255),
      tipoPessoa,
      cpf: doc.length === 11 ? doc : null,
      cnpj: doc.length === 14 ? doc : null,
      email: r.email ? r.email.slice(0, 255) : null,
      telefone: (r.fone_celular || r.fone_comercial || "").slice(0, 20),
      ativo: (r.fl_ativo ?? "true").toLowerCase() !== "false",
      chaveNome: normalizarTitular(nome),
    });
  });
  return out;
}

function lerFinanceiro(texto: string, erros: string[]) {
  const { colunas, registros } = registrosCsv(texto);
  const faltam = COLUNAS_FINANCEIRO.filter(c => !colunas.includes(c));
  if (faltam.length) { erros.push(`financeiro.csv sem as colunas: ${faltam.join(", ")}.`); return { movimentos: [], repetidasPorCentro: 0, transferencias: { quantidade: 0, total: "0.00" } }; }
  // agrupa por id + categoria + valor + descrição: linhas iguais que só mudam o centro de custo viram uma só
  const grupos = new Map<string, { r: Record<string, string>; centros: string[]; linha: number }>();
  let repetidasPorCentro = 0;
  registros.forEach((r, i) => {
    const chave = [r.id, r.categoria ?? "", r.valor, r.descricao ?? "", r.tipo].join("\u0001");
    const g = grupos.get(chave);
    const centro = (r.centro_de_custo ?? "").trim();
    if (g) { repetidasPorCentro++; if (centro && !g.centros.includes(centro)) g.centros.push(centro); }
    else grupos.set(chave, { r, centros: centro ? [centro] : [], linha: i + 2 });
  });
  const movimentos: MovimentoContaAzul[] = [];
  let transfQtd = 0, transfCentavos = 0;
  for (const { r, centros, linha } of Array.from(grupos.values())) {
    const tipo = r.tipo === "REVENUE" ? "receita" : r.tipo === "EXPENSE" ? "despesa" : null;
    const valor = valorContaAzul(r.valor);
    const vencimento = dataContaAzul(r.data_de_vencimento) ?? dataContaAzul(r.data ?? "");
    const competencia = (dataContaAzul(r.data_de_competencia) ?? vencimento)?.slice(0, 7) ?? null;
    if (!r.id || !tipo || !valor || !vencimento || !competencia) {
      erros.push(`financeiro.csv, linha ${linha}: ${!r.id ? "sem id" : !tipo ? `tipo "${r.tipo}" desconhecido` : !valor ? `valor "${r.valor}" inválido` : "data inválida"} (ignorada).`);
      continue;
    }
    const categoriaOriginal = (r.categoria ?? "").trim();
    const descricao = ((r.descricao ?? "").replace(/\s+/g, " ").trim() || categoriaOriginal || "Lançamento do Conta Azul").slice(0, 500);
    const categoria = categoriaDoContaAzul(categoriaOriginal, descricao, tipo);
    if (categoria === TRANSFERENCIA_INTERNA) { transfQtd++; transfCentavos += Math.round(Number(valor) * 100); continue; }
    const pago = r.status === "ACQUITTED";
    movimentos.push({
      chave: `contaazul:${r.id.slice(0, 40)}:${hash([categoriaOriginal, valor, descricao, r.tipo].join("|"))}`,
      tipo, descricao, valor, vencimento, competencia, pago,
      pagoEm: pago ? (dataContaAzul(r.data_de_quitacao ?? "") ?? dataContaAzul(r.data ?? "") ?? vencimento) : null,
      negociador: (r.nome_do_negociador ?? "").replace(/\s+/g, " ").trim().slice(0, 255),
      categoriaOriginal, categoria, centrosCusto: centros,
      conta: (r.conta_financeira ?? "").trim(), metodo: (r.metodo_de_pagamento ?? "").trim(),
    });
  }
  return { movimentos, repetidasPorCentro, transferencias: { quantidade: transfQtd, total: (transfCentavos / 100).toFixed(2) } };
}

/** Lê os CSVs do backup (nome do arquivo → texto). Arquivo de outra pasta do ZIP vale pelo nome. */
export function lerBackupContaAzul(arquivos: Record<string, string>): BackupContaAzul {
  const porNome = new Map(Object.entries(arquivos).map(([n, t]) => [n.split("/").pop()!.toLowerCase(), t]));
  const erros: string[] = [];
  const pessoas = porNome.has("pessoas.csv") ? lerPessoas(porNome.get("pessoas.csv")!, erros) : [];
  const fin = porNome.has("financeiro.csv") ? lerFinanceiro(porNome.get("financeiro.csv")!, erros) : { movimentos: [], repetidasPorCentro: 0, transferencias: { quantidade: 0, total: "0.00" } };
  const outrosArquivos = ARQUIVOS_CONTA_AZUL.filter(a => a !== "pessoas.csv" && a !== "financeiro.csv" && porNome.has(a))
    .map(arquivo => ({ arquivo, linhas: registrosCsv(porNome.get(arquivo)!).registros.length }));
  const arquivosAusentes = (["pessoas.csv", "financeiro.csv"] as const).filter(a => !porNome.has(a));
  if (arquivosAusentes.length === 2) erros.unshift("O arquivo não parece um backup do Conta Azul: faltam pessoas.csv e financeiro.csv.");
  return { pessoas, movimentos: fin.movimentos, repetidasPorCentro: fin.repetidasPorCentro, transferencias: fin.transferencias, erros, outrosArquivos, arquivosAusentes };
}

/** Observações gravadas no lançamento: rastro do que veio do Conta Azul. */
export function observacoesDoMovimento(m: MovimentoContaAzul): string {
  return [
    "Importado do Conta Azul (backup).",
    m.categoriaOriginal && `Categoria no Conta Azul: ${m.categoriaOriginal}.`,
    m.conta && `Conta financeira: ${m.conta}.`,
    m.metodo && `Forma de pagamento: ${rotuloMetodoContaAzul(m.metodo)}.`,
  ].filter(Boolean).join(" ");
}

// ── Pedido de 12/11 (noite): conciliação com o extrato e o Asaas, sem duplicar o que veio do Conta Azul ──
//
// Ao ligar a mesma conta bancária no BPO, as movimentações do período do backup chegam de novo. Antes de criar
// um lançamento, procura-se o lançamento do Conta Azul do MESMO tipo e MESMO valor, JÁ PAGO, ainda não
// conciliado, com quitação a até 3 dias da data do banco. Vários candidatos: o de data mais próxima; cada
// movimento e cada lançamento são usados uma vez só. Só liga (o lançamento fica com valor e status dele).
// Decisão do dono (12/11, noite): lançamento EM ABERTO não é mais baixado sozinho — vira sugestão na aba
// "A classificar" (shared/financeiro/bpo-a-classificar.ts).

export const JANELA_CONCILIACAO_PAGO_DIAS = 3;

export type MovimentoParaConciliar = { id: string; tipo: "receita" | "despesa"; valor: string | number; data: Date | string };
export type LancamentoContaAzulParaConciliar = {
  id: string; tipo: string; valor: string | number; pago: boolean; pagoEm: Date | string | null; vencimento: Date | string;
};

const diaUtc = (d: Date | string) => Math.floor(new Date(typeof d === "string" && d.length === 10 ? `${d}T12:00:00Z` : d).getTime() / 86_400_000);
const centavos = (v: string | number) => Math.round(Number(v) * 100);

/** Pares movimento → lançamento do Conta Azul já pago (id do movimento → id do lançamento). Em aberto nunca entra. */
export function conciliarComContaAzul(movimentos: MovimentoParaConciliar[], candidatos: LancamentoContaAzulParaConciliar[]): Map<string, string> {
  const pares: { mov: string; lanc: string; distancia: number }[] = [];
  const porChave = new Map<string, LancamentoContaAzulParaConciliar[]>();
  for (const c of candidatos) {
    if (!c.pago || !c.pagoEm) continue;
    // Santa Fé: o lançamento é "recebimento"/"honorario"/... ou "despesa"/"despesa_*".
    const k = `${ehDespesa(c.tipo) ? "despesa" : "receita"}|${centavos(c.valor)}`;
    porChave.set(k, [...(porChave.get(k) ?? []), c]);
  }
  for (const m of movimentos) {
    const dm = diaUtc(m.data);
    for (const c of porChave.get(`${m.tipo}|${centavos(m.valor)}`) ?? []) {
      const distancia = Math.abs(dm - diaUtc(c.pagoEm!));
      if (distancia <= JANELA_CONCILIACAO_PAGO_DIAS) pares.push({ mov: m.id, lanc: c.id, distancia });
    }
  }
  pares.sort((a, b) => a.distancia - b.distancia || a.mov.localeCompare(b.mov) || a.lanc.localeCompare(b.lanc));
  const usadosMov = new Set<string>(), usadosLanc = new Set<string>(), resultado = new Map<string, string>();
  for (const p of pares) {
    if (usadosMov.has(p.mov) || usadosLanc.has(p.lanc)) continue;
    usadosMov.add(p.mov); usadosLanc.add(p.lanc); resultado.set(p.mov, p.lanc);
  }
  return resultado;
}

/** Cobrança do Asaas EM ABERTO ↔ receita do Conta Azul EM ABERTO: só com o mesmo cliente BPO, mesmo valor e vencimento a até 3 dias. */
export const JANELA_ASAAS_ABERTO_DIAS = 3;

/**
 * É a mesma cobrança (emitida no Asaas e registrada no Conta Azul) quando há UM único candidato em aberto
 * do mesmo cliente BPO, mesmo valor e vencimento a até 3 dias. Ambíguo (2 ou mais) ou sem cliente: não liga.
 */
export function receitaEmAbertoDoContaAzul(
  cobranca: { clienteId: string | null; valor: string | number; vencimento: Date | string },
  candidatos: (LancamentoContaAzulParaConciliar & { clienteId: string | null })[],
): string | null {
  if (cobranca.clienteId == null) return null;
  const v = diaUtc(cobranca.vencimento);
  const iguais = candidatos.filter(c => !c.pago && !ehDespesa(c.tipo) && c.clienteId === cobranca.clienteId
    && centavos(c.valor) === centavos(cobranca.valor) && Math.abs(diaUtc(c.vencimento) - v) <= JANELA_ASAAS_ABERTO_DIAS);
  return iguais.length === 1 ? iguais[0].id : null;
}
