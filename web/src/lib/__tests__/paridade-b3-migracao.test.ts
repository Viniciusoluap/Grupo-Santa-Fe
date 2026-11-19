// Paridade 17/11, bloco 3: a migração 20261117300000 é só aditiva e idempotente (PGlite, sem banco real).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(new URL("../../../prisma/migrations/20261117300000_paridade_b3_financeiro/migration.sql", import.meta.url), "utf8");

describe("Migração 20261117300000 (paridade 17/11, bloco 3)", () => {
  it("aplica duas vezes sem erro, cria o expurgo com RLS e não mexe em dados existentes", async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE bpo_lancamentos (id TEXT PRIMARY KEY, "requestKey" TEXT UNIQUE);
      INSERT INTO bpo_lancamentos VALUES ('l1', 'contaazul:1:x');`);
    await pg.exec(SQL);
    await pg.exec(`INSERT INTO bpo_lancamentos_expurgo (id, "loteId", "lancamentoId", "dadosJson") VALUES ('e1', 'lote', 'l0', '{}')`);
    await pg.exec(SQL); // reaplicar não muda nada
    expect((await pg.query(`SELECT id, motivo FROM bpo_lancamentos_expurgo`)).rows).toEqual([{ id: "e1", motivo: "liberar_reimportacao_conta_azul" }]);
    expect((await pg.query(`SELECT id FROM bpo_lancamentos`)).rows).toEqual([{ id: "l1" }]);
    const rls = await pg.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'bpo_lancamentos_expurgo'`);
    expect(rls.rows[0].relrowsecurity).toBe(true);
    const grants = await pg.query(`SELECT grantee FROM information_schema.role_table_grants WHERE table_name = 'bpo_lancamentos_expurgo' AND grantee IN ('anon','authenticated')`);
    expect(grants.rows).toEqual([]);
    // Nenhum comando que apague ou altere dados (comentários e "ON DELETE/ON UPDATE" das FKs à parte).
    expect(SQL.replace(/--.*$/gm, "")).not.toMatch(/^\s*(DROP|DELETE|TRUNCATE|UPDATE|ALTER TABLE \S+ (DROP|ALTER))\b/im);
    await pg.close();
  });

  it("modelos de preenchimento da PCI: nome único só entre as versões atuais não excluídas; uma sucessora por versão", async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE TABLE bpo_lancamentos (id TEXT PRIMARY KEY);`);
    await pg.exec(SQL);
    await pg.exec(SQL);
    await pg.exec(`INSERT INTO pci_modelos_preenchimento (id, nome, dados) VALUES ('a', 'Casa 70', '{}')`);
    await expect(pg.exec(`INSERT INTO pci_modelos_preenchimento (id, nome, dados) VALUES ('b', 'CASA 70', '{}')`)).rejects.toThrow(/nome_atual_uidx/);
    // nova versão: a anterior é marcada como substituída e o mesmo nome passa
    await pg.exec(`UPDATE pci_modelos_preenchimento SET substituido = true WHERE id = 'a';
      INSERT INTO pci_modelos_preenchimento (id, nome, versao, "anteriorId", dados) VALUES ('a2', 'Casa 70', 2, 'a', '{}')`);
    await expect(pg.exec(`INSERT INTO pci_modelos_preenchimento (id, nome, versao, "anteriorId", dados, substituido) VALUES ('a3', 'Outro', 2, 'a', '{}', true)`)).rejects.toThrow(/anteriorId_key/);
    // excluído libera o nome
    await pg.exec(`UPDATE pci_modelos_preenchimento SET "excluidoEm" = now() WHERE id = 'a2';
      INSERT INTO pci_modelos_preenchimento (id, nome, dados) VALUES ('c', 'casa 70', '{}')`);
    await expect(pg.exec(`INSERT INTO pci_modelos_preenchimento (id, nome, versao, dados) VALUES ('d', 'x', 0, '{}')`)).rejects.toThrow();
    expect((await pg.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'pci_modelos_preenchimento'`)).rows[0].relrowsecurity).toBe(true);
    await pg.close();
  });
});
