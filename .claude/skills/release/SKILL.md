---
name: release
description: Cut a new Lab Kit release - bump versions, build, test, changelog, tag, GitHub release with main.js/manifest.json/styles.css and the kit zip. Use when the user says "release", "ship" or "new version".
---
# Release

1. Ask the user for the version and the one-line summary. Suggest the current version in `manifest.json` if no tag exists for it yet, otherwise the next patch or minor.
2. Make sure you are on `main` and the working tree is clean, **except `STATUS.md`**: every task ends by updating it, so uncommitted changes to it are expected and go into the release commit (step 8). Any other uncommitted change, or a different branch: stop and say why.
3. `npm test` and `npm run build`. Stop on any failure.
4. Set the version everywhere it lives (skip any that already match): `npm version <version> --no-git-tag-version` (`package.json` + `package-lock.json`), `manifest.json`, and add `"<version>": "<minAppVersion from manifest.json>"` to `versions.json`.
5. `kit/kit-manifest.json`: set `version`, regenerate `files` with `npm run kit:manifest`, and set `notes` (3 bullets max).
6. `docs/changelog.md`: add a section at the top from `git log <last-tag>..HEAD --oneline` (or the whole history if there is no tag), written for the user (what changed for them, not commit names).
7. Update `STATUS.md`: version, what this release ships, and that the feedback page needs a new round. Do this before committing so it goes into the release commit and `main` stays clean afterwards.
8. Commit `Release <version>` (including `STATUS.md`), tag `<version>` (no "v" prefix, as Obsidian requires).
9. **Ask before pushing.** Then `git push && git push --tags`.
10. `npm run package` (rebuilds, then writes `dist/lab-kit-<version>/` and the zip; it fails if the manifest lists a missing file or the versions differ). Then `gh release create <version> main.js manifest.json styles.css dist/lab-kit-<version>.zip --notes-file <changelog section>` (ask first). If this step fails, say so and leave `STATUS.md` noting the release is not yet on GitHub.
