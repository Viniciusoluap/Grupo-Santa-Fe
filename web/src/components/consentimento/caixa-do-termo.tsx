"use client";
// Paridade 17/11 bloco 4 (gêmeo de Prospecta/client/src/components/consentimento/CaixaDoTermo.tsx): uma linha, um toque —
// caixa DESMARCADA, frase curta e link para o termo completo.
import { FRASE_CURTA_DO_TERMO, ROTA_DO_TERMO } from "@/lib/termo-consentimento";

export function CaixaDoTermo({ marcado, onChange, aviso, opcional = false }: {
  marcado: boolean; onChange: (v: boolean) => void; aviso?: string | null; opcional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3 border border-gray-200 bg-gray-50 p-3">
        <input
          id="aceite-termo"
          type="checkbox"
          checked={marcado}
          onChange={e => onChange(e.target.checked)}
          aria-describedby={aviso ? "aviso-termo" : undefined}
          aria-invalid={aviso ? true : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--brand-yellow)]"
        />
        <p className="text-sm leading-snug text-gray-700">
          <label htmlFor="aceite-termo" className="cursor-pointer">
            {FRASE_CURTA_DO_TERMO}{opcional ? " (opcional)" : ""}
          </label>{" "}
          <a href={ROTA_DO_TERMO} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand-dark)] underline underline-offset-2">
            Ler o termo completo
          </a>
        </p>
      </div>
      {aviso && <p id="aviso-termo" role="alert" className="text-sm font-medium text-red-600">{aviso}</p>}
    </div>
  );
}
