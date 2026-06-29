"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { jsPDF } from "jspdf";

function formatCurrencyPdf(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function gerarPdfContrato(contratoId: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");

  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    include: { imovel: true },
  });
  if (!contrato) throw new Error("Contrato não encontrado");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(245, 196, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO SANTA FÉ", 14, 12);
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("Soluções Imobiliárias", 14, 18);
  doc.setTextColor(180, 180, 180);
  doc.text(`Nº ${contrato.numero}`, pw - 14, 12, { align: "right" });
  doc.text(new Date().toLocaleDateString("pt-BR"), pw - 14, 18, { align: "right" });

  // Title
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const titulo = `CONTRATO DE ${contrato.tipo.replace(/_/g, " ").toUpperCase()}`;
  doc.text(titulo, pw / 2, 40, { align: "center" });

  // Divider
  doc.setDrawColor(245, 196, 0);
  doc.setLineWidth(0.8);
  doc.line(14, 44, pw - 14, 44);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  let y = 52;
  const lineH = 6;

  function addLabel(label: string, value: string, yPos: number) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, 55, yPos);
  }

  addLabel("PARTE A (CONTRATANTE)", contrato.parteA + (contrato.parteADoc ? ` — ${contrato.parteADoc}` : ""), y); y += lineH;
  addLabel("PARTE B (CONTRATADA)", contrato.parteB + (contrato.parteBDoc ? ` — ${contrato.parteBDoc}` : ""), y); y += lineH;
  addLabel("VALOR", formatCurrencyPdf(contrato.valor), y); y += lineH;
  if (contrato.vencimento) {
    addLabel("VENCIMENTO", new Date(contrato.vencimento).toLocaleDateString("pt-BR"), y); y += lineH;
  }
  if (contrato.imovel) {
    addLabel("IMÓVEL", `${contrato.imovel.titulo} — ${contrato.imovel.bairro}`, y); y += lineH;
  }
  y += 4;

  // Description
  if (contrato.descricao) {
    doc.setFont("helvetica", "bold");
    doc.text("OBJETO DO CONTRATO", 14, y); y += lineH;
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(contrato.descricao, pw - 28) as string[];
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 4;
  }

  // Clauses
  if (contrato.clausulas) {
    doc.setFont("helvetica", "bold");
    doc.text("CLÁUSULAS E CONDIÇÕES", 14, y); y += lineH;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, y - 2, pw - 14, y - 2);
    doc.setFont("helvetica", "normal");
    const clausulaLines = doc.splitTextToSize(contrato.clausulas, pw - 28) as string[];
    doc.text(clausulaLines, 14, y);
    y += clausulaLines.length * 5 + 8;
  }

  // Signatures
  const sigY = Math.max(y + 20, 230);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.4);
  doc.line(14, sigY, 90, sigY);
  doc.line(pw - 90, sigY, pw - 14, sigY);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(contrato.parteA, 52, sigY + 5, { align: "center" });
  doc.text(contrato.parteB, pw - 52, sigY + 5, { align: "center" });
  doc.text("CONTRATANTE", 52, sigY + 9, { align: "center" });
  doc.text("CONTRATADA", pw - 52, sigY + 9, { align: "center" });

  // Location/date line
  doc.text(
    `Canaã dos Carajás – PA, ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`,
    pw / 2,
    sigY - 10,
    { align: "center" }
  );

  // Footer
  const fh = doc.internal.pageSize.getHeight();
  doc.setFillColor(245, 196, 0);
  doc.rect(0, fh - 10, pw, 10, "F");
  doc.setFontSize(7);
  doc.setTextColor(26, 26, 26);
  doc.text("Grupo Santa Fé — gruposantafe.com.br — (94) 99304-4689", pw / 2, fh - 4, { align: "center" });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const blob = await put(`contratos/${contrato.numero}-${Date.now()}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  await prisma.$transaction([
    prisma.contratoDocumento.create({
      data: {
        contratoId,
        nome: `${contrato.numero} — contrato gerado`,
        url: blob.url,
        tipo: "contrato_gerado",
      },
    }),
  ]);

  revalidatePath("/admin/juridico");
  return { url: blob.url };
}

export async function uploadContratoAssinado(contratoId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) throw new Error("Nenhum arquivo enviado");
  if (arquivo.type !== "application/pdf") throw new Error("Apenas PDF é aceito");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("Arquivo deve ter menos de 10MB");

  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { numero: true } });
  if (!contrato) throw new Error("Contrato não encontrado");

  const blob = await put(`contratos/assinados/${contrato.numero}-${Date.now()}.pdf`, arquivo, {
    access: "public",
    contentType: "application/pdf",
  });

  await prisma.$transaction([
    prisma.contratoDocumento.create({
      data: {
        contratoId,
        nome: `${contrato.numero} — assinado`,
        url: blob.url,
        tipo: "assinado",
      },
    }),
    prisma.contrato.update({
      where: { id: contratoId },
      data: { assinaturaStatus: "assinado", contratoAssinadoUrl: blob.url },
    }),
  ]);

  revalidatePath("/admin/juridico");
  return { url: blob.url };
}

export async function marcarAssinaturaStatus(contratoId: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");

  const allowed = ["pendente", "solicitado", "assinado", "rejeitado"];
  if (!allowed.includes(status)) throw new Error("Status inválido");

  await prisma.contrato.update({
    where: { id: contratoId },
    data: { assinaturaStatus: status },
  });

  revalidatePath("/admin/juridico");
}
