const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc00:|fe80:)/i;

export function isSsrfUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    if (protocol !== "http:" && protocol !== "https:") return true;
    // Strip IPv6 brackets: [::1] → ::1
    const host = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
    return PRIVATE_IP.test(host);
  } catch {
    return true;
  }
}
