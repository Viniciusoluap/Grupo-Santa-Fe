import nodemailer from "nodemailer";

type EmailDependencies = {
  transport: Pick<ReturnType<typeof nodemailer.createTransport>, "sendMail">;
};

function defaultDependencies(): EmailDependencies | null {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;

  const port = Number(SMTP_PORT ?? 465);
  return {
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }),
  };
}

/** Envia e-mail via SMTP. Nunca lança — retorna false se SMTP não estiver configurado ou o envio falhar. */
export async function sendEmail(
  data: { to: string; subject: string; html: string },
  dependencies?: EmailDependencies
): Promise<boolean> {
  const deps = dependencies ?? defaultDependencies();
  if (!deps) return false;

  try {
    await deps.transport.sendMail({
      from: `"Grupo Santa Fé" <${process.env.SMTP_USER ?? "no-reply@gruposantafee.com.br"}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.html.replace(/<[^>]*>/g, ""),
    });
    return true;
  } catch {
    return false;
  }
}

/** Escapa HTML para evitar XSS ao interpolar texto de origem não confiável (formulários públicos) em e-mails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * E-mail de notificação interna: avisa o admin que uma mensagem/solicitação chegou
 * pelo site. Enviado para ADMIN_NOTIFICATION_EMAIL, nunca para o cliente.
 */
export const ADMIN_NOTIFICATION_EMAIL = "comercial@gruposantafee.com.br";

export function adminNotificationTemplate(data: {
  titulo: string;
  linhas: { label: string; valor: string }[];
}) {
  const linhasHtml = data.linhas
    .map(
      (l) =>
        `<p style="margin: 4px 0;"><strong>${escapeHtml(l.label)}:</strong> ${
          l.valor ? escapeHtml(l.valor) : "Não informado"
        }</p>`
    )
    .join("");
  return {
    subject: `📩 ${escapeHtml(data.titulo)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1A2332; color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1 style="margin:0; font-size: 20px;">${escapeHtml(data.titulo)}</h1></div>
          <div class="content">${linhasHtml}</div>
          <div class="footer"><p>© Grupo Santa Fé</p></div>
        </div>
      </body>
      </html>
    `,
  };
}

/** Envia a notificação acima para o e-mail do admin. Não lança se o envio falhar. */
export async function notifyAdminByEmail(data: {
  titulo: string;
  linhas: { label: string; valor: string }[];
}): Promise<boolean> {
  const template = adminNotificationTemplate(data);
  return sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: template.subject,
    html: template.html,
  });
}
