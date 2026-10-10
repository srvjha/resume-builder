import { iconFont, layout } from "./parse.js";
import type { ParseIssue, ParseReport, ParsedResume, TextItem } from "./types.js";

export type Expected = {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  sectionKinds?: string[];
  jobs?: { title?: string; company?: string }[];
};

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9@]/g, "");
const same = (found: string | null, expected: string) =>
  !!found && norm(found).includes(norm(expected)) && norm(found).length <= norm(expected).length * 2;
// "Acme, Pune" typed as the company is read as company Acme in Pune, which is right.
const sameCompany = (found: string | null, expected: string) =>
  same(found, expected) || same(found, expected.replace(/,[^,]*$/, ""));
const samePhone = (found: string | null, expected: string) =>
  !!found && found.replace(/\D/g, "").slice(-10) === expected.replace(/\D/g, "").slice(-10);
const unreadable = /[-�]/g;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function compare(parsed: ParsedResume, expected: Expected) {
  const fields: ParseReport["fields"] = [];
  const add = (id: string, label: string, found: string | null, wanted: string, ok: boolean) =>
    fields.push({ id, label, found, expected: wanted, ok });
  if (expected.name) add("name", "Name", parsed.name, expected.name, same(parsed.name, expected.name));
  if (expected.email) add("email", "Email", parsed.email, expected.email, same(parsed.email, expected.email));
  if (expected.phone) add("phone", "Phone", parsed.phone, expected.phone, samePhone(parsed.phone, expected.phone));
  for (const kind of expected.sectionKinds ?? []) {
    const section = parsed.sections.find((s) => s.kind === kind);
    add(
      `section.${kind}`,
      `${kind[0]!.toUpperCase()}${kind.slice(1)} section`,
      section?.heading ?? null,
      kind,
      !!section,
    );
  }
  (expected.jobs ?? []).forEach((job, index) => {
    const score = (found: ParsedResume["jobs"][number]) =>
      Number(!!job.title && same(found.title, job.title)) +
      Number(!!job.company && sameCompany(found.company, job.company));
    const best = parsed.jobs.reduce<ParsedResume["jobs"][number] | null>(
      (top, found) => (!top || score(found) > score(top) ? found : top),
      null,
    );
    const n = index + 1;
    if (job.title)
      add(`job${n}.title`, `Job ${n} title`, best?.title ?? null, job.title, same(best?.title ?? null, job.title));
    if (job.company)
      add(
        `job${n}.company`,
        `Job ${n} company`,
        best?.company ?? null,
        job.company,
        sameCompany(best?.company ?? null, job.company),
      );
  });
  return fields;
}

export function parseQuality(
  parsed: ParsedResume,
  input: { items: TextItem[]; page: { width: number; height: number }; expected?: Expected | undefined },
): ParseReport {
  const { margins, columns } = layout(input.items, input.page);
  const { expected } = input;
  const fields = expected
    ? compare(parsed, expected)
    : (
        [
          ["name", "Name", parsed.name],
          ["email", "Email", parsed.email],
          ["phone", "Phone", parsed.phone],
          ["location", "Location", parsed.location],
        ] as const
      ).map(([id, label, found]) => ({ id, label, found, expected: null, ok: found !== null }));
  const issues: ParseIssue[] = [];

  const marginText = margins.map((item) => item.text).join(" ");
  const missing = [!parsed.email && "email", !parsed.phone && "phone"].filter((field) => !!field);
  const inMargins = missing.filter((field) =>
    field === "email" ? /[\w.+-]+@[\w-]+\.[\w.-]+/.test(marginText) : /\d[\d ().-]{8,}\d/.test(marginText),
  );
  issues.push(
    inMargins.length
      ? {
          id: "contact",
          label: "Contact details in the main text",
          status: "fail",
          detail: `Your ${inMargins.join(" and ")} only appear${inMargins.length === 1 ? "s" : ""} in the page header or footer.`,
          fix: "Move your email and phone into the main body; many ATS drop page headers.",
        }
      : missing.length
        ? {
            id: "contact",
            label: "Contact details in the main text",
            status: parsed.email ? "warn" : "fail",
            detail: `No ${missing.join(" or ")} could be read from your resume.`,
            fix: "Add your email and phone as plain text near your name, not as an image or icon link.",
          }
        : {
            id: "contact",
            label: "Contact details in the main text",
            status: "pass",
            detail: `Read ${parsed.email} and ${parsed.phone} from the main text.`,
            fix: null,
          },
  );

  const mixed = parsed.readingOrderIssues;
  issues.push(
    columns.length || mixed
      ? {
          id: "columns",
          label: "Columns and reading order",
          status: mixed >= 5 ? "fail" : "warn",
          detail: `Your resume uses columns. Read top to bottom and left to right, ${plural(mixed, "line")} mix or jump between columns, so sections get jumbled.`,
          fix: "Use a single-column layout so every ATS reads each section in order.",
        }
      : {
          id: "columns",
          label: "Columns and reading order",
          status: "pass",
          detail: "Single column. The text reads top to bottom in the right order.",
          fix: null,
        },
  );

  const glyphs = input.items.reduce((sum, item) => sum + (item.text.match(unreadable)?.length ?? 0), 0);
  const iconItems = input.items.filter((item) => iconFont.test(item.fontName ?? ""));
  const iconFonts = [...new Set(iconItems.map((item) => (item.fontName ?? "").replace(/^[A-Z]{6}\+/, "")))];
  const bad = glyphs + iconItems.length;
  issues.push({
    id: "glyphs",
    label: "Icons and unreadable characters",
    status: bad === 0 ? "pass" : bad >= 10 ? "fail" : "warn",
    detail:
      bad === 0
        ? "Every character is readable text."
        : `Found ${plural(bad, "icon or unreadable character")}${iconFonts.length ? ` (icon fonts: ${iconFonts.join(", ")})` : ""}. An ATS reads these as junk characters or drops them.`,
    fix: bad === 0 ? null : "Replace icons with plain words like Email, Phone or LinkedIn, or remove them.",
  });

  const known = parsed.sections.filter((s) => s.kind);
  const unknown = parsed.sections.filter((s) => !s.kind).map((s) => s.heading);
  const absent = (expected?.sectionKinds ?? []).filter((kind) => !parsed.sections.some((s) => s.kind === kind));
  issues.push({
    id: "sections",
    label: "Standard section headings",
    status: known.length === 0 ? "fail" : absent.length || unknown.length ? "warn" : "pass",
    detail:
      known.length === 0
        ? "No standard section headings like Experience, Education or Skills were found."
        : [
            `Found ${known.map((s) => s.heading).join(", ")}.`,
            absent.length ? `Could not find your ${absent.join(", ")} section.` : "",
            unknown.length ? `These headings are not standard: ${unknown.join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
    fix:
      known.length && !absent.length && !unknown.length
        ? null
        : "Use plain headings like Experience, Education, Skills and Projects on their own line.",
  });

  const hasExperience = parsed.sections.some((s) => s.kind === "experience");
  const partial = parsed.jobs.filter((job) => !job.title || !job.company || !job.dates);
  issues.push(
    !hasExperience
      ? {
          id: "jobs",
          label: "Job titles, companies and dates",
          status: expected?.jobs?.length ? "fail" : "pass",
          detail: expected?.jobs?.length
            ? "Your experience section could not be found, so no jobs were read."
            : "No experience section, nothing to check.",
          fix: expected?.jobs?.length ? "Put your jobs under a heading named Experience." : null,
        }
      : parsed.jobs.length === 0
        ? {
            id: "jobs",
            label: "Job titles, companies and dates",
            status: "fail",
            detail: "Found an experience section but could not read any job in it.",
            fix: "Start each job with a line holding the title, company and dates, then the bullets.",
          }
        : {
            id: "jobs",
            label: "Job titles, companies and dates",
            status: partial.length ? "warn" : "pass",
            detail: `Read ${plural(parsed.jobs.length, "job")}: ${parsed.jobs
              .map((job) => `${job.title ?? "no title"} at ${job.company ?? "no company"} (${job.dates ?? "no dates"})`)
              .join("; ")}.`,
            fix: partial.length
              ? "Give each job its title, company and dates (like Jun 2024 - Aug 2024) on its first one or two lines."
              : null,
          },
  );

  const nameItem =
    parsed.name && input.items.find((item) => item.page === 1 && item.text.includes(parsed.name!.split(" ")[0]!));
  const nameOff = !!expected?.name && !same(parsed.name, expected.name);
  issues.push(
    !parsed.name || nameOff
      ? {
          id: "name",
          label: "Name at the top",
          status: "fail",
          detail: parsed.name
            ? `Your name was read as "${parsed.name}".`
            : "No name was found at the top of the first page.",
          fix: "Put your full name alone on the first line, in larger text than the rest.",
        }
      : /^([A-Za-z] )+[A-Za-z]$/.test(parsed.name)
        ? {
            id: "name",
            label: "Name at the top",
            status: "warn",
            detail: `Your name is letter-spaced ("${parsed.name}"), so some ATS read it as single letters.`,
            fix: "Set your name without extra letter spacing.",
          }
        : nameItem && nameItem.y > input.page.height * 0.25
          ? {
              id: "name",
              label: "Name at the top",
              status: "warn",
              detail: `Found "${parsed.name}" but it is not near the top of the page.`,
              fix: "Move your name to the very top of the first page.",
            }
          : {
              id: "name",
              label: "Name at the top",
              status: "pass",
              detail: `Read your name as "${parsed.name}".`,
              fix: null,
            },
  );

  const chars = input.items.reduce((sum, item) => sum + item.text.replace(/\s/g, "").length, 0);
  const pages = Math.max(1, ...input.items.map((item) => item.page));
  issues.push({
    id: "density",
    label: "Readable text",
    status: chars < 200 ? "fail" : chars / pages < 300 ? "warn" : "pass",
    detail:
      chars < 200
        ? `Only ${plural(chars, "character")} of text could be read. This looks like a scanned or image PDF.`
        : `${chars} characters of text read across ${plural(pages, "page")}.`,
    fix:
      chars < 200
        ? "Export your resume as a PDF from a text editor or our builder, not as a scan or image."
        : chars / pages < 300
          ? "Some pages have very little text. Check that nothing is an image."
          : null,
  });

  return {
    parseRate: expected && fields.length ? fields.filter((field) => field.ok).length / fields.length : null,
    fields,
    issues,
    parsed,
  };
}
