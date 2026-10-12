import { redirect } from "next/navigation";

// Rota antiga leva ao CRM; a demanda precisa nascer no cadastro do cliente.
export default function CriacaoViaCRMPage() {
  redirect("/admin/leads");
}
