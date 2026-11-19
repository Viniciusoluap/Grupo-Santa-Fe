import { redirect } from "next/navigation";

// Paridade 17/11 (EPIC-023 S-A da Prospecta): a tela "Corretores" foi unificada em "Usuários e acesso" (só admin).
// Favoritos e links antigos (/admin/corretores, /novo, /<id>, /<id>/editar) caem na lista filtrada em Corretor.
export default function CorretoresRedirecionaPage() {
  redirect("/admin/configuracoes?perfil=corretor");
}
