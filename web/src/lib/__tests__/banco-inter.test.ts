import { describe, expect, it, vi } from "vitest";
import {
  fetchInterExtrato, fetchInterSaldo, interHabilitado, lerCredencialInter, movimentoDoInter, tokenInter, validarCredencialInter,
  type CredencialInter, type FetchInter,
} from "@/lib/bancos/inter";

// Lote 4: conector do Banco Inter (beta, desligado por padrão). Mesmo teste nos dois sistemas.
// Nenhuma chamada ao Inter: fetch simulado.
const CRED_TESTE: CredencialInter = {
  clientId: "cid", clientSecret: "csec",
  certificado: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
  chave: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
  contaCorrente: null,
};
const resp = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => corpo });

describe("Banco Inter — conector (beta)", () => {
  it("desligado por padrão; liga só com BANCO_INTER_API=1", () => {
    expect(interHabilitado({})).toBe(false);
    expect(interHabilitado({ BANCO_INTER_API: "0" })).toBe(false);
    expect(interHabilitado({ BANCO_INTER_API: "1" })).toBe(true);
  });

  it("valida a credencial com mensagens claras", () => {
    expect(() => validarCredencialInter({ ...CRED_TESTE, clientId: " " })).toThrow(/Client ID/);
    expect(() => validarCredencialInter({ ...CRED_TESTE, certificado: "abc" })).toThrow(/Certificado/);
    expect(() => validarCredencialInter({ ...CRED_TESTE, chave: "abc" })).toThrow(/Chave privada/);
    expect(validarCredencialInter({ ...CRED_TESTE, contaCorrente: "12.345-6" }).contaCorrente).toBe("123456");
    expect(lerCredencialInter(JSON.stringify(CRED_TESTE))).toEqual(CRED_TESTE);
    expect(() => lerCredencialInter("{")).toThrow(/corrompida/);
  });

  it("token: OAuth client_credentials com escopo de extrato; recusa traz o motivo real e a dica", async () => {
    const f = vi.fn((url: string, init?: { body?: string }) => {
      expect(url).toMatch(/\/oauth\/v2\/token$/);
      expect(init?.body).toContain("grant_type=client_credentials");
      expect(init?.body).toContain("scope=extrato.read");
      return resp({ access_token: "tok" });
    });
    expect(await tokenInter(CRED_TESTE, f as unknown as FetchInter)).toBe("tok");
    const recusa = (() => resp({ title: "Unauthorized", detail: "invalid_client" }, 401)) as unknown as FetchInter;
    await expect(tokenInter(CRED_TESTE, recusa)).rejects.toThrow(/O Inter recusou o acesso \(HTTP 401\): Unauthorized — invalid_client\. Confira o Client ID/);
    const escopo = (() => resp({ title: "Forbidden" }, 403)) as unknown as FetchInter;
    await expect(tokenInter(CRED_TESTE, escopo)).rejects.toThrow(/Consultar extrato e saldo/);
    const rede = (() => Promise.reject(new Error("ECONNRESET"))) as unknown as FetchInter;
    await expect(tokenInter(CRED_TESTE, rede)).rejects.toThrow(/Não consegui falar com o Inter: ECONNRESET/);
  });

  it("converte transações (crédito/débito, titular, chave estável) e ignora linhas inválidas", () => {
    expect(movimentoDoInter({ idTransacao: "77", dataTransacao: "2026-10-05", tipoOperacao: "C", tipoTransacao: "PIX", valor: "150.5", titulo: "Pix recebido", descricao: "Ana", detalhes: { nomePagador: "Ana Lima" } }))
      .toMatchObject({ externalId: "inter:77", data: "2026-10-05", valor: 150.5, tipo: "credito", descricao: "Pix recebido — Ana", titular: "Ana Lima", detalhe: "PIX" });
    expect(movimentoDoInter({ dataEntrada: "2026-10-06", tipoOperacao: "D", valor: 20, titulo: "Tarifa" }))
      .toMatchObject({ externalId: "inter:2026-10-06:debito:20.00:Tarifa:", tipo: "debito", valor: 20 });
    expect(movimentoDoInter({ dataTransacao: "ontem", valor: 1 })).toBeNull();
    expect(movimentoDoInter({ dataTransacao: "2026-10-06", valor: 0 })).toBeNull();
  });

  it("extrato: janelas de até 90 dias, todas as páginas, sem duplicar; saldo disponível", async () => {
    const chamadas: string[] = [];
    const f = vi.fn((url: string, init?: { headers?: Record<string, string> }) => {
      chamadas.push(url);
      expect(init?.headers?.Authorization).toBe("Bearer tok");
      if (url.includes("/saldo")) return resp({ disponivel: 1234.56 });
      const q = new URL(url).searchParams;
      const pagina = Number(q.get("pagina"));
      return resp({ totalPaginas: q.get("dataInicio") === "2026-01-01" ? 2 : 1, transacoes: [
        { idTransacao: `${q.get("dataInicio")}-${pagina}`, dataTransacao: q.get("dataInicio"), tipoOperacao: "C", valor: "10" },
        { idTransacao: "repetida", dataTransacao: q.get("dataInicio"), tipoOperacao: "D", valor: "1" },
      ] });
    });
    const movs = await fetchInterExtrato("tok", CRED_TESTE, "2026-01-01", "2026-05-15", f as unknown as FetchInter);
    const extratos = chamadas.filter((u) => u.includes("/extrato/completo"));
    expect(extratos.map((u) => [new URL(u).searchParams.get("dataInicio"), new URL(u).searchParams.get("dataFim"), new URL(u).searchParams.get("pagina")])).toEqual([
      ["2026-01-01", "2026-03-31", "0"], ["2026-01-01", "2026-03-31", "1"], ["2026-04-01", "2026-05-15", "0"],
    ]);
    expect(movs.map((m) => m.externalId)).toEqual(["inter:2026-01-01-0", "inter:repetida", "inter:2026-01-01-1", "inter:2026-04-01-0"]);
    expect(await fetchInterSaldo("tok", { ...CRED_TESTE, contaCorrente: "123" }, f as unknown as FetchInter)).toBe(1234.56);
    const ultima = f.mock.calls.at(-1)!;
    expect(ultima[1]?.headers?.["x-conta-corrente"]).toBe("123");
  });
});
