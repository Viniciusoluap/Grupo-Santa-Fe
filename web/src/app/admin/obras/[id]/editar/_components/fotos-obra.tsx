"use client";
import { agruparFotos, type FotoGaleria, type MedicaoGaleria } from "@/lib/obras/galeria-medicoes";
export interface FotoObra { id: string; medicaoId: string | null; url: string; legenda: string | null; tiradaEm: string; incluirNoRelatorio: boolean }
export function FotosObra({ fotos, medicoes }: { fotos: FotoObra[]; medicoes: MedicaoGaleria[] }) {
  const { grupos, antigas } = agruparFotos(fotos, medicoes);
  const renderFotos = (lista: FotoGaleria[]) => <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{lista.map(f => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-current/20 overflow-hidden" aria-label={f.legenda || "Abrir foto da obra"}>
    {/* URLs autenticadas; carregamento sob demanda mantém a galeria leve. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={f.url} alt={f.legenda || "Foto da obra"} loading="lazy" className="h-40 w-full object-cover" />
    {f.legenda && <p className="p-2 text-sm break-words">{f.legenda}</p>}
  </a>)}</div>;
  return <section className="space-y-6 rounded-xl border border-[#C9A961]/30 bg-[#1A2332] p-5 text-slate-100">
    <div><h2 className="text-xl font-semibold text-[#C9A961]">Galeria de Fotos</h2><p className="text-sm text-slate-300">Fotos organizadas por medição. Para adicionar ou alterar fotos, use a aba Progresso.</p></div>
    {grupos.map(g => <section key={g.id} className="space-y-3"><h3 className="font-semibold">{g.titulo} — {g.avancou.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% nesta medição</h3><p className="text-sm text-slate-300">{g.progresso.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% acumulado · Lote de {g.fotos.length} foto(s)</p>{renderFotos(g.fotos)}</section>)}
    {antigas.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Fotos anteriores — sem medição vinculada</h3>{renderFotos(antigas)}</section>}
    {!grupos.length && !antigas.length && <p className="text-sm text-slate-300">Nenhuma foto adicionada às medições desta obra.</p>}
  </section>;
}
