---
title: Rig
icon: workflow
desc: Link the flow rig, draw its diagram, and copy its setup to the bottom of the note
required: rig
set:
  Rig: "[[{{rig}}]]"
fields:
  - key: rig
    label: Rig
    hint: the notes in your Rigs folder
    suggest: notes
    folder: rigsFolder
---
[[{{rig}}]]

{{rig-diagram:rig}}
{{#append "# Flow platform setup"}}
Rig: [[{{rig}}]]
Tubing: {{note-prop:rig.Tubing}}
Control: {{note-prop:rig.Control}}

{{rig-tables:rig}}
{{/append}}
