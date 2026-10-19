import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { lerPci, type DadosPci } from "@/lib/caixa/pci";
import { incidenciasCorrespondem } from "@/lib/medicao-caixa";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

export class PciInvalida extends Error {}
export const LIMITE_PCI = 3 * 1024 * 1024;
export function validarIncidenciasPci(itens: { chave: string; incidencia: string }[], pci: DadosPci) {
  return incidenciasCorrespondem(itens, SERVICOS_PROGRESSO.map(s => s.chave), pci.incidencias);
}
export async function obterPci(obraId: string, db: Prisma.TransactionClient = prisma) {
  return db.obraPci.findUnique({ where: { obraId }, include: { versao: true } });
}
export async function gravarPci(obraId: string, nome: string, bytes: Uint8Array, usuarioId: string) {
  if (!bytes.length || bytes.length > LIMITE_PCI) throw new PciInvalida("Envie uma PCI de até 3 MiB.");
  let parsed: DadosPci;
  try { parsed = lerPci(bytes); } catch (e) { throw new PciInvalida(e instanceof Error ? e.message : "PCI inválida."); }
  const hash = createHash("sha256").update(bytes).digest("hex");
  const nova = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
    const existia = await tx.obraPciVersao.findUnique({ where: { obraId_hash: { obraId, hash } }, select: { id: true } });
    const versao = await tx.obraPciVersao.upsert({
      where: { obraId_hash: { obraId, hash } }, update: {},
      create: { obraId, hash, nome, dados: new Uint8Array(bytes), tamanho: bytes.length, parsed: parsed as unknown as Prisma.InputJsonValue, enviadoPorId: usuarioId },
    });
    const atual = await obterPci(obraId, tx);
    // Reenviar exatamente o mesmo arquivo não desfaz o vínculo já confirmado.
    if (atual?.versaoId !== versao.id) {
      await tx.obraPci.upsert({ where: { obraId },
        create: { obraId, versaoId: versao.id },
        update: { versaoId: versao.id, enviadaEm: new Date(), vinculadaEm: null, vinculadaPorId: null },
      });
    }
    return !existia;
  });
  // Pedido de 18/10: a PCI original (intacta) também fica no Google Drive da obra,
  // uma cópia por versão. Sem Drive, a versão continua guardada no banco.
  const drive = nova ? await copiarPciParaDrive(obraId, nome, bytes) : null;
  return { parsed, drive };
}

async function copiarPciParaDrive(obraId: string, nome: string, bytes: Uint8Array) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true, nome: true } });
  if (!obra) return null;
  const { tentarUploadDrive, uploadArquivoMedicaoObra } = await import("@/lib/incorporacao/registro-drive");
  const mime = /\.xlsb$/i.test(nome) ? "application/vnd.ms-excel.sheet.binary.macroEnabled.12" : "application/vnd.ms-excel";
  const r = await tentarUploadDrive(() => uploadArquivoMedicaoObra(obra, { rotulo: "PCI original", nomeOriginal: nome, mime, bytes: Buffer.from(bytes) }));
  return r.fileId ? "ok" as const : r.nota ? "erro" as const : "indisponivel" as const;
}
