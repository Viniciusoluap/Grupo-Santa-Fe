import { describe, expect, it } from "vitest";
import { planejarImportacaoClientesBpo } from "../bpo-importacao-crm";

describe("importação CRM para clientes BPO", () => {
  it("não duplica leads já importados e mantém o resumo idempotente", () => {
    const leads = [{ id: "l1", nome: "Ana" }, { id: "l2", nome: "Bia" }, { id: "l3", nome: "Caio" }];
    const primeira = planejarImportacaoClientesBpo(leads, [null, "l2"]);
    expect(primeira.faltantes.map((lead) => lead.id)).toEqual(["l1", "l3"]);
    expect(primeira).toMatchObject({ encontrados: 3, jaImportados: 1 });

    const segunda = planejarImportacaoClientesBpo(leads, ["l1", "l2", "l3"]);
    expect(segunda.faltantes).toEqual([]);
    expect(segunda).toMatchObject({ encontrados: 3, jaImportados: 3 });
  });
});
