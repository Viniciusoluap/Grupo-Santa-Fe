// 10 implementações, item 01 — filtros combinados da lista de Obras.
// Mesmo arquivo em Prospecta/shared/obras-filtro.ts.
// Todos os filtros valem ao mesmo tempo (E lógico); texto ignora maiúsculas e acentos.

export interface ObraFiltravel {
  id: string | number;
  /** Código exibido ao usuário (ex.: "#123" ou "OB-A1B2C3"). */
  codigo: string;
  nome: string;
  cliente: string;
  status: string;
  /** Nomes de responsáveis (engenheiro, empreiteiro, responsável do CRM). */
  responsaveis: (string | null | undefined)[];
  /** Obra nascida de um serviço do CRM. */
  origemCrm: boolean;
  criadoEm: Date | string;
  /** Período de execução (início e previsão/conclusão), quando houver. */
  inicio?: Date | string | null;
  fim?: Date | string | null;
}

export type OrdemObras = "recentes" | "antigas" | "az" | "za";

export interface FiltrosObras {
  nome: string;
  cliente: string;
  codigo: string;
  /** "" = todas as situações. */
  status: string;
  responsavel: string;
  origem: "todas" | "crm" | "manual";
  /** Período de execução que se sobrepõe ao intervalo (AAAA-MM-DD). */
  periodoDe: string;
  periodoAte: string;
  /** Data de criação do registro (AAAA-MM-DD). */
  criadoDe: string;
  criadoAte: string;
  ordem: OrdemObras;
}

export const FILTROS_OBRAS_VAZIOS: FiltrosObras = {
  nome: "", cliente: "", codigo: "", status: "", responsavel: "", origem: "todas",
  periodoDe: "", periodoAte: "", criadoDe: "", criadoAte: "", ordem: "recentes",
};

export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function contem(valor: string | null | undefined, busca: string): boolean {
  const b = normalizarTexto(busca);
  return !b || normalizarTexto(valor).includes(b);
}

/** Data (sem hora) em milissegundos UTC; null quando vazia ou inválida. */
function dia(valor: Date | string | null | undefined): number | null {
  if (!valor) return null;
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function filtrosAtivos(f: FiltrosObras): number {
  return (["nome", "cliente", "codigo", "status", "responsavel", "periodoDe", "periodoAte", "criadoDe", "criadoAte"] as const)
    .filter((k) => f[k].trim() !== "").length + (f.origem !== "todas" ? 1 : 0);
}

export function filtrarObras<T extends ObraFiltravel>(obras: T[], f: FiltrosObras): T[] {
  const de = dia(f.periodoDe), ate = dia(f.periodoAte);
  const criadoDe = dia(f.criadoDe), criadoAte = dia(f.criadoAte);
  const lista = obras.filter((o) => {
    if (!contem(o.nome, f.nome)) return false;
    if (!contem(o.cliente, f.cliente)) return false;
    if (!contem(o.codigo, f.codigo.replace(/^#/, "")) && !contem(String(o.id), f.codigo.replace(/^#/, ""))) return false;
    if (f.status && o.status !== f.status) return false;
    if (f.responsavel.trim() && !o.responsaveis.some((r) => r && contem(r, f.responsavel))) return false;
    if (f.origem === "crm" && !o.origemCrm) return false;
    if (f.origem === "manual" && o.origemCrm) return false;
    if (de !== null || ate !== null) {
      // Sobreposição do período de execução com o intervalo pedido.
      const inicio = dia(o.inicio), fim = dia(o.fim) ?? inicio;
      if (inicio === null) return false;
      if (ate !== null && inicio > ate) return false;
      if (de !== null && (fim ?? inicio) < de) return false;
    }
    const criado = dia(o.criadoEm);
    if (criadoDe !== null && (criado === null || criado < criadoDe)) return false;
    if (criadoAte !== null && (criado === null || criado > criadoAte)) return false;
    return true;
  });
  const tempo = (o: ObraFiltravel) => new Date(o.criadoEm).getTime();
  const nome = (a: ObraFiltravel, b: ObraFiltravel) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base", numeric: true });
  switch (f.ordem) {
    case "antigas": return lista.sort((a, b) => tempo(a) - tempo(b));
    case "az": return lista.sort(nome);
    case "za": return lista.sort((a, b) => nome(b, a));
    default: return lista.sort((a, b) => tempo(b) - tempo(a));
  }
}
