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

it("preserva PDF e XLS anexados no transporte SMTP", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "local" });
    const deps = { transport: { sendMail } };
    const attachments = [{ filename: "PLS.pdf", content: Buffer.from("%PDF-test"), contentType: "application/pdf" }, { filename: "PLS.xls", content: Buffer.from([0xd0,0xcf,0x11,0xe0]), contentType: "application/vnd.ms-excel" }];
    await expect(sendEmail({ to: "empresa@example.test", subject: "Medição", html: "<p>Solicitação</p>",  attachments }, deps)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ attachments }));
});

describe("sendEmail — falha temporária do provedor", () => {
  const dados = { to: "x@example.test", subject: "Aviso", html: "<p>Aviso</p>" };

  it("repete uma vez quando o provedor recusa a mensagem (EMESSAGE)", async () => {
    const sendMail = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("rejected"), { code: "EMESSAGE", responseCode: 550 }))
      .mockResolvedValueOnce({ messageId: "retry-ok" });
    const esperar = vi.fn().mockResolvedValue(undefined);
    await expect(sendEmail(dados, { transport: { sendMail }, esperar })).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(esperar).toHaveBeenCalledTimes(1);
  });

  it("não repete falha de autenticação", async () => {
    const sendMail = vi.fn().mockRejectedValue(Object.assign(new Error("auth"), { code: "EAUTH", responseCode: 535 }));
    const esperar = vi.fn().mockResolvedValue(undefined);
    await expect(sendEmail(dados, { transport: { sendMail }, esperar })).resolves.toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(esperar).not.toHaveBeenCalled();
  });
});
