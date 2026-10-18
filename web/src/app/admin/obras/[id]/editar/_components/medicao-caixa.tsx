"use client";
import { useRef, useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, ImagePlus, Link2, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
const Input = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`min-w-0 w-full rounded-md border px-3 py-2 ${className}`} />;
const Textarea = ({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} className={`min-w-0 w-full min-h-20 rounded-md border px-3 py-2 ${className}`} />;
import { useRouter } from "next/navigation";
import { vincularPciObra } from "@/lib/actions/obra-progresso";
import { blobParaDataUrl, comprimirImagem, enviarJsonComProgresso, mensagemErroEnvio, pareceImagem } from "@/lib/obras/comprimir-imagem";
import { publicarEnvio } from "@/lib/envio-progresso";
import {
  MAX_ADICIONAIS,
  OPCOES_COMODOS_SERVICOS,
  OPCOES_EXECUTOR,
  OPCOES_FORMAS,
  OPCOES_FORMAS_INCORPORADAS,
  OPCOES_MONTAGEM,
  OPCOES_SISTEMA_CONSTRUTIVO,
  QUADROS_FOTO,
  SIM_NAO,
  TIPOS_MEDICAO,
  avisoFotosPls,
  dadosAlteracaoPadrao,
  dadosRepactuacaoPadrao,
  type DadosMedicaoCaixa,
  type TipoMedicao,
} from "@/lib/medicao-caixa";

// Pedido de 18/10 — medição no formato da CAIXA: PCI da obra (enviar/vincular),
// tipo da medição (PLS, Repactuação, Alteração de Projeto) com os campos de
// cada modelo, fotos em lote da medição e os arquivos .xls/.pdf preenchidos.

const campo = "bg-gray-50 border-gray-300 text-gray-900";
const caixaSelect = `h-9 w-full rounded-md border px-2 text-sm ${campo}`;

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm text-gray-700">
      <span>{texto}</span>
      {children}
    </label>
  );
}

function Opcoes({ valor, opcoes, onChange, rotulo, vazio }: { valor: string; opcoes: readonly string[]; onChange: (v: string) => void; rotulo: string; vazio?: boolean }) {
  return (
    <Rotulo texto={rotulo}>
      <select aria-label={rotulo} className={caixaSelect} value={valor} onChange={(e) => onChange(e.target.value)}>
        {vazio && <option value="">—</option>}
        {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Rotulo>
  );
}

function SimNao({ valor, onChange, rotulo }: { valor: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return <Opcoes rotulo={rotulo} valor={valor ? "Sim" : "Não"} opcoes={SIM_NAO} onChange={(v) => onChange(v === "Sim")} />;
}

const numeroOuNulo = (t: string): number | null => {
  const v = t.trim().replace(/\./g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const textoNumero = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

function CampoNumero({ valor, onChange, rotulo, sufixo }: { valor: number | null; onChange: (v: number | null) => void; rotulo: string; sufixo?: string }) {
  const [texto, setTexto] = useState(textoNumero(valor));
  return (
    <Rotulo texto={rotulo}>
      <div className="flex items-center gap-1">
        <Input aria-label={rotulo} inputMode="decimal" value={texto} className={`h-9 ${campo}`}
          onChange={(e) => { setTexto(e.target.value); onChange(numeroOuNulo(e.target.value)); }} />
        {sufixo && <span className="text-xs text-gray-600">{sufixo}</span>}
      </div>
    </Rotulo>
  );
}

/** Baixa um arquivo gerado pelo servidor; erro vira aviso na tela. */
export async function baixarArquivo(url: string, nomePadrao: string) {
  const resposta = await fetch(url, { credentials: "include" });
  if (!resposta.ok) {
    let msg = `Erro ao gerar o arquivo (código ${resposta.status}).`;
    try {
      const j = await resposta.json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      // resposta sem JSON
    }
    throw new Error(msg);
  }
  const disposicao = resposta.headers.get("Content-Disposition") ?? "";
  const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? nomePadrao;
  const blob = await resposta.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function BotoesArquivosMedicao({ medicaoId, tamanho = "sm" }: { medicaoId: string; tamanho?: "sm" | "md" }) {
  const [baixando, setBaixando] = useState<"xls" | "pdf" | null>(null);
  const baixar = async (formato: "xls" | "pdf") => {
    setBaixando(formato);
    try {
      await baixarArquivo(`/api/obras/medicoes/${medicaoId}/arquivo.${formato}`, `medicao.${formato}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBaixando(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-1">
      {(["xls", "pdf"] as const).map((f) => (
        <Button key={f} size={tamanho} variant="outline" disabled={baixando !== null} onClick={() => baixar(f)}
          className="border-gray-400 bg-transparent text-[var(--brand-dark)] gap-1" aria-label={`Baixar a medição em .${f}`}>
          {baixando === f ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}.{f}
        </Button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ PCI

export interface ResumoPci {
  arquivo: string;
  enviadaEm: string | Date;
  vinculadaEm: string | Date | null;
  formato: "xls" | "xlsb";
  proponente: string;
}

/** Botões da PCI (ao lado de "Ver Medições da CEF"). */
export function PciObra({ projectId, pci }: { projectId: string; pci: ResumoPci | null }) {
  const router = useRouter();
  const [vinculando, setVinculando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!/\.(xls|xlsb)$/i.test(arquivo.name)) {
      toast.error("Envie a PCI em .xls ou .xlsb (planilha da CAIXA).");
      return;
    }
    if (arquivo.size > 3 * 1024 * 1024) {
      toast.error("A PCI passa de 3 MiB. Reduza as imagens da planilha antes de enviar.");
      return;
    }
    setEnviando(true);
    try {
      const dataUrl = await blobParaDataUrl(arquivo);
      const { status, dados } = await enviarJsonComProgresso(`/api/obras/${projectId}/pci`, { arquivo: dataUrl, nome: arquivo.name }, (fracao) =>
        publicarEnvio({ item: "arquivo", atual: 1, total: 1, fracao })
      );
      if (status < 200 || status >= 300) throw new Error(mensagemErroEnvio(status, dados));
      const r = dados as { proponente?: string; formato?: string };
      toast.success(`PCI enviada${r.proponente ? ` (${r.proponente})` : ""}. Clique em "Vincular PCI" para usar as incidências dela.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      publicarEnvio(null);
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const fazerVinculo = async () => {
    if (!confirm("Trocar as incidências da obra pelas da PCI enviada? A Execução do Item de cada serviço é mantida.")) return;
    try {
      setVinculando(true);
      const r = await vincularPciObra(projectId);
      if (!r.ok) throw new Error(r.erro);
      toast.success(`Incidências vinculadas à PCI (total ${r.somaIncidencia.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%).`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setVinculando(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={entrada} type="file" accept=".xls,.xlsb,application/vnd.ms-excel" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      <Button variant="outline" disabled={enviando} onClick={() => entrada.current?.click()} className="border-gray-300 text-[var(--brand-dark)] hover:bg-[#C9A961]/10 gap-2">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {pci ? "Trocar PCI" : "Enviar PCI (.xls/.xlsb)"}
      </Button>
      {pci && (
        <>
          <Button variant="outline" disabled={vinculando} onClick={fazerVinculo} className="border-gray-300 text-[var(--brand-dark)] hover:bg-[#C9A961]/10 gap-2">
            {vinculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular PCI
          </Button>
          <button type="button" className="inline-flex items-center gap-1 text-xs text-gray-700 underline-offset-2 hover:underline"
            onClick={() => baixarArquivo(`/api/obras/${projectId}/pci`, pci.arquivo).catch((e) => toast.error(e instanceof Error ? e.message : String(e)))}>
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--brand-dark)]" />
            {pci.arquivo} — {pci.vinculadaEm ? `vinculada em ${new Date(pci.vinculadaEm).toLocaleDateString("pt-BR")}` : "ainda não vinculada"}
          </button>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ fotos da medição

export interface FotoNova {
  arquivo: File;
  legenda: string;
  previa: string;
}

export function FotosMedicao({ tipo, fotos, setFotos, existentes, onExcluirExistente, progresso }: {
  tipo: TipoMedicao;
  fotos: FotoNova[];
  setFotos: (f: FotoNova[]) => void;
  existentes: { id: string; imageUrl: string; caption: string | null }[];
  onExcluirExistente?: (id: string) => void;
  progresso: number;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const quadros = QUADROS_FOTO[tipo];
  const total = fotos.length + existentes.length;
  const aviso = tipo === "pls" ? avisoFotosPls(total, progresso) : null;
  const adicionar = (lista: File[]) => {
    const imagens = lista.filter(pareceImagem);
    if (imagens.length < lista.length) toast.error("Alguns arquivos não são imagens e foram ignorados.");
    setFotos([...fotos, ...imagens.map((arquivo) => ({ arquivo, legenda: "", previa: URL.createObjectURL(arquivo) }))]);
    if (entrada.current) entrada.current.value = "";
  };
  return (
    <div className="space-y-2 rounded border border-dashed border-gray-300 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-700">Relatório fotográfico da medição ({total} de {quadros} quadros do modelo da CAIXA)</p>
        <Button type="button" size="sm" variant="outline" onClick={() => entrada.current?.click()} className="border-gray-400 bg-transparent text-[var(--brand-dark)] gap-1">
          <ImagePlus className="h-4 w-4" />Adicionar fotos (lote)
        </Button>
        <input ref={entrada} type="file" accept="image/*" multiple className="hidden" onChange={(e) => adicionar(Array.from(e.target.files ?? []))} />
      </div>
      {aviso && <p className="text-xs text-amber-800">{aviso}</p>}
      {total > quadros && <p className="text-xs text-amber-800">O modelo tem {quadros} quadros: só as {quadros} primeiras fotos entram no .xls e no .pdf (todas ficam na aba Fotos).</p>}
      {(existentes.length > 0 || fotos.length > 0) && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {existentes.map((f) => (
            <li key={`e${f.id}`} className="space-y-1 rounded border border-gray-200 p-1">
              <img src={f.imageUrl} alt={f.caption ?? "Foto da medição"} className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-gray-700">{f.caption || "Sem legenda"}</span>
                {onExcluirExistente && (
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-700" aria-label="Excluir foto" onClick={() => onExcluirExistente(f.id)}><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            </li>
          ))}
          {fotos.map((f, i) => (
            <li key={f.previa} className="space-y-1 rounded border border-gray-300 p-1">
              <img src={f.previa} alt={f.arquivo.name} className="aspect-[4/3] w-full rounded object-cover" />
              <div className="flex items-center gap-1">
                <Input aria-label={`Legenda da foto ${f.arquivo.name}`} placeholder="Descrever foto" value={f.legenda} maxLength={250}
                  onChange={(e) => setFotos(fotos.map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x)))} className={`h-7 text-xs ${campo}`} />
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-gray-700" aria-label="Remover foto" onClick={() => { URL.revokeObjectURL(f.previa); setFotos(fotos.filter((_, j) => j !== i)); }}><X className="h-3 w-3" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Envia as fotos novas ligadas à medição. Retorna apenas as fotos que falharam, para reenvio sem duplicar as já gravadas. */
export async function enviarFotosDaMedicao(projectId: string, medicaoId: string, fotos: FotoNova[]): Promise<FotoNova[]> {
  const falhas: FotoNova[] = [];
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i];
    try {
      const { dataUrl } = await comprimirImagem(f.arquivo);
      const { status, dados } = await enviarJsonComProgresso(
        `/api/obras/${projectId}/fotos`,
        { image: dataUrl, caption: f.legenda.trim() || null, takenAt: new Date(f.arquivo.lastModified || Date.now()).toISOString(), includeInReport: true, medicaoId },
        (fracao) => publicarEnvio({ item: "foto", atual: i + 1, total: fotos.length, fracao })
      );
      if (status < 200 || status >= 300) throw new Error(mensagemErroEnvio(status, dados));
      if (typeof (dados as { id?: unknown } | null)?.id !== "string") throw new Error("O servidor não confirmou a gravação da foto.");
    } catch (e) {
      falhas.push(f);
      toast.error(`${f.arquivo.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  publicarEnvio(null);
  return falhas;
}

// ------------------------------------------------------------------ campos por tipo

export function CamposMedicaoCaixa({ tipo, setTipo, dados, setDados, prazoPci, cronogramaPci }: {
  tipo: TipoMedicao;
  setTipo: (t: TipoMedicao) => void;
  dados: DadosMedicaoCaixa;
  setDados: (d: DadosMedicaoCaixa) => void;
  prazoPci: number | null;
  cronogramaPci?: number[];
}) {
  const p = dados.pls;
  const setPls = (parcial: Partial<typeof p>) => setDados({ ...dados, pls: { ...p, ...parcial } });
  const r = dados.repactuacao ?? dadosRepactuacaoPadrao(prazoPci);
  const setRep = (parcial: Partial<typeof r>) => setDados({ ...dados, repactuacao: { ...r, ...parcial } });
  const a = dados.alteracao ?? dadosAlteracaoPadrao();
  const setAlt = (parcial: Partial<typeof a>) => setDados({ ...dados, alteracao: { ...a, ...parcial } });

  const trocarTipo = (t: TipoMedicao) => {
    setTipo(t);
    setDados({
      ...dados,
      repactuacao: t === "repactuacao" ? dados.repactuacao ?? dadosRepactuacaoPadrao(prazoPci) : dados.repactuacao,
      alteracao: t === "alteracao" ? dados.alteracao ?? dadosAlteracaoPadrao() : dados.alteracao,
    });
  };
  const etapasRep = Math.min(48, Math.max(r.prazoProposto ?? 0, r.prazoOriginal ?? 0));

  return (
    <div className="space-y-4 rounded border border-gray-200 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Rotulo texto="Tipo de medição">
          <select aria-label="Tipo de medição" className={caixaSelect} value={tipo} onChange={(e) => trocarTipo(e.target.value as TipoMedicao)}>
            {TIPOS_MEDICAO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </Rotulo>
        <Rotulo texto="Data do levantamento">
          <Input type="date" aria-label="Data do levantamento" value={p.dataLevantamento} onChange={(e) => setPls({ dataLevantamento: e.target.value })} className={`h-9 ${campo}`} />
        </Rotulo>
      </div>

      <details className="rounded border border-gray-200 p-2" open={tipo === "pls"}>
        <summary className="cursor-pointer text-sm text-[var(--brand-dark)]">Dados da PLS (datas &amp; qualidade)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SimNao rotulo="A execução está observando as condições contratadas?" valor={p.condicoesContratadas} onChange={(v) => setPls({ condicoesContratadas: v })} />
          <SimNao rotulo="A placa/adesivo CAIXA está afixada na obra?" valor={p.placaAfixada} onChange={(v) => setPls({ placaAfixada: v })} />
          <SimNao rotulo="Projeto e especificações estão sendo cumpridos?" valor={p.projetoCumprido} onChange={(v) => setPls({ projetoCumprido: v })} />
          <SimNao rotulo="Os serviços previnem danos físicos/vícios futuros?" valor={p.prevencaoDanos} onChange={(v) => setPls({ prevencaoDanos: v })} />
          <Rotulo texto="Data de emissão do alvará">
            <Input type="date" aria-label="Data de emissão do alvará" value={p.alvaraEmissao ?? ""} onChange={(e) => setPls({ alvaraEmissao: e.target.value || null })} className={`h-9 ${campo}`} />
          </Rotulo>
          <Rotulo texto="Data de vigência do alvará">
            <Input type="date" aria-label="Data de vigência do alvará" value={p.alvaraVigencia ?? ""} onChange={(e) => setPls({ alvaraVigencia: e.target.value || null })} className={`h-9 ${campo}`} />
          </Rotulo>
          <SimNao rotulo="Houve repactuação de prazo?" valor={p.houveRepactuacao} onChange={(v) => setPls({ houveRepactuacao: v, etapasRepactuadas: v ? p.etapasRepactuadas : null })} />
          {p.houveRepactuacao && <CampoNumero rotulo="Total de etapas após a repactuação" valor={p.etapasRepactuadas} onChange={(v) => setPls({ etapasRepactuadas: v })} />}
          <SimNao rotulo="Optante pelo Selo Casa Azul?" valor={p.seloCasaAzul} onChange={(v) => setPls({ seloCasaAzul: v })} />
        </div>
        <div className="mt-3">
          <Rotulo texto="Observações">
            <Textarea aria-label="Observações da PLS" value={p.observacoes} maxLength={2000} onChange={(e) => setPls({ observacoes: e.target.value })} className={campo} />
          </Rotulo>
        </div>
      </details>

      {tipo === "repactuacao" && (
        <div className="space-y-3 rounded border border-gray-200 p-2">
          <p className="text-sm text-[var(--brand-dark)]">Proposta de Repactuação de Prazo</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Rotulo texto="Data da repactuação">
              <Input type="date" aria-label="Data da repactuação" value={r.dataRepactuacao} onChange={(e) => setRep({ dataRepactuacao: e.target.value })} className={`h-9 ${campo}`} />
            </Rotulo>
            <CampoNumero rotulo="Prazo original (meses)" valor={r.prazoOriginal} onChange={(v) => setRep({ prazoOriginal: v })} />
            <CampoNumero rotulo="Prazo proposto (meses)" valor={r.prazoProposto} onChange={(v) => setRep({ prazoProposto: v })} />
          </div>
          {etapasRep > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs text-gray-700">
                <thead>
                  <tr><th className="pr-2 text-left">Etapa</th><th className="px-2">% acumulado previsto (original)</th><th className="px-2">% acumulado proposto</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: etapasRep + 1 }, (_, k) => (
                    <tr key={k}>
                      <td className="pr-2">{k}</td>
                      <td className="px-2 py-0.5">
                        <Input aria-label={`% previsto etapa ${k}`} inputMode="decimal" className={`h-7 w-24 text-right ${campo}`}
                          placeholder={cronogramaPci?.[k] !== undefined ? String(cronogramaPci[k]).replace(".", ",") : ""}
                          value={textoNumero(r.previstoOriginal[k])}
                          onChange={(e) => { const l = [...r.previstoOriginal]; l[k] = numeroOuNulo(e.target.value); setRep({ previstoOriginal: l }); }} />
                      </td>
                      <td className="px-2 py-0.5">
                        <Input aria-label={`% proposto etapa ${k}`} inputMode="decimal" className={`h-7 w-24 text-right ${campo}`}
                          value={textoNumero(r.acumuladoProposto[k])}
                          onChange={(e) => { const l = [...r.acumuladoProposto]; l[k] = numeroOuNulo(e.target.value); setRep({ acumuladoProposto: l }); }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-gray-600">Previsto em branco = o do cronograma da PCI. Até a etapa da repactuação vale o % real medido.</p>
            </div>
          )}
          <Rotulo texto="Motivo/Justificativas do pedido de repactuação">
            <Textarea aria-label="Motivo da repactuação" value={r.motivo} maxLength={2000} onChange={(e) => setRep({ motivo: e.target.value })} className={campo} />
          </Rotulo>
        </div>
      )}

      {tipo === "alteracao" && (
        <div className="space-y-3 rounded border border-gray-200 p-2">
          <p className="text-sm text-[var(--brand-dark)]">Proposta de Alteração de Projeto/Especificação</p>
          <Rotulo texto="Justificativa técnica (embasar técnica e financeiramente)">
            <Textarea aria-label="Justificativa técnica" value={a.justificativa} maxLength={2000} onChange={(e) => setAlt({ justificativa: e.target.value })} className={campo} />
          </Rotulo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Opcoes rotulo="Prevê alteração de especificações?" valor={a.alteraEspecificacoes} opcoes={SIM_NAO} onChange={(v) => setAlt({ alteraEspecificacoes: v })} />
            <Opcoes rotulo="Prevê alteração de área?" valor={a.alteraArea} opcoes={SIM_NAO} onChange={(v) => setAlt({ alteraArea: v })} />
            {a.alteraArea === "Sim" && (
              <>
                <CampoNumero rotulo="Nova área coberta padrão" sufixo="m²" valor={a.novaAreaCoberta} onChange={(v) => setAlt({ novaAreaCoberta: v })} />
                <CampoNumero rotulo="Nova área permeável" sufixo="m²" valor={a.novaAreaPermeavel} onChange={(v) => setAlt({ novaAreaPermeavel: v })} />
                <CampoNumero rotulo="Nova área acessória coberta" sufixo="m²" valor={a.novaAreaAcessoria} onChange={(v) => setAlt({ novaAreaAcessoria: v })} />
              </>
            )}
            <Opcoes rotulo="Inclusão ou exclusão de cômodos?" valor={a.comodos} opcoes={OPCOES_COMODOS_SERVICOS} onChange={(v) => setAlt({ comodos: v })} />
            <Rotulo texto="Qual(is) cômodo(s)">
              <Input aria-label="Quais cômodos" value={a.comodosQuais} maxLength={2000} onChange={(e) => setAlt({ comodosQuais: e.target.value })} className={`h-9 ${campo}`} />
            </Rotulo>
            <Opcoes rotulo="Alteração de serviços?" valor={a.servicos} opcoes={OPCOES_COMODOS_SERVICOS} onChange={(v) => setAlt({ servicos: v })} />
            <Rotulo texto="Qual(is) serviço(s)">
              <Input aria-label="Quais serviços" value={a.servicosQuais} maxLength={2000} onChange={(e) => setAlt({ servicosQuais: e.target.value })} className={`h-9 ${campo}`} />
            </Rotulo>
            <Opcoes rotulo="Alteração do sistema construtivo?" valor={a.alteraSistema} opcoes={SIM_NAO} onChange={(v) => setAlt({ alteraSistema: v })} />
            <Opcoes rotulo="Novo sistema proposto" vazio valor={a.novoSistema} opcoes={OPCOES_SISTEMA_CONSTRUTIVO} onChange={(v) => setAlt({ novoSistema: v })} />
            <Opcoes rotulo="Montagem/fabricação das paredes" vazio valor={a.montagemParedes} opcoes={OPCOES_MONTAGEM} onChange={(v) => setAlt({ montagemParedes: v })} />
            <Opcoes rotulo="Tipo de fôrmas" vazio valor={a.tipoFormas} opcoes={OPCOES_FORMAS} onChange={(v) => setAlt({ tipoFormas: v })} />
            <Opcoes rotulo="Fôrmas incorporadas nas paredes?" vazio valor={a.formasIncorporadas} opcoes={OPCOES_FORMAS_INCORPORADAS} onChange={(v) => setAlt({ formasIncorporadas: v })} />
            <Opcoes rotulo="Paredes com função estrutural?" vazio valor={a.paredesEstruturais} opcoes={SIM_NAO} onChange={(v) => setAlt({ paredesEstruturais: v })} />
            <Opcoes rotulo="Apresentou doc. complementar (inovador)?" vazio valor={a.docComplementar} opcoes={SIM_NAO} onChange={(v) => setAlt({ docComplementar: v })} />
            <Opcoes rotulo="Executor da obra" valor={a.executor} opcoes={OPCOES_EXECUTOR} onChange={(v) => setAlt({ executor: v })} />
            <CampoNumero rotulo="BDI" sufixo="%" valor={a.bdi} onChange={(v) => setAlt({ bdi: v })} />
          </div>
          <Rotulo texto="Especificar sistema construtivo">
            <Textarea aria-label="Especificar sistema construtivo" value={a.especificacaoSistema} maxLength={2000} onChange={(e) => setAlt({ especificacaoSistema: e.target.value })} className={campo} />
          </Rotulo>
          <div className="overflow-x-auto">
            <p className="mb-1 text-xs text-gray-600">Custos propostos (R$) — serviços 1 a 19; o item 20 é a soma dos serviços adicionais.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {a.custos.map((c, k) => (
                <CampoNumero key={k} rotulo={`${k + 1}. ${["Barracão/projetos", "Infraestrutura", "Supraestrutura", "Paredes e Painéis", "Esquadrias", "Vidros e Plásticos", "Coberturas", "Impermeabilizações", "Revest. Internos", "Forros", "Revest. Externos", "Pinturas", "Pisos", "Acabamentos", "Inst. Elétricas", "Inst. Hidráulicas", "Esgoto e Pluviais", "Louças e Metais", "Complementos"][k]}`}
                  valor={c} onChange={(v) => { const l = [...a.custos]; l[k] = v; setAlt({ custos: l }); }} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Serviços adicionais (até {MAX_ADICIONAIS})</p>
            {a.adicionais.map((s, k) => (
              <div key={k} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <Rotulo texto={`Serviço ${k + 1}`}>
                    <Input aria-label={`Serviço adicional ${k + 1}`} value={s.descricao} maxLength={250} onChange={(e) => setAlt({ adicionais: a.adicionais.map((x, j) => (j === k ? { ...x, descricao: e.target.value } : x)) })} className={`h-9 ${campo}`} />
                  </Rotulo>
                </div>
                <CampoNumero rotulo="Custo (R$)" valor={s.custo} onChange={(v) => setAlt({ adicionais: a.adicionais.map((x, j) => (j === k ? { ...x, custo: v } : x)) })} />
                <Button type="button" size="icon" variant="ghost" className="text-red-700" aria-label={`Remover serviço adicional ${k + 1}`} onClick={() => setAlt({ adicionais: a.adicionais.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {a.adicionais.length < MAX_ADICIONAIS && (
              <Button type="button" size="sm" variant="outline" className="border-gray-400 bg-transparent text-[var(--brand-dark)]" onClick={() => setAlt({ adicionais: [...a.adicionais, { descricao: "", custo: null }] })}>Adicionar serviço adicional</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
