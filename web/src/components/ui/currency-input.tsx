"use client";

import { useState } from "react";
import { dinheiroParaCampo, mascararDinheiro } from "@/lib/utils";

interface Props {
  name?: string;
  defaultValue?: number | null;
  value?: number | null;
  onValueChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

// Pedido de 15/10: valor sempre exibido como "R$ 1.000.000,00" — pontos de
// milhar já durante a digitação ("180000" -> "180.000") e duas casas ao sair do
// campo. Mesmo comportamento do CurrencyInput da Prospecta.
export function CurrencyInput({ name, defaultValue, value, onValueChange, placeholder = "0,00", className = "", required, id }: Props) {
  const inicial = value ?? defaultValue ?? 0;
  const [numero, setNumero] = useState<number>(inicial);
  const [texto, setTexto] = useState(() => dinheiroParaCampo(inicial));

  // Controlado: valor mudou por fora (ex.: cálculo automático) -> ressincroniza
  // durante a renderização (padrão do React para estado derivado de props).
  const [ultimoExterno, setUltimoExterno] = useState(value);
  if (value !== undefined && value !== ultimoExterno) {
    setUltimoExterno(value);
    const externo = value ?? 0;
    if (externo !== numero) {
      setNumero(externo);
      setTexto(dinheiroParaCampo(externo));
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          const m = mascararDinheiro(e.target.value);
          setTexto(m.texto);
          setNumero(m.numero);
          onValueChange?.(m.numero);
        }}
        onBlur={() => setTexto(dinheiroParaCampo(numero))}
        required={required}
        className={`w-full min-w-0 ${className}`}
        style={{ paddingInlineStart: "2.75rem" }}
      />
      {name && <input type="hidden" name={name} value={texto ? String(numero) : ""} />}
    </div>
  );
}
