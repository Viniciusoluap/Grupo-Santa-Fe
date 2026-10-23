import { describe, expect, it } from "vitest";
import { STATUS_CONFIG } from "./types/financiamento";

describe("financiamento concluído", () => {
  it("interpreta o valor antigo liberado com o novo rótulo operacional", () => {
    expect(STATUS_CONFIG.liberado.label).toBe("Concluído");
    expect(STATUS_CONFIG.liberado.order).toBe(7);
  });
});
