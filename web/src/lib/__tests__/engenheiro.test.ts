import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import {
  acessoDocumentosUsuario,
  contentDisposition,
  creaAoTrocarEngenheiro,
  formatarCrea,
  lerCreasAdicionais,
  montarZipDocumentos,
  nomeZipDocumentos,
  normalizarNumeroCrea,
  validarArquivoDocumento,
  validarPerfilEngenheiro,
} from "@/lib/engenheiro";

describe("correção 04 — validação do perfil Engenheiro", () => {
  it("normaliza CEP, UF e CREA e deixa vazio como null (nada inventado)", () => {
    const r = validarPerfilEngenheiro({ cep: "74000000", uf: "go", crea: " 12345/d ", creaUf: "go", telefone: "(62) 99999-0000" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados).toMatchObject({ cep: "74000-000", uf: "GO", crea: "12345/D", creaUf: "GO", telefone: "(62) 99999-0000", logradouro: null, creasAdicionais: [] });
    const vazio = validarPerfilEngenheiro({});
    expect(vazio.ok && vazio.dados.crea).toBe(null);
  });

  it("rejeita CREA/UF inválidos ou incompletos", () => {
    expect(validarPerfilEngenheiro({ crea: "12", creaUf: "GO" })).toEqual({ ok: false, erro: "Número do CREA inválido." });
    expect(validarPerfilEngenheiro({ crea: "123456", creaUf: "XX" })).toEqual({ ok: false, erro: "UF do CREA inválida." });
    expect(validarPerfilEngenheiro({ crea: "123456" })).toEqual({ ok: false, erro: "Informe a UF do CREA." });
    expect(validarPerfilEngenheiro({ creaUf: "GO" })).toEqual({ ok: false, erro: "Informe o número do CREA." });
    expect(validarPerfilEngenheiro({ cep: "123" }).ok).toBe(false);
    expect(validarPerfilEngenheiro({ uf: "ZZ" }).ok).toBe(false);
    expect(normalizarNumeroCrea("abc<script>")).toBe(null);
  });

  it("CREAs adicionais: outro estado, sem repetir UF, ignorando linhas em branco", () => {
    const ok = validarPerfilEngenheiro({ crea: "123456", creaUf: "GO", creasAdicionais: [{ numero: "777777", uf: "df" }, { numero: "", uf: "" }] });
    expect(ok.ok && ok.dados.creasAdicionais).toEqual([{ numero: "777777", uf: "DF" }]);
    expect(validarPerfilEngenheiro({ crea: "123456", creaUf: "GO", creasAdicionais: [{ numero: "777777", uf: "GO" }] }).ok).toBe(false);
    expect(validarPerfilEngenheiro({ crea: "123456", creaUf: "GO", creasAdicionais: [{ numero: "777777", uf: "DF" }, { numero: "888888", uf: "DF" }] }).ok).toBe(false);
    expect(validarPerfilEngenheiro({ creasAdicionais: [{ numero: "777777", uf: "DF" }] }).ok).toBe(false);
    expect(lerCreasAdicionais('[{"numero":"777777","uf":"DF"},{"numero":"x","uf":"DF"},{"uf":"SP"}]')).toEqual([{ numero: "777777", uf: "DF" }]);
    expect(lerCreasAdicionais("lixo")).toEqual([]);
  });

  it("CREA ao trocar o engenheiro em Projetos: preenche do perfil e não inventa", () => {
    const a = { crea: "123456", creaUf: "GO" };
    const semCrea = { crea: null, creaUf: null };
    expect(formatarCrea("123456", "GO")).toBe("CREA-GO 123456");
    expect(creaAoTrocarEngenheiro("", null, a)).toBe("CREA-GO 123456");
    expect(creaAoTrocarEngenheiro("CREA-GO 123456", a, semCrea)).toBe("");
    expect(creaAoTrocarEngenheiro("CAU A1234", a, semCrea)).toBe("CAU A1234");
    expect(creaAoTrocarEngenheiro("CAU A1234", null, undefined)).toBe("CAU A1234");
  });
});

describe("correção 04 — documentos do usuário", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  it("valida extensão x conteúdo e limite de 15 MB", () => {
    expect(validarArquivoDocumento("CNH.pdf", pdf)).toEqual({ ok: true, mime: "application/pdf", nome: "CNH.pdf" });
    expect(validarArquivoDocumento("foto.jpg", pdf).ok).toBe(false);
    expect(validarArquivoDocumento("script.html", pdf).ok).toBe(false);
    expect(validarArquivoDocumento("x.pdf", new Uint8Array()).ok).toBe(false);
    const grande = new Uint8Array(15 * 1024 * 1024 + 1); grande.set(pdf);
    expect(validarArquivoDocumento("x.pdf", grande).ok).toBe(false);
    expect(validarArquivoDocumento("../../etc/a.pdf", pdf)).toMatchObject({ ok: true, nome: "_.._etc_a.pdf" });
  });

  it("Content-Disposition preserva o nome original", () => {
    expect(contentDisposition("Anuidade 2026 — CREA.pdf", false)).toBe(`attachment; filename="Anuidade 2026 _ CREA.pdf"; filename*=UTF-8''Anuidade%202026%20%E2%80%94%20CREA.pdf`);
    expect(contentDisposition('a"b.pdf', true).startsWith('inline; filename="a_b.pdf"')).toBe(true);
  });

  it("ZIP com pasta por categoria, nomes repetidos numerados e bytes originais", () => {
    const zip = montarZipDocumentos([
      { nome: "rg.pdf", categoria: "documento_pessoal", bytes: pdf },
      { nome: "rg.pdf", categoria: "documento_pessoal", bytes: new Uint8Array([1, 2, 3]) },
      { nome: "boleto.pdf", categoria: "anuidade_crea", bytes: new TextEncoder().encode("abc") },
      { nome: "x.png", categoria: "invalida", bytes: new Uint8Array([9]) },
    ]);
    const abertos = unzipSync(zip);
    expect(Object.keys(abertos).sort()).toEqual(["Anuidade CREA/boleto.pdf", "Documento pessoal/rg (2).pdf", "Documento pessoal/rg.pdf", "Outros/x.png"]);
    expect(Array.from(abertos["Documento pessoal/rg.pdf"])).toEqual(Array.from(pdf));
    expect(strFromU8(abertos["Anuidade CREA/boleto.pdf"])).toBe("abc");
    expect(nomeZipDocumentos("José da Silva")).toBe("documentos-jose-da-silva.zip");
  });

  it("acesso: admin gerencia; o próprio usuário só consulta; demais não veem", () => {
    expect(acessoDocumentosUsuario({ id: 1, papel: "admin" }, 9)).toEqual({ ver: true, gerenciar: true });
    expect(acessoDocumentosUsuario({ id: 9, papel: "colaborador" }, 9)).toEqual({ ver: true, gerenciar: false });
    expect(acessoDocumentosUsuario({ id: 8, papel: "colaborador" }, 9)).toEqual({ ver: false, gerenciar: false });
    expect(acessoDocumentosUsuario({ id: 1, papel: "admin", ativo: false }, 9)).toEqual({ ver: false, gerenciar: false });
    expect(acessoDocumentosUsuario({ id: "9", papel: "corretor" }, 9).ver).toBe(true);
  });
});
