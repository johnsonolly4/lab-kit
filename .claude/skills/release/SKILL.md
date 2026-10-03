---
name: release
description: Cut a new Lab Kit release - bump versions, build, test, changelog, tag, GitHub release with main.js/manifest.json/styles.css and the kit zip. Use when the user says "release", "ship" or "new version".
---
# Release

1. Ask the user for the version (suggest the next patch/minor) and the one-line summary.
2. Make sure the working tree is clean and on `main`. If not, stop and say why.
3. `npm test` and `npm run build`. Stop on any failure.
4. Bump the version in `manifest.json` and `package.json`, and add `"<version>": "<minAppVersion>"` to `versions.json`.
5. `kit/kit-manifest.json`: set `version`, regenerate `files` with `node scripts/kit-manifest.mjs`, and set `notes` (3 bullets max).
6. `docs/changelog.md`: add a section at the top from `git log <last-tag>..HEAD --oneline`, written for the user (what changed for them, not commit names).
7. Commit `Release <version>`, tag `<version>` (no "v" prefix, as Obsidian requires).
8. **Ask before pushing.** Then `git push && git push --tags`.
9. `npm run package` (rebuilds, then writes `dist/lab-kit-<version>/` and the zip; it fails if the manifest lists a missing file or the versions differ). Then `gh release create <version> main.js manifest.json styles.css dist/lab-kit-<version>.zip --notes-file <changelog section>` (ask first).
10. Update `STATUS.md`: version, what shipped, and that the feedback page needs a new round.
