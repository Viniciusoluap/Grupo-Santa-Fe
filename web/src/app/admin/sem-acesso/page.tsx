import { redirect } from "next/navigation";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";

// Item 06: colaborador ainda sem nenhum módulo liberado.
export default async function SemAcessoPage() {
  const usuario = await usuarioAtual();
  const destino = destinoDoUsuario(usuario);
  if (destino !== "/admin/sem-acesso") redirect(destino);
  return (
    <div className="max-w-lg bg-white border border-gray-100 p-6 space-y-2">
      <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase">Nenhum módulo liberado</h1>
      <p className="text-sm text-gray-600">
        Seu acesso está ativo, mas o administrador ainda não liberou nenhum módulo para você.
        Peça a liberação em Configurações → Usuários.
      </p>
    </div>
  );
}
