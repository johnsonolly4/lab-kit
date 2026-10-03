// GHS hazard-code lookup and severity levels. Ported from the v0.3 Dataview hazards script with no change in logic.

export interface Level {
  name: string;
  desc: string;
  match: (sig: string, n: number) => boolean;
}

/** Severity levels, most to least severe. Each H-code gets the first level it matches. Colours live in styles.css (`data-level`). */
export const LEVELS: Level[] = [
  { name: "Severe",   desc: "Danger Cat 1",    match: (sig, n) => sig === "D" && n <= 1 },
  { name: "High",     desc: "Danger Cat 2–3",  match: (sig) => sig === "D" },
  { name: "Moderate", desc: "Warning Cat 1–2", match: (sig, n) => sig === "W" && n <= 2 },
  { name: "Low",      desc: "Warning Cat 3–5", match: (sig) => sig === "W" },
  { name: "None",     desc: "No signal word",  match: () => true }
];

/** H-code → [GHS category, signal word]. D = Danger, W = Warning, - = none. */
export const GHS: Record<string, [string, string]> = {
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

const SIG_RANK: Record<string, number> = { D: 0, W: 1, "-": 2 };

export interface Severity { cat: string; sig: string; score: number }

/** Index into LEVELS for a signal word and category ("1-2" counts as Cat 1). */
export function levelIndex(sig: string, cat: string): number {
  const n = Math.floor(parseFloat(cat));
  return LEVELS.findIndex(l => l.match(sig, n));
}

/** Worst hazard in a phrase. Combined phrases (H300+H310) use the worst part; lower score = worse. */
export function severity(phrase: string): Severity {
  const codes = phrase.match(/H\d{3}/g) ?? [];
  let best: Severity = { cat: "9", sig: "-", score: 999 };
  for (const c of codes) {
    const [cat, sig] = GHS[c] ?? ["9", "-"];
    const score = SIG_RANK[sig] * 100 + parseFloat(cat);
    if (score < best.score) best = { cat, sig, score };
  }
  return best;
}

export function phraseLevel(phrase: string): number {
  const s = severity(phrase);
  return levelIndex(s.sig, s.cat);
}
