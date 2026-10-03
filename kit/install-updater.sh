#!/usr/bin/env bash
# =====================================================================
#  Lab notebook kit: one-time install of the Lab Kit plugin (updater)
# ---------------------------------------------------------------------
#  Copies the 3 plugin files from this kit folder into your vault's
#  .obsidian/plugins/lab-calc/ folder. The old plugin files are backed
#  up first. Nothing else in your vault is touched.
#
#  Run from Git Bash (or WSL):
#      bash "install-updater.sh"
#  You'll be asked for your vault folder. Windows paths are fine,
#  e.g.  C:\Users\you\Documents\My vault
# =====================================================================
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$KIT_DIR/.obsidian/plugins/lab-kit"
FILES=(main.js manifest.json styles.css)

# Convert a Windows path (C:\a\b) to the shell's form (/c/a/b or /mnt/c/a/b)
to_posix() {
  local p="$1"
  p="${p%\"}"; p="${p#\"}"                       # strip surrounding quotes
  if [[ "$p" =~ ^([A-Za-z]):[\\/](.*)$ ]]; then
    local drive="${BASH_REMATCH[1],,}" rest="${BASH_REMATCH[2]//\\//}"
    if command -v cygpath >/dev/null 2>&1; then cygpath -u "$p"
    elif [[ -d "/mnt/$drive" ]]; then echo "/mnt/$drive/$rest"
    else echo "/$drive/$rest"; fi
  else
    echo "${p//\\//}"
  fi
}

echo "Lab notebook kit: install the updater"
echo "-------------------------------------"
for f in "${FILES[@]}"; do
  [[ -f "$SRC/$f" ]] || { echo "Can't find $SRC/$f. Run this script from inside the kit folder."; exit 1; }
done

while true; do
  read -r -p "Vault folder (the one that contains .obsidian): " RAW
  [[ -z "$RAW" ]] && continue
  VAULT="$(to_posix "$RAW")"
  if [[ -d "$VAULT/.obsidian" ]]; then break; fi
  echo "  No .obsidian folder in: $VAULT"
  echo "  Pick the vault's top folder: the one you chose when you opened the vault in Obsidian."
done

DEST="$VAULT/.obsidian/plugins/lab-calc"
echo
echo "Will copy ${FILES[*]}"
echo "  from: $SRC"
echo "  to:   $DEST"
read -r -p "Go ahead? [y/N] " OK
[[ "${OK,,}" == "y" || "${OK,,}" == "yes" ]] || { echo "Cancelled, nothing changed."; exit 0; }

mkdir -p "$DEST"
if compgen -G "$DEST/*" >/dev/null; then
  BACKUP="$VAULT/Extras/kit-backups/$(date '+%Y-%m-%d %H%M') before updater install/.obsidian/plugins/lab-calc"
  mkdir -p "$BACKUP"
  cp -p "$DEST"/* "$BACKUP"/ 2>/dev/null || true
  echo "Backed up old plugin files to: $BACKUP"
fi
for f in "${FILES[@]}"; do cp "$SRC/$f" "$DEST/$f"; done

echo
echo "Done ✔  Now in Obsidian:"
echo "  1. Settings → Community plugins → turn Lab Calc off and on (it's now 'Lab Kit')"
echo "  2. Settings → Lab Kit → Check now → review the locations → Install v0.3.0"
