interface BrandSvgOptions {
  width: number;
  height: number;
  compact?: boolean;
}

const WRENCH_PATH =
  "M509.4 98.6c7.6-7.6 20.3-5.7 24.1 4.3 6.8 17.7 10.5 37 10.5 57.1 0 88.4-71.6 160-160 160-17.5 0-34.4-2.8-50.2-8L146.9 498.9c-28.1 28.1-73.7 28.1-101.8 0s-28.1-73.7 0-101.8L232 210.2c-5.2-15.8-8-32.6-8-50.2 0-88.4 71.6-160 160-160 20.1 0 39.4 3.7 57.1 10.5 10 3.8 11.8 16.5 4.3 24.1l-88.7 88.7c-3 3-4.7 7.1-4.7 11.3l0 41.4c0 8.8 7.2 16 16 16l41.4 0c4.2 0 8.3-1.7 11.3-4.7l88.7-88.7z";

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// Build an SVG string for OpenGraph/Twitter card images at runtime.
// Compact mode renders the icon only (for favicons); full mode adds text.
export function createBrandSvg({
  width,
  height,
  compact = false,
}: BrandSvgOptions): string {
  const title = "SuperTools";
  const subtitle = "Privacy-first browser developer tools";
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);

  const pad = Math.round(width * 0.06);
  const iconSize = compact
    ? Math.round(width * 0.7)
    : Math.round(height * 0.52);
  const iconX = compact ? Math.round((width - iconSize) / 2) : pad;
  const iconY = Math.round((height - iconSize) / 2);
  const textX = iconX + iconSize + Math.round(width * 0.04);
  const titleY = Math.round(height * 0.48);
  const subtitleY = Math.round(height * 0.64);
  const iconRadius = Math.round(iconSize * 0.22);
  const wrenchScale = iconSize / 820;
  const wrenchX = iconX + Math.round(iconSize * 0.16);
  const wrenchY = iconY + Math.round(iconSize * 0.16);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" fill="#111111"/>
  <path d="${WRENCH_PATH}" transform="translate(${wrenchX} ${wrenchY}) scale(${wrenchScale})" fill="#FFFFFF"/>
  ${
    compact
      ? ""
      : `<text x="${textX}" y="${titleY}" fill="#111111" font-size="${Math.round(height * 0.16)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${safeTitle}</text>
  <text x="${textX}" y="${subtitleY}" fill="#111111" font-size="${Math.round(height * 0.055)}" font-family="Arial, Helvetica, sans-serif" font-weight="500">${safeSubtitle}</text>`
  }
</svg>`;
}

export function createBrandSvgDataUrl(options: BrandSvgOptions): string {
  const svg = createBrandSvg(options);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
