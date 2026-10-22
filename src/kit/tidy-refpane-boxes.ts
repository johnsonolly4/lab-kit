// Lab Kit's old paper boxes (Dataview, from the kit before the refpane switch-over) and the refpane block each becomes (Tidy up notes, rule `refpane-blocks`).
// The old text must match exactly (trailing spaces ignored); a box you edited is left alone. Generated from the kit files of Lab Kit 1.4.1.
export const OLD_PAPER_BOXES: { old: string[]; refpane: string[] }[] = [
  { old: ["LIST WITHOUT ID link(file.path, Title)", "FROM \"04 Literature\"", "WHERE kind = \"literature\" AND !takeaway", "SORT default(imported, file.ctime) DESC", "LIMIT 10"],
    refpane: ["show: to-read", "limit: 10"] },
  { old: ["LIST WITHOUT ID link(file.path, Title) + \" <span class='vt-muted'>&middot; \" + Year + \"</span>\"", "FROM \"04 Literature\"", "WHERE kind = \"literature\" AND contains(row[\"Zotero Tags\"], \"key-paper\")", "SORT Year DESC"],
    refpane: ["show: key-papers"] },
  { old: ["TABLE WITHOUT ID link(file.path, Title) AS \"Paper\", takeaway AS \"Takeaway\", Year", "FROM \"04 Literature\"", "WHERE kind = \"literature\"", "SORT default(imported, file.ctime) DESC", "LIMIT 15"],
    refpane: ["show: recently-read", "limit: 15"] },
  { old: ["LIST rows.file.link", "FROM \"04 Literature\"", "WHERE kind = \"literature\"", "FLATTEN row[\"Zotero Tags\"] AS tag", "WHERE tag", "GROUP BY tag", "SORT tag ASC"],
    refpane: ["show: by-tag"] },
  { old: ["LIST rows.p", "FROM \"04 Literature\"", "WHERE kind = \"literature\" AND contains(row[\"Zotero Tags\"], \"key-paper\")", "FLATTEN default(Collections, list()) AS c", "WHERE startswith(c, \"Projects/\")", "FLATTEN link(file.path, Title) + choice(takeaway, \" <span class='vt-muted'>&middot; \" + takeaway + \"</span>\", \"\") AS p", "GROUP BY link(replace(c, \"Projects/\", \"\"))", "SORT key ASC"],
    refpane: ["show: key-papers-by-project"] },
  { old: ["LIST WITHOUT ID choice(contains(default(zotero_tags, list()), \"/priority\"), \"&#9733; \", \"\") + link(file.path, paper_title) + \" <span class='vt-muted'>&middot; \" + default(join(map(filter(file.lists, (l) => contains(l.outlinks, this.file.link)), (l) => regexreplace(l.text, \"^[^:]*:\\\\s*\", \"\")), \"; \"), \"\") + \"</span>\"", "FROM \"04 Literature\"", "WHERE kind = \"literature\" AND (contains(default(collections, list()), \"Projects/\" + this.file.name) OR contains(file.outlinks, this.file.link))", "SORT contains(default(zotero_tags, list()), \"/priority\") DESC, Year DESC"],
    refpane: ["show: project-papers"] },
];

const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((l, i) => l.trimEnd() === b[i].trimEnd());
const PREFIX = /^((?:>[ \t]?)*)/;

/** A note body with Lab Kit's old paper boxes written as refpane blocks: `vault-card` `recently-read` and `meeting-papers`, and the kit's old Dataview paper queries (see `OLD_PAPER_BOXES`). Anything else is kept as it is. */
export function swapRefpaneBlocks(body: string): string {
  const lines = body.split("\n"), out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const pre = PREFIX.exec(lines[i])![1], open = /^(`{3,})(vault-card|dataview)[ \t]*$/.exec(lines[i].slice(pre.length));
    let close = -1;
    if (open) for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].startsWith(pre.trimEnd())) break;
      if (new RegExp(`^${open[1]}\\s*$`).test(lines[j].slice(PREFIX.exec(lines[j])![1].length))) { close = j; break; }
    }
    if (!open || close < 0) { out.push(lines[i]); continue; }
    const inner = lines.slice(i + 1, close).map(l => l.slice(PREFIX.exec(l)![1].length));
    let next: string[] | null = null;
    if (open[2] === "vault-card") {
      const show = inner.find(l => /^show:/.test(l))?.replace(/^show:\s*/, "").trim();
      if (show === "recently-read") next = inner;
      else if (show === "meeting-papers") next = inner.map(l => /^show:/.test(l) ? "show: papers-read" : l);
    } else next = OLD_PAPER_BOXES.find(b => same(b.old, inner))?.refpane ?? null;
    if (!next) { out.push(...lines.slice(i, close + 1)); i = close; continue; }
    out.push(`${pre}${open[1]}refpane`, ...next.map(l => pre + l), lines[close]);
    i = close;
  }
  return out.join("\n");
}
