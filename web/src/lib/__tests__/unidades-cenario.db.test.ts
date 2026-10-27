import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const mocks=vi.hoisted(()=>({buscar:vi.fn(),raw:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({prisma:{estudoIncorporacao:{findUnique:mocks.buscar},$queryRaw:mocks.raw}}));
import { sincronizarUnidadesCenario } from "@/lib/incorporacao/unidades-cenario-db";
const pg=new PGlite();
const c={id:"A",lotes:[1,2,3].map(n=>({tipo:"vendavel",quadra:"1",numero:String(n),areaM2:200})),kpis:{lotesVendaveis:3,areaVendavelM2:600,aproveitamento:0.6,vgv:60000}};
let source={massaCenariosJson:JSON.stringify({params:{precoM2Lote:100},cenarios:[c]}),cenarioEscolhidoId:"A",areaM2:1000,semKml:false,lotesAvulsosJson:null};
beforeAll(async()=>{
 await pg.exec(`CREATE TABLE leads(id text primary key);CREATE TABLE estudo_unidades(id text primary key,"estudoId" text,codigo varchar(120),"codigoChave" varchar(120),tipo varchar(40),status varchar(20) DEFAULT 'disponivel',comprador text,"valorVenda" numeric(15,2),"criadoEm" timestamp DEFAULT now(),"atualizadoEm" timestamp,UNIQUE("estudoId","codigoChave"));CREATE TABLE estudo_unidades_eventos(id text primary key,"unidadeId" text REFERENCES estudo_unidades(id),"statusAnterior" text,"statusNovo" text,"usuarioId" text,"criadoEm" timestamp DEFAULT now());`);
 const m=readFileSync(new URL("../../../prisma/migrations/20261027190000_unidades_cenario/migration.sql",import.meta.url),"utf8");await pg.exec(m);await pg.exec(m);
 mocks.buscar.mockImplementation(async()=>source);
 mocks.raw.mockImplementation(async(strings:TemplateStringsArray,...values:unknown[])=>{let sql=strings[0];values.forEach((_,i)=>{sql+=`$${i+1}`+strings[i+1];});return(await pg.query(sql,values)).rows;});
});
afterAll(()=>pg.close());
it("gera três unidades uma vez, com preço do cenário e eventos",async()=>{
 expect(await sincronizarUnidadesCenario("s","admin")).toEqual({geradas:3});expect(await sincronizarUnidadesCenario("s","admin")).toEqual({geradas:0});
 expect((await pg.query('SELECT codigo,"valorVenda" FROM estudo_unidades ORDER BY codigo')).rows[0]).toMatchObject({codigo:"Q1 / L1",valorVenda:"20000.00"});
});
it("não altera vendidos ou reservados nem recria excluídos",async()=>{
 await pg.exec(`UPDATE estudo_unidades SET status='vendida',comprador='Cliente',"valorVenda"=23000 WHERE codigo='Q1 / L1';UPDATE estudo_unidades SET status='reservada' WHERE codigo='Q1 / L2';UPDATE estudo_unidades SET "excluidoEm"=now() WHERE codigo='Q1 / L3';`);
 source={...source,cenarioEscolhidoId:"B",massaCenariosJson:JSON.stringify({params:{precoM2Lote:200},cenarios:[{...c,id:"B"}]})};
 expect(await sincronizarUnidadesCenario("s","admin")).toEqual({geradas:0});
 const rows=(await pg.query<{status:string;comprador:string|null;valorVenda:string;excluidoEm:string|null;revisao:number}>('SELECT status,comprador,"valorVenda","excluidoEm",revisao FROM estudo_unidades ORDER BY codigo')).rows;
 expect(rows).toHaveLength(3);expect(rows[0]).toMatchObject({status:"vendida",comprador:"Cliente",valorVenda:"23000.00",revisao:1});expect(rows[1].status).toBe("reservada");expect(rows[2].excluidoEm).toBeTruthy();
});
