"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROTULOS_OPERACIONAIS } from "@/lib/bpo-operacional";

/** Navegação reversa por ID persistente, sem criar receita/despesa ao abrir um serviço. */
export function FinanceiroServico({ permitido }: { permitido: boolean }) {
  const pathname = usePathname();
  const m = /^\/admin\/(obras|regularizacao|comissoes|projetos|avaliacoes|imoveis|incorporacao|financiamentos)\/([^/]+)$/.exec(pathname);
  if (!permitido || !m || ["novo", "nova"].includes(m[2])) return null;
  const categoria = m[1] === "regularizacao" ? "regularizacoes" : m[1];
  return <div className="mb-4 flex flex-wrap gap-3 text-xs print:hidden"><Link className="rounded border border-gray-200 bg-white px-3 py-2 font-bold text-blue-700" href={`/admin/bpo?categoriaOperacional=${encodeURIComponent(categoria)}&vinculoOperacionalId=${encodeURIComponent(m[2])}`}>Financeiro deste serviço · {ROTULOS_OPERACIONAIS[categoria]}</Link>{categoria === "imoveis" && <Link className="rounded border border-gray-200 bg-white px-3 py-2 font-bold text-blue-700" href={`/admin/bpo?categoriaOperacional=comissoes&vinculoOperacionalId=${encodeURIComponent(m[2])}`}>Despesas de comissão deste imóvel</Link>}</div>;
}
