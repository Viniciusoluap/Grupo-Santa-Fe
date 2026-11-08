"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarContrato } from "@/lib/actions/contratos";
import type { OpcoesContrato } from "@/lib/contratos/modelos";
import { FormularioModeloContrato } from "./formulario-modelo-contrato";

export function JuridicoNovoContrato({ opcoes, leadId }: { opcoes: OpcoesContrato; leadId?: string }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState("");
  const router = useRouter();

  return <>
    <FormularioModeloContrato opcoes={opcoes} leadId={leadId} pending={pending} salvar={(dados) => {
      setErro("");
      start(async () => {
        const resultado = await criarContrato(dados);
        if (resultado.ok) {
          router.replace(`/admin/juridico?contrato=${resultado.id}#contrato-${resultado.id}`);
          router.refresh();
        } else setErro(resultado.erro);
      });
    }} />
    {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
  </>;
}
