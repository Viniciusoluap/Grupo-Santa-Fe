import { describe, expect, it } from "vitest";
import { filtrarDestinatariosValidos } from "../whatsapp/validacao";

const leadDoCorretorA = { id: "lead-1", nome: "Fulano", telefone: "62999990000", corretorId: "corretor-a" };
const leadDoCorretorB = { id: "lead-2", nome: "Beltrana", telefone: "62999990001", corretorId: "corretor-b" };
const leadSemCorretor = { id: "lead-3", nome: "Ciclana", telefone: "62999990002", corretorId: null };

describe("filtrarDestinatariosValidos", () => {
  it("aceita um lead que existe e pertence ao corretor logado", () => {
    const resultado = filtrarDestinatariosValidos(
      [{ leadId: "lead-1" }],
      [leadDoCorretorA],
      "corretor",
      "corretor-a",
    );
    expect(resultado).toEqual([{ telefone: "62999990000", nome: "Fulano", leadId: "lead-1" }]);
  });

  it("rejeita um lead que pertence a outro corretor", () => {
    const resultado = filtrarDestinatariosValidos(
      [{ leadId: "lead-2" }],
      [leadDoCorretorB],
      "corretor",
      "corretor-a",
    );
    expect(resultado).toEqual([]);
  });

  it("rejeita um leadId que não existe no banco (número arbitrário disfarçado de lead)", () => {
    const resultado = filtrarDestinatariosValidos(
      [{ leadId: "lead-inexistente" }],
      [],
      "corretor",
      "corretor-a",
    );
    expect(resultado).toEqual([]);
  });

  it("rejeita destinatário sem leadId", () => {
    const resultado = filtrarDestinatariosValidos([{}], [leadDoCorretorA], "corretor", "corretor-a");
    expect(resultado).toEqual([]);
  });

  it("admin/colaborador podem mensagear qualquer lead encontrado, mesmo sem corretorId", () => {
    const resultado = filtrarDestinatariosValidos(
      [{ leadId: "lead-2" }, { leadId: "lead-3" }],
      [leadDoCorretorB, leadSemCorretor],
      "admin",
      undefined,
    );
    expect(resultado).toEqual([
      { telefone: "62999990001", nome: "Beltrana", leadId: "lead-2" },
      { telefone: "62999990002", nome: "Ciclana", leadId: "lead-3" },
    ]);
  });

  it("usa telefone/nome do banco, nunca de um valor que o cliente poderia ter enviado", () => {
    // filtrarDestinatariosValidos nem aceita telefone/nome como entrada do
    // destinatario bruto - a tipagem em si ja impede a falha original.
    const resultado = filtrarDestinatariosValidos(
      [{ leadId: "lead-1" }],
      [leadDoCorretorA],
      "corretor",
      "corretor-a",
    );
    expect(resultado[0].telefone).toBe(leadDoCorretorA.telefone);
    expect(resultado[0].nome).toBe(leadDoCorretorA.nome);
  });
});
