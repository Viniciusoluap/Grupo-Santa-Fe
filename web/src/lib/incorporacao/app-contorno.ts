// Paridade 17/11 (bloco 2) — EPIC-023 S-I da Prospecta (`server/incorporacao-app-contorno.ts`): regra de gravação do
// contorno da APP no estudo (`estudos_incorporacao.appContornoJson`). Área e contorno andam juntos: o Estudo de Massa
// nunca pode usar um contorno que não corresponde à área nem ao terreno atual.
import type { MultiPolygon } from "geojson";
import { MAX_VERTICES_CONTORNO_APP } from "@/lib/geo/camadas-terreno";

/**
 * Valor da coluna do contorno ao gravar a APP: string = grava; null = apaga; undefined = mantém o que está gravado.
 * `contorno` explícito (objeto ou null) manda. Sem o campo (cliente antigo, em cache), o contorno gravado continua —
 * a não ser que a área mude mais de 2%: aí ele está velho e é apagado.
 */
export function contornoAoSalvarApp(input: { areaM2: number; contorno?: unknown }, areaAnteriorM2: number | null | undefined): string | null | undefined {
  if (!(input.areaM2 > 0)) return null;
  if (input.contorno === null) return null;
  if (input.contorno !== undefined) return JSON.stringify(input.contorno);
  const antes = Number(areaAnteriorM2 ?? 0);
  return Math.abs(input.areaM2 - antes) > 0.02 * Math.max(antes, 1) ? null : undefined;
}

/** Campos do estudo limpos quando o terreno (KML) é trocado: o contorno da APP era do terreno anterior. */
export const CAMPOS_LIMPOS_AO_TROCAR_TERRENO = { appContornoJson: null } as const;

/**
 * Mesmos limites do schema zod da Prospecta (`saveApp.contorno`): MultiPolygon com 1 a 2000 polígonos, anéis com
 * ao menos 4 pontos, coordenadas finitas em longitude/latitude e no máximo MAX_VERTICES_CONTORNO_APP vértices.
 * Devolve a mensagem do erro ou null quando está válido. `undefined`/`null` são válidos (ausente/limpar).
 */
export function validarContornoApp(g: unknown): string | null {
  if (g === undefined || g === null) return null;
  const c = g as Partial<MultiPolygon>;
  if (typeof g !== "object" || c.type !== "MultiPolygon" || !Array.isArray(c.coordinates)) return "Contorno da APP inválido.";
  if (c.coordinates.length < 1 || c.coordinates.length > 2000) return "Contorno da APP inválido.";
  let vertices = 0;
  for (const poli of c.coordinates) {
    if (!Array.isArray(poli) || poli.length < 1) return "Contorno da APP inválido.";
    for (const anel of poli) {
      if (!Array.isArray(anel) || anel.length < 4) return "Contorno da APP inválido.";
      for (const p of anel) {
        if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every((n) => typeof n === "number" && Number.isFinite(n))) return "Contorno da APP inválido.";
        if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) return "Coordenada fora de longitude/latitude.";
      }
      vertices += anel.length;
    }
  }
  return vertices > MAX_VERTICES_CONTORNO_APP ? `Contorno da APP com vértices demais (máximo ${MAX_VERTICES_CONTORNO_APP}).` : null;
}
