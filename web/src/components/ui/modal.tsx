"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Correção 11 (lote 3, 29/10) — modal compartilhado do painel.
//
// Antes cada tela tinha o próprio overlay `fixed inset-0` (16 arquivos), com
// larguras/alturas diferentes e, em vários, sem rolagem interna — no iPhone e
// no iPad (Safari) o conteúdo passava da tela, os botões ficavam inacessíveis
// e datas/selects eram cortados. Este componente concentra o padrão:
//  - largura responsiva (`w-full` + `max-w-*` por tamanho, nunca maior que a
//    tela: o overlay tem padding lateral);
//  - altura limitada à área visível (`dvh`, que acompanha a barra do Safari)
//    com rolagem interna (`overflow-y-auto`, `overscroll-contain`);
//  - no celular o painel começa no topo (teclado virtual não esconde o
//    início do formulário); do `sm` em diante fica centralizado;
//  - `min-w-0` nos filhos diretos para grades/tabelas internas não
//    alargarem o painel;
//  - Esc fecha, a página de fundo não rola enquanto o modal está aberto e o
//    foco vai para o painel (acessibilidade).
// Equivalente ao `DialogContent` (Radix) da Prospecta
// (`client/src/components/ui/dialog.tsx`), que já segue o mesmo padrão.

export type TamanhoModal = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const LARGURAS: Record<TamanhoModal, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
};

export interface ModalProps {
  /** Exibe o modal (padrão true — para quem já monta o modal condicionalmente). */
  aberto?: boolean;
  /** Fechar (botão X, Esc e, se habilitado, clique fora). */
  onFechar?: () => void;
  /** Título do cabeçalho (com botão de fechar). Sem título, o conteúdo ocupa o painel inteiro. */
  titulo?: ReactNode;
  /** Rótulo acessível quando não há título em texto. */
  rotulo?: string;
  tamanho?: TamanhoModal;
  papel?: "dialog" | "alertdialog";
  /** Clique no fundo fecha (padrão false: evita perder um formulário preenchido). */
  fecharAoClicarFora?: boolean;
  /** Classes extras do painel. */
  className?: string;
  /** Classes do corpo quando há `titulo` (padrão: padding + espaçamento vertical). */
  classeCorpo?: string;
  children: ReactNode;
}

/** Classes do painel — exportadas para testes e para casos que precisem do mesmo padrão sem o componente. */
export function classesPainelModal(tamanho: TamanhoModal = "md", extra?: string): string {
  return cn(
    "relative my-auto flex w-full min-w-0 flex-col bg-white text-[var(--brand-dark)] shadow-2xl outline-none",
    "max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-2rem)]",
    "[&>*]:min-w-0",
    LARGURAS[tamanho],
    extra,
  );
}

export const CLASSES_FUNDO_MODAL =
  "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 p-3 sm:items-center sm:p-4";

export function Modal({
  aberto = true,
  onFechar,
  titulo,
  rotulo,
  tamanho = "md",
  papel = "dialog",
  fecharAoClicarFora = false,
  className,
  classeCorpo,
  children,
}: ModalProps) {
  const painel = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focoAnterior = document.activeElement as HTMLElement | null;
    // Só move o foco se nada dentro do painel já o recebeu (ex.: autoFocus).
    if (painel.current && !painel.current.contains(document.activeElement)) painel.current.focus({ preventScroll: true });
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) fecharRef.current?.();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
      if (focoAnterior && typeof focoAnterior.focus === "function" && document.contains(focoAnterior)) {
        focoAnterior.focus({ preventScroll: true });
      }
    };
  }, [aberto]);

  if (!aberto) return null;

  const rotuloAcessivel = rotulo ?? (typeof titulo === "string" ? titulo : undefined);

  return (
    <div
      className={CLASSES_FUNDO_MODAL}
      onMouseDown={(e) => {
        if (fecharAoClicarFora && e.target === e.currentTarget) onFechar?.();
      }}
    >
      <div
        ref={painel}
        role={papel}
        aria-modal="true"
        aria-label={rotuloAcessivel}
        tabIndex={-1}
        data-slot="modal"
        className={classesPainelModal(tamanho, className)}
      >
        {titulo != null ? (
          <>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="min-w-0 break-words font-black text-[var(--brand-dark)] text-base uppercase tracking-wide sm:text-lg">{titulo}</h2>
              {onFechar && (
                <button type="button" onClick={onFechar} className="shrink-0 text-gray-700 hover:text-[var(--brand-dark)]" aria-label="Fechar">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className={cn("space-y-4 px-4 py-4 sm:px-6 sm:py-5", classeCorpo)}>{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
