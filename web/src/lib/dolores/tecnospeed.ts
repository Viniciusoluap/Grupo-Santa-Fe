export interface TecnoSpeedStatementQuery {
  startDate: string;
  endDate: string;
  bank?: string;
  type?: string;
  accountHash?: string;
  page?: number;
  pageSize?: number;
}

export interface TecnoSpeedReadOnlyConfig {
  baseUrl: string;
  cnpjsh: string;
  tokensh: string;
  payerCpfCnpj?: string;
}

function getConfig(): TecnoSpeedReadOnlyConfig {
  const baseUrl = process.env.TECNOSPEED_PLUGBANK_BASE_URL;
  const cnpjsh = process.env.TECNOSPEED_PLUGBANK_CNPJSH;
  const tokensh = process.env.TECNOSPEED_PLUGBANK_TOKENSH;

  if (!baseUrl || !cnpjsh || !tokensh) {
    throw new Error("TecnoSpeed PlugBank não configurado no Grupo Santa Fé");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    cnpjsh,
    tokensh,
    payerCpfCnpj: process.env.TECNOSPEED_PLUGBANK_PAYER_CPFCNPJ,
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  let parsed: unknown = body;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    // Mantém respostas não JSON para o chamador registrar como evidência.
  }
  if (!response.ok) throw new Error(`TecnoSpeed PlugBank HTTP ${response.status}`);
  return parsed;
}

/**
 * Cliente de extratos do Grupo Santa Fé.
 * Não implementa pagamentos, Pix, boletos ou DDA e não toca no BPO.
 */
export async function listTecnoSpeedStatements(query: TecnoSpeedStatementQuery): Promise<unknown> {
  const config = getConfig();
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    ...(query.bank ? { bank: query.bank } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.accountHash ? { accountHash: query.accountHash } : {}),
    ...(query.page ? { page: String(query.page) } : {}),
    ...(query.pageSize ? { pageSize: String(query.pageSize) } : {}),
  });

  const response = await fetch(`${config.baseUrl}/api/v1/statement?${params.toString()}`, {
    headers: {
      accept: "application/json",
      cnpjsh: config.cnpjsh,
      tokensh: config.tokensh,
      ...(config.payerCpfCnpj ? { payercpfcnpj: config.payerCpfCnpj } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  return parseResponse(response);
}

export function getTecnoSpeedStatus() {
  return {
    provider: "tecnospeed_plugbank",
    configured: Boolean(
      process.env.TECNOSPEED_PLUGBANK_BASE_URL &&
        process.env.TECNOSPEED_PLUGBANK_CNPJSH &&
        process.env.TECNOSPEED_PLUGBANK_TOKENSH,
    ),
    mode: "read_only" as const,
    paymentEndpointsEnabled: false,
    exclusiveBpoTouched: false,
  };
}
