import { iconFont } from "./extract.js";
import type { ParsedResume, SectionKind, TextItem } from "./types.js";

export { iconFont };

type Page = { width: number; height: number };
type Segment = { x: number; end: number; text: string; bold: boolean; height: number };
type Line = { page: number; y: number; height: number; x: number; text: string; bullet: boolean; segments: Segment[] };
const separators = new Set(["|", "•", "·", "◦", "▪", "●", "■", "♦", "⋄", "∙"]);
const bulletStart = /^[•◦▪●■♦⋄∙*\-\u2013]/;

const mid = (item: { y: number; height: number }) => item.y + item.height / 2;
const isSeparator = (item: TextItem) => separators.has(item.text.trim()) || iconFont.test(item.fontName ?? "");

// The font size most of the text is set in, weighted by characters.
function bodySize(items: TextItem[]) {
  const sorted = [...items].sort((a, b) => a.height - b.height);
  let remaining = sorted.reduce((sum, item) => sum + item.text.length, 0) / 2;
  for (const item of sorted) if ((remaining -= item.text.length) <= 0) return item.height;
  return 10;
}

function toLine(items: TextItem[]): Line {
  items.sort((a, b) => a.x - b.x);
  const segments: Segment[] = [];
  let current: (Segment & { boldChars: number; chars: number }) | null = null;
  let previous: TextItem | null = null;
  for (const item of items) {
    if (isSeparator(item)) {
      current = null;
      continue;
    }
    const gap = current ? item.x - current.end : Infinity;
    const restyled =
      !!previous &&
      (!!previous.bold !== !!item.bold ||
        Math.max(previous.height, item.height) > Math.min(previous.height, item.height) * 1.3);
    if (!current || gap > item.height * 1.2 || (restyled && gap > item.height * 0.15)) {
      current = { x: item.x, end: item.x, text: "", bold: false, height: 0, boldChars: 0, chars: 0 };
      segments.push(current);
    } else if (gap > item.height * 0.15 && !current.text.endsWith(" ") && !item.text.startsWith(" ")) {
      current.text += " ";
    }
    previous = item;
    current.height = Math.max(current.height, item.height);
    current.text += item.text;
    current.end = Math.max(current.end, item.x + item.width);
    current.chars += item.text.trim().length;
    if (item.bold) current.boldChars += item.text.trim().length;
    current.bold = current.boldChars * 2 > current.chars;
  }
  for (const segment of segments) segment.text = segment.text.replace(/\s+/g, " ").trim();
  const first = items[0]!;
  return {
    page: first.page,
    y: Math.min(...items.map((item) => item.y)),
    height: Math.max(...items.map((item) => item.height)),
    x: first.x,
    text: segments.map((segment) => segment.text).join(" "),
    bullet: bulletStart.test(first.text.trim()),
    segments: segments.filter((segment) => segment.text),
  };
}

// Groups items whose vertical centers line up, the way a naive parser reads: top to bottom, then left to right,
// even when that runs across two columns.
function toLines(items: TextItem[]) {
  const groups: TextItem[][] = [];
  for (const item of [...items].sort((a, b) => a.page - b.page || mid(a) - mid(b))) {
    const group = groups.at(-1);
    const tallest = group?.reduce((top, other) => (other.height > top.height ? other : top));
    if (
      group &&
      tallest!.page === item.page &&
      Math.abs(mid(item) - mid(tallest!)) <= Math.min(tallest!.height, item.height) / 2
    )
      group.push(item);
    else groups.push([item]);
  }
  return groups.map(toLine).filter((line) => line.segments.length > 0);
}

// A second column shows up as many segments starting at the same x, far right of the first column, over a
// shared stretch of the page that no line crosses. Right-aligned dates and places can share a start x too, but
// they also share their right edge, while a real column's lines end ragged.
function findColumns(lines: Line[], page: Page) {
  const starts = lines
    .flatMap((line) => line.segments.map((segment) => ({ x: segment.x, end: segment.end, y: line.y })))
    .sort((a, b) => a.x - b.x);
  const clusters: { x: number; top: number; bottom: number; count: number; ends: number[] }[] = [];
  for (const start of starts) {
    const cluster = clusters.at(-1);
    if (cluster && start.x - cluster.x <= 4) {
      cluster.count++;
      cluster.top = Math.min(cluster.top, start.y);
      cluster.bottom = Math.max(cluster.bottom, start.y);
      cluster.ends.push(start.end);
    } else clusters.push({ x: start.x, top: start.y, bottom: start.y, count: 1, ends: [start.end] });
  }
  const flushRight = (cluster: (typeof clusters)[number]) => {
    const edge = Math.max(...cluster.ends);
    return cluster.ends.filter((end) => edge - end <= 3).length >= cluster.ends.length * 0.8;
  };
  const tall = clusters.filter((cluster) => cluster.count >= 4 && cluster.bottom - cluster.top >= page.height * 0.1);
  for (const left of tall)
    for (const right of tall) {
      if (right.x - left.x < page.width * 0.2 || flushRight(right)) continue;
      const top = Math.max(left.top, right.top);
      const bottom = Math.min(left.bottom, right.bottom);
      if (bottom - top < page.height * 0.1) continue;
      const gutter = right.x - 1;
      const shared = lines.filter((line) => line.y >= top && line.y <= bottom);
      const crossing = shared.filter((line) => line.segments.some((s) => s.x < gutter && s.end > gutter + 2));
      if (crossing.length <= shared.length * 0.1) return { gutter, top, bottom };
    }
  return null;
}

// Page headers and footers: small text in the top or bottom 5% of a page, set apart from the body. Many ATS
// strip it before parsing.
export function layout(items: TextItem[], page: Page) {
  const size = bodySize(items);
  const zone = page.height * 0.05;
  const inZone = (item: TextItem) => mid(item) < zone || mid(item) > page.height - zone;
  const gap = (a: TextItem, b: TextItem) => Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
  const margins = items.filter(
    (item) =>
      inZone(item) &&
      item.height <= size * 1.1 &&
      items.some((other) => other.page === item.page && !inZone(other)) &&
      items.every((other) => other.page !== item.page || inZone(other) || gap(item, other) >= size),
  );
  const lines = toLines(items.filter((item) => !margins.includes(item)));
  const pages = [...new Set(lines.map((line) => line.page))];
  const columns = pages.flatMap((number) => {
    const onPage = lines.filter((line) => line.page === number);
    const found = findColumns(onPage, page);
    if (!found) return [];
    // Out of order: a line that holds text from both columns, or one that jumps to the other column.
    let previous = "";
    let mixed = 0;
    for (const line of onPage.filter((line) => line.y >= found.top && line.y <= found.bottom)) {
      const left = line.segments.some((s) => s.end <= found.gutter);
      const side = left && line.segments.some((s) => s.x >= found.gutter) ? "both" : left ? "left" : "right";
      if (side === "both" || (previous && side !== previous)) mixed++;
      previous = side;
    }
    return [{ page: number, mixed }];
  });
  return { size, margins, lines, columns };
}

const headingKinds: [SectionKind, RegExp][] = [
  [
    "experience",
    /^((work|professional|research|industry|relevant) )?(experience|employment( history)?|work history|internships?)$/,
  ],
  ["education", /^(education|academics?|academic (background|details|qualifications)|qualifications)$/],
  [
    "skills",
    /^((technical|key|core|relevant) )?skills( and \w+)?$|^(technologies|tech stack|technical expertise|(core )?competencies)$/,
  ],
  ["projects", /^((personal|academic|key|selected|side|technical) )?projects$/],
  ["summary", /^((professional|career) )?(summary|profile|objective)$|^about( me)?$/],
  [
    "other",
    /^((awards|honou?rs|achievements|certifications?|publications|courses|coursework|languages|interests|hobbies|activities|leadership|references|training|volunteering|links)( and \w+)?|profile links|relevant coursework|volunteer experience|extra ?curricular( activities)?|positions? of responsibility|open source( contributions| projects)?)$/,
  ],
];

const headingText = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const knownKind = (text: string) => headingKinds.find(([, pattern]) => pattern.test(headingText(text)))?.[0];

function isHeading(line: Line, size: number) {
  const text = line.text.replace(/:$/, "");
  if (
    line.bullet ||
    line.segments.length !== 1 ||
    text.length > 40 ||
    text.split(" ").length > 5 ||
    /[@\d,.:]/.test(text)
  )
    return false;
  if (knownKind(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  return (letters.length >= 4 && letters === letters.toUpperCase()) || line.height >= size * 1.15;
}

const month = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const point = `(?:${month}\\s*'?\\d{2,4}|\\d{1,2}[/.-](?:19|20)?\\d{2}|(?:19|20)\\d{2})`;
const dates = new RegExp(
  `\\b${point}(?:\\s*(?:-|\u2013|\u2014|to)\\s*(?:${point}|present|current|now|ongoing|till date))?`,
  "i",
);

// ponytail: a fixed list of places, so towns outside it only count with a "City, Region" shape.
const places =
  /^(india|remote|hybrid|bengaluru|bangalore|mumbai|delhi|new delhi|gurugram|gurgaon|noida|hyderabad|chennai|pune|kolkata|ahmedabad|jaipur|chandigarh|kochi|indore|lucknow|bhopal|nagpur|surat|coimbatore|mysuru|mysore|trivandrum|thiruvananthapuram|bhubaneswar|patna|goa|vadodara|visakhapatnam|singapore|london|dubai|new york|san francisco|seattle|berlin|toronto)$/i;
const isPlace = (text: string) => places.test(text) || /^[A-Z][A-Za-z .]+, ?[A-Z][A-Za-z .]+$/.test(text);

const titleWords =
  /\b(intern|engineer|developer|sde|swe|manager|analyst|lead|designer|consultant|associate|scientist|architect|founder|head|director|officer|executive|specialist|coordinator|researcher|assistant|trainee|fellow|president|member|volunteer|programmer|administrator|strategist|partner|vp|cto|ceo|teaching)\b/i;

function jobFrom(header: Line[]) {
  let found: string | null = null;
  const pieces: string[] = [];
  for (const segment of header.flatMap((line) => line.segments)) {
    const match = segment.text.match(dates);
    if (match && !found) found = match[0].replace(/\s*[\u2013\u2014]\s*/g, " - ");
    const rest = match ? segment.text.replace(match[0], " ") : segment.text;
    for (const piece of rest.split(/\s+(?:\||·|@|at|-|\u2013|\u2014)\s+|,\s+|\s*\|\s*/)) {
      const clean = piece.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.)]+$/g, "");
      if (clean && !isPlace(clean)) pieces.push(clean);
    }
  }
  const title = pieces.find((piece) => titleWords.test(piece));
  const others = pieces.filter((piece) => piece !== title);
  return title
    ? { title, company: others[0] ?? null, dates: found }
    : { title: others[1] ?? null, company: others[0] ?? null, dates: found };
}

// Each job is one or two header lines (title, company, dates) followed by bullets or description.
function parseJobs(lines: Line[]) {
  const jobs: ParsedResume["jobs"] = [];
  const left = Math.min(...lines.filter((line) => !line.bullet).map((line) => line.x));
  let header: Line[] = [];
  let inBody = false;
  const flush = () => {
    if (header.length) jobs.push(jobFrom(header));
    header = [];
  };
  for (const line of lines) {
    const startsJob = dates.test(line.text) || line.segments[0]!.bold;
    if (line.bullet || line.x > left + 4) {
      flush();
      inBody = true;
    } else if (header.length && header.length < 2 && !(dates.test(header[0]!.text) && dates.test(line.text))) {
      header.push(line);
    } else {
      flush();
      if (startsJob || !inBody) header.push(line);
    }
  }
  flush();
  return jobs;
}

export function parseItems(items: TextItem[], page: { width: number; height: number }): ParsedResume {
  const { size, lines, columns } = layout(items, page);

  const firstHeading = lines.findIndex((line) => isHeading(line, size) && !!knownKind(line.text));
  const top = lines.slice(0, firstHeading === -1 ? 6 : firstHeading).filter((line) => line.page === 1);
  // Letter-spaced names ("A A R A V") count their letters as one word.
  const words = (text: string) => text.replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, "$1").split(" ").length;
  const name = top
    .flatMap((line) => line.segments.map((segment) => ({ line, segment })))
    .filter(
      ({ segment }) =>
        /^[A-Za-z][A-Za-z.' -]+$/.test(segment.text) && words(segment.text) <= 4 && !knownKind(segment.text),
    )
    .reduce<{ line: Line; segment: Segment } | null>(
      (best, next) => (!best || next.segment.height > best.segment.height ? next : best),
      null,
    );

  const sections: (ParsedResume["sections"][number] & { body: Line[] })[] = [];
  const intro: Line[] = [];
  // Before the first standard heading only the name, headline and contact details are expected.
  for (const [index, line] of lines.entries()) {
    if (firstHeading !== -1 && index >= firstHeading && isHeading(line, size)) {
      const heading = line.text.replace(/:$/, "");
      sections.push({ heading, kind: knownKind(heading) ?? null, lines: [], body: [] });
    } else {
      const section = sections.at(-1);
      if (section) {
        section.lines.push(line.text);
        section.body.push(line);
      } else intro.push(line);
    }
  }

  const all = lines.map((line) => line.segments.map((s) => s.text).join(" | ")).join("\n");
  const email = all.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? null;
  const phone =
    all.match(/\+?\d[\d ().-]{8,16}\d/g)?.find((match) => {
      const digits = match.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 13;
    }) ?? null;
  const links = [
    ...new Set(
      all
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ")
        .match(
          /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|dev|io|org|net|me|co|ai|app|xyz|tech|site)\b(?:\/[^\s|,]*)?/gi,
        ) ?? [],
    ),
  ];
  const location =
    intro
      .flatMap((line) => line.segments.flatMap((s) => s.text.split(/\s*[|•·]\s*/)))
      .map((piece) => piece.replace(/^[^A-Za-z]+/, "").trim())
      .find(isPlace) ?? null;

  return {
    name: name?.segment.text ?? null,
    email,
    phone,
    location,
    links,
    sections: sections.map(({ heading, kind, lines }) => ({ heading, kind, lines })),
    jobs: sections.filter((s) => s.kind === "experience" && s.body.length).flatMap((s) => parseJobs(s.body)),
    readingOrderIssues: columns.reduce((sum, column) => sum + column.mixed, 0),
  };
}
