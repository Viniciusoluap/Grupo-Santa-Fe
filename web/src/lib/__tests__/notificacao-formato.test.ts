// Pedido de 23/10 (H4). Mesmo teste em Prospecta/server/notificacao-formato.test.ts.
import { describe, expect, it } from "vitest";
import { datasParaBR, exibirNotificacao, linhaPrazoCard, SEPARADOR_ITENS, tituloPrazosCards } from "@/lib/notificacao-formato";

const antigos = Array.from({ length: 9 }, (_, i) => `CLIENTE ${i + 1} (2026-10-22)`).join("; ");

describe("notificações padronizadas", () => {
  it("formato antigo (texto corrido) vira lista: título curto, ícone, data BR, e mais N, Ver no CRM", () => {
    const n = exibirNotificacao({ title: "9 cards precisam da sua atenção hoje", message: antigos, type: "system", actionUrl: "/admin/crm" });
    expect(n).toMatchObject({ icone: "⏰", titulo: "9 cards com prazo para hoje", resumo: null, restantes: 4, acao: { rotulo: "Ver no CRM", url: "/admin/crm" } });
    expect(n.itens).toEqual(["CLIENTE 1 — prazo 22/10/2026", "CLIENTE 2 — prazo 22/10/2026", "CLIENTE 3 — prazo 22/10/2026", "CLIENTE 4 — prazo 22/10/2026", "CLIENTE 5 — prazo 22/10/2026"]);
  });

  it("formato novo: uma linha por cliente; lista curta não mostra 'e mais'", () => {
    const message = [linhaPrazoCard("ANA", "2026-10-22"), linhaPrazoCard("BRUNO", "2026-10-21")].join(SEPARADOR_ITENS);
    const n = exibirNotificacao({ title: tituloPrazosCards(2), message, type: "system", actionUrl: "/admin/crm" });
    expect(n.itens).toEqual(["ANA — prazo 22/10/2026", "BRUNO — prazo 21/10/2026"]);
    expect(n.restantes).toBe(0);
    expect(tituloPrazosCards(1)).toBe("1 card com prazo para hoje");
  });

  it("mensagem simples continua como resumo, com ícone pelo assunto e data BR", () => {
    const n = exibirNotificacao({ title: "Documento solicitado", message: "Solicitamos: RG até 2026-11-05. Acesse seu portal.", type: "system", actionUrl: "/portal/documentos" });
    expect(n).toMatchObject({ icone: "📄", resumo: "Solicitamos: RG até 05/11/2026. Acesse seu portal.", itens: [], acao: { rotulo: "Abrir no portal" } });
    expect(exibirNotificacao({ title: "Aviso", message: "", actionUrl: null })).toMatchObject({ icone: "🔔", resumo: null, acao: null });
    expect(datasParaBR("de 2026-01-02 a 2026-12-31")).toBe("de 02/01/2026 a 31/12/2026");
  });
});
