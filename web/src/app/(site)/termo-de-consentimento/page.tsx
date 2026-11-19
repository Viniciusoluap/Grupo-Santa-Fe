// Paridade 17/11 bloco 4 (gêmeo de Prospecta/client/src/pages/TermoConsentimento.tsx): termo completo em página pública,
// aberta pelo link "Ler o termo completo". Quem está logado e tem consentimento ativo vê, no fim, o botão de retirar.
import type { Metadata } from "next";
import { auth } from "@/auth";
import { aceitesDoUsuario } from "@/lib/consentimento";
import { TextoDoTermo } from "@/components/consentimento/texto-do-termo";
import { RetirarConsentimento } from "@/components/consentimento/retirar-consentimento";
import { TITULO_DO_TERMO } from "@/lib/termo-consentimento";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: TITULO_DO_TERMO };

async function situacaoDoVisitante(): Promise<"ativo" | "retirado" | "sem_aceite" | "anonimo"> {
  try {
    const sessao = await auth();
    const id = sessao?.user?.id;
    if (!id) return "anonimo";
    const a = await aceitesDoUsuario(id);
    return a.algum ? "ativo" : a.retirado ? "retirado" : "sem_aceite";
  } catch {
    return "anonimo";
  }
}

export default async function TermoDeConsentimentoPage() {
  const situacao = await situacaoDoVisitante();
  return (
    <div className="bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl bg-white p-5 md:p-8">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-gray-500">Grupo Santa Fé</p>
        <TextoDoTermo />
        {situacao !== "anonimo" && (
          <section className="mt-8 space-y-2 border-t border-gray-200 pt-6">
            <h2 className="font-bold text-lg text-[var(--brand-dark)]">Seu consentimento</h2>
            {situacao === "ativo" && <><p className="text-sm text-gray-700">Você aceitou este termo.</p><RetirarConsentimento /></>}
            {situacao === "retirado" && <p className="text-sm text-gray-700">Você retirou o consentimento. Ao entrar na sua área, o sistema pede o aceite de novo.</p>}
            {situacao === "sem_aceite" && <p className="text-sm text-gray-700">Não há aceite deste termo registrado na sua conta.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
