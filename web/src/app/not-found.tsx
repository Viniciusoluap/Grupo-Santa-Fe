import Link from "next/link";

// Pedido de 18/10 (item 16): página 404 em português (antes, a padrão do Next em inglês).
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md border border-gray-200 bg-white p-8 text-center">
        <p className="text-5xl font-black text-[var(--brand-dark)]">404</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--brand-dark)]">Página não encontrada</h1>
        <p className="mt-3 text-sm text-gray-700">Desculpe, a página que você procura não existe. Ela pode ter sido movida ou excluída.</p>
        <Link href="/" className="mt-6 inline-flex bg-[var(--brand-yellow)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[var(--brand-dark)]">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
