import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const notifyAdminByEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { configuracao: { findUnique, upsert } },
}));
vi.mock("@/lib/email", () => ({ notifyAdminByEmail }));

describe("checkAndSendReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia o lembrete e salva a data quando nunca foi enviado antes", async () => {
    findUnique.mockResolvedValue(null);
    notifyAdminByEmail.mockResolvedValue(true);

    const { checkAndSendReminder } = await import("@/lib/mcmv-reminder");
    await checkAndSendReminder();

    expect(notifyAdminByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: expect.stringContaining("MCMV") })
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { chave: "mcmv_rules_reminder_last_sent_at" } })
    );
  });

  it("não envia novamente se o prazo de 30 dias ainda não venceu", async () => {
    const dezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    findUnique.mockResolvedValue({ valor: dezDiasAtras });

    const { checkAndSendReminder } = await import("@/lib/mcmv-reminder");
    await checkAndSendReminder();

    expect(notifyAdminByEmail).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("envia de novo quando já passaram mais de 30 dias do último envio", async () => {
    const trintaCincoDiasAtras = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    findUnique.mockResolvedValue({ valor: trintaCincoDiasAtras });
    notifyAdminByEmail.mockResolvedValue(true);

    const { checkAndSendReminder } = await import("@/lib/mcmv-reminder");
    await checkAndSendReminder();

    expect(notifyAdminByEmail).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("não salva a data se o envio do e-mail falhar, para tentar novamente depois", async () => {
    findUnique.mockResolvedValue(null);
    notifyAdminByEmail.mockResolvedValue(false);

    const { checkAndSendReminder } = await import("@/lib/mcmv-reminder");
    await checkAndSendReminder();

    expect(notifyAdminByEmail).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
