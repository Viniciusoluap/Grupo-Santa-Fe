/**
 * PDF da medição no layout dos modelos da CAIXA (PLS, Repactuação de Prazo e
 * Alteração de Projeto). Pedido de 18/10.
 *
 * O PDF é montado aqui (o servidor não tem Excel para imprimir a planilha),
 * com os mesmos campos, cálculos e o logotipo do próprio arquivo da PCI.
 */
import { jsPDF } from "jspdf";
import type { DadosAlteracao, DadosRepactuacao } from "../medicao-caixa";
import { PastaBiff8 } from "./biff8";
import { dimensoesImagem, imagensDaAba, type FotoXls } from "./biff8-imagens";
import { ABA_PLS, formatarCoordenada, type DadosPci } from "./pci";
import {
  acumuladoPorEtapa,
  calcularAlteracao,
  calcularPls,
  curvaDeEvolucao,
  dadosDoContrato,
  etapaDaData,
  inicioDaMedicao,
  localEData,
  somarMeses,
  type EntradaMedicaoCaixa,
} from "./medicao-xls";

const AZUL = [31, 56, 100] as const;
const LILAS = [204, 204, 255] as const;
const VERDE = [146, 208, 80] as const;
const LARANJA = [237, 125, 49] as const;
const CINZA = [230, 230, 230] as const;
const NOMES_SERVICOS_PLS = [
  "Serviços Preliminares e Gerais", "Infraestrutura", "Supra estrutura", "Paredes e Painéis", "Esquadrias",
  "Vidros e Plásticos", "Coberturas", "Impermeabilizações", "Revestimentos Internos", "Forros",
  "Revestimentos Externos", "Pintura", "Pisos", "Acabamentos", "Inst. Elétricas e Telefônicas",
  "Instalações Hidráulicas", "Inst. Esgoto e Águas Pluviais", "Louças e Metais", "Complementos", "Outros Serviços",
];
const NOMES_SERVICOS_PROPOSTA = [
  "Barracão+lig. provisórias(água/luz)+projetos/aprovs.", "Infraestrutura (estacas, brocas, baldrames, sapatas)",
  "Supraestrutura (Vigas, pilares, cintas, escadas)", "Paredes e Painéis", "Esquadrias", "Vidros e Plásticos",
  "Coberturas (estrutura e telhas)", "Impermeabilizações", "Revestimentos Internos", "Forros", "Revestimentos Externos",
  "Pinturas", "Pisos", "Acabamentos (soleiras, rodapés, peitoril etc.)", "Instalações Elétricas e Telefônicas",
  "Instalações Hidráulicas", "Instalações: Esgoto e Águas Pluviais", "Louças e Metais", "Complementos (limpeza final e calafete)",
  "Outros (discriminar em Serviços Adicionais, abaixo)",
];

const num = (v: number | null | undefined, casas = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? ""
    : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const reais = (v: number | null | undefined) => (v === null || v === undefined ? "" : num(v, 2));
const dataBr = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");
const simNao = (v: boolean) => (v ? "sim" : "não");

type Cor = readonly [number, number, number];
interface OpcoesCelula {
  fundo?: Cor;
  negrito?: boolean;
  tamanho?: number;
  alinhar?: "left" | "center" | "right";
  cor?: Cor;
  borda?: boolean;
  quebra?: boolean;
}

class Documento {
  pdf = new jsPDF({ unit: "mm", format: "a4" });
  private logo: FotoXls | null;
  constructor(
    private titulo: string,
    private subtitulo: string,
    private rodape: string,
    private contrato: string,
    logo: FotoXls | null
  ) {
    this.logo = logo;
    this.pdf.setLineWidth(0.15);
    this.pdf.setDrawColor(150, 150, 150);
  }

  celula(x: number, y: number, w: number, h: number, texto: string, o: OpcoesCelula = {}) {
    const p = this.pdf;
    if (o.fundo) {
      p.setFillColor(...o.fundo);
      p.rect(x, y, w, h, "F");
    }
    if (o.borda !== false) p.rect(x, y, w, h, "S");
    if (!texto) return;
    p.setFont("helvetica", o.negrito ? "bold" : "normal");
    p.setFontSize(o.tamanho ?? 7);
    p.setTextColor(...(o.cor ?? [0, 0, 0]));
    const alinhar = o.alinhar ?? "left";
    const tx = alinhar === "left" ? x + 1 : alinhar === "right" ? x + w - 1 : x + w / 2;
    if (o.quebra) {
      const linhas = p.splitTextToSize(texto, w - 2) as string[];
      const alturaLinha = (o.tamanho ?? 7) * 0.4;
      linhas.slice(0, Math.max(1, Math.floor((h - 1) / alturaLinha))).forEach((l, i) => p.text(l, tx, y + 1 + alturaLinha * (i + 1) - 0.4, { align: alinhar }));
    } else {
      const caber = p.splitTextToSize(texto, w - 1.5) as string[];
      p.text(caber[0] ?? "", tx, y + h / 2 + (o.tamanho ?? 7) * 0.13, { align: alinhar });
    }
  }

  faixa(y: number, texto: string) {
    this.celula(10, y, 190, 5, texto, { fundo: AZUL, negrito: true, cor: [255, 255, 255], tamanho: 7.5 });
    this.pdf.setDrawColor(...LARANJA);
    this.pdf.rect(10, y, 190, 5, "S");
    this.pdf.setDrawColor(150, 150, 150);
  }

  cabecalho() {
    const p = this.pdf;
    p.setFont("helvetica", "normal");
    p.setFontSize(5.5);
    p.setTextColor(0, 0, 0);
    p.text(["Esse arquivo é gratuito e de uso", "exclusivo entre CAIXA, seus", "representantes legais e clientes."], 10, 8);
    p.text(["Esse Documento só tem validade se estiver", "assinado pelo Proponente e pelo Responsável", "Técnico pela execução da obra devidamente identificados."], 200, 8, { align: "right" });
    this.celula(62, 15, 14, 4, "0.03", { tamanho: 6, cor: AZUL });
    this.celula(76, 15, 40, 4, "Contrato", { tamanho: 6, cor: AZUL });
    this.celula(62, 19, 54, 4, this.contrato, { negrito: true, tamanho: 7, cor: AZUL, alinhar: "center" });
    this.celula(160, 15, 40, 4, "Grau de sigilo", { tamanho: 6, cor: AZUL, alinhar: "center" });
    this.celula(160, 19, 40, 4, "#EXTERNO.CONFIDENCIAL", { tamanho: 6, cor: AZUL, alinhar: "center" });
    if (this.logo) {
      try {
        const { largura, altura } = dimensoesImagem(this.logo);
        const h = 9;
        const w = Math.min(45, (largura / altura) * h);
        p.addImage(this.logo.dados, this.logo.tipo === "png" ? "PNG" : "JPEG", 14, 16, w, h);
      } catch {
        // logotipo ilegível: segue sem ele
      }
    }
    p.setFont("helvetica", "bold");
    p.setFontSize(10);
    // Cabeçalho ocupa a metade direita; títulos longos devem caber até a margem de 200 mm.
    const larguraTitulo = p.getTextWidth(this.titulo);
    if (larguraTitulo > 98) p.setFontSize(10 * 98 / larguraTitulo);
    p.setTextColor(...AZUL);
    p.text(this.titulo, 150, 29, { align: "center" });
    p.setFont("helvetica", "normal");
    p.setFontSize(7.5);
    p.text(this.subtitulo, 150, 32.5, { align: "center" });
    p.setDrawColor(...LARANJA);
    p.setLineWidth(0.5);
    p.line(10, 34.5, 200, 34.5);
    p.setLineWidth(0.15);
    p.setDrawColor(150, 150, 150);
    p.setTextColor(0, 0, 0);
  }

  rodapes() {
    const p = this.pdf;
    const total = p.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      p.setPage(i);
      p.setFont("helvetica", "normal");
      p.setFontSize(7);
      p.setTextColor(0, 0, 0);
      p.text(this.rodape, 105, 288, { align: "center" });
      p.setFontSize(6);
      p.text(this.subtitulo, 105, 291, { align: "center" });
      p.setFontSize(7);
      p.text(`${i}/${total}`, 200, 289, { align: "right" });
    }
  }

  novaPagina() {
    this.pdf.addPage();
    this.cabecalho();
  }

  identificacao(y: number, pci: DadosPci, completa: boolean): number {
    const i = pci.identificacao;
    const linha = (yy: number, campos: [number, number, string, string][]) => {
      for (const [x, w, rotulo] of campos) this.celula(x, yy, w, 3.6, rotulo, { tamanho: 6, cor: AZUL });
      for (const [x, w, , valor] of campos) this.celula(x, yy + 3.6, w, 3.8, valor, { negrito: true, tamanho: 6.5 });
      return yy + 7.4;
    };
    y = linha(y, [[10, 70, "Proponente", i.proponente], [80, 58, "E-mail", i.emailProponente], [138, 30, "CPF/CNPJ Prop.", i.cpfProponente], [168, 32, "Telefone Prop.", i.telefoneProponente]]);
    y = linha(y, [[10, 42, "RT pelo Proj. Arquit./Edif. – RTP", i.rtpNome], [52, 46, "E-mail – RTP", i.rtpEmail], [98, 30, "Nº CAU/CREA/CFT–RTP", i.rtpRegistro], [128, 10, "UF", i.rtpUf], [138, 30, "CPF – RTP", i.rtpCpf], [168, 32, "Telefone – RTP", i.rtpTelefone]]);
    y = linha(y, [[10, 42, "RT pela Execução da Obra – RTE", i.rteNome], [52, 46, "E-mail – RTE", i.rteEmail], [98, 30, "Nº CAU/CREA/CFT–RTE", i.rteRegistro], [128, 10, "UF", i.rteUf], [138, 30, "CPF – RTE", i.rteCpf], [168, 32, "Telefone – RTE", i.rteTelefone]]);
    this.celula(10, y, 190, 3.6, "Identificação do imóvel", { tamanho: 6.5, cor: AZUL });
    y += 3.6;
    y = linha(y, [[10, 120, "Endereço", i.endereco], [130, 70, "Complemento", i.complemento]]);
    y = linha(y, [[10, 60, "Bairro", i.bairro], [70, 22, "CEP", i.cep], [92, 98, "Município", i.municipio], [190, 10, "UF", i.uf]]);
    if (completa) {
      y = linha(y, [
        [10, 20, "Matrícula", i.matricula], [30, 30, "ORI (Regst. de Imóveis)", i.cartorio], [60, 36, "Coordenadas (Graus°, Min', S'')", [formatarCoordenada(i.latitude), formatarCoordenada(i.longitude)].filter(Boolean).join("   ")],
        [96, 40, "Construtora (se houver)", i.construtora], [136, 30, "CNPJ", i.cnpjConstrutora], [166, 34, "Finalidade", i.finalidade],
      ]);
    }
    return y;
  }

  fotos(fotos: { dados: Uint8Array; tipo: "jpeg" | "png"; legenda: string | null }[], quadros: number) {
    const lista = fotos.slice(0, quadros);
    const porPagina = 6;
    const paginas = Math.max(1, Math.ceil(quadros / porPagina));
    for (let pg = 0; pg < paginas; pg++) {
      this.novaPagina();
      this.faixa(37, "RELATÓRIO FOTOGRÁFICO");
      for (let k = 0; k < porPagina; k++) {
        const idx = pg * porPagina + k;
        if (idx >= quadros) break;
        const col = k % 2;
        const lin = Math.floor(k / 2);
        const x = 10 + col * 96;
        const y = 44 + lin * 79;
        const w = 94;
        const h = 72;
        this.celula(x, y, w, h, "");
        const f = lista[idx];
        if (f) {
          try {
            const { largura, altura } = dimensoesImagem(f);
            const esc = Math.min((w - 2) / largura, (h - 2) / altura);
            const iw = largura * esc;
            const ih = altura * esc;
            this.pdf.addImage(f.dados, f.tipo === "png" ? "PNG" : "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, "FAST");
          } catch {
            this.celula(x, y + h / 2 - 3, w, 6, "Foto ilegível", { borda: false, alinhar: "center" });
          }
        }
        this.celula(x, y + h, w, 5, f?.legenda?.trim() || "Descrever foto", { fundo: LILAS, tamanho: 6.5 });
      }
    }
  }

  assinaturas(y: number, pci: DadosPci, localData: string) {
    const i = pci.identificacao;
    const p = this.pdf;
    this.celula(10, y, 90, 6, localData, { negrito: true, tamanho: 7.5, cor: AZUL, borda: false });
    p.line(10, y + 6, 100, y + 6);
    this.celula(10, y + 6.5, 90, 4, "Local e data", { tamanho: 6.5, borda: false });
    const declaracao =
      "O CLIENTE e o RESPONSÁVEL TÉCNICO pela execução da obra declaram, sob as penas da Lei, que: as informações aqui prestadas são verídicas e correspondem fielmente a atual situação da obra; a obra está sendo executada conforme o projeto apresentado ao órgão municipal e à CAIXA, sem qualquer alteração ou desvio de finalidade; estão cientes de que eventuais irregularidades, identificadas no acompanhamento da obra, sujeitam ambos, o CLIENTE e o RESPONSÁVEL TÉCNICO, à inclusão no Cadastro Informativo de Pessoas Físicas e Jurídicas com relacionamento com a CAIXA – CONRES e as sanções civis, administrativas e criminais previstas em lei em eventuais falsidades nessas declarações.";
    this.celula(10, y + 14, 90, 30, declaracao, { tamanho: 6.3, quebra: true, cor: AZUL });
    const assinatura = (yy: number, papel: string, nome: string, cpf: string, extra?: string) => {
      p.line(110, yy, 200, yy);
      this.celula(110, yy + 0.5, 90, 4, papel, { tamanho: 6.5, borda: false });
      this.celula(110, yy + 4.5, 90, 4, `Nome: ${nome}`, { negrito: true, tamanho: 7, borda: false });
      this.celula(110, yy + 8.5, 90, 4, `CPF: ${cpf}${extra ? `      ${extra}` : ""}`, { tamanho: 7, borda: false });
    };
    assinatura(y + 6, "Cliente/Proponente", i.proponente, i.cpfProponente);
    assinatura(y + 28, "Responsável Técnico pela Execução da Obra", i.rteNome, i.rteCpf, `CAU/CREA/CFT: ${[i.rteRegistro, i.rteUf].filter(Boolean).join("/")}`);
  }

  saida(): Uint8Array {
    this.rodapes();
    return new Uint8Array(this.pdf.output("arraybuffer"));
  }
}

function logoDaPci(arquivoPci: Uint8Array, aba: string): FotoXls | null {
  try {
    const pasta = PastaBiff8.abrir(arquivoPci);
    // logotipo: imagem larga do cabeçalho (os ícones de seta são estreitos)
    const imgs = imagensDaAba(pasta, aba)
      .filter((i) => i.linha2 - i.linha1 <= 6 && i.coluna1 < 20 && i.imagem.dados.length > 200)
      .map((i) => ({ ...i, proporcao: (() => { const d = dimensoesImagem(i.imagem); return d.largura / Math.max(1, d.altura); })() }))
      .filter((i) => i.proporcao >= 2);
    imgs.sort((a, b) => b.linha1 - a.linha1);
    return imgs[0]?.imagem ?? null;
  } catch {
    return null;
  }
}

// ---------------- PLS ----------------

/** Situação em relação a uma curva: abaixo = ATRASADA. */
function situacao(acumulado: number, minimo: number | undefined, maximo?: number) {
  if (minimo === undefined) return "";
  if (maximo !== undefined && acumulado > maximo) return "ADIANTADA";
  return acumulado + 1e-9 >= minimo ? "NORMAL" : "ATRASADA";
}

function gerarPls(doc: Documento, e: EntradaMedicaoCaixa) {
  const r = calcularPls(e);
  const p = e.dados.pls;
  const pci = e.pci;
  doc.cabecalho();
  doc.faixa(37, "IDENTIFICAÇÃO DO PROPONENTE, RESPONSÁVEIS TÉCNICOS E DO IMÓVEL");
  let y = doc.identificacao(43, pci, true) + 1.5;
  doc.faixa(y, "PLANILHA DE LEVANTAMENTO DE SERVIÇOS - PLS");
  y += 6.5;
  const yTabela = y;

  // --- tabela de serviços (esquerda)
  doc.celula(10, y, 93, 4, "HABITAÇÃO", { alinhar: "center", tamanho: 7, cor: AZUL });
  y += 4;
  doc.celula(10, y, 51, 8, "Serviços", { alinhar: "center" });
  doc.celula(61, y, 14, 8, "Incidência", { alinhar: "center", tamanho: 6.3 });
  doc.celula(75, y, 14, 8, "Execução do Item", { alinhar: "center", tamanho: 5.8, quebra: true });
  doc.celula(89, y, 14, 8, "Execução na Obra", { alinhar: "center", tamanho: 5.8, quebra: true });
  y += 8;
  for (const t of [["%", 61], ["%", 75], ["%", 89]] as const) doc.celula(t[1], y, 14, 3.5, t[0], { alinhar: "center", tamanho: 6 });
  doc.celula(10, y, 51, 3.5, "");
  y += 3.5;
  const h = 3.6;
  NOMES_SERVICOS_PLS.forEach((nome, k) => {
    const exec = e.execucoes[k] ?? 0;
    doc.celula(10, y, 51, h, nome, { tamanho: 6.5, cor: AZUL });
    doc.celula(61, y, 14, h, num(pci.incidencias[k]), { alinhar: "right", negrito: true, tamanho: 6.5 });
    doc.celula(75, y, 14, h, exec > 0 ? `${num(exec, exec % 1 ? 2 : 0)}%` : "", { alinhar: "center", tamanho: 6.5, fundo: LILAS });
    doc.celula(89, y, 14, h, num(r.execucaoObra[k]), { alinhar: "right", tamanho: 6.5 });
    y += h;
  });
  const soma = pci.incidencias.reduce((s, v) => s + v, 0);
  doc.celula(10, y, 51, h, "Mensurado Acumulado Atual", { negrito: true, fundo: VERDE, tamanho: 6.5 });
  doc.celula(61, y, 14, h, num(soma), { alinhar: "right", negrito: true, tamanho: 6.5 });
  doc.celula(75, y, 14, h, "", { fundo: CINZA });
  doc.celula(89, y, 14, h, num(r.acumulado), { alinhar: "right", negrito: true, fundo: VERDE, tamanho: 6.5 });
  y += h;
  doc.celula(10, y, 51, 6, "Mensurado acumulado no mês anterior", { tamanho: 6.5, cor: AZUL });
  doc.celula(61, y, 28, 6, "", { fundo: CINZA });
  doc.celula(89, y, 14, 6, num(r.anterior), { alinhar: "right", negrito: true, fundo: LILAS, tamanho: 6.5 });
  y += 6;
  doc.celula(10, y, 79, h, "% Executado nessa etapa", { negrito: true, fundo: VERDE, tamanho: 6.5 });
  doc.celula(89, y, 14, h, num(r.executadoEtapa), { alinhar: "right", negrito: true, fundo: VERDE, tamanho: 6.5 });
  y += h + 0.5;
  const etapa = r.etapa ?? 0;
  doc.celula(10, y, 65, h, "Etapa de referência:", { tamanho: 6.5, borda: false });
  doc.celula(75, y, 28, h, r.etapa === null ? "" : String(r.etapa), { alinhar: "center", negrito: true, tamanho: 7, borda: false });
  y += h;
  const sitRef = situacao(r.acumulado, pci.curvaLenta[etapa], pci.curvaRapida[etapa]);
  const sitProp = situacao(r.acumulado, pci.cronogramaProposto[Math.min(etapa, pci.cronogramaProposto.length - 1)]);
  doc.celula(10, y, 65, h, "Situação da obra - Cronog./Curva de Referência:", { tamanho: 6.3, alinhar: "right", borda: false });
  doc.celula(75, y, 28, h, sitRef, { alinhar: "center", negrito: true, tamanho: 6.5, fundo: sitRef === "ATRASADA" ? [252, 228, 214] : [255, 242, 204] });
  y += h;
  doc.celula(10, y, 65, h, "Situação da obra - Cronograma Proposto:", { tamanho: 6.3, alinhar: "right", borda: false });
  doc.celula(75, y, 28, h, sitProp, { alinhar: "center", negrito: true, tamanho: 6.5, fundo: sitProp === "ATRASADA" ? [252, 228, 214] : [255, 242, 204] });
  y += h + 0.5;
  doc.celula(10, y, 93, 3.6, "Observações", { tamanho: 6.5, borda: false });
  y += 3.6;
  doc.celula(10, y, 93, 285 - 12 - y, p.observacoes, { fundo: LILAS, quebra: true, tamanho: 7 });

  // --- datas e qualidade (direita)
  let d = yTabela;
  const X = 106;
  doc.celula(X, d, 44, 4, "DATAS & QUALIDADE", { negrito: true, tamanho: 7, cor: AZUL });
  doc.celula(X + 44, d, 22, 4, "Valor do imóvel", { tamanho: 6, alinhar: "right" });
  doc.celula(X + 66, d, 28, 4, reais(r.valorImovel), { negrito: true, alinhar: "right", fundo: VERDE, tamanho: 6.5 });
  d += 4;
  const linhaData = (rotulo: string, valor: string, extraRot?: string, extraVal?: string, fundo?: Cor) => {
    doc.celula(X, d, 30, 3.8, rotulo, { tamanho: 6.2 });
    doc.celula(X + 30, d, 22, 3.8, valor, { negrito: true, alinhar: "center", tamanho: 6.3, fundo });
    doc.celula(X + 52, d, 30, 3.8, extraRot ?? "", { tamanho: 6, alinhar: "right" });
    doc.celula(X + 82, d, 12, 3.8, extraVal ?? "", { negrito: true, alinhar: "center", tamanho: 6.3, fundo: extraVal ? VERDE : undefined });
    d += 3.8;
  };
  linhaData("Contratação", dataBr(r.dataContratacao), "Nº Etapas original", pci.prazoMeses ? String(pci.prazoMeses) : "", VERDE);
  linhaData("Data início de obra", dataBr(r.inicio));
  linhaData("Término Previsto", dataBr(r.termino));
  linhaData("Data do Levantamento", dataBr(p.dataLevantamento), "", "", VERDE);
  doc.celula(X, d, 52, 5, "Houve Repatuação de prazo?", { tamanho: 6.2 });
  doc.celula(X + 52, d, 12, 5, simNao(p.houveRepactuacao), { alinhar: "center", fundo: LILAS, tamanho: 6.3 });
  doc.celula(X + 64, d, 18, 2.5, "Etapas Repact.", { tamanho: 5.5, alinhar: "right" });
  doc.celula(X + 82, d, 12, 2.5, p.houveRepactuacao && p.etapasRepactuadas ? String(p.etapasRepactuadas) : "", { tamanho: 6, alinhar: "center" });
  doc.celula(X + 64, d + 2.5, 18, 2.5, "Total de etapas", { tamanho: 5.5, alinhar: "right" });
  doc.celula(X + 82, d + 2.5, 12, 2.5, r.prazo ? String(r.prazo) : "", { tamanho: 6, alinhar: "center", negrito: true });
  d += 5;
  const alvaraValido = p.alvaraVigencia ? (p.dataLevantamento <= p.alvaraVigencia ? "Sim" : "Não") : "";
  const pergunta = (texto: string, resposta: string, altura = 3.8) => {
    doc.celula(X, d, 76, altura, texto, { tamanho: 6, quebra: altura > 4 });
    doc.celula(X + 76, d, 18, altura, resposta, { alinhar: "center", fundo: LILAS, tamanho: 6.3 });
    d += altura;
  };
  pergunta("A execução da obra está observando as condições contratadas?", simNao(p.condicoesContratadas));
  pergunta("A placa/adesivo CAIXA está afixada na obra?", simNao(p.placaAfixada));
  pergunta("O alvará está válido?", alvaraValido);
  doc.celula(X, d, 22, 3.8, "Data Emissão Alvará", { tamanho: 5.8 });
  doc.celula(X + 22, d, 18, 3.8, dataBr(p.alvaraEmissao), { negrito: true, alinhar: "center", fundo: VERDE, tamanho: 6 });
  doc.celula(X + 40, d, 30, 3.8, "Data Vigência Alvará", { tamanho: 5.8, alinhar: "right" });
  doc.celula(X + 70, d, 24, 3.8, dataBr(p.alvaraVigencia), { negrito: true, alinhar: "center", fundo: VERDE, tamanho: 6 });
  d += 3.8;
  pergunta("Projeto e especificações estão sendo cumpridos?", simNao(p.projetoCumprido));
  pergunta("Os serviços estão sendo executados de modo a prevenir o aparecimento de danos físicos/vícios futuros?", simNao(p.prevencaoDanos), 6);
  doc.celula(X, d, 94, 6, "O Adesivo afixado deverá aparecer em ao menos uma das fotos do Relatório Fotográfico.", {
    borda: false, negrito: true, cor: LARANJA, tamanho: 6.3, alinhar: "center", quebra: true,
  });
  d += 6.5;
  doc.celula(X, d, 94, 4, "CURVA DE EVOLUÇÃO DA OBRA", { negrito: true, alinhar: "center", tamanho: 6.5, cor: AZUL });
  d += 4;
  const cab = [["Etapas", 14], ["Acumul. PLS", 20], ["Acumul. Aferido", 20], ["Acumul. Adotado", 20], ["Mês referência", 20]] as const;
  let cx = X;
  for (const [t, w] of cab) {
    doc.celula(cx, d, w, 3.6, t, { alinhar: "center", tamanho: 5.8 });
    cx += w;
  }
  d += 3.6;
  const medicoes = [...e.anteriores, { data: p.dataLevantamento, progresso: r.acumulado }];
  const porEtapa = acumuladoPorEtapa(r.inicio, medicoes);
  // H6: etapas pelo prazo (ou pelo cronograma da PCI), sempre até a etapa atual.
  const etapas = Math.max(r.prazo ?? 0, pci.cronogramaProposto.length - 1, etapa);
  const curva = curvaDeEvolucao(r.inicio, medicoes, etapas);
  // Todas as etapas cabem na página: com prazo longo (até 48) as linhas encolhem.
  const espaco = 285 - 12 - d;
  const linhas = Math.max(Math.floor(espaco / 3.4), curva.length);
  const hLinha = Math.min(3.4, espaco / linhas);
  const fonte = hLinha >= 3.2 ? 6 : Math.max(4.2, hLinha * 1.8);
  for (let k = 0; k < linhas; k++) {
    const l = curva[k];
    cx = X;
    const valores = l
      ? [String(k), l.pls === null ? "" : num(l.pls), l.aferido === null ? "" : num(l.aferido), l.adotado === null ? "" : num(l.adotado), l.mes ? dataBr(l.mes) : ""]
      : ["", "", "", "", ""];
    cab.forEach(([, w], i) => {
      doc.celula(cx, d, w, hLinha, valores[i], { alinhar: "center", tamanho: fonte, negrito: i === 1 || i === 3, fundo: i === 1 || i === 2 ? LILAS : i === 4 && l ? VERDE : undefined });
      cx += w;
    });
    d += hLinha;
  }

  // --- página 2: indicadores e gráfico
  doc.novaPagina();
  let y2 = 38;
  const inferior3 = (() => {
    let seguidas = 0;
    let maior = 0;
    let atual = 0;
    for (let k = 1; k <= etapa; k++) {
      const v = porEtapa.get(k);
      if (v !== undefined) atual = v;
      if (pci.curvaLenta[k] !== undefined && atual < pci.curvaLenta[k]) seguidas++;
      else seguidas = 0;
      maior = Math.max(maior, seguidas);
    }
    return maior >= 3;
  })();
  const valor = r.valorImovel ?? 0;
  const ultrapassa = (valor <= 264000 && r.executadoEtapa > 26) || (valor > 264000 && valor <= 500000 && r.executadoEtapa > 17) || (valor > 500000 && r.executadoEtapa > 14);
  const indicador = (texto: string, resposta: string, fundo: Cor) => {
    doc.celula(10, y2, 166, 4.5, texto, { tamanho: 6.8, cor: AZUL });
    doc.celula(176, y2, 24, 4.5, resposta, { alinhar: "center", negrito: true, tamanho: 6.8, fundo });
    y2 += 4.5;
  };
  indicador("Operação com evolução inferior a referência por 3 ou mais etapas consecutivas?", inferior3 ? "Sim" : "Não", VERDE);
  indicador(" % Executado nessa etapa da PLS  ultrapassa a referência de evolução típica mensal?", ultrapassa ? "Sim" : "Não", [255, 199, 206]);
  indicador("É optante pelo Selo Casa Azul Caixa - Unidade Isolada?", p.seloCasaAzul ? "Sim" : "Não", LILAS);
  y2 += 4;
  graficoCurvas(doc.pdf, 14, y2, 182, 80, porEtapa, pci.curvaNormal);

  doc.fotos(e.fotos, 12);
  doc.novaPagina();
  doc.assinaturas(40, pci, localEData(pci.identificacao.municipio, p.dataLevantamento));
}

function graficoCurvas(p: jsPDF, x: number, y: number, w: number, h: number, porEtapa: Map<number, number>, normal: number[]) {
  p.setDrawColor(180, 180, 180);
  p.rect(x, y, w, h);
  p.setFont("helvetica", "bold");
  p.setFontSize(8);
  p.setTextColor(90, 90, 90);
  p.text("Curvas de Evolução da Obra", x + w / 2, y + 5, { align: "center" });
  const gx = x + 14;
  const gy = y + 9;
  const gw = w - 20;
  const gh = h - 22;
  const etapas = 48;
  p.setFont("helvetica", "normal");
  p.setFontSize(5.5);
  p.setTextColor(0, 0, 0);
  for (let v = 0; v <= 100; v += 10) {
    const yy = gy + gh - (v / 100) * gh;
    p.setDrawColor(225, 225, 225);
    p.line(gx, yy, gx + gw, yy);
    p.text(String(v), gx - 1.5, yy + 0.8, { align: "right" });
  }
  for (let k = 1; k <= etapas; k++) {
    const xx = gx + ((k - 1) / (etapas - 1)) * gw;
    p.text(String(k), xx, gy + gh + 3, { align: "center" });
  }
  p.text("Nº ETAPA", gx + gw / 2 - 30, gy + gh + 7);
  p.text("PERCENTUAL ACUMULADO (%)", x + 4, gy + gh / 2 + 15, { angle: 90 });
  const ponto = (k: number, v: number) => [gx + (k / (etapas - 1)) * gw, gy + gh - (Math.min(100, Math.max(0, v)) / 100) * gh] as const;
  const desenhar = (valores: number[], cor: Cor, largura: number) => {
    p.setDrawColor(...cor);
    p.setLineWidth(largura);
    for (let k = 1; k < valores.length; k++) {
      const [x1, y1] = ponto(k - 1, valores[k - 1]);
      const [x2, y2] = ponto(k, valores[k]);
      p.line(x1, y1, x2, y2);
    }
    p.setLineWidth(0.15);
  };
  const ultima = Math.max(0, ...Array.from(porEtapa.keys()));
  const pls: number[] = [];
  const adotado: number[] = [];
  let a = 0;
  for (let k = 0; k < etapas; k++) {
    const v = porEtapa.get(k);
    if (v !== undefined) a = v;
    if (k <= ultima) pls.push(v ?? (pls.length ? pls[pls.length - 1] : 0));
    adotado.push(a);
  }
  desenhar(normal.slice(0, etapas).concat(Array(Math.max(0, etapas - normal.length)).fill(100)), [255, 192, 0], 0.5);
  desenhar(adotado, [55, 86, 35], 0.6);
  desenhar(pls, [0, 112, 192], 0.4);
  const legenda = [["Acumul. PLS", [0, 112, 192]], ["Acumul. Adotado", [55, 86, 35]], ["Curva Normal", [255, 192, 0]]] as const;
  legenda.forEach(([t, c], i) => {
    const lx = gx + gw / 2 - 5 + i * 30;
    p.setDrawColor(c[0], c[1], c[2]);
    p.setLineWidth(0.6);
    p.line(lx, gy + gh + 6.5, lx + 6, gy + gh + 6.5);
    p.setLineWidth(0.15);
    p.text(t, lx + 7, gy + gh + 7.2);
  });
  p.setDrawColor(150, 150, 150);
}

// ---------------- Repactuação ----------------

function gerarRepactuacao(doc: Documento, e: EntradaMedicaoCaixa, d: DadosRepactuacao) {
  const pci = e.pci;
  doc.cabecalho();
  doc.faixa(37, "IDENTIFICAÇÃO");
  let y = doc.identificacao(43, pci, false) + 2;
  doc.faixa(y, "QUADRO RESUMO - REPACTUAÇÃO DE PRAZO");
  y += 6;
  const inicio = inicioDaMedicao(e);
  const r = calcularPls(e);
  const real = acumuladoPorEtapa(inicio, [...e.anteriores, { data: e.dados.pls.dataLevantamento, progresso: r.acumulado }]);
  const [ai, mi] = (inicio ?? d.dataRepactuacao).split("-").map(Number);
  const [ar, mr] = d.dataRepactuacao.split("-").map(Number);
  const etapaRepact = Math.max(0, ar * 12 + mr - (ai * 12 + mi));
  const reais = Array.from(real.entries()).filter(([k]) => k <= etapaRepact).sort((a, b) => a[0] - b[0]);
  const executado = reais.length ? Math.max(...reais.map(([, v]) => v)) : 0;
  const incrementos = reais.map(([, v], i) => v - (i ? reais[i - 1][1] : 0));
  const maxMensal = incrementos.length ? Math.max(...incrementos) : 0;
  const mediaMensal = incrementos.length ? incrementos.reduce((s, v) => s + v, 0) / incrementos.length : 0;
  const termino = inicio && d.prazoProposto ? somarMeses(inicio, d.prazoProposto) : null;
  const par = (x: number, rot: string, val: string, wr = 28, wv = 20, fundo?: Cor) => {
    doc.celula(x, y, wr, 4, rot, { tamanho: 6.3, fundo });
    doc.celula(x + wr, y, wv, 4, val, { negrito: true, alinhar: "center", tamanho: 6.5, fundo: fundo ?? LILAS });
  };
  par(10, "Data Contratação", dataBr(r.dataContratacao));
  par(60, "Prazo Original", d.prazoOriginal ? String(d.prazoOriginal) : "");
  par(110, "Etapa Repactuação", String(etapaRepact), 30, 14, VERDE);
  par(156, "Executado acumulado", num(executado), 30, 14, VERDE);
  y += 4;
  par(10, "Início de obra", dataBr(inicio), 28, 20, VERDE);
  par(60, "Prazo sugerido", "", 28, 20, VERDE);
  par(110, "Evolução mensal máxima", num(maxMensal), 30, 14, VERDE);
  y += 4;
  par(10, "Data Repactuação", dataBr(d.dataRepactuacao));
  par(60, "Prazo Proposto", d.prazoProposto ? String(d.prazoProposto) : "");
  par(110, "Evolução média mensal", num(mediaMensal), 30, 14, VERDE);
  par(156, "Data Término Proposta", dataBr(termino), 30, 14, VERDE);
  y += 6;
  doc.celula(10, y, 92, 5, "Evolução prazo original (Acatado na contratação do financiamento)", { negrito: true, alinhar: "center", tamanho: 6.3 });
  doc.celula(104, y, 96, 5, "Evolução Proposta", { negrito: true, alinhar: "center", tamanho: 6.3 });
  y += 5;
  const cabO = [["Etapas", 14], ["Referência final etapa", 26], ["% Acumulado Previsto", 26], ["%Acumulado Real", 26]] as const;
  const cabP = [["Etapas", 14], ["Referência final etapa", 30], ["% Acumulado", 52]] as const;
  let cx = 10;
  for (const [t, w] of cabO) {
    doc.celula(cx, y, w, 5, t, { alinhar: "center", tamanho: 5.8, quebra: true });
    cx += w;
  }
  cx = 104;
  for (const [t, w] of cabP) {
    doc.celula(cx, y, w, 5, t, { alinhar: "center", tamanho: 5.8 });
    cx += w;
  }
  y += 5;
  const total = Math.min(24, Math.max(d.prazoOriginal ?? 0, d.prazoProposto ?? 0, etapaRepact));
  for (let k = 0; k <= total; k++) {
    const ref = inicio ? dataBr(somarMeses(inicio, k)) : "";
    const previsto = d.previstoOriginal[k] ?? pci.cronogramaProposto[k] ?? null;
    const rk = k <= etapaRepact ? real.get(k) : undefined;
    const proposto = k <= etapaRepact ? rk ?? null : d.acumuladoProposto[k] ?? null;
    const vO = [String(k), k <= (d.prazoOriginal ?? 0) ? ref : "", num(previsto), rk === undefined ? "" : num(rk)];
    cx = 10;
    cabO.forEach(([, w], i) => {
      doc.celula(cx, y, w, 3.6, vO[i], { alinhar: "center", tamanho: 6.2, fundo: i === 0 && k <= etapaRepact ? LARANJA : i >= 2 ? LILAS : undefined, negrito: i >= 2 });
      cx += w;
    });
    const vP = [String(k), k <= (d.prazoProposto ?? 0) ? ref : "", proposto === null ? "" : num(proposto)];
    cx = 104;
    cabP.forEach(([, w], i) => {
      doc.celula(cx, y, w, 3.6, vP[i], { alinhar: "center", tamanho: 6.2, fundo: i === 0 && k <= etapaRepact ? [84, 130, 53] : i === 2 ? LILAS : undefined, negrito: i === 2 });
      cx += w;
    });
    y += 3.6;
  }
  y += 3;
  doc.celula(10, y, 190, 4.5, "Motivo/Justificativas do Pedido de Repactuação de Prazo", { negrito: true, tamanho: 6.8, cor: AZUL });
  y += 4.5;
  doc.celula(10, y, 190, Math.max(20, Math.min(50, 280 - y)), d.motivo, { quebra: true, tamanho: 7, fundo: LILAS });
  doc.fotos(e.fotos, 6);
  doc.novaPagina();
  doc.assinaturas(40, pci, localEData(pci.identificacao.municipio, d.dataRepactuacao));
}

// ---------------- Alteração de projeto ----------------

function gerarAlteracao(doc: Documento, e: EntradaMedicaoCaixa, a: DadosAlteracao) {
  const pci = e.pci;
  doc.cabecalho();
  doc.faixa(37, "IDENTIFICAÇÃO");
  let y = doc.identificacao(43, pci, false) + 2;
  doc.faixa(y, "PROPOSTA DE ALTERAÇÃO");
  y += 6;
  doc.celula(10, y, 190, 15,
    "Necessário apresentar: - Novo Projeto Legal, mostrando claramente as alterações e aprovado pelos órgãos competentes (quando o projeto legal não incluir o layout interno da unidade como é o caso da aprovação simplificada, tal layout, bem como cortes e fachadas, deverá ser apresentado pelo cliente para análise da proposta); - ART/RRT/TRT do projeto legal alterado. novos projetos aprovados; - Detalhes de projeto que demonstrem as alterações propostas; - Documentações adicionais no caso de alteração para sistema construtivo inovador (verificar documentação na Cartilha Habitação PF, disponível no site da CAIXA); Documentação adicional pode ser solicitada caso seja necessária para esclarecimento de dúvidas.",
    { quebra: true, tamanho: 6.2, negrito: true, cor: AZUL });
  y += 15.5;
  doc.celula(10, y, 190, 4, "Justificativa Técnica (embasar técnica e financeiramente as alterações propostas)", { negrito: true, tamanho: 6.5, cor: AZUL });
  y += 4;
  doc.celula(10, y, 190, 16, a.justificativa, { quebra: true, tamanho: 7, fundo: LILAS });
  y += 17;
  const q = (rotulo: string, valor: string, extraRot?: string, extraVal?: string) => {
    const alt = extraRot ? 6 : 4.2;
    doc.celula(10, y, 55, alt, rotulo, { tamanho: 6.3, quebra: alt > 4.5 });
    doc.celula(65, y, 25, alt, valor, { alinhar: "center", tamanho: 6.5, fundo: LILAS });
    if (extraRot !== undefined) {
      doc.celula(90, y, 40, alt, extraRot, { tamanho: 6, quebra: true });
      doc.celula(130, y, 70, alt, extraVal ?? "", { tamanho: 6.5, fundo: LILAS, quebra: true });
    }
    y += alt;
  };
  q("A proposta prevê alteração de especificações?", a.alteraEspecificacoes);
  q("A proposta prevê alteração de área?", a.alteraArea, "Nova área coberta / permeável / acessória (m²)",
    a.alteraArea === "Sim" ? [a.novaAreaCoberta, a.novaAreaPermeavel, a.novaAreaAcessoria].map((v) => num(v)).join("  /  ") : "");
  q("A proposta prevê inclusão ou exclusão de cômodos?", a.comodos, "Informe qual(quais) cômodo(s)", a.comodosQuais);
  q("A proposta prevê alteração de serviços?", a.servicos, "Informe qual(quais) serviço(s)", a.servicosQuais);
  q("A proposta prevê alteração do sistema construtivo?", a.alteraSistema);
  doc.celula(10, y, 55, 4.2, "Informe o novo sistema proposto:", { tamanho: 6.3 });
  doc.celula(65, y, 135, 4.2, a.novoSistema, { tamanho: 6.3, fundo: LILAS });
  y += 4.2;
  doc.celula(10, y, 55, 7, "Especificar sistema construtivo", { tamanho: 6.3 });
  doc.celula(65, y, 135, 7, a.especificacaoSistema, { tamanho: 6.3, fundo: LILAS, quebra: true });
  y += 7;
  doc.celula(10, y, 40, 4.2, "Montagem/fabricação das paredes", { tamanho: 6 });
  doc.celula(50, y, 32, 4.2, a.montagemParedes, { tamanho: 6, fundo: LILAS });
  doc.celula(82, y, 20, 4.2, "Tipo de Fôrmas", { tamanho: 6 });
  doc.celula(102, y, 20, 4.2, a.tipoFormas, { tamanho: 6, fundo: LILAS });
  doc.celula(122, y, 60, 4.2, "As fôrmas permanecem incorporadas nas paredes acabadas?", { tamanho: 5.8 });
  doc.celula(182, y, 18, 4.2, a.formasIncorporadas, { tamanho: 6, fundo: LILAS });
  y += 4.2;
  q("A paredes desempenham função estrutural?", a.paredesEstruturais);
  q("Apresentou Doc. Complem. Sistema Inovador?", a.docComplementar);
  y += 3;
  doc.faixa(y, "Custos");
  y += 6;
  const r = calcularAlteracao(a);
  const cab = [["Item", 10], ["Serviços", 70], ["Incidência", 18], ["Custos [R$]", 26], ["% Ac.", 18], ["Mínimo [%]", 24], ["Máximo [%]", 24]] as const;
  let cx = 10;
  for (const [t, w] of cab) {
    doc.celula(cx, y, w, 4, t, { alinhar: "center", tamanho: 6.2, negrito: true });
    cx += w;
  }
  y += 4;
  NOMES_SERVICOS_PROPOSTA.forEach((nome, k) => {
    if (y > 270) {
      doc.novaPagina();
      y = 40;
    }
    const v = [String(k + 1), nome, num(r.incidencias[k]), reais(r.custos[k]), num(r.acumulados[k]), num(pci.incidenciaMinima[k]), num(pci.incidenciaMaxima[k])];
    cx = 10;
    cab.forEach(([, w], i) => {
      doc.celula(cx, y, w, 3.6, v[i], { alinhar: i === 1 ? "left" : i === 0 ? "center" : "right", tamanho: 6.2, fundo: i === 3 && k < 19 ? LILAS : i >= 5 ? [248, 203, 173] : undefined });
      cx += w;
    });
    y += 3.6;
  });
  const tot = (rot: string, val: string, extraRot?: string, extraVal?: string) => {
    doc.celula(10, y, 98, 4, rot, { alinhar: "right", tamanho: 6.5, negrito: true });
    doc.celula(108, y, 26, 4, val, { alinhar: "right", tamanho: 6.5, negrito: true, fundo: VERDE });
    if (extraRot) {
      doc.celula(134, y, 30, 4, extraRot, { tamanho: 6.3 });
      doc.celula(164, y, 36, 4, extraVal ?? "", { tamanho: 6.3, fundo: LILAS });
    }
    y += 4;
  };
  tot("Custo Total de Serviços", reais(r.total), "Executor da obra", a.executor);
  tot(`BDI ${a.bdi === null ? "" : num(a.bdi) + "%"}`, reais(r.valorBdi));
  tot("Custo Total com BDI", reais(r.totalComBdi));
  y += 3;
  if (y > 250) {
    doc.novaPagina();
    y = 40;
  }
  doc.celula(10, y, 190, 4, "Serviços adicionais", { negrito: true, tamanho: 6.8, cor: AZUL });
  y += 4;
  const adicionais = [...a.adicionais.slice(0, 4), ...Array.from({ length: Math.max(0, 4 - a.adicionais.length) }, () => ({ descricao: "", custo: null }))];
  adicionais.forEach((s, k) => {
    doc.celula(10, y, 10, 3.8, String(k + 1), { alinhar: "center", tamanho: 6.3 });
    doc.celula(20, y, 80, 3.8, s.descricao, { tamanho: 6.3, fundo: LILAS });
    doc.celula(100, y, 30, 3.8, reais(s.custo), { alinhar: "right", tamanho: 6.3, fundo: LILAS });
    y += 3.8;
  });
  doc.celula(10, y, 90, 3.8, "TOTAIS", { negrito: true, tamanho: 6.3, alinhar: "right" });
  doc.celula(100, y, 30, 3.8, reais(r.totalAdicionais), { alinhar: "right", tamanho: 6.3, negrito: true, fundo: VERDE });
  doc.celula(134, y - 15.2, 40, 3.8, "Novo Custo Total de Serviços", { tamanho: 6 });
  doc.celula(174, y - 15.2, 26, 3.8, reais(r.total), { alinhar: "right", tamanho: 6.3, negrito: true });
  doc.celula(134, y - 11.4, 40, 3.8, "Novo Custo Total c/ BDI", { tamanho: 6 });
  doc.celula(174, y - 11.4, 26, 3.8, reais(r.totalComBdi), { alinhar: "right", tamanho: 6.3, negrito: true });
  doc.fotos(e.fotos, 6);
  doc.novaPagina();
  doc.assinaturas(40, pci, localEData(pci.identificacao.municipio, e.dados.pls.dataLevantamento));
}

const MODELOS = {
  pls: { titulo: "Planilha de Levantamento de Serviços – PLS", rodape: "PLS", aba: ABA_PLS },
  repactuacao: { titulo: "Proposta de Repactuação de Prazo", rodape: "Repactuação_Prazo", aba: "Repactuação_Prazo" },
  alteracao: { titulo: "Proposta de Alteração de Projeto/Especificação", rodape: "Alteração_Projeto_Especific", aba: "Alteração_Projeto_Especific" },
} as const;

export function gerarPdfMedicao(arquivoPci: Uint8Array | null, e: EntradaMedicaoCaixa): Uint8Array {
  const m = MODELOS[e.tipo];
  const logo = arquivoPci && e.pci.formato === "xls" ? logoDaPci(arquivoPci, m.aba) : null;
  const doc = new Documento(m.titulo, "Construção em Terreno Próprio e Aquisição de Terreno e Construção", m.rodape, dadosDoContrato(e).numeroContrato, logo);
  if (e.tipo === "repactuacao" && e.dados.repactuacao) gerarRepactuacao(doc, e, e.dados.repactuacao);
  else if (e.tipo === "alteracao" && e.dados.alteracao) gerarAlteracao(doc, e, e.dados.alteracao);
  else gerarPls(doc, e);
  return doc.saida();
}

export { etapaDaData };
