"use client";

import { useState } from "react";
import { INTERACTION_CONFIG, InteractionType } from "@/lib/types/crm";
import { CheckCircle2 } from "lucide-react";

export function AddInteractionForm({ leadId }: { leadId: string }) {
  const [type, setType] = useState<InteractionType>("nota");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaved(true);
    setDescription("");
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(Object.entries(INTERACTION_CONFIG) as [InteractionType, typeof INTERACTION_CONFIG[InteractionType]][]).map(([t, cfg]) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex flex-col items-center gap-1 py-2 px-1 text-[10px] font-bold border transition-all ${type === t ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
          >
            <span className="text-base">{cfg.icon}</span>
            {cfg.label}
          </button>
        ))}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Descreva a interação..."
        className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
        required
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors">
          Registrar
        </button>
        {saved && (
          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 size={13} /> Interação registrada!
          </div>
        )}
      </div>
    </form>
  );
}
