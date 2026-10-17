"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Pencil, Trash2, Upload, XCircle } from "lucide-react";
import { publicarEnvio } from "@/lib/envio-progresso";
import { comprimirImagem, enviarJsonComProgresso, mensagemErroEnvio, pareceImagem } from "@/lib/obras/comprimir-imagem";
import { LIMITE_LEGENDA } from "@/lib/obras/fotos";
import { atualizarFotoObra, excluirFotoObra } from "@/lib/actions/obra-progresso";

// EPIC-020 Lote 4 (item 28) — galeria de fotos da obra, igual à Prospecta:
// várias fotos por envio, progresso por arquivo, nunca preso em "Enviando".

export interface FotoObra { id: string; url: string; legenda: string | null; tiradaEm: string; incluirNoRelatorio: boolean }
type Envio = { nome: string; estado: "preparando" | "enviando" | "ok" | "erro"; fracao: number; erro?: string };

export function FotosObra({ obraId, fotos }: { obraId: string; fotos: FotoObra[] }) {
  const router = useRouter();
  const [legenda, setLegenda] = useState("");
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Marcação "no relatório" otimista: muda na hora e volta se o servidor recusar.
  const [noRelatorio, setNoRelatorio] = useState<Record<string, boolean>>({});
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  const marcar = (i: number, parcial: Partial<Envio>) => setEnvios((lista) => lista.map((e, j) => (j === i ? { ...e, ...parcial } : e)));

  const enviar = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    setOcupado(true);
    setErro(null);
    setEnvios(arquivos.map((f) => ({ nome: f.name, estado: "preparando", fracao: 0 })));
    let enviados = 0;
    try {
      for (let i = 0; i < arquivos.length; i++) {
        const f = arquivos[i];
        try {
          if (!pareceImagem(f)) throw new Error("Não é uma imagem.");
          const { dataUrl } = await comprimirImagem(f);
          marcar(i, { estado: "enviando" });
          const { status, dados } = await enviarJsonComProgresso(
            `/api/obras/${obraId}/fotos`,
            { image: dataUrl, caption: legenda.trim() || null, takenAt: new Date(f.lastModified || Date.now()).toISOString(), includeInReport: true },
            (fracao) => {
              marcar(i, { fracao });
              publicarEnvio({ item: "foto", atual: i + 1, total: arquivos.length, fracao });
            }
          );
          if (status < 200 || status >= 300) throw new Error(mensagemErroEnvio(status, dados));
          marcar(i, { estado: "ok", fracao: 1 });
          enviados++;
        } catch (e) {
          marcar(i, { estado: "erro", erro: e instanceof Error ? e.message : String(e) });
        }
      }
    } finally {
      publicarEnvio(null);
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
      if (enviados) {
        setLegenda("");
        router.refresh();
      }
      if (enviados < arquivos.length) setErro(`${arquivos.length - enviados} foto(s) não foram enviadas. Veja o motivo abaixo.`);
    }
  };

  const salvarFoto = (foto: FotoObra, parcial: { legenda?: string | null; incluirNoRelatorio?: boolean }) => {
    const incluir = parcial.incluirNoRelatorio ?? noRelatorio[foto.id] ?? foto.incluirNoRelatorio;
    // Fora da transição: a atualização otimista precisa aparecer na hora.
    if (parcial.incluirNoRelatorio !== undefined) setNoRelatorio((m) => ({ ...m, [foto.id]: incluir }));
    iniciar(async () => {
      const r = await atualizarFotoObra(foto.id, parcial.legenda !== undefined ? parcial.legenda : foto.legenda, incluir);
      if (!r.ok) {
        setErro(r.erro);
        setNoRelatorio((m) => { const { [foto.id]: _descartado, ...resto } = m; void _descartado; return resto; });
      }
      else { setEditando(null); router.refresh(); }
    });
  };

  const apagar = (foto: FotoObra) => {
    if (!window.confirm("Excluir esta foto definitivamente?")) return;
    iniciar(async () => {
      const r = await excluirFotoObra(foto.id);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  };

  return (
    <section className="bg-white border border-gray-100 p-5 space-y-5">
      <div>
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Galeria de Fotos</h2>
        <p className="text-xs text-gray-500 mt-1">Fotos do andamento da obra. Marque quais entram no relatório executivo.</p>
      </div>
      <div className="border-2 border-dashed border-gray-200 p-5 space-y-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Legenda (opcional, vale para as fotos deste envio)
          <input maxLength={LIMITE_LEGENDA} placeholder="Ex: Fundação concluída" value={legenda} onChange={(e) => setLegenda(e.target.value)} disabled={ocupado}
            className="mt-1 w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 normal-case font-normal focus:outline-none focus:border-[var(--brand-yellow)]" />
        </label>
        <label htmlFor="foto-upload" className={`flex flex-col items-center gap-2 px-6 py-4 border border-gray-200 hover:border-[var(--brand-yellow)] ${ocupado ? "cursor-wait" : "cursor-pointer"}`}>
          {ocupado ? <Loader2 className="animate-spin text-[var(--brand-dark)]" size={28} /> : <Upload className="text-[var(--brand-dark)]" size={28} />}
          <span className="text-sm font-bold text-[var(--brand-dark)]">{ocupado ? "Enviando..." : "Selecionar fotos (uma ou várias)"}</span>
          <span className="text-xs text-gray-500">JPG, PNG, WEBP ou HEIC do iPhone — reduzidas automaticamente</span>
          <input id="foto-upload" ref={entrada} type="file" accept="image/*" multiple className="hidden" disabled={ocupado} onChange={(e) => enviar(Array.from(e.target.files ?? []))} />
        </label>
        {envios.length > 0 && (
          <ul className="space-y-1 text-sm" aria-live="polite">
            {envios.map((e, i) => (
              <li key={`${e.nome}-${i}`} className="flex items-center gap-2 text-gray-600">
                {e.estado === "ok" ? <CheckCircle2 size={14} className="text-green-600" /> : e.estado === "erro" ? <XCircle size={14} className="text-red-600" /> : <Loader2 size={14} className="animate-spin" />}
                <span className="truncate max-w-[45%]">{e.nome}</span>
                <span className="text-xs text-gray-500">{e.estado === "preparando" ? "preparando…" : e.estado === "enviando" ? `${Math.round(e.fracao * 100)}%` : e.estado === "ok" ? "enviada" : e.erro}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erro && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {fotos.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-6">Nenhuma foto enviada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fotos.map((foto) => (
            <figure key={foto.id} className="border border-gray-100">
              <a href={foto.url} target="_blank" rel="noreferrer" title="Abrir em tamanho original">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota autenticada */}
                <img src={foto.url} alt={foto.legenda || "Foto da obra"} loading="lazy" className="w-full aspect-[4/3] object-cover" />
              </a>
              <figcaption className="p-3 space-y-2 text-sm">
                {editando?.id === foto.id ? (
                  <div className="flex gap-2">
                    <input aria-label="Legenda" value={editando.texto} maxLength={LIMITE_LEGENDA} onChange={(e) => setEditando({ id: foto.id, texto: e.target.value })} className="flex-1 border border-gray-200 px-2 py-1 text-sm" />
                    <button type="button" onClick={() => salvarFoto(foto, { legenda: editando.texto.trim() || null })} disabled={pendente} className="bg-[var(--brand-yellow)] px-3 text-xs font-bold">OK</button>
                  </div>
                ) : (
                  <p className="text-[var(--brand-dark)]">{foto.legenda || <span className="text-gray-600">Sem legenda</span>}</p>
                )}
                <p className="text-xs text-gray-500">{new Date(foto.tiradaEm).toLocaleDateString("pt-BR")}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={noRelatorio[foto.id] ?? foto.incluirNoRelatorio} disabled={pendente} onChange={(e) => salvarFoto(foto, { incluirNoRelatorio: e.target.checked })} />
                    No relatório
                  </label>
                  <a href={foto.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--brand-dark)] inline-flex items-center gap-1"><ExternalLink size={12} />Abrir</a>
                  <button type="button" onClick={() => setEditando({ id: foto.id, texto: foto.legenda ?? "" })} className="text-gray-500" aria-label="Editar legenda"><Pencil size={13} /></button>
                  <button type="button" onClick={() => apagar(foto)} disabled={pendente} className="text-red-600" aria-label="Excluir foto"><Trash2 size={13} /></button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
