<%*
// To-do roll-over - runs by itself when Obsidian starts (Settings > Templater > Startup templates).
// See Vault spec > To-do. What it does:
// 1. Watches to-dos while Obsidian is open:
//    - moving a card to another column stamps `planned` (today) and clears `rolled`
//    - ticking `done` stamps `done_on` (today) and clears `rolled`; unticking removes `done_on`
// 2. Roll-over: an unfinished card whose day has passed moves to today's column
//    (Mon at the weekend) and gets `rolled: true` (orange card).
// 3. New week: cards finished in an earlier week get `day: Done` and leave the board.
// 4. Marks today's column for vault-theme.css (blue column).
// 5. Makes the done circle on each board card clickable (Bases cards are read-only).
// 6. Marks carried-over cards with the vt-rolled class (orange in vault-theme.css).
// 7. Writes each kanban column's name into data-vt-group (on every board, not just
//    to-dos), so vault-theme.css colours columns by name. The board only draws the
//    columns on screen, so counting columns changed colour while scrolling.
// 8. Obsidian Sync safe: 2 and 3 run only on devices set to roll over (computers by
//    default, not phones), 90 seconds after startup; changes arriving from other
//    devices are not written back. See "Which devices roll cards over" below.
// It checks again every 15 minutes, so it keeps up if Obsidian stays open overnight.
// Safe to run twice: a second run replaces the first.
if (window.vtTodoEngine) { window.vtTodoEngine.stop(); }

const FOLDER = "00 Planning/To-dos/";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ymd = m => m.format("YYYY-MM-DD");
const asDate = v => moment(String(v ?? ""), "YYYY-MM-DD", true);
const isTodo = f => f && f.extension === "md" && f.path.startsWith(FOLDER);
const fmOf = f => app.metadataCache.getFileCache(f)?.frontmatter ?? {};
const snap = fm => ({ day: String(fm.day ?? ""), done: fm.done === true });
const seen = new Map(); // path -> last seen { day, done }; lets us tell a drag from our own writes

const write = (f, fn) => app.fileManager.processFrontMatter(f, fn);

// Wait until Obsidian has read every note's properties
if (!app.metadataCache.resolved) {
  await new Promise(r => {
    const ref = app.metadataCache.on("resolved", () => { app.metadataCache.offref(ref); r(); });
    setTimeout(r, 15000);
  });
}

// The date a card's day refers to: the first such weekday on or after the day it was planned
function cardDate(fm) {
  const i = DAYS.indexOf(fm.day);
  const p = asDate(fm.planned);
  if (i < 0 || !p.isValid()) { return null; }
  return p.clone().add((i + 1 - p.isoWeekday() + 7) % 7, "days");
}

const todayColumn = () => { const wd = moment().isoWeekday(); return wd <= 5 ? DAYS[wd - 1] : "Mon"; };

// A change that arrives through Obsidian Sync from another device already carries
// its stamps (done_on, planned, rolled), because that device's copy of this script
// wrote them. So write only when a stamp is actually missing or wrong: otherwise
// every device would "answer" every other device's changes (write-back loops, and
// carried-over cards losing their amber).
async function onChanged(f) {
  if (!isTodo(f)) { return; }
  const fm = fmOf(f), now = snap(fm), before = seen.get(f.path);
  seen.set(f.path, now);
  if (!before || fm.kind !== "todo") { return; } // brand-new note: the To-do template sets it up
  const today = ymd(moment());
  if (now.done !== before.done) {
    if (now.done && (fm.done_on == null || fm.rolled === true)) {
      await write(f, x => { if (x.done_on == null) { x.done_on = today; } x.rolled = false; });
    } else if (!now.done && fm.done_on != null) {
      await write(f, x => { delete x.done_on; });
    }
  } else if (now.day !== before.day) {
    // Dragged here: planned is not today yet, or a carried-over card was moved off today's column.
    // Rolled over on another device: planned is today and the card sits in today's column - leave it.
    const stale = String(fm.planned ?? "") !== today;
    const movedOffRoll = fm.rolled === true && now.day !== todayColumn();
    if (stale || movedOffRoll) {
      await write(f, x => { x.planned = today; x.rolled = false; });
    }
  }
}

// Today's column for vault-theme.css (blue). Every device does this; it writes nothing.
function markToday() {
  const wd = moment().isoWeekday();
  document.body.dataset.vtToday = wd <= 5 ? DAYS[wd - 1] : "";
}

// Which devices roll cards over and clear last week's: set per device, not synced
// (Obsidian keeps it in this device's local storage for this vault).
// Default: computers yes, phones and tablets no. To change it on a device, in the console:
//   app.saveLocalStorage("vt-rollover", "on")   or   "off"   (then restart Obsidian)
const ROLL_KEY = "vt-rollover";
const isMobile = tp.obsidian?.Platform?.isMobile ?? app.isMobile === true;
const rollsHere = () => { const v = app.loadLocalStorage(ROLL_KEY); return v ? v === "on" : !isMobile; };

async function rollOver() {
  const t = moment().startOf("day"), today = ymd(t), wd = t.isoWeekday();
  const todayCol = wd <= 5 ? DAYS[wd - 1] : "Mon";
  const weekStart = t.clone().startOf("isoWeek");
  markToday();
  let rolled = 0, cleared = 0;
  for (const f of app.vault.getMarkdownFiles().filter(isTodo)) {
    const fm = { ...fmOf(f) };
    if (fm.kind !== "todo") { continue; }
    if (fm.day === "Done" && fm.done !== true) {
      // Finished before the tick box existed: tick it, keeping the day it was finished
      const when = ymd(moment(f.stat.mtime));
      seen.set(f.path, { day: "Done", done: true });
      await write(f, x => { x.done = true; x.done_on = when; x.rolled = false; });
      continue;
    }
    if (fm.done === true) {
      const d = asDate(fm.done_on).isValid() ? asDate(fm.done_on) : moment(f.stat.mtime).startOf("day");
      if (fm.day !== "Done" && d.isBefore(weekStart)) {
        seen.set(f.path, { day: "Done", done: true });
        await write(f, x => { x.day = "Done"; if (!x.done_on) { x.done_on = ymd(d); } });
        cleared++;
      }
      continue;
    }
    if (!DAYS.includes(fm.day)) { continue; } // Backlog stays put
    if (!asDate(fm.planned).isValid()) {
      // Card from before roll-over existed: treat it as planned this week,
      // so a Mon card seen on Tuesday rolls over now instead of waiting a week
      fm.planned = ymd(weekStart);
      await write(f, x => { x.planned = ymd(weekStart); });
    }
    const due = cardDate(fm);
    if (due && due.isBefore(t)) {
      seen.set(f.path, { day: todayCol, done: false });
      await write(f, x => { x.day = todayCol; x.planned = today; x.rolled = true; });
      rolled++;
    }
  }
  if (rolled) { new Notice(`Moved ${rolled} unfinished to-do${rolled === 1 ? "" : "s"} to ${todayCol}`); }
  if (cleared) { new Notice(`Cleared ${cleared} finished to-do${cleared === 1 ? "" : "s"} from last week`); }
}

for (const f of app.vault.getMarkdownFiles().filter(isTodo)) { seen.set(f.path, snap(fmOf(f))); }
// Clicking the done circle on a board card ticks / unticks done in that note
function cardFile(card) {
  const el = card.querySelector("[data-path], [data-href]");
  const p = el && (el.getAttribute("data-path") || el.getAttribute("data-href"));
  if (p) {
    const f = app.vault.getAbstractFileByPath(p) || app.metadataCache.getFirstLinkpathDest(p, "");
    if (isTodo(f)) { return f; }
  }
  const title = card.querySelector(".mod-title .bases-kanban-card-line")?.textContent.trim();
  return app.vault.getMarkdownFiles().find(f => isTodo(f) && f.basename === title) || null;
}
const onCardClick = e => {
  const box = e.target.closest?.('.bases-view[data-view-name="Board"] .bases-kanban-card [data-property="note.done"]');
  if (!box) { return; }
  e.preventDefault(); e.stopPropagation();
  const f = cardFile(box.closest(".bases-kanban-card"));
  if (!f) { new Notice("Couldn't find this card's note - open it to tick done."); return; }
  write(f, x => { x.done = x.done !== true; }).catch(err => console.error("To-do roll-over", err));
};
window.addEventListener("click", onCardClick, true);

// Column names for the CSS: every kanban column gets data-vt-group="<its name>".
// Re-run on every redraw, because the board re-uses columns as you scroll.
// (The hidden measuring column has no name and stays untagged.)
function tagColumns() {
  for (const col of document.querySelectorAll('.bases-view[data-view-type="kanban"] .bases-kanban-column')) {
    const name = col.querySelector(".bases-group-value")?.textContent.trim() ?? "";
    if (name) { if (col.dataset.vtGroup !== name) { col.dataset.vtGroup = name; } }
    else if (col.dataset.vtGroup !== undefined) { delete col.dataset.vtGroup; }
  }
}

// Orange cards: tag every board card whose note has rolled: true
let tagQueued = false;
function tagCards() {
  tagQueued = false;
  tagColumns();
  for (const card of document.querySelectorAll('.bases-view[data-view-name="Board"] .bases-kanban-card')) {
    const f = cardFile(card);
    card.classList.toggle("vt-rolled", !!f && fmOf(f).rolled === true && fmOf(f).done !== true);
  }
}
const queueTag = () => { if (!tagQueued) { tagQueued = true; requestAnimationFrame(tagCards); } };
const inBoard = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.(".bases-view");
const observer = new MutationObserver(muts => {
  if (muts.some(m => inBoard(m.target))) { queueTag(); }
});
// characterData: a re-used column changes only its header text
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

const ref = app.metadataCache.on("changed", f => { onChanged(f).catch(e => console.error("To-do roll-over", e)); if (isTodo(f)) { queueTag(); } });
const runRollOver = () => { if (rollsHere()) { rollOver().catch(e => console.error("To-do roll-over", e)); } else { markToday(); } };
let lastRun = ymd(moment());
const timer = window.setInterval(() => {
  if (ymd(moment()) !== lastRun) { lastRun = ymd(moment()); runRollOver(); }
}, 15 * 60 * 1000);
// At startup, wait 90 seconds before rolling over, so Obsidian Sync can bring down
// changes made on other devices first (rolling over stale cards would undo them).
const startDelay = window.setTimeout(runRollOver, 90 * 1000);
window.vtTodoEngine = {
  stop() { window.clearInterval(timer); window.clearTimeout(startDelay); app.metadataCache.offref(ref); window.removeEventListener("click", onCardClick, true); observer.disconnect(); },
  run: rollOver,           // console: window.vtTodoEngine.run() rolls over now, on any device
  rollsHere
};
markToday();
queueTag();
-%>
