import { describe, expect, it } from "vitest";
import { assinarEstado, lerCredencialOAuth, origemDaRequisicao, urlAutorizacao, verificarEstado } from "@/lib/google-drive-oauth";

describe("Google Drive OAuth — funções puras (mesmas da Prospecta)", () => {
  it("state assinado volta com o mesmo usuário e expira em 10 min", () => {
    const s = assinarEstado("seg", "42", 1_000);
    expect(verificarEstado("seg", s, 2_000)).toBe("42");
    expect(verificarEstado("seg", s, 1_000 + 10 * 60_000 + 1)).toBeNull();
    expect(verificarEstado("outro", s, 2_000)).toBeNull();
    const [corpo] = s.split(".");
    expect(verificarEstado("seg", `${corpo}.adulterado`, 2_000)).toBeNull();
    expect(verificarEstado("seg", "lixo", 2_000)).toBeNull();
  });
  it("URL de autorização pede só drive.file, offline e consentimento", () => {
    const u = new URL(urlAutorizacao("id.apps.googleusercontent.com", "https://www.gruposantafee.com.br", "st"));
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file openid email");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("redirect_uri")).toBe("https://www.gruposantafee.com.br/api/google-drive/callback");
  });
  it("origem: https em produção, http no localhost, recusa host estranho", () => {
    expect(origemDaRequisicao("www.gruposantafee.com.br")).toBe("https://www.gruposantafee.com.br");
    expect(origemDaRequisicao("localhost:3000")).toBe("http://localhost:3000");
    expect(() => origemDaRequisicao("evil.com/x?")).toThrow();
  });
  it("lê só o cliente Aplicativo da Web", () => {
    expect(lerCredencialOAuth(JSON.stringify({ web: { client_id: "1-a.apps.googleusercontent.com", client_secret: "s" } }))).toEqual({ clientId: "1-a.apps.googleusercontent.com", clientSecret: "s", redirectUris: [] });
    expect(() => lerCredencialOAuth('{"type":"service_account"}')).toThrow(/conta de serviço/);
  });
});
