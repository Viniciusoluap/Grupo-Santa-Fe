// Pedido de 18/10 (item 4): todo envio de arquivo mostra o progresso real
// ("Enviando foto 2 de 4 — 65%") na barra fixa <BarraEnvioGlobal />.
// Gêmeo de Prospecta/client/src/lib/envio-progresso.ts.

export type EstadoEnvio = {
  /** "foto", "documento", "PDF"… */
  item: string;
  atual: number;
  total: number;
  /** 0 a 1 do arquivo atual. */
  fracao: number;
} | null;

type Ouvinte = (estado: EstadoEnvio) => void;
const ouvintes = new Set<Ouvinte>();

export function assinarEnvio(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function publicarEnvio(estado: EstadoEnvio) {
  ouvintes.forEach((ouvinte) => ouvinte(estado));
}

export function textoEnvio(estado: NonNullable<EstadoEnvio>): string {
  const qualSemPct = estado.total > 1 ? `${estado.item} ${estado.atual} de ${estado.total}` : estado.item;
  // Envio por ação do servidor: o navegador não informa os bytes; mostra o andamento sem %.
  if (estado.fracao < 0) return `Enviando ${qualSemPct}…`;
  const pct = Math.round(Math.min(1, Math.max(0, estado.fracao)) * 100);
  const qual = estado.total > 1 ? `${estado.item} ${estado.atual} de ${estado.total}` : estado.item;
  return pct >= 100 ? `Processando ${qual}…` : `Enviando ${qual} — ${pct}%`;
}

/** Vários arquivos no mesmo envio: "foto N de M" pelos tamanhos de cada um. */
export function estadoPorTamanhos(item: string, tamanhos: number[], fracaoTotal: number): NonNullable<EstadoEnvio> {
  const total = tamanhos.reduce((a, b) => a + b, 0);
  if (!tamanhos.length || total <= 0) return { item, atual: 1, total: 1, fracao: fracaoTotal };
  const enviados = fracaoTotal * total;
  let acumulado = 0;
  for (let i = 0; i < tamanhos.length; i++) {
    if (enviados < acumulado + tamanhos[i] || i === tamanhos.length - 1) {
      return { item, atual: i + 1, total: tamanhos.length, fracao: Math.min(1, (enviados - acumulado) / tamanhos[i]) };
    }
    acumulado += tamanhos[i];
  }
  return { item, atual: tamanhos.length, total: tamanhos.length, fracao: 1 };
}

export type OpcoesEnvio = { item?: string; atual?: number; total?: number; tamanhos?: number[] };

/** POST de FormData com progresso real; devolve o JSON da resposta ou lança o erro em português. */
export function enviarFormComProgresso<T = unknown>(url: string, dados: FormData, opcoes: OpcoesEnvio = {}): Promise<T> {
  const item = opcoes.item ?? "arquivo";
  const estado = (fracao: number): NonNullable<EstadoEnvio> =>
    opcoes.tamanhos?.length ? estadoPorTamanhos(item, opcoes.tamanhos, fracao) : { item, atual: opcoes.atual ?? 1, total: opcoes.total ?? 1, fracao };
  publicarEnvio(estado(0));
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) publicarEnvio(estado(e.loaded / e.total));
    };
    xhr.onload = () => {
      publicarEnvio(null);
      let corpo: unknown = null;
      try {
        corpo = JSON.parse(xhr.responseText);
      } catch {
        corpo = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(corpo as T);
      const erro = (corpo as { error?: unknown } | null)?.error;
      if (typeof erro === "string") return reject(new Error(erro));
      if (xhr.status === 401 || xhr.status === 403) return reject(new Error("Sessão expirada ou sem permissão. Entre novamente."));
      if (xhr.status === 413) return reject(new Error("Arquivo grande demais para o servidor."));
      reject(new Error(`Erro ao enviar (código ${xhr.status}).`));
    };
    xhr.onerror = () => {
      publicarEnvio(null);
      reject(new Error("Falha de conexão durante o envio."));
    };
    xhr.ontimeout = () => {
      publicarEnvio(null);
      reject(new Error("O envio demorou demais e foi interrompido. Verifique a conexão e tente de novo."));
    };
    xhr.send(dados);
  });
}

/**
 * Envio feito por ação do servidor (sem acesso aos bytes enviados): a barra fixa
 * mostra "Enviando PDF…" com animação até terminar — a tela nunca parece travada.
 */
export async function comEnvio<T>(item: string, executar: () => Promise<T>, posicao: { atual?: number; total?: number } = {}): Promise<T> {
  publicarEnvio({ item, atual: posicao.atual ?? 1, total: posicao.total ?? 1, fracao: -1 });
  try {
    return await executar();
  } finally {
    publicarEnvio(null);
  }
}

/**
 * Envio de arquivo pela rota /api/envio, que chama a mesma ação do servidor de
 * antes — assim a barra mostra o percentual real. Devolve o resultado da ação.
 */
export async function enviarComProgresso<T = unknown>(
  acao: string,
  campos: Record<string, string | Blob> | FormData,
  opcoes: OpcoesEnvio = {},
): Promise<T> {
  const dados = new FormData();
  const pares = campos instanceof FormData ? Array.from(campos.entries()) : Object.entries(campos);
  for (const [chave, valor] of pares) dados.append(chave, valor);
  dados.set("acao", acao);
  const resposta = await enviarFormComProgresso<{ resultado: T }>("/api/envio", dados, opcoes);
  return resposta.resultado;
}
