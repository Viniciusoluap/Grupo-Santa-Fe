// Lote 03 — filtro De/Até dos Relatórios do BPO (paridade com o from/to da Prospecta).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { periodoDosParametros, periodoUltimos12Meses } from "@/lib/financeiro/relatorios-bpo-dados";

const AGORA = new Date("2026-10-29T15:00:00Z");

describe("periodoDosParametros", () => {
  it("sem filtro: últimos 12 meses (1º dia do mês de 11 meses atrás até hoje)", () => {
    expect(periodoUltimos12Meses(AGORA)).toEqual({ de: "2025-11-01", ate: "2026-10-29" });
    expect(periodoDosParametros(undefined, undefined, AGORA)).toEqual({ de: "2025-11-01", ate: "2026-10-29", personalizado: false });
  });
  it("usa as datas informadas; só uma ponta mantém a outra no padrão", () => {
    expect(periodoDosParametros("2026-01-01", "2026-03-31", AGORA)).toEqual({ de: "2026-01-01", ate: "2026-03-31", personalizado: true });
    expect(periodoDosParametros("2026-02-01", undefined, AGORA)).toEqual({ de: "2026-02-01", ate: "2026-10-29", personalizado: true });
  });
  it("data inválida é ignorada; De depois de Até troca as pontas", () => {
    expect(periodoDosParametros("2026-02-30", "abc", AGORA)).toEqual({ de: "2025-11-01", ate: "2026-10-29", personalizado: false });
    expect(periodoDosParametros("2026-05-01", "2026-01-01", AGORA)).toEqual({ de: "2026-01-01", ate: "2026-05-01", personalizado: true });
  });
});
