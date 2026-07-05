// Extrai latitude/longitude de um link do Google Maps (ou de um par "lat,lng"
// colado direto). Cobre os formatos mais comuns:
//   https://www.google.com/maps/@-6.5001,-49.8790,17z
//   https://www.google.com/maps/place/.../@-6.5,-49.87,15z/...
//   https://maps.google.com/?q=-6.5001,-49.8790
//   https://www.google.com/maps?q=-6.5,-49.87
//   https://www.google.com/maps/search/?api=1&query=-6.5,-49.87
//   "-6.5001, -49.8790"  (colado manualmente)
//   URLs encurtadas (maps.app.goo.gl / goo.gl/maps) NÃO contêm as coordenadas
//   e por isso não podem ser resolvidas aqui — retornamos null.

export interface LatLng {
  latitude: number;
  longitude: number;
}

function valida(lat: number, lng: number): LatLng | null {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function parseGoogleMapsLatLng(entrada: string): LatLng | null {
  if (!entrada) return null;
  const txt = entrada.trim();

  // 1. Padrão @lat,lng (formato de URL do mapa)
  const at = txt.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const r = valida(parseFloat(at[1]), parseFloat(at[2]));
    if (r) return r;
  }

  // 2. Parâmetros q= / query= / ll= com "lat,lng"
  const q = txt.match(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) {
    const r = valida(parseFloat(q[1]), parseFloat(q[2]));
    if (r) return r;
  }

  // 3. "!3dLAT!4dLNG" (aparece em algumas URLs de place)
  const bang = txt.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const r = valida(parseFloat(bang[1]), parseFloat(bang[2]));
    if (r) return r;
  }

  // 4. Par "lat, lng" colado manualmente (sem ser URL)
  if (!/https?:\/\//i.test(txt)) {
    const par = txt.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (par) {
      const r = valida(parseFloat(par[1]), parseFloat(par[2]));
      if (r) return r;
    }
  }

  return null;
}
