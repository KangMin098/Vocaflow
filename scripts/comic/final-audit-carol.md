# A Christmas Carol — FINAL ACCEPTANCE AUDIT

Manifest: 5 Staves = 5 sections · retention band ≥12% · QC bar 9.5

## Stave 1 — structure ok
- GATE-1 verbatim: PASS (64/64)
- panels 18 · retention 12.7% · art teen
- images 18/18 ok, avg 21532B
- characters: scrooge, bob, fred, marley · cast in sync ✓
- QC by element — art 9~ · character 9~ · scene 9~ · story 9.6✓ · composition 9.6✓ (bar 9.5)

## Stave 2 — structure ok
- GATE-1 verbatim: PASS (68/68)
- panels 18 · retention 12.0% · art teen
- images 18/18 ok, avg 20581B
- characters: scrooge, past, fezziwig, belle · cast in sync ✓
- QC by element — art 9.2~ · character 9~ · scene 9.1~ · story 9.6✓ · composition 9.6✓ (bar 9.5)

## Stave 3 — ✗ NOT BUILT

## Stave 4 — ✗ NOT BUILT

## Stave 5 — ✗ NOT BUILT

## Cross-section continuity
| character | appears in | bible appears_in | |
|---|---|---|---|
| Scrooge | 1,2 | 1 | ⚠ |
| Marley's Ghost | 1 | 1 | ✓ |
| Bob Cratchit | 1 | 1 | ✓ |
| Fred | 1 | 1 | ✓ |
| Ghost of Christmas Past | 2 |  | ⚠ |
| Ghost of Christmas Present | — |  | ✓ |
| Ghost of Christmas Yet to Come | — |  | ✓ |
| Tiny Tim | — |  | ✓ |
| Fezziwig | 2 |  | ⚠ |
| Belle | 2 |  | ⚠ |

> --remediate: reconciled appears_in for 4 characters

## Remediation queue (priority order)
1. [BLOCK] Stave 3: NOT BUILT  →  _author examples/carol-stave3.json → 01→02→QC→03_
2. [BLOCK] Stave 4: NOT BUILT  →  _author examples/carol-stave4.json → 01→02→QC→03_
3. [BLOCK] Stave 5: NOT BUILT  →  _author examples/carol-stave5.json → 01→02→QC→03_
4. [warn] Stave 1 [art]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
5. [warn] Stave 1 [character]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
6. [warn] Stave 1 [scene]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
7. [warn] Stave 2 [art]: floor 9.2 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
8. [warn] Stave 2 [character]: floor 9 < 9.5 (documented ceiling: p11,p16,p2,p3)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
9. [warn] Stave 2 [scene]: floor 9.1 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
10. [warn] scrooge: appears_in bible(1) ≠ used(1,2)  →  _reconcile appears_in_
11. [warn] past: appears_in bible() ≠ used(2)  →  _reconcile appears_in_
12. [warn] fezziwig: appears_in bible() ≠ used(2)  →  _reconcile appears_in_
13. [warn] belle: appears_in bible() ≠ used(2)  →  _reconcile appears_in_

## VERDICT
- sections built: 2/5 — INCOMPLETE
- blockers: 3 · warnings: 10
- **🔴 NO-SHIP — book incomplete**