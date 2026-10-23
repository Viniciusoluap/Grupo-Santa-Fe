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
