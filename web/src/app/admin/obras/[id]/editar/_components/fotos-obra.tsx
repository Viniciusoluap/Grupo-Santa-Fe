"use client";
import type { MedicaoGaleria } from "@/lib/obras/galeria-medicoes";
import { GaleriaMedicoes } from "@/components/obras/galeria-medicoes";
export interface FotoObra { id: string; medicaoId: string | null; url: string; legenda: string | null; tiradaEm: string; incluirNoRelatorio: boolean }
export function FotosObra({ fotos, medicoes }: { fotos: FotoObra[]; medicoes: MedicaoGaleria[] }) {
  return <section className="space-y-6 rounded-xl border border-[#C9A961]/30 bg-[#1A2332] p-5 text-slate-100">
    <div><h2 className="text-xl font-semibold text-[#C9A961]">Galeria de Fotos</h2><p className="text-sm text-slate-300">Fotos organizadas por medição. Para adicionar ou alterar fotos, use a aba Progresso.</p></div>
    <GaleriaMedicoes fotos={fotos} medicoes={medicoes} />
  </section>;
}
