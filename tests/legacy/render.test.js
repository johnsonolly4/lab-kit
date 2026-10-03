const { El } = require(require("path").join(__dirname, "minidom.js"));
Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async t => { global.__clip = t; } } }, configurable: true });
const Module=require("module"); const o=Module._load;
Module._load=function(r,...a){ if(r==="obsidian") return { Plugin: class { registerEvent(){} }, MarkdownRenderer:{ render: async (app,t,el)=>{ el.innerHTML="<p>"+t+"</p>"; } }, Notice: class{}, Menu: class{}, getIcon: () => null, Modal: class{}, Setting: class{}, PluginSettingTab: class{}, Platform: {} }; return o.call(this,r,...a); };
const LabCalc = require(require("path").join(__dirname, "../../legacy/main.js"));

let fileText = "intro\n```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |\n```\n\n```calc\nname: b\n| P | Q |\n| q | 5 |\n```\n";
const file = { path: "n.md" };
const plugin = new LabCalc();
plugin.app = { vault: { getAbstractFileByPath: () => file, cachedRead: async () => fileText,
  process: async (f, fn) => { fileText = fn(fileText); } } };
(async () => {
  const el = new El("div");
  const blk = { source: "name: a\n| X | Y |\n|---|---|\n| 2 | =A2*b!B2 |" };
  const ctx = { sourcePath: "n.md", getSectionInfo: () => ({ lineStart: 1, lineEnd: 6 }) };
  const entry = { el, ctx, source: blk.source };
  await plugin.render(entry);
  const tds = [...el.querySelectorAll("tbody td")].map(t => t.textContent);
  console.log("rendered cells:", tds, "caption:", el.querySelector(".lab-calc-caption").textContent);
  if (tds[1] !== "10") throw new Error("cross-block calc failed");
  // simulate editing A2 = 3
  const parsed = require(require("path").join(__dirname, "../../legacy/main.js")).__engine.parseBlock(entry.source);
  await plugin.writeCell(entry, 1, 0, "3");
  console.log(fileText.split("\n").slice(0,7).join("\n"));
  if (!fileText.includes("| 3 | =A2*b!B2 |")) throw new Error("write-back failed");
  // grid toggle
  el.querySelectorAll(".lab-calc-btn")[1].dispatch("click"); el.querySelectorAll(".lab-calc-btn")[2].dispatch("click");
  el.querySelectorAll(".lab-calc-btn")[0].dispatch("click"); await new Promise(r=>setTimeout(r,10));
  console.log("after +Row:\n" + fileText.split("\n").slice(1,8).join("\n"));
  if (!fileText.includes("|  | =A3*b!B3 |")) throw new Error("+Row failed"); await new Promise(r=>setTimeout(r,10)); console.log("clipboard:", JSON.stringify(global.__clip));
  console.log("grid header:", [...el.querySelectorAll(".lab-calc-grid-row th")].map(t=>t.textContent).join(" "));
  console.log("Render tests passed ✔");
})().catch(e => { console.error(e); process.exit(1); });
