import { redirect } from "next/navigation";
import { HardHat, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { formatCurrency } from "@/lib/utils";
import { logoutAction } from "@/app/admin/logout-action";

// Acesso do Empreiteiro (EPIC-020 Lote 2, itens 17.2 e 22), espelhado da
// Prospecta: somente as obras em que ele é o empreiteiro vinculado, com o
// próprio percentual e lucro. Nada é editável aqui; percentuais são definidos
// pela empresa.
export default async function EmpreiteiroPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { id?: string; role?: string; name?: string | null };
  if (user.role !== "empreiteiro" || !user.id) redirect(user.role === "cliente" ? "/portal" : "/admin");

  const obras = await prisma.obra.findMany({
    where: { empreiteiroId: user.id },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, endereco: true, progresso: true },
  });
  const cards = await Promise.all(
    obras.map(async (o) => {
      const resumo = await carregarResumoObra(o.id);
      return { ...o, percentual: resumo?.valores.percentualEmpreiteiro ?? null, lucro: resumo?.calculo.lucroEmpreiteiro ?? null };
    }),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[var(--brand-dark)] border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[var(--brand-yellow)] font-black tracking-wider uppercase text-sm">Grupo Santa Fé</span>
            <span className="text-white/20">|</span>
            <span className="text-gray-400 text-xs font-medium">Acesso do Empreiteiro</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-xs hidden sm:block">{user.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1 text-gray-400 hover:text-[var(--brand-yellow)] text-xs font-medium transition-colors">
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide flex items-center gap-2">
            <HardHat className="text-[var(--brand-yellow)]" /> Minhas Obras
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Obras em que você é o empreiteiro vinculado ao Grupo Santa Fé.</p>
        </div>
        {cards.length === 0 && <p className="text-gray-500 text-sm">Nenhuma obra vinculada a você no momento.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((o) => (
            <div key={o.id} className="bg-white border border-gray-100 p-5 space-y-2 text-sm">
              <h2 className="font-bold text-[var(--brand-dark)]">{o.nome}</h2>
              <p className="text-gray-400 text-xs">{o.endereco || "Endereço não informado"}</p>
              <p><span className="text-gray-500">Andamento da obra:</span> {o.progresso}%</p>
              <p>
                <span className="text-gray-500">Sua participação:</span>{" "}
                {o.percentual ? `${Number(o.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}%` : "não definida"}
              </p>
              <p>
                <span className="text-gray-500">Seu lucro estimado:</span>{" "}
                {o.lucro?.ok
                  ? <strong className="text-[var(--brand-dark)]">{formatCurrency(o.lucro.centavos / 100)}</strong>
                  : <span className="text-amber-600">{o.lucro?.motivo ?? "Não calculado"}</span>}
              </p>
              <p className="text-xs text-gray-400">Estimativa calculada sobre o lucro da operação após a participação dos investidores.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
