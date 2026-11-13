import { expect, it } from "vitest";
import { configFontes, defaultsForm, montarViabilidade, sincronizarUrbanismo } from "../incorporacao/premissas-loteamento";
import { marketingDoSistema } from "../incorporacao/composicao-custos";
import { lerLinhasOrcamento, matrizOrcamentoAtualizado } from "../incorporacao/orcamento-importacao";
import * as XLSX from "xlsx";

it("Correção 09: marketing do sistema soma fornecedores elegíveis + material publicitário, sem duplicar, e preserva o manual", () => {
 const estudo = { areaM2: 1000, loteamentoJson: null,
  fornecedoresLancamentoJson: JSON.stringify({fornecedores:[
   {id:"1",nome:"Agência",categoria:"Agência de Publicidade",valorOrcado:100,valorContratado:80,status:"contratado"},
   {id:"2",nome:"Estande",categoria:"Estande/Decorado",valorContratado:200,status:"orcamento"},
   {id:"3",nome:"Fotos",categoria:"Fotografia/Vídeo",valorOrcado:0,valorContratado:300,status:"entregue"},
   {id:"4",nome:"Contador",categoria:"Outro",valorOrcado:999,valorContratado:0,status:"contratado"},
   {id:"5",nome:"Buffet",categoria:"Buffet/Eventos",valorOrcado:70,valorContratado:0,status:"nao_contratado"},
   {id:"1",nome:"Agência",categoria:"Agência de Publicidade",valorOrcado:100,valorContratado:80,status:"contratado"}]}),
  materialPublicitarioJson: JSON.stringify({pecas:[{id:"a",nome:"Folder",valorOrcado:50,status:"aprovado"},{id:"b",nome:"Banner",valorOrcado:25,status:"reprovado"},{id:"c",nome:"Fotos",valorOrcado:300,status:"aprovado"}]}) } as never;
 const m = marketingDoSistema(estudo);
 // 80 (contratado) + 200 (orçamento) + 300 (entregue) + 50 (folder); "Outro", não contratado, reprovado, duplicados ficam fora
 expect(m.total).toBe(630);
 expect(m.itens.map((i) => i.nome)).toEqual(["Agência","Estande","Fotos","Folder"]);
 expect(m.desconsiderados.map((d) => d.nome)).toEqual(["Contador","Buffet","Agência","Banner","Fotos"]);
 const form = {...defaultsForm(estudo), marketing:42};
 expect(configFontes(estudo, {...form, marketingFonte:"manual"}).marketingFonte).toBe("manual");
 expect(configFontes(estudo, {...form, marketingFonte:"fornecedores"}).marketingFonte).toBe("sistema");
 expect(configFontes(estudo, {...form, marketingFonte:"publicidade"}).marketingFonte).toBe("sistema");
 expect(montarViabilidade(estudo, {...form, marketingFonte:"sistema"}, [{nome:"L",quantidade:1,areaUnidadeM2:100,precoM2:1}], 0).premissas.marketing).toBe(630);
 const manual = montarViabilidade(estudo, {...form, marketingFonte:"manual"}, [{nome:"L",quantidade:1,areaUnidadeM2:100,precoM2:1}], 0);
 expect(manual.premissas.marketing).toBe(42);
 expect(sincronizarUrbanismo(estudo, {...form, marketingFonte:"sistema"}).marketing).toBe(42); // o manual nunca é sobrescrito
 expect(marketingDoSistema({...estudo as object,materialPublicitarioJson:"inválido"} as never).total).toBe(580);
});

it("Excel atualizado reabre com valores editados sem importar a linha de soma como custo", () => {
 const itens = [{descricao:"Vias",unidade:"m²",quantidade:2.5,unitario:1000,total:2500}, {descricao:"Rede",unidade:"m",quantidade:3,unitario:50.25,total:150.75}];
 const livro = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(livro,XLSX.utils.aoa_to_sheet(matrizOrcamentoAtualizado(itens)),"Orçamento");
 const reaberto = XLSX.read(XLSX.write(livro,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
 const matriz = XLSX.utils.sheet_to_json<unknown[]>(reaberto.Sheets["Orçamento"],{header:1});
 expect(matriz.at(-1)?.[4]).toBe(2650.75);
 expect(lerLinhasOrcamento(matriz,1,{descricao:0,unidade:1,quantidade:2,unitario:3,total:4})).toEqual(itens);
});
