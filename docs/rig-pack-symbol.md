# How to draw a rig pack symbol

A **module pack** lets you replace Lab Kit's generic rig symbols with your own (your group's pump, a special mixer, an instrument). The pack lives in your vault only: it is never part of Lab Kit, so what you draw stays private. The example here is made up.

## 1. Draw one symbol as an SVG
Any drawing program that can **Save as SVG** works (Inkscape, Illustrator, Figma, draw.io Export → SVG, PowerPoint Save as picture → SVG).
- One symbol per file, tightly cropped (no big empty border), black line art on a transparent or no background. Lab Kit draws a white fill and a black line; give a shape your own `fill` / `stroke` only when you want something different.
- Keep the file small (under 200 KB) and plain: no scripts, no links to other files or web addresses, text converted to outlines. Such a file is refused; the figure then uses the generic symbol and says why.
- Note where lines should meet the symbol, measured in the drawing's own units from its **top-left corner** (with a `viewBox="0 0 40 40"` the middle of the left edge is `0,20`). A point you skip is the middle of the left edge (In), right edge (Out), top and bottom.

A PNG also works (fine on screen, soft on an A0 poster; under 300 KB; its pixel size is the picture's size). Prefer SVG.

## 2. Put it in the pack folder
Make a folder anywhere in your vault, for example `Rig pack`, and put the file in it. In the plugin settings set **Module pack folder** to that folder.

## 3. Add a line to `Pack list.md`
In the same folder make a note called exactly `Pack list.md` with one table:

```
| Kind | Match | Name | File | In | Out | Top | Bottom | Size | Enter |
|---|---|---|---|---|---|---|---|---|---|
| Mixer | | test-tee | test-tee.svg | 0,20 | 40,20 | 20,0 | | 36 | |
| Mixer | pre-mixer | test-premixer | test-premixer.svg | | | | | 90x40 | |
```

- **Kind**: the part it replaces: Pump, Mixer, Reactor, Heater, Stirrer, Regulator, Valve, Analysis, Outlet or Tubing.
- **Match** (optional): only parts whose `Type / model` text contains this word get the symbol (`pre-mixer` above). A row with a Match wins over a row without one.
- **Name**: shown in messages (and as `data-symbol` in the figure's SVG).
- **File**: the `.svg` or `.png` in the pack folder (a sub-folder is fine: `symbols/tee.svg`).
- **In / Out / Top / Bottom** (optional): connection points as `x,y`.
- **Size** (optional): width in figure units (`36`; the height follows the picture) or `90x40`. Empty: the longer side is 72 units, about the size of a generic pump.
- **Enter** (optional): `top` for a symbol that lines drop into from above, like the collection vial.

## 4. Check it
Run the command **Check module pack** (or the button next to the setting). It says, for each row, OK, missing (no such file) or unreadable (and why), and lists files in the folder that no row uses. A rig block or Figure… window with a broken pack shows one line saying what fell back to the generic symbol; the figure is still drawn.

## Good to know
- The symbol is copied into every figure, saved SVG and rig snapshot it appears in. A snapshot in an old lab note keeps its picture if you later change or remove the pack.
- Hand layout, control lines and labels work as for generic symbols. A pack Mixer is labelled under its symbol (a generic tee's label sits to its lower right).
- Parts are spaced for the generic sizes, so a very wide symbol may touch its neighbour: move it in the Figure… window.
- Share a pack with your group by copying the folder: nothing else is needed.
