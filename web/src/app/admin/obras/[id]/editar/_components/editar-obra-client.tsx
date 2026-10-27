"use client";

import { useMemo, useState } from "react";
import type { ResumoObra } from "@/lib/financeiro/obra-dados";
import { editarObra } from "@/lib/actions/obras";
import { definirInvestidoresObra, salvarValoresObra } from "@/lib/actions/obra-financeiro";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProgressoObraDados } from "@/lib/obras/progresso-dados";
import { ProgressoObra } from "./progresso-obra";
import type { MedicaoGaleria } from "@/lib/obras/galeria-medicoes";
import { FotosObra, type FotoObra } from "./fotos-obra";
import { RelatorioObraBotao } from "./relatorio-obra-botao";
import { GeradorPci } from "@/components/obras/gerador-pci";
import { Custos, ValoresOperacao, calcularAoVivo, formInicial, inputCls, labelCls, type FormFinanceiro } from "./financeiro-obra";

type Aba = "info" | "valores" | "custos" | "progresso" | "fotos" | "relatorios";
const ABAS: { id: Aba; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "valores", label: "Valores da Operação" },
  { id: "custos", label: "Custos" },
  { id: "progresso", label: "Progresso" },
  // Lote 02, correção 03: "Fotos" virou "Gerador de PCI" (a galeria por medição continua
  // em Detalhes da Obra e logo abaixo do gerador). Para o empreiteiro segue "Fotos" (só galeria).
  { id: "fotos", label: "Gerador de PCI" },
  { id: "relatorios", label: "Relatórios" },
];
// Progresso, Fotos e Relatórios gravam por conta própria (fora do formulário).
const ABAS_DO_FORMULARIO: Aba[] = ["info", "valores", "custos"];

export function EditarObraClient({ resumo, empreiteiros, clienteNome, corretor, escritorioCef, datas, cancelarHref, progresso, fotos, medicoesGaleria, modoEmpreiteiro = false, children }: {
  resumo: ResumoObra;
  empreiteiros: { id: string; nome: string }[];
  clienteNome: string;
  corretor: string | null;
  escritorioCef: string | null;
  datas: { inicio: string; termino: string };
  cancelarHref: string;
  progresso: ProgressoObraDados;
  fotos: FotoObra[];
  medicoesGaleria: MedicaoGaleria[];
  /**
   * Pedido de 15/10: o empreiteiro usa este mesmo painel nas obras vinculadas a ele.
   * Informações, Valores da Operação e Custos previstos ficam só leitura; Pagamentos,
   * Progresso, Fotos e Relatórios funcionam como no painel. As actions conferem o
   * vínculo (lib/obras/acesso-empreiteiro.ts).
   */
  modoEmpreiteiro?: boolean;
  children: React.ReactNode;
}) {
  const [aba, setAba] = useState<Aba>("info");
  const [form, setForm] = useState<FormFinanceiro>(() => formInicial(resumo));
  const [inicio, setInicio] = useState(datas.inicio);
  const [termino, setTermino] = useState(datas.termino);
  const [escritorio, setEscritorio] = useState(escritorioCef ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const calculo = useMemo(() => calcularAoVivo(form, resumo, { inicio, termino }), [form, resumo, inicio, termino]);
  const empreiteiroNome = empreiteiros.find((e) => e.id === form.empreiteiroId)?.nome ?? resumo.empreiteiro?.nome ?? null;

  async function salvar(fd: FormData) {
    setErro(null);
    const valores = await salvarValoresObra({
      obraId: resumo.obra.id,
      vgv: form.vgv, financiamento: form.financiamento, fgts: form.fgts, subsidio: form.subsidio,
      custoTerreno: form.custoTerreno, comissao: form.comissao, comissaoPercentual: form.comissaoPercentual, orcamentoPrevisto: form.orcamentoPrevisto,
      taxaMensalPct: form.taxaMensalPct, parcelas: form.parcelas,
      empreiteiroId: form.empreiteiroId, percentualEmpreiteiro: form.percentualEmpreiteiro,
      incluirProSolutoBaseEmpreiteiro: form.incluirProSolutoBaseEmpreiteiro,
      escritorioCef: escritorio || null,
    });
    if (!valores.ok) { setErro(valores.erro); return; }
    const investidores = await definirInvestidoresObra(resumo.obra.id, form.investidores.map((i) => ({ investidorId: i.investidorId, percentual: i.percentual })));
    if (!investidores.ok) { setErro(investidores.erro); return; }
    await editarObra(fd);
  }

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${aba === a.id ? "border-b-2 border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "text-gray-600"}`}>
            {modoEmpreiteiro && a.id === "fotos" ? "Fotos" : a.label}
          </button>
        ))}
      </div>

      {aba === "progresso" && <ProgressoObra obraId={resumo.obra.id} dados={progresso} />}
      {aba === "fotos" && !modoEmpreiteiro && <GeradorPci obraId={resumo.obra.id} />}
      {aba === "fotos" && <FotosObra fotos={fotos} medicoes={medicoesGaleria} />}
      {aba === "relatorios" && <RelatorioObraBotao obraId={resumo.obra.id} />}

    <form action={salvar} onInvalidCapture={() => setAba("info")} className={ABAS_DO_FORMULARIO.includes(aba) ? "space-y-5" : "hidden"}>

      <div className={aba === "info" ? "space-y-5" : "hidden"}>
        <fieldset disabled={modoEmpreiteiro} className="contents">
        <div className="bg-white border border-gray-100 p-6 space-y-5">
          {children}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelCls}>Data de início
              <input type="date" name="dataInicio" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
            <label className={labelCls}>Previsão de término
              <input type="date" name="dataPrevisaoFim" value={termino} onChange={(e) => setTermino(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
          </div>
        </div>
        </fieldset>
      </div>

      <div className={aba === "valores" ? "space-y-4" : "hidden"}>
        <fieldset disabled={modoEmpreiteiro} className="contents">
        <section className="bg-white border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={labelCls}>Nome do Cliente</p>
            <div className="w-full border border-gray-100 px-3 py-2.5 text-sm bg-gray-100 text-gray-700" aria-readonly="true">{clienteNome}</div>
            <p className="text-[11px] text-gray-600 mt-1">Vem do lead no CRM. Para alterar, edite o lead.</p>
          </div>
          <label className={labelCls}>Escritório CF (Agência CEF)
            <input value={escritorio} onChange={(e) => setEscritorio(e.target.value)} placeholder="Agência CEF" className={`${inputCls} mt-1 normal-case font-normal`} />
          </label>
          {corretor && (
            <div>
              <p className={labelCls}>Nome do Corretor</p>
              <div className="w-full border border-gray-100 px-3 py-2.5 text-sm bg-gray-100 text-gray-700" aria-readonly="true">{corretor}</div>
              <p className="text-[11px] text-gray-600 mt-1">Corretor vinculado ao lead no CRM.</p>
            </div>
          )}
        </section>
        <ValoresOperacao resumo={resumo} form={form} setForm={setForm} calculo={calculo} empreiteiroNome={empreiteiroNome} />
        </fieldset>
      </div>

      <div className={aba === "custos" ? "space-y-4" : "hidden"}>
        <Custos resumo={resumo} form={form} setForm={setForm} calculo={calculo} empreiteiros={empreiteiros} corretor={corretor} modoEmpreiteiro={modoEmpreiteiro} />
      </div>

      {erro && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {/* Salvar grava Informações e Valores: o empreiteiro não altera esses dados. */}
      {!modoEmpreiteiro && <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
        <a href={cancelarHref} className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
          Cancelar
        </a>
        <SubmitButton
          pendingText="Salvando..."
          className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Salvar
        </SubmitButton>
      </div>}
    </form>
    </div>
  );
}
