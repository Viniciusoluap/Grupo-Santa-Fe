import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("PWA: cache não aceita HTML como JavaScript", () => {
  it("descarta resposta de fallback do cache e busca o bundle válido", async () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const cache = { match: vi.fn(async () => new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } })), delete: vi.fn(async () => true), put: vi.fn(async () => undefined) };
    const fetch = vi.fn(async () => new Response("console.log('ok')", { headers: { "content-type": "application/javascript" } }));
    runInNewContext(readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8"), {
      self: { location: { origin: "https://app.test" }, addEventListener: (k: string, fn: (e: unknown) => void) => listeners.set(k, fn) },
      caches: { open: async () => cache }, fetch, URL,
    });
    let result: Promise<Response> | undefined;
    listeners.get("fetch")!({ request: new Request("https://app.test/_next/static/app.js"), respondWith: (p: Promise<Response>) => { result = p; } });
    expect(await (await result!).text()).toContain("console.log");
    expect(cache.delete).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
