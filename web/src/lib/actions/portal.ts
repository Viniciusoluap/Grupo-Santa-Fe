"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { uploadPublico } from "@/lib/blob";
import { revalidatePath } from "next/cache";

// Upload do contrato assinado feito pelo PRÓPRIO CLIENTE no portal.
// Segurança: o contrato precisa pertencer ao lead da sessão (isolamento por leadId).
export async function enviarContratoAssinadoPortal(contratoId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");

  const leadId = (session.user as { leadId?: string }).leadId;
  if (!leadId) throw new Error("Perfil não vinculado");

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { numero: true, leadId: true },
  });
  if (!contrato || contrato.leadId !== leadId) throw new Error("Contrato não encontrado");

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) throw new Error("Nenhum arquivo enviado");
  if (arquivo.type !== "application/pdf") throw new Error("Apenas PDF é aceito");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo deve ter menos de 10MB");

  const blob = await uploadPublico(`contratos/assinados/${contrato.numero}-${Date.now()}.pdf`, arquivo, "application/pdf");
  if (!blob.url) return { error: blob.erro };

  await prisma.$transaction([
    prisma.contratoDocumento.create({
      data: {
        contratoId,
        nome: `${contrato.numero} — assinado (via portal)`,
        url: blob.url,
        tipo: "assinado",
      },
    }),
    prisma.contrato.update({
      where: { id: contratoId },
      data: { assinaturaStatus: "assinado", contratoAssinadoUrl: blob.url },
    }),
  ]);

  revalidatePath("/portal/documentos");
  revalidatePath("/admin/juridico");
  return { url: blob.url };
}
