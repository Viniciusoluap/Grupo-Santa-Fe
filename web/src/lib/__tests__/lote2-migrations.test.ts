import { expect,it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("migrações do lote 2 são idempotentes, preservam o legado e protegem tabelas privadas", async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`CREATE TABLE usuarios(id text primary key);CREATE TABLE obras(id text primary key);CREATE TABLE leads(id text primary key);CREATE TABLE estudos_incorporacao(id text primary key);CREATE TABLE projetos(id text primary key);CREATE TABLE estudo_unidades(id text primary key,"estudoId" text,"codigoChave" text,"atualizadoEm" timestamp,UNIQUE("estudoId","codigoChave"));INSERT INTO usuarios VALUES('legado');INSERT INTO estudos_incorporacao VALUES('estudo-legado');`);
  for(let rodada=0;rodada<2;rodada++)for(const m of ['20261027160000_pci_gerador','20261027170000_perfil_engenheiro','20261027180000_incorporacao_estudos_salvos','20261027190000_unidades_cenario','20261027200000_projeto_incorporacao','20261027210000_lead_valor_negociado'])await pg.exec(readFileSync(new URL(`../../../prisma/migrations/${m}/migration.sql`,import.meta.url),'utf8'));
  await pg.exec(`INSERT INTO leads(id,"valorNegociado") VALUES('cliente',23123.45);`);
  expect((await pg.query('SELECT "valorNegociado" FROM leads')).rows).toEqual([{valorNegociado:"23123.45"}]);
  await expect(pg.exec(`UPDATE leads SET "valorNegociado"=-1;`)).rejects.toThrow();
  const tables=(await pg.query<{relname:string;relrowsecurity:boolean}>(`SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN('pci_modelos','pci_gerador_rascunhos','pci_geradas','perfis_engenheiro','documentos_usuario','estudos_massa_salvos')`)).rows;
  expect(tables).toHaveLength(6);expect(tables.every(t=>t.relrowsecurity)).toBe(true);
  expect((await pg.query('SELECT id FROM estudos_incorporacao')).rows).toEqual([{id:'estudo-legado'}]);
 }finally{await pg.close();}
},30000);
