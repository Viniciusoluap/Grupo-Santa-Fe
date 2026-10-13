import { vi } from "vitest";

// Os testes de actions simulam a sessão com vi.mock("@/auth"). Aqui as guardas de
// módulo (item 06) leem o perfil dessa sessão simulada, com todos os módulos
// liberados, em vez de consultar o banco. A regra em si é testada em
// perfis-acesso.test.ts e modulos.test.ts.
vi.mock("@/lib/auth/modulos", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/modulos")>();
  const daSessao = async () => {
    const { auth } = await import("@/auth");
    const sessao = (await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string; corretorId?: string; permissoes?: string[]; ativo?: boolean } } | null>)());
    const user = sessao?.user;
    if (!user?.role) return null;
    return {
      id: user.id ?? "usuario-teste", nome: "Teste", perfil: user.role, ativo: user.ativo ?? true,
      permissoes: user.permissoes ?? [...real.IDS_MODULOS_PAINEL], corretorId: user.corretorId ?? null,
    };
  };
  return { ...real, usuarioAtual: daSessao, ...real.criarGuardas(daSessao) };
});
