// EPIC-020 Lote 4 (item 28) — preparo das fotos no navegador antes do envio.
// Mesmo arquivo em Prospecta/client/src/lib/comprimir-imagem.ts.
//
// Causas do "Enviando..." eterno corrigidas aqui e na tela:
// - foto do celular (até 12 MB, HEIC no iPhone) enviada crua em base64 estourava
//   o limite de corpo da função (4,5 MB na Vercel) → agora é reduzida para JPEG;
// - erros dentro do callback do FileReader escapavam do try/catch e o estado
//   nunca era liberado → agora tudo é Promise, com tempo-limite e finally.

export const LADO_MAXIMO = 1920;
const LIMITE_ENVIO = 2.5 * 1024 * 1024;
const TEMPO_LIMITE_MS = 90_000;

const EXTENSOES_IMAGEM = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i;

export function pareceImagem(file: File): boolean {
  return file.type.startsWith("image/") || (file.type === "" && EXTENSOES_IMAGEM.test(file.name));
}

async function decodificar(file: File): Promise<{ fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
    } catch {
      // Safari antigo: cai para <img>, que também decodifica HEIC no iOS.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decodificação"));
      el.src = url;
    });
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      `Não foi possível ler "${file.name}". Formato não suportado por este navegador (HEIC só abre no Safari): exporte como JPG e tente de novo.`
    );
  }
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), "image/jpeg", qualidade)
  );
}

export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(blob);
  });
}

/** Reduz para no máximo 1920 px no maior lado, JPEG, até ~2,5 MB. */
export async function comprimirImagem(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const { fonte, largura, altura, liberar } = await decodificar(file);
  try {
    let lado = LADO_MAXIMO;
    let qualidade = 0.82;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const escala = Math.min(1, lado / Math.max(largura, altura));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(largura * escala));
      canvas.height = Math.max(1, Math.round(altura * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Navegador sem suporte a canvas.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
      const blob = await paraBlob(canvas, qualidade);
      if (blob.size <= LIMITE_ENVIO) return { dataUrl: await blobParaDataUrl(blob), bytes: blob.size };
      lado = Math.round(lado * 0.8);
      qualidade = Math.max(0.6, qualidade - 0.08);
    }
    throw new Error(`"${file.name}" continua grande demais mesmo após a compressão.`);
  } finally {
    liberar();
  }
}

/** POST JSON com progresso de envio e tempo-limite: sempre resolve ou rejeita. */
export function enviarJsonComProgresso(
  url: string,
  corpo: unknown,
  aoProgredir?: (fracao: number) => void
): Promise<{ status: number; dados: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;
    xhr.timeout = TEMPO_LIMITE_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && aoProgredir) aoProgredir(e.loaded / e.total);
    };
    xhr.onload = () => {
      let dados: unknown = null;
      try {
        dados = JSON.parse(xhr.responseText);
      } catch {
        dados = null;
      }
      resolve({ status: xhr.status, dados });
    };
    xhr.onerror = () => reject(new Error("Falha de conexão durante o envio."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais e foi interrompido. Verifique a conexão e tente de novo."));
    xhr.send(JSON.stringify(corpo));
  });
}

export function mensagemErroEnvio(status: number, dados: unknown): string {
  const erro = (dados as { error?: unknown } | null)?.error;
  if (typeof erro === "string") return erro;
  if (status === 401 || status === 403) return "Sessão expirada ou sem permissão. Entre novamente.";
  if (status === 413) return "Foto grande demais para o servidor.";
  return `Erro ao enviar (código ${status}).`;
}
