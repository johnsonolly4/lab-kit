/* =====================================================================
   HAZARD TABLE (Dataview view)
   ---------------------------------------------------------------------
   Shows the GHS hazard phrases for every chemical in this note's
   "Chemicals" property, colour-coded by severity.

   Use in a note:
     ```dataviewjs
     await dv.view("Extras/scripts/hazards")
     ```
   Override any setting for one note by passing it in, e.g.
     await dv.view("Extras/scripts/hazards", { collapsed: false, legendDetails: true })

   Each chemical needs its own note with an H_Phrase property (list), e.g.
     H_Phrase:
       - "H225 Highly flammable liquid and vapour"
       - "H319 Causes serious eye irritation"

   Requires: Dataview → Settings → "Enable JavaScript queries" ON.
   ===================================================================== */

// ===================== SETTINGS (change these) =====================
const DEFAULTS = {
  // --- Which property holds the chemicals, and where to read classes ---
  chemicalsProperty: "Chemicals",
  classProperty: "Exp. Class",          // matched ignoring capitals
  hideForClasses: ["in-silico", "setup"], // no table for these Exp. Class values

  // --- Layout ---
  collapsed: true,           // true = put the table behind a clickable one-line summary
  startOpen: true,           // true = that summary starts expanded (click it to fold)
  showSummaryCounts: true,   // summary line shows e.g. "Severe 1 · High 2"
  showLegend: true,          // colour key under the table
  legendDetails: false,      // true = show the GHS categories under each legend item

  // --- Sorting ---
  sortByWorstHazard: true,   // true = most hazardous chemical first, false = A→Z

  // --- Highlighting ---
  highlightWholePhrase: false, // true = colour the whole phrase, false = just the H-code
  showCategoryLabels: false,   // true = add "Cat 2" after each code
  shadeChemicalCell: true,     // shade the chemical name with its worst hazard colour
  centreChemicalCell: true,    // centre the chemical name in its cell

  // --- Missing data ---
  showMissing: true          // list chemicals that have no note or no H_Phrase
};

// Severity levels, most → least severe. Each H-code gets the FIRST level it matches.
// colour: any CSS colour (the last two hex digits are transparency).
const LEVELS = [
  { name: "Severe",   colour: "#FF5582A6", desc: "Danger Cat 1",    match: (sig, n) => sig === "D" && n <= 1 },
  { name: "High",     colour: "#FF8A4CA6", desc: "Danger Cat 2–3",  match: (sig, n) => sig === "D" },
  { name: "Moderate", colour: "#FFB84DA6", desc: "Warning Cat 1–2", match: (sig, n) => sig === "W" && n <= 2 },
  { name: "Low",      colour: "#FFE066A6", desc: "Warning Cat 3–5", match: (sig, n) => sig === "W" },
  { name: "None",     colour: "#CACFD9A6", desc: "No signal word",  match: () => true }
];

// H-code → [GHS category, signal word]   D = Danger, W = Warning, - = none
const GHS = {
  // Physical hazards
  H200:["1","D"], H201:["1","D"], H202:["1","D"], H203:["1","D"], H204:["1","W"], H205:["1","D"],
  H206:["1","D"], H207:["2","D"], H208:["4","W"],
  H220:["1","D"], H221:["2","W"], H222:["1","D"], H223:["2","W"], H224:["1","D"], H225:["2","D"],
  H226:["3","W"], H227:["4","W"], H228:["1","D"], H229:["3","W"],
  H230:["1","D"], H231:["1","D"], H232:["1","D"],
  H240:["1","D"], H241:["1","D"], H242:["2","D"],
  H250:["1","D"], H251:["1","D"], H252:["2","W"], H260:["1","D"], H261:["2","D"],
  H270:["1","D"], H271:["1","D"], H272:["2","D"], H280:["1","W"], H281:["1","W"], H290:["1","W"],
  // Health hazards
  H300:["1-2","D"], H301:["3","D"], H302:["4","W"], H303:["5","W"], H304:["1","D"], H305:["2","W"],
  H310:["1-2","D"], H311:["3","D"], H312:["4","W"], H313:["5","W"],
  H314:["1","D"], H315:["2","W"], H316:["3","W"], H317:["1","W"], H318:["1","D"], H319:["2","W"], H320:["2","W"],
  H330:["1-2","D"], H331:["3","D"], H332:["4","W"], H333:["5","W"], H334:["1","D"], H335:["3","W"], H336:["3","W"],
  H340:["1","D"], H341:["2","W"], H350:["1","D"], H351:["2","W"], H360:["1","D"], H361:["2","W"], H362:["9","-"],
  H370:["1","D"], H371:["2","W"], H372:["1","D"], H373:["2","W"],
  // Environmental hazards
  H400:["1","W"], H401:["2","-"], H402:["3","-"], H410:["1","W"], H411:["2","-"], H412:["3","-"], H413:["4","-"],
  H420:["1","W"]
};
// ======================= END OF SETTINGS =======================

const S = Object.assign({}, DEFAULTS, input ?? {});
const SIG_RANK = { D: 0, W: 1, "-": 2 };
const here = dv.current();

// ----- Read a property ignoring capitals/spaces ("Exp. Class" = "exp. class") -----
function prop(page, name) {
  const want = name.toLowerCase().replace(/\s+/g, " ").trim();
  for (const k of Object.keys(page)) {
    if (k.toLowerCase().replace(/\s+/g, " ").trim() === want) return page[k];
  }
  return undefined;
}
function toList(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v;
  return v.array ? v.array() : [v];
}

// ----- Hide for some experiment classes -----
const classes = toList(prop(here, S.classProperty))
  .map(v => String(v).replace(/[\[\]]/g, "").trim().toLowerCase());
if (classes.some(c => S.hideForClasses.map(x => x.toLowerCase()).includes(c))) return;

// ----- Severity logic -----
function levelFor(sig, cat) {
  const n = Math.floor(parseFloat(cat));     // "1-2" counts as Cat 1
  return LEVELS.find(l => l.match(sig, n));
}
function mark(text, colour, bold) {
  return `<mark style="background:${colour}; color:#1e1e1e; ${bold ? "font-weight:bold;" : ""} padding:0 3px; border-radius:3px;">${text}</mark>`;
}
function severity(phrase) {
  const codes = String(phrase).match(/H\d{3}/g) ?? [];
  let best = { cat: "9", sig: "-", score: 999 };
  for (const c of codes) {                   // combined phrases (H300+H310) use the worst part
    const [cat, sig] = GHS[c] ?? ["9", "-"];
    const score = SIG_RANK[sig] * 100 + parseFloat(cat);
    if (score < best.score) best = { cat, sig, score };
  }
  return best;
}
const levelIndexOf = (phrase) => { const s = severity(phrase); return LEVELS.indexOf(levelFor(s.sig, s.cat)); };
function render(phrase) {
  const s = severity(phrase);
  const colour = levelFor(s.sig, s.cat).colour;
  const badge = (S.showCategoryLabels && s.cat !== "9")
    ? ` <span style="color:var(--text-muted); font-size:0.8em;">Cat ${s.cat}</span>` : "";
  if (S.highlightWholePhrase) return mark(String(phrase), colour, false) + badge;
  return String(phrase).replace(/(H\d{3}[A-Za-z]*(?:\s*\+\s*H\d{3}[A-Za-z]*)*)/, m => mark(m, colour, true) + badge);
}

// ----- Collect chemicals -----
const chemLinks = toList(prop(here, S.chemicalsProperty));
const pages = dv.pages().where(p => dv.func.contains(chemLinks, p.file.link)).array();
const foundPaths = new Set(pages.map(p => p.file.path));

const rows = pages.map(p => {
  const phrases = toList(p.H_Phrase).sort((a, b) =>
    severity(a).score - severity(b).score || String(a).localeCompare(String(b)));
  const levels = phrases.map(levelIndexOf);
  const topLevel = levels.length ? Math.min(...levels) : LEVELS.length;
  return {
    link: p.file.link,
    name: p.file.name,
    topLevel,
    topCount: levels.filter(l => l === topLevel).length,
    worst: phrases.length ? severity(phrases[0]).score : 999,
    shade: phrases.length ? LEVELS[topLevel].colour : null,
    html: phrases.length ? phrases.map(render).join("<br>")
                         : (S.showMissing ? `<span style="color:var(--text-muted)">⚠ no H_Phrase in this chemical's note</span>` : "")
  };
});

// Chemicals listed in the property that have no note yet
if (S.showMissing) {
  for (const l of chemLinks) {
    const resolved = l?.path ? app.metadataCache.getFirstLinkpathDest(l.path, here.file.path) : null;
    if (resolved && foundPaths.has(resolved.path)) continue;          // already in the table
    rows.push({ link: l, name: String(l?.path ?? l), topLevel: LEVELS.length + 1, topCount: 0, worst: 1000, shade: null,
      html: `<span style="color:var(--text-muted)">⚠ no chemical note found</span>` });
  }
}

rows.sort((a, b) => S.sortByWorstHazard
  ? a.topLevel - b.topLevel || b.topCount - a.topCount || a.worst - b.worst || a.name.localeCompare(b.name)
  : a.name.localeCompare(b.name));

// ----- Wrapper: collapsible <details> or plain -----
let target = dv.container;
if (S.collapsed) {
  const details = dv.el("details", "", { cls: "lab-hazards" });
  details.open = !!S.startOpen;
  const summary = details.createEl("summary");
  summary.style.cursor = "pointer";
  let text = "⚠️ <b>Hazards</b>";
  if (!chemLinks.length) text += ` <span style="color:var(--text-muted)">: add chemicals to the ${S.chemicalsProperty} property</span>`;
  else if (S.showSummaryCounts) {
    const counts = LEVELS.map((l, i) => ({ l, n: rows.filter(r => r.topLevel === i).length })).filter(x => x.n);
    text += ` <span style="color:var(--text-muted)">· ${rows.length} chemical${rows.length === 1 ? "" : "s"}</span> ` +
      counts.map(x => mark(`${x.l.name} ${x.n}`, x.l.colour, true)).join(" ");
  }
  summary.innerHTML = text;
  target = details.createDiv();
}
if (!rows.length) return;

// ----- Table -----
const headers = ["Chemical", "Hazard phrase"];
const values = rows.map(r => [r.link, r.html]);
try {
  await dv.api.table(headers, values, target, dv.component, dv.currentFilePath);
} catch (e) {
  await dv.table(headers, values);         // fallback for older Dataview versions
  target = dv.container;
}

// ----- Style chemical cells (centre + shade) -----
function styleChemicalCells() {
  const trs = target.querySelectorAll("table tbody tr");
  if (!trs.length) return false;
  trs.forEach((tr, i) => {
    const td = tr.querySelector("td");
    if (!td) return;
    if (S.centreChemicalCell) {
      td.style.setProperty("text-align", "center", "important");
      td.style.setProperty("vertical-align", "middle", "important");
    }
    const colour = rows[i]?.shade;
    if (S.shadeChemicalCell && colour) {
      td.style.setProperty("background-color", colour, "important");
      td.querySelectorAll("a").forEach(a => a.style.setProperty("color", "#1e1e1e", "important"));
    }
  });
  return true;
}
(function tryStyle(attempt = 0) {
  if (styleChemicalCells()) return;
  if (attempt < 20) setTimeout(() => tryStyle(attempt + 1), 100);   // keep trying for up to 2 s
})();

// ----- Legend -----
if (S.showLegend) {
  const legend = target.createDiv();
  legend.setAttribute("style", "display:flex; flex-wrap:wrap; gap:6px 12px; font-size:0.85em; margin-top:6px; align-items:flex-start;");
  legend.innerHTML = LEVELS.map(l => S.legendDetails
    ? `<span style="display:inline-flex; flex-direction:column;">${mark(l.name, l.colour, true)}<span style="color:var(--text-muted); font-size:0.85em;">${l.desc}</span></span>`
    : `<span title="${l.desc}">${mark(l.name, l.colour, true)}</span>`
  ).join("");
}
