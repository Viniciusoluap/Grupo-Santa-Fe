"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { enviarFormComProgresso } from "@/lib/envio-progresso";
import { enviarImovelComFotos } from "@/lib/envio-fotos-imovel";

/**
 * Formulário que envia arquivos com progresso real (pedido de 18/10, item 4):
 * a barra fixa mostra "Enviando foto 2 de 4 — 65%". `campoFotos` é o campo
 * oculto com a lista JSON de fotos (data URLs novas contam no progresso).
 */
export function FormComEnvio({ acao, destino, campoFotos, item = "foto", className, children }: {
  acao: string;
  destino: string;
  campoFotos?: string;
  item?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    const dados = new FormData(e.currentTarget);
    let tamanhos: number[] = [];
    if (campoFotos) {
      try {
        const lista = JSON.parse(String(dados.get(campoFotos) ?? "[]"));
        if (Array.isArray(lista)) tamanhos = lista.filter((f): f is string => typeof f === "string" && f.startsWith("data:")).map((f) => f.length);
      } catch {
        tamanhos = [];
      }
    }
    setErro(null);
    setEnviando(true);
    try {
      if (campoFotos && acao === "/api/imoveis/salvar") await enviarImovelComFotos(dados, campoFotos);
      else await enviarFormComProgresso(acao, dados, { item, tamanhos });
      router.push(destino);
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao salvar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className={className} aria-busy={enviando}>
      {children}
      {erro && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    </form>
  );
}
