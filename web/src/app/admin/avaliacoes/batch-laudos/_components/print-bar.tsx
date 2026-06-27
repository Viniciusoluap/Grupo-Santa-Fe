"use client";

export function PrintBar({ count }: { count: number }) {
  return (
    <div className="no-print bg-[#1A1A1A] text-white px-5 py-3 flex items-center gap-4 text-sm mb-4">
      <span className="font-bold">
        {count} laudo{count > 1 ? "s" : ""} selecionado{count > 1 ? "s" : ""} · Clique em &ldquo;Imprimir&rdquo; para salvar como PDF
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto bg-[var(--brand-yellow)] text-[#1A1A1A] font-bold text-xs uppercase px-4 py-1.5 hover:opacity-90"
      >
        Imprimir / Salvar PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="text-gray-400 hover:text-white text-xs uppercase"
      >
        Fechar
      </button>
    </div>
  );
}
