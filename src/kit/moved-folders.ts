// Find moved folders (troubleshooting): a folder named in the settings no longer exists, most likely because it was moved outside
// Obsidian (no rename event, so the setting couldn't follow). Suggests where it went. Pure: plain paths in, ranked candidates out.

/** A folder setting whose folder is missing. `kind`: the `kind` property of notes that live in it (to-dos, project hubs, …), if any. */
export interface MissingFolder {
  /** Which setting: `planning:<role>` or `lab:<key>`. */
  key: string;
  label: string;
  path: string;
  /** Notes with this `kind` live at `depth` folders below this one (0 = directly in it). */
  kind?: { value: string; depth: number; what: string };
}
export interface MovedCandidate { path: string; reason: string; score: number }

const base = (p: string): string => p.slice(p.lastIndexOf("/") + 1);
const parentOf = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
/** `p` with `n` path parts taken off the end (`a/b/c`, 1 → `a/b`); null when it has too few. */
function up(p: string, n: number): string | null {
  let at = p;
  for (let i = 0; i < n; i++) { if (!at) return null; at = parentOf(at); }
  return at || null;
}

/**
 * Where `m` may have gone, best first. Three clues, each adds to a candidate's score:
 * 1. a folder with the same name (the more trailing parts of the path match, the better: `Lab Book/Notes` beats `Notes`);
 * 2. the folder that holds the notes of `m.kind` (to-dos, project hubs, …), counted;
 * 3. the folder that holds the kit files tracked inside `m` (same path below it), counted.
 * `folders`: every folder in the vault; `notes`: notes with a `kind`; `files`: every file path; `tracked`: kit file paths recorded inside `m.path`.
 * Folders that are the missing path itself, or that another setting already uses (`taken`), are left out.
 */
export function findMoved(m: MissingFolder, folders: string[], notes: { path: string; kind: string }[], files: string[], tracked: string[], taken: string[] = []): MovedCandidate[] {
  const score = new Map<string, { score: number; reasons: string[] }>();
  const add = (path: string | null, points: number, reason: string): void => {
    if (!path || path === m.path || taken.includes(path)) return;
    const c = score.get(path) ?? { score: 0, reasons: [] };
    c.score += points; c.reasons.push(reason); score.set(path, c);
  };
  // 1. Same name: count matching trailing parts
  const want = m.path.split("/");
  for (const f of folders) {
    const have = f.split("/");
    let n = 0;
    while (n < want.length && n < have.length && want[want.length - 1 - n] === have[have.length - 1 - n]) n++;
    if (n > 0 && base(f) === base(m.path)) add(f, 10 * n, "same name");
  }
  // 2. Notes of its kind
  if (m.kind) {
    const counts = new Map<string, number>();
    for (const n of notes) {
      if (n.kind !== m.kind.value) continue;
      const at = up(parentOf(n.path), m.kind.depth);
      if (at) counts.set(at, (counts.get(at) ?? 0) + 1);
    }
    for (const [at, n] of counts) add(at, 5 * n, `${n} ${m.kind.what} found there`);
  }
  // 3. Kit files tracked inside it, found at the same place below another folder
  const counts = new Map<string, number>();
  for (const t of tracked) {
    const rel = t.slice(m.path.length + 1);
    if (!rel) continue;
    for (const f of files) if (f !== t && f.endsWith("/" + rel)) { const at = f.slice(0, f.length - rel.length - 1); counts.set(at, (counts.get(at) ?? 0) + 1); }
  }
  for (const [at, n] of counts) add(at, 5 * n, `${n} kit file${n === 1 ? "" : "s"} found there`);
  return [...score.entries()].map(([path, c]) => ({ path, score: c.score, reason: c.reasons.join(", ") }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

/** What each planning folder holds, for the "notes of its kind" clue (depth: folders between the setting's folder and the note's own folder). */
const PLANNING_CLUES: Partial<Record<string, MissingFolder["kind"]>> = {
  planning: { value: "todo", depth: 1, what: "to-dos" },          // <planning>/To-dos/<to-do>.md
  projects: { value: "project", depth: 1, what: "project hubs" },  // <projects>/<Project>/<Project>.md
  meetings: { value: "meeting", depth: 1, what: "meeting notes" }, // <meetings>/<Series>/<meeting>.md
};
const PLANNING_LABELS: Record<string, string> = {
  inbox: "Inbox", daily: "Daily notes", planning: "Planning", projects: "Projects", literature: "Literature",
  knowledge: "Knowledge", howtos: "How-tos", meetings: "Meetings", archive: "Archive",
};

/**
 * Folder settings whose folder is missing: the planning roles in `planningMissing` (see missingPlanningFolders) and the lab kit's
 * Lab notes and Chemical folders when they are set.
 */
export function missingFolderSettings(o: { planning: Record<string, string>; planningMissing: string[]; labFolder: string; chemicalFolder: string; exists: (p: string) => boolean }): MissingFolder[] {
  const out: MissingFolder[] = o.planningMissing.map(role => ({ key: `planning:${role}`, label: PLANNING_LABELS[role] ?? role, path: o.planning[role], kind: PLANNING_CLUES[role] }));
  if (o.labFolder && !o.exists(o.labFolder)) out.push({ key: "lab:labFolder", label: "Lab notes", path: o.labFolder });
  if (o.chemicalFolder && !o.exists(o.chemicalFolder)) out.push({ key: "lab:chemicalFolder", label: "Chemicals", path: o.chemicalFolder });
  return out;
}
