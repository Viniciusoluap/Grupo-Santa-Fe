"use client";
// Lote 2, correção 03 (AD-06): Integrações › "Sub PCI atual" — envio da versão
// atualizada do modelo oficial da PCI (CAIXA), versionado. Só admin (página e
// actions conferem). Gêmeo de Prospecta/client/src/components/admin/SubPciAtual.tsx.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { definirModeloAtualPci, listarModelosPciAcao } from "@/lib/actions/pci-gerador";
import { blobParaDataUrl, enviarJsonComProgresso, mensagemErroEnvio } from "@/lib/obras/comprimir-imagem";
import { baixarArquivoEmPartes } from "@/lib/obras/pci-gerador-arquivos";
import { LIMITE_MODELO_PCI_BYTES } from "@/lib/pci-gerador";
import { PARTE_PCI_BYTES } from "@/lib/obras/pci-validacao";

type Modelo = { id: string; versao: number; arquivo: string; formato: string; tamanho: number; atual: boolean; enviadoEm: string; autor: string | null; observacao: string | null };

const botaoSec = "inline-flex items-center gap-1.5 border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const botaoPri = "inline-flex items-center gap-1.5 bg-[var(--brand-dark)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-yellow)] disabled:opacity-50";
const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(b / 1024)} KB`);

export function SubPciAtual() {
  const entrada = useRef<HTMLInputElement>(null);
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [observacao, setObservacao] = useState("");

  const carregar = useCallback(async () => {
    const r = await listarModelosPciAcao();
    if ("erro" in r) setErro(r.erro ?? "Erro ao carregar.");
    else { setErro(null); setModelos(r.modelos); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

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
      const d = fim.dados as { versao: number; repetido: boolean; aviso: string | null };
      toast.success(d.repetido ? `Este arquivo já era a versão ${d.versao}; ela voltou a ser a atual.` : `Modelo enviado: versão ${d.versao} (atual).`);
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
    if (!confirm(`Usar a versão ${m.versao} como modelo atual?`)) return;
    const r = await definirModeloAtualPci(m.id);
    if ("erro" in r) toast.error(r.erro);
    else { toast.success("Modelo atual alterado."); await carregar(); }
  }

  return (
    <section className="space-y-3 border border-gray-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-black uppercase tracking-wide text-[var(--brand-dark)]"><FileSpreadsheet size={18} /> PCI da CAIXA — modelo oficial</h2>
      <p className="text-sm text-gray-700">
        O Gerador de PCI (Editar Obra) preenche o modelo marcado como atual. Envie aqui cada nova versão da planilha oficial
        (.xls ou .xlsm; .xlsb fica guardado, mas só é lido — para gerar, envie também a versão .xls/.xlsm). O arquivo não é reconstruído:
        só os campos de digitação são preenchidos. O envio de PCI das obras continua igual.
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
                    <td className="p-1 font-bold">v{m.versao}{m.atual && <span className="ml-2 bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">atual</span>}</td>
                    <td className="p-1 break-all">{m.arquivo} <span className="text-xs text-gray-500">(.{m.formato}, {tamanho(m.tamanho)})</span>{m.observacao && <span className="block text-xs text-gray-500">{m.observacao}</span>}</td>
                    <td className="p-1 whitespace-nowrap">{new Date(m.enviadoEm).toLocaleString("pt-BR")}</td>
                    <td className="p-1">{m.autor ?? "—"}</td>
                    <td className="p-1">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button type="button" className={botaoSec} aria-label={`Baixar original da versão ${m.versao}`}
                          onClick={() => baixarArquivoEmPartes(`/api/pci-modelos/${m.id}`, m.arquivo).catch((e: Error) => toast.error(e.message))}>
                          <Download size={14} />
                        </button>
                        {!m.atual && <button type="button" className={botaoSec} onClick={() => void tornarAtual(m)}>Tornar atual</button>}
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
