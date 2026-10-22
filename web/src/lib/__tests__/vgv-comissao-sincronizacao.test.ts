import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { sincronizarVgvDoLead } from "@/lib/financeiro/vgv-lead";

describe("base da comissão da obra", () => {
  it("VGV da obra e comissão acompanham o VGV simulado do lead, não o valor aprovado (correção 22/10)", async () => {
    const update = vi.fn();
    const tx = {
      lead: { findUnique: vi.fn().mockResolvedValue({ valorAprovado: "200000.00", orcamento: "250000.00", corretor: { id: "c1", nome: "Corretor", regraComissao: { percentual: "5" } } }) },
      obra: { findMany: vi.fn().mockResolvedValue([{ id: "o1", comissaoPercentual: null }]), update },
    };
    await sincronizarVgvDoLead("l1", tx as never);
    expect(update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { vgv: "250000.00", comissaoValor: "12500.00" } });
  });
});
