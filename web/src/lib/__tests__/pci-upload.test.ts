import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { incidenciaPciParaTexto, LIMITE_PCI_BYTES, PARTE_PCI_BYTES, validarMontagemPci, validarPartePci } from "../obras/pci-validacao";
import { calcularProgresso, itensProgressoIniciais } from "../financeiro/progresso";

describe("PCI 8 MB e precisão da vinculação", () => {
  it("vincula incidências com ruído binário do Excel sem arredondar para 4 casas", () => {
    expect(incidenciaPciParaTexto(0.30000000000000004)).toBe("0.3");
    expect(incidenciaPciParaTexto(1.0000000000000002)).toBe("1");
    expect(incidenciaPciParaTexto(3.10000169920005)).toBe("3.10000169920005");
    expect(incidenciaPciParaTexto(1e-8)).toBe("0.00000001");
    const itens = itensProgressoIniciais().map(i => ({...i, incidencia:incidenciaPciParaTexto(i.chave === "complementos" ? 0.30000000000000004 : Number(i.incidencia))}));
    expect(calcularProgresso(itens).erros).toEqual([]);
    expect(() => incidenciaPciParaTexto(NaN)).toThrow();
    expect(() => incidenciaPciParaTexto(101)).toThrow();
  });
  it("aceita parte de 1 MiB e recusa dados e metadados inválidos", () => {
    const entrada={uploadId:"12345678-1234-1234-1234-123456789012",chunkIndex:0,totalChunks:8,chunk:Buffer.alloc(PARTE_PCI_BYTES).toString("base64"),nome:"PCI.xls"};
    expect(validarPartePci(entrada).totalChunks).toBe(8);
    expect(Buffer.byteLength(JSON.stringify(entrada))).toBeLessThan(4_500_000);
    for (const altera of [{totalChunks:9},{chunkIndex:8},{uploadId:"../bad"},{chunk:"%%=="},{nome:"a.exe"},{chunk:Buffer.alloc(PARTE_PCI_BYTES+1).toString("base64")}]) expect(() => validarPartePci({...entrada,...altera})).toThrow();
  });
  it("recusa montagem faltante, fora de ordem ou de outro arquivo", () => {
    const a={chunk_index:0,total_chunks:2,file_name:"PCI.xls",b64:"AA=="};
    const b={...a,chunk_index:1};
    expect(validarMontagemPci([a,b])).toBe("PCI.xls");
    expect(() => validarMontagemPci([a])).toThrow();
    expect(() => validarMontagemPci([b,a])).toThrow();
    expect(() => validarMontagemPci([a,{...b,file_name:"outro.xls"}])).toThrow();
  });
  it("migration armazena 8 MiB por partes com isolamento de dono e expiração", async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync(new URL("../../../prisma/migrations/20261020120000_pci_upload_chunks/migration.sql", import.meta.url),"utf8"));
      const original=Buffer.alloc(LIMITE_PCI_BYTES,0x5a);
      for(let i=0;i<8;i++) await db.query(`INSERT INTO pci_upload_chunks(upload_id,chunk_index,total_chunks,user_id,project_id,file_name,data) VALUES($1,$2,8,'u1','o1','PCI.xls',decode($3,'base64'))`,["upload-12345678901234567890",i,original.subarray(i*PARTE_PCI_BYTES,(i+1)*PARTE_PCI_BYTES).toString("base64")]);
      const r=await db.query<{chunk_index:number;total_chunks:number;file_name:string;b64:string}>(`SELECT chunk_index,total_chunks,file_name,encode(data,'base64') AS b64 FROM pci_upload_chunks WHERE user_id='u1' AND project_id='o1' AND created_at > now()-interval '30 minutes' ORDER BY chunk_index`);
      validarMontagemPci(r.rows);
      expect(Buffer.concat(r.rows.map(p=>Buffer.from(p.b64,"base64")))).toEqual(original);
      expect((await db.query(`SELECT * FROM pci_upload_chunks WHERE user_id='u2' AND project_id='o1'`)).rows).toEqual([]);
      await expect(db.query(`INSERT INTO pci_upload_chunks(upload_id,chunk_index,total_chunks,user_id,project_id,file_name,data) VALUES('too-big',0,1,'u1','o1','p.xls',decode($1,'base64'))`,[Buffer.alloc(PARTE_PCI_BYTES+1).toString("base64")])).rejects.toThrow();
      await db.exec(`UPDATE pci_upload_chunks SET created_at=now()-interval '31 minutes'; DELETE FROM pci_upload_chunks WHERE created_at <= now()-interval '30 minutes'`);
      expect((await db.query(`SELECT count(*)::int AS n FROM pci_upload_chunks`)).rows).toEqual([{n:0}]);
    } finally { await db.close(); }
  },30_000);
});
