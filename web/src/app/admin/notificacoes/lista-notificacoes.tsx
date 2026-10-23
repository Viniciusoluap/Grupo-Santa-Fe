"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { NotificacaoConteudo } from "@/components/notificacao-conteudo";
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from "@/lib/actions/notificacoes";

type Item = { id: string; tipo: string; titulo: string; mensagem: string; link: string | null; lida: boolean; quando: string; calculada?: boolean };

export function ListaNotificacoes({ notificacoes, naoLidas }: { notificacoes: Item[]; naoLidas: number }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const abrir = (n: Item) => iniciar(async () => {
    if (!n.lida && !n.calculada) await marcarNotificacaoLida(n.id);
    if (n.link) router.push(n.link); else router.refresh();
  });
  if (notificacoes.length === 0) {
    return <div className="bg-white border border-gray-100 py-12 text-center"><Bell size={28} className="text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-600">Nenhuma notificação.</p></div>;
  }
  return (
    <div className="space-y-2">
      {naoLidas > 0 && (
        <div className="flex justify-end">
          <button type="button" disabled={pendente} onClick={() => iniciar(async () => { await marcarTodasNotificacoesLidas(); router.refresh(); })}
            className="text-xs font-bold uppercase border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 disabled:opacity-50">Marcar todas como lidas</button>
        </div>
      )}
      {notificacoes.map((n) => (
        <button key={n.id} type="button" disabled={pendente} onClick={() => abrir(n)}
          className={`w-full text-left bg-white border px-4 py-3 hover:border-[var(--brand-yellow)] transition-colors flex items-start gap-3 ${n.lida ? "border-gray-100" : "border-l-4 border-l-[var(--brand-yellow)] border-gray-100"}`}>
          <NotificacaoConteudo tipo={n.tipo} titulo={n.titulo} mensagem={n.mensagem} link={n.link} maxItens={10} quando={n.quando + (n.lida ? " · lida" : "")} />
          {!n.lida && <span className="shrink-0 text-[10px] font-bold uppercase bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-1.5 py-0.5">{n.calculada ? "Alerta" : "Nova"}</span>}
        </button>
      ))}
    </div>
  );
}
