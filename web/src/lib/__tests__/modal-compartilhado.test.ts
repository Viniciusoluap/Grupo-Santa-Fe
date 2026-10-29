import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CLASSES_FUNDO_MODAL, Modal, classesPainelModal } from "@/components/ui/modal";

// Correção 11 (lote 3): o modal compartilhado garante largura responsiva,
// altura limitada à tela visível e rolagem interna em todos os overlays migrados.
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

describe("Modal compartilhado — padrão responsivo", () => {
  it("painel: largura total no celular, máximo por tamanho, altura em dvh e rolagem interna", () => {
    const c = classesPainelModal("lg");
    for (const classe of ["w-full", "min-w-0", "sm:max-w-lg", "max-h-[calc(100dvh-1.5rem)]", "overflow-y-auto", "overscroll-contain", "[&>*]:min-w-0"]) {
      expect(c.split(" ")).toContain(classe);
    }
    expect(classesPainelModal("3xl").split(" ")).toContain("sm:max-w-3xl");
  });

  it("fundo: cobre a tela com folga lateral, rola se preciso e alinha no topo no celular", () => {
    for (const classe of ["fixed", "inset-0", "z-50", "overflow-y-auto", "p-3", "items-start", "sm:items-center"]) {
      expect(CLASSES_FUNDO_MODAL.split(" ")).toContain(classe);
    }
  });

  it("renderiza role/aria e cabeçalho com botão de fechar quando há título", () => {
    const h = html(createElement(Modal, { titulo: "Editar lançamento", onFechar: () => {}, children: createElement("p", null, "corpo") }));
    expect(h).toContain('role="dialog"');
    expect(h).toContain('aria-modal="true"');
    expect(h).toContain('aria-label="Editar lançamento"');
    expect(h).toContain('aria-label="Fechar"');
    expect(h).toContain("corpo");
  });

  it("fechado não renderiza nada; alertdialog e rótulo explícito são respeitados", () => {
    expect(html(createElement(Modal, { aberto: false, titulo: "X", children: "y" }))).toBe("");
    const h = html(createElement(Modal, { papel: "alertdialog", rotulo: "Excluir", children: "z" }));
    expect(h).toContain('role="alertdialog"');
    expect(h).toContain('aria-label="Excluir"');
  });
});
