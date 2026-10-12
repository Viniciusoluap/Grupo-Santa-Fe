import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { transacaoCRM, sincronizarServicosDoLead, adicionarOperacaoDoLead, propagarDadosClienteDoLead } from "../src/lib/crm/vinculo-lead";
import { registrarMudancaEtapa } from "../src/lib/crm/pipeline-transicao";

// Fixtures artificiais somente. Este programa recusa qualquer servidor remoto.
async function main() {
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (process.env.AIOX_TEST_DATABASE !== "1" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Verificação permitida somente no banco local isolado.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const baseline = process.env.AIOX_BASELINE_SQL;
if (!baseline) throw new Error("Informe o SQL de baseline gerado a partir do commit auditado.");
await pool.query(readFileSync(baseline, "utf8"));
await pool.query(`
 INSERT INTO leads (id,nome,telefone,servico,status,"atualizadoEm") VALUES
 ('teste-legado','Cliente histórico de teste','','[]','proposta',NOW()),
 ('teste-seguro','Cliente novo de teste','','[]','novo',NOW()),
 ('teste-perdido','Cliente perdido de teste','','[]','perdido',NOW());
 INSERT INTO obras (id,nome,tipo,"clienteNome","clienteTel",endereco,area,"valorTotal","engenheiroResp","leadId","atualizadoEm")
 VALUES ('obra-legada','Obra histórica','residencial','Cliente histórico de teste','','Teste',47,200000,'Responsável de teste','teste-legado',NOW()),
 ('obra-sem-lead','Obra não identificada','residencial','Cliente desconhecido','','Teste',47,200000,'Responsável de teste',NULL,NOW());
 INSERT INTO agregador_imoveis (id,titulo,fonte,"atualizadoEm") VALUES ('arquivo-teste','Histórico de teste','fixture',NOW());
`);
await pool.query(readFileSync("prisma/migrations/20261011233000_crm_central_limpeza/migration.sql", "utf8"));
const legacy = await prisma.lead.findUniqueOrThrow({ where: { id: "teste-legado" } });
assert.equal(legacy.status, "proposta"); assert.equal(legacy.etapaOperacional, null);
assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: "teste-seguro" } })).etapaOperacional, "novo_lead");
assert.equal(await prisma.obra.count(), 2);
assert.equal((await prisma.obra.findUniqueOrThrow({ where: { id: "obra-sem-lead" } })).leadId, null);
assert.equal((await pool.query('SELECT count(*)::int AS n FROM arquivo_modulos_removidos.agregador_imoveis')).rows[0].n, 1);
assert.equal((await pool.query("SELECT to_regclass('public.agregador_imoveis') AS tab")).rows[0].tab, null);
console.log("PASS migration: históricos, ambíguos, operações sem lead e arquivo privado preservados");

const servicos = ["Financiamento MCMV", "Obra e reforma", "Projeto de engenharia", "Regularização imobiliária"];
const lead = await transacaoCRM(async (tx) => {
  const l = await tx.lead.create({ data: { nome: "Cliente integrado de teste", telefone: "999999999", servico: JSON.stringify(servicos), etapaOperacional: "novo_lead" } });
  await sincronizarServicosDoLead(l.id, tx); return l;
});
const where = { leadId: lead.id };
assert.equal(await prisma.obra.count({ where }), 1);
assert.equal(await prisma.financiamento.count({ where }), 1);
assert.equal(await prisma.projeto.count({ where }), 1);
assert.equal(await prisma.regularizacao.count({ where }), 1);
const financiamento = await prisma.financiamento.findFirstOrThrow({ where: { leadId: lead.id }, include: { checklist: true } });
assert.equal(financiamento.checklist.length, 15); assert.equal(financiamento.valorImovel, null); assert.equal(financiamento.banco, null);
assert.equal(financiamento.status, "aguardando_configuracao");
await Promise.all([sincronizarServicosDoLead(lead.id), sincronizarServicosDoLead(lead.id)]);
assert.equal(await prisma.servicoLead.count({ where: { leadId: lead.id } }), 4);
const k = "pedido-segunda-operacao-123456";
await transacaoCRM((tx) => adicionarOperacaoDoLead(tx, lead.id, "Obra e reforma", k));
await transacaoCRM((tx) => adicionarOperacaoDoLead(tx, lead.id, "Obra e reforma", k));
assert.equal(await prisma.obra.count({ where: { leadId: lead.id } }), 2);
console.log("PASS CRM: quatro serviços persistidos, checklist atômico, reenvios e múltiplas operações");

await assert.rejects(transacaoCRM(async (tx) => {
  const l = await tx.lead.create({ data: { nome: "Não deve persistir", telefone: "", servico: JSON.stringify(servicos) } });
  await sincronizarServicosDoLead(l.id, tx); throw new Error("Falha controlada após writes");
}), /Falha controlada/);
assert.equal(await prisma.lead.count({ where: { nome: "Não deve persistir" } }), 0);
await transacaoCRM(async (tx) => {
  const l = await tx.lead.update({ where: { id: lead.id }, data: { nome: "Cliente atualizado de teste", telefone: "88888888" } });
  await propagarDadosClienteDoLead(l, tx);
});
assert.equal((await prisma.financiamento.findUniqueOrThrow({ where: { id: financiamento.id } })).clienteNome, "Cliente atualizado de teste");
const current = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
await transacaoCRM((tx) => registrarMudancaEtapa(tx, current, "em_atendimento", "Administrador de teste"));
assert.equal(await prisma.interacao.count({ where: { leadId: lead.id } }), 1);
await assert.rejects(transacaoCRM((tx) => registrarMudancaEtapa(tx, current, "finalizado", "Administrador de teste")), /atualizado/);
assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "novo");
console.log("PASS transações: rollback total, sincronização cadastral, mudança de etapa e controle de concorrência");

await assert.rejects(pool.query(`INSERT INTO obras (id,nome,"clienteNome","clienteTel","atualizadoEm") VALUES ('bypass','Bypass','Teste','',NOW())`), /exclusivamente pelo CRM/);
await assert.rejects(pool.query(`UPDATE obras SET "leadId"='teste-seguro' WHERE id='obra-legada'`), /incompatível/);
const perd = await prisma.lead.findUniqueOrThrow({ where: { id: "teste-perdido" } });
await assert.rejects(transacaoCRM((tx) => registrarMudancaEtapa(tx, perd, "finalizado", "Teste")), /perdido/);
console.log("PASS banco: cadastro independente e vínculo cruzado bloqueados; perdido preservado");

// Conta exclusiva de testes visuais, nunca criada em produção.
const { default: bcrypt } = await import("bcryptjs");
await prisma.usuario.create({ data: { id: "admin-e2e", nome: "Administrador Teste", email: "admin@teste.local", senha: await bcrypt.hash("senha-controlada-local", 10), papel: "admin", ativo: true } });
await prisma.$disconnect(); await pool.end();
if (process.argv.includes("--build")) {
  const resultado = spawnSync("npm", ["run", "build"], { stdio: "inherit", env: process.env });
  if (resultado.status !== 0) throw new Error("Build não aprovado.");
}
if (process.argv.includes("--browser")) {
  const resultado = spawnSync(process.execPath, ["scripts/verify-crm-browser.mjs"], { stdio: "inherit", env: process.env });
  if (resultado.status !== 0) throw new Error("Verificação de navegador não aprovada.");
}
}
void main().catch((erro) => { console.error(erro); process.exit(1); });
