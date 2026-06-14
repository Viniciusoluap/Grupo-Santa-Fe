"use client";

import { useState } from "react";
import { salvarConfiguracao } from "@/lib/actions/configuracoes";

interface Field {
  label: string;
  chave: string;
  placeholder: string;
  type: string;
}

interface Section {
  title: string;
  grupo: string;
  fields: Field[];
}

interface Props {
  sections: Section[];
  valoresSalvos: Record<string, string>;
}

export function ConfiguracoesClient({ sections, valoresSalvos }: Props) {
  const [values, setValues] = useState<Record<string, string>>(valoresSalvos);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const entries = Object.entries(values);
      await Promise.all(entries.map(([chave, valor]) => salvarConfiguracao(chave, valor)));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{section.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map((f) => (
              <div key={f.chave}>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={values[f.chave] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.chave]: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-2 items-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar Configurações"}
        </button>
        {saved && (
          <span className="text-xs text-green-600 font-medium">Configurações salvas com sucesso.</span>
        )}
      </div>
    </>
  );
}
