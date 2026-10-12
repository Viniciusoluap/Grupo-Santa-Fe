import { redirect } from "next/navigation";

// Rotas antigas levam ao CRM; a demanda precisa nascer no cadastro do cliente.
export default function CriacaoViaCRMPage() {
  redirect("/admin/leads");
}
