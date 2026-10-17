// Pedido de 17/10/2026: o colaborador faz tudo o que o admin faz, só nos módulos
// que o admin liberou. Mesmo conteúdo em Prospecta/server/colaborador-modulos.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: { user: { id: "u-7", role: "colaborador", permissoes: ["juridico"] as string[] } },
  delete: vi.fn(async () => ({ id: "contrato-1" })),
  revalidate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => mocks.sessao) }));
vi.mock("@/lib/db", () => ({ prisma: { contrato: { delete: mocks.delete } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { excluirContrato } from "@/lib/actions/contratos";
import { IDS_MODULOS_PAINEL, MODULOS_PAINEL } from "@/lib/auth/modulos-lista";
import { podeAcessarModulo, podeAdministrarSeguranca } from "@/lib/perfis-acesso";

beforeEach(() => vi.clearAllMocks());

describe("colaborador — mesmos poderes do admin nos módulos liberados", () => {
  it("são as 15 opções do painel, na ordem da Prospecta (sem o sorteio, exclusivo dela)", () => {
    expect(MODULOS_PAINEL.map((m) => m.label)).toEqual([
      "CRM / Pipeline", "Obras", "Tarefas e Agenda", "Corretores", "Regularizações", "Comissões", "Projetos",
      "Mapa operacional", "Avaliações", "Imóveis", "Incorporação", "WhatsApp", "BPO Financeiro", "Financiamentos", "Jurídico",
    ]);
  });

  it("exclui no módulo liberado; sem o módulo, é barrado antes do banco", async () => {
    mocks.sessao.user.permissoes = ["juridico"];
    await excluirContrato("contrato-1");
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "contrato-1" } });
    mocks.delete.mockClear();
    mocks.sessao.user.permissoes = IDS_MODULOS_PAINEL.filter((m) => m !== "juridico");
    await expect(excluirContrato("contrato-1")).rejects.toThrow(/permissão/);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("selecionou tudo menos Obras: Obras fica fechado; usuários e acessos seguem só do admin", () => {
    const u = { perfil: "colaborador", ativo: true, permissoes: IDS_MODULOS_PAINEL.filter((m) => m !== "obras") };
    expect(podeAcessarModulo(u, "obras")).toBe(false);
    expect(podeAcessarModulo(u, "leads")).toBe(true);
    expect(podeAdministrarSeguranca(u)).toBe(false);
    expect(podeAcessarModulo({ ...u, ativo: false }, "leads")).toBe(false);
  });
});

describe("revisão do Codex (Santa Fé #198): serviço antigo sem registro", () => {
  it("a sincronização não cria registro em módulo não liberado, mesmo para serviço já gravado no lead", async () => {
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const criarObra = vi.fn();
    const vazio = { findMany: vi.fn(async () => []) };
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: "L1" }]),
      lead: { findUniqueOrThrow: vi.fn(async () => ({ id: "L1", nome: "Ana", telefone: "1", email: null, servico: JSON.stringify(["Obra e reforma"]) })) },
      financiamento: vazio, projeto: vazio, regularizacao: vazio, avaliacao: vazio,
      obra: { findMany: vi.fn(async () => []), create: criarObra },
      servicoLead: { findFirst: vi.fn(async () => ({ id: "S1", obra: null })), create: vi.fn() },
    };
    mocks.sessao.user.permissoes = ["leads"];
    await expect(sincronizarServicosDoLead("L1", tx as never)).rejects.toThrow(/permissão/);
    expect(criarObra).not.toHaveBeenCalled();
  });
});
