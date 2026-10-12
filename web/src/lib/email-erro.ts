// Tradução do erro de envio SMTP para uma frase que o dono do sistema entende.
// Mesmo arquivo em Prospecta/shared/email-erro.ts.
// Nunca inclui senha nem conteúdo do e-mail: só o tipo de falha e o código.

export function descreverErroSmtp(erro: unknown): string {
  const e = (erro ?? {}) as { code?: string; responseCode?: number; message?: string };
  const codigo = e.code ?? (e.responseCode ? String(e.responseCode) : "");
  const texto = `${e.message ?? ""}`.toLowerCase();
  let motivo: string;
  if (codigo === "EAUTH" || e.responseCode === 535 || texto.includes("authentication") || texto.includes("username and password"))
    motivo = "Usuário ou senha recusados pelo servidor de e-mail. No Gmail é obrigatório usar uma \"senha de app\" (não a senha normal).";
  else if (["ECONNECTION", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EDNS"].includes(codigo) || texto.includes("timeout"))
    motivo = "Não foi possível conectar ao servidor de e-mail. Confira o endereço (SMTP_HOST) e a porta (SMTP_PORT: 465 ou 587).";
  else if (codigo === "ESOCKET" || texto.includes("ssl") || texto.includes("tls") || texto.includes("wrong version"))
    motivo = "Falha de segurança na conexão. Use a porta 465 (SSL) ou 587 (STARTTLS) conforme o provedor.";
  else if (codigo === "EENVELOPE" || e.responseCode === 550 || e.responseCode === 553)
    motivo = "O servidor recusou o remetente ou o destinatário. O remetente precisa ser o mesmo e-mail do SMTP_USER.";
  else motivo = "Falha desconhecida no envio.";
  return codigo ? `${motivo} (código ${codigo})` : motivo;
}
