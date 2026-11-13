// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-0110.test.ts) —
// migração 20261113200000 aditiva e idempotente, em PostgreSQL isolado em memória (PGlite).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync("prisma/migrations/20261113200000_central_vendas/migration.sql", "utf8");
const base = `CREATE TABLE leads (id text PRIMARY KEY, nome text NOT NULL, telefone text NOT NULL);`;

describe("migração 20261113200000_central_vendas", () => {
  it("aplica duas vezes sem erro, cria as 12 tabelas com RLS e não altera tabelas existentes", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(base);
      await pg.exec("INSERT INTO leads VALUES ('l1', 'Ana', '99999990000')");
      const antes = (await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' ORDER BY 1")).rows;
      await pg.exec(sql());
      await pg.exec(sql());
      expect((await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' ORDER BY 1")).rows).toEqual(antes);
      expect((await pg.query("SELECT nome FROM leads")).rows).toEqual([{ nome: "Ana" }]);
      const t = (await pg.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relname LIKE 'central_vendas_%' ORDER BY 1")).rows;
      expect(t.map(x => x.relname)).toEqual([
        "central_vendas_campanhas", "central_vendas_checklists", "central_vendas_config", "central_vendas_contatos",
        "central_vendas_documentos", "central_vendas_eventos", "central_vendas_fila", "central_vendas_leads",
        "central_vendas_limites", "central_vendas_produtos", "central_vendas_sequencias", "central_vendas_tokens_mes",
      ]);
      expect(t.every(x => x.relrowsecurity)).toBe(true);
    } finally { await pg.close(); }
  });

  it("status com valores válidos, decisão só com humano e um registro por origem + ID externo", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(base);
      await pg.exec(sql());
      await pg.exec("INSERT INTO leads VALUES ('l1', 'Ana', '1'), ('l2', 'Bia', '2')");
      await pg.exec(`INSERT INTO central_vendas_leads ("leadId", origem, "idExterno") VALUES ('l1', 'site', 'abc')`);
      await expect(pg.exec(`INSERT INTO central_vendas_leads ("leadId", origem, "idExterno") VALUES ('l2', 'site', 'abc')`)).rejects.toThrow();
      await expect(pg.exec(`UPDATE central_vendas_leads SET "statusAnalise" = 'aprovado' WHERE "leadId" = 'l1'`)).rejects.toThrow(/decisao_humana/);
      await expect(pg.exec(`UPDATE central_vendas_leads SET "statusAtendimento" = 'inventado' WHERE "leadId" = 'l1'`)).rejects.toThrow();
      await pg.exec(`UPDATE central_vendas_leads SET "statusAnalise" = 'aprovado', "decisaoPor" = 'u1' WHERE "leadId" = 'l1'`);
      expect((await pg.query(`SELECT "statusAnalise" FROM central_vendas_leads`)).rows).toEqual([{ statusAnalise: "aprovado" }]);
      await expect(pg.exec("INSERT INTO central_vendas_config (id) VALUES (2)")).rejects.toThrow();
      await expect(pg.exec("INSERT INTO central_vendas_fila (chave, status) VALUES ('x', 'inventado')")).rejects.toThrow();
      // Apagar o lead apaga o registro da Central; a auditoria fica.
      await pg.exec(`INSERT INTO central_vendas_eventos (tipo, "leadId") VALUES ('teste', 'l1'); DELETE FROM leads WHERE id = 'l1'`);
      expect((await pg.query("SELECT count(*)::int AS n FROM central_vendas_leads")).rows).toEqual([{ n: 0 }]);
      expect((await pg.query(`SELECT "leadId" FROM central_vendas_eventos`)).rows).toEqual([{ leadId: "l1" }]);
    } finally { await pg.close(); }
  });
});
