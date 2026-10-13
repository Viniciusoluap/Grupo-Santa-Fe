import { redirect } from "next/navigation";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";

// Item 02: cada perfil cai direto no primeiro módulo que pode usar.
export default async function AdminPage() {
  redirect(destinoDoUsuario(await usuarioAtual()));
}
