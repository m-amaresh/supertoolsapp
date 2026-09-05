export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export interface QrRenderOptions {
  errorCorrection?: QrErrorCorrection;
  margin?: number;
  scale?: number;
}

export interface QrMatrix {
  modules: boolean[][];
  size: number;
  errorCorrection: QrErrorCorrection;
  byteLength: number;
}

const MAX_INPUT_BYTES = 2953;

// Lazy-load the qrcode module so it's only fetched when this tool is opened.
let qrcodeModulePromise: Promise<typeof import("qrcode")> | null = null;

async function getQrcodeModule() {
  if (!qrcodeModulePromise) {
    qrcodeModulePromise = import("qrcode").catch((err) => {
      qrcodeModulePromise = null;
      throw err;
    });
  }
  return qrcodeModulePromise;
}

function inputByteLength(input: string): number {
  return new TextEncoder().encode(input).byteLength;
}

// Generate a QR code as a 2D boolean matrix. The page renders this as native
// React <rect> elements, avoiding any HTML injection of library-generated SVG.
export async function generateQrMatrix(
  input: string,
  options: QrRenderOptions = {},
): Promise<QrMatrix> {
  if (!input) {
    throw new Error("Input is required");
  }

  const byteLength = inputByteLength(input);
  if (byteLength > MAX_INPUT_BYTES) {
    throw new Error(
      `Input is too large for a single QR code (${byteLength} bytes, max ${MAX_INPUT_BYTES})`,
    );
  }

  const errorCorrection = options.errorCorrection ?? "M";
  const qrcode = await getQrcodeModule();

  const data = qrcode.create(input, {
    errorCorrectionLevel: errorCorrection,
  });

  const size = data.modules.size;
  const flat = data.modules.data;
  const modules: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const rowModules: boolean[] = new Array(size);
    for (let col = 0; col < size; col++) {
      rowModules[col] = flat[row * size + col] === 1;
    }
    modules.push(rowModules);
  }

  return { modules, size, errorCorrection, byteLength };
}

// Render a QR matrix to a PNG data URL via the qrcode library's canvas path.
// Used only for the PNG download — on-screen preview uses native React rects.
export async function generateQrPngDataUrl(
  input: string,
  options: QrRenderOptions = {},
): Promise<string> {
  if (!input) {
    throw new Error("Input is required");
  }

  const byteLength = inputByteLength(input);
  if (byteLength > MAX_INPUT_BYTES) {
    throw new Error(
      `Input is too large for a single QR code (${byteLength} bytes, max ${MAX_INPUT_BYTES})`,
    );
  }

  const qrcode = await getQrcodeModule();
  return qrcode.toDataURL(input, {
    errorCorrectionLevel: options.errorCorrection ?? "M",
    margin: options.margin ?? 2,
    scale: options.scale ?? 8,
  });
}

// Build an SVG string from a matrix for the SVG download path. We construct
// it ourselves rather than trusting any external SVG generator.
export function matrixToSvg(
  matrix: QrMatrix,
  options: { margin?: number; moduleSize?: number } = {},
): string {
  const margin = options.margin ?? 2;
  const moduleSize = options.moduleSize ?? 8;
  const dimension = (matrix.size + margin * 2) * moduleSize;

  const rects: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.modules[row][col]) {
        const x = (col + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        rects.push(
          `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`,
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges">
<rect width="${dimension}" height="${dimension}" fill="#fff"/>
${rects.join("\n")}
</svg>`;
}

export const qrErrorCorrectionOptions: {
  value: QrErrorCorrection;
  label: string;
}[] = [
  { value: "L", label: "L · ~7% recovery" },
  { value: "M", label: "M · ~15% recovery (recommended)" },
  { value: "Q", label: "Q · ~25% recovery" },
  { value: "H", label: "H · ~30% recovery" },
];

export interface QrPreset {
  name: string;
  template: string;
  description: string;
}

export const qrPresets: QrPreset[] = [
  {
    name: "URL",
    template: "https://example.com",
    description: "Web link",
  },
  {
    name: "Wi-Fi",
    template: "WIFI:T:WPA;S:NetworkName;P:password;;",
    description: "Wi-Fi join string (most modern phones)",
  },
  {
    name: "Email",
    template: "mailto:hello@example.com?subject=Hi&body=Hello",
    description: "Pre-filled email compose",
  },
  {
    name: "SMS",
    template: "sms:+15551234567?body=Hello",
    description: "Pre-filled text message",
  },
  {
    name: "vCard",
    template:
      "BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nTEL:+15551234567\nEMAIL:jane@example.com\nEND:VCARD",
    description: "Contact card",
  },
];
