/** O prazo é um dia civil em Imperatriz; registros antigos podem conter horário. */
export function diaPrazoProjeto(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Legados criados a partir de uma data ISO sem horário eram UTC 00:00.
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0)
    return date.toISOString().slice(0, 10);
  const partes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const campo = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

export function persistirDiaPrazoProjeto(dia: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("Informe um prazo de entrega válido.");
  const data = new Date(`${dia}T12:00:00.000Z`);
  if (data.toISOString().slice(0, 10) !== dia) throw new Error("Informe um prazo de entrega válido.");
  return data;
}

export function exibirDiaPrazoProjeto(value: Date | string | null | undefined): string {
  const dia = diaPrazoProjeto(value);
  if (!dia) return "Sem prazo";
  const [ano, mes, data] = dia.split("-");
  return `${data}/${mes}/${ano}`;
}

/** Vencidos, hoje, futuro; sem prazo por último. Data e ID formam ordem estável. */
export function ordenarProjetosPorPrazo<T extends { id: string | number }>(
  projetos: T[], prazo: (p: T) => Date | string | null | undefined,
): T[] {
  return [...projetos].sort((a, b) => {
    const da = diaPrazoProjeto(prazo(a)) ?? "9999-12-31";
    const db = diaPrazoProjeto(prazo(b)) ?? "9999-12-31";
    return da.localeCompare(db) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}
