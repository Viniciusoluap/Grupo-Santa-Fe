"use client";
// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-06 (`proposta-terreno-envio.tsx`): botões "Baixar proposta em PDF" e
// "Enviar proposta por e-mail" de cada proposta, prévia do PDF, confirmação do destinatário, envio, histórico (data,
// destinatário, situação) e reenvio. Enviar não aceita a proposta. O PDF vem sempre do servidor (gerador único).
import { useEffect, useState } from "react";
import { Download, Loader2, Mail, RotateCcw, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { exigirResultado } from "@/lib/acao-resultado";
import { enviarPropostaTerreno, pdfPropostaTerreno, type enviosPropostaTerreno } from "@/lib/actions/proposta-terreno";

type PdfProposta = { base64: string; nomeArquivo: string; dataEmissao: string; sha256: string };
export type EnvioProposta = Awaited<ReturnType<typeof enviosPropostaTerreno>>[number];

const btn = "inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 min-h-10 border disabled:opacity-50";
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : "Operação falhou.");
/** Mesma regra do servidor, só para avisar na tela antes de enviar. */
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function blobDoPdf(pdf: PdfProposta): Blob {
  return new Blob([Uint8Array.from(atob(pdf.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
}

function baixarPdf(pdf: PdfProposta) {
  const url = URL.createObjectURL(blobDoPdf(pdf));
  const a = document.createElement("a");
  a.href = url; a.download = pdf.nomeArquivo; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function AcoesPropostaTerreno({ estudoId, propostaId, emailProprietario, envios, salvarAntes, aoEnviar }: {
  estudoId: string;
  propostaId: string;
  emailProprietario: string;
  envios: EnvioProposta[];
  /** Grava a negociação antes: o PDF sai do que está salvo. */
  salvarAntes: () => Promise<boolean>;
  aoEnviar: () => void;
}) {
  const [ocupado, setOcupado] = useState<"pdf" | "previa" | "envio" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ pdf: PdfProposta; url: string } | null>(null);
  const [destinatario, setDestinatario] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  async function baixar() {
    setErro(null);
    setOcupado("pdf");
    try {
      if (!(await salvarAntes())) throw new Error("Salve a negociação antes de gerar o PDF.");
      baixarPdf(exigirResultado(await pdfPropostaTerreno(estudoId, propostaId)));
    } catch (e) { setErro(mensagem(e)); } finally { setOcupado(null); }
  }

  async function abrirEnvio(para = emailProprietario) {
    setErro(null);
    setResultado(null);
    setOcupado("previa");
    try {
      if (!(await salvarAntes())) throw new Error("Salve a negociação antes de enviar.");
      const pdf = exigirResultado(await pdfPropostaTerreno(estudoId, propostaId));
      setDestinatario(para.trim());
      setPrevia({ pdf, url: URL.createObjectURL(blobDoPdf(pdf)) });
    } catch (e) { setErro(mensagem(e)); } finally { setOcupado(null); }
  }

  async function confirmar() {
    if (!previa) return;
    setOcupado("envio");
    setResultado(null);
    try {
      // mesma data de emissão da prévia: o anexo é o mesmo PDF mostrado
      const r = exigirResultado(await enviarPropostaTerreno(estudoId, propostaId, destinatario, previa.pdf.dataEmissao));
      setResultado(r.ok ? { ok: true, texto: `Proposta enviada para ${destinatario.trim().toLowerCase()}.` } : { ok: false, texto: r.motivo ?? "O envio falhou." });
      aoEnviar();
    } catch (e) {
      setResultado({ ok: false, texto: mensagem(e) });
    } finally { setOcupado(null); }
  }

  const ultimo = envios[0];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void baixar()} disabled={!!ocupado}
          className={`${btn} border-gray-200 text-[var(--brand-dark)] hover:bg-gray-50`}>
          {ocupado === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar proposta em PDF
        </button>
        <button type="button" onClick={() => void abrirEnvio()} disabled={!!ocupado}
          className={`${btn} border-transparent bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90`}>
          {ocupado === "previa" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Enviar proposta por e-mail
        </button>
      </div>
      {erro && <p role="alert" className="text-[11px] text-red-700">{erro}</p>}
      {envios.length > 0 && ultimo && (
        <details className="text-[11px] text-gray-600">
          <summary className="cursor-pointer">
            Envios: {envios.length} · último {new Date(ultimo.criadoEm).toLocaleString("pt-BR")} para {ultimo.destinatario} —{" "}
            <span className={ultimo.status === "enviado" ? "text-green-700 font-bold" : "text-red-700 font-bold"}>{ultimo.status === "enviado" ? "enviado" : "falhou"}</span>
          </summary>
          <ul className="mt-1 space-y-1">
            {envios.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{new Date(e.criadoEm).toLocaleString("pt-BR")} · {e.destinatario} ·{" "}
                  <strong className={e.status === "enviado" ? "text-green-700" : "text-red-700"}>{e.status === "enviado" ? "enviado" : "falhou"}</strong>
                  {e.motivo ? ` — ${e.motivo}` : ""}{e.enviadoPorNome ? ` · por ${e.enviadoPorNome}` : ""}</span>
                <button type="button" onClick={() => void abrirEnvio(e.destinatario)} disabled={!!ocupado}
                  className="inline-flex items-center gap-1 underline text-[var(--brand-dark)]"><RotateCcw size={11} /> Reenviar</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal aberto={!!previa} onFechar={() => { if (ocupado !== "envio") setPrevia(null); }} titulo="Enviar proposta por e-mail" tamanho="3xl">
        {previa && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Prévia do PDF que será anexado (emitido em {previa.pdf.dataEmissao.split("-").reverse().join("/")}).{" "}
              <a href={previa.url} target="_blank" rel="noreferrer" className="underline">Abrir em nova aba</a>
            </p>
            <iframe title="Prévia da proposta" src={previa.url} className="hidden sm:block w-full h-[55vh] border border-gray-200" />
            <div>
              <label htmlFor={`destinatario-${propostaId}`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Destinatário</label>
              <input id={`destinatario-${propostaId}`} type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="email@exemplo.com"
                className="w-full text-sm border border-gray-200 px-2.5 py-2 focus:outline-none focus:border-[var(--brand-yellow)]" />
              {destinatario && !emailValido(destinatario) && <p className="text-[11px] text-red-700 mt-1">E-mail inválido.</p>}
            </div>
            <p className="text-[11px] text-gray-600">Enviar não marca a proposta como aceita.</p>
            {resultado && <p role="status" className={`text-xs font-bold ${resultado.ok ? "text-green-700" : "text-red-700"}`}>{resultado.texto}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPrevia(null)} disabled={ocupado === "envio"} className={`${btn} border-gray-200`}>
                <X size={14} /> {resultado?.ok ? "Fechar" : "Cancelar"}
              </button>
              {!resultado?.ok && (
                <button type="button" onClick={() => void confirmar()} disabled={ocupado === "envio" || !emailValido(destinatario)}
                  className={`${btn} border-transparent bg-[var(--brand-dark)] text-[var(--brand-yellow)]`}>
                  {ocupado === "envio" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {resultado ? "Tentar de novo" : "Confirmar envio"}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
