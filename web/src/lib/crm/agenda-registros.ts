import { chaveDoCard } from "./vencimento-card";

export type FiltroAgenda = "data_selecionada" | "leads_vencidos" | "leads_do_dia" | "leads_a_vencer" | "todas_tarefas"
  | "tarefas_atrasadas_e_do_dia" | "tarefas_atrasadas";

/** Atrasada é automática: prazo vencido e tarefa não concluída/cancelada (gêmeo de Prospecta/shared/tarefas-filtro.ts). */
export function tarefaAtrasada(t: { prazo: Date | string | null; status: string }, agora = new Date()) {
  if (!t.prazo || ["concluida", "cancelada"].includes(t.status)) return false;
  const prazo = new Date(t.prazo);
  return !Number.isNaN(prazo.getTime()) && prazo < agora;
}

/** Horários seguem o dispositivo; datas civis dos cards nunca passam pelo fuso local. */
export function chaveLocalAgenda(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type VisitaBase = { id: string; agendadaPara: Date | string };
type CardBase = { id: string; vencimentoCard: Date | string | null };
type TarefaBase = { id: string; prazo: Date | string | null; status: string };

export function registrosAgenda<V extends VisitaBase, C extends CardBase, T extends TarefaBase>(
  visitas: V[], cards: C[], tarefas: T[], filtro: FiltroAgenda, dia: string, hoje: string, agora = new Date(),
) {
  const registros = [
    ...visitas.map(item => ({ tipo: "agendamento" as const, item, dia: chaveLocalAgenda(item.agendadaPara), ordem: new Date(item.agendadaPara).getTime() })),
    ...cards.filter(item => item.vencimentoCard).map(item => ({ tipo: "lead" as const, item, dia: chaveDoCard(item.vencimentoCard), ordem: new Date(`${chaveDoCard(item.vencimentoCard)}T00:00:00`).getTime() })),
    ...tarefas.map(item => ({ tipo: "tarefa" as const, item, dia: item.prazo ? chaveLocalAgenda(item.prazo) : "", ordem: item.prazo ? new Date(item.prazo).getTime() : Infinity })),
  ];
  return registros.filter(registro => {
    if (filtro === "todas_tarefas") return registro.tipo === "tarefa";
    // só o que exige ação agora: atrasadas e as abertas com prazo hoje (futuras e concluídas ficam de fora)
    if (filtro === "tarefas_atrasadas" || filtro === "tarefas_atrasadas_e_do_dia") {
      if (registro.tipo !== "tarefa") return false;
      if (tarefaAtrasada(registro.item, agora)) return true;
      return filtro === "tarefas_atrasadas_e_do_dia" && registro.dia === hoje && !["concluida", "cancelada"].includes(registro.item.status);
    }
    if (filtro !== "data_selecionada") {
      if (registro.tipo !== "lead") return false;
      if (filtro === "leads_vencidos") return registro.dia < hoje;
      if (filtro === "leads_do_dia") return registro.dia === hoje;
      return registro.dia > hoje;
    }
    return registro.dia === dia && (registro.tipo !== "tarefa" || !["concluida", "cancelada"].includes(registro.item.status));
  }).sort((a, b) => a.ordem - b.ordem || a.tipo.localeCompare(b.tipo) || a.item.id.localeCompare(b.item.id));
}
