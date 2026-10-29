import { prisma } from "@/lib/db";
import { validarIncidenciasPci } from "@/lib/obras/pci";
import { ehTipoMedicao, normalizarDadosMedicao, QUADROS_FOTO } from "@/lib/medicao-caixa";
import { lerPci, type DadosPci } from "@/lib/caixa/pci";
import type { MedicaoHistorica } from "@/lib/caixa/medicao-xls";
import { gerarPdfMedicao } from "@/lib/caixa/medicao-pdf";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

// Pedido de 18/10: a PCI original nunca é alterada; cada medição gera uma CÓPIA
// preenchida em .pdf, a partir da versão da PCI gravada na própria medição.
// Usado pelo download, pelo e-mail e pela cópia no Google Drive.
// Lote 02, correção 01: a medição (PLS, Repactuação e Alteração compartilham o
// arquivo) não é mais gerada em .xls. O PDF não depende do .xls: funciona com
// PCI .xls ou .xlsb (o BIFF8 só fornece o logotipo, quando houver). A PCI
// continua em Excel (envio/download/upload intactos).

export type FormatoMedicao = "pdf";
/** Resposta das funções da Vercel: até 4,5 MB. Acima disso o arquivo só vai para o Drive. */
export const LIMITE_DOWNLOAD = 4.3 * 1024 * 1024;
export const MENSAGEM_LIMITE_DOWNLOAD = "O arquivo desta medição passou de 4,3 MB (limite de download do servidor). Com o Google Drive conectado, ele fica completo em Obras/<Obra>/Medições CAIXA; para baixar por aqui, use menos fotos ou fotos menores.";
export type ArquivoMedicao =
  | { ok: true; bytes: Uint8Array; nome: string; mime: string; obra: { id: string; nome: string }; rotulo: string }
  | { ok: false; status: number; error: string };

const dataIso = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
const SUFIXO = { pls: "PLS", repactuacao: "Repactuacao_Prazo", alteracao: "Alteracao_Projeto" } as const;
const ROTULO = { pls: "PLS", repactuacao: "Repactuação de Prazo", alteracao: "Alteração de Projeto" } as const;

/** Chamar só depois de autorizar o acesso à obra da medição. */
export async function gerarArquivoMedicao(medicaoId: string, formato: FormatoMedicao = "pdf"): Promise<ArquivoMedicao> {
  const m = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, include: { pciVersao: true, obra: { select: { id: true, nome: true, dataInicio: true, dataPrevisaoFim: true } }, fotos: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], include: { arquivo: true } } } });
  if (!m) return { ok: false, status: 404, error: "Medição não encontrada." };
  if (!m.pciVersao) return { ok: false, status: 409, error: "Esta medição não possui uma versão da PCI vinculada. Revise a medição antes de gerar os arquivos." };
  const pciSalva = m.pciVersao.parsed as unknown as DadosPci;
  // Lote 03, correção 08: relê a PCI desta versão (cronograma, valor e alvará recalculados
  // das entradas, não do cache gravado no envio); falha → dados salvos.
  let pci = pciSalva;
  try { pci = { ...lerPci(new Uint8Array(m.pciVersao.dados)), incidencias: pciSalva.incidencias }; } catch { /* mantém os dados salvos */ }
  const itens = m.itens as { chave: string; incidencia: string; execucao: string }[];
  if (!validarIncidenciasPci(itens, pci)) return { ok: false, status: 409, error: "As incidências salvas diferem da PCI desta medição. Revise a medição." };
  const tipo = ehTipoMedicao(m.tipo) ? m.tipo : "pls";
  const dados = normalizarDadosMedicao(tipo, m.dadosCaixa);
  const anterioresBrutas = await prisma.obraProgressoHistorico.findMany({ where: { obraId: m.obraId, OR: [{ criadoEm: { lt: m.criadoEm } }, { criadoEm: m.criadoEm, id: { lt: m.id } }] }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { progresso: true, criadoEm: true, dadosCaixa: true, recebidaEm: true } });
  // Lote 03, correção 08: "Acumul. Aferido" = medição anterior CONFIRMADA como recebida
  // pela CAIXA (recebidaEm). Sem confirmação, fica em branco e o PDF sinaliza.
  const anteriores: MedicaoHistorica[] = anterioresBrutas.map(a => ({ data: (a.dadosCaixa as { pls?: { dataLevantamento?: string } } | null)?.pls?.dataLevantamento || dataIso(a.criadoEm), progresso: Number(a.progresso), aferido: !!a.recebidaEm }));
  // H6: início e término previsto vêm do Editar Obra (datas gravadas à meia-noite UTC).
  const datasObra = { inicio: m.obra.dataInicio ? m.obra.dataInicio.toISOString().slice(0, 10) : null, termino: m.obra.dataPrevisaoFim ? m.obra.dataPrevisaoFim.toISOString().slice(0, 10) : null };
  const porChave = new Map(itens.map(i => [i.chave, Number(i.execucao)]));
  const fotos = m.fotos.slice(0, QUADROS_FOTO[tipo]).filter(f => f.arquivo.dados && ["image/jpeg", "image/png"].includes(f.arquivo.mime)).map(f => ({ dados: f.arquivo.dados!, tipo: f.arquivo.mime === "image/png" ? "png" as const : "jpeg" as const, legenda: f.legenda }));
  const entrada = { tipo, pci, execucoes: SERVICOS_PROGRESSO.map(s => porChave.get(s.chave) ?? 0), progresso: Number(m.progresso), anteriores, dados, fotos, obra: datasObra };
  const bytes = gerarPdfMedicao(m.pciVersao.dados, entrada);
  // Mesmo padrão de nome da Prospecta: PLS_Obra_2026-08-25.pdf
  const nome = `${SUFIXO[tipo]}_${m.obra.nome.replace(/\s+/g, "_")}_${dados.pls.dataLevantamento}.${formato}`;
  const [a, mes, d] = dados.pls.dataLevantamento.split("-");
  return { ok: true, bytes, nome, mime: "application/pdf", obra: m.obra, rotulo: `${ROTULO[tipo]} (levantamento ${d}-${mes}-${a})` };
}

export type ResultadoDrive = { drive: "ok" | "indisponivel" | "erro"; nota: string | null };

/**
 * Copia o .pdf preenchido para Obras/<Obra>/Medições CAIXA (Lote 02: sem .xls;
 * arquivos antigos no Drive não são apagados). Nunca lança nem desfaz a
 * medição: sem Drive (ou com recusa do Google) o arquivo continua gerado sob
 * demanda pelo download.
 */
export async function copiarMedicaoParaDrive(medicaoId: string): Promise<ResultadoDrive> {
  // Carregado sob demanda: o módulo do Drive é exclusivo do servidor.
  const { tentarUploadDrive, uploadArquivoMedicaoObra } = await import("@/lib/incorporacao/registro-drive");
  let algum = false;
  for (const formato of ["pdf"] as const) {
    const arq = await gerarArquivoMedicao(medicaoId, formato);
    if (!arq.ok) return { drive: "erro", nota: arq.error };
    const r = await tentarUploadDrive(() => uploadArquivoMedicaoObra(arq.obra, { rotulo: arq.rotulo, nomeOriginal: arq.nome, mime: arq.mime, bytes: Buffer.from(arq.bytes) }));
    if (!r.fileId) return { drive: r.nota ? "erro" : "indisponivel", nota: r.nota };
    algum = true;
  }
  return { drive: algum ? "ok" : "indisponivel", nota: null };
}
