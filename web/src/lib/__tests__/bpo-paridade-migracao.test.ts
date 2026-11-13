// Paridade BPO (13/11): a migração 20261113100000 é só aditiva e idempotente (PGlite, sem banco real).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(new URL("../../../prisma/migrations/20261113100000_bpo_paridade_conta_azul_a_classificar/migration.sql", import.meta.url), "utf8");
// Recorte das tabelas existentes que a migração altera (colunas usadas por ela).
const ANTES = `
  CREATE TABLE transacoes_bancarias (id TEXT PRIMARY KEY, descricao TEXT NOT NULL DEFAULT '');
  CREATE TABLE bpo_lancamentos (id TEXT PRIMARY KEY, descricao TEXT NOT NULL DEFAULT '', "centroCustos" TEXT);
  CREATE TABLE bpo_baixas (id TEXT PRIMARY KEY, "lancamentoId" TEXT NOT NULL, valor DOUBLE PRECISION NOT NULL);
`;

describe("Migração 20261113100000 (Conta Azul, A classificar, dividir pagamentos, centros de custo)", () => {
  it("aplica duas vezes sem erro, não altera dados e semeia os centros separando os combinados", async () => {
    const pg = new PGlite();
    await pg.exec(ANTES);
    await pg.exec(`INSERT INTO transacoes_bancarias (id) VALUES ('t1');
      INSERT INTO bpo_lancamentos (id, descricao, "centroCustos") VALUES
        ('a','x','Santa Fé Canaã / Obra Norte'), ('b','y','Obra Norte'), ('c','z','santa fe canaa'), ('d','w',NULL), ('e','v','  Obra   Sul ');
      INSERT INTO bpo_baixas (id, "lancamentoId", valor) VALUES ('b1','a',10);`);
    await pg.exec(SQL);
    await pg.exec(`UPDATE bpo_centros_custo SET ativo = false WHERE nome = 'Obra Sul'`);
    await pg.exec(SQL);
    const centros = (await pg.query<{ nome: string; ativo: boolean }>(`SELECT nome, ativo FROM bpo_centros_custo ORDER BY nome`)).rows;
    expect(centros.map((c) => c.nome).sort()).toEqual(["Obra Norte", "Obra Sul", "Santa Fé Canaã"].sort());
    expect(centros.find((c) => c.nome === "Obra Sul")?.ativo).toBe(false); // reaplicar não mexe no que existe
    await expect(pg.exec(`INSERT INTO bpo_centros_custo (id, nome) VALUES ('x', 'OBRA NORTE')`)).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO bpo_centros_custo (id, nome) VALUES ('y', 'santa fe canaa')`)).rejects.toThrow();
    // dados existentes intactos; colunas novas com o padrão
    expect((await pg.query(`SELECT id, "centroCustos", "aClassificar", observacoes FROM bpo_lancamentos ORDER BY id LIMIT 1`)).rows)
      .toEqual([{ id: "a", centroCustos: "Santa Fé Canaã / Obra Norte", aClassificar: false, observacoes: null }]);
    expect((await pg.query(`SELECT "aClassificar" FROM transacoes_bancarias`)).rows).toEqual([{ aClassificar: false }]);
    // baixa ligada à movimentação: apagar a movimentação mantém a baixa (vínculo vira nulo)
    await pg.exec(`UPDATE bpo_baixas SET "transacaoId" = 't1'; DELETE FROM transacoes_bancarias WHERE id = 't1';`);
    expect((await pg.query(`SELECT id, "transacaoId" FROM bpo_baixas`)).rows).toEqual([{ id: "b1", transacaoId: null }]);
    await pg.close();
  });
});
