import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("a migration PCI mantém a versão histórica e não gera órfãos na exclusão da obra", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE obras(id text primary key); INSERT INTO obras VALUES('o1');
      CREATE TABLE obra_progresso_itens(incidencia decimal(7,4));
      CREATE TABLE obra_progresso_historico(id text primary key,"obraId" text REFERENCES obras(id) ON DELETE CASCADE,"somaIncidencia" decimal(9,4)); CREATE TABLE obra_fotos(id text primary key);`);
    await db.exec(readFileSync(new URL("../../../prisma/migrations/20261018220000_medicao_caixa_pci/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO obra_pci_versoes(id,"obraId",hash,nome,dados,tamanho,parsed) VALUES('v1','o1','h1','a.xls',decode('01','hex'),1,'{}'),('v2','o1','h2','b.xls',decode('02','hex'),1,'{}');
      INSERT INTO obra_pci("obraId","versaoId") VALUES('o1','v1'); INSERT INTO obra_progresso_historico(id,"obraId","somaIncidencia","pciVersaoId") VALUES('m1','o1',100,'v1'); UPDATE obra_pci SET "versaoId"='v2';`);
    expect((await db.query(`SELECT "pciVersaoId" FROM obra_progresso_historico WHERE id='m1'`)).rows).toEqual([{ pciVersaoId: "v1" }]);
    await expect(db.exec(`DELETE FROM obra_pci_versoes WHERE id='v1'`)).rejects.toThrow();
    await db.exec(`DELETE FROM obras WHERE id='o1'`);
    expect((await db.query(`SELECT count(*)::int AS n FROM obra_pci_versoes`)).rows).toEqual([{ n: 0 }]);
  } finally { await db.close(); }
}, 30_000);
