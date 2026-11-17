// Paridade 17/11, bloco 1 — EPIC-023 S-A (correção 3) da Prospecta: filtro por perfil em "Usuários e acesso" com
// "Todos" + exatamente os perfis do formulário; combina com a busca e com a situação.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/usuarios", () => ({}));
vi.mock("@/lib/actions/corretores", () => ({}));
vi.mock("@/app/admin/configuracoes/_components/perfil-engenheiro", () => ({ PerfilEngenheiro: () => null }));

import { UsuariosClient, type DadosCorretor } from "@/app/admin/configuracoes/_components/usuarios-client";
import { PERFIS_DO_FILTRO, perfilDaUrl, perfilDoUsuario } from "@/lib/usuarios/filtro";

const base = { ativo: true, creci: null, telefone: null, permissoes: "[]", leadId: null, leadNome: null, leadTelefone: null, engenheiro: false, corretor: null };
const corretor: DadosCorretor = { id: "c1", nome: "Carla Corretora", email: "carla@x", telefone: "1", creci: "77-F", ativo: true, observacoes: "", percentualComissao: "2.5" };
const usuarios = [
  { ...base, id: "u1", nome: "Ana Admin", email: "ana@x", papel: "admin" },
  { ...base, id: "u2", nome: "Eva Engenheira", email: "eva@x", papel: "colaborador", engenheiro: true },
  { ...base, id: "u3", nome: "Carla Corretora", email: "carla@x", papel: "corretor", creci: "77-F", corretor },
  { ...base, id: "u4", nome: "Ciro Colaborador", email: "ciro@x", papel: "colaborador" },
];
const semConta: DadosCorretor[] = [{ ...corretor, id: "c2", nome: "Davi Sem Conta", email: "davi@x", percentualComissao: null }];

const render = (perfilInicial?: Parameters<typeof UsuariosClient>[0]["perfilInicial"]) =>
  renderToStaticMarkup(React.createElement(UsuariosClient, { usuarios, leadsSemConta: [], corretoresSemConta: semConta, perfilInicial }));

describe("filtro por perfil (paridade EPIC-023 S-A)", () => {
  beforeEach(() => { Object.assign(globalThis, { React }); });

  it("as opções são Todos + exatamente os perfis do formulário, na mesma ordem", () => {
    const html = render();
    const abas = [...html.matchAll(/<button aria-pressed="(?:true|false)"[^>]*>([^<]+)<span/g)].map((x) => x[1]);
    const opcoesDoFormulario = PERFIS_DO_FILTRO.map((p) => ({ admin: "Admin", colaborador: "Colaborador", engenheiro: "Engenheiro", corretor: "Corretor", cliente: "Cliente", empreiteiro: "Empreiteiro" })[p]);
    expect(abas).toEqual(["Todos", ...opcoesDoFormulario]);
  });

  it("sem filtro mostra todos, inclusive o corretor sem conta de acesso", () => {
    const html = render();
    for (const nome of ["Ana Admin", "Eva Engenheira", "Carla Corretora", "Ciro Colaborador", "Davi Sem Conta"]) expect(html).toContain(nome);
    expect(html).toContain("5 de 5");
  });

  it("?perfil=corretor (antiga rota Corretores) abre só os corretores, com CRECI e comissão padrão", () => {
    const html = render(perfilDaUrl("corretor"));
    expect(html).toContain("Carla Corretora");
    expect(html).toContain("Davi Sem Conta");
    expect(html).toContain("Sem conta de acesso");
    expect(html).toContain("CRECI: 77-F · comissão 2,5%");
    expect(html).toContain("sem comissão padrão");
    for (const nome of ["Ana Admin", "Eva Engenheira", "Ciro Colaborador"]) expect(html).not.toContain(nome);
    expect(html).toContain("2 de 5");
  });

  it("engenheiro é filtrado à parte do colaborador", () => {
    const html = render("engenheiro");
    expect(html).toContain("Eva Engenheira");
    expect(html).not.toContain("Ciro Colaborador");
    expect(perfilDoUsuario({ papel: "colaborador", engenheiro: true })).toBe("engenheiro");
    expect(perfilDoUsuario({ papel: "colaborador", engenheiro: false })).toBe("colaborador");
  });

  it("perfil desconhecido na URL cai em Todos", () => {
    expect(perfilDaUrl("dono")).toBe("todos");
    expect(perfilDaUrl(undefined)).toBe("todos");
    expect(perfilDaUrl(["cliente", "admin"])).toBe("cliente");
  });
});
