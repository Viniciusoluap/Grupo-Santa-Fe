"use client";
// Paridade 17/11 (bloco 2) — Prospecta 93edc7c (`compat/salvamento.tsx`, `useSalvamento`): o formulário grava sozinho
// 700 ms depois da última alteração; a fila espera a resposta do servidor antes de gravar a edição seguinte; o aviso
// some só depois da confirmação; uma falha conserva a edição e oferece nova tentativa.
// Diferença de stack: no Santa Fé as abas visitadas continuam montadas (escondidas), então não há o provedor que a
// Prospecta usa para manter os formulários pendentes; aqui o próprio gancho avisa ao sair da página com alteração
// pendente e, se o componente for desmontado no meio, dispara a gravação na hora.
// Correção da revisão do PR #263 (19/11): `{ semRegistro: true }` = o formulário abriu com os padrões, sem nada gravado.
// Nesse caso `salvo` fica falso até a primeira gravação; o botão (`salvar`) força essa gravação; o salvamento automático
// e a gravação ao desmontar continuam só depois de uma alteração (abrir a aba não grava nada).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { salvarFila, type FilaSalvamento } from "@/lib/incorporacao/fila-salvamento";

export const ESPERA_AUTOSALVAMENTO_MS = 700;

export interface OpcoesSalvamento {
  /** Não há registro gravado no banco: o conteúdo inicial são só os padrões do formulário. */
  semRegistro?: boolean;
}

export function useSalvamento<T>(dados: T | null, gravar: (dados: T, anterior: T) => Promise<unknown>, opcoes: OpcoesSalvamento = {}) {
  const json = dados === null ? null : JSON.stringify(dados);
  const [gravado, setGravado] = useState(json);
  const [registrado, setRegistrado] = useState(!opcoes.semRegistro);
  const [pending, setPending] = useState(false);
  const [falha, setFalha] = useState<{ json: string; mensagem: string } | null>(null);
  const fila = useRef<FilaSalvamento<T>>({ atual: json, gravado: json, gravar, envio: null, registrado: !opcoes.semRegistro });

  useLayoutEffect(() => {
    const estado = fila.current;
    estado.atual = json;
    estado.gravar = gravar;
    if (estado.gravado === null && json !== null) {
      estado.gravado = json;
      setGravado(json);
    }
  }, [json, gravar]);

  const enviar = useCallback((forcar: boolean) => salvarFila(
    fila.current,
    (snapshot) => { setGravado(snapshot); setRegistrado(true); },
    (snapshot, erro) => setFalha({ json: snapshot, mensagem: erro instanceof Error ? erro.message : "Falha ao salvar." }),
    () => { setPending(true); setFalha(null); },
    () => setPending(false),
    forcar,
  ), []);
  // Botão "Salvar": grava na hora; sem registro no banco, grava mesmo sem alteração.
  const salvar = useCallback(() => enviar(true), [enviar]);
  const salvarAlteracao = useCallback(() => enviar(false), [enviar]);

  const alterado = json !== null && gravado !== null && json !== gravado;
  const erro = (alterado || !registrado) && falha?.json === json ? falha.mensagem : null;
  useEffect(() => {
    if (!alterado || pending || erro) return;
    const timer = window.setTimeout(() => { void salvarAlteracao(); }, ESPERA_AUTOSALVAMENTO_MS);
    return () => window.clearTimeout(timer);
  }, [alterado, pending, erro, json, salvarAlteracao]);

  // Sair da página com alteração ainda não confirmada pelo servidor: o navegador pergunta antes.
  useEffect(() => {
    if (!alterado && !pending) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado, pending]);

  // Desmontado com alteração pendente (ex.: navegação interna): grava na hora em vez de perder a edição.
  useEffect(() => () => { void salvarFila(fila.current, () => undefined, () => undefined, () => undefined, () => undefined); }, []);

  return { salvar, alterado, pending, erro, registrado, salvo: registrado && !alterado && !pending };
}
