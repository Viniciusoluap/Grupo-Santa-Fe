import { beforeEach, describe, expect, it, vi } from "vitest";

// Achado 2 (Codex, PR #156): criarLead/editarLead redirecionavam como sucesso
// mesmo quando a criação do registro operacional falhava. Agora o usuário cai
// no detalhe do lead com o aviso dos serviços que ficaram sem registro.

class Redirect extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

const sincronizar = vi.fn();
const leadCreate = vi.fn();
const leadUpdate = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/lib/notificacoes", () => ({ notificarAdmins: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { create: leadCreate, update: leadUpdate } } }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  sincronizarServicosDoLead: (...a: unknown[]) => sincronizar(...a),
  propagarDadosClienteDoLead: vi.fn(async () => {}),
  resolverResponsavelId: vi.fn(async (id: string | null) => id || null),
}));

function form(campos: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
}

async function urlDoRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  throw new Error("esperava redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  leadCreate.mockResolvedValue({ id: "L1" });
  leadUpdate.mockResolvedValue({ id: "L1", nome: "Maria", telefone: "1", email: null });
});

describe("criarLead", () => {
  it("com falha na sincronização, abre o lead com o aviso em vez de fingir sucesso", async () => {
    sincronizar.mockResolvedValue({ criados: 0, falhas: ["avaliacao"] });
    const { criarLead } = await import("@/lib/actions/leads");
    const url = await urlDoRedirect(criarLead(form({ nome: "Maria", telefone: "1", servicos: ["Avaliação de imóvel"] })));
    expect(url).toBe("/admin/leads/L1?falhaServicos=avaliacao");
  });

  it("sem falha, mantém o fluxo normal (lista de leads)", async () => {
    sincronizar.mockResolvedValue({ criados: 1, falhas: [] });
    const { criarLead } = await import("@/lib/actions/leads");
    const url = await urlDoRedirect(criarLead(form({ nome: "Maria", telefone: "1", servicos: ["Avaliação de imóvel"] })));
    expect(url).toBe("/admin/leads");
  });
});

describe("editarLead", () => {
  it("com falha, o redirecionamento leva os módulos que falharam", async () => {
    sincronizar.mockResolvedValue({ criados: 0, falhas: ["avaliacao", "financiamento"] });
    const { editarLead } = await import("@/lib/actions/leads");
    const url = await urlDoRedirect(editarLead(form({ id: "L1", nome: "Maria", telefone: "1" })));
    expect(url).toBe("/admin/leads/L1?falhaServicos=avaliacao%2Cfinanciamento");
  });

  it("sem falha, volta ao detalhe sem aviso", async () => {
    sincronizar.mockResolvedValue({ criados: 0, falhas: [] });
    const { editarLead } = await import("@/lib/actions/leads");
    const url = await urlDoRedirect(editarLead(form({ id: "L1", nome: "Maria", telefone: "1" })));
    expect(url).toBe("/admin/leads/L1");
  });
});
