// Portal do Empreiteiro — aba Relatórios (pedido de 15/10/2026). Soma, em todas as
// obras vinculadas ao empreiteiro, o lucro previsto DELE, o VGV e o valor a receber
// do banco. Indicador indisponível (falta dado na obra) não entra na soma e é
// contado como pendente. Gêmeo de shared/portal-empreiteiro.ts da Prospecta.

export type IndicadorPortal = { ok: true; centavos: number } | { ok: false; motivo: string };

export interface ObraDoEmpreiteiro {
  id: string;
  nome: string;
  vgvCentavos: number | null;
  receberBanco: IndicadorPortal;
  lucroEmpreiteiro: IndicadorPortal;
}

export interface Soma {
  centavos: number;
  pendentes: number;
}

export interface TotaisEmpreiteiro {
  quantidade: number;
  lucro: Soma;
  vgv: Soma;
  receberBanco: Soma;
  /** Valores em reais para os gráficos (0 quando indisponível). */
  porObra: { id: string; nome: string; vgv: number; receberBanco: number; lucro: number }[];
}

const somar = (valores: (number | null)[]): Soma => ({
  centavos: valores.reduce<number>((acc, v) => acc + (v ?? 0), 0),
  pendentes: valores.filter((v) => v === null).length,
});
const deIndicador = (i: IndicadorPortal) => (i.ok ? i.centavos : null);

export function totaisDoEmpreiteiro(obras: ObraDoEmpreiteiro[]): TotaisEmpreiteiro {
  return {
    quantidade: obras.length,
    lucro: somar(obras.map((o) => deIndicador(o.lucroEmpreiteiro))),
    vgv: somar(obras.map((o) => o.vgvCentavos)),
    receberBanco: somar(obras.map((o) => deIndicador(o.receberBanco))),
    porObra: obras.map((o) => ({
      id: o.id,
      nome: o.nome.length > 18 ? `${o.nome.slice(0, 17)}…` : o.nome,
      vgv: (o.vgvCentavos ?? 0) / 100,
      receberBanco: (deIndicador(o.receberBanco) ?? 0) / 100,
      lucro: (deIndicador(o.lucroEmpreiteiro) ?? 0) / 100,
    })),
  };
}
