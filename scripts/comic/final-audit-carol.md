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
- images 18/18 ok, avg 19632B
- characters: scrooge, past, fezziwig, belle · cast in sync ✓
- QC by element — art 9.3~ · character 9.3~ · scene 9.2~ · story 9.6✓ · composition 9.6✓ (bar 9.5)

## Stave 3 — ✗ NOT BUILT

## Stave 4 — ✗ NOT BUILT

## Stave 5 — ✗ NOT BUILT

## Cross-section continuity
| character | appears in | bible appears_in | |
|---|---|---|---|
| Scrooge | 1,2 | 1,2 | ✓ |
| Marley's Ghost | 1 | 1 | ✓ |
| Bob Cratchit | 1 | 1 | ✓ |
| Fred | 1 | 1 | ✓ |
| Ghost of Christmas Past | 2 | 2 | ✓ |
| Ghost of Christmas Present | — |  | ✓ |
| Ghost of Christmas Yet to Come | — |  | ✓ |
| Tiny Tim | — |  | ✓ |
| Fezziwig | 2 | 2 | ✓ |
| Belle | 2 | 2 | ✓ |

## Remediation queue (priority order)
1. [BLOCK] Stave 3: NOT BUILT  →  _author examples/carol-stave3.json → 01→02→QC→03_
2. [BLOCK] Stave 4: NOT BUILT  →  _author examples/carol-stave4.json → 01→02→QC→03_
3. [BLOCK] Stave 5: NOT BUILT  →  _author examples/carol-stave5.json → 01→02→QC→03_
4. [warn] Stave 1: 7 multi-subject panel(s) vs single-subject rule (61% single) — identity risk: 5,6,7,15,16,17,18  →  _re-stage as single-subject (shot/reverse-shot) unless a justified OTS/symbolic/crowd shot_
5. [warn] Stave 1 [art]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
6. [warn] Stave 1 [character]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
7. [warn] Stave 1 [scene]: floor 9 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
8. [warn] Stave 2 [art]: floor 9.3 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
9. [warn] Stave 2 [character]: floor 9.3 < 9.5 (documented ceiling: p0)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
10. [warn] Stave 2 [scene]: floor 9.2 < 9.5 (documented ceiling: p2)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_

## VERDICT
- sections built: 2/5 — INCOMPLETE
- blockers: 3 · warnings: 7
- **🔴 NO-SHIP — book incomplete**