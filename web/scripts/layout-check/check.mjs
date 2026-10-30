// Correção 11 (lote 3): validação visual automática (Playwright/Chromium) do
// modal compartilhado e das telas de foco em 390x844 (iPhone), 820x1180 (iPad)
// e 1440x900. Gêmeo de `scripts/layout-check/check.mjs` na Prospecta.
// Uso (em web/): node scripts/layout-check/check.mjs [pasta-de-capturas]
// Limitação: Chromium não reproduz o motor do Safari; a regra específica de
// iOS para datas (globals.css, @supports -webkit-touch-callout) não é exercitada.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";

const aqui = path.dirname(new URL(import.meta.url).pathname);
const web = path.resolve(aqui, "..", "..");
const dist = path.join(aqui, "dist");
const saida = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), "layout-check-santafe"));
mkdirSync(saida, { recursive: true });
mkdirSync(dist, { recursive: true });

execFileSync("npx", ["tsx", path.join(aqui, "render.tsx"), dist], { cwd: web, stdio: "inherit" });

const require = createRequire(path.join(web, "package.json"));
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const origem = path.join(aqui, "harness.css");
const css = await postcss([tailwind({ base: web })]).process(readFileSync(origem, "utf8"), { from: origem });
writeFileSync(path.join(dist, "harness.css"), css.css);

let playwright;
for (const c of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { playwright = require(c); break; } catch { /* tenta o próximo */ }
}
if (!playwright) throw new Error("Playwright não encontrado.");

const tipos = { ".html": "text/html", ".css": "text/css" };
const servidor = createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(dist) || !existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader("content-type", tipos[path.extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
}).listen(0);
const porta = servidor.address().port;

const VIEWPORTS = [[390, 844], [820, 1180], [1440, 900]];
const CASOS = ["editar", "novo", "filtros"];
const falhas = [];
const browser = await playwright.chromium.launch();
for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: "pt-BR", deviceScaleFactor: 1, isMobile: w < 1024, hasTouch: w < 1024 });
  for (const caso of CASOS) {
    await page.goto(`http://localhost:${porta}/${caso}.html`);
    const r = await page.evaluate(() => {
      const erros = [];
      const vw = window.innerWidth, vh = window.innerHeight;
      if (document.documentElement.scrollWidth > vw + 1) erros.push(`página com rolagem horizontal (${document.documentElement.scrollWidth} > ${vw})`);
      const painel = document.querySelector("[data-slot=modal]");
      const cont = painel ?? document.querySelector("[data-teste=filtros]");
      const cr = cont.getBoundingClientRect();
      if (cr.left < -0.5 || cr.right > vw + 0.5) erros.push(`contêiner fora da tela (${Math.round(cr.left)}..${Math.round(cr.right)} de ${vw})`);
      if (painel && cr.height > vh + 0.5) erros.push(`modal mais alto que a tela (${Math.round(cr.height)} > ${vh})`);
      if (painel && getComputedStyle(painel).overflowY !== "auto") erros.push("modal sem rolagem interna");
      if (painel && getComputedStyle(painel.parentElement).position !== "fixed") erros.push("fundo do modal não é fixo");
      for (const el of cont.querySelectorAll("input:not([type=hidden]), select, textarea, button")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0) continue;
        if (b.left < cr.left - 0.5 || b.right > cr.right + 0.5) erros.push(`${el.tagName.toLowerCase()}[${el.type ?? ""}] sai do contêiner (${Math.round(b.left)}..${Math.round(b.right)} vs ${Math.round(cr.left)}..${Math.round(cr.right)})`);
      }
      const tabela = document.querySelector("[data-teste=rolagem-tabela]");
      if (tabela && tabela.getBoundingClientRect().right > vw + 0.5) erros.push("tabela empurra a página (sem rolagem própria)");
      const numeros = [...document.querySelectorAll("input[inputmode=decimal]")].map(i => i.value);
      return { erros, numeros };
    });
    if (caso === "editar" && !r.numeros.includes("1.234.567,89")) r.erros.push(`valor fora do padrão: ${r.numeros.join(" | ")}`);
    if (caso === "novo" && !(r.numeros.includes("98.765,43") && r.numeros.includes("6,00"))) r.erros.push(`valor/percentual fora do padrão: ${r.numeros.join(" | ")}`);
    await page.screenshot({ path: path.join(saida, `${caso}-${w}x${h}.png`), fullPage: true });
    console.log(`${r.erros.length ? "FALHA" : "OK"} ${caso} ${w}x${h}${r.erros.length ? " — " + r.erros.join("; ") : ""}`);
    if (r.erros.length) falhas.push(`${caso} ${w}x${h}`);
  }
  await page.close();
}
await browser.close();
servidor.close();
console.log(`Capturas em ${saida}`);
if (falhas.length) { console.error(`Falhas: ${falhas.join(", ")}`); process.exit(1); }
