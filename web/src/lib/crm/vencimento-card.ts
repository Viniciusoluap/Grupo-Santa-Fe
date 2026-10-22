export function dataDoCard(raw: string | null): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || new Date(`${raw}T12:00:00Z`).toISOString().slice(0, 10) !== raw)
    throw new Error("Data de vencimento inválida.");
  return new Date(`${raw}T00:00:00Z`);
}

export function diaEmImperatriz(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function chaveDoCard(date: Date | string | null) {
  return date ? new Date(date).toISOString().slice(0, 10) : "9999-12-31";
}
