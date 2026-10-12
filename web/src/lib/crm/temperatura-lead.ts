// Temperatura do lead (Lote 1 — item 05). Independente da etapa do funil.
// Mesmas opções, rótulos e emojis da Prospecta.
export const LEAD_TEMPERATURAS = ["frio", "morno", "quente", "fechado"] as const;

export type LeadTemperatura = (typeof LEAD_TEMPERATURAS)[number];

export const LEAD_TEMPERATURA_CONFIG: Record<LeadTemperatura, { label: string; emoji: string; color: string }> = {
  frio: { label: "Frio", emoji: "❄️", color: "text-blue-600" },
  morno: { label: "Morno", emoji: "🌡️", color: "text-yellow-700" },
  quente: { label: "Quente", emoji: "🔥", color: "text-red-600" },
  fechado: { label: "Negócio fechado", emoji: "🤝", color: "text-green-700" },
};

export function isLeadTemperatura(valor: unknown): valor is LeadTemperatura {
  return typeof valor === "string" && (LEAD_TEMPERATURAS as readonly string[]).includes(valor);
}

export function leadTemperaturaRotulo(temperatura: string | null | undefined): string {
  const cfg = LEAD_TEMPERATURA_CONFIG[(temperatura ?? "frio") as LeadTemperatura];
  return cfg ? `${cfg.emoji} ${cfg.label}` : String(temperatura);
}

/** Valor do formulário; ausente mantém o padrão, inválido é recusado. */
export function temperaturaDoFormulario(raw: FormDataEntryValue | null, padrao: LeadTemperatura = "frio"): LeadTemperatura {
  if (raw === null || raw === "") return padrao;
  if (!isLeadTemperatura(raw)) throw new Error("Temperatura do lead inválida.");
  return raw;
}
