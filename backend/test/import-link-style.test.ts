import { describe, expect, it } from "vitest";
import { linkStyleOf } from "../src/modules/imports/pdf-hints.js";

const profiles = ["https://linkedin.com/in/saurav-jha", "https://github.com/srvjha", "https://srvjha.in"];
// Text under each link as pdf.js reads it; the first character is the icon font's glyph.
const header = (texts: string[]) => texts.map((text, i) => ({ text, url: profiles[i]! }));
const projects = [
  { text: "Live", url: "https://yugati.in/" },
  { text: "GitHub", url: "https://github.com/srvjha/yugati" },
];

describe("link style of an imported PDF", () => {
  it("keeps icon and name when the header names its links", () => {
    expect(linkStyleOf(header(["] LinkedIn", "a Github", "ç Portfolio Website"]), profiles)).toBe("icon-and-name");
  });

  it("leaves the default when the header prints addresses", () => {
    expect(linkStyleOf(header(["] linkedin.com/in/saurav-jha", "a github.com/srvjha", "ç srvjha.in"]), profiles)).toBe(
      undefined,
    );
  });

  it("ignores project links, which are named in every style", () => {
    expect(
      linkStyleOf([...header(["linkedin.com/in/saurav-jha", "github.com/srvjha", "srvjha.in"]), ...projects], profiles),
    ).toBe(undefined);
  });
});
