// Preload exclusivo do QA: impede que código servidor envie dados ao ambiente real.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
if (process.env.AIOX_TEST_DATABASE !== "1") throw new Error("Preload de rede somente para QA isolado.");
function validar(input, options) {
  const valor = typeof input === "string" || input instanceof URL ? new URL(input) : input;
  const host = valor?.hostname ?? valor?.host ?? options?.hostname ?? options?.host;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(host).split(":5500")[0])) throw new Error("QA bloqueou requisição externa ao ambiente local.");
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, options = {}) => {
  validar(input instanceof Request ? input.url : input);
  // Um redirect jamais pode levar cookies ou corpo para outro domínio.
  return fetchOriginal(input, { ...options, redirect: "error" });
};
for (const modulo of [http, https]) {
  const requestOriginal = modulo.request;
  modulo.request = function (input, ...args) { validar(input, args[0]); return requestOriginal.call(this, input, ...args); };
  modulo.get = function (input, ...args) { const req = modulo.request(input, ...args); req.end(); return req; };
}
syncBuiltinESMExports();
