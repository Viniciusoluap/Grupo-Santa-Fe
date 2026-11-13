// Paridade 13/11 (EPIC-017 da Prospecta): endereço do cliente no cadastro do lead.
// Migra para Avaliação, Obra e Regularização criadas pelo CRM.
const CAMPO = "w-full border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-600 placeholder:opacity-100 focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50";
const ROTULO = "block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1";

export function CamposEnderecoLead({ valores }: { valores?: { endereco?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null } }) {
  return (
    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_4.5rem] gap-4">
      <div>
        <label htmlFor="lead-endereco" className={ROTULO}>Endereço</label>
        <input id="lead-endereco" name="endereco" maxLength={300} defaultValue={valores?.endereco ?? ""} placeholder="Rua, número, complemento" className={CAMPO} />
      </div>
      <div>
        <label htmlFor="lead-bairro" className={ROTULO}>Bairro</label>
        <input id="lead-bairro" name="bairro" maxLength={120} defaultValue={valores?.bairro ?? ""} className={CAMPO} />
      </div>
      <div>
        <label htmlFor="lead-cidade" className={ROTULO}>Cidade</label>
        <input id="lead-cidade" name="cidade" maxLength={120} defaultValue={valores?.cidade ?? ""} placeholder="Canaã dos Carajás" className={CAMPO} />
      </div>
      <div>
        <label htmlFor="lead-uf" className={ROTULO}>UF</label>
        <input id="lead-uf" name="uf" maxLength={2} defaultValue={valores?.uf ?? ""} placeholder="PA" className={`${CAMPO} uppercase`} />
      </div>
    </div>
  );
}
