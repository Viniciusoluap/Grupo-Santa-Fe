// Central de Vendas (13/11, gêmeo de Prospecta/server/__fixtures__/central-vendas/*): PostgreSQL isolado em memória
// (PGlite) com o Prisma real. As tabelas existentes vêm do próprio prisma/schema.prisma; as da Central são recriadas
// pela migração 20261113200000 (aplicada duas vezes: idempotência, CHECKs e índices parciais valem nos testes).
// Envio e IA simulados: nada sai para a rede.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { configSchema, type ConfigCentral } from "@/lib/central-vendas/config";
import { definirDependencias, salvarConfig, type ClienteIA } from "@/lib/central-vendas/base";
import { harness } from "./central-vendas-harness";

export const MIGRACAO = "prisma/migrations/20261113200000_central_vendas/migration.sql";
export const sqlMigracao = () => readFileSync(MIGRACAO, "utf8");

function ddlBase(): string {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const cache = join(tmpdir(), `sf-central-vendas-ddl-${createHash("sha1").update(schema).digest("hex").slice(0, 12)}.sql`);
  if (existsSync(cache)) return readFileSync(cache, "utf8");
  const require = createRequire(import.meta.url);
  const ddl = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://teste@127.0.0.1:1/isolado" }, maxBuffer: 10 * 1024 * 1024,
  });
  writeFileSync(cache, ddl);
  return ddl;
}

export const TABELAS_CENTRAL = [
  "central_vendas_campanhas", "central_vendas_checklists", "central_vendas_config", "central_vendas_contatos",
  "central_vendas_documentos", "central_vendas_eventos", "central_vendas_fila", "central_vendas_leads",
  "central_vendas_limites", "central_vendas_produtos", "central_vendas_sequencias", "central_vendas_tokens_mes",
];

export async function criarBanco() {
  const pg = await PGlite.create();
  await pg.exec(ddlBase());
  await pg.exec(`DROP TABLE ${TABELAS_CENTRAL.map(t => `"${t}"`).join(", ")} CASCADE`);
  await pg.exec(sqlMigracao());
  await pg.exec(sqlMigracao());
  const socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 0 });
  await socket.start();
  const pool = new Pool({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  harness.prisma = prisma;
  const linhas = async <T = Record<string, unknown>>(q: string) => (await pg.query<T>(q)).rows;
  const fechar = async () => { await prisma.$disconnect(); await pool.end(); await socket.stop(); await pg.close(); };
  return { pg, prisma, linhas, fechar };
}
export type Banco = Awaited<ReturnType<typeof criarBanco>>;

export const NUMERO_TESTE = "5599988887777";
export const OUTRO_NUMERO = "5599911112222";
/** Ids fixos (ordem do rodízio = ordem dos ids): admin, duas operadoras, analista e um inativo. */
export const U = { admin: "u1-admin", olga: "u2-olga", otto: "u3-otto", ana: "u4-ana", ivo: "u5-ivo" } as const;

export type Envio = { numero: string; texto: string };

/** Zera o banco e monta o cenário comum: usuários, conexão Evolution, Central ligada em modo de teste. */
export async function montarCenario(b: Banco, opcoes: { config?: Partial<ConfigCentral>; agora?: Date } = {}) {
  const tabelas = await b.pg.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  await b.pg.exec(`TRUNCATE ${tabelas.rows.map(t => `"${t.tablename}"`).join(",")} RESTART IDENTITY CASCADE`);
  const u = (id: string, nome: string, papel: string, ativo = true) => ({ id, nome, email: `${id}@teste.invalid`, senha: "x", papel, ativo });
  await b.prisma.usuario.createMany({ data: [
    u(U.admin, "Admin Geral", "admin"), u(U.olga, "Olga Operadora", "colaborador"), u(U.otto, "Otto Operador", "colaborador"),
    u(U.ana, "Ana Analista", "colaborador"), u(U.ivo, "Ivo Inativo", "colaborador", false),
  ] });
  await b.prisma.conexaoWhatsApp.create({ data: { id: "conn-1", usuarioId: U.admin, provedor: "evolution", status: "conectado", instancia: "inst-teste", numero: "5599900000000" } });
  const envios: Envio[] = [];
  let falharEnvios = 0;
  const relogio = { agora: opcoes.agora ?? new Date("2026-11-12T13:00:00Z") }; // 10h em Fortaleza (quinta)
  const respostasIA: (string | Error)[] = [];
  const chamadasIA: Parameters<ClienteIA>[0][] = [];
  const dormidas: number[] = [];
  definirDependencias({
    agora: () => relogio.agora,
    aleatorio: () => 0.5,
    dormir: async ms => { dormidas.push(ms); },
    enviar: async ({ numero, texto }) => {
      if (falharEnvios > 0) { falharEnvios--; return { ok: false, externalId: null, conexaoId: "conn-1", erro: "Evolution fora do ar (simulado)" }; }
      envios.push({ numero, texto });
      return { ok: true, externalId: `ext-${envios.length}-${Math.random()}`, conexaoId: "conn-1" };
    },
    ia: async p => {
      chamadasIA.push(p);
      const r = respostasIA.shift();
      if (r instanceof Error) throw r;
      return { texto: r ?? JSON.stringify({ resposta: "Certo! Pode me contar mais?", confianca: 0.9, transferir: false, campos: {} }), entrada: 100, saida: 50 };
    },
  });
  const config = configSchema.parse({
    ativo: true, modoTeste: true, numerosTeste: [NUMERO_TESTE], operadores: [U.olga, U.otto], analistas: [U.ana],
    horarioAtendimento: { dias: [0, 1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00" }, intervaloMinSeg: 10, intervaloMaxSeg: 20,
    ...opcoes.config,
  });
  await salvarConfig(config, U.admin);
  return {
    ...b, envios, chamadasIA, respostasIA, dormidas, relogio, config,
    falharProximos: (n: number) => { falharEnvios = n; },
    avancar: (minutos: number) => { relogio.agora = new Date(relogio.agora.getTime() + minutos * 60_000); },
    /** Resposta simulada da IA (JSON no formato pedido pelo prompt). */
    ia: (resposta: string, campos: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
      respostasIA.push(JSON.stringify({ resposta, confianca: 0.9, transferir: false, campos, ...extra })),
    salvarConfig: (c: Partial<ConfigCentral>) => salvarConfig(configSchema.parse({ ...config, ...c }), U.admin),
    /** Id do n-ésimo lead criado (1 = primeiro). */
    lead: async (n = 1) => (await b.prisma.lead.findMany({ orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true } }))[n - 1]?.id,
    /** Cria um lead direto no CRM (como a equipe faria) e devolve o id. */
    novoLead: async (dados: { nome: string; telefone: string; responsavelId?: string; etapaOperacional?: string; criadoEm?: Date }) =>
      (await b.prisma.lead.create({ data: { servico: "[]", criadoEm: dados.criadoEm ?? relogio.agora, ...dados }, select: { id: true } })).id,
  };
}
export type Cenario = Awaited<ReturnType<typeof montarCenario>>;

/** Aviso da Evolution de mensagem recebida (texto ou documento). */
export function aviso(id: string, numero: string, texto: string, extra: Record<string, unknown> = {}) {
  return {
    event: "messages.upsert", instance: "inst-teste",
    data: { key: { id, remoteJid: `${numero}@s.whatsapp.net`, fromMe: false }, pushName: "Cliente Teste", message: { conversation: texto }, ...extra },
  };
}
