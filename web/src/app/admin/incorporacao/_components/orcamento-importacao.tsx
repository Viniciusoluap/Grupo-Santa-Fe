"use client";
import { useState } from "react";
import { NumeroBRField } from "@/components/ui/numero-br-field";
import type { LinhaOrcamentoExcel, PremissasOrcamentoParametrizado } from "@/lib/orcamento/parametrizado";
import { lerLinhasOrcamento, type MapeamentoOrcamento } from "@/lib/incorporacao/orcamento-importacao";

type Planilha = { nome: string; base64: string; abas: string[]; matrizPorAba: Record<string, unknown[][]>; formulasPorAba: Record<string, Record<string, string>> };
const cls = "w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-2 text-sm";
const campos = ["descricao", "unidade", "quantidade", "unitario", "total"] as const;
const rotulos = { descricao: "Descrição", unidade: "Unidade", quantidade: "Quantidade", unitario: "Preço unitário", total: "Total" };
const vazio: MapeamentoOrcamento = { descricao: 0, unidade: 1, quantidade: 2, unitario: 3, total: 4 };

/** Upload local para conferência; o arquivo original e os itens só persistem ao salvar o orçamento. */
export function OrcamentoImportacao({ dados, onChange, areaReferencia }: { dados: PremissasOrcamentoParametrizado; onChange: (d: PremissasOrcamentoParametrizado) => void; areaReferencia: number }) {
  const [arquivo, setArquivo] = useState<Planilha | null>(null);
  const [aba, setAba] = useState(""); const [cabecalho, setCabecalho] = useState(1);
  const [mapa, setMapa] = useState<MapeamentoOrcamento>(vazio);
  const [erro, setErro] = useState(""); const [lendo, setLendo] = useState(false);
  const metodo = dados.metodo ?? "construcao";
  const linhas = metodo === "excel" ? dados.importacaoExcel?.itens ?? [] : dados.infraestrutura ?? [];
  const matriz = arquivo?.matrizPorAba[aba] ?? [];
  const preview = arquivo ? lerLinhasOrcamento(matriz, cabecalho, mapa, arquivo.formulasPorAba[aba]) : [];

  async function abrir(file?: File) {
    if (!file) return;
    setErro(""); setLendo(true);
    try {
      if (!/\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name)) throw new Error("Selecione uma planilha Excel.");
      if (file.size > 2 * 1024 * 1024) throw new Error("A planilha deve ter até 2 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const xlsx = await import("xlsx");
      const book = xlsx.read(bytes, { type: "array", cellFormula: true });
      if (!book.SheetNames.length) throw new Error("Planilha sem abas.");
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const matrizPorAba: Record<string, unknown[][]> = {}; const formulasPorAba: Record<string, Record<string, string>> = {};
      for (const nome of book.SheetNames) {
        const sheet = book.Sheets[nome];
        const ref = xlsx.utils.decode_range(sheet["!ref"] ?? "A1");
        if (ref.e.r > 20000 || ref.e.c > 200) throw new Error("Use uma planilha de orçamento com até 20.000 linhas e 200 colunas.");
        matrizPorAba[nome] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: true });
        formulasPorAba[nome] = Object.fromEntries(Object.entries(sheet).filter(([k, c]) => !k.startsWith("!") && c?.f).map(([k, c]) => [k, c.f as string]));
      }
      setArquivo({ nome: file.name, base64: btoa(binary), abas: book.SheetNames, matrizPorAba, formulasPorAba });
      setAba(book.SheetNames[0]); setCabecalho(1); setMapa(vazio);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao ler planilha."); }
    finally { setLendo(false); }
  }

  function editar(i: number, campo: keyof LinhaOrcamentoExcel, valor: string | number) {
    const alteradas = linhas.map((l, j) => {
      if (i !== j) return l;
      const item = { ...l, [campo]: valor };
      if (campo === "quantidade" || campo === "unitario") item.total = Math.round(item.quantidade * item.unitario * 100) / 100;
      return item;
    });
    aplicarLinhas(alteradas);
  }
  function aplicarLinhas(itens: LinhaOrcamentoExcel[]) {
    if (metodo === "excel" && dados.importacaoExcel) onChange({ ...dados, importacaoExcel: { ...dados.importacaoExcel, itens } });
    else onChange({ ...dados, infraestrutura: itens });
  }
  function baixarOriginal() {
    const a = dados.importacaoExcel; if (!a) return;
    const bytes = Uint8Array.from(atob(a.originalBase64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes])); const link = document.createElement("a");
    link.href = url; link.download = a.nome; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
    <label className="block text-sm font-bold">Método do orçamento<select className={`${cls} mt-1`} value={metodo} onChange={(e) => { if (confirm("Alterar o método ativo? Os dados dos outros métodos serão preservados, mas não serão somados ao total.")) onChange({ ...dados, metodo: e.target.value as PremissasOrcamentoParametrizado["metodo"], areaReferenciaM2: dados.areaReferenciaM2 ?? areaReferencia }); }}>
      <option value="construcao">Edificação — área construída equivalente</option><option value="infraestrutura">Lotes — infraestrutura por quantidade</option><option value="excel">Itens da planilha Excel</option>
    </select></label>
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">Importar Excel<input type="file" accept=".xls,.xlsx,.xlsm,.xlsb" disabled={lendo} className="mt-1 block max-w-full" onChange={(e) => void abrir(e.target.files?.[0])} /></label>
      {dados.importacaoExcel && <button type="button" className="rounded border px-3 py-2 text-sm" onClick={baixarOriginal}>Baixar original: {dados.importacaoExcel.nome}</button>}</div>
    {lendo && <p role="status">Lendo planilha…</p>}{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    {arquivo && <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3">
      <h3 className="font-bold">Conferência: {arquivo.nome}</h3>
      <p className="text-xs">Fórmulas usam os resultados calculados e salvos no Excel. Revise células sem resultado; macros não são executadas. Linhas de subtotal/total devem ser removidas da prévia para evitar dupla contagem.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Aba<select value={aba} onChange={(e) => setAba(e.target.value)} className={cls}>{arquivo.abas.map((a) => <option key={a}>{a}</option>)}</select></label><label className="text-xs">Linha do cabeçalho<input type="number" min={1} max={Math.max(1, matriz.length)} value={cabecalho} onChange={(e) => setCabecalho(Math.max(1, Number(e.target.value) || 1))} className={cls} /></label></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{campos.map((c) => <label key={c} className="min-w-0 text-xs">{rotulos[c]}<select className={cls} value={mapa[c]} onChange={(e) => setMapa({ ...mapa, [c]: Number(e.target.value) })}><option value={-1}>Não mapear</option>{(matriz[cabecalho - 1] ?? []).map((v, i) => <option key={i} value={i}>{i + 1}: {String(v ?? "Coluna sem título")}</option>)}</select></label>)}</div>
      <p className="text-sm">{preview.length} item(ns) identificados. Confira e edite após importar; salve ao concluir.</p>
      <div className="max-h-52 overflow-auto text-xs">{preview.slice(0, 100).map((l, i) => <p key={i}>{i + 1}. {l.descricao} · {l.quantidade} {l.unidade} · R$ {l.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{l.formula ? ` · fórmula: ${l.formula}` : ""}</p>)}</div>
      <button type="button" disabled={!preview.length} className="rounded border bg-white px-3 py-2 text-sm font-bold disabled:opacity-50" onClick={() => {
        if (!confirm(`Importar ${preview.length} itens conferidos${dados.importacaoExcel ? ", substituindo a importação anterior" : ""}?`)) return;
        onChange({ ...dados, metodo: "excel", areaReferenciaM2: dados.areaReferenciaM2 ?? areaReferencia, importacaoExcel: { nome: arquivo.nome, originalBase64: arquivo.base64, aba, importadoEm: new Date().toISOString(), mapeamento: mapa, itens: preview } }); setArquivo(null);
      }}>Importar itens conferidos</button>
    </div>}
    {metodo !== "construcao" && <>
      <label className="block text-sm">Área de referência vendável (m²) — apenas para distribuir o custo na Viabilidade<NumeroBRField value={dados.areaReferenciaM2 ?? areaReferencia} onValueChange={(v) => onChange({ ...dados, areaReferenciaM2: Math.max(0, v) })} className={cls} /></label>
      <p className="text-xs text-gray-600">A área vendável distribui o custo de infraestrutura; não representa área construída. Quantidades e preços podem ser ajustados. Somente o método ativo entra no total.</p>
      <div className="space-y-3">{linhas.map((l, i) => <div key={i} className="grid gap-2 rounded border p-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="min-w-0 text-xs sm:col-span-2 xl:col-span-2">Descrição<input className={cls} value={l.descricao} onChange={(e) => editar(i, "descricao", e.target.value)} /></label>
        <label className="min-w-0 text-xs">Unidade<input className={cls} value={l.unidade} onChange={(e) => editar(i, "unidade", e.target.value)} /></label>
        {(["quantidade", "unitario", "total"] as const).map((k) => <label className="min-w-0 text-xs" key={k}>{rotulos[k]}<NumeroBRField className={cls} value={l[k]} onValueChange={(v) => editar(i, k, Math.max(0, v))} /></label>)}
        {l.formula && <p className="text-xs text-gray-500 sm:col-span-2 xl:col-span-5">Fórmula no original: {l.formula}</p>}
        <button type="button" className="text-left text-xs text-red-700" onClick={() => { if (confirm("Excluir este item do orçamento?")) aplicarLinhas(linhas.filter((_, j) => i !== j)); }}>Excluir item {i + 1}</button>
      </div>)}</div>
      {(metodo !== "excel" || dados.importacaoExcel) && <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => aplicarLinhas([...linhas, { descricao: "Novo item", unidade: "un", quantidade: 0, unitario: 0, total: 0 }])}>Adicionar item</button>}
    </>}
  </section>;
}
