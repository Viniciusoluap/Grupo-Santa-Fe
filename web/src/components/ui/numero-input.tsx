"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentProps, type CSSProperties, type FocusEvent } from "react";
import { aplicarEdicao, formatarNumero, type OpcoesNumero } from "@/lib/numero-mascara";
import { cn } from "@/lib/utils";

// Correção 21 (AD-01) — componente numérico único. Gêmeo de
// `client/src/components/ui/numero-input.tsx` na Prospecta.
//
// Máscara pt-BR durante a digitação ("1000000" -> "1.000.000"; casas
// completadas ao sair do campo: "1.000.000,00"), cursor estável (inclusive
// iPhone) e colagem de "1.234,56" / "1234.56" / "R$ 1.234,56". A lógica pura
// fica em `src/lib/numero-mascara.ts` (testada em `src/lib/__tests__/numero-mascara.test.ts`).
//
// O número entregue em `onChange` é exatamente o digitado (sem escala, sem
// arredondar o valor recebido de fora): a formatação é só de exibição.
// `CurrencyInput`, `PercentInput`, `NumeroBRField` e `AreaInput` são
// wrappers deste componente.

type PropsNativas = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "min" | "max" | "name" | "ref" | "prefix"
>;

export interface NumeroInputProps extends PropsNativas {
  /** Valor controlado (null = vazio). Quando informado, o campo reflete este número. */
  value?: number | null;
  /** Valor inicial no modo não controlado. */
  defaultValue?: number | null;
  /** Chamado a cada edição que muda o número (null = campo vazio). */
  onChange?: (valor: number | null) => void;
  /** Chamado ao sair do campo com o número final. */
  onBlurValue?: (valor: number | null) => void;
  /** Casas decimais (padrão 2). */
  casas?: number;
  /** Casas sempre exibidas ao sair do campo (padrão = `casas`). */
  casasMinimas?: number;
  /** Texto fixo à esquerda (ex.: "R$"). */
  prefixo?: string;
  /** Texto fixo à direita (ex.: "%", "m²"). */
  sufixo?: string;
  /** Mínimo/máximo aplicados ao sair do campo. `min >= 0` também bloqueia o "-". */
  min?: number;
  max?: number;
  /** Permite negativos (padrão: true, salvo `min >= 0`). */
  negativo?: boolean;
  /** Na colagem, ponto sozinho é decimal ("2.345" = 2,345) — percentuais. */
  pontoDecimal?: boolean;
  /** Zero é exibido como campo vazio (placeholder) — padrão dos campos antigos. */
  vazioQuandoZero?: boolean;
  /** Nome do `<input type="hidden">` com o número cru, para formulários lidos via `FormData`. */
  name?: string;
  /** Valor do input oculto quando o campo está vazio (padrão ""). */
  valorOcultoVazio?: string;
  /** Classe do contêiner quando há prefixo/sufixo. */
  classeContainer?: string;
}

const iguais = (a: number | null, b: number | null, zeroVazio: boolean) => {
  const na = zeroVazio && a === 0 ? null : a;
  const nb = zeroVazio && b === 0 ? null : b;
  return na === nb || (na != null && nb != null && Object.is(na, nb));
};

export function NumeroInput({
  value,
  defaultValue,
  onChange,
  onBlurValue,
  casas = 2,
  casasMinimas,
  prefixo,
  sufixo,
  min,
  max,
  negativo,
  pontoDecimal,
  vazioQuandoZero = false,
  name,
  valorOcultoVazio = "",
  classeContainer,
  className,
  style,
  placeholder,
  onFocus,
  onBlur,
  ...resto
}: NumeroInputProps) {
  const controlado = value !== undefined;
  const opcoes: OpcoesNumero = {
    casas,
    casasMinimas,
    pontoDecimal,
    negativo: negativo ?? !(min != null && min >= 0),
  };
  const normalizar = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v);
  const exibir = (v: number | null) => (v == null || (vazioQuandoZero && v === 0) ? "" : formatarNumero(v, opcoes));

  const inicial = normalizar(controlado ? value : defaultValue);
  const [numero, setNumero] = useState<number | null>(inicial);
  const [texto, setTexto] = useState<string>(() => exibir(inicial));
  const [versao, setVersao] = useState(0);
  const numeroRef = useRef<number | null>(inicial);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPendente = useRef<number | null>(null);
  const focado = useRef(false);
  const externoPendente = useRef(false);

  // Reposiciona o cursor depois que o React grava o texto mascarado.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (cursorPendente.current == null || !el) return;
    if (typeof document !== "undefined" && document.activeElement === el) {
      el.setSelectionRange(cursorPendente.current, cursorPendente.current);
    }
    cursorPendente.current = null;
  }, [texto, versao]);

  // Valor externo mudou (dados carregados, cálculo automático): reformata —
  // mas nunca no meio da digitação; nesse caso aplica ao sair do campo.
  const externo = controlado ? normalizar(value) : undefined;
  useEffect(() => {
    if (externo === undefined) return;
    if (iguais(externo, numeroRef.current, vazioQuandoZero)) return;
    if (focado.current) {
      externoPendente.current = true;
      return;
    }
    numeroRef.current = externo;
    setNumero(externo);
    setTexto(exibir(externo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externo]);

  function definirNumero(n: number | null) {
    if (iguais(n, numeroRef.current, false)) return;
    numeroRef.current = n;
    setNumero(n);
    onChange?.(n);
  }

  function aoMudar(e: ChangeEvent<HTMLInputElement>) {
    const r = aplicarEdicao(texto, e.target.value, e.target.selectionStart, opcoes);
    cursorPendente.current = r.cursor;
    setTexto(r.texto);
    setVersao(v => v + 1);
    externoPendente.current = false;
    definirNumero(r.numero);
  }

  function aoSair(e: FocusEvent<HTMLInputElement>) {
    focado.current = false;
    let final = numeroRef.current;
    if (externoPendente.current && externo !== undefined) {
      externoPendente.current = false;
      final = externo;
      numeroRef.current = externo;
      setNumero(externo);
    }
    if (final != null && min != null && final < min) final = min;
    if (final != null && max != null && final > max) final = max;
    definirNumero(final);
    setTexto(exibir(final));
    onBlurValue?.(final);
    onBlur?.(e);
  }

  const estilo: CSSProperties = {
    ...(prefixo ? { paddingInlineStart: `calc(1.5rem + ${prefixo.length}ch)` } : {}),
    ...(sufixo ? { paddingInlineEnd: `calc(1.25rem + ${sufixo.length}ch)` } : {}),
    ...style,
  };

  const propsCampo = {
    ...resto,
    ref: inputRef,
    type: "text",
    inputMode: "decimal" as const,
    autoComplete: resto.autoComplete ?? "off",
    value: texto,
    onChange: aoMudar,
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      focado.current = true;
      onFocus?.(e);
    },
    onBlur: aoSair,
    placeholder: placeholder ?? (casas > 0 ? `0,${"0".repeat(Math.min(casas, 2))}` : "0"),
    style: estilo,
  };

  const campo = <input {...propsCampo} className={className} />;

  const oculto = name ? (
    <input type="hidden" name={name} value={numero == null || texto === "" ? valorOcultoVazio : String(numero)} />
  ) : null;

  if (!prefixo && !sufixo) {
    return (
      <>
        {campo}
        {oculto}
      </>
    );
  }

  return (
    <div className={cn("relative", classeContainer)}>
      {prefixo && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          {prefixo}
        </span>
      )}
      {campo}
      {sufixo && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          {sufixo}
        </span>
      )}
      {oculto}
    </div>
  );
}
