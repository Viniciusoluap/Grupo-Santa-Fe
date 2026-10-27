import { describe, expect, it } from "vitest";
import { lerLinhasOrcamento, numeroOrcamento } from "@/lib/incorporacao/orcamento-importacao";
import { calcularOrcamentoParametrizado, type PremissasOrcamentoParametrizado } from "@/lib/orcamento/parametrizado";
const mapa = { descricao: 0, unidade: 1, quantidade: 2, unitario: 3, total: 4 };
it("lê o mapeamento escolhido, valores BRL e cache de fórmula sem duplicar totais", () => {
 const linhas = lerLinhasOrcamento([["Descrição", "Unidade", "Quantidade", "Preço", "Total"], ["Pavimentação", "m²", "2,50", "1.000,00", 2500], ["Rede", "m", 3, 50, null], ["Subtotal", null, null, null, 2650], ["Total geral", null, null, null, 2650]], 1, mapa, { E2: "C2*D2" });
 expect(linhas).toHaveLength(2); expect(linhas[0]).toMatchObject({ quantidade: 2.5, unitario: 1000, total: 2500, formula: "C2*D2" }); expect(linhas[1].total).toBe(150);
 expect(numeroOrcamento("R$ 1.234,56")).toBe(1234.56); expect(numeroOrcamento("12.50")).toBe(12.5);
 expect(numeroOrcamento(-100)).toBe(0); expect(numeroOrcamento("não calculado")).toBe(0);
 expect(lerLinhasOrcamento([["A"], ["B"]], 1, { ...mapa, descricao: -1 })).toEqual([]);
});
it("infraestrutura usa totais dos itens e área só como referência, sem simular construção", () => {
 const p = { metodo: "infraestrutura", areaReferenciaM2: 1000, infraestrutura: [{ descricao: "Vias", unidade: "m²", quantidade: 10, unitario: 20, total: 200 }], itens: [{ pavimento: "Legado", areaM2: 1000, coeficienteEquivalencia: 1 }], custoM2Equivalente: 2500, projetos: 999 } as PremissasOrcamentoParametrizado;
 expect(calcularOrcamentoParametrizado(p)).toMatchObject({ areaTotalM2: 1000, areaEquivalenteTotalM2: 0, custoTotal: 200, custoM2Real: 0.2 });
 const salvo = { ...p, metodo: "excel", importacaoExcel: { nome: "orcamento.xlsx", originalBase64: "b3JpZ2luYWw=", aba: "Custos", importadoEm: "2026-10-27", mapeamento: mapa, itens: [{ descricao: "Rede", unidade: "m", quantidade: 3, unitario: 100, total: 300, formula: "C2*D2" }] } } as PremissasOrcamentoParametrizado;
 const volta = JSON.parse(JSON.stringify(salvo)); expect(volta.importacaoExcel.originalBase64).toBe("b3JpZ2luYWw="); expect(calcularOrcamentoParametrizado(volta).custoTotal).toBe(300);
});
