// Lote 23/10, etapa 3 — "Localização exata" da obra. Mesmo arquivo em
// Prospecta/shared/obra-localizacao.ts.
//
// O ponto da obra é guardado num imóvel vinculado (um por obra), que aparece no
// Mapa Operacional. Esse imóvel NUNCA é publicado automaticamente: nasce fora do
// site e dos portais, como "reservado", e só a equipe decide publicá-lo.

export type Coordenadas = { lat: number; lng: number };

export const MENSAGEM_COORDENADAS_INVALIDAS = "Localização inválida: latitude entre -90 e 90 e longitude entre -180 e 180.";

/** Valida e normaliza (7 casas, como o campo do imóvel). Lança erro legível. */
export function normalizarCoordenadas(c: { lat: unknown; lng: unknown }): Coordenadas {
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0))
    throw new Error(MENSAGEM_COORDENADAS_INVALIDAS);
  return { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) };
}

/** Lê o par salvo no imóvel (texto decimal); par inválido ou incompleto = sem ponto. */
export function coordenadasSalvas(lat: unknown, lng: unknown): Coordenadas | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined || String(lat).trim() === "" || String(lng).trim() === "") return null;
  try { return normalizarCoordenadas({ lat, lng }); } catch { return null; }
}

/** Dados do imóvel criado para a obra (sem publicação em nenhum canal). */
export function imovelDaObra(obra: { id: number | string; titulo: string; endereco: string | null; cidade: string | null; estado: string | null }) {
  return {
    titulo: `Obra — ${obra.titulo}`.slice(0, 255),
    descricao: `Ponto da obra nº ${obra.id}, criado automaticamente pela Localização exata. Não publicado.`,
    endereco: obra.endereco?.trim() || null,
    cidade: obra.cidade?.trim() || "Não informada",
    estado: obra.estado?.trim().slice(0, 2) || null,
  };
}

/**
 * Coordenada como vem da PCI da CAIXA → graus decimais. Aceita o número compacto
 * da planilha ("52948 S" = 05°29'48" S), texto em graus/minutos/segundos
 * (`5°30'29.0" S`, `05° 45' 22" S`, `5°32'06'' S`) e decimal (-5.5079).
 * Sul/Oeste (S, W, O) ficam negativos. Valor ilegível ou zerado = null.
 */
export function coordenadaPciDecimal(valor: unknown, eixo?: "lat" | "lng"): number | null {
  const t = String(valor ?? "").trim().toUpperCase().replace(/,/g, ".");
  if (!t) return null;
  const hemisferio = /([NSEWLO])\s*$/.exec(t)?.[1] ?? "";
  // Latitude só aceita N/S e longitude só L/E/O/W: campos trocados não viram ponto no oceano.
  if (eixo === "lat" && hemisferio && !"NS".includes(hemisferio)) return null;
  if (eixo === "lng" && hemisferio && !"EWLO".includes(hemisferio)) return null;
  const sinal = hemisferio === "S" || hemisferio === "W" || hemisferio === "O" ? -1 : 1;
  const corpo = t.replace(/[NSEWLO]\s*$/, "").trim();
  let graus: number;
  const compacto = /^(\d{5,7})(?:\.(\d+))?$/.exec(corpo);
  const dms = /^(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['´’′]\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|''|”|″|′′)?$/.exec(corpo);
  const decimal = /^-?\d{1,3}\.\d+$/.exec(corpo);
  if ((compacto || dms) && !hemisferio) return null; // sem N/S/L/O não dá para saber o sinal
  if (compacto) {
    const dig = compacto[1].padStart(6, "0");
    const g = Number(dig.slice(0, -4)), m = Number(dig.slice(-4, -2)), s = Number(`${dig.slice(-2)}.${compacto[2] ?? 0}`);
    if (m >= 60 || s >= 60) return null;
    graus = g + m / 60 + s / 3600;
  } else if (dms) {
    const g = Number(dms[1]), m = Number(dms[2]), s = Number(dms[3]);
    if (m >= 60 || s >= 60) return null;
    graus = g + m / 60 + s / 3600;
  } else if (decimal) {
    const v = Number(corpo);
    return v === 0 ? null : (hemisferio ? sinal * Math.abs(v) : v);
  } else return null;
  return graus === 0 ? null : sinal * graus;
}

/** Par de coordenadas da identificação da PCI (latitude/longitude) → ponto válido ou null. */
export function coordenadasDaPci(latitude: unknown, longitude: unknown): Coordenadas | null {
  const lat = coordenadaPciDecimal(latitude, "lat");
  const lng = coordenadaPciDecimal(longitude, "lng");
  if (lat === null || lng === null) return null;
  try { return normalizarCoordenadas({ lat, lng }); } catch { return null; }
}

/**
 * Endereço em uma linha: partes preenchidas, separadas por vírgula. Uma parte é omitida
 * se for igual a outra já incluída ou se já estiver, como palavra inteira, no último trecho
 * do endereço (ex.: "Morada do Bosque, Imperatriz/MA" + "Imperatriz" + "MA"). Bairro que só
 * aparece no nome da rua ("Rua Centro, 10" + "Centro") é mantido.
 */
export function enderecoCompleto(partes: Array<string | null | undefined>): string | null {
  const vistas: string[] = [];
  for (const p of partes) {
    const t = (p ?? "").trim();
    if (!t) continue;
    const ultimoTrecho = (vistas.join(", ").split(",").pop() ?? "").trim();
    const palavraInteira = new RegExp(`(^|[\\s,./;-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s,./;-])`, "i");
    const repetida = vistas.some(v => v.toLowerCase() === t.toLowerCase()) || palavraInteira.test(ultimoTrecho);
    if (!repetida) vistas.push(t);
  }
  return vistas.length ? vistas.join(", ") : null;
}
