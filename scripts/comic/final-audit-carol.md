# A Christmas Carol — FINAL ACCEPTANCE AUDIT

Manifest: 5 Staves = 5 sections · retention band ≥12% · QC bar 9.5

## Stave 1 — structure ok
- GATE-1 verbatim: PASS (64/64)
- panels 18 · retention 12.7% · art teen
- images 18/18 ok, avg 19199B
- characters: scrooge, bob, fred, marley · cast in sync ✓
- QC by element — art 9~ · character 9~ · scene 9.2~ · story 9.6✓ · composition 9.6✓ (bar 9.5)
- vision-QC: inspected · 3 high / 2 med-low open (of 5 logged)

## Stave 2 — structure ok
- GATE-1 verbatim: PASS (68/68)
- panels 18 · retention 12.0% · art teen
- images 18/18 ok, avg 19263B
- characters: scrooge, past, fezziwig, belle · cast in sync ✓
- QC by element — art 9.3~ · character 9.3~ · scene 9.2~ · story 9.6✓ · composition 9.6✓ (bar 9.5)
- vision-QC: inspected · 4 high / 3 med-low open (of 7 logged)

## Stave 3 — structure ok
- GATE-1 verbatim: PASS (55/55)
- panels 18 · retention 7.2% · art teen
- images: (dir not found)
- characters: scrooge, present, tim, bob, fred · cast in sync ✓
- QC ledger: (none recorded)
- vision-QC: (ledger not configured)

## Stave 4 — ✗ NOT BUILT

## Stave 5 — ✗ NOT BUILT

## Cross-section continuity
| character | appears in | bible appears_in | |
|---|---|---|---|
| Scrooge | 1,2,3 | 1,2 | ⚠ |
| Marley's Ghost | 1 | 1 | ✓ |
| Bob Cratchit | 1,3 | 1 | ⚠ |
| Fred | 1,3 | 1 | ⚠ |
| Ghost of Christmas Past | 2 | 2 | ✓ |
| Ghost of Christmas Present | 3 |  | ⚠ |
| Ghost of Christmas Yet to Come | — |  | ✓ |
| Tiny Tim | 3 |  | ⚠ |
| Fezziwig | 2 | 2 | ✓ |
| Belle | 2 | 2 | ✓ |

## Remediation queue (priority order)
1. [BLOCK] Stave 1 p14: OPEN high defect [style-drift,identity] — photorealistic bearded render, scene absent  →  _regenerate panel + re-inspect_
2. [BLOCK] Stave 1 p16: OPEN high defect [style-drift,identity] — photorealistic bearded render, cowering scene absent  →  _regenerate panel + re-inspect_
3. [BLOCK] Stave 1 p17: OPEN high defect [style-drift,identity] — sepia painterly, mummy-wrapped face, ambiguous gender Marley  →  _regenerate panel + re-inspect_
4. [BLOCK] Stave 2 p2: OPEN high defect [extra-object] — head-flame PLUS a handheld flaming vessel (should be empty hands)  →  _regenerate panel + re-inspect_
5. [BLOCK] Stave 2 p3: OPEN high defect [extra-object] — head-flame PLUS handheld torch/candle  →  _regenerate panel + re-inspect_
6. [BLOCK] Stave 2 p4: OPEN high defect [extra-object] — head-flame PLUS handheld candle/vessel  →  _regenerate panel + re-inspect_
7. [BLOCK] Stave 2 p9: OPEN high defect [identity] — Fezziwig drawn bearded (must be clean-shaven)  →  _regenerate panel + re-inspect_
8. [BLOCK] Stave 3: retention 7.2% < 10% hard floor  →  _add verbatim fragments_
9. [BLOCK] Stave 3: no images generated  →  _run 02-images_
10. [BLOCK] Stave 3: no per-element QC audit recorded  →  _vision-QC art/character/scene per panel → ledger_
11. [BLOCK] Stave 4: NOT BUILT  →  _author examples/carol-stave4.json → 01→02→QC→03_
12. [BLOCK] Stave 5: NOT BUILT  →  _author examples/carol-stave5.json → 01→02→QC→03_
13. [warn] Stave 1: 2 open med/low defect(s): p7,p12  →  _regenerate or accept_
14. [warn] Stave 1 [art]: floor 9 < 9.5 (documented ceiling: p16)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
15. [warn] Stave 1 [character]: floor 9 < 9.5 (documented ceiling: p0,p17)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
16. [warn] Stave 1 [scene]: floor 9.2 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
17. [warn] Stave 2: 3 open med/low defect(s): p1,p5,p12  →  _regenerate or accept_
18. [warn] Stave 2 [art]: floor 9.3 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
19. [warn] Stave 2 [character]: floor 9.3 < 9.5 (documented ceiling: p0)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
20. [warn] Stave 2 [scene]: floor 9.2 < 9.5 (documented ceiling: p2)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
21. [warn] scrooge: appears_in bible(1,2) ≠ used(1,2,3)  →  _reconcile appears_in_
22. [warn] bob: appears_in bible(1) ≠ used(1,3)  →  _reconcile appears_in_
23. [warn] fred: appears_in bible(1) ≠ used(1,3)  →  _reconcile appears_in_
24. [warn] present: appears_in bible() ≠ used(3)  →  _reconcile appears_in_
25. [warn] tim: appears_in bible() ≠ used(3)  →  _reconcile appears_in_

## VERDICT
- sections built: 3/5 — INCOMPLETE
- blockers: 12 · warnings: 13
- **🔴 NO-SHIP — book incomplete**