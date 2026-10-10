import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "./types.js";

const boldFont = /bold|black|heavy|semibold|demi/i;
export const iconFont = /awesome|icon|glyph|material|dingbat|marvosym|wasy|academicons/i;

// An icon wrapped in a marked-content Span with no MCID carries replacement text (accsupp's ActualText, as Shortlist's
// templates write it), which text extractors like pdftotext use instead of the glyph. pdf.js doesn't expose that
// text, so icon runs inside such a span are skipped, the same as those extractors drop them.
export function withoutReplacedIcons<T>(items: T[], fontOf: (item: T) => string): T[] {
  const spans: boolean[] = [];
  return items.filter((item) => {
    const mark = item as { type?: string; tag?: string; id?: string | null };
    if (mark.type === "beginMarkedContent" || mark.type === "beginMarkedContentProps") {
      spans.push(mark.tag === "Span" && !mark.id);
      return false;
    }
    if (mark.type === "endMarkedContent") {
      spans.pop();
      return false;
    }
    return !(spans.includes(true) && iconFont.test(fontOf(item)));
  });
}

// The browser sends the same TextItem[] built the same way: for each pdf.js text item with a non-empty `str`,
// x = transform[4], y = viewport height - transform[5] - height (top of the run, measured down from the page top),
// width/height from the item, page counted from 1, bold from the real font name in page.commonObjs (after
// getOperatorList) matching /bold|black|heavy|semibold|demi/i. Page size is the first page's viewport at scale 1.
export async function extractTextItems(pdf: Uint8Array, maxPages = 4) {
  // pdf.js detaches the buffer it is given, so it gets a copy.
  const task = getDocument({ data: pdf.slice(), useSystemFonts: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    const items: TextItem[] = [];
    let pageWidth = 0;
    let pageHeight = 0;
    for (let number = 1; number <= Math.min(doc.numPages, maxPages); number++) {
      const page = await doc.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      if (number === 1) [pageWidth, pageHeight] = [width, height];
      await page.getOperatorList();
      const fontNames = new Map<string, string>();
      const content = await page.getTextContent({ includeMarkedContent: true });
      const runs = withoutReplacedIcons(content.items, (run) => {
        try {
          return "fontName" in run ? ((page.commonObjs.get(run.fontName) as { name?: string }).name ?? "") : "";
        } catch {
          return "";
        }
      });
      for (const run of runs) {
        if (!("str" in run) || !run.str.trim()) continue;
        if (!fontNames.has(run.fontName)) {
          let real = "";
          try {
            real = (page.commonObjs.get(run.fontName) as { name?: string }).name ?? "";
          } catch {
            // A font pdf.js never loaded has no name; it just isn't marked bold.
          }
          fontNames.set(run.fontName, real);
        }
        const fontName = fontNames.get(run.fontName)!;
        const runHeight = run.height || Math.hypot(run.transform[2], run.transform[3]);
        items.push({
          text: run.str,
          x: run.transform[4],
          y: height - run.transform[5] - runHeight,
          width: run.width,
          height: runHeight,
          page: number,
          fontName,
          bold: boldFont.test(fontName),
        });
      }
      page.cleanup();
    }
    return { items, pageCount: doc.numPages, pageHeight, pageWidth };
  } finally {
    await task.destroy();
  }
}
