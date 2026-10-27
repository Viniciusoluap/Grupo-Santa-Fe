import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({obra:vi.fn(),rascunho:vi.fn(),salvar:vi.fn(),modelos:vi.fn(),historico:vi.fn(),arquivo:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({prisma:{obra:{findUnique:m.obra},pciGeradorRascunho:{upsert:m.salvar,findUnique:m.rascunho},pciModelo:{findMany:m.modelos},pciGerada:{findMany:m.historico,findFirst:m.arquivo}}}));
vi.mock("@/lib/engenheiros",()=>({listarEngenheiros:async()=>[]}));
import { arquivoPciGerada, carregarGeradorPci, podeGerenciarModelosPci, podeUsarGeradorPci, salvarRascunhoPci } from "@/lib/obras/pci-gerador-dados";
import { formularioPciVazio } from "@/lib/pci-gerador";
beforeEach(()=>{vi.clearAllMocks();m.obra.mockResolvedValue({id:"obra"});m.modelos.mockResolvedValue([]);m.historico.mockResolvedValue([]);});
it("admin ativo gerencia modelos; colaborador usa gerador com Obras; inativos não acessam",()=>{
 for(const perfil of ["admin","colaborador","corretor","empreiteiro","cliente"]){
  const u={perfil,ativo:true,permissoes:["obras"]};
  expect(podeGerenciarModelosPci(u)).toBe(perfil==="admin");
  expect(podeUsarGeradorPci(u)).toBe(["admin","colaborador"].includes(perfil));
  expect(podeUsarGeradorPci({...u,ativo:false})).toBe(false);
  expect(podeGerenciarModelosPci({...u,ativo:false})).toBe(false);
 }
 expect(podeUsarGeradorPci({perfil:"colaborador",ativo:true,permissoes:[]})).toBe(false);
});
it("rascunho conserva dados entre gravação e recarga e informa modelo ausente",async()=>{
 const form=formularioPciVazio();form.campos.proponenteNome="Cliente preservado";
 let salvo:unknown=null;
 m.salvar.mockImplementation(async({create})=>{salvo=create.dados;});
 m.rascunho.mockImplementation(async()=>({dados:salvo,atualizadoPorId:null,atualizadoEm:new Date("2026-10-27T12:00:00Z")}));
 await salvarRascunhoPci("obra",form,"autor");
 const r=await carregarGeradorPci("obra");
 expect(r.formulario.campos.proponenteNome).toBe("Cliente preservado");expect(r.origem).toBe("rascunho");expect(r.avisoModelo).toContain("Nenhum modelo");
 m.obra.mockResolvedValue(null);
 await expect(salvarRascunhoPci("ausente",form,"autor")).rejects.toThrow("Obra não encontrada");
 expect(m.salvar).toHaveBeenCalledTimes(1);
});
it("download exige par obra/PCI e entrega os bytes originais do formato solicitado",async()=>{
 m.arquivo.mockImplementation(async({where})=>where.id==="pci"&&where.obraId==="obra"?{pdfNome:"PCI.pdf",pdf:new Uint8Array([1,2,3])}:null);
 expect(await arquivoPciGerada("outra","pci","pdf")).toBeNull();
 expect(await arquivoPciGerada("obra","pci","pdf")).toEqual({nome:"PCI.pdf",formato:"pdf",bytes:new Uint8Array([1,2,3])});
});
