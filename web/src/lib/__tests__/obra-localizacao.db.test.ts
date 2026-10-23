// Lote 23/10, etapa 3: "Localização exata" da obra cria/atualiza um único imóvel
// vinculado, não publicado, visível no Mapa Operacional (banco real).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("obra — localização exata → imóvel vinculado (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let loc: typeof import("@/lib/obras/localizacao");
  const obras: string[] = [];
  const imoveis: string[] = [];
  const novaObra = async () => {
    const o = await prisma.obra.create({ data: { nome: "Casa Maria", clienteNome: "Maria", clienteTel: "0", endereco: "Rua A, 10", area: 70 } });
    obras.push(o.id);
    return o.id;
  };
  const salvar = (obraId: string, c: { lat: number; lng: number } | null) => prisma.$transaction(tx => loc.salvarLocalizacaoObra(tx, obraId, c, null));

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    loc = await import("@/lib/obras/localizacao");
  });
  afterAll(async () => {
    const ids = (await prisma.obra.findMany({ where: { id: { in: obras } }, select: { imovelId: true } })).map(o => o.imovelId).filter((x): x is string => !!x);
    await prisma.obra.deleteMany({ where: { id: { in: obras } } });
    await prisma.imovel.deleteMany({ where: { id: { in: [...ids, ...imoveis] } } });
    await prisma.$disconnect();
  });

  it("cria imóvel não publicado na primeira gravação e reaproveita o mesmo depois", async () => {
    const id = await novaObra();
    const r1 = await salvar(id, { lat: -6.4975, lng: -49.8761 });
    expect(r1.criado).toBe(true);
    const im = await prisma.imovel.findUniqueOrThrow({ where: { id: r1.imovelId! } });
    expect(im).toMatchObject({ titulo: "Obra — Casa Maria", rua: "Rua A, 10", latitude: -6.4975, longitude: -49.8761, publicadoSite: false, publicadoZap: false, publicadoOlx: false, publicadoViva: false, destaque: false });
    const r2 = await salvar(id, { lat: -6.5, lng: -49.88 });
    expect(r2).toMatchObject({ imovelId: r1.imovelId, criado: false });
    expect(await prisma.imovel.count({ where: { slug: { startsWith: `obra-${id}-` } } })).toBe(1);
    const depois = await prisma.imovel.findUniqueOrThrow({ where: { id: r1.imovelId! } });
    expect(depois).toMatchObject({ latitude: -6.5, longitude: -49.88, titulo: "Obra — Casa Maria", publicadoSite: false });
  });

  it("gravações simultâneas não duplicam o imóvel", async () => {
    const id = await novaObra();
    const rs = await Promise.all([salvar(id, { lat: -6.1, lng: -49.1 }), salvar(id, { lat: -6.2, lng: -49.2 })]);
    expect(rs.filter(r => r.criado)).toHaveLength(1);
    expect(new Set(rs.map(r => r.imovelId)).size).toBe(1);
    expect(await prisma.imovel.count({ where: { slug: { startsWith: `obra-${id}-` } } })).toBe(1);
  });

  it("preserva imóvel já vinculado (endereço/publicação) e obra antiga sem ponto não cria nada", async () => {
    const id = await novaObra();
    const existente = await prisma.imovel.create({ data: { slug: `teste-vinc-${Date.now()}`, titulo: "Imóvel já existente", tipo: "casa", status: "venda", preco: 300000, area: 80, bairro: "Centro", rua: "Rua Original", descricao: "x", publicadoSite: true } });
    imoveis.push(existente.id);
    await prisma.obra.update({ where: { id }, data: { imovelId: existente.id } });
    await salvar(id, { lat: -6.3, lng: -49.3 });
    expect(await prisma.imovel.findUniqueOrThrow({ where: { id: existente.id } })).toMatchObject({ rua: "Rua Original", publicadoSite: true, preco: 300000, latitude: -6.3 });
    await salvar(id, null);
    expect(await prisma.imovel.findUniqueOrThrow({ where: { id: existente.id } })).toMatchObject({ latitude: null, longitude: null });
    expect((await prisma.obra.findUniqueOrThrow({ where: { id } })).imovelId).toBe(existente.id);

    const antiga = await novaObra();
    expect(await salvar(antiga, null)).toEqual({ imovelId: null, criado: false, coords: null });
  });

  it("formulário: campo ausente não mexe; vazio remove; inválido é recusado", () => {
    const fd = new FormData();
    expect(loc.coordenadasDoFormulario(fd)).toBeUndefined();
    fd.set("localizacaoPresente", "1");
    expect(loc.coordenadasDoFormulario(fd)).toBeNull();
    fd.set("localizacaoLat", "-6.5"); fd.set("localizacaoLng", "-49.8");
    expect(loc.coordenadasDoFormulario(fd)).toEqual({ lat: -6.5, lng: -49.8 });
    fd.set("localizacaoLat", "120");
    expect(() => loc.coordenadasDoFormulario(fd)).toThrow("Localização inválida");
  });
});
