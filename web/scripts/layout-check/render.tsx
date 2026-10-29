// Correção 11 (lote 3): gera o HTML dos casos de validação visual com os
// componentes reais (Modal compartilhado, CurrencyInput, PercentInput). A
// marcação reproduz as telas de foco: BPO › Editar lançamento, Novo
// lançamento, filtros do BPO/DRE e tabela de movimentações bancárias.
// Executado por `check.mjs` (npx tsx scripts/layout-check/render.tsx <saida>).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Modal } from "@/components/ui/modal";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentInput } from "@/components/ui/percent-input";

const saida = path.resolve(process.argv[2] ?? "dist");
mkdirSync(saida, { recursive: true });
const campo = "mt-1 w-full border px-3 py-2 text-sm normal-case";
const rotulo = "block min-w-0 text-xs font-bold text-gray-500 uppercase";

const editar = (
  <Modal rotulo="Editar lançamento" onFechar={() => {}} tamanho="lg">
    <form className="space-y-4 p-4 sm:p-6">
      <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase">Editar lançamento</h2>
      <label className={rotulo}>Descrição<input name="descricao" defaultValue="Honorários de regularização de obra — parcela muito longa para caber" className={campo} /></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-teste="grade">
        <label className={rotulo}>Valor<CurrencyInput name="valor" defaultValue={1234567.89} className={campo} /></label>
        <label className={rotulo}>Competência<input name="competencia" type="month" defaultValue="2026-10" className={campo} /></label>
        <label className={rotulo}>Vencimento<input name="vencimento" type="date" defaultValue="2026-10-29" className={campo} /></label>
        <label className={rotulo}>Categoria operacional<select className={campo}><option>Regularizações — processo de regularização com nome muito longo</option></select></label>
      </div>
      <label className={rotulo}>Motivo da alteração<textarea name="motivo" className={campo} /></label>
      <div className="flex justify-end gap-2"><button type="button" className="border px-4 py-2 text-xs font-bold uppercase">Cancelar</button><button className="bg-[var(--brand-yellow)] px-4 py-2 text-xs font-bold uppercase">Salvar edição</button></div>
    </form>
  </Modal>
);

const novo = (
  <Modal titulo="Nova Despesa" onFechar={() => {}} tamanho="md">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-teste="grade">
      <label className={rotulo}>Valor (R$) *<CurrencyInput name="valor" defaultValue={98765.43} className={campo} /></label>
      <label className={rotulo}>Competência *<input name="competencia" type="month" defaultValue="2026-10" className={campo} /></label>
    </div>
    <label className={rotulo}>Vencimento *<input name="vencimento" type="date" defaultValue="2026-10-29" className={campo} /></label>
    <label className={rotulo}>Alíquota<PercentInput value={6} onValueChange={() => {}} className={campo} /></label>
    {Array.from({ length: 10 }, (_, i) => <label key={i} className={rotulo}>Campo extra {i + 1}<input className={campo} /></label>)}
    <button className="w-full bg-[var(--brand-yellow)] py-2.5 text-xs font-bold uppercase">Registrar Despesa</button>
  </Modal>
);

const sel = "min-w-[140px] max-w-full flex-1 sm:flex-none border border-gray-200 px-3 py-2 text-sm bg-white";
const filtros = (
  <div className="min-h-screen bg-[var(--brand-gray-light)] p-4">
    <div className="flex flex-wrap gap-2" data-teste="filtros">
      <div className="relative flex-1 min-w-[180px]"><input type="text" placeholder="Buscar cliente ou descrição..." className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm bg-white" /></div>
      <select className={sel}><option>Todos os clientes</option><option>Construtora e Incorporadora Grupo Santa Fé de Empreendimentos Imobiliários Ltda</option></select>
      <select className={sel}><option>Todos os meses</option></select>
      <select className={sel}><option>Todos os anos</option></select>
      <input type="date" defaultValue="2026-01-01" className="min-w-[140px] flex-1 border border-gray-200 px-3 py-2 text-sm" />
    </div>
    <div className="mt-4 max-h-80 overflow-auto border-t border-gray-200 pt-2" data-teste="rolagem-tabela">
      <table className="w-full min-w-[640px] text-xs">
        <thead><tr><th className="p-1 text-left">Data</th><th className="p-1 text-left">Descrição</th><th className="p-1 text-left">Titular</th><th className="p-1 text-left">Categoria</th><th className="p-1 text-left">Cliente BPO</th><th className="p-1 text-right">Valor</th></tr></thead>
        <tbody>{Array.from({ length: 8 }, (_, i) => <tr key={i}><td className="p-1 whitespace-nowrap">29/10/2026</td><td className="p-1">PIX recebido de cliente com descrição longa {i}</td><td className="p-1">Fulano de Tal</td><td className="p-1">Recebimento</td><td className="p-1">Cliente {i}</td><td className="p-1 text-right">R$ 1.000.000,00</td></tr>)}</tbody>
      </table>
    </div>
  </div>
);

const pagina = (corpo: ReactElement) =>
  `<!doctype html><html lang="pt-BR" class="area-admin"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="./harness.css"></head><body>${renderToStaticMarkup(corpo)}</body></html>`;

writeFileSync(path.join(saida, "editar.html"), pagina(editar));
writeFileSync(path.join(saida, "novo.html"), pagina(novo));
writeFileSync(path.join(saida, "filtros.html"), pagina(filtros));
