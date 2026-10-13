import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { obra: { findMany } } }));

import { getPortalObras } from "@/lib/data/portal-real";
import { podeVerFotosDaObra } from "@/lib/obras/fotos";

describe("portal do cliente: isolamento das obras e fotos", () => {
  beforeEach(() => findMany.mockReset());

  it("consulta apenas obras do lead autenticado e não inclui bytes nem finanças", async () => {
    findMany.mockResolvedValue([]);
    await getPortalObras("lead-da-sessao");
    expect(findMany).toHaveBeenCalledOnce();
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({ leadId: "lead-da-sessao" });
    expect(consulta.select.fotos.select).not.toHaveProperty("arquivo");
    expect(consulta.select).not.toHaveProperty("vgv");
    expect(consulta.select).not.toHaveProperty("movimentos");
  });

  it("recusa a foto de uma obra de outro lead, mesmo com id conhecido", () => {
    const cliente = { id: "usuario-a", papel: "cliente", leadId: "lead-a" };
    expect(podeVerFotosDaObra(cliente, { leadId: "lead-a" })).toBe(true);
    expect(podeVerFotosDaObra(cliente, { leadId: "lead-b" })).toBe(false);
    expect(podeVerFotosDaObra({ ...cliente, papel: "corretor" }, { leadId: "lead-a" })).toBe(false);
  });
});
