"use client";
// Lote 2, correção 03 (AD-06): Integrações › "Sub PCI atual" — envio da versão
// atualizada do modelo oficial da PCI (CAIXA), versionado. Só admin (página e
// actions conferem). Gêmeo de Prospecta/client/src/components/admin/SubPciAtual.tsx.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { definirModeloAtualPci, excluirModeloPciAcao, listarModelosPciAcao } from "@/lib/actions/pci-gerador";
import { blobParaDataUrl, enviarJsonComProgresso, mensagemErroEnvio } from "@/lib/obras/comprimir-imagem";
import { baixarArquivoEmPartes } from "@/lib/obras/pci-gerador-arquivos";
import { LIMITE_MODELO_PCI_BYTES } from "@/lib/pci-gerador";
import { PARTE_PCI_BYTES } from "@/lib/obras/pci-validacao";

type Relatorio = {
  versaoAnterior: number | null; abasAdicionadas: string[]; abasRemovidas: string[];
  celulasAlteradas: { celula: string; antes: string; depois: string }[]; listasAdicionadas: string[]; listasRemovidas: string[];
  listasAlteradas: { lista: string }[]; criticas: string[]; avisos: string[]; critico: boolean;
};
type Modelo = {
  id: string; versao: number; arquivo: string; formato: string; tamanho: number; atual: boolean; enviadoEm: string; autor: string | null; observacao: string | null;
  aguardandoConfirmacao: boolean; relatorio: Relatorio | null; pcisGeradas: number;
};

const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";
const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(b / 1024)} KB`);

export function SubPciAtual() {
  const entrada = useRef<HTMLInputElement>(null);
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [relatorioAberto, setRelatorioAberto] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof listarModelosPciAcao>>) => {
    if ("erro" in r) setErro(r.erro ?? "Erro ao carregar.");
    else { setErro(null); setModelos(r.modelos); }
  }, []);
  const carregar = useCallback(async () => aplicar(await listarModelosPciAcao()), [aplicar]);
  useEffect(() => {
    let vivo = true;
    listarModelosPciAcao().then((r) => { if (vivo) aplicar(r); });
    return () => { vivo = false; };
  }, [aplicar]);

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!/\.(xls|xlsm|xlsb)$/i.test(arquivo.name)) { toast.error("Envie o modelo em .xls, .xlsm ou .xlsb."); return; }
    if (arquivo.size > LIMITE_MODELO_PCI_BYTES) { toast.error("Envie um modelo de até 8 MB."); return; }
    setEnviando(true);
    try {
      const uploadId = crypto.randomUUID();
      const totalChunks = Math.ceil(arquivo.size / PARTE_PCI_BYTES);
      if (!totalChunks) throw new Error("Arquivo vazio.");
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const dataUrl = await blobParaDataUrl(arquivo.slice(chunkIndex * PARTE_PCI_BYTES, (chunkIndex + 1) * PARTE_PCI_BYTES));
        const r = await enviarJsonComProgresso("/api/pci-modelos", { nome: arquivo.name, uploadId, chunkIndex, totalChunks, chunk: dataUrl.split(",")[1] });
        if (r.status < 200 || r.status >= 300) throw new Error(mensagemErroEnvio(r.status, r.dados));
      }
      const fim = await enviarJsonComProgresso("/api/pci-modelos", { uploadId, finalizar: true, observacao });
      if (fim.status < 200 || fim.status >= 300) throw new Error(mensagemErroEnvio(fim.status, fim.dados));
      const d = fim.dados as { id: string; versao: number; repetido: boolean; aviso: string | null; aguardandoConfirmacao: boolean };
      if (d.aguardandoConfirmacao) {
        toast.warning(`Versão ${d.versao} enviada com mudanças críticas: confira o relatório de compatibilidade e confirme para torná-la atual.`, { duration: 12000 });
        setRelatorioAberto(d.id);
      } else toast.success(d.repetido ? `Este arquivo já era a versão ${d.versao}; ela voltou a ser a atual.` : `Modelo enviado: versão ${d.versao} (atual).`);
      if (d.aviso) toast.warning(d.aviso, { duration: 10000 });
      setObservacao("");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function tornarAtual(m: Modelo) {
    if (m.aguardandoConfirmacao) {
      const texto = `A versão ${m.versao} tem mudanças críticas:\n- ${(m.relatorio?.criticas ?? []).slice(0, 8).join("\n- ")}\n\nConfirma usar esta versão como modelo atual mesmo assim?`;
      if (!confirm(texto)) return;
    } else if (!confirm(`Usar a versão ${m.versao} como modelo atual?`)) return;
    const r = await definirModeloAtualPci(m.id, m.aguardandoConfirmacao);
    if ("erro" in r) toast.error(r.erro);
    else { toast.success("Modelo atual alterado."); await carregar(); }
  }

  // Lote 03, correção 09b: exclusão lógica por versão (não a atual), com prévia e confirmação.
  async function excluir(m: Modelo) {
    const texto = `Excluir a versão ${m.versao} (${m.arquivo})?\n\n${m.pcisGeradas} PCI(s) gerada(s) usam esta versão. A exclusão só a retira da lista: o arquivo fica guardado e os downloads dessas PCIs continuam funcionando.`;
    if (!confirm(texto)) return;
    setExcluindo(true);
    try {
      const r = await excluirModeloPciAcao(m.id, true);
      if ("erro" in r) toast.error(r.erro);
      else { toast.success(`Versão ${r.versao} excluída. O arquivo segue guardado para as PCIs já geradas.`); await carregar(); }
    } finally { setExcluindo(false); }
  }

  return (
    <section className="space-y-3 border border-gray-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-black uppercase tracking-wide text-[var(--brand-dark)]"><FileSpreadsheet size={18} /> PCI da CAIXA — modelo oficial</h2>
      <p className="text-sm text-gray-700">
        O Gerador de PCI (Editar Obra) preenche o modelo marcado como atual e gera sempre a planilha em .xls (formato aceito pela CAIXA).
        Envie aqui cada nova versão da planilha oficial (.xls, .xlsm ou .xlsb). Para .xlsm/.xlsb, a geração usa a versão .xls compatível
        mais recente; sem ela, fica bloqueada até o envio da .xls. Cada envio é comparado com a versão anterior (relatório de
        compatibilidade); mudanças críticas só valem após confirmação. O envio de PCI das obras continua igual.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={entrada} type="file" accept=".xls,.xlsm,.xlsb" className="hidden" onChange={(e) => void enviar(e.target.files?.[0])} />
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} placeholder="Observação da versão (opcional)"
          aria-label="Observação da versão" className="w-full max-w-xs border border-gray-300 px-3 py-2 text-sm text-[var(--brand-dark)] bg-white focus:outline-none focus:border-[var(--brand-yellow)]" />
        <button type="button" className={botaoPri} disabled={enviando} onClick={() => entrada.current?.click()}>
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Sub PCI atual
        </button>
      </div>
      {erro ? <p role="alert" className="text-sm text-red-700">{erro}</p>
        : !modelos ? <p className="text-sm text-gray-700">Carregando versões…</p>
        : !modelos.length ? <p className="text-sm text-amber-700">Nenhum modelo enviado ainda.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-1">Versão</th><th className="p-1">Arquivo</th><th className="p-1">Enviado</th><th className="p-1">Autor</th><th className="p-1" /></tr></thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="p-1 font-bold">v{m.versao}{m.atual && <span className="ml-2 bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">atual</span>}
                      {m.aguardandoConfirmacao && <span className="ml-2 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">aguarda confirmação</span>}
                      {m.relatorio && (
                        <button type="button" className="block text-xs font-normal text-[var(--brand-dark)] underline" onClick={() => setRelatorioAberto(relatorioAberto === m.id ? null : m.id)}>
                          {relatorioAberto === m.id ? "ocultar relatório" : `relatório de compatibilidade${m.relatorio.critico ? " (crítico)" : ""}`}
                        </button>
                      )}
                      {relatorioAberto === m.id && m.relatorio && <RelatorioCompatibilidade r={m.relatorio} />}
                    </td>
                    <td className="p-1 break-all">{m.arquivo} <span className="text-xs text-gray-500">(.{m.formato}, {tamanho(m.tamanho)})</span>{m.observacao && <span className="block text-xs text-gray-500">{m.observacao}</span>}</td>
                    <td className="p-1 whitespace-nowrap">{new Date(m.enviadoEm).toLocaleString("pt-BR")}</td>
                    <td className="p-1">{m.autor ?? "—"}</td>
                    <td className="p-1">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button type="button" className={botaoSec} aria-label={`Baixar original da versão ${m.versao}`}
                          onClick={() => baixarArquivoEmPartes(`/api/pci-modelos/${m.id}`, m.arquivo).catch((e: Error) => toast.error(e.message))}>
                          <Download size={14} />
                        </button>
                        {!m.atual && <button type="button" className={botaoSec} onClick={() => void tornarAtual(m)}>{m.aguardandoConfirmacao ? "Confirmar e tornar atual" : "Tornar atual"}</button>}
                        {!m.atual && (
                          <button type="button" className={`${botaoSec} border-red-300 text-red-700`} disabled={excluindo} aria-label={`Excluir a versão ${m.versao}`} onClick={() => void excluir(m)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

/** Lote 03, correção 10: relatório guardado junto da versão. */
function RelatorioCompatibilidade({ r }: { r: Relatorio }) {
  const linha = (rotulo: string, itens: string[]) => itens.length ? <li>{rotulo}: {itens.slice(0, 12).join(", ")}{itens.length > 12 ? ` (+${itens.length - 12})` : ""}</li> : null;
  const semDiferencas = !r.criticas.length && !r.avisos.length && !r.abasAdicionadas.length && !r.abasRemovidas.length && !r.celulasAlteradas.length && !r.listasAdicionadas.length && !r.listasRemovidas.length && !r.listasAlteradas.length;
  return (
    <div className="mt-1 max-w-xl border border-gray-200 bg-gray-50 p-2 text-xs font-normal text-gray-700">
      <p>{r.versaoAnterior ? `Comparado com a versão ${r.versaoAnterior}.` : "Primeira versão: comparada só com o mapeamento do sistema."}</p>
      {r.criticas.length > 0 && (
        <div className="mt-1 text-amber-800"><AlertTriangle size={14} className="mr-1 inline" />Mudanças críticas:
          <ul className="ml-4 list-disc">{r.criticas.slice(0, 20).map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <ul className="ml-4 mt-1 list-disc">
        {linha("Abas adicionadas", r.abasAdicionadas)}
        {linha("Abas removidas", r.abasRemovidas)}
        {linha("Células alteradas", r.celulasAlteradas.map((c) => `${c.celula} (${c.antes} → ${c.depois})`))}
        {linha("Listas adicionadas", r.listasAdicionadas)}
        {linha("Listas removidas", r.listasRemovidas)}
        {linha("Listas alteradas", r.listasAlteradas.map((l) => l.lista))}
        {r.avisos.map((a) => <li key={a}>{a}</li>)}
        {semDiferencas && <li>Sem diferenças de estrutura.</li>}
      </ul>
    </div>
  );
}
