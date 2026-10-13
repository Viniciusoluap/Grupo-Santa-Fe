// Motivo real das falhas do Google Drive, em frase que o dono do sistema entende.
// Mesmo arquivo em Prospecta/shared/drive-erro.ts.
// Nunca inclui chave privada, token ou conteúdo do arquivo: só a etapa, o código
// HTTP e o "reason" que o Google devolve.

export type EtapaDrive = "autenticacao" | "pasta_raiz" | "pasta" | "upload" | "leitura" | "permissoes";

export class ErroDrive extends Error {
  constructor(
    readonly etapa: EtapaDrive,
    readonly status: number,
    readonly motivo: string | undefined,
    readonly detalhe: string | undefined,
  ) {
    super(`Google Drive falhou na etapa ${etapa} (${status}${motivo ? ` ${motivo}` : ""})`);
    this.name = "ErroDrive";
  }
}

/** Lê o corpo de erro do Google (`{ error: { errors: [{ reason }], message } }` ou OAuth `{ error, error_description }`). */
export function lerCorpoErroGoogle(corpo: unknown): { motivo?: string; detalhe?: string } {
  if (!corpo || typeof corpo !== "object") return {};
  const c = corpo as { error?: unknown; error_description?: unknown };
  if (typeof c.error === "string") {
    return { motivo: c.error, detalhe: typeof c.error_description === "string" ? c.error_description.slice(0, 300) : undefined };
  }
  const e = (c.error ?? {}) as { message?: unknown; status?: unknown; errors?: { reason?: unknown }[]; details?: { reason?: unknown }[] };
  const motivo = [e.errors?.[0]?.reason, e.details?.find((d) => typeof d?.reason === "string")?.reason, e.status]
    .find((v): v is string => typeof v === "string" && v.length > 0);
  return { motivo, detalhe: typeof e.message === "string" ? e.message.slice(0, 300) : undefined };
}

/** Converte qualquer erro do armazenamento em uma explicação com o que fazer. */
export function descreverErroDrive(erro: unknown): string {
  if (!(erro instanceof ErroDrive)) {
    const texto = erro instanceof Error ? erro.message : String(erro);
    if (/não configurado/i.test(texto)) return "Google Drive não configurado: faltam as variáveis da conta de serviço.";
    if (/public|público/i.test(texto)) return "A pasta do Google Drive está com acesso público. Remova o compartilhamento \"Qualquer pessoa com o link\".";
    if (/duplicada/i.test(texto)) return "Existem duas pastas com o mesmo nome no Google Drive. Apague ou renomeie a duplicada.";
    if (/PEM|private key|DECODER|asn1/i.test(texto)) return "A chave privada da conta de serviço está em formato inválido (copie o campo private_key inteiro do JSON).";
    return "Falha inesperada ao acessar o Google Drive.";
  }
  const { etapa, status, motivo } = erro;
  const m = motivo ?? "";
  let frase: string;
  if (etapa === "autenticacao") {
    frase = m === "invalid_grant"
      ? "O Google recusou a conta de serviço: a chave foi revogada/excluída ou o e-mail da conta não corresponde à chave."
      : "O Google recusou a autenticação da conta de serviço. Confira o e-mail da conta e a chave privada.";
  } else if (m === "storageQuotaExceeded") {
    frase = "Contas de serviço não têm espaço próprio no \"Meu Drive\" de uma conta pessoal. Use uma pasta dentro de um Drive compartilhado (Google Workspace) com a conta de serviço como \"Gerente de conteúdo\". Enquanto isso, os arquivos ficam guardados com segurança no banco do sistema.";
  } else if (m === "accessNotConfigured" || m === "SERVICE_DISABLED" || /has not been used|is disabled/i.test(erro.detalhe ?? "")) {
    frase = "A Google Drive API não está ativada no projeto da conta de serviço. Ative em console.cloud.google.com → APIs e serviços → Google Drive API.";
  } else if (m === "insufficientFilePermissions" || m === "forbidden" || m === "appNotAuthorizedToFile") {
    frase = "A conta de serviço não tem permissão de edição na pasta. Compartilhe a pasta com o e-mail da conta de serviço como \"Editor\".";
  } else if (status === 404 || m === "notFound") {
    frase = etapa === "pasta_raiz"
      ? "A pasta raiz não foi encontrada ou não está compartilhada com a conta de serviço. Confira o ID da pasta e o compartilhamento."
      : "Arquivo ou pasta não encontrado no Google Drive (pode ter sido apagado ou movido).";
  } else if (m === "rateLimitExceeded" || m === "userRateLimitExceeded" || status === 429) {
    frase = "O Google Drive limitou temporariamente as requisições. Tente novamente em alguns minutos.";
  } else if (status >= 500) {
    frase = "O Google Drive está instável no momento. Tente novamente em alguns minutos.";
  } else {
    frase = "O Google Drive recusou a operação.";
  }
  return `${frase} (etapa: ${etapa}; código ${status}${m ? `; motivo ${m}` : ""})`;
}
