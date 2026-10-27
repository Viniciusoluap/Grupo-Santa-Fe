import { describe, expect, it } from "vitest";
import { projectChecklist, projectDocumentCanonicalName, reconcileProjectChecklist, validateProjectUpload, PROJECT_UPLOAD_LIMIT } from "../projeto-documentos";

describe("documentos de projetos", () => {
  it("gera itens dos tipos escolhidos e preserva itens manuais e históricos", () => {
    const items = projectChecklist(
      ["projeto_arquitetonico", "projeto_eletrico", "projeto_completo"],
      [{ id: "legacy-1", text: "Revisão final", done: true }],
      { projeto_arquitetonico: "Projeto Arquitetônico", projeto_eletrico: "Projeto Elétrico" },
    );
    expect(items.map(item => item.text)).toEqual(["Revisão final", "Projeto Arquitetônico", "Projeto Elétrico"]);
    expect(projectChecklist(["projeto_eletrico"], items, { projeto_eletrico: "Projeto Elétrico" })).toHaveLength(3);
    expect(projectChecklist(["projeto_eletrico"], [{ id: "documented-item", text: "Projeto Elétrico", done: true }], { projeto_eletrico: "Projeto Elétrico" })[0]).toMatchObject({ id: "documented-item", type: "projeto_eletrico", done: true });
  });

  it("aceita 300 MB e rejeita excedente, nome inseguro e PDF incorreto", () => {
    expect(() => validateProjectUpload("projeto.pdf", PROJECT_UPLOAD_LIMIT, "pdf")).not.toThrow();
    expect(() => validateProjectUpload("projeto.dwg", PROJECT_UPLOAD_LIMIT + 1, "editable")).toThrow();
    expect(() => validateProjectUpload("../arquivo.dwg", 10, "editable")).toThrow();
    expect(() => validateProjectUpload("projeto.dwg", 10, "pdf")).toThrow();
  });

  it("gera nome canônico versionado e preserva a extensão", () => {
    expect(projectDocumentCanonicalName({ projectName: "Casa São Luís", clientName: "João D'Ávila", itemName: "Projeto Elétrico", version: 2, originalName: "qualquer nome.DWG", mime: "application/octet-stream" }))
      .toBe("CASA_SAO_LUIS_JOAO_D_AVILA_PROJETO_ELETRICO_V02.dwg");
  });

  it("deriva o checklist somente dos documentos ativos", () => {
    const checks = reconcileProjectChecklist([{ id: "eletrico", text: "Elétrico", done: true }], [{ itemId: "eletrico", kind: "pdf" }]);
    expect(checks[0]).toMatchObject({ done: true, pdfDone: true, editableDone: false });
    expect(reconcileProjectChecklist(checks, [])[0]).toMatchObject({ done: false, pdfDone: false, editableDone: false });
  });
});
