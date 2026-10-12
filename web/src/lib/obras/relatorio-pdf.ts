// EPIC-020 Lote 4 (item 29) — desenho do relatório executivo da obra em PDF.
// Mesmo arquivo em Prospecta/client/src/lib/relatorio-obra-pdf.ts (só imports).
// O conteúdo vem pronto de montarRelatorioObra (shared/relatorio-obra.ts); aqui
// só se desenha: capa, sumário, seções, gráficos, fotos, cabeçalho, rodapé e
// "Página X de Y". Textos longos quebram linha (nada é cortado).

import type { GraficoRelatorio, RelatorioObra } from "@/lib/obras/relatorio";
import { dataBR } from "@/lib/obras/relatorio";

type RGB = [number, number, number];
export interface TemaRelatorio { empresa: string; logoUrl: string; primaria: RGB; escura: RGB }
export interface FotoPdf { url: string; legenda: string | null; data: string | Date }

interface Imagem { dataUrl: string; largura: number; altura: number; formato: "PNG" | "JPEG" }

/** Carrega uma imagem (com a sessão do usuário) e converte para PNG/JPEG que o jsPDF entende. */
async function carregarImagem(url: string, formato: "PNG" | "JPEG", ladoMaximo = 1600): Promise<Imagem | null> {
  try {
    const resposta = await fetch(url, { credentials: "include" });
    if (!resposta.ok) return null;
    const bmp = await createImageBitmap(await resposta.blob());
    const escala = Math.min(1, ladoMaximo / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * escala));
    canvas.height = Math.max(1, Math.round(bmp.height * escala));
    const ctx = canvas.getContext("2d")!;
    if (formato === "JPEG") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return {
      dataUrl: canvas.toDataURL(formato === "PNG" ? "image/png" : "image/jpeg", 0.85),
      largura: canvas.width,
      altura: canvas.height,
      formato,
    };
  } catch {
    return null;
  }
}

export async function gerarPdfRelatorioObra(rel: RelatorioObra, tema: TemaRelatorio, fotos: FotoPdf[], nomeArquivo: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margem = 14;
  const topo = 24;
  const limite = ph - 18;
  const ultimoY = (fallback: number) => ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback) + 6;
  const garantir = (y: number, altura: number) => {
    if (y + altura <= limite) return y;
    doc.addPage();
    return topo;
  };

  // Imagens carregadas antes de desenhar (o jsPDF é síncrono).
  const [logo, fotosCarregadas] = await Promise.all([
    carregarImagem(tema.logoUrl, "PNG", 800),
    Promise.all(fotos.map(async (f) => ({ img: await carregarImagem(f.url, "JPEG"), legenda: f.legenda, data: f.data }))),
  ]);

  // ── Capa ───────────────────────────────────────────────────────────────
  doc.setFillColor(...tema.escura);
  doc.rect(0, 0, pw, ph, "F");
  if (logo) {
    const largura = 80;
    const altura = (logo.altura / logo.largura) * largura;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect((pw - largura) / 2 - 6, 50 - 6, largura + 12, altura + 12, 3, 3, "F");
    doc.addImage(logo.dataUrl, logo.formato, (pw - largura) / 2, 50, largura, altura);
  }
  doc.setTextColor(...tema.primaria).setFont("helvetica", "bold").setFontSize(24);
  doc.text(rel.titulo.toUpperCase(), pw / 2, 140, { align: "center", maxWidth: pw - 40 });
  doc.setTextColor(255, 255, 255).setFontSize(16);
  const nomeObra = rel.secoes.find((s) => s.id === "info")?.campos.find((c) => c.rotulo === "Obra")?.valor ?? "";
  doc.text(doc.splitTextToSize(nomeObra, pw - 40), pw / 2, 156, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(tema.empresa, pw / 2, 250, { align: "center" });
  doc.text(rel.subtitulo.replace(`${nomeObra} — `, ""), pw / 2, 257, { align: "center" });

  // ── Sumário (preenchido no fim, quando as páginas forem conhecidas) ───
  doc.addPage();
  const paginaSumario = doc.getNumberOfPages();
  const inicioSecoes: { titulo: string; pagina: number }[] = [];

  const tituloSecao = (n: number, titulo: string) => {
    doc.addPage();
    inicioSecoes.push({ titulo: `${n}. ${titulo}`, pagina: doc.getNumberOfPages() });
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...tema.escura);
    doc.text(`${n}. ${titulo}`, margem, topo + 4);
    doc.setDrawColor(...tema.primaria).setLineWidth(0.8);
    doc.line(margem, topo + 6.5, pw - margem, topo + 6.5);
    return topo + 13;
  };

  const desenharGrafico = (g: GraficoRelatorio, y0: number) => {
    const alturaBarra = 6;
    const altura = 10 + g.itens.length * (alturaBarra + 3);
    let y = garantir(y0, altura);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
    doc.text(g.titulo, margem, y);
    y += 4;
    const colRotulo = 58;
    const larguraUtil = pw - margem * 2 - colRotulo - 34;
    const maximo = Math.max(...g.itens.map((i) => Math.abs(i.valor)), g.unidade === "percentual" ? 100 : 0) || 1;
    for (const item of g.itens) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 60, 60);
      doc.text(doc.splitTextToSize(item.rotulo, colRotulo - 2)[0], margem, y + 4.3);
      doc.setFillColor(235, 235, 235);
      doc.rect(margem + colRotulo, y, larguraUtil, alturaBarra, "F");
      const largura = (Math.abs(item.valor) / maximo) * larguraUtil;
      if (item.valor < 0) doc.setFillColor(200, 60, 60);
      else doc.setFillColor(...tema.primaria);
      doc.rect(margem + colRotulo, y, Math.max(largura, 0.5), alturaBarra, "F");
      doc.setTextColor(40, 40, 40);
      doc.text(item.texto, margem + colRotulo + larguraUtil + 2, y + 4.3);
      y += alturaBarra + 3;
    }
    return y + 4;
  };

  rel.secoes.forEach((secao, idx) => {
    let y = tituloSecao(idx + 1, secao.titulo);
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem, top: topo },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 62, fontStyle: "bold", fillColor: [246, 246, 246] } },
      body: secao.campos.map((c) => [c.rotulo, c.valor]),
    });
    y = ultimoY(y);
    for (const g of secao.graficos) y = desenharGrafico(g, y);
    for (const t of secao.tabelas) {
      y = garantir(y, 16);
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
      doc.text(t.titulo, margem, y);
      y += 2;
      if (t.linhas.length === 0) {
        doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(110, 110, 110);
        doc.text(t.vazio || "Sem registros.", margem, y + 5);
        y += 11;
        continue;
      }
      autoTable(doc, {
        startY: y,
        margin: { left: margem, right: margem, top: topo },
        theme: "striped",
        headStyles: { fillColor: tema.escura, textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
        head: [t.colunas],
        body: t.linhas,
      });
      y = ultimoY(y);
    }
    if (secao.id === "fotos" && fotos.length) desenharFotos(y);
  });

  function desenharFotos(y0: number) {
    // Até duas fotos por página, proporção preservada, legenda e data abaixo.
    let y = y0;
    for (const f of fotosCarregadas) {
      const larguraMax = pw - margem * 2;
      const alturaMax = 96;
      let largura = larguraMax;
      let altura = f.img ? (f.img.altura / f.img.largura) * largura : 20;
      if (altura > alturaMax) {
        altura = alturaMax;
        largura = f.img ? (f.img.largura / f.img.altura) * altura : larguraMax;
      }
      doc.setFont("helvetica", "normal").setFontSize(9);
      const legenda = doc.splitTextToSize(`${dataBR(f.data)} — ${f.legenda || "Sem legenda"}`, larguraMax);
      // Reserva a imagem + a legenda inteira (legendas longas quebram em várias linhas).
      y = garantir(y, altura + 4 + legenda.length * 4 + 6);
      if (f.img) doc.addImage(f.img.dataUrl, f.img.formato, margem + (larguraMax - largura) / 2, y, largura, altura);
      else {
        doc.setDrawColor(180, 180, 180);
        doc.rect(margem, y, larguraMax, altura);
        doc.setFontSize(9).setTextColor(120, 120, 120).text("Imagem indisponível", pw / 2, y + 11, { align: "center" });
      }
      y += altura + 4;
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(50, 50, 50);
      doc.text(legenda, margem, y);
      y += legenda.length * 4 + 6;
    }
  }

  // ── Sumário ──────────────────────────────────────────────────────────
  doc.setPage(paginaSumario);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...tema.escura);
  doc.text("Sumário", margem, topo + 4);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(40, 40, 40);
  inicioSecoes.forEach((s, i) => {
    const y = topo + 18 + i * 9;
    doc.text(s.titulo, margem, y);
    doc.text(String(s.pagina), pw - margem, y, { align: "right" });
    doc.setDrawColor(200, 200, 200).setLineWidth(0.1);
    doc.line(margem + doc.getTextWidth(s.titulo) + 2, y, pw - margem - 8, y);
  });

  // ── Cabeçalho e rodapé (exceto capa) ────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...tema.escura);
    doc.text(tema.empresa, margem, 12);
    doc.setFont("helvetica", "normal").setTextColor(110, 110, 110);
    doc.text(doc.splitTextToSize(nomeObra, 110)[0], pw - margem, 12, { align: "right" });
    doc.setDrawColor(...tema.primaria).setLineWidth(0.4);
    doc.line(margem, 14.5, pw - margem, 14.5);
    doc.line(margem, ph - 12, pw - margem, ph - 12);
    doc.text(`${rel.titulo} — ${rel.subtitulo.split(" — gerado em ")[1] ?? ""}`, margem, ph - 7);
    doc.text(`Página ${p} de ${total}`, pw - margem, ph - 7, { align: "right" });
  }
  doc.save(nomeArquivo);
}
