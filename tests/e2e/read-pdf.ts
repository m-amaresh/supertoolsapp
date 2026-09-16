import { inflateSync } from "node:zlib";

/**
 * Reads back the page labels `makePdf` wrote, in the order they appear.
 *
 * Counting pages is not enough. A reversed, duplicated or simply wrong
 * selection keeps the count intact while getting every page wrong, so the
 * tests that care about *which* pages came out compare these labels.
 *
 * Kept separate from `make-pdf.ts` on purpose: that module builds a document,
 * this one takes one apart, and a file that does both would be back to the
 * vague naming the split was meant to fix.
 *
 * One caveat, found the hard way: this walks **content streams**, not pages.
 * When a selection asks for the same page twice qpdf writes two page objects
 * pointing at one shared stream, so the label appears once while the document
 * really does have two pages. Assert the page count with `--show-npages` when
 * that distinction matters.
 */
export function readPageLabels(pdf: Buffer): string[] {
  // latin1 is byte-preserving, so string offsets are byte offsets.
  const text = pdf.toString("latin1");
  const labels: string[] = [];

  const STREAM = /stream\r?\n/g;
  let match: RegExpExecArray | null = STREAM.exec(text);
  while (match !== null) {
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    if (end !== -1) {
      const raw = pdf.subarray(start, end);
      let body = "";
      try {
        body = inflateSync(raw).toString("latin1");
      } catch {
        // Not a Flate stream (or not a content stream at all) — the object
        // streams and xref streams in the file land here too. Skip them.
        body = raw.toString("latin1");
      }
      for (const found of body.matchAll(/\(([A-Z]\d+)\)\s*Tj/g)) {
        labels.push(found[1]);
      }
    }
    match = STREAM.exec(text);
  }

  return labels;
}
