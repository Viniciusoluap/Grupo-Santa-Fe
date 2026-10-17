// Pedido de 18/10 (item 7): o campo de localização aceita qualquer forma de
// marcar o ponto — coordenadas decimais (vírgula ou ponto), graus/minutos/
// segundos, graus e minutos decimais, links do Google Maps, Waze, Apple Maps,
// OpenStreetMap, "geo:" e Plus Code. Links curtos (maps.app.goo.gl, goo.gl/maps)
// não trazem as coordenadas: o servidor segue o redirecionamento.
// Mesmo arquivo em Prospecta/shared/geo/localizacao.ts.

export interface Coordenadas {
  lat: number;
  lng: number;
}

export type ResultadoLocalizacao =
  | { ok: true; lat: number; lng: number; formato: string }
  | { ok: false; linkCurto: string }
  | { ok: false; erro: string };

export const EXEMPLOS_LOCALIZACAO = [
  "-5.36861, -49.11722",
  "-5,36861; -49,11722",
  "5°22'07\"S 49°07'02\"W",
  "5°22.117'S 49°07.033'W",
  "Link do Google Maps, Waze, Apple Maps ou OpenStreetMap",
  "Plus Code completo: 686GJVJM+H4",
];

export const MENSAGEM_LOCALIZACAO_INVALIDA =
  "Não reconhecemos a localização. Exemplos aceitos: " + EXEMPLOS_LOCALIZACAO.join(" · ");

const HOSTS_LINK_CURTO = /^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/i;

function valida(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const numero = (texto: string) => Number(texto.replace(",", "."));

function decodificarTudo(texto: string): string {
  let atual = texto;
  for (let i = 0; i < 3; i++) {
    try {
      const prox = decodeURIComponent(atual.replace(/\+/g, " "));
      if (prox === atual) break;
      atual = prox;
    } catch {
      break;
    }
  }
  return atual;
}

// ---------- Plus Code (Open Location Code) ----------
const OLC = "23456789CFGHJMPQRVWX";
const PLUS_CODE_COMPLETO = new RegExp(`^[${OLC}]{8}\\+[${OLC}]{2,}$|^[${OLC}]{2,6}0+\\+$`, "i");
const PLUS_CODE_CURTO = new RegExp(`^[${OLC}]{4,6}\\+[${OLC}]{2,}`, "i");

export function decodificarPlusCode(codigo: string): Coordenadas | null {
  const limpo = codigo.trim().toUpperCase();
  if (!PLUS_CODE_COMPLETO.test(limpo)) return null;
  const digitos = limpo.replace("+", "").replace(/0+$/, "");
  let lat = -90;
  let lng = -180;
  let resolucao = 20;
  let resLat = 20;
  let resLng = 20;
  for (let i = 0; i < Math.min(10, digitos.length); i += 2) {
    lat += OLC.indexOf(digitos[i]) * resolucao;
    lng += OLC.indexOf(digitos[i + 1] ?? "2") * resolucao;
    resLat = resolucao;
    resLng = resolucao;
    resolucao /= 20;
  }
  for (let i = 10; i < digitos.length; i++) {
    resLat /= 5;
    resLng /= 4;
    const v = OLC.indexOf(digitos[i]);
    lat += Math.floor(v / 4) * resLat;
    lng += (v % 4) * resLng;
  }
  return valida(lat + resLat / 2, lng + resLng / 2);
}

// ---------- Geohash (links "waze.com/ul/h...") ----------
const GEOHASH = "0123456789bcdefghjkmnpqrstuvwxyz";

export function decodificarGeohash(hash: string): Coordenadas | null {
  if (!/^[0-9b-hjkmnp-z]{4,12}$/.test(hash)) return null;
  let par = true;
  const lat = [-90, 90];
  const lng = [-180, 180];
  for (const c of hash) {
    const v = GEOHASH.indexOf(c);
    for (let bit = 4; bit >= 0; bit--) {
      const alvo = par ? lng : lat;
      const meio = (alvo[0] + alvo[1]) / 2;
      if ((v >> bit) & 1) alvo[0] = meio;
      else alvo[1] = meio;
      par = !par;
    }
  }
  return valida((lat[0] + lat[1]) / 2, (lng[0] + lng[1]) / 2);
}

// ---------- Links ----------
const DEC = "(-?\\d{1,3}(?:\\.\\d+)?)";

function deLink(url: string): Coordenadas | null {
  const t = decodificarTudo(url);
  // OpenStreetMap: o marcador (mlat/mlon) é o ponto exato; "#map=" é só o centro da tela.
  const mlat = t.match(new RegExp(`[?&]mlat=${DEC}`));
  const mlon = t.match(new RegExp(`[?&]mlon=${DEC}`));
  if (mlat && mlon) {
    const c = valida(Number(mlat[1]), Number(mlon[1]));
    if (c) return c;
  }
  const padroes: RegExp[] = [
    new RegExp(`!3d${DEC}!4d${DEC}`), // Google: ponto exato do lugar
    new RegExp(`@${DEC},\\s*${DEC}`), // Google: centro do mapa
    new RegExp(`[?&#](?:q|query|ll|sll|destination|daddr|center|coordinate|latlng|to=ll\\.)=?${DEC}\\s*,\\s*${DEC}`, "i"),
    new RegExp(`ll\\.${DEC},${DEC}`), // Waze live-map
    new RegExp(`/maps/(?:place|search|dir)/${DEC},\\s*${DEC}`),
    new RegExp(`#map=\\d+(?:\\.\\d+)?/${DEC}/${DEC}`), // OpenStreetMap
    new RegExp(`geo:${DEC},${DEC}`),
  ];
  for (const p of padroes) {
    const m = t.match(p);
    if (m) {
      const c = valida(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  const geohash = t.match(/waze\.com\/ul\/h([0-9b-hjkmnp-z]{4,12})/);
  if (geohash) return decodificarGeohash(geohash[1]);
  return null;
}

// ---------- Graus, minutos e segundos / graus e minutos decimais ----------
function parteEmGraus(parte: string): { valor: number; eixo: "lat" | "lng" | null } | null {
  const letra = parte.match(/[NSEWLO]/i)?.[0]?.toUpperCase() ?? null;
  const nums = (parte.match(/\d+(?:[.,]\d+)?/g) ?? []).map(numero);
  if (nums.length === 0 || nums.length > 3) return null;
  const [g, m = 0, s = 0] = nums;
  if (m >= 60 || s >= 60) return null;
  let valor = g + m / 60 + s / 3600;
  const negativo = /^\s*[NSEWLO]?\s*-/i.test(parte) || letra === "S" || letra === "W" || letra === "O";
  if (negativo) valor = -valor;
  const eixo = letra === "N" || letra === "S" ? "lat" : letra ? "lng" : null;
  return { valor, eixo };
}

function deGraus(texto: string): Coordenadas | null {
  const t = texto
    .replace(/[º˚]/g, "°")
    .replace(/[’′‘`´]/g, "'")
    .replace(/[”″“]|''/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!/[°'"]|[NSEWLO]\b|\b[NSEWLO]/i.test(t)) return null;
  let partes: string[] | null = null;
  // Letra depois do número: "5°22'07"S 49°07'02"W"
  const sufixo = t.match(/^(.*?[NS])\s*[,;]?\s*(.*?[EWLO])$/i) ?? t.match(/^(.*?[EWLO])\s*[,;]?\s*(.*?[NS])$/i);
  // Letra antes do número: "S 5°22'07" W 49°07'02""
  const prefixo = t.match(/^([NS].*?)\s*[,;]?\s*([EWLO].*)$/i) ?? t.match(/^([EWLO].*?)\s*[,;]?\s*([NS].*)$/i);
  if (sufixo) partes = [sufixo[1], sufixo[2]];
  else if (prefixo) partes = [prefixo[1], prefixo[2]];
  else {
    // Sem letras: a segunda coordenada começa no número do segundo "°".
    const primeiro = t.indexOf("°");
    const segundo = primeiro >= 0 ? t.indexOf("°", primeiro + 1) : -1;
    if (segundo < 0) return null;
    let inicio = segundo;
    while (inicio > 0 && /[\d.,-]/.test(t[inicio - 1])) inicio--;
    partes = [t.slice(0, inicio).replace(/[,;\s]+$/, ""), t.slice(inicio)];
  }
  const a = parteEmGraus(partes[0]);
  const b = parteEmGraus(partes[1]);
  if (!a || !b) return null;
  if (a.eixo === "lng" || b.eixo === "lat") return valida(b.valor, a.valor);
  return valida(a.valor, b.valor);
}

// ---------- Decimal ----------
function deDecimal(texto: string): Coordenadas | null {
  const t = texto.trim();
  if (/[a-z]/i.test(t.replace(/\b(lat|lng|lon|long|latitude|longitude)\b\s*[:=]?/gi, ""))) return null;
  const nums = t.match(/-?\d{1,3}(?:[.,]\d+)?/g);
  if (!nums || nums.length !== 2) return null;
  return valida(numero(nums[0]), numero(nums[1]));
}

/** Interpreta o que foi colado no campo de localização. */
export function interpretarLocalizacao(entrada: string): ResultadoLocalizacao {
  const texto = (entrada ?? "").trim();
  if (!texto) return { ok: false, erro: "Informe a localização." };

  const url = texto.match(/https?:\/\/\S+/i)?.[0];
  if (url) {
    const c = deLink(url);
    if (c) return { ok: true, ...c, formato: "link" };
    try {
      const { hostname, pathname } = new URL(url);
      if (HOSTS_LINK_CURTO.test(hostname) && (hostname !== "goo.gl" || pathname.startsWith("/maps")))
        return { ok: false, linkCurto: url };
    } catch {
      // URL malformada: segue para a mensagem de erro.
    }
    return { ok: false, erro: "Este link não traz as coordenadas. Abra o local no mapa e copie o link completo ou as coordenadas. " + MENSAGEM_LOCALIZACAO_INVALIDA };
  }

  if (/^geo:/i.test(texto)) {
    const c = deLink(texto);
    if (c) return { ok: true, ...c, formato: "geo" };
  }

  const plus = texto.split(/\s+/)[0];
  if (PLUS_CODE_COMPLETO.test(plus)) {
    const c = decodificarPlusCode(plus);
    if (c) return { ok: true, ...c, formato: "plus_code" };
  }
  if (PLUS_CODE_CURTO.test(plus))
    return { ok: false, erro: "Plus Code curto (com nome da cidade) precisa da referência: use o código completo, como 686GJVJM+H4, ou o link do mapa." };

  const decimal = deDecimal(texto);
  if (decimal) return { ok: true, ...decimal, formato: "decimal" };
  const graus = deGraus(texto);
  if (graus) return { ok: true, ...graus, formato: "graus" };
  return { ok: false, erro: MENSAGEM_LOCALIZACAO_INVALIDA };
}

/** Hosts que o servidor pode seguir ao resolver um link curto. */
export function hostDeMapaPermitido(hostname: string): boolean {
  return /^(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.|maps\.|consent\.)?google\.[a-z.]{2,6})$/i.test(hostname);
}
