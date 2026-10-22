// Mesmo cálculo de resumo em Prospecta e Grupo Santa Fé. Valores somados
// em centavos; registros manuais vinculados à obra não duplicam o total.
export interface ResumoObraComissao {
  calculo: { valorCentavos: number | null; pagoCentavos: number; saldoCentavos: number | null };
}
export interface ResumoManualComissao { id: string | number; status: string; valor: number }
export function resumirComissoes(
  obrasFiltradas: ResumoObraComissao[],
  manuaisFiltradas: ResumoManualComissao[],
  idsManuaisVinculados: (string | number)[],
) {
  const vinculados = new Set(idsManuaisVinculados.map(String));
  const manuais = manuaisFiltradas.filter(m => !vinculados.has(String(m.id)));
  const centavos = (valor: number) => Math.round(valor * 100);
  const pendente = obrasFiltradas.reduce((s, o) => s + (o.calculo.saldoCentavos ?? 0), 0)
    + manuais.filter(m => ["pendente", "aprovada"].includes(m.status)).reduce((s, m) => s + centavos(m.valor), 0);
  const pago = obrasFiltradas.reduce((s, o) => s + o.calculo.pagoCentavos, 0)
    + manuais.filter(m => m.status === "paga").reduce((s, m) => s + centavos(m.valor), 0);
  const aprovado = manuais.filter(m => m.status === "aprovada").reduce((s, m) => s + centavos(m.valor), 0);
  const geral = obrasFiltradas.reduce((s, o) => s + (o.calculo.valorCentavos ?? 0), 0)
    + manuais.filter(m => m.status !== "cancelada").reduce((s, m) => s + centavos(m.valor), 0);
  return { pendente: pendente / 100, pago: pago / 100, aprovado: aprovado / 100, geral: geral / 100 };
}
