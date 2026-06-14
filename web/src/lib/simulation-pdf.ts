import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BANK_RATES,
  BANK_RATES_REFERENCE_DATE,
  simulate,
  type SimulationInput,
  type SimulationResult,
} from "@/lib/mortgage";
import { formatCurrency } from "@/lib/utils";

const BRAND_DARK: [number, number, number] = [26, 26, 26];
const BRAND_YELLOW: [number, number, number] = [245, 196, 0];

const systemLabel: Record<SimulationInput["system"], string> = {
  price: "Price (parcelas fixas)",
  sac: "SAC (parcelas decrescentes)",
};

function buildPdf(input: SimulationInput, result: SimulationResult, includeSchedule: boolean) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(...BRAND_YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GRUPO SANTA FÉ", margin, 32);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    includeSchedule
      ? "Simulação de Financiamento Habitacional — Completo com Tabela de Amortização"
      : "Simulação de Financiamento Habitacional",
    margin,
    50
  );

  let y = 100;

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dados da Simulação", margin, y);
  y += 20;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: BRAND_DARK, textColor: BRAND_YELLOW },
    body: [
      ["Valor do imóvel", formatCurrency(input.propertyValue)],
      ["Entrada", formatCurrency(input.downPayment)],
      ["Uso de FGTS", input.useFgts ? formatCurrency(input.fgtsAmount) : "Não"],
      ["Valor financiado", formatCurrency(result.loanAmount)],
      ["Prazo", `${input.termMonths} meses (${(input.termMonths / 12).toFixed(0)} anos)`],
      ["Taxa de juros utilizada", `${input.annualRate}% a.a.`],
      ["Sistema de amortização", systemLabel[input.system]],
      [
        input.system === "price" ? "Parcela (estimada)" : "1ª parcela (estimada)",
        formatCurrency(result.firstInstallment),
      ],
      ...(input.system === "sac"
        ? [["Última parcela (estimada)", formatCurrency(result.lastInstallment)]]
        : []),
      ["Total de juros no período", formatCurrency(result.totalInterest)],
      ["Total de seguros (MIP + DFI)", formatCurrency(result.totalInsurance)],
      ["Total pago ao final do contrato", formatCurrency(result.totalPaid)],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 220 } },
  });

  // @ts-expect-error -- jspdf-autotable augments the doc instance at runtime
  y = doc.lastAutoTable.finalY + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Comparativo de Taxas — Financiamento Habitacional", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Taxas de referência levantadas no mercado em ${BANK_RATES_REFERENCE_DATE}. Valores variam conforme análise de crédito,`,
    margin,
    y + 12
  );
  doc.text(
    "renda, relacionamento bancário e sistema de amortização — consulte sempre a instituição financeira.",
    margin,
    y + 24
  );
  y += 36;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: BRAND_DARK, textColor: BRAND_YELLOW },
    head: [["Banco", "Taxa de referência", "Parcela estimada", "Índice", "Observações"]],
    body: BANK_RATES.map((b) => [
      b.bank,
      b.rateLabel,
      formatCurrency(simulate({ ...input, annualRate: b.rate }).firstInstallment),
      b.index,
      b.notes,
    ]),
  });

  // @ts-expect-error -- jspdf-autotable augments the doc instance at runtime
  y = doc.lastAutoTable.finalY + 30;

  // Amortization schedule (full table)
  if (includeSchedule && result.schedule.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 60;
    }

    doc.setTextColor(...BRAND_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Tabela de Amortização", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`${input.termMonths} parcelas — ${systemLabel[input.system]}`, margin, y + 14);
    y += 28;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: BRAND_DARK, textColor: BRAND_YELLOW, fontSize: 8 },
      head: [["Mês", "Parcela", "Amortização", "Juros", "Saldo Devedor"]],
      body: result.schedule.map((row) => [
        row.month,
        formatCurrency(row.payment),
        formatCurrency(row.principal),
        formatCurrency(row.interest),
        formatCurrency(row.balance),
      ]),
      columnStyles: {
        0: { halign: "center", cellWidth: 40 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right", textColor: [180, 100, 0] },
        4: { halign: "right" },
      },
    });

    // @ts-expect-error -- jspdf-autotable augments the doc instance at runtime
    y = doc.lastAutoTable.finalY + 30;
  }

  if (y > doc.internal.pageSize.getHeight() - 140) {
    doc.addPage();
    y = 60;
  }

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Fale com um especialista", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("WhatsApp / Telefone: (94) 99304-4689", margin, y);
  y += 14;
  doc.text("E-mail: comercial@gruposantafee.com.br", margin, y);
  y += 14;
  doc.text("Rua B Nº 40 — Ouro Preto, Canaã dos Carajás-PA", margin, y);

  y += 30;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  const disclaimer = doc.splitTextToSize(
    "* Simulação meramente ilustrativa, sem valor contratual. Valores de seguro estimados (MIP + DFI). " +
      "Taxas e condições sujeitas à análise de crédito de cada instituição financeira. " +
      "O comparativo de bancos apresenta taxas de referência pesquisadas publicamente no mercado e podem ter sido atualizadas — confirme sempre diretamente com o banco.",
    pageWidth - margin * 2
  );
  doc.text(disclaimer, margin, y);

  return doc;
}

export function generateSimulationPdf(input: SimulationInput, result: SimulationResult) {
  const dateStr = new Date().toLocaleDateString("pt-BR");
  buildPdf(input, result, false).save(
    `simulacao-financiamento-grupo-santa-fe-${dateStr.replace(/\//g, "-")}.pdf`
  );
}

export function generateSimulationPdfWithSchedule(input: SimulationInput, result: SimulationResult) {
  const dateStr = new Date().toLocaleDateString("pt-BR");
  buildPdf(input, result, true).save(
    `simulacao-completa-grupo-santa-fe-${dateStr.replace(/\//g, "-")}.pdf`
  );
}
