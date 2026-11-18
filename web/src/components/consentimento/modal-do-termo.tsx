"use client";
// Paridade 17/11 bloco 4 (gêmeo de Prospecta/client/src/components/consentimento/ConsentimentoNoLogin.tsx): termo ao entrar
// numa área logada. Não fecha sem aceitar; dá para sair. Quem decide se aparece é o servidor (ConsentimentoNoLogin).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { aceitarTermoNoLogin } from "@/lib/actions/consentimento";
import { logoutAction } from "@/app/admin/logout-action";
import { AVISO_SEM_ACEITE, TITULO_DO_TERMO } from "@/lib/termo-consentimento";
import { CaixaDoTermo } from "./caixa-do-termo";

export function ModalDoTermo({ versao }: { versao: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(true);
  const [marcado, setMarcado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!aberto) return null;
  return (
    <Modal titulo={TITULO_DO_TERMO} papel="alertdialog" tamanho="lg">
      <p className="text-sm text-gray-600">Antes de continuar, leia e confirme. É uma vez só.</p>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault();
        if (!marcado) {
          setAviso(AVISO_SEM_ACEITE.replace("criar a senha", "continuar"));
          document.getElementById("aceite-termo")?.focus();
          return;
        }
        iniciar(async () => {
          const r = await aceitarTermoNoLogin(true, versao);
          if ("error" in r) { setAviso(r.error); return; }
          setAberto(false);
          router.refresh();
        });
      }}>
        <CaixaDoTermo marcado={marcado} onChange={v => { setMarcado(v); if (v) setAviso(null); }} aviso={aviso} />
        <button type="submit" disabled={pendente} className="w-full bg-[var(--brand-yellow)] py-3 text-sm font-bold uppercase tracking-wider text-[var(--brand-dark)] hover:bg-[var(--brand-yellow-dark)] disabled:opacity-60">
          Continuar
        </button>
      </form>
      <form action={logoutAction}>
        <button type="submit" disabled={pendente} className="w-full py-2 text-sm text-gray-600 hover:text-[var(--brand-dark)]">Sair</button>
      </form>
    </Modal>
  );
}
