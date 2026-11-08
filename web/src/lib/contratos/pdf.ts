import { jsPDF } from "jspdf";

export function gerarPdfModelo(contrato: {
  numero: string;
  titulo: string;
  data: Date;
  clausulas: string;
  assinaturas: string[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 17;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const fim = doc.internal.pageSize.getHeight() - margem - 5;
  let y = margem;
  const reservar = (altura: number) => {
    if (y + altura > fim) {
      doc.addPage();
      y = margem;
    }
  };
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(contrato.titulo, margem, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10);
  const data = contrato.data.toISOString().slice(0, 10).split("-").reverse().join("/");
  doc.text(`Contrato ${contrato.numero} | Data da assinatura ${data}`, margem, y);
  y += 9;

  for (const paragrafo of contrato.clausulas.split("\n")) {
    const titulo = /^(CLÁUSULA |MEMORIAL DESCRITIVO|DA CORRETAGEM)/.test(paragrafo);
    doc.setFont("helvetica", titulo ? "bold" : "normal");
    if (titulo) reservar(13);
    for (const linha of doc.splitTextToSize(paragrafo, largura) as string[]) {
      reservar(5);
      doc.text(linha, margem, y);
      y += 4.6;
    }
    y += 2;
  }

  const assinaturas = contrato.assinaturas.map((nome) => doc.splitTextToSize(nome, largura) as string[]);
  const alturaAssinaturas = assinaturas.reduce((total, linhas) => total + 17 + linhas.length * 4.6, 9);
  reservar(Math.min(alturaAssinaturas, fim - margem));
  doc.setFont("helvetica", "bold");
  doc.text("ASSINATURAS", margem, y);
  doc.setFont("helvetica", "normal");
  y += 9;
  for (const linhas of assinaturas) {
    reservar(17 + linhas.length * 4.6);
    y += 10;
    doc.line(margem, y, margem + 77, y);
    y += 5;
    doc.text(linhas, margem, y);
    y += linhas.length * 4.6 + 2;
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i).setFontSize(8);
    doc.text(`${contrato.numero} | ${i}/${paginas}`, margem, fim + 10);
  }
  return doc;
}
