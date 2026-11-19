"use client";
// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02 (`LogotipoEmpreendimento.tsx`): logotipo do empreendimento nos
// Dados Gerais: enviar (PNG, JPG, SVG), pré-visualizar, aprovar, trocar, baixar o original e excluir. SVG vira PNG aqui
// no navegador; o servidor confere e guarda as duas versões.
// Diferenças do Santa Fé (registradas no HANDOFF): sem PDF (falta o leitor de PDF no navegador) e sem "Gerar com IA"
// (o Santa Fé não tem gerador de imagem configurado).
import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Trash2, Upload, X } from "lucide-react";
import { ACCEPT_LOGO_ENVIO, LADO_EXIBICAO, LIMITE_LOGO_BYTES, MENSAGEM_LOGO_PDF, tipoDoLogo, tipoPelaExtensao } from "@/lib/incorporacao/logotipo";
import { enviarEmPartes } from "@/lib/incorporacao/envio-partes";
import { excluirLogotipo, obterLogotipo, salvarLogotipo } from "@/lib/actions/logotipo-incorporacao";

export const urlLogoEstudo = (estudoId: string, versao: string) => `/api/incorporacao/logo/${estudoId}?v=${versao.slice(0, 16)}`;

type Logo = Awaited<ReturnType<typeof obterLogotipo>>;
type Previa = { arquivo: File; url: string; png: Blob; largura: number; altura: number };

async function canvasParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Falha ao gerar a imagem de exibição.");
  return blob;
}

/** Imagem de exibição: PNG com o maior lado em até 512 px, proporção mantida. */
async function gerarExibicao(arquivo: File): Promise<{ png: Blob; largura: number; altura: number }> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDoLogo(bytes);
  if (!tipo) throw new Error("O arquivo não é PNG, JPG, SVG ou PDF válido.");
  if (tipo === "application/pdf") throw new Error(MENSAGEM_LOGO_PDF);
  const esperado = tipoPelaExtensao(arquivo.name);
  if (esperado && esperado !== tipo) throw new Error("O conteúdo do arquivo não corresponde à extensão.");
  // <img> não executa scripts do SVG
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não foi possível abrir a imagem."));
      i.src = url;
    });
    const w0 = img.naturalWidth || LADO_EXIBICAO, h0 = img.naturalHeight || LADO_EXIBICAO;
    const escala = Math.min(1, LADO_EXIBICAO / Math.max(w0, h0));
    const fator = tipo === "image/svg+xml" ? LADO_EXIBICAO / Math.max(w0, h0) : escala; // SVG é vetorial: usa o lado todo
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * fator));
    canvas.height = Math.max(1, Math.round(h0 * fator));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { png: await canvasParaPng(canvas), largura: canvas.width, altura: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function base64DoBlob(b: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onerror = () => falha(new Error("Falha ao ler a imagem de exibição."));
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.readAsDataURL(b);
  });
}

export function LogotipoEmpreendimento({ estudoId, inicial }: { estudoId: string; inicial: Logo }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<Logo>(inicial);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  async function preparar(arquivo: File) {
    setErro(null);
    setAviso(null);
    if (!arquivo.size) return setErro("O arquivo está vazio.");
    if (arquivo.size > LIMITE_LOGO_BYTES) return setErro("Logotipo acima de 10 MB.");
    const pelaExtensao = tipoPelaExtensao(arquivo.name);
    if (pelaExtensao === "application/pdf") return setErro(MENSAGEM_LOGO_PDF);
    if (!pelaExtensao) return setErro("Envie PNG, JPG, JPEG ou SVG.");
    setOcupado("Preparando a pré-visualização...");
    try {
      const { png, largura, altura } = await gerarExibicao(arquivo);
      setPrevia({ arquivo, png, largura, altura, url: URL.createObjectURL(png) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setOcupado(null);
    }
  }

  async function aprovar() {
    if (!previa) return;
    setOcupado("Salvando o logotipo...");
    setErro(null);
    try {
      const uploadId = await enviarEmPartes("incorporacao.logo.parte", previa.arquivo, { estudoId }, "logotipo");
      const exibicaoBase64 = await base64DoBlob(previa.png);
      const r = await salvarLogotipo(estudoId, { uploadId, nome: previa.arquivo.name, exibicaoBase64, largura: previa.largura, altura: previa.altura });
      if (!r.ok) { setErro(r.erro); return; }
      setLogo(r.logo);
      setPrevia(null);
      setAviso("Logotipo salvo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o logotipo.");
    } finally {
      setOcupado(null);
    }
  }

  async function remover() {
    if (!window.confirm("Excluir o logotipo deste empreendimento?")) return;
    setErro(null);
    try {
      await excluirLogotipo(estudoId);
      setLogo(null);
      setAviso("Logotipo excluído.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir o logotipo.");
    }
  }

  const imagem = previa?.url ?? (logo ? urlLogoEstudo(estudoId, logo.versao) : null);

  return (
    <div className="bg-white border border-gray-100 p-5 space-y-3" data-testid="logotipo-empreendimento">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Logotipo do empreendimento</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-white p-2 sm:w-40">
          {imagem
            // eslint-disable-next-line @next/next/no-img-element -- imagem do banco servida por rota autenticada
            ? <img src={imagem} alt="Logotipo do empreendimento" className="max-h-full max-w-full object-contain" />
            : <ImageIcon className="h-10 w-10 text-gray-300" aria-label="Sem logotipo" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input ref={inputRef} type="file" accept={ACCEPT_LOGO_ENVIO} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void preparar(f); }} />
          {previa ? (
            <>
              <p className="text-xs text-gray-700">Pré-visualização de “{previa.arquivo.name}”. Aprove para usar neste empreendimento.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={aprovar} disabled={!!ocupado}
                  className="text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] disabled:opacity-50">Aprovar e salvar</button>
                <button type="button" onClick={() => setPrevia(null)} disabled={!!ocupado}
                  className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 border border-gray-300 text-[var(--brand-dark)] disabled:opacity-50"><X size={14} /> Cancelar</button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!!ocupado}
                className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] disabled:opacity-50">
                <Upload size={14} /> {logo ? "Trocar logotipo" : "Enviar logotipo"}
              </button>
              {logo && (
                <>
                  <a href={`/api/incorporacao/logo/${estudoId}/original`} download
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 text-[var(--brand-dark)] underline"><Download size={14} /> Baixar original</a>
                  <button type="button" onClick={remover} disabled={!!ocupado}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 text-red-700 disabled:opacity-50"><Trash2 size={14} /> Excluir</button>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-gray-600">PNG, JPG, JPEG ou SVG, até 10 MB. SVG é convertido em imagem para a exibição.</p>
          {ocupado && <p className="text-xs text-gray-600">{ocupado}</p>}
          {aviso && <p role="status" className="text-xs text-emerald-800">{aviso}</p>}
          {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
