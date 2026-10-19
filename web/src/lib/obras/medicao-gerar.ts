import { prisma } from "@/lib/db";
import { validarIncidenciasPci } from "@/lib/obras/pci";
import { ehTipoMedicao, normalizarDadosMedicao, QUADROS_FOTO } from "@/lib/medicao-caixa";
import type { DadosPci } from "@/lib/caixa/pci";
import { gerarXlsMedicao, type MedicaoHistorica } from "@/lib/caixa/medicao-xls";
import { gerarPdfMedicao } from "@/lib/caixa/medicao-pdf";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

// Pedido de 18/10: a PCI original nunca é alterada; cada medição gera uma CÓPIA
// preenchida (.xls para o SIOPI e .pdf), a partir da versão da PCI gravada na
// própria medição. Usado pelo download e pela cópia no Google Drive.

export type FormatoMedicao = "xls" | "pdf";
export type ArquivoMedicao =
  | { ok: true; bytes: Uint8Array; nome: string; mime: string; obra: { id: string; nome: string }; rotulo: string }
  | { ok: false; status: number; error: string };

const dataIso = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
const SUFIXO = { pls: "PLS", repactuacao: "Repactuacao_Prazo", alteracao: "Alteracao_Projeto" } as const;
const ROTULO = { pls: "PLS", repactuacao: "Repactuação de Prazo", alteracao: "Alteração de Projeto" } as const;

/** Chamar só depois de autorizar o acesso à obra da medição. */
export async function gerarArquivoMedicao(medicaoId: string, formato: FormatoMedicao): Promise<ArquivoMedicao> {
  const m = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, include: { pciVersao: true, obra: { select: { id: true, nome: true } }, fotos: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], include: { arquivo: true } } } });
  if (!m) return { ok: false, status: 404, error: "Medição não encontrada." };
  if (!m.pciVersao) return { ok: false, status: 409, error: "Esta medição não possui uma versão da PCI vinculada. Revise a medição antes de gerar os arquivos." };
  const pci = m.pciVersao.parsed as unknown as DadosPci;
  const itens = m.itens as { chave: string; incidencia: string; execucao: string }[];
  if (!validarIncidenciasPci(itens, pci)) return { ok: false, status: 409, error: "As incidências salvas diferem da PCI desta medição. Revise a medição." };
  if (formato === "xls" && pci.formato !== "xls") return { ok: false, status: 400, error: "Para gerar .xls, vincule uma PCI original em .xls." };
  const tipo = ehTipoMedicao(m.tipo) ? m.tipo : "pls";
  const dados = normalizarDadosMedicao(tipo, m.dadosCaixa);
  const anterioresBrutas = await prisma.obraProgressoHistorico.findMany({ where: { obraId: m.obraId, OR: [{ criadoEm: { lt: m.criadoEm } }, { criadoEm: m.criadoEm, id: { lt: m.id } }] }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { progresso: true, criadoEm: true, dadosCaixa: true } });
  const anteriores: MedicaoHistorica[] = anterioresBrutas.map(a => ({ data: (a.dadosCaixa as { pls?: { dataLevantamento?: string } } | null)?.pls?.dataLevantamento || dataIso(a.criadoEm), progresso: Number(a.progresso) }));
  const porChave = new Map(itens.map(i => [i.chave, Number(i.execucao)]));
  const fotos = m.fotos.slice(0, QUADROS_FOTO[tipo]).filter(f => f.arquivo.dados && ["image/jpeg", "image/png"].includes(f.arquivo.mime)).map(f => ({ dados: f.arquivo.dados!, tipo: f.arquivo.mime === "image/png" ? "png" as const : "jpeg" as const, legenda: f.legenda }));
  const entrada = { tipo, pci, execucoes: SERVICOS_PROGRESSO.map(s => porChave.get(s.chave) ?? 0), progresso: Number(m.progresso), anteriores, dados, fotos };
  const bytes = formato === "xls" ? gerarXlsMedicao(m.pciVersao.dados, entrada) : gerarPdfMedicao(m.pciVersao.dados, entrada);
  // Mesmo padrão de nome da Prospecta: PLS_Obra_2026-08-25.xls
  const nome = `${SUFIXO[tipo]}_${m.obra.nome.replace(/\s+/g, "_")}_${dados.pls.dataLevantamento}.${formato}`;
  const [a, mes, d] = dados.pls.dataLevantamento.split("-");
  return { ok: true, bytes, nome, mime: formato === "xls" ? "application/vnd.ms-excel" : "application/pdf", obra: m.obra, rotulo: `${ROTULO[tipo]} (levantamento ${d}-${mes}-${a})` };
}

export type ResultadoDrive = { drive: "ok" | "indisponivel" | "erro"; nota: string | null };

/**
 * Copia o .xls e o .pdf preenchidos para Obras/<Obra>/Medições CAIXA. Nunca
 * lança nem desfaz a medição: sem Drive (ou com recusa do Google) os arquivos
 * continuam gerados sob demanda pelo download.
 */
export async function copiarMedicaoParaDrive(medicaoId: string): Promise<ResultadoDrive> {
  // Carregado sob demanda: o módulo do Drive é exclusivo do servidor.
  const { tentarUploadDrive, uploadArquivoMedicaoObra } = await import("@/lib/incorporacao/registro-drive");
  let algum = false;
  for (const formato of ["xls", "pdf"] as const) {
    const arq = await gerarArquivoMedicao(medicaoId, formato);
    if (!arq.ok) {
      if (arq.status === 400) continue; // PCI .xlsb: não há .xls, só o .pdf
      return { drive: "erro", nota: arq.error };
    }
    const r = await tentarUploadDrive(() => uploadArquivoMedicaoObra(arq.obra, { rotulo: arq.rotulo, nomeOriginal: arq.nome, mime: arq.mime, bytes: Buffer.from(arq.bytes) }));
    if (!r.fileId) return { drive: r.nota ? "erro" : "indisponivel", nota: r.nota };
    algum = true;
  }
  return { drive: algum ? "ok" : "indisponivel", nota: null };
}
