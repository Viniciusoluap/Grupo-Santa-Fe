import "server-only";
import { prisma } from "@/lib/db";
import { cenarioPrincipalDe } from "./estudos-massa";
import { unidadesDoCenario } from "./unidades";

/** Insert idempotente + histórico, sem tocar vendas, reservas ou excluídas. */
export async function sincronizarUnidadesCenario(estudoId: string, usuarioId: string) {
  const s = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId } });
  if (!s) throw new Error("Estudo não encontrado.");
  const c = cenarioPrincipalDe({ massaCenariosJson: s.massaCenariosJson, cenarioEscolhidoId: s.cenarioEscolhidoId,
    areaBrutaM2: s.areaM2 ?? 0, semKml: s.semKml, lotesAvulsosJson: s.lotesAvulsosJson });
  const rows = unidadesDoCenario(c);
  if (!rows.length) return { geradas: 0 };
  const r = await prisma.$queryRaw<{ n: number }[]>`WITH fonte AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS f(codigo text, chave text, origem text, cenario text, valor text)
  ), changed AS (
    INSERT INTO estudo_unidades(id, "estudoId", codigo, "codigoChave", tipo, "origemChave", "cenarioId", "valorVenda", "atualizadoEm")
    SELECT gen_random_uuid()::text, ${estudoId}, codigo, chave, 'lote', origem, cenario, valor::numeric, now() FROM fonte
    ON CONFLICT ("estudoId", "codigoChave") DO UPDATE SET "cenarioId" = EXCLUDED."cenarioId",
      "origemChave" = COALESCE(estudo_unidades."origemChave", EXCLUDED."origemChave"), "atualizadoEm" = now()
    WHERE estudo_unidades."excluidoEm" IS NULL AND estudo_unidades.status = 'disponivel'
      AND estudo_unidades."cenarioId" IS DISTINCT FROM EXCLUDED."cenarioId"
    RETURNING id, status
  ), audit AS (
    INSERT INTO estudo_unidades_eventos(id, "unidadeId", "statusNovo", "usuarioId")
    SELECT gen_random_uuid()::text, id, status, ${usuarioId} FROM changed RETURNING id
  ) SELECT count(*)::int AS n FROM audit`;
  return { geradas: Number(r[0]?.n ?? 0) };
}
