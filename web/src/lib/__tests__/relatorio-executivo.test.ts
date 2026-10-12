import { describe, expect, it } from "vitest";
import { montarRelatorioExecutivo, temDado } from "@/lib/incorporacao/relatorio-executivo";
import type { EstudoData } from "@/app/admin/incorporacao/_components/incorporacao-detail";

// Lote 6 — Relatório Executivo de Incorporação: toda seção, quando o dado
// existe, retorna `{ dado }`; quando não existe, retorna `{ pendencia }`
// explícita — nunca lança exceção, nunca "desaparece" silenciosamente.

function baseEstudo(overrides: Partial<EstudoData> = {}): EstudoData {
  return {
    id: "estudo-1",
    nome: "Residencial Teste",
    municipio: "Belém",
    estado: "PA",
    status: "em_estudo",
    responsavel: null,
    kmlUrl: null,
    geojson: null,
    areaM2: 0,
    perimetroM: 0,
    centroLat: null,
    centroLng: null,
    appAreaM2: null,
    appLarguraM: null,
    appOrigem: null,
    elevacaoJson: null,
    levantamentoUrl: null,
    parametrosJson: null,
    potencialJson: null,
    urbanismoParecer: null,
    pesquisaCidadeJson: null,
    estudoMercadoJson: null,
    precificacaoComparaveisJson: null,
    pesquisaPrimariaJson: null,
    quadroAreasJson: null,
    orcamentoParametrizadoJson: null,
    businessPlanJson: null,
    negociacaoTerrenoJson: null,
    projetistasJson: null,
    aprovacaoProjetoJson: null,
    registroIncorporacaoJson: null,
    orcamentoPreliminarJson: null,
    planejamentoLancamentoJson: null,
    fornecedoresLancamentoJson: null,
    materialPublicitarioJson: null,
    lancamentoImobiliarioJson: null,
    projetosExecutivosJson: null,
    orcamentoObraJson: null,
    cronogramaObraJson: null,
    atendimentoClientesJson: null,
    massaCenariosJson: null,
    cenarioEscolhidoId: null,
    mixJson: null,
    viabilidadeJson: null,
    parecerIa: null,
    loteamentoJson: null,
    relatorios: "[]",
    ...overrides,
  };
}

const GERADO_EM = new Date("2026-10-12T15:30:00.000Z");

describe("montarRelatorioExecutivo — terreno", () => {
  it("pendência quando não há mapa desenhado", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.terreno)).toBe(false);
    if (!temDado(m.terreno)) expect(m.terreno.pendencia).toMatch(/Terreno ainda não delimitado/);
  });

  it("dado presente quando há geojson + área, com pendência de APP embutida se faltar", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({ geojson: '{"type":"Feature"}', areaM2: 50_000, perimetroM: 1200 }),
      GERADO_EM
    );
    expect(temDado(m.terreno)).toBe(true);
    if (temDado(m.terreno)) {
      expect(m.terreno.dado.areaM2).toBe(50_000);
      expect(m.terreno.dado.appPendencia).toMatch(/APP automática ainda não calculada/);
    }
  });

  it("sem pendência de APP quando appAreaM2 já foi calculada", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({ geojson: '{"type":"Feature"}', areaM2: 50_000, appAreaM2: 1200 }),
      GERADO_EM
    );
    if (temDado(m.terreno)) expect(m.terreno.dado.appPendencia).toBeNull();
  });
});

describe("montarRelatorioExecutivo — dados cadastrais/urbanísticos", () => {
  it("pendência quando parametros/potencial/parecer ausentes", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.dadosCadastrais)).toBe(false);
  });

  it("dado presente quando parametrosJson existe, mas sempre lista matrícula/CAR/zoneamento como pendência", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({ parametrosJson: JSON.stringify({ coefAproveitamento: 1.5 }) }),
      GERADO_EM
    );
    expect(temDado(m.dadosCadastrais)).toBe(true);
    if (temDado(m.dadosCadastrais)) {
      expect(m.dadosCadastrais.dado.matriculaPendencia).toMatch(/Matrícula/);
      expect(m.dadosCadastrais.dado.carPendencia).toMatch(/CAR/);
      expect(m.dadosCadastrais.dado.zoneamentoOficialPendencia).toMatch(/Zoneamento oficial/);
    }
  });

  it("JSON corrompido nunca lança exceção", () => {
    expect(() =>
      montarRelatorioExecutivo(baseEstudo({ parametrosJson: "{invalido" }), GERADO_EM)
    ).not.toThrow();
  });
});

describe("montarRelatorioExecutivo — mercado/referências", () => {
  it("pendência quando nada foi pesquisado", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.mercado)).toBe(false);
  });

  it("dado presente quando há pesquisa de cidade", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({ pesquisaCidadeJson: JSON.stringify({ populacao: 500_000, resumo: "Cidade em crescimento." }) }),
      GERADO_EM
    );
    expect(temDado(m.mercado)).toBe(true);
    if (temDado(m.mercado)) {
      expect(m.mercado.dado.cidade?.populacao).toBe(500_000);
      expect(m.mercado.dado.fontesPendencia).toMatch(/não constam/);
    }
  });

  it("preserva fontes da pesquisa salva e mantém lacuna explícita nos estudos legados", () => {
    const atual = montarRelatorioExecutivo(baseEstudo({
      estudoMercadoJson: JSON.stringify({ precoM2Lote: 250, fontes: ["IBGE", "Prefeitura"], confiabilidade: "média" }),
    }), GERADO_EM);
    expect(temDado(atual.mercado)).toBe(true);
    if (temDado(atual.mercado)) {
      expect(atual.mercado.dado.fontes).toEqual(["IBGE", "Prefeitura"]);
      expect(atual.mercado.dado.fontesPendencia).toBeNull();
    }
    expect(temDado(atual.premissasFontesVersao.fontesPesquisaMercado)).toBe(true);
    const legado = montarRelatorioExecutivo(baseEstudo({ estudoMercadoJson: JSON.stringify({ precoM2Lote: 250 }) }), GERADO_EM);
    expect(temDado(legado.premissasFontesVersao.fontesPesquisaMercado)).toBe(false);
  });

  it("dado presente quando há pesquisa primária com entrevistados", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({
        pesquisaPrimariaJson: JSON.stringify({
          entrevistados: [
            {
              id: "1",
              nome: "Fulano",
              faixaEtaria: "26-35",
              faixaRenda: "4_8sm",
              temImovelProprio: false,
              interesseComprar12Meses: true,
              tiposInteresse: ["lote"],
              notaApartamento: 0,
              notaCasaCondominio: 0,
              notaCasaRuaAberta: 4,
              tamanhoIdealM2: 250,
              quartosNecessarios: 3,
              itensImportancia: {},
            },
          ],
        }),
      }),
      GERADO_EM
    );
    expect(temDado(m.mercado)).toBe(true);
    if (temDado(m.mercado)) expect(m.mercado.dado.pesquisaPrimaria?.totalEntrevistados).toBe(1);
  });
});

describe("montarRelatorioExecutivo — estudo de massa/cenários", () => {
  it("pendência quando não há cenário gerado", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.massa)).toBe(false);
  });

  it("dado presente usa o cenário escolhido quando existe", () => {
    const cenarios = [
      { id: "a", testadaLoteM: 10, profundidadeLoteM: 25, larguraViaM: 12, kpis: { lotesVendaveis: 100, areaVendavelM2: 40_000, aproveitamento: 0.6, vgv: 20_000_000 } },
      { id: "b", testadaLoteM: 12, profundidadeLoteM: 30, larguraViaM: 14, kpis: { lotesVendaveis: 80, areaVendavelM2: 38_000, aproveitamento: 0.55, vgv: 18_000_000 } },
    ];
    const m = montarRelatorioExecutivo(
      baseEstudo({ massaCenariosJson: JSON.stringify({ cenarios }), cenarioEscolhidoId: "b" }),
      GERADO_EM
    );
    expect(temDado(m.massa)).toBe(true);
    if (temDado(m.massa)) expect(m.massa.dado.cenario.id).toBe("b");
  });
});

describe("montarRelatorioExecutivo — quadro de áreas", () => {
  it("pendência quando não há itens cadastrados", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.quadroAreas)).toBe(false);
  });

  it("dado presente calcula o resultado a partir dos itens salvos", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({
        areaM2: 10_000,
        quadroAreasJson: JSON.stringify({
          coeficienteAproveitamento: 2,
          itens: [
            {
              pavimento: "Térreo",
              areaConstCobertaM2: 500,
              areaConstDescobertaM2: 0,
              areaUrbanizadaM2: 0,
              areaDescontarM2: 0,
              areaComputavelM2: 500,
              areaPrivativaM2: 400,
            },
          ],
        }),
      }),
      GERADO_EM
    );
    expect(temDado(m.quadroAreas)).toBe(true);
    if (temDado(m.quadroAreas)) expect(m.quadroAreas.dado.resultado.areaComputavelTotalM2).toBe(500);
  });
});

describe("montarRelatorioExecutivo — mix de produtos / custos-receitas-VGV / indicadores financeiros", () => {
  it("pendência nas três seções quando não há viabilidade (nem atual nem legada)", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.mixProdutos)).toBe(false);
    expect(temDado(m.custosReceitasVgv)).toBe(false);
    expect(temDado(m.indicadoresFinanceiros)).toBe(false);
  });

  it("dado presente (motor atual) quando loteamentoJson existe", () => {
    const m = montarRelatorioExecutivo(baseEstudo({ loteamentoJson: JSON.stringify({}) }), GERADO_EM);
    expect(temDado(m.mixProdutos)).toBe(true);
    expect(temDado(m.custosReceitasVgv)).toBe(true);
    expect(temDado(m.indicadoresFinanceiros)).toBe(true);
    if (temDado(m.custosReceitasVgv)) expect(m.custosReceitasVgv.dado.modo).toBe("motor_atual");
    if (temDado(m.indicadoresFinanceiros)) {
      expect(m.indicadoresFinanceiros.dado.modo).toBe("motor_atual");
      expect(m.indicadoresFinanceiros.dado.fluxo.length).toBeGreaterThan(0);
    }
  });

  it("custos-receitas-VGV e indicadores financeiros caem para o modo legado (EVE) quando só há viabilidadeJson", () => {
    const legado = {
      resultado: {
        vgv: 1_000_000,
        custoTerreno: 100_000,
        custoTotal: 600_000,
        lucroBruto: 400_000,
        margemLiquida: 0.4,
        vpl: 300_000,
        tir: 0.01,
        paybackMes: 18,
        exposicaoMaxima: 50_000,
        fluxo: [
          { mes: 0, receitas: 0, custosObra: 10_000, custoTerreno: 0, indiretos: 0, comissao: 0, saldoMes: -10_000, saldoAcumulado: -10_000 },
        ],
      },
    };
    const m = montarRelatorioExecutivo(baseEstudo({ viabilidadeJson: JSON.stringify(legado) }), GERADO_EM);
    expect(temDado(m.custosReceitasVgv)).toBe(true);
    if (temDado(m.custosReceitasVgv)) {
      expect(m.custosReceitasVgv.dado.modo).toBe("legado");
      if (m.custosReceitasVgv.dado.modo === "legado") expect(m.custosReceitasVgv.dado.vgv).toBe(1_000_000);
    }
    expect(temDado(m.indicadoresFinanceiros)).toBe(true);
    if (temDado(m.indicadoresFinanceiros)) {
      expect(m.indicadoresFinanceiros.dado.modo).toBe("legado");
      expect(m.indicadoresFinanceiros.dado.fluxo).toHaveLength(1);
    }
    // Mix de produtos não existe no formato legado (produto único) — pendência explícita, não omissão.
    expect(temDado(m.mixProdutos)).toBe(false);
  });

  it("viabilidadeJson corrompido nunca lança exceção e vira pendência", () => {
    expect(() => montarRelatorioExecutivo(baseEstudo({ viabilidadeJson: "{quebrado" }), GERADO_EM)).not.toThrow();
    const m = montarRelatorioExecutivo(baseEstudo({ viabilidadeJson: "{quebrado" }), GERADO_EM);
    expect(temDado(m.custosReceitasVgv)).toBe(false);
  });
});

describe("montarRelatorioExecutivo — impostos/comissões/permutas", () => {
  it("pendência quando não há premissas do motor atual", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.impostosComissoesPermutas)).toBe(false);
  });

  it("pendência mesmo com estudo legado (percentuais não extraídos do formato antigo)", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({ viabilidadeJson: JSON.stringify({ resultado: { vgv: 1, custoTerreno: 1, custoTotal: 1, lucroBruto: 1, margemLiquida: 0, vpl: 1, tir: 0, paybackMes: 1, exposicaoMaxima: 1 } }) }),
      GERADO_EM
    );
    expect(temDado(m.impostosComissoesPermutas)).toBe(false);
  });

  it("dado presente quando há premissas do motor atual, rotulado como estimativa", () => {
    const m = montarRelatorioExecutivo(baseEstudo({ loteamentoJson: JSON.stringify({}) }), GERADO_EM);
    expect(temDado(m.impostosComissoesPermutas)).toBe(true);
    if (temDado(m.impostosComissoesPermutas)) {
      expect(m.impostosComissoesPermutas.dado.observacao).toMatch(/estimativa baseada nas premissas/i);
      expect(m.impostosComissoesPermutas.dado.comissaoValor).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("montarRelatorioExecutivo — negociações/proposta aceita", () => {
  it("pendência quando não há propostas registradas", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.negociacao)).toBe(false);
  });

  it("dado presente reflete a proposta aceita", () => {
    const dados = {
      proprietarioNome: "José",
      proprietarioContato: "11999999999",
      propostas: [
        { id: "1", data: "2026-01-01", autor: "grupo_santa_fe", tipo: "compra_avista", valorTotal: 500_000, status: "aceita" },
      ],
    };
    const m = montarRelatorioExecutivo(baseEstudo({ negociacaoTerrenoJson: JSON.stringify(dados) }), GERADO_EM);
    expect(temDado(m.negociacao)).toBe(true);
    if (temDado(m.negociacao)) {
      expect(m.negociacao.dado.resumo.fechada).toBe(true);
      expect(m.negociacao.dado.proprietarioNome).toBe("José");
    }
  });
});

describe("montarRelatorioExecutivo — documentos/licenças/pendências", () => {
  it("pendência quando nada foi cadastrado", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.documentosLicencas)).toBe(false);
  });

  it("dado presente a partir do registro da incorporação", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({
        registroIncorporacaoJson: JSON.stringify({
          documentos: [{ id: "1", nome: "Certidão X", status: "pendente" }],
        }),
      }),
      GERADO_EM
    );
    expect(temDado(m.documentosLicencas)).toBe(true);
    if (temDado(m.documentosLicencas)) {
      expect(m.documentosLicencas.dado.registroIncorporacao?.pendentes).toHaveLength(1);
      expect(m.documentosLicencas.dado.aprovacaoProjeto).toBeNull();
    }
  });
});

describe("montarRelatorioExecutivo — cronograma/tarefas/responsáveis/riscos", () => {
  it("pendência quando nada foi cadastrado, mencionando os gaps estruturais", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.cronograma)).toBe(false);
    if (!temDado(m.cronograma)) {
      expect(m.cronograma.pendencia).toMatch(/sem responsável individual/);
      expect(m.cronograma.pendencia).toMatch(/Nenhum risco de execução/);
    }
  });

  it("dado presente traz o responsável do estudo como contexto geral (não por tarefa)", () => {
    const m = montarRelatorioExecutivo(
      baseEstudo({
        responsavel: "Maria Incorporadora",
        cronogramaObraJson: JSON.stringify({ medicoes: [{ id: "1", mes: 0, avancoFisicoAcumuladoPct: 50 }] }),
      }),
      GERADO_EM
    );
    expect(temDado(m.cronograma)).toBe(true);
    if (temDado(m.cronograma)) {
      expect(m.cronograma.dado.responsavelDoEstudo).toBe("Maria Incorporadora");
      expect(m.cronograma.dado.responsavelPorTarefaPendencia).toMatch(/sem responsável individual/);
      expect(m.cronograma.dado.riscosExecucaoPendencia).toMatch(/Nenhum risco de execução/);
      expect(m.cronograma.dado.cronogramaObra?.avancoFisicoAtualPct).toBe(50);
    }
  });

  it("mostra responsáveis por medição e riscos registrados sem confundir com pesquisa de mercado", () => {
    const m = montarRelatorioExecutivo(baseEstudo({
      colaboradores: [{ id: "U1", nome: "Ana" }],
      cronogramaObraJson: JSON.stringify({
        medicoes: [{ id: "M1", mes: 0, avancoFisicoAcumuladoPct: 20, responsavelId: "U1" }],
        riscos: [{ id: "R1", descricao: "Atraso de licença", impacto: "alto", mitigacao: "Protocolar cedo", responsavelId: "U1", status: "aberto" }],
      }),
    }), GERADO_EM);
    expect(temDado(m.cronograma)).toBe(true);
    if (!temDado(m.cronograma)) throw new Error("Cronograma esperado");
    expect(m.cronograma.dado.responsaveisPorTarefa).toEqual([{ tarefa: "Medição do mês 1", responsavel: "Ana" }]);
    expect(m.cronograma.dado.riscosExecucao[0].descricao).toBe("Atraso de licença");
    expect(m.cronograma.dado.riscosExecucaoPendencia).toBeNull();
  });
});

describe("montarRelatorioExecutivo — premissas/fontes/data/versão", () => {
  it("sempre retorna dado (data/hora real de geração), nunca pendência no nível da seção", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(m.premissasFontesVersao.geradoEm).toBe(GERADO_EM.toISOString());
  });

  it("premissasNumericas é pendência quando não há motor de viabilidade configurado", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.premissasFontesVersao.premissasNumericas)).toBe(false);
  });

  it("premissasNumericas lista os percentuais quando o motor está configurado", () => {
    const m = montarRelatorioExecutivo(baseEstudo({ loteamentoJson: JSON.stringify({}) }), GERADO_EM);
    expect(temDado(m.premissasFontesVersao.premissasNumericas)).toBe(true);
    if (temDado(m.premissasFontesVersao.premissasNumericas)) {
      expect(m.premissasFontesVersao.premissasNumericas.dado.length).toBeGreaterThan(0);
    }
  });

  it("versão e fontes da pesquisa de mercado são SEMPRE pendência explícita (gaps estruturais, nunca inventados)", () => {
    const m = montarRelatorioExecutivo(baseEstudo({ loteamentoJson: JSON.stringify({}) }), GERADO_EM);
    expect(temDado(m.premissasFontesVersao.versao)).toBe(false);
    expect(temDado(m.premissasFontesVersao.fontesPesquisaMercado)).toBe(false);
  });
});

describe("montarRelatorioExecutivo — parecer de IA", () => {
  it("pendência quando não há parecer salvo", () => {
    const m = montarRelatorioExecutivo(baseEstudo(), GERADO_EM);
    expect(temDado(m.parecerIa)).toBe(false);
  });

  it("dado presente quando há parecer salvo", () => {
    const m = montarRelatorioExecutivo(baseEstudo({ parecerIa: "Viável." }), GERADO_EM);
    expect(temDado(m.parecerIa)).toBe(true);
    if (temDado(m.parecerIa)) expect(m.parecerIa.dado).toBe("Viável.");
  });
});

describe("montarRelatorioExecutivo — robustez geral", () => {
  it("nunca lança exceção mesmo com todos os campos JSON corrompidos", () => {
    const corrompido = baseEstudo({
      geojson: "{quebrado",
      parametrosJson: "{quebrado",
      potencialJson: "{quebrado",
      pesquisaCidadeJson: "{quebrado",
      estudoMercadoJson: "{quebrado",
      precificacaoComparaveisJson: "{quebrado",
      pesquisaPrimariaJson: "{quebrado",
      quadroAreasJson: "{quebrado",
      negociacaoTerrenoJson: "{quebrado",
      aprovacaoProjetoJson: "{quebrado",
      registroIncorporacaoJson: "{quebrado",
      cronogramaObraJson: "{quebrado",
      planejamentoLancamentoJson: "{quebrado",
      massaCenariosJson: "{quebrado",
      loteamentoJson: "{quebrado",
      viabilidadeJson: "{quebrado",
    });
    expect(() => montarRelatorioExecutivo(corrompido, GERADO_EM)).not.toThrow();
  });
});
