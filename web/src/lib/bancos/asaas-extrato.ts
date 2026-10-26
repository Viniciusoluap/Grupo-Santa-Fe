// Pedido de 25/10: extrato e saldo da conta Asaas pela API (sem custo), para o BPO › Bancos.
// Gêmeo de Prospecta/server/_core/asaas-extrato.ts. Usa a chave da conta (ou a chave central de Integrações).
const ASAAS_API = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://sandbox.asaas.com/api/v3",
} as const;

type Fetch = typeof fetch;

export type AsaasMovimento = {
  externalId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  categoria?: string;
  asaasPaymentId?: string;
};

export type AsaasCobranca = {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  customer?: string;
};

function baseUrl(apiKey: string) {
  return apiKey.trim().startsWith("$aact_prod") ? ASAAS_API.production : ASAAS_API.sandbox;
}

async function getAsaas<T>(apiKey: string, path: string, fetchImpl: Fetch): Promise<T> {
  const res = await fetchImpl(`${baseUrl(apiKey)}${path}`, {
    headers: { access_token: apiKey.trim(), "Content-Type": "application/json", "User-Agent": "GrupoSantaFe-BPO" },
  });
  if (!res.ok) {
    // LOTE D (25/10): mostrar o motivo exato devolvido pelo Asaas (ex.: chave inválida, IP não autorizado).
    let detalhe = "";
    try {
      const corpo = (await res.json()) as { errors?: { code?: string; description?: string }[] };
      detalhe = (corpo.errors ?? []).map((e) => e.description || e.code).filter(Boolean).join("; ");
    } catch { /* corpo vazio */ }
    const dica = res.status === 401 ? " Confira se a chave está ativa e se há restrição de IP no Asaas (Integrações › Chave de API)." : "";
    throw new Error(`O Asaas recusou o acesso (HTTP ${res.status})${detalhe ? `: ${detalhe}` : ""}.${dica}`);
  }
  return (await res.json()) as T;
}

export async function fetchAsaasSaldo(apiKey: string, fetchImpl: Fetch = fetch): Promise<number> {
  const data = await getAsaas<{ balance?: number }>(apiKey, "/finance/balance", fetchImpl);
  return Number(data.balance ?? 0);
}

export async function fetchAsaasExtrato(apiKey: string, desde: string, ate: string, fetchImpl: Fetch = fetch): Promise<AsaasMovimento[]> {
  const out: AsaasMovimento[] = [];
  for (let offset = 0, pagina = 0; pagina < 100; pagina++, offset += 100) {
    const q = new URLSearchParams({ startDate: desde, finishDate: ate, offset: String(offset), limit: "100" });
    const data = await getAsaas<{
      hasMore?: boolean;
      data?: { id: string; value: number; date: string; description?: string; type?: string; paymentId?: string }[];
    }>(apiKey, `/financialTransactions?${q}`, fetchImpl);
    for (const t of data.data ?? []) {
      out.push({
        externalId: `asaas:${t.id}`,
        data: t.date,
        descricao: t.description || t.type || "Movimentação Asaas",
        valor: Math.abs(Number(t.value)),
        tipo: Number(t.value) < 0 ? "debito" : "credito",
        categoria: t.type,
        asaasPaymentId: t.paymentId,
      });
    }
    if (!data.hasMore) break;
  }
  return out;
}

export async function fetchAsaasCobrancas(apiKey: string, desde: string, fetchImpl: Fetch = fetch): Promise<AsaasCobranca[]> {
  const out: AsaasCobranca[] = [];
  for (let offset = 0, pagina = 0; pagina < 100; pagina++, offset += 100) {
    const q = new URLSearchParams({ dateCreatedGe: desde, offset: String(offset), limit: "100" });
    const data = await getAsaas<{ hasMore?: boolean; data?: AsaasCobranca[] }>(apiKey, `/payments?${q}`, fetchImpl);
    out.push(...(data.data ?? []));
    if (!data.hasMore) break;
  }
  return out;
}
