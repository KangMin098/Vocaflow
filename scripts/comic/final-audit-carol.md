# A Christmas Carol — FINAL ACCEPTANCE AUDIT

Manifest: 5 Staves = 5 sections · retention band ≥12% · QC bar 9.5

## Stave 1 — structure ok
- GATE-1 verbatim: error(ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt')
- panels 18 · retention 12.7% · art teen
- images: (dir not found)
- characters: scrooge, bob, fred, marley · cast in sync ✓
- QC by element — art 9~ · character 9~ · scene 9.2~ · story 9.6✓ · composition 9.6✓ (bar 9.5)
- vision-QC: (ledger not configured)

## Stave 2 — structure ok
- GATE-1 verbatim: error(ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt')
- panels 18 · retention 12.0% · art teen
- images: (dir not found)
- characters: scrooge, past, fezziwig, belle · cast in sync ✓
- QC by element — art 9.3~ · character 9.3~ · scene 9.2~ · story 9.6✓ · composition 9.6✓ (bar 9.5)
- vision-QC: (ledger not configured)

## Stave 3 — structure ok
- GATE-1 verbatim: error(ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt')
- panels 18 · retention 7.2% · art teen
- images: (dir not found)
- characters: scrooge, present, tim, bob, fred · cast DRIFT scrooge(≠bible)
- QC ledger: (none recorded)
- vision-QC: (ledger not configured)

## Stave 4 — ✗ NOT BUILT

## Stave 5 — ✗ NOT BUILT

## Cross-section continuity + cross-panel 캐릭터 일관성
| character | appears in | bible appears_in | 일관성 | |
|---|---|---|---|---|
| Scrooge | 1,2,3 | 1,2 | 9.3~ | ⚠ |
| Marley's Ghost | 1 | 1 | — | ✓ |
| Bob Cratchit | 1,3 | 1 | 9.3~ | ⚠ |
| Fred | 1,3 | 1 | 9.3~ | ⚠ |
| Ghost of Christmas Past | 2 | 2 | — | ✓ |
| Ghost of Christmas Present | 3 |  | — | ⚠ |
| Ghost of Christmas Yet to Come | — |  | — | ✓ |
| Tiny Tim | 3 |  | — | ⚠ |
| Fezziwig | 2 | 2 | — | ✓ |
| Belle | 2 | 2 | — | ✓ |

## Remediation queue (priority order)
1. [BLOCK] Stave 1: no images generated  →  _run 02-images_
2. [BLOCK] Stave 2: no images generated  →  _run 02-images_
3. [BLOCK] Stave 3: retention 7.2% < 10% hard floor  →  _add verbatim fragments_
4. [BLOCK] Stave 3: no images generated  →  _run 02-images_
5. [BLOCK] Stave 3: no per-element QC audit recorded  →  _vision-QC art/character/scene per panel → ledger_
6. [BLOCK] Stave 4: NOT BUILT  →  _author examples/carol-stave4.json → 01→02→QC→03_
7. [BLOCK] Stave 5: NOT BUILT  →  _author examples/carol-stave5.json → 01→02→QC→03_
8. [warn] Stave 1: GATE-1 could not run — ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt'  →  _check book.source/ref_
9. [warn] Stave 1 [art]: floor 9 < 9.5 (documented ceiling: p16)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
10. [warn] Stave 1 [character]: floor 9 < 9.5 (documented ceiling: p0,p17)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
11. [warn] Stave 1 [scene]: floor 9.2 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
12. [warn] Stave 2: GATE-1 could not run — ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt'  →  _check book.source/ref_
13. [warn] Stave 2 [art]: floor 9.3 < 9.5 (documented ceiling)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
14. [warn] Stave 2 [character]: floor 9.3 < 9.5 (documented ceiling: p0)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
15. [warn] Stave 2 [scene]: floor 9.2 < 9.5 (documented ceiling: p2)  →  _T1 IP-Adapter to exceed free-FLUX ceiling_
16. [warn] Stave 3: GATE-1 could not run — ENOENT: no such file or directory, open 'D:\workspace\Vocaflow\scripts\comic\scratchpad-foreign\carol\pg46.raw.txt'  →  _check book.source/ref_
17. [warn] Stave 3: cast drift scrooge(≠bible)  →  _sync cast from bible + regen_
18. [warn] scrooge: cross-panel 일관성 9.3 < 9.5 (documented ceiling)  →  _참조-only 천장 — 자가생성 시트로 캐릭터 LoRA(라이선스 0) 학습해 초과 가능_
19. [warn] scrooge: appears_in bible(1,2) ≠ used(1,2,3)  →  _reconcile appears_in_
20. [warn] bob: cross-panel 일관성 9.3 < 9.5 (documented ceiling)  →  _참조-only 천장 — 자가생성 시트로 캐릭터 LoRA(라이선스 0) 학습해 초과 가능_
21. [warn] bob: appears_in bible(1) ≠ used(1,3)  →  _reconcile appears_in_
22. [warn] fred: cross-panel 일관성 9.3 < 9.5 (documented ceiling)  →  _참조-only 천장 — 자가생성 시트로 캐릭터 LoRA(라이선스 0) 학습해 초과 가능_
23. [warn] fred: appears_in bible(1) ≠ used(1,3)  →  _reconcile appears_in_
24. [warn] present: appears_in bible() ≠ used(3)  →  _reconcile appears_in_
25. [warn] tim: appears_in bible() ≠ used(3)  →  _reconcile appears_in_

## VERDICT
- sections built: 3/5 — INCOMPLETE
- blockers: 7 · warnings: 18
- **🔴 NO-SHIP — book incomplete**