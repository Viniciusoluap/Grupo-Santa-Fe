import { dadosFixosDasMedicoes, dadosPlsPadrao, ehTipoMedicao, normalizarDadosMedicao, type DadosMedicaoCaixa, type DadosPls, type TipoMedicao } from "@/lib/medicao-caixa";
import type { DadosPci } from "@/lib/caixa/pci";
import { prisma } from "@/lib/db";
import { calcularProgresso, mesclarComPadrao } from "@/lib/financeiro/progresso";
import { baseDaMedicao, estimarMedicoes, situacaoDaMedicao, type BaseMedicao, type EstimativaMedicao, type SituacaoMedicao } from "@/lib/financeiro/medicoes";
import { centavosDe } from "@/lib/financeiro/obra";

// EPIC-020 Lote 4 (item 27) — leitura do progresso por incidência, no mesmo
// formato do `obraProgresso.obter` da Prospecta. Decimais viram texto.

export type ProgressoObraDados = {
  itens: { chave: string; incidencia: string; execucao: string }[];
  medido: boolean;
  pci?: { arquivo: string; enviadaEm: string; vinculadaEm: string | null; formato: "xls" | "xlsb"; proponente: string; prazoMeses: number | null } | null;
  plsPadrao?: DadosPls;
  /** Valor antigo digitado à mão (só exibido enquanto não houver medição). */
  progressoLegado: number;
  /** Pedido de 18/10: Y = (financiado + FGTS + subsídio) − terreno. */
  baseMedicao: BaseMedicao;
  fotosLegadas?: { id: string; imageUrl: string; caption: string | null; includeInReport: boolean }[];
  historico: {
    id: string;
    tipo?: TipoMedicao;
    dadosCaixa?: DadosMedicaoCaixa;
    fotos?: { id: string; imageUrl: string; caption: string | null; includeInReport?: boolean }[];
    progresso: number;
    somaIncidencia: number;
    criadoEm: string;
    autor: string | null;
    itens: { chave: string; incidencia: string; execucao: string }[];
    situacao: SituacaoMedicao;
    emailPodeReenviar?: boolean;
    emailStatus?: string | null;
    emailTentativaEm?: string | null;
    solicitadaEm: string | null;
    solicitadaPor: string | null;
    recebidaEm: string | null;
    recebidaPor: string | null;
    editadaEm: string | null;
    estimativa: EstimativaMedicao;
  }[];
};

export async function carregarProgressoObra(obraId: string): Promise<ProgressoObraDados | null> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: {
      progresso: true,
      financiamentoCef: true,
      fgts: true,
      subsidio: true,
      custoTerreno: true,
      progressoItens: true,
      fotos: { where: { medicaoId: null }, select: { id: true, legenda: true, incluirNoRelatorio: true } },
      pci: { include: { versao: { select: { nome: true, parsed: true } } } },
      progressoHistorico: { orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 101, include: { fotos: { select: { id: true, legenda: true, incluirNoRelatorio: true }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }] } } },
    },
  });
  if (!obra) return null;
  const pci = obra.pci;
  const parsed = pci?.versao.parsed as unknown as DadosPci | undefined;
  const historicoExibido = obra.progressoHistorico.slice(0, 100);
  // O histórico exibido é limitado a 100, mas o alvará pode ter sido preenchido
  // numa medição anterior. Consultar apenas os dados PLS da mesma obra.
  const [autores, medicoesPls] = await Promise.all([
    prisma.usuario.findMany({
      where: { id: { in: obra.progressoHistorico.flatMap((h) => [h.criadoPorId, h.solicitadaPorId, h.recebidaPorId]).filter((x): x is string => !!x) } },
      select: { id: true, nome: true },
    }),
    prisma.obraProgressoHistorico.findMany({
      where: { obraId, tipo: "pls" },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      select: { tipo: true, dadosCaixa: true },
    }),
  ]);
  const nome = new Map(autores.map((a) => [a.id, a.nome]));
  const itens = mesclarComPadrao(
    obra.progressoItens.map((i) => ({ chave: i.chave, incidencia: i.incidencia.toString(), execucao: i.execucao.toString() }))
  );
  // Pedido de 18/10: valor estimado de cada medição (Y × avanço da medição).
  const txt = (v: { toString(): string } | null) => (v === null ? null : v.toString());
  const base = baseDaMedicao({
    financiamento: centavosDe(txt(obra.financiamentoCef)),
    fgts: centavosDe(txt(obra.fgts)),
    subsidio: centavosDe(txt(obra.subsidio)),
    custoTerreno: centavosDe(txt(obra.custoTerreno)),
  });
  const estimativas = estimarMedicoes(obra.progressoHistorico.map((h) => ({ id: h.id, progresso: Number(h.progresso), criadoEm: h.criadoEm })), base);
  const quem = (id: string | null) => (id ? nome.get(id) ?? null : null);
  return {
    itens: itens.map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
    medido: obra.progressoItens.length > 0,
    pci: pci && parsed ? { arquivo: pci.versao.nome, enviadaEm: pci.enviadaEm.toISOString(), vinculadaEm: pci.vinculadaEm?.toISOString() ?? null, formato: parsed.formato, proponente: parsed.identificacao.proponente, prazoMeses: parsed.prazoMeses } : null,
    plsPadrao: dadosPlsPadrao({
      // H6 (23/10): alvará, nº do contrato, valor do imóvel e contratação — informados 1x por obra.
      ...dadosFixosDasMedicoes(
        medicoesPls.filter((m) => m.tipo === "pls").map((m) => ({ pls: (m.dadosCaixa as DadosMedicaoCaixa | null)?.pls ?? null })),
        parsed ? { alvaraEmissao: parsed.alvaraEmissao, alvaraVigencia: parsed.alvaraVigencia, contrato: parsed.contrato, valorImovel: parsed.valorImovel, dataContratacao: parsed.dataContratacao } : {},
      ),
      seloCasaAzul: parsed?.seloCasaAzul,
    }),
    progressoLegado: obra.progresso,
    baseMedicao: base,
    fotosLegadas: obra.fotos.map(f => ({ id: f.id, caption: f.legenda, includeInReport: f.incluirNoRelatorio, imageUrl: `/api/obras/fotos/${f.id}` })),
    historico: historicoExibido.map((h) => ({
      id: h.id,
      tipo: ehTipoMedicao(h.tipo) ? h.tipo : "pls",
      dadosCaixa: normalizarDadosMedicao(ehTipoMedicao(h.tipo) ? h.tipo : "pls", h.dadosCaixa),
      fotos: (h.fotos ?? []).map(f => ({ id: f.id, caption: f.legenda, includeInReport: f.incluirNoRelatorio, imageUrl: `/api/obras/fotos/${f.id}` })),
      progresso: Number(h.progresso),
      somaIncidencia: Number(h.somaIncidencia),
      criadoEm: h.criadoEm.toISOString(),
      autor: quem(h.criadoPorId),
      itens: mesclarComPadrao(Array.isArray(h.itens) ? (h.itens as { chave: string; incidencia: string; execucao: string }[]) : [])
        .map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
      situacao: situacaoDaMedicao(h),
      emailPodeReenviar: ["failed", "pending"].includes(h.emailSolicitacaoStatus ?? "") || (h.emailSolicitacaoStatus === "sending" && !!h.emailSolicitacaoTentativaEm && Date.now() - h.emailSolicitacaoTentativaEm.getTime() > 120_000),
      emailStatus: h.emailSolicitacaoStatus,
      emailTentativaEm: h.emailSolicitacaoTentativaEm?.toISOString() ?? null,
      solicitadaEm: h.solicitadaEm?.toISOString() ?? null,
      solicitadaPor: quem(h.solicitadaPorId),
      recebidaEm: h.recebidaEm?.toISOString() ?? null,
      recebidaPor: quem(h.recebidaPorId),
      editadaEm: h.editadaEm?.toISOString() ?? null,
      estimativa: estimativas.get(h.id)!,
    })),
  };
}

export function calculoDoProgresso(p: ProgressoObraDados) {
  return calcularProgresso(p.itens);
}
