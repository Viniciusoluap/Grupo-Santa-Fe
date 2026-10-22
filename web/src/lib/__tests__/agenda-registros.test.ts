import { describe, expect, it } from "vitest";
import { chaveLocalAgenda, registrosAgenda } from "../crm/agenda-registros";

const hoje = "2026-10-22";
const cards = Array.from({ length: 9 }, (_, index) => ({ id: String(index), vencimentoCard: "2026-10-22T00:00:00.000Z" }));

describe("lista unificada da agenda", () => {
  it("mostra os nove cards contados no dia, mesmo sem visitas", () => {
    const registros = registrosAgenda([], cards, [], "data_selecionada", hoje, hoje);
    expect(registros).toHaveLength(9);
    expect(registros.every(registro => registro.tipo === "lead")).toBe(true);
  });

  it("reúne quatro cards, uma tarefa e um agendamento no dia selecionado", () => {
    const dia = "2026-10-30";
    const visitas = [{ id: "v", agendadaPara: new Date(2026, 9, 30, 10) }];
    const tarefas = [{ id: "t", status: "pendente", prazo: new Date(2026, 9, 30, 9) }];
    const leads = cards.slice(0, 4).map(card => ({ ...card, vencimentoCard: dia }));
    const registros = registrosAgenda(visitas, leads, tarefas, "data_selecionada", dia, hoje);
    expect(registros.map(registro => registro.tipo)).toEqual(["lead", "lead", "lead", "lead", "tarefa", "agendamento"]);
    expect(registrosAgenda(visitas, leads, tarefas, "data_selecionada", hoje, hoje)).toEqual([]);
  });

  it("só mostra todas as tarefas, inclusive sem prazo e encerradas, na opção explícita", () => {
    const tarefas = [
      { id: "sem-data", status: "pendente", prazo: null },
      { id: "outra-data", status: "pendente", prazo: new Date(2026, 10, 2, 12) },
      { id: "encerrada", status: "concluida", prazo: new Date(2026, 9, 22, 12) },
      { id: "cancelada", status: "cancelada", prazo: new Date(2026, 9, 22, 12) },
    ];
    expect(registrosAgenda([], cards, tarefas, "data_selecionada", hoje, hoje)).toHaveLength(9);
    const todos = registrosAgenda([], cards, tarefas, "todas_tarefas", hoje, hoje);
    expect(todos).toHaveLength(4);
    expect(todos.every(registro => registro.tipo === "tarefa")).toBe(true);
    expect(todos.at(-1)?.item.id).toBe("sem-data");
  });

  it("filtra os leads por vencidos, hoje e futuros, sem limitar ao mês selecionado", () => {
    const leads = [
      { id: "vencido", vencimentoCard: "2026-09-30" },
      { id: "hoje", vencimentoCard: hoje },
      { id: "futuro", vencimentoCard: "2026-11-01" },
      { id: "sem-data", vencimentoCard: null },
    ];
    expect(registrosAgenda([], leads, [], "leads_vencidos", "2026-12-01", hoje).map(registro => registro.item.id)).toEqual(["vencido"]);
    expect(registrosAgenda([], leads, [], "leads_do_dia", "2026-12-01", hoje).map(registro => registro.item.id)).toEqual(["hoje"]);
    expect(registrosAgenda([], leads, [], "leads_a_vencer", "2026-12-01", hoje).map(registro => registro.item.id)).toEqual(["futuro"]);
  });

  it("preserva a data civil do card e usa o dia local para horários", () => {
    expect(chaveLocalAgenda(new Date(2026, 9, 22, 23, 30))).toBe(hoje);
    expect(registrosAgenda([], [{ id: "c", vencimentoCard: "2026-10-22T00:00:00.000Z" }], [], "data_selecionada", hoje, hoje)[0].dia).toBe(hoje);
  });
});
