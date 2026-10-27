// Cliente da API da Pluggy (Open Finance / Meu Pluggy) para o BPO › Bancos.
// Gêmeo de Prospecta/server/_core/pluggy.ts — nenhuma chamada aqui grava no banco.
const PLUGGY_API = "https://api.pluggy.ai";

export type PluggyTransaction = {
  externalId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  categoria?: string;
  titular?: string;
  /** Identificador estável informado pela instituição/Pluggy, quando disponível. */
  identificadorBancario?: string;
};

type ErroPluggy = { message?: unknown; codeDescription?: unknown; error?: unknown; code?: unknown };

async function detalheErro(res: Response): Promise<string> {
  let data: ErroPluggy | null = null;
  try { data = (await res.json()) as ErroPluggy; } catch { /* resposta vazia ou não JSON */ }
  const detalhe = [data?.message, data?.codeDescription, data?.error]
    .find((v) => typeof v === "string" && v.trim());
  const codigo = typeof data?.codeDescription === "string" && data.codeDescription.trim()
    ? ` [${data.codeDescription.trim()}]`
    : "";
  return `${typeof detalhe === "string" ? `: ${detalhe.trim().slice(0, 300)}` : ""}${codigo}`;
}

async function diagnosticarItem(token: string, itemId: string | null | undefined, fetchImpl: Fetch): Promise<string> {
  if (!itemId) return "";
  try {
    const res = await fetchImpl(`${PLUGGY_API}/items/${encodeURIComponent(itemId)}`, { headers: { "X-API-KEY": token } });
    if (!res.ok) return ` Item ${itemId}: diagnóstico indisponível (HTTP ${res.status}${await detalheErro(res)}).`;
    const item = (await res.json()) as {
      status?: string; executionStatus?: string; error?: { code?: string; message?: string } | null;
      statusDetail?: { code?: string; message?: string } | string | null;
    };
    const erro = item.error?.message || (typeof item.statusDetail === "string" ? item.statusDetail : item.statusDetail?.message);
    return ` Item ${itemId}: status=${item.status ?? "desconhecido"}, execução=${item.executionStatus ?? "desconhecida"}${erro ? `, motivo=${erro}` : ""}.`;
  } catch (e) {
    return ` Item ${itemId}: falha ao consultar diagnóstico (${e instanceof Error ? e.message : "erro"}).`;
  }
}

export type PluggyAccount = {
  id: string;
  nome: string;
  numero: string | null;
  tipo: string;
  saldo: number | null;
};

type Fetch = typeof fetch;

export type AutenticacaoPluggy =
  | { ok: true; token: string }
  | { ok: false; status: number | null; mensagem: string };

/**
 * LOTE B/D (25/10): autentica e devolve o motivo real quando a Pluggy recusa
 * (status HTTP + campo `message` do corpo). status null = não houve resposta (rede).
 * Gêmeo de autenticarPluggyDetalhado em Prospecta/server/_core/pluggy.ts.
 */
export async function autenticarPluggyDetalhado(clientId: string, clientSecret: string, fetchImpl: Fetch = fetch): Promise<AutenticacaoPluggy> {
  let res: Response;
  try {
    res = await fetchImpl(`${PLUGGY_API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
  } catch (e) {
    return { ok: false, status: null, mensagem: e instanceof Error ? e.message : "sem resposta" };
  }
  type Corpo = { apiKey?: string; message?: unknown; codeDescription?: unknown; error?: unknown };
  let data: Corpo | null = null;
  try { data = (await res.json()) as Corpo; } catch { /* corpo vazio */ }
  if (!res.ok) {
    const m = [data?.message, data?.codeDescription, data?.error].find((v) => typeof v === "string" && v.trim());
    return { ok: false, status: res.status ?? null, mensagem: typeof m === "string" ? m.trim().slice(0, 300) : "sem detalhe" };
  }
  if (!data?.apiKey) return { ok: false, status: res.status ?? null, mensagem: "a Pluggy não devolveu o token" };
  return { ok: true, token: data.apiKey };
}

/** Texto para a tela: "A Pluggy recusou (HTTP x): <mensagem>" + dica quando é o plano gratuito/trial. */
export function mensagemRecusaPluggy(status: number | null, mensagem: string): string {
  if (status === null) return `Não consegui falar com a Pluggy: ${mensagem}`;
  const base = `A Pluggy recusou (HTTP ${status}): ${mensagem}`;
  return /trial|subscription|assinatura|plano|plan\b/i.test(mensagem)
    ? `${base} — o plano gratuito da Pluggy não libera a API; use Importar extrato.`
    : base;
}

/** Compatibilidade: token ou null (sem detalhe). Para o motivo, use autenticarPluggyDetalhado. */
export async function authenticatePluggy(clientId: string, clientSecret: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const r = await autenticarPluggyDetalhado(clientId, clientSecret, fetchImpl);
  return r.ok ? r.token : null;
}

/**
 * Transações da conta a partir de `desde` (AAAA-MM-DD), percorrendo todas as páginas.
 * Pedido de 25/10: a data inicial da conta vira o filtro `from` da Pluggy.
 */
export async function fetchPluggyTransactions(
  token: string,
  accountId: string,
  desde?: string | null,
  fetchImpl: Fetch = fetch,
  itemId?: string | null,
): Promise<PluggyTransaction[]> {
  const out: PluggyTransaction[] = [];
  const params = new URLSearchParams({ accountId, pageSize: "500" });
  if (desde) params.set("from", desde);
  let proxima: string | null = `?${params.toString()}`;
  const cursores = new Set<string>();
  for (let pagina = 0; proxima && pagina < 200; pagina++) {
    if (cursores.has(proxima)) throw new Error("A Pluggy devolveu um cursor repetido; a sincronização foi interrompida para evitar duplicação.");
    cursores.add(proxima);
    const url = proxima.startsWith("http") ? proxima : `${PLUGGY_API}/v2/transactions${proxima.startsWith("?") ? proxima : `?${proxima}`}`;
    const res = await fetchImpl(url, { headers: { "X-API-KEY": token } });
    if (!res.ok) {
      const detalhe = await detalheErro(res);
      const diagnostico = res.status === 410 ? await diagnosticarItem(token, itemId, fetchImpl) : "";
      throw new Error(`A Pluggy recusou a leitura das transações (HTTP ${res.status}${detalhe}).${diagnostico}`);
    }
    const data = (await res.json()) as {
      next?: string | null;
      results: {
        id: string; date: string; description: string; amount: number; type: string; category?: string;
        providerId?: string | null; providerCode?: string | null; descriptionRaw?: string | null;
        paymentData?: { payer?: { name?: string | null } | null; receiver?: { name?: string | null } | null } | null;
      }[];
    };
    for (const t of data.results ?? []) {
      const parte = t.type === "CREDIT" ? t.paymentData?.payer : t.paymentData?.receiver;
      const titular = parte?.name?.trim();
      const identificador = t.providerId?.trim() || t.providerCode?.trim();
      out.push({
        ...(titular ? { titular } : {}),
        ...(identificador ? { identificadorBancario: identificador } : {}),
        externalId: t.providerId?.trim() ? `pluggy:${t.providerId.trim()}` : t.id,
        data: t.date,
        descricao: t.descriptionRaw || t.description,
        valor: Math.abs(t.amount),
        tipo: t.type === "CREDIT" ? "credito" : "debito",
        categoria: t.category,
      });
    }
    proxima = typeof data.next === "string" && data.next.trim() ? data.next.trim() : null;
  }
  if (proxima) throw new Error("A Pluggy ultrapassou o limite seguro de 200 páginas na sincronização.");
  return out;
}

export async function fetchPluggyAccountBalance(token: string, accountId: string, fetchImpl: Fetch = fetch): Promise<number | null> {
  const res = await fetchImpl(`${PLUGGY_API}/accounts/${accountId}`, { headers: { "X-API-KEY": token } });
  if (!res.ok) return null;
  const data = (await res.json()) as { balance: number };
  return data.balance ?? null;
}

/** Contas de uma conexão (item) — usado para cadastrar sozinho as contas do Meu Pluggy. */
export async function fetchPluggyItemAccounts(token: string, itemId: string, fetchImpl: Fetch = fetch): Promise<PluggyAccount[]> {
  const res = await fetchImpl(`${PLUGGY_API}/accounts?itemId=${encodeURIComponent(itemId)}`, { headers: { "X-API-KEY": token } });
  if (!res.ok) throw new Error(`A Pluggy não encontrou a conexão informada (HTTP ${res.status}).`);
  const data = (await res.json()) as {
    results: { id: string; name?: string; marketingName?: string; number?: string; type?: string; subtype?: string; balance?: number }[];
  };
  return (data.results ?? []).map(a => ({
    id: a.id,
    nome: a.marketingName || a.name || "Conta",
    numero: a.number ?? null,
    tipo: a.subtype || a.type || "",
    saldo: typeof a.balance === "number" ? a.balance : null,
  }));
}

/** Nome da instituição de uma conexão (ex.: "C6 Bank" via Meu Pluggy). */
export async function fetchPluggyItemConnector(token: string, itemId: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const res = await fetchImpl(`${PLUGGY_API}/items/${encodeURIComponent(itemId)}`, { headers: { "X-API-KEY": token } });
  if (!res.ok) return null;
  const data = (await res.json()) as { connector?: { name?: string } };
  return data.connector?.name ?? null;
}

/** Token de 30 minutos para abrir o Pluggy Connect na tela (conectar via Meu Pluggy). */
export async function createPluggyConnectToken(token: string, fetchImpl: Fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${PLUGGY_API}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": token },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`A Pluggy não liberou a conexão (HTTP ${res.status}).`);
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) throw new Error("A Pluggy não devolveu o token de conexão.");
  return data.accessToken;
}

/**
 * Pedido de 25/10 (avisos em tempo real): garante um webhook "all" da Pluggy apontando para o
 * sistema, com cabeçalho secreto. Idempotente: não duplica se já existir para a mesma URL.
 */
export async function garantirWebhookPluggy(token: string, url: string, segredo: string, fetchImpl: Fetch = fetch): Promise<"existente" | "criado"> {
  const lista = await fetchImpl(`${PLUGGY_API}/webhooks`, { headers: { "X-API-KEY": token } });
  if (lista.ok) {
    const data = (await lista.json()) as { results?: { url?: string }[] };
    if ((data.results ?? []).some(w => w.url === url)) return "existente";
  }
  const res = await fetchImpl(`${PLUGGY_API}/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": token },
    body: JSON.stringify({ event: "all", url, headers: { "x-webhook-token": segredo } }),
  });
  if (!res.ok) throw new Error(`A Pluggy não aceitou o aviso em tempo real (HTTP ${res.status}).`);
  return "criado";
}
