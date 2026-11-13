import type { EstudoData } from "@/app/admin/incorporacao/_components/incorporacao-detail";

// Paridade Prospecta (13/11): mesmo fixture de server/fixtures/estudo-2-daniel-mota.ts.
// Dados reais do estudo 2 da Prospecta ("Loteamento Morada do Bosque ( Daniel e Mota )"),
// lidos do banco em 08/11/2026 — sem nomes/contatos do proprietário. Base das Correções 09–12.
export const LOTEAMENTO_E2 = {"custoInfraModo":"manual","mixModo":"manual","urbanismoModo":"cenario","areaBrutaM2":3450.88,"pctAreaPublica":0,"pctAreaVerde":0,"pctSistemaViario":0,"pctFaixaServidao":0,"duracaoVendasMeses":12,"perfilVendas":"organico","entradaPct":20,"prazoParcelamentoMeses":1,"jurosClienteMensal":0.52,"indexacaoMensal":0.4,"vendasAVistaPct":0,"descontoAVistaPct":0,"inadimplenciaPct":0,"comissaoPctVgv":4,"despesasGeraisPctVgv":0,"impostosPctVgv":0,"taxaIncorporacaoPctVgv":0,"inicioObraMes":1,"duracaoObraMeses":12,"inicioVendasMes":1,"custoInfraM2Lote":10,"projetosLicencas":0,"marketing":4000,"registroPorUnidade":0,"contingenciaPctInfra":0,"bdiPct":0,"taxaAdministracaoObraPct":0,"manutencaoPctObra":0,"inccObraMensal":0.3,"permutaPctVgv":0,"taxaDescontoAnual":12,"urbanismoFonte":"lotes_avulsos","marketingFonte":"fornecedores","itensMix":[{"nome":"Casas smart","quantidade":12,"areaUnidadeM2":287.57,"precoM2":747.64}]};
export const ORCAMENTO_E2 = {"itens":[{"pavimento":"Torre padrão","areaM2":0,"coeficienteEquivalencia":1}],"custoM2Equivalente":2500,"passivoAmbiental":0,"decoracaoEquipamentos":0,"projetos":0,"previsaoInfra":0,"outros":0,"metodo":"infraestrutura","areaReferenciaM2":3450.88,"infraestrutura":[{"descricao":"Terraplanagem","unidade":"m²","quantidade":3450.88,"unitario":4,"total":13803.52},{"descricao":"Infraestrutura por lote","unidade":"un","quantidade":12,"unitario":500,"total":6000},{"descricao":"Obras residenciais","unidade":"un","quantidade":12,"unitario":100000,"total":1200000}]};
export const BUSINESS_PLAN_E2 = {"fontes":[{"id":"b8m9e8iqzkt","nome":"Novo investidor","capitalAportado":100000,"remuneracaoPct":1,"periodoRemuneracao":"mensal","prazoResgateMeses":24}]};
export const FORNECEDORES_E2 = {"fornecedores":[{"id":"kvoeya7u44e","categoria":"Agência de Publicidade","nome":"Jesse","valorOrcado":4000,"valorContratado":4000,"status":"orcamento"}]};
export const MATERIAL_E2 = {"pecas":[{"id":"wexg17m0tzo","tipo":"Site","nome":"Videos para Insta","status":"em_aprovacao","valorOrcado":100}]};
export const NEGOCIACAO_E2 = {"proprietarioNome":"Proprietário","proprietarioContato":"","propostas":[{"id":"942o1lrjgpd","data":"2026-01-05","autor":"grupo","tipo":"compra_parcelada","status":"aceita","valorTotal":180000,"prazoParcelamentoMeses":12}]};
export const LOTES_AVULSOS_E2 = [["1",300,12,25],["2",250,10,25],["22",304.09,9.63,25],["23",304.09,9.63,25],["24",304.09,9.63,25],["25",304.09,9.63,25],["26",304.09,9.63,25],["27",304.09,9.63,25],["28",304.09,9.63,25],["41",250,10,25],["42",250,10,25],["43",272.25,16.5,19.5]]
  .map(([lote, areaM2, testadaM, profundidadeM], i) => ({ id: `l${i}`, quadra: "D", lote, areaM2, testadaM, profundidadeM }));

/** Estudo 2 no formato EstudoData do Santa Fé (campos com os nomes daqui). */
export const estudoE2 = (extra: Partial<EstudoData> = {}): EstudoData => ({
  id: "2", nome: "Loteamento Morada do Bosque ( Daniel e Mota )", municipio: "Imperatriz", estado: "MA", status: "in_progress",
  responsavel: null, semKml: true, lotesAvulsosJson: JSON.stringify(LOTES_AVULSOS_E2),
  kmlUrl: null, geojson: null, areaM2: 0, perimetroM: 0, centroLat: null, centroLng: null, appAreaM2: null, appLarguraM: null, appOrigem: null,
  elevacaoJson: null, levantamentoUrl: null, parametrosJson: null, potencialJson: null, urbanismoParecer: null, pesquisaCidadeJson: null,
  estudoMercadoJson: null, precificacaoComparaveisJson: null, pesquisaPrimariaJson: null, quadroAreasJson: null,
  orcamentoParametrizadoJson: JSON.stringify(ORCAMENTO_E2), businessPlanJson: JSON.stringify(BUSINESS_PLAN_E2),
  negociacaoTerrenoJson: JSON.stringify(NEGOCIACAO_E2), projetistasJson: null, aprovacaoProjetoJson: null, registroIncorporacaoJson: null,
  orcamentoPreliminarJson: null, planejamentoLancamentoJson: null, fornecedoresLancamentoJson: JSON.stringify(FORNECEDORES_E2),
  materialPublicitarioJson: JSON.stringify(MATERIAL_E2), lancamentoImobiliarioJson: null, projetosExecutivosJson: null, orcamentoObraJson: null,
  cronogramaObraJson: null, atendimentoClientesJson: null, massaCenariosJson: null, cenarioEscolhidoId: null, mixJson: null, viabilidadeJson: null,
  parecerIa: null, loteamentoJson: JSON.stringify(LOTEAMENTO_E2), relatorios: "[]",
  ...extra,
});
