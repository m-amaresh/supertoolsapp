export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface OKLCH {
  l: number; // 0–1
  c: number; // 0–~0.4
  h: number; // 0–360
}

export interface ColorResult {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  oklch: OKLCH;
  error: string | null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): RGB | null {
  const cleaned = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (cleaned.length === 3) {
    r = Number.parseInt(cleaned[0] + cleaned[0], 16);
    g = Number.parseInt(cleaned[1] + cleaned[1], 16);
    b = Number.parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6) {
    r = Number.parseInt(cleaned.slice(0, 2), 16);
    g = Number.parseInt(cleaned.slice(2, 4), 16);
    b = Number.parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

// Convert RGB (0–255 per channel) to HSL (h: 0–360, s/l: 0–100).
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) / 6;
    } else {
      h = ((rn - gn) / d + 4) / 6;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL (h: 0–360, s/l: 0–100) back to RGB (0–255 per channel).
export function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const hn = h / 360;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

// sRGB gamma transfer functions: linearize for math, delinearize for display.
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function delinearize(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// Convert sRGB to OKLCH via the OKLab intermediate.
// Pipeline: sRGB → linear RGB → XYZ → LMS (cube root) → OKLab → LCH polar.
export function rgbToOklch(r: number, g: number, b: number): OKLCH {
  const lr = linearize(r / 255);
  const lg = linearize(g / 255);
  const lb = linearize(b / 255);

  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;

  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bk * bk);
  let H = (Math.atan2(bk, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

// Reverse of rgbToOklch: OKLCH polar → OKLab → LMS → XYZ → linear RGB → sRGB.
// Out-of-gamut values are clamped to 0–255.
export function oklchToRgb(l: number, c: number, h: number): RGB {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const bk = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * bk;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bk;
  const s_ = l - 0.0894841775 * a - 1.291485548 * bk;

  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  const lr = +4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const lg = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const lb = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return {
    r: Math.round(Math.max(0, Math.min(1, delinearize(lr))) * 255),
    g: Math.round(Math.max(0, Math.min(1, delinearize(lg))) * 255),
    b: Math.round(Math.max(0, Math.min(1, delinearize(lb))) * 255),
  };
}

// Attempt to parse a color string in any supported format:
// hex (#rgb, #rrggbb), rgb(), hsl(), oklch(), or bare r,g,b.
// Returns all representations (hex, rgb, hsl, oklch) or an error.
export function parseColor(input: string): ColorResult {
  const trimmed = input.trim();
  const errorResult: ColorResult = {
    hex: "",
    rgb: { r: 0, g: 0, b: 0 },
    hsl: { h: 0, s: 0, l: 0 },
    oklch: { l: 0, c: 0, h: 0 },
    error: "Unrecognized color format",
  };

  if (!trimmed) {
    return { ...errorResult, error: null };
  }

  // Try HEX
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const rgb = hexToRgb(hexMatch[1]);
    if (rgb) {
      return {
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        rgb,
        hsl: rgbToHsl(rgb.r, rgb.g, rgb.b),
        oklch: rgbToOklch(rgb.r, rgb.g, rgb.b),
        error: null,
      };
    }
  }

  // Try rgb(r, g, b) or rgb(r g b)
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/,
  );
  if (rgbMatch) {
    const r = Number.parseInt(rgbMatch[1], 10);
    const g = Number.parseInt(rgbMatch[2], 10);
    const b = Number.parseInt(rgbMatch[3], 10);
    if (r <= 255 && g <= 255 && b <= 255) {
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        hsl: rgbToHsl(r, g, b),
        oklch: rgbToOklch(r, g, b),
        error: null,
      };
    }
  }

  // Try hsl(h, s%, l%)
  const hslMatch = trimmed.match(
    /^hsla?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})%?\s*[,\s]\s*(\d{1,3})%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/,
  );
  if (hslMatch) {
    const h = Number.parseInt(hslMatch[1], 10);
    const s = Number.parseInt(hslMatch[2], 10);
    const l = Number.parseInt(hslMatch[3], 10);
    if (h <= 360 && s <= 100 && l <= 100) {
      const rgb = hslToRgb(h, s, l);
      return {
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        rgb,
        hsl: { h, s, l },
        oklch: rgbToOklch(rgb.r, rgb.g, rgb.b),
        error: null,
      };
    }
  }

  // Try oklch(L C H) — L may be 0–1 or 0–100%, H may have a deg suffix,
  // and values may be space-separated or comma-separated (both are valid CSS).
  const oklchMatch = trimmed.match(
    /^oklch\(\s*([\d.]+)(%?)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:deg)?\s*\)$/,
  );
  if (oklchMatch) {
    let l = Number.parseFloat(oklchMatch[1]);
    const isPct = oklchMatch[2] === "%";
    const c = Number.parseFloat(oklchMatch[3]);
    const h = Number.parseFloat(oklchMatch[4]);
    if (isPct) l /= 100;
    // Chroma above 0.5 is outside sRGB gamut; clamp rather than reject so
    // wide-gamut inputs still produce a valid (clamped) output colour.
    if (l >= 0 && l <= 1 && c >= 0 && c <= 0.5 && h >= 0 && h <= 360) {
      const rgb = oklchToRgb(l, c, h);
      return {
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        rgb,
        hsl: rgbToHsl(rgb.r, rgb.g, rgb.b),
        oklch: { l, c, h },
        error: null,
      };
    }
  }

  // Try bare r,g,b
  const bareRgb = trimmed.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (bareRgb) {
    const r = Number.parseInt(bareRgb[1], 10);
    const g = Number.parseInt(bareRgb[2], 10);
    const b = Number.parseInt(bareRgb[3], 10);
    if (r <= 255 && g <= 255 && b <= 255) {
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        hsl: rgbToHsl(r, g, b),
        oklch: rgbToOklch(r, g, b),
        error: null,
      };
    }
  }

  return errorResult;
}

// Generate a palette of evenly spaced hues from a base color.
// For near-neutral colors (saturation < 5), uses a lightness ramp instead
// since hue rotation on grays produces visually identical swatches.
export function generatePalette(hex: string, count: number): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // When saturation is too low, hue rotation produces identical colors.
  // Generate a lightness ramp instead.
  if (hsl.s < 5) {
    const colors: string[] = [];
    const step = 100 / (count + 1);
    for (let i = 1; i <= count; i++) {
      const l = Math.round(step * i);
      const newRgb = hslToRgb(hsl.h, hsl.s, l);
      colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    }
    return colors;
  }

  const colors: string[] = [];
  const step = 360 / count;

  for (let i = 0; i < count; i++) {
    const h = (hsl.h + Math.round(step * i)) % 360;
    const newRgb = hslToRgb(h, hsl.s, hsl.l);
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors;
}
