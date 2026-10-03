// Runs every legacy test (plain Node, no framework). `npm run test:legacy`
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
let failed = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js"))) {
  try { const out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" }); console.log(`✔ ${f}: ${out.trim().split("\n").pop()}`); }
  catch (e) { failed++; console.log(`✘ ${f}\n${(e.stdout || "") + (e.stderr || "")}`.split("\n").slice(-15).join("\n")); }
}
process.exit(failed ? 1 : 0);
