---
title: RAFT recipe generator (the built-in block as a definition; test fixture for Phase C4)
fields:
  - key: monomers
    label: Monomer(s)
    type: list
    weights: fraction
    suggest: chemicals
    wide: true
  - key: cta
    label: CTA / macro-CTA
    suggest: chemicals
  - key: initiator
    label: Initiator
    suggest: chemicals
  - key: solvent
    label: Solvent
    suggest: chemicals
  - key: cosolvent
    label: Co-solvent
    suggest: chemicals
  - key: cosolvent-pct
    label: Co-solvent (% of the solvent's mass)
    type: number
    unit: "%"
    when: cosolvent
    value: "20"
  - key: monomer-mass
    label: Total monomer mass
    type: number
    unit: g
  - key: DP
    label: Target DP
    type: number
  - key: CTA-to-initiator
    label: "CTA : initiator"
    type: number
    value: "20"
  - key: solids
    label: Solids (% w/w)
    type: number
    unit: "%"
    value: "20"
---
```lk-definition
format: 1
name: raft
layout: list
status: weighed
title: 'RAFT: P({{#each monomers | "-co-"}}{{name}}{{/each}}), DP {{= dp}}'
summary: '{{= monomer_mass | mass2}} · DP {{= dp}} · {{cta}} · Mn {{= mn | number: 0 | group | unit: g/mol}}'
values:
  mean_mw: SUMPRODUCT(monomers.mw, monomers.fraction) / SUM(monomers.fraction)
  n_monomer: monomer_mass / mean_mw
  n_cta: n_monomer / dp
  n_init: n_cta / cta_to_initiator
  solids_g: SUM(monomers.target) + cta.target + initiator.target
  solvent_g: solids_g * (100 / solids - 1)
  mn: dp * mean_mw + cta.mw
rows:
  - each: monomers
    role: monomer
    lookup: { mw: MW }
    mol: n_monomer * fraction / SUM(monomers.fraction)
    target: mol * mw
    sub: 'monomer · {{= mol | mol}}'
  - id: cta
    name: '{{cta}}'
    role: CTA
    lookup: { mw: MW }
    mol: n_cta
    target: mol * mw
  - id: solvent
    name: '{{solvent}}'
    target: solvent_g
  - id: cosolvent
    name: '{{cosolvent}}'
    when: cosolvent
    target: solvent_g * cosolvent_pct / 100
  - id: initiator
    name: '{{initiator}}'
    role: initiator
    lookup: { mw: MW }
    mol: n_init
    target: mol * mw
live:
  - when: weighed > 0
    label: "Mn from what you've weighed:"
    value: SUM(monomers.amount) / (cta.amount / cta.mw) + cta.mw
    format: { number: 0, group: true, unit: g/mol }
worked:
  - when: COUNT(monomers) = 1
    each: monomers
    text: '{{= monomer_mass | mass}} ÷ {{= mw | mw | unit: g/mol}} = {{= mol | mol}}'
  - when: COUNT(monomers) > 1
    label: Monomers
    text: 'mean MW = ({{#each monomers | " + "}}{{= mw | mw | unit: g/mol}} × {{= fraction}}{{/each}}) ÷ {{= SUM(monomers.fraction)}} = {{= mean_mw | mw | unit: g/mol}}; {{= monomer_mass | mass}} ÷ {{= mean_mw | mw | unit: g/mol}} = {{= n_monomer | mol}}'
  - when: COUNT(monomers) > 1
    each: monomers
    text: '{{= n_monomer | mol}} × {{= fraction}}/{{= SUM(monomers.fraction)}} = {{= mol | mol}} × {{= mw | mw | unit: g/mol}} = {{= target | mass}}'
  - label: '{{cta}}'
    text: '{{= n_monomer | mol}} ÷ {{= dp}} = {{= cta.mol | mol}} × {{= cta.mw | mw | unit: g/mol}} = {{= cta.target | mass}}'
  - label: '{{initiator}}'
    text: '{{= n_cta | mol}} ÷ {{= cta_to_initiator}} = {{= initiator.mol | mol}} × {{= initiator.mw | mw | unit: g/mol}} = {{= initiator.target | mass}}'
  - label: '{{solvent}}'
    text: '{{= solids_g | mass}} solids × (100 ÷ {{= solids}} − 1) = {{= solvent.target | mass}}'
  - when: cosolvent
    label: '{{cosolvent}}'
    text: '{{= solvent_g | mass}} × {{= cosolvent_pct}} % = {{= cosolvent.target | mass}}'
  - label: Mn
    text: '{{= dp}} × {{= mean_mw | mw | unit: g/mol}} + {{= cta.mw | mw | unit: g/mol}} = {{= mn | number: 2}} g/mol'
```
