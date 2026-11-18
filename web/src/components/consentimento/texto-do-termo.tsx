// Paridade 17/11 bloco 4: texto completo do termo (fonte única em src/lib/termo-consentimento.ts).
import { SECOES_DO_TERMO, TITULO_DO_TERMO, VERSAO_DO_TERMO } from "@/lib/termo-consentimento";

export function TextoDoTermo({ comTitulo = true }: { comTitulo?: boolean }) {
  return (
    <article className="space-y-5 text-[15px] leading-relaxed text-gray-700">
      {comTitulo && <h1 className="font-black text-2xl uppercase tracking-wide text-[var(--brand-dark)]">{TITULO_DO_TERMO}</h1>}
      <p className="text-sm text-gray-500">Versão {VERSAO_DO_TERMO}</p>
      {SECOES_DO_TERMO.map(secao => (
        <section key={secao.titulo} className="space-y-2">
          <h2 className="font-bold text-lg text-[var(--brand-dark)]">{secao.titulo}</h2>
          {secao.paragrafos.map(p => <p key={p} className="break-words">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
