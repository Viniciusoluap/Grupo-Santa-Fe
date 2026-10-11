import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

if (process.env.AIOX_TEST_DATABASE !== "1" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Somente ambiente isolado.");
const runtime = process.env.AIOX_TEST_RUNTIME_DIR;
if (!runtime) throw new Error("Informe runtime de testes com playwright e @sparticuz/chromium.");
const require = createRequire(`${runtime}/package.json`);
const { chromium } = require("playwright");
const headlessModule = require("@sparticuz/chromium");
const headless = headlessModule.default ?? headlessModule;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "5500"], { env: process.env, stdio: "inherit" });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch("http://127.0.0.1:5500/login", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* aguardar inicialização */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Next start não ficou pronto");
  // Este QA não usa WebGL; renderização CPU evita depender de GPU/Vulkan.
  browser = await chromium.launch({ executablePath: process.env.AIOX_CHROMIUM_EXECUTABLE ?? await headless.executablePath(), args: ["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage", "--disable-gpu", "--disable-software-rasterizer"], headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-proto": "https" } });
  const erros = [];
  const externos = [];
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (["http:", "https:"].includes(u.protocol) && (!["localhost", "127.0.0.1"].includes(u.hostname) || u.port !== "5500")) {
      externos.push(u.origin); await route.abort(); return;
    }
    await route.continue();
  });
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.goto("http://localhost:5500/login");
  await page.locator('input[name="email"]').fill("admin@teste.local");
  await page.locator('input[name="password"]').fill("senha-controlada-local");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/admin/leads", { timeout: 30000 });
  mkdirSync("../docs/aiox/evidencias", { recursive: true });
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:5500/admin/leads");
    await page.locator('[aria-label="Pipeline de sete etapas"]').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('[aria-label="Pipeline de sete etapas"] > section').count(), 7);
    const largura = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, tela: window.innerWidth }));
    assert.ok(largura.pagina <= largura.tela + 1, `Overflow global em ${width}px`);
    await page.screenshot({ path: `../docs/aiox/evidencias/crm-${width}.png`, fullPage: true });
  }
  for (const rota of ["gestao", "relatorios", "feeds", "agregador", "contabilidade", "contratos"]) {
    const response = await page.request.get(`http://localhost:5500/admin/${rota}`, { maxRedirects: 0 });
    assert.equal(response.status(), 404, `Rota removida ${rota}`);
  }
  for (const rota of ["obras", "financiamentos", "regularizacao", "projetos"]) {
    await page.goto(`http://localhost:5500/admin/${rota}/novo`);
    assert.ok(page.url().endsWith("/admin/leads"), `Cadastro independente em ${rota}`);
    await page.goto(`http://localhost:5500/admin/${rota}`);
    assert.ok((await page.locator("body").innerText()).includes("Cliente atualizado de teste"), `Cliente ausente em ${rota}`);
  }
  if (process.env.AIOX_BROWSER_READONLY !== "1") {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("http://localhost:5500/admin/leads/novo");
  await page.locator('input[name="nome"]').fill("Cliente fluxo E2E");
  await page.locator('input[name="telefone"]').fill("999999999");
  for (const servico of ["Financiamento MCMV", "Obra e reforma", "Projeto de engenharia", "Regularização imobiliária"]) {
    await page.getByRole("button", { name: servico, exact: true }).click();
  }
  await page.getByRole("button", { name: "Cadastrar Lead", exact: true }).click();
  await page.waitForURL("**/admin/leads");
  const ficha = page.getByRole("link", { name: "Cliente fluxo E2E", exact: true });
  const fichaHref = await ficha.getAttribute("href");
  await ficha.click();
  await page.waitForURL((u) => u.pathname === fichaHref);
  await page.getByRole("heading", { name: "Cliente fluxo E2E", exact: true }).waitFor();
  await page.getByRole("link", { name: "Editar lead", exact: true }).click();
  await page.locator('input[name="nome"]').fill("Cliente fluxo E2E atualizado");
  await page.locator('select[name="etapaOperacional"]').selectOption("projetos_vistorias");
  await page.getByRole("button", { name: "Salvar Alterações", exact: true }).click();
  await page.waitForURL((u) => /^\/admin\/leads\/[^/]+$/.test(u.pathname));
  assert.ok((await page.locator("body").innerText()).includes("Cliente fluxo E2E atualizado"));
  for (const modulo of ["financiamentos", "obras", "regularizacao", "projetos"]) {
    await page.goto(`http://localhost:5500/admin/${modulo}`);
    assert.ok((await page.locator("body").innerText()).includes("Cliente fluxo E2E atualizado"), `Sincronização da edição em ${modulo}`);
  }
  console.log("PASS navegador: cadastro, edição, movimentação de etapa e sincronização dos quatro serviços");
  }
  assert.deepEqual(erros, [], "Erro de renderização no navegador");
  assert.deepEqual(externos, [], "Tentativa de requisição externa bloqueada");
  console.log("PASS navegador: login, sete etapas, seis larguras, rotas removidas, quatro módulos e redirects de criação");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
