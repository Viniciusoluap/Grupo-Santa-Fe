import { redirect } from "next/navigation";

// Pedido de 18/10: o acompanhamento dos clientes do corretor passou para o Início
// do Portal do Corretor (igual à Prospecta). Endereço antigo mantido para links salvos.
export default function MeusClientesPage() {
  redirect("/corretor");
}
