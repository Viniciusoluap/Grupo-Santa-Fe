// Pedido de 23/10: Mapa Operacional = imóveis + obras com ponto (imóvel vinculado ou PCI),
// valor = VGV da obra, endereço da obra, sem coordenada inventada (banco real).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coordenadasDaPci, enderecoCompleto } from "@/lib/obra-localizacao";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe("coordenadas da PCI e endereço", () => {
  it("lê os formatos da PCI usados em produção", () => {
    expect(coordenadasDaPci("52948 S", "472641 W")).toEqual({ lat: -5.4966667, lng: -47.4447222 });
    expect(coordenadasDaPci(`5°30'29.0" S`, "47°26'39.8 W")).toEqual({ lat: -5.5080556, lng: -47.4443889 });
    expect(coordenadasDaPci("", "")).toBeNull();
    expect(enderecoCompleto(["Rua A, 10", "Centro", "Parauapebas", "PA"])).toBe("Rua A, 10, Centro, Parauapebas, PA");
    expect(enderecoCompleto(["Morada do Bosque, Imperatriz/MA", "Imperatriz", "MA"])).toBe("Morada do Bosque, Imperatriz/MA");
    expect(enderecoCompleto(["Rua Centro, 10", "Centro", "Imperatriz"])).toBe("Rua Centro, 10, Centro, Imperatriz");
    expect(coordenadasDaPci("472641 W", "52948 S")).toBeNull();
  });
});

describe.skipIf(!url)("mapa operacional (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let pontosDoMapa: typeof import("@/lib/mapa-operacional").pontosDoMapa;
  const obras: string[] = [];
  const imoveis: string[] = [];
  const sufixo = Date.now();

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ pontosDoMapa } = await import("@/lib/mapa-operacional"));
    const im = await prisma.imovel.create({ data: { slug: `mapa-${sufixo}`, titulo: `Obra — Mapa ${sufixo}`, tipo: "casa", status: "venda", preco: 0, area: 70, bairro: "", descricao: "x", latitude: -5.5, longitude: -47.4, publicadoSite: false } });
    imoveis.push(im.id);
    const comImovel = await prisma.obra.create({ data: { nome: `Mapa A ${sufixo}`, clienteNome: "A", clienteTel: "0", endereco: "Morada do Bosque, Imperatriz", vgv: 200000, imovelId: im.id } });
    const comPci = await prisma.obra.create({ data: { nome: `Mapa B ${sufixo}`, clienteNome: "B", clienteTel: "0", endereco: "Rua México, Jardim América", vgv: 260000 } });
    const semPonto = await prisma.obra.create({ data: { nome: `Mapa C ${sufixo}`, clienteNome: "C", clienteTel: "0", endereco: "Rua X" } });
    const imSemPonto = await prisma.imovel.create({ data: { slug: `mapa-d-${sufixo}`, titulo: `Obra — Mapa D ${sufixo}`, tipo: "casa", status: "venda", preco: 0, area: 70, bairro: "", descricao: "x", publicadoSite: false } });
    const imVendido = await prisma.imovel.create({ data: { slug: `mapa-e-${sufixo}`, titulo: `Obra — Mapa E ${sufixo}`, tipo: "casa", status: "vendido", preco: 0, area: 70, bairro: "", descricao: "x", latitude: -5.6, longitude: -47.5, publicadoSite: false } });
    imoveis.push(imSemPonto.id, imVendido.id);
    const comImovelSemPonto = await prisma.obra.create({ data: { nome: `Mapa D ${sufixo}`, clienteNome: "D", clienteTel: "0", endereco: "Residencial Aurora", vgv: 180000, imovelId: imSemPonto.id } });
    const comImovelVendido = await prisma.obra.create({ data: { nome: `Mapa E ${sufixo}`, clienteNome: "E", clienteTel: "0", endereco: "Vila Esmeralda", vgv: 190000, imovelId: imVendido.id } });
    obras.push(comImovel.id, comPci.id, semPonto.id, comImovelSemPonto.id, comImovelVendido.id);
    for (const [obraId, latitude, longitude] of [[comPci.id, "52948 S", "472641 W"], [comImovelSemPonto.id, "52920 S", "472702 W"], [comImovelVendido.id, `5°30'29.0" S`, "47°26'39.8 W"]]) {
      const versao = await prisma.obraPciVersao.create({ data: { obraId, hash: `h${obraId}${sufixo}`, nome: "pci.xls", dados: Buffer.from("x"), tamanho: 1, parsed: { identificacao: { latitude, longitude } } } });
      await prisma.obraPci.create({ data: { obraId, versaoId: versao.id } });
    }
  });
  afterAll(async () => {
    await prisma.obraPci.deleteMany({ where: { obraId: { in: obras } } });
    await prisma.obraPciVersao.deleteMany({ where: { obraId: { in: obras } } });
    await prisma.obra.deleteMany({ where: { id: { in: obras } } });
    await prisma.imovel.deleteMany({ where: { id: { in: imoveis } } });
    await prisma.$disconnect();
  });

  it("imóvel da obra com VGV e endereço da obra; obra pela PCI; obra sem ponto fica fora", async () => {
    const pontos = await pontosDoMapa();
    const doImovel = pontos.find((p) => p.key === `imovel-${imoveis[0]}`);
    expect(doImovel).toMatchObject({ obraId: obras[0], valor: 200000, endereco: "Morada do Bosque, Imperatriz", latitude: -5.5, longitude: -47.4 });
    expect(pontos.find((p) => p.key === `obra-${obras[1]}`)).toMatchObject({ kind: "obra", valor: 260000, endereco: "Rua México, Jardim América", latitude: -5.4966667, longitude: -47.4447222 });
    expect(pontos.some((p) => p.obraId === obras[2])).toBe(false);
    expect(pontos.filter((p) => p.obraId === obras[0])).toHaveLength(1);
  });

  it("imóvel vinculado sem ponto usa a PCI; obra com imóvel vendido entra pela PCI", async () => {
    const pontos = await pontosDoMapa();
    expect(pontos.find((p) => p.key === `imovel-${imoveis[1]}`)).toMatchObject({ obraId: obras[3], valor: 180000, latitude: -5.4888889, longitude: -47.4505556 });
    expect(pontos.find((p) => p.key === `obra-${obras[4]}`)).toMatchObject({ kind: "obra", valor: 190000, latitude: -5.5080556 });
    expect(pontos.some((p) => p.key === `imovel-${imoveis[2]}`)).toBe(false);
  });
});
