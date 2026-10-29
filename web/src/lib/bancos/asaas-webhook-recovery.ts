/** Diagnóstico/recuperação limitados ao webhook deste sistema. Nunca devolve segredos. */
export type WebhookRecoveryConfig = {
  apiKey: string; token: string; environment: "production" | "sandbox";
  canonicalUrl: string; legacyHosts: readonly string[]; legacyName?: string;
};
export class WebhookRecoveryError extends Error {}

type RemoteWebhook = { id: string; name?: string; url: string; enabled?: boolean; interrupted?: boolean; authToken?: string };
export type WebhookDiagnostic = {
  encontrado: boolean; urlCorreta: boolean; tokenConfere: boolean | null;
  ativo: boolean; interrompido: boolean; ambiente: "production" | "sandbox";
  recuperado: boolean; mensagem: string;
};

export async function verificarWebhookAsaas(config: WebhookRecoveryConfig, recuperar = false, fetchImpl: typeof fetch = fetch): Promise<WebhookDiagnostic> {
  const canonical = new URL(config.canonicalUrl);
  if (canonical.protocol !== "https:" || canonical.username || canonical.password || canonical.search || canonical.hash) throw new WebhookRecoveryError("URL canônica do webhook inválida.");
  const base = config.environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  async function api(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init, redirect: "error", signal: AbortSignal.timeout(8000),
        headers: { "content-type": "application/json", access_token: config.apiKey },
      });
    } catch { throw new WebhookRecoveryError("Não foi possível consultar o Asaas agora. Nenhuma recuperação foi confirmada."); }
    if (!response.ok) throw new WebhookRecoveryError(`Asaas respondeu HTTP ${response.status}. Confira a permissão da chave para Webhooks.`);
    try { return await response.json(); } catch { throw new WebhookRecoveryError("Resposta inválida do Asaas."); }
  }
  const matches: RemoteWebhook[] = [];
  for (let offset = 0; ; offset += 100) {
    if (offset >= 1000) throw new WebhookRecoveryError("Há muitos webhooks para conferir com segurança.");
    const page = await api(`/webhooks?limit=100&offset=${offset}`) as { data?: RemoteWebhook[]; hasMore?: boolean };
    if (!Array.isArray(page.data)) throw new WebhookRecoveryError("Lista de webhooks inválida.");
    for (const hook of page.data) {
      if (typeof hook.id !== "string" || typeof hook.url !== "string") continue;
      let url: URL;
      try { url = new URL(hook.url); } catch { continue; }
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== canonical.pathname) continue;
      const exact = url.href === canonical.href;
      const legacy = config.legacyName && hook.name === config.legacyName && config.legacyHosts.includes(url.hostname) && !url.port;
      if (exact || legacy) matches.push(hook);
    }
    if (!page.hasMore) break;
    if (!page.data.length) throw new WebhookRecoveryError("Paginação de webhooks inválida.");
  }
  if (matches.length > 1) throw new WebhookRecoveryError("Mais de um webhook corresponde a este sistema. Revise a configuração antes de recuperar.");
  const hook = matches[0];
  const diagnostic: WebhookDiagnostic = {
    encontrado: Boolean(hook), urlCorreta: hook?.url === canonical.href,
    tokenConfere: typeof hook?.authToken === "string" ? hook.authToken === config.token : null,
    ativo: hook?.enabled === true, interrompido: hook?.interrupted === true,
    ambiente: config.environment, recuperado: false,
    mensagem: hook ? "Configuração consultada no Asaas. O recebimento de eventos deve ser acompanhado após a recuperação." : "Nenhum webhook deste sistema encontrado. Nenhuma configuração foi criada ou alterada.",
  };
  if (!recuperar || !hook) return diagnostic;
  if (!/^\S{32,255}$/.test(config.token)) throw new WebhookRecoveryError("O token salvo precisa ter de 32 a 255 caracteres sem espaços. Nenhuma alteração realizada.");
  // Confere o endpoint final e o token antes de reativar. Não segue redirects nem
  // chama o endpoint antigo, evitando transmitir credenciais a outro destino.
  let probe: Response;
  try {
    probe = await fetchImpl(canonical.href, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", "asaas-access-token": config.token },
      body: JSON.stringify({ event: "INTEGRATION_HEALTH_CHECK" }),
    });
  } catch { throw new WebhookRecoveryError("O endpoint não respondeu à verificação. A fila não foi reativada."); }
  if (probe.status !== 200) throw new WebhookRecoveryError(`O endpoint respondeu HTTP ${probe.status}. A fila não foi reativada.`);
  let checked: unknown;
  try { checked = await probe.json(); } catch { throw new WebhookRecoveryError("O endpoint não confirmou o webhook. A fila não foi reativada."); }
  if (!checked || typeof checked !== "object" || !("received" in checked) || checked.received !== true) throw new WebhookRecoveryError("O endpoint não confirmou o webhook. A fila não foi reativada.");
  const result = await api(`/webhooks/${encodeURIComponent(hook.id)}`, {
    method: "PUT", body: JSON.stringify({ url: canonical.href, authToken: config.token, enabled: true, interrupted: false }),
  }) as RemoteWebhook;
  if (result.url !== canonical.href || result.enabled !== true || result.interrupted !== false
    || (typeof result.authToken === "string" && result.authToken !== config.token)) throw new WebhookRecoveryError("O Asaas não confirmou todos os campos da recuperação. Verifique novamente antes de tentar outra ação.");
  return { ...diagnostic, urlCorreta: true, tokenConfere: true, ativo: true, interrompido: false, recuperado: true,
    mensagem: "Fila reativada no Asaas com URL e token conferidos. Acompanhe o recebimento dos eventos pendentes; a entrega ainda precisa ser confirmada." };
}
