import "server-only";
import { prisma } from "@/lib/db";
import { caminhoCliente, caminhoEstudo, type AreaCliente, type PastaAlvo } from "@/lib/drive-estrutura";
import { lerDueDiligence } from "@/lib/incorporacao/due-diligence";
import { DOCUMENTOS_PADRAO_REGISTRO } from "@/lib/incorporacao/registro-incorporacao";

// Onde cada documento fica no Google Drive (ver drive-estrutura.ts). Mesma regra
// de `server/drive-pastas.ts` da Prospecta; só consultas ao banco.

/** IDs aqui são longos (cuid): o nome da pasta mostra os 6 últimos caracteres. */
export function numeroCurto(id: string): string {
  return id.slice(-6).toUpperCase();
}

export async function caminhoDocumentoCliente(leadId: string, area: AreaCliente): Promise<PastaAlvo[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nome: true } });
  return caminhoCliente({ id: leadId, numero: numeroCurto(leadId), nome: lead?.nome ?? null }, area);
}

function documentosDoRegistro(json: string | null): { id: string; nome: string }[] {
  const padrao = DOCUMENTOS_PADRAO_REGISTRO.map((nome, i) => ({ id: `padrao-${i}`, nome }));
  if (!json) return padrao;
  try {
    const parsed = JSON.parse(json) as { documentos?: { id: string; nome: string }[] };
    return Array.isArray(parsed.documentos) && parsed.documentos.length ? parsed.documentos : padrao;
  } catch {
    return padrao;
  }
}

/** Pasta da etapa (Due Diligence — <etapa> ou Registro) e rótulo do documento. */
export async function destinoDocumentoEstudo(estudoId: string, itemId: string): Promise<{ caminho: PastaAlvo[]; rotulo: string }> {
  const estudo = await prisma.estudoIncorporacao.findUnique({
    where: { id: estudoId }, select: { nome: true, dueDiligenceJson: true, registroIncorporacaoJson: true },
  });
  const base = { id: estudoId, numero: numeroCurto(estudoId), nome: estudo?.nome ?? null };
  if (itemId.startsWith("dd_")) {
    const [, etapaId, documentoId] = itemId.split("_");
    let etapas: ReturnType<typeof lerDueDiligence>["etapas"] = [];
    try { etapas = lerDueDiligence(estudo?.dueDiligenceJson).etapas; } catch { /* JSON ilegível: nomes genéricos */ }
    const etapa = etapas.find((e) => e.id === etapaId);
    const documento = etapa?.documentos.find((d) => d.id === documentoId);
    return {
      caminho: caminhoEstudo(base, { chave: `dd-${etapaId}`, nome: `Due Diligence — ${etapa?.nome ?? "etapa"}` }),
      rotulo: documento?.nome ?? "Documento",
    };
  }
  const documento = documentosDoRegistro(estudo?.registroIncorporacaoJson ?? null).find((d) => d.id === itemId);
  return { caminho: caminhoEstudo(base, { chave: "registro", nome: "Registro do loteamento" }), rotulo: documento?.nome ?? "Documento" };
}
