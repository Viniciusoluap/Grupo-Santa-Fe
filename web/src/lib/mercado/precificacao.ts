// Precificação por comparáveis ponderados (metodologia Carolina Caribé /
// Incorporação na Prática — "Análise de Mercado e Precificação"): cada
// atributo do produto recebe um peso; o empreendimento novo e cada
// concorrente recebem uma nota por atributo; o preço/m² sugerido escala o
// preço médio dos concorrentes válidos pela proporção entre a nota
// ponderada do novo empreendimento e a nota ponderada média dos concorrentes.
//
// Função pura, sem I/O — testável isoladamente.

export interface AtributoComparavel {
  nome: string;
  peso: number; // 0..3 — quanto maior, mais importa na ponderação
}

export interface Comparavel {
  nome: string;
  precoM2: number | null; // null = ainda não coletado
  notas: number[]; // uma nota por atributo, na mesma ordem/tamanho de atributos
}

export interface ResultadoPrecificacao {
  notaPonderadaNovo: number;
  notaPonderadaMediaComparaveis: number;
  precoMedioComparaveis: number;
  precoSugeridoM2: number;
  comparaveisValidos: number;
  comparaveisIncompletos: string[]; // nomes dos comparáveis com nota ou preço faltando
}

function notaPonderada(notas: number[], pesos: number[]): number {
  const somaPesos = pesos.reduce((s, p) => s + p, 0);
  if (somaPesos <= 0) return 0;
  const somaPonderada = notas.reduce((s, n, i) => s + (n || 0) * (pesos[i] ?? 0), 0);
  return somaPonderada / somaPesos;
}

/** Comparável "válido": preço/m² preenchido e nota atribuída a todos os atributos. */
export function comparavelValido(c: Comparavel, totalAtributos: number): boolean {
  return (
    c.precoM2 != null &&
    c.precoM2 > 0 &&
    c.notas.length === totalAtributos &&
    c.notas.every((n) => Number.isFinite(n) && n > 0)
  );
}

export function calcularPrecificacaoPorComparaveis(
  atributos: AtributoComparavel[],
  notasNovoEmpreendimento: number[],
  comparaveis: Comparavel[]
): ResultadoPrecificacao {
  const pesos = atributos.map((a) => a.peso);
  const notaPonderadaNovo = notaPonderada(notasNovoEmpreendimento, pesos);

  const validos = comparaveis.filter((c) => comparavelValido(c, atributos.length));
  const comparaveisIncompletos = comparaveis
    .filter((c) => !comparavelValido(c, atributos.length))
    .map((c) => c.nome)
    .filter(Boolean);

  const notasPonderadasValidos = validos.map((c) => notaPonderada(c.notas, pesos));
  const notaPonderadaMediaComparaveis =
    notasPonderadasValidos.length > 0
      ? notasPonderadasValidos.reduce((s, n) => s + n, 0) / notasPonderadasValidos.length
      : 0;
  const precoMedioComparaveis =
    validos.length > 0
      ? validos.reduce((s, c) => s + (c.precoM2 as number), 0) / validos.length
      : 0;

  const precoSugeridoM2 =
    notaPonderadaMediaComparaveis > 0
      ? (notaPonderadaNovo * precoMedioComparaveis) / notaPonderadaMediaComparaveis
      : 0;

  return {
    notaPonderadaNovo: Math.round(notaPonderadaNovo * 100) / 100,
    notaPonderadaMediaComparaveis: Math.round(notaPonderadaMediaComparaveis * 100) / 100,
    precoMedioComparaveis: Math.round(precoMedioComparaveis * 100) / 100,
    precoSugeridoM2: Math.round(precoSugeridoM2 * 100) / 100,
    comparaveisValidos: validos.length,
    comparaveisIncompletos,
  };
}
