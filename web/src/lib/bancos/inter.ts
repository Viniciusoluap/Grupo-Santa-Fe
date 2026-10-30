// Lote 4 (30/10/2026) — conector do Banco Inter PJ (API Banking: extrato e saldo), alternativa
// gratuita à Pluggy. DESLIGADO POR PADRÃO: só funciona com a variável BANCO_INTER_API=1.
// Gêmeos: Prospecta server/_core/inter.ts · Santa Fé web/src/lib/bancos/inter.ts (mesma regra).
//
// ATENÇÃO (não verificado na documentação oficial nesta sessão — a web estava bloqueada pelo proxy):
// rotas, escopo e formato abaixo seguem a API Banking v2 do Inter como conhecida até 2026
// (OAuth2 client_credentials com certificado mTLS; `GET /banking/v2/extrato/completo` e
// `GET /banking/v2/saldo`). Antes de ligar em produção, conferir em developers.inter.co e testar
// com a conta real. Nenhum teste chama o Inter (fetch simulado).
import { request } from "node:https";

export const INTER_API = "https://cdpj.partners.bancointer.com.br";
export const ESCOPO_EXTRATO = "extrato.read";
/** Janela máxima por consulta de extrato (dias) — conservadora; a API limita o período por chamada. */
export const JANELA_DIAS = 89;

export type FetchInter = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** Liga/desliga o conector (padrão: desligado). */
export function interHabilitado(env: Record<string, string | undefined> = process.env): boolean {
  return env.BANCO_INTER_API === "1";
}

export type CredencialInter = {
  clientId: string;
  clientSecret: string;
  /** Certificado (.crt) e chave privada (.key) em PEM, gerados no Internet Banking PJ (Integrações). */
  certificado: string;
  chave: string;
  /** Conta corrente (só quando a integração atende mais de uma conta). */
  contaCorrente?: string | null;
};

const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
const PEM_CHAVE = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----/;

/** Valida os campos (sem chamar o Inter). Lança erro em português com o campo que falta. */
export function validarCredencialInter(c: Partial<CredencialInter>): CredencialInter {
  const clientId = (c.clientId ?? "").trim();
  const clientSecret = (c.clientSecret ?? "").trim();
  const certificado = (c.certificado ?? "").trim();
  const chave = (c.chave ?? "").trim();
  if (!clientId) throw new Error("Informe o Client ID da integração do Inter.");
  if (!clientSecret) throw new Error("Informe o Client Secret da integração do Inter.");
  if (!PEM_CERT.test(certificado)) throw new Error("Certificado do Inter inválido: cole o conteúdo do arquivo .crt (BEGIN CERTIFICATE).");
  if (!PEM_CHAVE.test(chave)) throw new Error("Chave privada do Inter inválida: cole o conteúdo do arquivo .key (BEGIN PRIVATE KEY).");
  const contaCorrente = (c.contaCorrente ?? "").toString().replace(/\D/g, "") || null;
  return { clientId, clientSecret, certificado, chave, contaCorrente };
}

export function lerCredencialInter(json: string): CredencialInter {
  let v: unknown;
  try { v = JSON.parse(json); } catch { throw new Error("Credencial do Inter corrompida; cadastre de novo."); }
  return validarCredencialInter((v ?? {}) as Partial<CredencialInter>);
}

/** fetch com certificado de cliente (mTLS), exigido pelo Inter. */
export function criarFetchMtls(cred: Pick<CredencialInter, "certificado" | "chave">): FetchInter {
  return (url, init = {}) => new Promise((resolve, reject) => {
    const req = request(url, { method: init.method ?? "GET", headers: init.headers, cert: cred.certificado, key: cred.chave, timeout: 30_000 }, (res) => {
      const partes: Buffer[] = [];
      res.on("data", (p: Buffer) => partes.push(p));
      res.on("end", () => {
        const texto = Buffer.concat(partes).toString("utf8");
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(texto) });
      });
    });
    req.on("timeout", () => req.destroy(new Error("o Inter não respondeu em 30 s")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

/** Mensagem real do Inter (title/detail/violacoes) + o que fazer, pelo status. */
export async function mensagemErroInter(res: Pick<Response, "status" | "json">, acao: string): Promise<string> {
  let detalhe = "";
  try {
    const c = (await res.json()) as { title?: string; detail?: string; message?: string; error_description?: string; violacoes?: { razao?: string; propriedade?: string }[] };
    const violacoes = (c.violacoes ?? []).map((v) => [v.propriedade, v.razao].filter(Boolean).join(": ")).filter(Boolean).join("; ");
    detalhe = [c.title, c.detail, c.error_description, c.message, violacoes].filter((x) => typeof x === "string" && x.trim()).join(" — ");
  } catch { /* corpo vazio */ }
  const s = res.status;
  const dica = s === 401 ? " Confira o Client ID/Secret e se o certificado/chave são os da mesma integração e não venceram (validade de 1 ano)."
    : s === 403 ? ` A integração não tem o escopo "${ESCOPO_EXTRATO}" — habilite "Consultar extrato e saldo" na integração do Internet Banking PJ.`
      : s === 400 ? " Parâmetros recusados pelo Inter (período ou conta) — envie esta mensagem ao suporte do sistema."
        : s === 429 ? " Limite de chamadas do Inter atingido — tente de novo em alguns minutos."
          : s >= 500 ? " O Inter está instável no momento — tente novamente mais tarde." : "";
  return `O Inter recusou ${acao} (HTTP ${s})${detalhe ? `: ${detalhe.slice(0, 300)}` : ""}.${dica}`;
}

function cabecalhos(token: string, cred: CredencialInter): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...(cred.contaCorrente ? { "x-conta-corrente": cred.contaCorrente } : {}) };
}

export async function tokenInter(cred: CredencialInter, fetchImpl: FetchInter): Promise<string> {
  const body = new URLSearchParams({ client_id: cred.clientId, client_secret: cred.clientSecret, grant_type: "client_credentials", scope: ESCOPO_EXTRATO }).toString();
  let res: Awaited<ReturnType<FetchInter>>;
  try {
    res = await fetchImpl(`${INTER_API}/oauth/v2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  } catch (e) {
    throw new Error(`Não consegui falar com o Inter: ${e instanceof Error ? e.message : "sem resposta"}. Confira o certificado e a chave.`);
  }
  if (!res.ok) throw new Error(await mensagemErroInter(res, "o acesso"));
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("O Inter não devolveu o token de acesso.");
  return data.access_token;
}

export async function fetchInterSaldo(token: string, cred: CredencialInter, fetchImpl: FetchInter): Promise<number | null> {
  const res = await fetchImpl(`${INTER_API}/banking/v2/saldo`, { headers: cabecalhos(token, cred) });
  if (!res.ok) throw new Error(await mensagemErroInter(res, "a consulta de saldo"));
  const data = (await res.json()) as { disponivel?: number };
  return typeof data.disponivel === "number" ? data.disponivel : null;
}

export type MovimentoInter = {
  externalId: string; data: string; descricao: string; valor: number; tipo: "credito" | "debito";
  titular?: string | null; detalhe?: string | null; original?: string | null;
};

type TransacaoInter = {
  idTransacao?: string; dataInclusao?: string; dataTransacao?: string; dataEntrada?: string;
  tipoTransacao?: string; tipoOperacao?: string; valor?: string | number; titulo?: string; descricao?: string;
  detalhes?: { nomePagador?: string; nomeRecebedor?: string; nomeEmpresa?: string } | null;
};

/** Converte uma transação do Inter no formato de movimentação do BPO (sem duplicar: chave inter:<id>). */
export function movimentoDoInter(t: TransacaoInter): MovimentoInter | null {
  const data = (t.dataTransacao ?? t.dataEntrada ?? t.dataInclusao ?? "").slice(0, 10);
  const valor = Math.abs(Number(t.valor));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(valor) || valor === 0) return null;
  const tipo = t.tipoOperacao === "D" ? "debito" : "credito";
  const titulo = (t.titulo ?? "").trim();
  const descricao = (t.descricao ?? "").trim();
  const titular = (tipo === "credito" ? t.detalhes?.nomePagador : t.detalhes?.nomeRecebedor ?? t.detalhes?.nomeEmpresa) ?? null;
  const chave = t.idTransacao ? `inter:${t.idTransacao}` : `inter:${data}:${tipo}:${valor.toFixed(2)}:${titulo}:${descricao}`.slice(0, 250);
  return {
    externalId: chave, data, valor, tipo,
    descricao: [titulo, descricao].filter(Boolean).join(" — ") || (t.tipoTransacao ?? "Movimentação Inter"),
    titular: titular?.trim() || null, detalhe: t.tipoTransacao ?? null, original: JSON.stringify(t).slice(0, 2000),
  };
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Extrato de `desde` a `ate` (AAAA-MM-DD), em janelas e páginas, sem duplicar. */
export async function fetchInterExtrato(token: string, cred: CredencialInter, desde: string, ate: string, fetchImpl: FetchInter): Promise<MovimentoInter[]> {
  const vistos = new Set<string>();
  const saida: MovimentoInter[] = [];
  for (let inicio = desde; inicio <= ate; inicio = somarDias(inicio, JANELA_DIAS + 1)) {
    const fim = [somarDias(inicio, JANELA_DIAS), ate].sort()[0];
    for (let pagina = 0, total = 1; pagina < total && pagina < 200; pagina++) {
      const q = new URLSearchParams({ dataInicio: inicio, dataFim: fim, pagina: String(pagina), tamanhoPagina: "1000" });
      const res = await fetchImpl(`${INTER_API}/banking/v2/extrato/completo?${q}`, { headers: cabecalhos(token, cred) });
      if (!res.ok) throw new Error(await mensagemErroInter(res, "a leitura do extrato"));
      const data = (await res.json()) as { totalPaginas?: number; transacoes?: TransacaoInter[] };
      total = Math.max(1, Number(data.totalPaginas ?? 1));
      for (const t of data.transacoes ?? []) {
        const m = movimentoDoInter(t);
        if (m && !vistos.has(m.externalId)) { vistos.add(m.externalId); saida.push(m); }
      }
    }
  }
  return saida;
}
