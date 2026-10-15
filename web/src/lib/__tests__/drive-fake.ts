// Mesmo Drive simulado do teste da Prospecta (.tmp-test/fake-drive.ts).
// Google Drive em memória: o suficiente da API v3 usada pelo sistema
// (busca por etiqueta/nome/pasta-mãe, criar, mover, renomear, lixeira, upload).
export interface ArquivoFake { id: string; name: string; mimeType: string; parents: string[]; appProperties?: Record<string, string>; trashed: boolean; ordem: number; dados?: Buffer }

export function criarDriveFake() {
  const arquivos = new Map<string, ArquivoFake>();
  const uploads = new Map<string, { name: string; parents: string[] }>();
  let seq = 0;
  const novo = (a: Omit<ArquivoFake, "id" | "ordem" | "trashed">) => {
    const id = `f${++seq}`;
    arquivos.set(id, { ...a, id, ordem: seq, trashed: false });
    return id;
  };

  function filtrar(q: string): ArquivoFake[] {
    let lista = [...arquivos.values()];
    if (q.includes("trashed = false")) lista = lista.filter((a) => !a.trashed);
    const prop = /appProperties has \{ key='([^']+)' and value='((?:[^'\\]|\\.)*)' \}/.exec(q);
    if (prop) lista = lista.filter((a) => a.appProperties?.[prop[1]] === prop[2].replace(/\\(.)/g, "$1"));
    const nome = /name = '((?:[^'\\]|\\.)*)'/.exec(q);
    if (nome) lista = lista.filter((a) => a.name === nome[1].replace(/\\(.)/g, "$1"));
    const pai = /'((?:[^'\\]|\\.)*)' in parents/.exec(q);
    if (pai) lista = lista.filter((a) => a.parents.includes(pai[1]));
    if (q.includes("mimeType = 'application/vnd.google-apps.folder'")) lista = lista.filter((a) => a.mimeType === "application/vnd.google-apps.folder");
    return lista.sort((x, y) => x.ordem - y.ordem);
  }

  async function fetchFake(entrada: string | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(String(entrada));
    const metodo = (init.method ?? "GET").toUpperCase();
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "at", refresh_token: "rt", scope: "https://www.googleapis.com/auth/drive.file openid email", expires_in: 3600 });
    if (url.hostname === "openidconnect.googleapis.com") return Response.json({ email: "dono@gmail.com" });
    if (url.pathname === "/upload/drive/v3/files" && metodo === "POST") {
      const meta = JSON.parse(String(init.body)) as { name: string; parents: string[] };
      const uid = `u${++seq}`;
      uploads.set(uid, meta);
      return new Response(null, { headers: { location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${uid}` } });
    }
    if (url.pathname === "/upload/drive/v3/files" && metodo === "PUT") {
      const meta = uploads.get(url.searchParams.get("upload_id")!)!;
      const id = novo({ name: meta.name, parents: meta.parents, mimeType: "application/octet-stream", dados: Buffer.from(init.body as Uint8Array) });
      return Response.json({ id });
    }
    if (url.pathname === "/drive/v3/files" && metodo === "GET") {
      return Response.json({ files: filtrar(url.searchParams.get("q") ?? "").map(({ dados: _d, ...a }) => a) });
    }
    if (url.pathname === "/drive/v3/files" && metodo === "POST") {
      const corpo = JSON.parse(String(init.body)) as Partial<ArquivoFake>;
      return Response.json({ id: novo({ name: corpo.name!, mimeType: corpo.mimeType!, parents: corpo.parents ?? ["root"], appProperties: corpo.appProperties }) });
    }
    const m = /^\/drive\/v3\/files\/([^/]+)(\/permissions)?$/.exec(url.pathname);
    if (m) {
      const a = arquivos.get(decodeURIComponent(m[1]));
      if (!a) return Response.json({ error: { code: 404, errors: [{ reason: "notFound" }] } }, { status: 404 });
      if (m[2]) return Response.json({ permissions: [{ type: "user" }] });
      if (metodo === "GET" && url.searchParams.get("alt") === "media") return new Response(new Uint8Array(a.dados ?? Buffer.alloc(0)));
      if (metodo === "GET") return Response.json({ ...a, dados: undefined, capabilities: { canAddChildren: true } });
      if (metodo === "DELETE") { arquivos.delete(a.id); return new Response(null, { status: 204 }); }
      if (metodo === "PATCH") {
        const corpo = JSON.parse(String(init.body ?? "{}")) as Partial<ArquivoFake>;
        if (corpo.name) a.name = corpo.name;
        if (corpo.trashed) a.trashed = true;
        if (corpo.appProperties) a.appProperties = { ...a.appProperties, ...corpo.appProperties };
        const rem = url.searchParams.get("removeParents")?.split(",") ?? [];
        a.parents = a.parents.filter((p) => !rem.includes(p));
        const add = url.searchParams.get("addParents");
        if (add) a.parents.push(add);
        return Response.json({ id: a.id });
      }
    }
    throw new Error(`Drive fake: chamada não simulada ${metodo} ${url}`);
  }

  /** Caminho legível de um arquivo, da raiz indicada até ele. */
  function caminho(id: string, raiz: string): string {
    const partes: string[] = [];
    let atual = arquivos.get(id);
    while (atual && atual.id !== raiz) {
      partes.unshift(atual.name);
      atual = arquivos.get(atual.parents[0]);
    }
    return partes.join("/");
  }

  return { arquivos, fetchFake, novo, caminho, filtrar };
}
