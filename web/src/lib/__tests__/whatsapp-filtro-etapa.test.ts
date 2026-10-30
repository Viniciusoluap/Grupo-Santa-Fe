// Pedido de 30/10 — filtro por etapa do lead na aba "Enviar mensagem" (gêmeo de
// Prospecta/server/whatsapp-filtro-etapa.test.ts). Só regras puras, sem banco nem serviço externo.
import { describe, expect, it } from "vitest";
import { ETAPA_TODAS, LOTE_ENVIO_WHATSAPP, alternarTodosVisiveis, filtrarDestinatarios, limparVisiveis, lotesDeEnvio, resumoSelecao } from "@/lib/whatsapp/conversas";
import { ETAPAS_ACOMPANHAMENTO } from "@/lib/portal-corretor";
import { etapaDoLead } from "@/lib/crm/pipeline";

const leads = [
  { id: "1", nome: "Ana Souza", telefone: "94999990001", etapa: "novo_lead" },
  { id: "2", nome: "Bruno Lima", telefone: "94999990002", etapa: "medicoes" },
  { id: "3", nome: "Ana Paula", telefone: "94999990003", etapa: "medicoes" },
  { id: "4", nome: "Carlos", telefone: "94999990004", etapa: null },
];
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe("WhatsApp › filtro por etapa do lead (30/10)", () => {
  it("as opções são as 7 etapas do CRM com os nomes do filtro do CRM", () => {
    expect(ETAPAS_ACOMPANHAMENTO.map((e) => e.nome)).toEqual([
      "Lead Novo", "Em Atendimento", "Aprovado e Follow up", "Projetos e Vistorias", "Contratos e Cartório", "Medições", "Finalizado",
    ]);
    expect(etapaDoLead({ etapaOperacional: "medicoes", status: "novo" })).toBe("medicoes");
  });
  it("'Todas as etapas' não filtra; etapa filtra; lead sem etapa só aparece em 'todas'", () => {
    expect(ids(filtrarDestinatarios(leads, "", ETAPA_TODAS))).toEqual(["1", "2", "3", "4"]);
    expect(ids(filtrarDestinatarios(leads, "", ""))).toEqual(["1", "2", "3", "4"]);
    expect(ids(filtrarDestinatarios(leads, "", "medicoes"))).toEqual(["2", "3"]);
    expect(ids(filtrarDestinatarios(leads, "", "finalizado"))).toEqual([]);
  });
  it("etapa combina com a busca por nome ou telefone", () => {
    expect(ids(filtrarDestinatarios(leads, "ana", "medicoes"))).toEqual(["3"]);
    expect(ids(filtrarDestinatarios(leads, "ana", ETAPA_TODAS))).toEqual(["1", "3"]);
    expect(ids(filtrarDestinatarios(leads, "0002", "medicoes"))).toEqual(["2"]);
  });
  it("selecionar todos pega todos da etapa e mantém o que já estava marcado fora do filtro", () => {
    const visiveis = ids(filtrarDestinatarios(leads, "", "medicoes"));
    const sel = alternarTodosVisiveis(["1"], visiveis);
    expect(sel).toEqual(["1", "2", "3"]);
    expect(resumoSelecao(sel, visiveis)).toEqual({ total: 3, visiveis: 2, foraDoFiltro: 1 });
    // trocar o filtro não mexe na seleção; "Limpar" tira só os visíveis
    expect(limparVisiveis(sel, visiveis)).toEqual(["1"]);
    expect(limparVisiveis(sel, [])).toEqual(sel);
    expect(resumoSelecao([], visiveis)).toEqual({ total: 0, visiveis: 0, foraDoFiltro: 0 });
  });
  it("envio de etapa grande vai em lotes de 200, sem perder nem repetir destinatário", () => {
    const todos = Array.from({ length: 451 }, (_, i) => String(i));
    const lotes = lotesDeEnvio(todos);
    expect(LOTE_ENVIO_WHATSAPP).toBe(200);
    expect(lotes.map((l) => l.length)).toEqual([200, 200, 51]);
    expect(lotes.flat()).toEqual(todos);
    expect(lotesDeEnvio([])).toEqual([]);
    expect(lotesDeEnvio(["a", "b", "c"], 0)).toEqual([["a"], ["b"], ["c"]]);
  });
});
