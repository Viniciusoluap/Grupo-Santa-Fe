// Regras das fotos da obra (EPIC-020, Lote 4, item 28).
// Mesmo conteúdo em Prospecta/server/obra-fotos.test.ts.
import { describe, expect, it } from "vitest";
import { LIMITE_FOTO_BYTES, detectarTipoImagem, lerDataUrl, podeGerenciarFotos, podeVerFotosDaObra, validarFotoObra } from "@/lib/obras/fotos";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

describe("fotos da obra — validação", () => {
  it("reconhece o tipo pelo conteúdo", () => {
    expect(detectarTipoImagem(JPEG)).toBe("image/jpeg");
    expect(detectarTipoImagem(PNG)).toBe("image/png");
    expect(detectarTipoImagem(WEBP)).toBe("image/webp");
    expect(detectarTipoImagem(HEIC)).toBeNull();
    expect(detectarTipoImagem(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("rejeita vazio, grande demais, formato não suportado e legenda longa", () => {
    expect(validarFotoObra(new Uint8Array(), null).ok).toBe(false);
    const grande = new Uint8Array(LIMITE_FOTO_BYTES + 1);
    grande.set(JPEG);
    expect(validarFotoObra(grande, null)).toMatchObject({ ok: false });
    expect(validarFotoObra(HEIC, null)).toMatchObject({ ok: false });
    expect(validarFotoObra(JPEG, "x".repeat(301))).toMatchObject({ ok: false });
    expect(validarFotoObra(JPEG, "Fundação")).toEqual({ ok: true, mime: "image/jpeg" });
  });
  it("lê data URL e recusa o resto", () => {
    expect(lerDataUrl("data:image/jpeg;base64,/9j/4A==")).toBe("/9j/4A==");
    expect(lerDataUrl("https://x/y.jpg")).toBeNull();
    expect(lerDataUrl(123)).toBeNull();
  });
});

describe("fotos da obra — permissões", () => {
  const obra = { usuarioId: 7, leadId: 30 };
  it("admin vê e gerencia", () => {
    expect(podeVerFotosDaObra({ id: 1, papel: "admin" }, obra)).toBe(true);
    expect(podeGerenciarFotos({ id: 1, papel: "admin" })).toBe(true);
  });
  it("cliente da obra vê, mas não gerencia", () => {
    expect(podeVerFotosDaObra({ id: 9, papel: "cliente", leadId: 30 }, obra)).toBe(true);
    expect(podeVerFotosDaObra({ id: 7, papel: "cliente" }, obra)).toBe(true);
    expect(podeGerenciarFotos({ id: 9, papel: "cliente" })).toBe(false);
  });
  it("outros usuários não veem", () => {
    expect(podeVerFotosDaObra(null, obra)).toBe(false);
    expect(podeVerFotosDaObra({ id: 9, papel: "cliente", leadId: 31 }, obra)).toBe(false);
    expect(podeVerFotosDaObra({ id: 9, papel: "corretor", leadId: 30 }, obra)).toBe(false);
    expect(podeVerFotosDaObra({ id: 9, papel: "empreiteiro" }, obra)).toBe(false);
  });
  it("equipe com o módulo Obras vê e gerencia; sem o módulo, não (item 06)", () => {
    expect(podeVerFotosDaObra({ id: 5, papel: "colaborador", acessoObras: true }, obra)).toBe(true);
    expect(podeGerenciarFotos({ id: 5, papel: "colaborador", acessoObras: true })).toBe(true);
    expect(podeVerFotosDaObra({ id: 5, papel: "colaborador", acessoObras: false }, obra)).toBe(false);
    expect(podeGerenciarFotos({ id: 5, papel: "colaborador" })).toBe(false);
  });
});
