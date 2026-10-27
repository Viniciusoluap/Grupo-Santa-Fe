import { expect, it } from "vitest";
import { defaultsForm, marketingDoLancamento, sincronizarUrbanismo } from "../incorporacao/premissas-loteamento";
import { lerLinhasOrcamento, matrizOrcamentoAtualizado } from "../incorporacao/orcamento-importacao";
import * as XLSX from "xlsx";

it("custo de lançamento usa uma fonte explícita, inclui todos os orçamentos e preserva ajuste manual", () => {
 const estudo = { areaM2: 1000, loteamentoJson: null,
  fornecedoresLancamentoJson: JSON.stringify({fornecedores:[{valorOrcado:100,valorContratado:80,status:"contratado"},{valorContratado:200,status:"orcamento"},{valorOrcado:0,valorContratado:300,status:"entregue"}]}),
  materialPublicitarioJson: JSON.stringify({pecas:[{valorOrcado:50,status:"aprovado"},{valorOrcado:25,status:"reprovado"}]}) } as never;
 const form = {...defaultsForm(estudo), marketing:42};
 expect(marketingDoLancamento(estudo, "fornecedores")).toBe(300);
 expect(marketingDoLancamento(estudo, "publicidade")).toBe(75);
 expect(sincronizarUrbanismo(estudo, {...form,marketingFonte:"fornecedores"}).marketing).toBe(300);
 expect(sincronizarUrbanismo(estudo, {...form,marketingFonte:"publicidade"}).marketing).toBe(75);
 expect(sincronizarUrbanismo(estudo, {...form,marketingFonte:"manual"}).marketing).toBe(42);
 expect(sincronizarUrbanismo(estudo, form).marketing).toBe(42);
 const alterado = {...estudo as object, fornecedoresLancamentoJson:JSON.stringify({fornecedores:[{valorOrcado:450}]})} as never;
 expect(sincronizarUrbanismo(alterado, {...form,marketingFonte:"fornecedores"}).marketing).toBe(450);
 expect(marketingDoLancamento({...estudo as object,materialPublicitarioJson:"inválido"} as never,"publicidade")).toBe(0);
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
