"use client";

import { useState } from "react";
import { maskPhone } from "@/lib/utils";

interface Props {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function PhoneInput({ name, defaultValue = "", placeholder = "(62) 9 9999-9999", className = "", required }: Props) {
  const [value, setValue] = useState(() => (defaultValue ? maskPhone(defaultValue) : ""));

  return (
    <input
      type="tel"
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(maskPhone(e.target.value))}
      required={required}
      className={className}
    />
  );
}
