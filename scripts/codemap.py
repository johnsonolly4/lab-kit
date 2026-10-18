#!/usr/bin/env python3
"""Print a short map of code files: each function (and class) with its line number, so a session can read
only the lines it needs (sed -n 'A,Bp') instead of grepping and reading whole files.

  python3 scripts/codemap.py src/kit/tidy.ts            one file
  python3 scripts/codemap.py src                                every .js/.py/.html file under a folder (tests left out)
  python3 scripts/codemap.py styles.css --grep vt-map     only names containing a word
  python3 scripts/codemap.py src --tests                 include test files

Standard library only.
"""
import argparse, os, re, sys

PY = re.compile(r"^(\s*)(?:async\s+)?(def|class)\s+(\w+)")
JS = [re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)\s*\("),
      re.compile(r"^\s*(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)"),
      re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:async\s+)?\(.*\)\s*(?::[^=]+)?=>"),
      re.compile(r"^\s{2}(?:private\s+|public\s+|protected\s+|static\s+|async\s+)*([\w$]+)\s*(?:<[^>]*>)?\([^)]*\)?[^;=]*\{\s*$"),
      re.compile(r"^\s*(?:export\s+)?(?:interface|type)\s+([\w$]+)"),
      re.compile(r"^\s{0,6}([\w$]+)\s*:\s*(?:async\s+)?function\b"),
      re.compile(r"^\s*class\s+([\w$]+)")]
CSS = re.compile(r"^([^\s@/}*][^{]*)\{")
EXT = (".py", ".js", ".mjs", ".ts", ".html", ".css")


def names(path):
    out, i = [], 0
    with open(path, encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f, 1):
            if path.endswith(".css"):
                m = CSS.match(line)
                if m:
                    out.append((i, m.group(1).strip()[:60]))
            elif path.endswith(".py"):
                m = PY.match(line)
                if m and len(m.group(1)) <= 4:          # top level and methods, not nested helpers
                    out.append((i, ("class " if m.group(2) == "class" else "") + m.group(3)))
            else:
                for rx in JS:
                    m = rx.match(line)
                    if m and len(line) - len(line.lstrip()) <= 6:
                        out.append((i, m.group(1)))
                        break
    return out, i


def files(paths, tests):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, fs in os.walk(p):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d != "node_modules" and (tests or d != "test"))
            for f in sorted(fs):
                if f.endswith(EXT) and not f.endswith(".min.js") and (tests or ".test." not in f):
                    yield os.path.join(root, f)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--grep", help="only names containing this (any case)")
    ap.add_argument("--tests", action="store_true")
    a = ap.parse_args()
    for f in files(a.paths, a.tests):
        ns, total = names(f)
        if a.grep:
            ns = [n for n in ns if a.grep.lower() in n[1].lower()]
            if not ns:
                continue
        print("%s (%d lines): %s" % (f, total, ", ".join("%s %d" % (n, i) for i, n in ns) or "-"))


if __name__ == "__main__":
    main()
