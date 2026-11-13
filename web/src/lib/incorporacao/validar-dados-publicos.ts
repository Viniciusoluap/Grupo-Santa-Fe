// Validação do resultado do motor 1 (IBGE) enviado pelo NAVEGADOR antes de gravar — mesmos
// limites do schema zod de `salvarDadosPublicos` na Prospecta (server/routers.ts): textos com
// tamanho máximo, números finitos, no máximo 40 indicadores/indisponíveis e fonte sempre o IBGE.
import type { ResultadoDadosPublicos } from "./dados-publicos";

const IBGE = "https://servicodados.ibge.gov.br/";

function texto(v: unknown, max: number, campo: string): string {
  if (typeof v !== "string" || v.length > max) throw new Error(`Dados do IBGE inválidos (${campo}).`);
  return v;
}
function numero(v: unknown, campo: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Dados do IBGE inválidos (${campo}).`);
  return v;
}
function lista(v: unknown, max: number, campo: string): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Error(`Dados do IBGE inválidos (${campo}).`);
  return v;
}
function obj(v: unknown, campo: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`Dados do IBGE inválidos (${campo}).`);
  return v as Record<string, unknown>;
}

export function validarDadosPublicos(entrada: unknown): ResultadoDadosPublicos {
  const d = obj(entrada, "dados");
  const municipio = d.municipio === null ? null : (() => {
    const m = obj(d.municipio, "municipio");
    return { id: numero(m.id, "municipio.id"), nome: texto(m.nome, 200, "municipio.nome"), uf: texto(m.uf, 2, "municipio.uf") };
  })();
  const indicadores = lista(d.indicadores, 40, "indicadores").map((x) => {
    const i = obj(x, "indicador");
    const url = texto(i.url, 500, "url");
    try { new URL(url); } catch { throw new Error("Dados do IBGE inválidos (url)."); }
    if (!url.startsWith(IBGE)) throw new Error("Fonte deve ser o IBGE.");
    const serie = i.serie === undefined ? undefined : lista(i.serie, 50, "serie").map((s) => {
      const p = obj(s, "serie");
      return { periodo: texto(p.periodo, 20, "serie.periodo"), valor: numero(p.valor, "serie.valor") };
    });
    return {
      chave: texto(i.chave, 60, "chave"), indicador: texto(i.indicador, 300, "indicador"), valor: numero(i.valor, "valor"),
      unidade: texto(i.unidade, 120, "unidade"), municipio: texto(i.municipio, 220, "municipio"), periodo: texto(i.periodo, 40, "periodo"),
      fonte: texto(i.fonte, 300, "fonte"), url, consultadoEm: texto(i.consultadoEm, 40, "consultadoEm"),
      ...(i.derivado !== undefined ? { derivado: texto(i.derivado, 300, "derivado") } : {}),
      ...(serie ? { serie } : {}),
    };
  });
  const indisponiveis = lista(d.indisponiveis, 40, "indisponiveis").map((x) => {
    const i = obj(x, "indisponivel");
    return {
      chave: texto(i.chave, 60, "chave"), indicador: texto(i.indicador, 200, "indicador"), motivo: texto(i.motivo, 500, "motivo"),
      ...(i.url !== undefined ? { url: texto(i.url, 500, "url") } : {}),
    };
  });
  return {
    municipio, indicadores, indisponiveis,
    consultadoEm: texto(d.consultadoEm, 40, "consultadoEm"),
    fonteGeral: texto(d.fonteGeral, 300, "fonteGeral"),
  } as ResultadoDadosPublicos;
}
