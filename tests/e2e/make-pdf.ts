/**
 * Builds a real PDF in memory, for the tests that drive the actual qpdf engine.
 *
 * Generating one beats checking a binary into the repo: the page count and the
 * text on each page are visible in the calling test, so an assertion about
 * either can be read without opening a file in a viewer.
 *
 * Extracted from `pdf-merge.test.ts` when the encryption suite needed the same
 * builder. A second hand-written copy of an xref table is a second chance to
 * get the byte offsets subtly wrong, and a PDF that is merely *almost* valid
 * turns an engine failure into a fixture failure — which is the confusing kind.
 *
 * Unrelated to `fixtures.ts` next door, despite both once carrying the word:
 * that one holds the text typed into each tool's UI to drive it to a result.
 */

/** Minimal but valid PDF with a correct xref table, so qpdf reads it clean. */
export function makePdf(label: string, pageCount: number): Buffer {
  const objects: string[] = [];
  const pageNumbers: number[] = [];
  const streams: [number, number, string][] = [];

  let next = 3;
  for (let i = 0; i < pageCount; i += 1) {
    const contentNumber = next++;
    const pageNumber = next++;
    pageNumbers.push(pageNumber);
    streams.push([contentNumber, pageNumber, `${label}${i + 1}`]);
  }
  const fontNumber = next++;

  objects[1] = "<</Type/Catalog/Pages 2 0 R>>";
  objects[2] = `<</Type/Pages/Kids[${pageNumbers
    .map((n) => `${n} 0 R`)
    .join(" ")}]/Count ${pageCount}>>`;
  for (const [contentNumber, pageNumber, text] of streams) {
    const stream = `BT /F1 24 Tf 20 100 Td (${text}) Tj ET\n`;
    objects[contentNumber] =
      `<</Length ${stream.length}>>\nstream\n${stream}endstream`;
    objects[pageNumber] =
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents ${contentNumber} 0 R/Resources<</Font<</F1 ${fontNumber} 0 R>>>>>>`;
  }
  objects[fontNumber] = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>";

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < next; i += 1) {
    offsets[i] = body.length;
    body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = body.length;
  body += `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let i = 1; i < next; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer<</Size ${next}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}
