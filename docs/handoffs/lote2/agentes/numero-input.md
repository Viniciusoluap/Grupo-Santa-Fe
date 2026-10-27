# Agente numero-input — Correção 21 (AD-01)

## Feito (Prospecta)
- `shared/numero-mascara.ts` — lógica pura (formatarNumero, lerNumero, mascararTexto, posicionarCursor, aplicarEdicao, finalizarTexto).
- `server/numero-mascara.test.ts` (35 testes) e `server/numero-input-componente.test.ts` (5 testes SSR) — passando.
- `client/src/components/ui/numero-input.tsx` — NumeroInput.
- Wrappers: `ui/currency-input.tsx`, `ui/percent-input.tsx`, `incorporacao/estudo/compat/{numero-br-field,percent-input}.tsx`.
- `pnpm check`: só erros de `massa-tab.tsx` (outro agente).

## Em andamento
SF: copiar `web/src/lib/numero-mascara.ts` (mesmo texto), NumeroInput, wrappers (currency, numero-br-field, percent, area).

## Depois
Migrar `type="number"` financeiros/área fora da Incorporação e fora dos arquivos do Codex.

## Feito (SF) — 02:05
- `web/src/lib/numero-mascara.ts` (cópia fiel), `web/src/lib/__tests__/numero-mascara.test.ts` (35), `numero-input-componente.test.ts` (4) — passando.
- `web/src/components/ui/numero-input.tsx` + wrappers currency/percent/area/numero-br-field.
- tsc: nenhum erro nos arquivos deste agente (erros restantes são de Prisma não gerado/outros agentes). eslint limpo.
