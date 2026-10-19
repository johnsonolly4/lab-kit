#!/usr/bin/env python3
"""One green/red check for a change: kit manifest, tests, lint (and the build with --build).

  python3 scripts/check.py            kit manifest (if kits/ changed), npm test, npm run lint
  python3 scripts/check.py --build    also npm run build (type check + production main.js)
  python3 scripts/check.py --tests tests/plan-map.test.ts   run only these test files (still lints)

Prints only what is wrong (failing tests, lint errors), then ONE summary line starting CHECK PASS or CHECK FAIL.
Exit code 0 = pass (tests green, 0 lint errors, build ok if asked). Standard library only; macOS, Windows, Linux.
"""
import argparse, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
NPM = "npm.cmd" if os.name == "nt" else "npm"
MAX_LINES = 80


def run(args):
    env = dict(os.environ, NO_COLOR="1", FORCE_COLOR="0", CI="1")
    p = subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return p.returncode, ANSI.sub("", (p.stdout or "") + (p.stderr or ""))


def git_lines(*args):
    return [l for l in run(["git", *args])[1].splitlines() if l.strip()]


def show(title, lines):
    print(f"--- {title}")
    for l in lines[:MAX_LINES]:
        print(l)
    if len(lines) > MAX_LINES:
        print(f"... {len(lines) - MAX_LINES} more lines")


def manifest():
    """Rebuild kits/*/kit-manifest.json when anything in kits/ differs from HEAD; say if the manifest changed."""
    if not git_lines("status", "--porcelain", "--", "kits/"):
        return True, "kit manifest: kits/ unchanged"
    code, out = run([NPM, "run", "kit:manifest"])
    if code != 0:
        show("npm run kit:manifest failed", out.splitlines())
        return False, "kit manifest FAILED"
    dirty = git_lines("status", "--porcelain", "--", "kits/*/kit-manifest.json")
    return True, "kit manifest: rebuilt" + (" (uncommitted, commit it with the change)" if dirty else ", no change")


def tests(files):
    code, out = run([NPM, "test", "--", *files] if files else [NPM, "test"])
    lines = out.splitlines()
    m = re.search(r"^\s*Tests\s+(.*)$", out, re.M)
    summary = m.group(1).strip() if m else "no summary (see output)"
    if code != 0:
        # vitest prints failures as "FAIL file > suite > name" followed by the assertion; keep from the first FAIL on
        start = next((i for i, l in enumerate(lines) if re.match(r"\s*(FAIL|×|❯.*\.test\.)", l)), max(0, len(lines) - MAX_LINES))
        show("failing tests", [l for l in lines[start:] if l.strip() and not l.lstrip().startswith("✓")])
    return code == 0, f"tests {summary}"


def lint():
    code, out = run([NPM, "run", "lint"])
    m = re.search(r"(\d+) problems? \((\d+) errors?, (\d+) warnings?\)", out)
    errors, warnings = (int(m.group(2)), int(m.group(3))) if m else (0 if code == 0 else -1, 0)
    if errors:
        # eslint prints the file path on its own line, then "  line:col  error  message  rule"
        keep, path = [], ""
        for l in out.splitlines():
            if l.startswith(("/", "src", "C:\\")) or re.match(r"^[A-Za-z]:\\", l):
                path = l.strip()
            elif re.search(r"\d+:\d+\s+error\s", l):
                keep.append(f"{os.path.relpath(path, ROOT) if path else ''}:{l.strip()}")
        show("lint errors", keep or out.splitlines())
    ok = code == 0 and errors == 0
    return ok, "lint " + (f"{errors} errors, {warnings} warnings" if errors >= 0 else "FAILED (no summary)")


def build():
    code, out = run([NPM, "run", "build"])
    if code != 0:
        show("build errors", [l for l in out.splitlines() if l.strip()])
    return code == 0, "build ok" if code == 0 else "build FAILED"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--build", action="store_true", help="also run npm run build")
    ap.add_argument("--tests", nargs="*", default=[], help="only these test files")
    a = ap.parse_args()
    results = [manifest(), tests(a.tests), lint()]
    if a.build:
        results.append(build())
    ok = all(r[0] for r in results)
    print(("CHECK PASS" if ok else "CHECK FAIL") + " · " + " · ".join(r[1] for r in results))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
