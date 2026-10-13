---
kind: guide
cssclasses:
  - vt
---

```vault-card
show: back-to-hub
```

> [!info] Why a checklist
> Lab Kit can't change ZotLit's settings for you. Set these once in **Settings → ZotLit**, then tick them off. The exact setting names may differ a little between ZotLit versions.

- [ ] Zotero is running, with the Better BibTeX add-on (ZotLit's setup page says what it needs)
- [ ] **Literature note folder**: `04 Literature/ZotLit Imports`
- [ ] **Template folder**: `Extras/Templates/ZotLit` (the kit puts its three templates there: note, literature item, annotations)
- [ ] **Frontmatter**: in **Settings → ZotLit → Templates → Frontmatter** add these fields. The kit's lists, project pages and key-paper lists read them; without `kind`, `Collections` and `Zotero Tags` a paper doesn't show up where it should. The full table and what each is for are in [[Vault spec]] (Literature note)

  | Property | Expression | Merge |
  |---|---|---|
  | `citekey` | `zt.citationKey` | Replace |
  | `kind` | `"literature"` | Keep existing |
  | `Type` | `"Literature Note" \| split: ","` | Keep existing |
  | `Title` | `zt.title` | Replace |
  | `Year` | `zt.date.year` | Replace |
  | `Authors` | `zt.authors \| join: ", "` | Replace |
  | `Zotero Tags` | `zt.tags \| map: "name"` | Replace |
  | `URL` | `zt.url` | Keep existing |
  | `cssclasses` | `"vt,literature,wide" \| split: ","` | Keep existing |
  | `Collections` | `zt.collections \| collection_paths` | Replace |
  | `aliases` | `zt.title \| split: "§§"` | Append arrays |
  | `imported` | `"now" \| date: "%Y-%m-%d"` | Keep existing |

- [ ] Import one paper: the note lands in `04 Literature/ZotLit Imports` and shows on [[Literature]]
- [ ] The **Update literature note** button in a literature note fetches new annotations (needs Meta Bind and its buttons: Lab Kit → Check setup)
