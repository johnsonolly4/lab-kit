// Rig figure: the generic part symbols, drawn from scratch as plain line art. Pure (no Obsidian runtime).
// Plan: docs/plans/rig-figure.md, Phase 2. A module pack (Phase 6) will supply symbols of the same shape.
import type { PartKind } from "./parts";
import { packSymbol, type Pack } from "./packs";

export interface Point { x: number; y: number }
/** A symbol: `body` is SVG in local coordinates centred on (0, 0) (black line art; the writer sets stroke and fill). The four points are where lines meet it. */
export interface RigSymbol {
  name: string; w: number; h: number; body: string; in: Point; out: Point; top: Point; bottom: Point;
  /** Where the incoming line meets the symbol: "side" (default) or from above, into an open mouth (a collection vial). */
  enter?: "top";
}

const make = (name: string, w: number, h: number, body: string, at: { in?: Point; out?: Point; top?: Point; bottom?: Point } = {}, enter?: "top"): RigSymbol => ({
  name, w, h, body, ...(enter ? { enter } : {}),
  in: at.in ?? { x: -w / 2, y: 0 }, out: at.out ?? { x: w / 2, y: 0 },
  top: at.top ?? { x: 0, y: -h / 2 }, bottom: at.bottom ?? { x: 0, y: h / 2 },
});

const box = make("box", 72, 44, `<rect x="-36" y="-22" width="72" height="44" rx="6"/>`);
const SYMBOLS: Record<string, RigSymbol> = {
  box,
  pump: make("pump", 52, 52, `<circle r="26"/><path d="M-13 -22.5 L26 0 L-13 22.5"/>`),
  syringe: make("syringe", 72, 22, `<rect x="-22" y="-10" width="36" height="20" rx="2"/><path d="M-36 -9 L-36 9 M-36 0 L-22 0 M14 0 L36 0 M-14 -10 L-14 10" fill="none"/>`),
  tee: make("tee", 14, 14, `<circle r="7" fill="#000000"/>`, { in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }),
  valve: make("valve", 40, 32, `<path d="M-20 -16 L20 16 L20 -16 L-20 16 Z"/>`),
  regulator: make("regulator", 60, 44, `<rect x="-30" y="-22" width="60" height="44" rx="6"/><path d="M-16 -12 L16 12 L16 -12 L-16 12 Z"/>`),
  column: make("column", 96, 22, `<rect x="-48" y="-11" width="96" height="22" rx="8"/>`),
  coil: make("coil", 84, 44, `<rect x="-42" y="-22" width="84" height="44" rx="10"/><path d="M-22 -22 L-14 22 M-10 -22 L-2 22 M2 -22 L10 22 M14 -22 L22 22"/>`),
  flask: make("flask", 52, 70, `<circle r="24"/><path d="M-7 -35 L-7 -21 M7 -35 L7 -21 M-9 -35 L9 -35"/>`, { bottom: { x: 0, y: 24 } }),
  hotplate: make("hotplate", 68, 22, `<rect x="-34" y="-5" width="68" height="16" rx="3"/><path d="M-20 -11 L-20 -5 M20 -11 L20 -5"/>`, { in: { x: -34, y: 3 }, out: { x: 34, y: 3 }, top: { x: 0, y: -11 }, bottom: { x: 0, y: 11 } }),
  oven: make("oven", 124, 50, `<rect x="-62" y="-25" width="124" height="50" rx="8"/>`),
  analysis: make("analysis", 72, 44, `<rect x="-36" y="-22" width="72" height="44" rx="6"/><path d="M-24 9 L-12 9 L-6 -9 L0 9 L7 9 L12 -3 L24 9" fill="none"/>`),
  waste: make("waste", 64, 24, `<path d="M-32 0 L16 0" fill="none"/><path d="M12 -9 L32 0 L12 9 Z" fill="#000000"/>`),
  // The line level (y 0) is above the vial's mouth, so a line can run level and drop straight in. The box is therefore taller than the glass, centred on the line level.
  vial: make("vial", 30, 136, `<path d="M-15 16 L-15 60 Q-15 68 -7 68 L7 68 Q15 68 15 60 L15 16 M-19 16 L19 16" fill="none"/>`, { in: { x: 0, y: 16 }, out: { x: 15, y: 42 }, top: { x: 0, y: 16 }, bottom: { x: 0, y: 68 } }, "top"),
  tubing: make("tubing", 64, 10, `<rect x="-32" y="-5" width="64" height="10" rx="5"/>`),
};
/** The computer that sets and reads the rig: a monitor on a stand over a keyboard. Not a part kind, so not in the table above. */
export const COMPUTER: RigSymbol = make("computer", 72, 70,
  `<rect x="-30" y="-35" width="60" height="40" rx="3"/><rect x="-25" y="-30" width="50" height="30"/><path d="M-6 5 L-8 14 L8 14 L6 5"/><path d="M-34 33 L-26 17 L26 17 L34 33 Z"/><path d="M-18 25 L18 25"/>`);
/** A heater drawn around its host (a column oven or a jacket): an outline a little larger than the host, with the same centre. */
export function ovenAround(host: RigSymbol): RigSymbol {
  const w = host.w + 28, h = host.h + 24;
  return make("oven", w, h, `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="8"/>`);
}
/** The names of the generic symbols, for tests. */
export const SYMBOL_NAMES = Object.keys(SYMBOLS);

/** Keyword tests on the lower-cased detail that pick a symbol for a Pump, a Heater, a Reactor or an Outlet; the first match wins. */
const REACTOR_BY_DETAIL: [RegExp, string][] = [
  [/vessel|flask|batch|rbf|round.?bottom/, "flask"],
  [/column|packed|bed|beads/, "column"],
  [/chip|cstr|plate/, "box"],
];
const PUMP_BY_DETAIL: [RegExp, string][] = [[/syringe/, "syringe"]];
const HEATER_BY_DETAIL: [RegExp, string][] = [[/oven|jacket/, "oven"]];
const OUTLET_BY_DETAIL: [RegExp, string][] = [[/waste/, "waste"]];

/** The symbol for a part: the module pack's, when the pack has one for it, else the generic one. A kind that is not known gets the plain box (the writer lists such parts as missing). */
export function symbolFor(kind: PartKind | "", detail: string, pack?: Pack | null): RigSymbol {
  const mine = packSymbol(pack, kind, detail);
  if (mine) return mine;
  const d = detail.toLowerCase();
  const by = (table: [RegExp, string][], fallback: string): RigSymbol => SYMBOLS[table.find(([re]) => re.test(d))?.[1] ?? fallback];
  switch (kind) {
    case "Pump": return by(PUMP_BY_DETAIL, "pump");
    case "Mixer": return SYMBOLS.tee;
    case "Valve": return SYMBOLS.valve;
    case "Regulator": return SYMBOLS.regulator;
    case "Reactor": return by(REACTOR_BY_DETAIL, "coil");
    case "Heater": return by(HEATER_BY_DETAIL, "hotplate");
    case "Stirrer": return SYMBOLS.hotplate;
    case "Analysis": return SYMBOLS.analysis;
    case "Outlet": return by(OUTLET_BY_DETAIL, "vial");
    case "Tubing": return SYMBOLS.tubing;
    default: return box;
  }
}
