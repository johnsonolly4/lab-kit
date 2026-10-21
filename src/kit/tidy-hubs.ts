// Tidy up notes: bring hub pages up to the current kit template (plan docs/plans/hub-buttons-templates-icons.md, Phase 5). Pure text rules.
// A hub's properties are Tidy's other rules; this replaces the page below them with the template's page and keeps what is yours: a project's
// goal and what is written under Related, a topic's intro text. Everything else on the page is replaced, which is why the rule is never ticked by default.
import { goalOf } from "../planning/lists";

export type HubKind = "project" | "topic" | "series";

/** The page of a hub template: after the Templater header (or the token header) and the properties, with `<% vt.folder %>` / `{{folder}}` filled in. Trimmed. */
export function templatePage(template: string, folder: string): string {
  const t = template.replace(/\r\n/g, "\n");
  let afterHeader = t.includes("-%>\n") ? t.slice(t.indexOf("-%>\n") + 4) : t;
  // a token template (`make: note`, Phase 4) starts with its own header block, then the note's properties
  const head = /^---\n(?:(?!---\n)[\s\S])*?\nmake: note\n[\s\S]*?\n---\n/.exec(afterHeader);
  if (head) afterHeader = afterHeader.slice(head[0].length);
  const m = /^---\n[\s\S]*?\n---\n/.exec(afterHeader);
  return (m ? afterHeader.slice(m[0].length) : afterHeader).replace(/<%\s*vt\.folder\s*%>|\{\{\s*folder\s*\}\}/g, folder).trim();
}

const CARD_BLOCK = /```vault-card\n[\s\S]*?\n```\n?/g;
const TOPIC_HINT = "What is this topic about? Write it here.";

/** The page a hub would have: the template's, with the user's own text put back. `old` is the page now (text below the properties). Trimmed. */
export function newHubPage(kind: HubKind, page: string, old: string): string {
  const o = old.replace(/\r\n/g, "\n");
  if (kind === "project") {
    const goal = goalOf(o);
    let out = page.replace("[goal:: ]", `[goal:: ${goal}]`);
    const rel = /^## Related[ \t]*$/m.exec(o), at = /^## Related[ \t]*$/m.exec(out);
    if (rel && at) out = out.slice(0, at.index) + o.slice(rel.index).trimEnd();
    return out.trim();
  }
  if (kind === "topic") {
    const rest = o.replace(CARD_BLOCK, "");
    const fence = rest.indexOf("```");
    const intro = (fence === -1 ? rest : rest.slice(0, fence)).trim();
    return intro ? page.replace(TOPIC_HINT, intro) : page;
  }
  return page;
}

/** Does the page differ from what it would be (ignoring blank lines at its ends and line endings)? */
export const pageDiffers = (old: string, next: string): boolean => old.replace(/\r\n/g, "\n").trim() !== next.trim();

/** `text` with the page below the properties replaced: null when it is not `before` any more (the note changed since the scan) or has no properties. */
export function replaceBody(text: string, before: string, after: string): string | null {
  const crlf = text.includes("\r\n"), t = text.replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return null;
  let end = t.indexOf("\n---", 3);
  while (end !== -1 && !(t.length === end + 4 || t[end + 4] === "\n")) end = t.indexOf("\n---", end + 1);
  if (end === -1) return null;
  const head = t.slice(0, end + 4), body = t.slice(end + 4);
  if (body !== before.replace(/\r\n/g, "\n")) return null;
  const out = head + after;
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

/** The body text the way a note stores it after the closing `---`: a blank line, the page, a newline. */
export const asBody = (page: string): string => `\n\n${page}\n`;
