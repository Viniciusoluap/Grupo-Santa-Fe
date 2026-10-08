import { describe, expect, it, vi } from "vitest";
import { adminNotificationTemplate, sendEmail } from "@/lib/email";

describe("sendEmail", () => {
  it("retorna false sem lançar quando as dependências não são fornecidas e SMTP não está configurado", async () => {
    const original = { ...process.env };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    await expect(
      sendEmail({ to: "x@example.test", subject: "Teste", html: "<p>Teste</p>" })
    ).resolves.toBe(false);

    process.env = original;
  });

  it("envia usando dependências injetadas", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "local-message" });
    const ok = await sendEmail(
      { to: "x@example.test", subject: "Teste", html: "<p>Teste</p>" },
      { transport: { sendMail } }
    );
    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "x@example.test", subject: "Teste" })
    );
  });

  it("retorna false quando o transporte falha, sem lançar", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("smtp unavailable"));
    await expect(
      sendEmail(
        { to: "x@example.test", subject: "Teste", html: "<p>Teste</p>" },
        { transport: { sendMail } }
      )
    ).resolves.toBe(false);
  });
});

describe("adminNotificationTemplate", () => {
  it("escapa HTML vindo de valores de formulários públicos (evita XSS armazenado)", () => {
    const template = adminNotificationTemplate({
      titulo: "Nova mensagem recebida pelo site (Contato)",
      linhas: [
        { label: "Nome", valor: "<img src=x onerror=alert(1)>" },
        { label: "Mensagem", valor: "Olá & bem-vindo <script>alert('xss')</script>" },
      ],
    });

    expect(template.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(template.html).not.toContain("<script>alert('xss')</script>");
    expect(template.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(template.html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    expect(template.html).toContain("Olá &amp; bem-vindo");
  });

  it("mostra 'Não informado' quando o valor vem vazio", () => {
    const template = adminNotificationTemplate({
      titulo: "Teste",
      linhas: [{ label: "Telefone", valor: "" }],
    });
    expect(template.html).toContain("Não informado");
  });
});
