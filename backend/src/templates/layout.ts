import { z } from "zod";

// Per-resume layout presets. Without a font size each template keeps its own.
export const resumeLayoutSchema = z.object({
  spacing: z.enum(["compact", "normal", "relaxed"]).default("normal"),
  fontSize: z.union([z.literal(10), z.literal(11), z.literal(12)]).optional(),
  // How profile links show in the contact line. Without it, an icon and the address.
  links: z.enum(["icon-and-link", "icon-and-name", "link"]).optional(),
});

export type ResumeLayout = z.infer<typeof resumeLayoutSchema>;

// Normal has no entry: it is each template exactly as designed.
// Section spacing uses titlesec's *n shorthand (n ex, with stretch); its default is *3.5 before, *2.3 after.
const presets = {
  compact: { lineSpread: 0.95, sectionBefore: 2.6, sectionAfter: 1.6, itemGap: -1, nameGap: -3 },
  relaxed: { lineSpread: 1.08, sectionBefore: 4.4, sectionAfter: 2.8, itemGap: 2, nameGap: 4 },
};

const preset = (layout?: ResumeLayout) =>
  layout?.spacing && layout.spacing !== "normal" ? presets[layout.spacing] : undefined;

// Extra space between the name and the line below it, in points.
export const nameGapPt = (layout?: ResumeLayout) => preset(layout)?.nameGap ?? 0;

export const nameGap = (layout?: ResumeLayout) => {
  const pt = nameGapPt(layout);
  return pt ? String.raw`\vspace{${pt}pt}` : "";
};

// Applies the font size and spacing to a rendered template. The default layout leaves it untouched.
export function applyLayout(tex: string, layout?: ResumeLayout) {
  let out = layout?.fontSize ? tex.replace(/^(\\documentclass\[[^\]]*?)[\d.]+pt\]/, `$1${layout.fontSize}pt]`) : tex;
  const p = preset(layout);
  if (p) {
    const lines = [
      String.raw`\linespread{${p.lineSpread}}`,
      String.raw`\titlespacing*{\section}{0pt}{*${p.sectionBefore}}{*${p.sectionAfter}}`,
      String.raw`\setlist[itemize]{itemsep=\dimexpr\itemsep${p.itemGap < 0 ? "" : "+"}${p.itemGap}pt\relax}`,
    ];
    out = out.replace("\\begin{document}", `${lines.join("\n")}\n\\begin{document}`);
  }
  return out;
}
