"use client";
// Lote 2, correção 03 (AD-06): aba "Gerador de PCI" do Editar Obra.
// Formulário por seções, pré-preenchido com os dados da obra/cliente/PCI vinculada,
// rascunho, geração da planilha (modelo oficial atual) + PDF e histórico com
// download das duas versões. Regras em @/lib/pci-gerador; banco em
// @/lib/obras/pci-gerador-dados. Gêmeo de Prospecta/client/src/components/obra/GeradorPciAba.tsx.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RefreshCw, Save } from "lucide-react";
import { gerarPci, obterGeradorPci, preencherAutomaticoPci, salvarRascunhoGeradorPci } from "@/lib/actions/pci-gerador";
import type { DadosGeradorPci } from "@/lib/obras/pci-gerador-dados";
import { NumeroInput } from "@/components/ui/numero-input";
import { comprimirImagem } from "@/lib/obras/comprimir-imagem";
import { baixarArquivoEmPartes } from "@/lib/obras/pci-gerador-arquivos";
import {
  CAMPOS_PCI,
  LIMITE_IMAGEM_PCI_BYTES,
  MAX_ETAPAS_PCI,
  SECOES_PCI,
  SERVICOS_CUSTO_PCI,
  SERVICO_OUTROS_PCI,
  analisarCronogramaPci,
  aplicarEngenheiroPci,
  calcularTotaisPci,
  errosPci,
  numeroPci,
  pendenciasPci,
  type CampoPci,
  type FormularioPci,
  type SecaoPci,
} from "@/lib/pci-gerador";

const campoCls = "w-full border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-[var(--brand-dark)] focus:outline-none focus:border-[var(--brand-yellow)]";
const rotuloCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";
const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";
const brl = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type Engenheiro = DadosGeradorPci["engenheiros"][number];

function Campo({ campo, valor, onChange }: { campo: CampoPci; valor: string | number | null; onChange: (v: string | number | null) => void }) {
  const id = `pci-${campo.id}`;
  let controle;
  if (campo.tipo === "lista") {
    // Lote 03, correção 07: lista do modelo oficial — grava a opção exata, mostra sem espaços nas pontas.
    const opcoes = campo.opcoes ?? [];
    const foraDaLista = valor !== null && valor !== "" && !opcoes.includes(String(valor));
    controle = (
      <select id={id} value={valor === null ? "" : String(valor)} onChange={(e) => onChange(e.target.value || null)} aria-invalid={foraDaLista || undefined}
        className={`${campoCls} ${foraDaLista ? "border-red-400" : ""}`}>
        <option value="">— selecione —</option>
        {foraDaLista && <option value={String(valor)} disabled>{String(valor)} (fora da lista oficial)</option>}
        {opcoes.map((o) => <option key={o} value={o}>{o.trim()}</option>)}
      </select>
    );
  } else if (campo.tipo === "numero" || campo.tipo === "inteiro") {
    controle = <NumeroInput id={id} value={numeroPci(valor)} onChange={onChange} casas={campo.tipo === "inteiro" ? 0 : 2} negativo={false} className={campoCls} />;
  } else if (campo.tipo === "data") {
    controle = <input id={id} type="date" value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(e.target.value || null)} className={campoCls} />;
  } else {
    const placeholder = campo.tipo === "coordenada" ? (campo.id === "latitude" ? `05° 29' 18" S` : `47° 28' 30" W`) : campo.tipo === "cep" ? "00000-000" : undefined;
    controle = <input id={id} value={valor === null ? "" : String(valor)} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={campoCls} />;
  }
  return (
    <div className={campo.largo ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className={rotuloCls}>{campo.rotulo}{campo.celula ? <span className="ml-1 normal-case text-[10px] text-gray-400">({campo.celula})</span> : null}</label>
      {controle}
    </div>
  );
}

function SeletorEngenheiro({ papel, form, setForm, engenheiros }: { papel: "rtp" | "rte"; form: FormularioPci; setForm: (f: FormularioPci) => void; engenheiros: Engenheiro[] }) {
  const atual = papel === "rtp" ? form.rtpEngenheiroId : form.rteEngenheiroId;
  return (
    <div className="sm:col-span-2">
      <label htmlFor={`pci-eng-${papel}`} className={rotuloCls}>Selecionar engenheiro (preenche nome, e-mail, telefone e CREA do perfil)</label>
      <select id={`pci-eng-${papel}`} value={atual ?? ""} className={campoCls}
        onChange={(e) => {
          const eng = engenheiros.find((x) => x.id === e.target.value) ?? null;
          setForm(aplicarEngenheiroPci(form, papel, eng?.id ?? null, eng));
          if (eng && !eng.crea) toast.warning(`${eng.nome || "Este usuário"} não tem CREA no perfil de Engenheiro: o registro ficou em branco. Complete em Configurações › Usuários.`);
        }}>
        <option value="">— digitar manualmente —</option>
        {engenheiros.map((e) => <option key={e.id} value={e.id}>{e.nome || e.email}{e.crea ? ` — CREA${e.creaUf ? `-${e.creaUf}` : ""} ${e.crea}` : e.engenheiro ? " — sem CREA" : ""}</option>)}
      </select>
    </div>
  );
}

export function GeradorPci({ obraId }: { obraId: string }) {
  const [dados, setDados] = useState<DadosGeradorPci | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioPci | null>(null);
  const [ocupado, setOcupado] = useState<"salvar" | "gerar" | "auto" | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof obterGeradorPci>>, manterForm: boolean) => {
    if ("erro" in r) { setErro(r.erro ?? "Erro ao carregar."); return; }
    setErro(null);
    setDados(r.dados);
    if (!manterForm) setForm(r.dados.formulario);
  }, []);
  const carregar = useCallback(async (manterForm: boolean) => aplicar(await obterGeradorPci(obraId), manterForm), [obraId, aplicar]);
  useEffect(() => {
    let vivo = true;
    obterGeradorPci(obraId).then((r) => { if (vivo) aplicar(r, false); });
    return () => { vivo = false; };
  }, [obraId, aplicar]);

  const totais = useMemo(() => (form ? calcularTotaisPci(form) : null), [form]);
  const pendencias = useMemo(() => (form ? pendenciasPci(form) : []), [form]);
  // Lote 03, correção 06: validação do cronograma durante a digitação (o servidor valida de novo).
  const cronograma = useMemo(() => (form ? analisarCronogramaPci(form) : null), [form]);
  const erros = useMemo(() => (form ? errosPci(form, { paraGerar: false }) : []), [form]);

  if (erro) return <div role="alert" className="text-sm text-red-700">{erro} <button type="button" className="underline" onClick={() => void carregar(false)}>Tentar novamente</button></div>;
  if (!dados || !form) return <p role="status" className="text-sm text-gray-600">Carregando o Gerador de PCI…</p>;
  const d = dados;

  const setCampo = (id: string, v: string | number | null) => setForm({ ...form, campos: { ...form.campos, [id]: v } });
  const prazo = Math.min(Math.max(Math.round(numeroPci(form.campos.prazoMeses) ?? 0), 0), MAX_ETAPAS_PCI);

  async function salvarRascunho() {
    setOcupado("salvar");
    const r = await salvarRascunhoGeradorPci(obraId, form);
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    toast.success("Rascunho salvo.");
    await carregar(true);
  }

  async function recarregarAutomatico() {
    if (!confirm("Substituir o formulário pelos dados atuais da obra, do cliente e da PCI vinculada? O que foi digitado e não salvo será perdido.")) return;
    setOcupado("auto");
    const r = await preencherAutomaticoPci(obraId);
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    setForm(r.formulario);
    toast.success("Dados automáticos carregados. Confira e salve o rascunho.");
  }

  async function gerar() {
    setOcupado("gerar");
    const r = await gerarPci(obraId, form);
    setOcupado(null);
    if ("erro" in r) { toast.error(r.erro); return; }
    toast.success("PCI gerada (planilha e PDF). Veja o histórico abaixo.");
    for (const a of r.avisos) toast.warning(a, { duration: 10000 });
    await carregar(true);
  }

  async function escolherImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const { dataUrl } = await comprimirImagem(arquivo, 1600, LIMITE_IMAGEM_PCI_BYTES);
      setForm((f) => (f ? { ...f, imagem: { tipo: "jpeg", base64: dataUrl.split(",")[1] } } : f));
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function baixar(id: string, tipo: "planilha" | "pdf", nome: string) {
    setBaixando(`${id}-${tipo}`);
    try { await baixarArquivoEmPartes(`/api/obras/${obraId}/pci-geradas/${id}/${tipo}`, nome); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBaixando(null); }
  }

  const secaoCampos = (secao: SecaoPci) => CAMPOS_PCI.filter((c) => c.secao === secao && (!c.visivel || c.visivel(form.campos))).map((c) => <Campo key={c.id} campo={c} valor={form.campos[c.id] ?? null} onChange={(v) => setCampo(c.id, v)} />);
  const podeGerar = !!d.modelo && d.modelo.formato !== "xlsb";

  return (
    <section className="space-y-4 border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-black uppercase tracking-wide text-[var(--brand-dark)]"><FileSpreadsheet size={18} /> Gerador de PCI</h2>
          <p className="text-sm text-gray-600">
            {d.modelo ? `Modelo atual: v${d.modelo.versao} — ${d.modelo.arquivo} (.${d.modelo.formato})` : "Sem modelo cadastrado."}
            {" · "}{d.origem === "rascunho" ? `Rascunho salvo em ${new Date(d.rascunhoEm!).toLocaleString("pt-BR")}${d.rascunhoAutor ? ` por ${d.rascunhoAutor}` : ""}` : "Pré-preenchido com os dados da obra, do cliente e da PCI vinculada."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={recarregarAutomatico}>
            {ocupado === "auto" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Dados automáticos
          </button>
          <button type="button" className={botaoSec} disabled={ocupado !== null} onClick={salvarRascunho}>
            {ocupado === "salvar" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar rascunho
          </button>
          <button type="button" className={botaoPri} disabled={!podeGerar || ocupado !== null} onClick={gerar}>
            {ocupado === "gerar" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Gerar PCI (planilha + PDF)
          </button>
        </div>
      </div>
      {d.avisoModelo && <p role="alert" className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {d.avisoModelo}</p>}
      {erros.length > 0 && (
        <div role="alert" className="border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          <p className="font-bold">Corrija antes de salvar ou gerar:</p>
          <ul className="ml-5 mt-1 list-disc">{erros.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {pendencias.length > 0 && (
        <details className="border border-amber-200 bg-amber-50/60 p-2 text-sm text-amber-900">
          <summary className="cursor-pointer">{pendencias.length} pendência(s) para conferir antes de enviar à CAIXA (não impedem gerar)</summary>
          <ul className="ml-5 mt-1 list-disc">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
      )}

      {SECOES_PCI.map((s) => (
        <details key={s.id} open={s.id === "proponente"} className="border border-gray-200 bg-gray-50/50 p-3">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">{s.titulo}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(s.id === "rtp" || s.id === "rte") && <SeletorEngenheiro papel={s.id} form={form} setForm={setForm} engenheiros={d.engenheiros} />}
            {secaoCampos(s.id)}
            {s.id === "custos" && totais && (
              <div className="sm:col-span-2 overflow-x-auto">
                <table className="w-full text-sm text-gray-800">
                  <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Item</th><th className="p-1">Serviço</th><th className="p-1">Custo (R$)</th><th className="p-1 text-right">Incid. (%)</th></tr></thead>
                  <tbody>
                    {SERVICOS_CUSTO_PCI.map((nome, i) => (
                      <tr key={nome} className="border-t border-gray-100">
                        <td className="p-1">{i + 1}</td><td className="p-1">{nome}</td>
                        <td className="p-1 min-w-[140px]"><NumeroInput aria-label={`Custo ${nome}`} value={form.custos[i]} negativo={false} className={campoCls}
                          onChange={(v) => setForm({ ...form, custos: form.custos.map((c, k) => (k === i ? v : c)) })} /></td>
                        <td className="p-1 text-right">{brl(totais.incidencias[i])}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-100"><td className="p-1">20</td><td className="p-1">{SERVICO_OUTROS_PCI}</td><td className="p-1">{brl(totais.outros)}</td><td className="p-1 text-right">{brl(totais.incidencias[19])}</td></tr>
                  </tbody>
                  <tfoot className="font-bold">
                    <tr><td /><td className="p-1">Custo total de serviços</td><td className="p-1">{brl(totais.totalServicos)}</td><td /></tr>
                    <tr><td /><td className="p-1">Custo total com BDI</td><td className="p-1">{brl(totais.totalComBdi)}</td><td /></tr>
                  </tfoot>
                </table>
                <p className={`${rotuloCls} mt-3`}>Serviços adicionais (somam no item 20 &quot;Outros&quot;)</p>
                {form.adicionais.map((a, i) => (
                  <div key={i} className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <input aria-label={`Serviço adicional ${i + 1}`} value={a.descricao} placeholder={`Serviço adicional ${i + 1}`} className={campoCls}
                      onChange={(e) => setForm({ ...form, adicionais: form.adicionais.map((x, k) => (k === i ? { ...x, descricao: e.target.value } : x)) })} />
                    <NumeroInput aria-label={`Custo do serviço adicional ${i + 1}`} value={a.valor} negativo={false} className={campoCls}
                      onChange={(v) => setForm({ ...form, adicionais: form.adicionais.map((x, k) => (k === i ? { ...x, valor: v } : x)) })} />
                  </div>
                ))}
              </div>
            )}
            {s.id === "cronograma" && (
              <div className="sm:col-span-2">
                {prazo < 1 ? <p className="text-sm text-gray-600">Informe o prazo (meses) para montar o cronograma.</p> : (
                  <div className="overflow-x-auto">
                    <p className="mb-2 text-xs text-gray-600">Informe o % ACUMULADO da obra ao fim de cada etapa (0,00 a 100,00, sem diminuir; a última etapa termina em 100,00). A etapa 0 é o pré-executado. O incremental é a diferença entre etapas consecutivas.</p>
                    <table className="w-full text-sm text-gray-800">
                      <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Etapa</th><th className="p-1">% acumulado proposto</th><th className="p-1 text-right">% da etapa (incremental)</th><th className="p-1">Validação</th></tr></thead>
                      <tbody>
                        <tr className="border-t border-gray-100"><td className="p-1">0</td><td className="p-1">{brl(cronograma?.etapa0 ?? 0)}% (pré-executado)</td><td className="p-1 text-right">{brl(cronograma?.etapa0 ?? 0)}</td><td /></tr>
                        {Array.from({ length: prazo }, (_, k) => {
                          const problemas = [...(cronograma?.erros.filter((e) => e.etapa === k + 1).map((e) => ({ m: e.mensagem, erro: e.tipo === "valor" })) ?? []), ...(cronograma?.avisos.filter((a) => a.etapa === k + 1).map((a) => ({ m: a.mensagem, erro: false })) ?? [])];
                          const inc = cronograma?.incrementais[k] ?? null;
                          return (
                            <tr key={k} className="border-t border-gray-100 align-top">
                              <td className="p-1"><label htmlFor={`pci-etapa-${k}`}>{k + 1}</label></td>
                              <td className="p-1 min-w-[130px]">
                                <NumeroInput id={`pci-etapa-${k}`} value={form.cronograma[k] ?? null} negativo={false} casas={2} pontoDecimal sufixo="%" aria-invalid={problemas.some((p) => p.erro) || undefined}
                                  className={`${campoCls} ${problemas.some((p) => p.erro) ? "border-red-400" : ""}`}
                                  onChange={(v) => { const c = Array.from({ length: prazo }, (_, j) => form.cronograma[j] ?? null); c[k] = v; setForm({ ...form, cronograma: c }); }} />
                              </td>
                              <td className="p-1 text-right">{inc === null ? "—" : brl(inc)}</td>
                              <td className="p-1 text-xs">{problemas.map((p) => <span key={p.m} className={`block ${p.erro ? "text-red-700" : "text-amber-700"}`}>{p.m}</span>)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {s.id === "localizacao" && (
              <div className="sm:col-span-2 space-y-2">
                <p className="text-xs text-gray-600">Imagem da localização/poligonal do terreno (ex.: captura do Google Earth). No modelo .xls ela entra no quadro &quot;Inserir Poligonal do Terreno&quot;; sempre vai no PDF.</p>
                <input type="file" accept="image/png,image/jpeg" aria-label="Imagem de localização" onChange={(e) => void escolherImagem(e.target.files?.[0])} className="text-sm" />
                {form.imagem && (
                  <div className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (data URL) */}
                    <img src={`data:image/${form.imagem.tipo};base64,${form.imagem.base64}`} alt="Imagem de localização" className="max-h-64 border border-gray-200" />
                    <button type="button" className={botaoSec} onClick={() => setForm({ ...form, imagem: null })}>Remover imagem</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      ))}

      <div className="border border-gray-200 p-3">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">Histórico de PCIs geradas</h3>
        {!d.historico.length ? <p className="text-sm text-gray-600">Nenhuma PCI gerada para esta obra.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Gerada em</th><th className="p-1">Autor</th><th className="p-1">Modelo</th><th className="p-1">Arquivos</th></tr></thead>
              <tbody>
                {d.historico.map((h) => (
                  <tr key={h.id} className="border-t border-gray-100 align-top">
                    <td className="p-1 whitespace-nowrap">{new Date(h.geradoEm).toLocaleString("pt-BR")}</td>
                    <td className="p-1">{h.autor ?? "—"}</td>
                    <td className="p-1">v{h.modeloVersao}{h.avisos.length ? <span title={h.avisos.join("\n")} className="ml-1 text-amber-700">({h.avisos.length} aviso{h.avisos.length > 1 ? "s" : ""})</span> : null}</td>
                    <td className="p-1">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={botaoSec} disabled={baixando !== null} onClick={() => void baixar(h.id, "planilha", h.planilha)} aria-label={`Baixar planilha .${h.formato}`}>
                          {baixando === `${h.id}-planilha` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}.{h.formato}
                        </button>
                        <button type="button" className={botaoSec} disabled={baixando !== null} onClick={() => void baixar(h.id, "pdf", h.pdf)} aria-label="Baixar PDF">
                          {baixando === `${h.id}-pdf` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}.pdf
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
