import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const auth = vi.fn();
const configuracaoFindUnique = vi.fn();
const imovelFindFirst = vi.fn();
const imovelCreate = vi.fn();

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({
  prisma: {
    configuracao: { findUnique: configuracaoFindUnique },
    imovel: { findFirst: imovelFindFirst, create: imovelCreate },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sessaoAdmin = { user: { id: "u1", role: "admin" } };

/**
 * Feed XML mínimo com um único <Listing>. O preço é enviado no formato
 * brasileiro ("350.000,00") — exatamente como alguns portais de imóveis
 * exportam — para comprovar que o preço gravado é 350000 e não 350 (bug do
 * Lote 4: um regex que só removia caracteres não numéricos preservava o
 * ponto de milhar e descartava a vírgula decimal, corrompendo o valor em
 * ~1000x antes de chegar ao banco, sem qualquer revisão humana).
 */
function feedXml({ preco, area }: { preco: string; area: string }): string {
  return `<?xml version="1.0"?>
<Listings>
  <Listing>
    <ListingID>ext-123456</ListingID>
    <Title>Casa com preço em formato BR</Title>
    <ListPrice>${preco}</ListPrice>
    <LivingArea>${area}</LivingArea>
    <City>Canaã dos Carajás</City>
    <State>PA</State>
  </Listing>
</Listings>`;
}

describe("executarAgregacao — conversão segura de preço/área do feed XML (Lote 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue(sessaoAdmin);
    configuracaoFindUnique.mockResolvedValue({ valor: JSON.stringify(["https://feed.example/imoveis.xml"]) });
    imovelFindFirst.mockResolvedValue(null);
    imovelCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converte um preço no formato BR ('350.000,00') para 350000, não 350", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: async () => feedXml({ preco: "350.000,00", area: "120,50" }),
      })
    );

    const { executarAgregacao } = await import("@/lib/actions/agregador-xml");
    const resultado = await executarAgregacao();

    expect(resultado.importados).toBe(1);
    expect(imovelCreate).toHaveBeenCalledTimes(1);
    const dataGravada = imovelCreate.mock.calls[0][0].data;
    expect(dataGravada.preco).toBe(350000);
    expect(dataGravada.area).toBe(120.5);
  });

  it("continua aceitando o formato americano ('350000.00') sem regressão", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: async () => feedXml({ preco: "350000.00", area: "120.5" }),
      })
    );

    const { executarAgregacao } = await import("@/lib/actions/agregador-xml");
    const resultado = await executarAgregacao();

    expect(resultado.importados).toBe(1);
    const dataGravada = imovelCreate.mock.calls[0][0].data;
    expect(dataGravada.preco).toBe(350000);
    expect(dataGravada.area).toBe(120.5);
  });

  it("converte um preço simples sem separadores ('350000')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: async () => feedXml({ preco: "350000", area: "120" }),
      })
    );

    const { executarAgregacao } = await import("@/lib/actions/agregador-xml");
    const resultado = await executarAgregacao();

    const dataGravada = imovelCreate.mock.calls[0][0].data;
    expect(dataGravada.preco).toBe(350000);
    expect(dataGravada.area).toBe(120);
  });
});
