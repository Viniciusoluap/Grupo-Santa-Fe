import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/rotina.ts).
// Rotina: SLA, lembretes, sequências e fila. Roda no cron diário existente (/api/cron/lead-card-due, sem cron novo
// na Vercel) e, para o SLA de minutos, a cada aviso do WhatsApp e ao abrir o painel — no máximo uma vez por minuto
// (reivindicação em central_vendas_limites).
import { agora, carregarConfig, db, erroSeguro, registrarEvento } from "./base";
import { verificarSla } from "./distribuicao";
import { agendarLembretes } from "./documentos";
import { marcarIncertos, processarFila } from "./envio";
import { agendarSequencias } from "./sequencias";

export async function executarRotinaCentralVendas(opcoes: { limiteMs?: number } = {}) {
  const config = await carregarConfig();
  if (!config.ativo) return { ativo: false };
  const etapa = async <T>(nome: string, f: () => Promise<T>) => {
    try { return await f(); }
    catch (e) { await registrarEvento({ tipo: `erro_rotina_${nome}`, resultado: "erro", erro: erroSeguro(e) }).catch(() => undefined); return null; }
  };
  const sla = await etapa("sla", verificarSla);
  const lembretes = await etapa("lembretes", agendarLembretes);
  const sequencias = await etapa("sequencias", agendarSequencias);
  const incertos = await etapa("incertos", marcarIncertos);
  const fila = await etapa("fila", () => processarFila({ limiteMs: opcoes.limiteMs ?? 30_000 }));
  // Janelas de limitação de taxa com mais de 1 dia não servem mais.
  await etapa("limpeza", () => db().centralVendasLimite.deleteMany({ where: { janela: { lt: new Date(agora().getTime() - 86_400_000) } } }));
  return { ativo: true, sla, lembretes, sequencias, incertos, fila };
}

/** Contador atômico por chave e minuto (INSERT ... ON CONFLICT DO UPDATE ... RETURNING). */
async function contar(chave: string): Promise<number> {
  const janela = new Date(Math.floor(agora().getTime() / 60_000) * 60_000);
  const r = await db().$queryRaw<{ total: number }[]>`INSERT INTO central_vendas_limites (chave, janela, total) VALUES (${chave.slice(0, 120)}, ${janela}, 1)
    ON CONFLICT (chave, janela) DO UPDATE SET total = central_vendas_limites.total + 1 RETURNING total`;
  return Number(r[0]?.total ?? 0);
}

/** Rodada curta (SLA + fila), no máximo uma por minuto entre todas as instâncias. */
export async function rotinaSeNecessario() {
  if (!(await carregarConfig()).ativo) return null;
  if ((await contar("rotina")) !== 1) return null;
  await verificarSla().catch(() => null);
  return processarFila({ limiteMs: 8_000 });
}

/** Limitação de taxa dos endpoints de entrada: `limite` chamadas por minuto por chave. */
export async function dentroDoLimite(chave: string, limite = 30): Promise<boolean> {
  return (await contar(chave)) <= limite;
}
