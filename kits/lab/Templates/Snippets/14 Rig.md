---
title: Rig
icon: workflow
desc: Link the flow rig, draw its diagram, and copy its setup to the bottom of the note
group: Flow
required: rig
set:
  Rig: "[[{{rig}}]]"
  Rig snapshot: "{{rig-snapshot:rig}}"
fields:
  - key: rig
    label: Rig
    hint: the notes in your Rigs folder
    suggest: notes
    folder: rigsFolder
---

[[{{rig}}]]

!{{rig-snapshot:rig}}
*Snapshot of {{rig}}, {{rig-snapshot-date:rig}}*

{{rig-summary:rig}}
{{#append "# Flow platform setup" from rig.Setup heading}}
Rig: [[{{rig}}]]
Snapshot: {{rig-snapshot:rig}}
{{note-line:rig.Tubing}}
{{note-line:rig.Control}}

{{rig-tables:rig}}
{{/append}}
