import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({modulo:vi.fn(),buscar:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/modulos",()=>({exigirModuloAcao:m.modulo}));
vi.mock("@/lib/db",()=>({prisma:{lead:{findMany:m.buscar}}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { clientesUnidades } from "@/lib/actions/unidades-incorporacao";
beforeEach(()=>{vi.clearAllMocks();m.modulo.mockResolvedValue({id:"admin"});});
it("retorna preço negociado explícito serializado e exige CRM além de incorporação",async()=>{
 m.buscar.mockResolvedValue([{id:"c",nome:"Cliente",telefone:"99",valorNegociado:{toString:()=>"23123.45"}}]);
 expect(await clientesUnidades("Cliente")).toEqual([{id:"c",nome:"Cliente",telefone:"99",valorNegociado:"23123.45"}]);
 expect(m.modulo.mock.calls.map(c=>c[0])).toEqual(["incorporacao","crm"]);
 expect(m.buscar.mock.calls[0][0].select).toEqual({id:true,nome:true,telefone:true,valorNegociado:true});
});
it("ausência de valor cadastrado permanece ausente",async()=>{
 m.buscar.mockResolvedValue([{id:"c",nome:"Cliente",telefone:"99",valorNegociado:null}]);
 expect(await clientesUnidades()).toEqual([{id:"c",nome:"Cliente",telefone:"99",valorNegociado:null}]);
});
it("não consulta dados do CRM quando não há permissão",async()=>{
 m.modulo.mockImplementation(async(modulo:string)=>{if(modulo==="crm")throw new Error("Sem permissão");return{id:"c"};});
 expect(await clientesUnidades()).toEqual({erroAcao:"Sem permissão"});expect(m.buscar).not.toHaveBeenCalled();
});
