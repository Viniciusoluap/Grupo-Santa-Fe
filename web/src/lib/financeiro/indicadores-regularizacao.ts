import { centavosDe } from "./obra";

// Somente receitas próprias. A chave canônica prevalece sobre o nome editável;
// itens antigos sem chave usam uma lista fechada de nomes equivalentes.
const CHAVES = new Set(["projetos", "pci", "agua", "despachante", "cnd_cno"]);
const NOMES = new Set(["projeto", "projetos", "pci", "agua", "despachante", "cnd e cno", "cnd cno"]);
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[_/-]+/g, " ").replace(/\s+/g, " ");

export function ehReceitaProspecta(item: { chavePadrao?: string | null; nome: string }): boolean {
  if (item.chavePadrao) return CHAVES.has(item.chavePadrao.toLowerCase().trim().replace(/[- ]/g, "_"));
  return NOMES.has(normalizar(item.nome));
}

/** Resultado em centavos; cada item e recebimento são contados uma única vez pelo ID. */
export function indicadoresRegularizacao(
  processos: { id: string | number; status: string }[],
  itens: { id: string | number; regularizacaoId: string | number; chavePadrao?: string | null; nome: string; previsto: string | number }[],
  recebimentos: { id: string | number; itemId: string | number; regularizacaoId: string | number; valor: string | number; status: string }[],
) {
  const validos = new Set(processos.filter(p => p.status !== "cancelado").map(p => String(p.id)));
  const receitas = new Set<string>();
  let contratado = 0;
  for (const item of itens) {
    if (!validos.has(String(item.regularizacaoId)) || !ehReceitaProspecta(item)) continue;
    const id = `${item.regularizacaoId}:${item.id}`;
    if (receitas.has(id)) continue;
    receitas.add(id);
    contratado += centavosDe(item.previsto) ?? 0;
  }
  let recebido = 0;
  const vistos = new Set<string>();
  for (const rec of recebimentos) {
    if (rec.status !== "confirmado") continue;
    const id = `${rec.regularizacaoId}:${rec.id}`;
    if (vistos.has(id) || !receitas.has(`${rec.regularizacaoId}:${rec.itemId}`)) continue;
    vistos.add(id);
    recebido += centavosDe(rec.valor) ?? 0;
  }
  return { contratado, recebido };
}
