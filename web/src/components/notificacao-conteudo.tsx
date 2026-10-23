import { ArrowRight } from "lucide-react";
import { exibirNotificacao } from "@/lib/notificacao-formato";

/**
 * Pedido de 23/10 (H4): corpo padronizado das notificações (sino e "Ver todas").
 * Mesmo layout da Prospecta (client/src/components/NotificacaoConteudo.tsx).
 */
export function NotificacaoConteudo({ tipo, titulo, mensagem, link, maxItens = 5, quando }: {
  tipo: string; titulo: string; mensagem: string; link: string | null; maxItens?: number; quando?: string;
}) {
  const n = exibirNotificacao({ title: titulo, message: mensagem, type: tipo, actionUrl: link }, maxItens);
  return (
    <div className="w-full min-w-0 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-base leading-none shrink-0" aria-hidden="true">{n.icone}</span>
        <span className="text-xs font-bold text-[var(--brand-dark)] leading-snug break-words">{n.titulo}</span>
      </div>
      {n.resumo && <p className="text-xs text-gray-600 break-words">{n.resumo}</p>}
      {n.itens.length > 0 && (
        <ul className="text-xs text-gray-600 space-y-0.5 pl-1">
          {n.itens.map((item, i) => <li key={i} className="flex gap-1.5 break-words"><span aria-hidden="true">•</span><span>{item}</span></li>)}
          {n.restantes > 0 && <li className="italic">e mais {n.restantes}</li>}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {quando && <span className="text-[10px] text-gray-600">{quando}</span>}
        {n.acao && (
          <span className="ml-auto inline-flex items-center gap-1 bg-[var(--brand-yellow)]/20 text-[var(--brand-dark)] px-2 py-1 text-[11px] font-bold">
            {n.acao.rotulo} <ArrowRight size={11} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
