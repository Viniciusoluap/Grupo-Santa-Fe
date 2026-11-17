// Regra do endereço da Avaliação (dono, 17/11/2026): vem do lead ao criar/vincular, é editável na avaliação e a edição
// manual nunca é sobrescrita; mudar o lead atualiza só o que ainda segue o lead. Gêmeo de
// Prospecta/server/avaliacao-endereco.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENDERECO_A_DEFINIR, enderecoAoVincular, enderecoDaAvaliacaoAposLead } from "@/lib/crm/servicos-lead";

const L = (endereco: string | null, bairro: string | null, cidade: string | null, uf: string | null) => ({ endereco, bairro, cidade, uf });

describe("regra pura: mudança no endereço do lead", () => {
  const antes = L("Rua A, 1", "Centro", "Canaã dos Carajás", "PA");
  const depois = L("Rua B, 2", "Jardim", "Parauapebas", "PA");
  it("avaliação igual ao endereço antigo do lead acompanha a mudança", () => {
    expect(enderecoDaAvaliacaoAposLead({ endereco: "Rua A, 1", bairro: "Centro", cidade: "Canaã dos Carajás", estado: "PA" }, antes, depois))
      .toEqual({ endereco: "Rua B, 2", bairro: "Jardim", cidade: "Parauapebas" });
  });
  it("vazio ou 'A definir' é preenchido; cidade/UF seguem quando o endereço está pendente", () => {
    expect(enderecoDaAvaliacaoAposLead({ endereco: ENDERECO_A_DEFINIR, bairro: "", cidade: "Canaã dos Carajás", estado: "PA" }, L(null, null, null, null), depois))
      .toEqual({ endereco: "Rua B, 2", bairro: "Jardim", cidade: "Parauapebas" });
  });
  it("edição manual é preservada campo a campo; espaços e maiúsculas não contam; lead que apaga não apaga", () => {
    expect(enderecoDaAvaliacaoAposLead({ endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Canaã dos Carajás", estado: "PA" }, antes, depois))
      .toEqual({ cidade: "Parauapebas" });
    expect(enderecoDaAvaliacaoAposLead({ endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Curionópolis", estado: "PA" }, antes, depois)).toEqual({});
    expect(enderecoDaAvaliacaoAposLead({ endereco: " rua a,  1 ", bairro: "CENTRO", cidade: "Canaã dos Carajás", estado: "pa" }, antes, depois))
      .toEqual({ endereco: "Rua B, 2", bairro: "Jardim", cidade: "Parauapebas" });
    expect(enderecoDaAvaliacaoAposLead({ endereco: "Rua A, 1", bairro: "Centro", cidade: "Canaã dos Carajás", estado: "PA" }, antes, L(null, "", "Canaã dos Carajás", "PA"))).toEqual({});
  });
  it("ao vincular: só os campos que o lead tem preenchidos", () => {
    expect(enderecoAoVincular(L("Rua A, 1", "", "Canaã dos Carajás", "pa"))).toEqual({ endereco: "Rua A, 1", cidade: "Canaã dos Carajás", estado: "PA" });
  });
});

// editarAvaliacao: a edição feita na avaliação é salva; ao vincular/trocar o lead, o endereço vem do lead.
const estado = vi.hoisted(() => ({ atual: { leadId: "L1" as string | null }, lead: { endereco: "Rua do Lead, 9", bairro: "Bairro do Lead", cidade: "Parauapebas", uf: "PA" }, gravado: null as null | Record<string, unknown> }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "admin" } }) }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  clienteParaRegistro: async () => ({ clienteNome: "Ana", clienteTel: "1", clienteEmail: null }),
  cpfParaRegistro: async () => null,
}));
vi.mock("@/lib/db", () => ({ prisma: {
  avaliacao: { findUnique: async () => estado.atual, update: async ({ data }: { data: Record<string, unknown> }) => { estado.gravado = data; return {}; } },
  lead: { findUnique: async () => estado.lead },
} }));

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}
const base = { id: "a1", tipo: "mercado", finalidade: "compra_venda", avaliador: "Eng", endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Canaã dos Carajás" };

describe("editarAvaliacao", () => {
  beforeEach(() => { estado.gravado = null; });
  it("avaliação já vinculada: o endereço digitado é salvo e o do lead NÃO o sobrescreve; UF ausente no formulário é mantida", async () => {
    estado.atual = { leadId: "L1" };
    const { editarAvaliacao } = await import("@/lib/actions/avaliacoes");
    await editarAvaliacao(form({ ...base, leadId: "L1" }));
    expect(estado.gravado).toMatchObject({ endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Canaã dos Carajás", leadId: "L1" });
    expect(estado.gravado!.estado).toBeUndefined();
  });
  it("vincular agora (ou trocar o lead): o endereço vem do lead", async () => {
    estado.atual = { leadId: null };
    const { editarAvaliacao } = await import("@/lib/actions/avaliacoes");
    await editarAvaliacao(form({ ...base, leadId: "L2" }));
    expect(estado.gravado).toMatchObject({ endereco: "Rua do Lead, 9", bairro: "Bairro do Lead", cidade: "Parauapebas", estado: "PA", leadId: "L2" });
  });
});
