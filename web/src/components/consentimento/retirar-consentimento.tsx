"use client";
// Paridade 17/11 bloco 4: o próprio usuário logado retira o consentimento na página do termo (gêmeo do cartão
// "Termo de consentimento" de Meu perfil na Prospecta). A retirada é registrada no servidor (canal "conta").
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retirarMeuConsentimento } from "@/lib/actions/consentimento";

export function RetirarConsentimento() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!confirmando) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setConfirmando(true)} className="border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
          Retirar consentimento
        </button>
        {mensagem && <p role="status" className="text-sm text-gray-700">{mensagem}</p>}
      </div>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirmar retirada" className="space-y-3 border border-red-200 bg-red-50 p-3 text-sm text-gray-800">
      <p>A retirada fica registrada e vale a partir de agora. Ela não desfaz o que foi feito antes, e o sistema vai pedir o aceite de novo para você continuar usando a área logada.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pendente} className="bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60" onClick={() => iniciar(async () => {
          const r = await retirarMeuConsentimento(true);
          setConfirmando(false);
          setMensagem("error" in r ? r.error : "Consentimento retirado. A retirada ficou registrada.");
          router.refresh();
        })}>Confirmar retirada</button>
        <button type="button" disabled={pendente} className="px-4 py-2 text-gray-600" onClick={() => setConfirmando(false)}>Cancelar</button>
      </div>
    </div>
  );
}
