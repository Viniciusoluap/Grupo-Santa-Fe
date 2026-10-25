import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAD_TEMPERATURAS,
  leadTemperaturaRotulo,
  temperaturaDoFormulario,
} from "@/lib/crm/temperatura-lead";
import {
  OBRA_STATUS_CONFIG,
  OBRA_STATUS_SELECIONAVEIS,
  obraStatusLabel,
  tipoProjetoObra,
  validarMudancaStatusObra,
} from "@/lib/types/obra";

const mocks = vi.hoisted(() => ({
  obraAtual: { leadId: "L1" as string | null, status: "orcamento" },
  update: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin1", role: "admin" } }) }));
vi.mock("@/lib/auth/rbac", () => ({ requireActionRole: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  bloquearLead: vi.fn(),
  clienteParaRegistro: async () => ({ clienteNome: "Maria (CRM)", clienteTel: "11999990000", clienteEmail: null }),
  transacaoCRM: async (cb: (tx: unknown) => Promise<unknown>) => cb({
    $queryRaw: vi.fn(),
    obra: { findUnique: async () => mocks.obraAtual, update: mocks.update },
  }),
}));

function formObra(extra: Record<string, string> = {}) {
  const form = new FormData();
  const base = { id: "O1", nome: "Obra Maria", status: "planejamento", endereco: "Rua A", area: "60", valorTotal: "150000", engenheiroResp: "Eng. João", ...extra };
  for (const [k, v] of Object.entries(base)) form.set(k, v);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obraAtual = { leadId: "L1", status: "orcamento" };
});

describe("item 05 — temperatura do lead (mesmas opções da Prospecta)", () => {
  it("acrescenta Negócio fechado preservando Frio/Morno/Quente", () => {
    expect(LEAD_TEMPERATURAS).toEqual(["frio", "morno", "quente", "fechado"]);
    expect(leadTemperaturaRotulo("fechado")).toBe("Negócio fechado");
    expect(leadTemperaturaRotulo(undefined)).toBe("❄️ Frio");
  });

  it("valida a temperatura enviada pelo formulário", () => {
    expect(temperaturaDoFormulario(null)).toBe("frio");
    expect(temperaturaDoFormulario("", "quente")).toBe("quente");
    expect(temperaturaDoFormulario("fechado")).toBe("fechado");
    expect(() => temperaturaDoFormulario("fervendo")).toThrow("Temperatura do lead inválida.");
  });
});

describe("itens 06 e 07 — classificações de Obra", () => {
  it("pedido A1: o seletor oferece as situações do filtro, na mesma ordem, com a marca do Grupo Santa Fé", () => {
    expect(OBRA_STATUS_SELECIONAVEIS.map(obraStatusLabel)).toEqual([
      "Planejamento", "Aprovação", "Contrato Grupo Santa Fé", "Laudo CEF", "Conformidade CEF",
      "Orçamento", "Contratada", "Em Andamento", "Pausada", "Concluída", "Cancelada",
    ]);
    expect(OBRA_STATUS_SELECIONAVEIS.map(obraStatusLabel).join(" ")).not.toContain("Prospecta");
  });

  it("estados do pipeline do CRM e classificações antigas continuam reconhecidos (sem perda de histórico)", () => {
    for (const s of ["aguardando_configuracao", "orcamento", "em_andamento", "pausada", "concluida", "cancelada"]) {
      expect(OBRA_STATUS_CONFIG).toHaveProperty(s);
    }
  });

  it("todas as situações do filtro podem ser escolhidas; o estado de sistema da fila do CRM não", () => {
    expect(validarMudancaStatusObra("pausada", "pausada")).toBeNull();
    expect(validarMudancaStatusObra("aguardando_configuracao", "aprovacao")).toBeNull();
    expect(validarMudancaStatusObra("planejamento", "cancelada")).toBeNull();
    expect(validarMudancaStatusObra("aguardando_configuracao", "aguardando_configuracao")).toBeNull();
    expect(validarMudancaStatusObra("planejamento", "aguardando_configuracao")).toMatch(/não está disponível/);
  });

  it("editarObra salva obra antiga sem trocar a classificação e grava nova classificação válida", async () => {
    const { editarObra } = await import("@/lib/actions/obras");
    await expect(editarObra(formObra({ status: "orcamento" }))).rejects.toThrow("REDIRECT");
    await expect(editarObra(formObra({ status: "laudo_cef" }))).rejects.toThrow("REDIRECT");
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.calls[1][0].data.status).toBe("laudo_cef");
  });

  it("editarObra recusa o estado de sistema da fila do CRM com mensagem compreensível", async () => {
    const { editarObra } = await import("@/lib/actions/obras");
    await expect(editarObra(formObra({ status: "aguardando_configuracao" }))).rejects.toThrow(/Pendente de configuração.*não está disponível/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("itens 08, 09 e 24 — dados da Obra vindos do CRM", () => {
  it("tipo de projeto vem do serviço do CRM; sem serviço, preserva o valor antigo", () => {
    expect(tipoProjetoObra({ tipo: "obra_nova", servicoLead: { servico: "Obra e reforma" } })).toEqual({ label: "Obra e reforma", icon: "🔨", origem: "crm" });
    expect(tipoProjetoObra({ tipo: "reforma", servicoLead: null })).toMatchObject({ label: "Reforma", origem: "legado" });
    expect(tipoProjetoObra({ tipo: null, servicoLead: null }).origem).toBeNull();
  });

  it("editarObra não grava tipo enviado pelo formulário e usa o nome do cliente do lead", async () => {
    const { editarObra } = await import("@/lib/actions/obras");
    await expect(editarObra(formObra({ tipo: "estrutural", clienteNome: "Nome digitado" }))).rejects.toThrow("REDIRECT");
    const data = mocks.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("tipo");
    expect(data.clienteNome).toBe("Maria (CRM)");
  });
});
