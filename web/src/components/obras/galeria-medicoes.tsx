import { agruparFotos, type FotoGaleria, type MedicaoGaleria } from "@/lib/obras/galeria-medicoes";

/**
 * Galeria de fotos agrupadas por medição (nº da medição, % na medição, % acumulado,
 * quantidade de fotos e fotos com legenda). Componente único usado em Editar Obra
 * (FotosObra) e em Detalhes da Obra (Lote 02, correção 02). Só exibe: a gestão das
 * fotos continua no fluxo Progresso/Medições. Sem hooks: serve a páginas de servidor
 * e a componentes de cliente.
 */
export function GaleriaMedicoes({ fotos, medicoes, tema = "escuro", vazio = "Nenhuma foto adicionada às medições desta obra." }: {
  fotos: FotoGaleria[];
  medicoes: MedicaoGaleria[];
  /** "escuro" no Editar Obra; "claro" nos cartões brancos de Detalhes. */
  tema?: "escuro" | "claro";
  vazio?: string;
}) {
  const { grupos, antigas } = agruparFotos(fotos, medicoes);
  const secundario = tema === "claro" ? "text-gray-600" : "text-slate-300";
  const pct = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const renderFotos = (lista: FotoGaleria[]) => <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{lista.map(f => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-current/20 overflow-hidden" aria-label={f.legenda || "Abrir foto da obra"}>
    {/* URLs autenticadas; carregamento sob demanda mantém a galeria leve. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={f.url} alt={f.legenda || "Foto da obra"} loading="lazy" className="h-40 w-full object-cover" />
    {f.legenda && <p className="p-2 text-sm break-words">{f.legenda}</p>}
  </a>)}</div>;
  return <div className="space-y-6">
    {grupos.map(g => <section key={g.id} className="space-y-3"><h3 className="font-semibold">{g.titulo} — {pct(g.avancou)}% nesta medição</h3><p className={`text-sm ${secundario}`}>{pct(g.progresso)}% acumulado · Lote de {g.fotos.length} foto(s)</p>{renderFotos(g.fotos)}</section>)}
    {antigas.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Fotos anteriores — sem medição vinculada</h3>{renderFotos(antigas)}</section>}
    {!grupos.length && !antigas.length && <p className={`text-sm ${secundario}`}>{vazio}</p>}
  </div>;
}
