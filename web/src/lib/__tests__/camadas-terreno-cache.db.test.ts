// Paridade 17/11 (bloco 2) — camadas do mapa do terreno (Prospecta EPIC-023 S-E): migração 20261117210000 aditiva e
// idempotente em PostgreSQL isolado (PGlite), e o armazém do último resultado bom com o prisma simulado.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = () => readFileSync("prisma/migrations/20261117210000_camadas_terreno_cache/migration.sql", "utf8");

describe("migração 20261117210000_camadas_terreno_cache", () => {
  it("aplica duas vezes sem erro, cria a tabela com RLS, chave (terreno, camada) e só aceita estado ok/vazio", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(sql());
      await pg.exec(sql());
      const t = (await pg.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname = 'camadas_terreno_cache'")).rows;
      expect(t).toEqual([{ relrowsecurity: true }]);
      await pg.exec(`INSERT INTO camadas_terreno_cache ("chaveTerreno", camada, estado, fonte, dados) VALUES ('k', 'osm', 'ok', 'OSM', '{}')`);
      await expect(pg.exec(`INSERT INTO camadas_terreno_cache ("chaveTerreno", camada, estado, fonte, dados) VALUES ('k', 'osm', 'ok', 'OSM', '{}')`)).rejects.toThrow();
      await expect(pg.exec(`INSERT INTO camadas_terreno_cache ("chaveTerreno", camada, estado, fonte, dados) VALUES ('k', 'car', 'indisponivel', 'x', '{}')`)).rejects.toThrow();
      const r = (await pg.query<{ salvoEm: Date }>(`SELECT "salvoEm" FROM camadas_terreno_cache`)).rows;
      expect(r[0].salvoEm).toBeInstanceOf(Date);
    } finally { await pg.close(); }
  });
});

const linhas = new Map<string, { chaveTerreno: string; camada: string; estado: string; fonte: string; dados: string; salvoEm: Date }>();
let falha: Error | null = null;
vi.mock("@/lib/db", () => ({
  prisma: {
    camadaTerrenoCache: {
      findUnique: vi.fn(async ({ where }: { where: { chaveTerreno_camada: { chaveTerreno: string; camada: string } } }) => {
        if (falha) throw falha;
        const w = where.chaveTerreno_camada;
        return linhas.get(`${w.chaveTerreno}|${w.camada}`) ?? null;
      }),
      upsert: vi.fn(async ({ create, update }: { create: { chaveTerreno: string; camada: string; estado: string; fonte: string; dados: string }; update: { salvoEm: Date } }) => {
        if (falha) throw falha;
        linhas.set(`${create.chaveTerreno}|${create.camada}`, { ...create, salvoEm: update.salvoEm });
      }),
    },
  },
}));

describe("armazemCamadasBanco (Prisma)", () => {
  beforeEach(async () => { linhas.clear(); falha = null; (await import("@/lib/geo/camadas-terreno-armazem"))._reiniciarArmazemCamadas(); });

  it("grava só resultado bom (ok/vazio) e lê de volta com a data", async () => {
    const { armazemCamadasBanco } = await import("@/lib/geo/camadas-terreno-armazem");
    await armazemCamadasBanco.gravar("k", "osm", { estado: "ok", fonte: "OSM", dados: { vias: [] } } as never);
    await armazemCamadasBanco.gravar("k", "car", { estado: "indisponivel", fonte: "SICAR", erro: "fora" } as never);
    const lido = await armazemCamadasBanco.ler("k", "osm");
    expect(lido?.valor).toMatchObject({ estado: "ok", fonte: "OSM" });
    expect(lido?.salvoEm).toBeInstanceOf(Date);
    expect(await armazemCamadasBanco.ler("k", "car")).toBeNull();
  });

  it("tabela ausente (migração não aplicada): segue sem persistência e não insiste", async () => {
    const { armazemCamadasBanco } = await import("@/lib/geo/camadas-terreno-armazem");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    falha = Object.assign(new Error("The table `camadas_terreno_cache` does not exist"), { code: "P2021" });
    expect(await armazemCamadasBanco.ler("k", "osm")).toBeNull();
    falha = null;
    await armazemCamadasBanco.gravar("k", "osm", { estado: "ok", fonte: "OSM", dados: {} } as never);
    expect(linhas.size).toBe(0);
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
});
