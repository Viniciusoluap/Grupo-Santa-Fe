import { describe, expect, it } from "vitest";
import { defaultsForm, sincronizarUrbanismo, appDaViabilidade, paraMotor, montarPremissasLoteamento } from "@/lib/incorporacao/premissas-loteamento";
import { calcularCenarios } from "@/lib/finance/loteamento";

const quadro = { areaBrutaM2: 10000, areaInstitucionalM2: 1000, areaVerdeM2: 500, sistemaViarioM2: 2000, appM2: 300, faixaServidaoM2: 100, faixaTransmissaoM2: 100, supressaoVegetalM2: 100, outrasNaoParcelaveisM2: 100, areaPublicaTotalM2: 3500, areaLiquidaVendavelM2: 5800 };
const cenario = { id: "A", lotes: [], kpis: { lotesVendaveis: 29, areaVendavelM2: 5800, aproveitamento: 0.58, vgv: 2900000 }, quadroAreas: quadro };
const estudo = { areaM2: 10000, appAreaM2: 900, loteamentoJson: null, massaCenariosJson: JSON.stringify([cenario]), cenarioEscolhidoId: "A" } as never;

describe("20 — Viabilidade sincronizada com cenário salvo", () => {
 it("não desconta área pública, verde e viário duas vezes e inclui todas as restrições", () => {
   const form = sincronizarUrbanismo(estudo, defaultsForm(estudo));
   expect(form).toMatchObject({ urbanismoModo: "cenario", urbanismoFonte: "A", areaBrutaM2: 10000, pctAreaPublica: 10, pctAreaVerde: 5, pctSistemaViario: 20, pctFaixaServidao: 4 });
   expect(appDaViabilidade(estudo, form)).toBe(300);
   const r = calcularCenarios(paraMotor(form, [{ nome: "Lotes", quantidade: 29, areaUnidadeM2: 200, precoM2: 500 }], 0.03));
   expect(r.ideal.urbanistico.areaVendavelM2).toBeCloseTo(5800, 6);
 });
 it("troca de cenário atualiza automático e preserva ajustes manuais e legados", () => {
   const form = sincronizarUrbanismo(estudo, defaultsForm(estudo));
   const outro = { ...estudo as object, cenarioEscolhidoId: "B", massaCenariosJson: JSON.stringify([{ ...cenario, id: "B", quadroAreas: { ...quadro, areaInstitucionalM2: 2000 } }]) } as never;
   expect(sincronizarUrbanismo(outro, form).pctAreaPublica).toBe(20);
   expect(sincronizarUrbanismo(outro, { ...form, urbanismoModo: "manual", pctAreaPublica: 17 }).pctAreaPublica).toBe(17);
   const legado = { ...estudo as object, loteamentoJson: JSON.stringify({ pctAreaPublica: 13 }) } as never;
   expect(defaultsForm(legado).urbanismoModo).toBe("manual");
 });
 it("reconstitui no relatório a mesma base salva da tela", () => {
   const form = sincronizarUrbanismo(estudo, defaultsForm(estudo));
   const salvo = { ...estudo as object, loteamentoJson: JSON.stringify(form) } as never;
   expect(montarPremissasLoteamento(salvo)).toMatchObject({ pctAreaPublica: 0.1, pctAreaVerde: 0.05, pctSistemaViario: 0.2, pctAPP: 0.03, pctFaixaServidao: 0.04 });
 });
});
