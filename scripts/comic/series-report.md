# Frankenstein — Series Evaluation

Chapters: 1, 5, 6, 7

## Chapter 1 — Frankenstein · Chapter 1 — A Gift Called Elizabeth
- structure: ok
- panels: 15 · retention: 25.3% · verbatim lines: 15
- images: 15/15 ok, avg 22171B
- characters: alphonse, beaufort, caroline, victor, elizabeth
- cast vs bible: in sync ✓

## Chapter 5 — Frankenstein · Chapter 5 — The Creation
- structure: ok
- panels: 18 · retention: 23.5% · verbatim lines: 18
- images: 18/18 ok, avg 26372B
- characters: victor, creature, elizabeth, clerval
- cast vs bible: ⚠ DRIFT — victor (desc ≠ bible); creature (desc ≠ bible); clerval (desc ≠ bible); elizabeth (desc ≠ bible)

## Chapter 6 — Frankenstein · Chapter 6 — The Letter from Home
- structure: ok
- panels: 16 · retention: 26.0% · verbatim lines: 21
- images: 16/16 ok, avg 24759B
- characters: victor, clerval, elizabeth, justine, william, waldman, krempe
- cast vs bible: ⚠ DRIFT — victor (desc ≠ bible); clerval (desc ≠ bible); elizabeth (desc ≠ bible); justine (desc ≠ bible); william (desc ≠ bible); waldman (desc ≠ bible); krempe (desc ≠ bible)

## Chapter 7 — Frankenstein · Chapter 7 — The Storm & the Murderer
- structure: ok
- panels: 17 · retention: 24.8% · verbatim lines: 35
- images: 17/17 ok, avg 24105B
- characters: victor, clerval, elizabeth, creature, ernest, alphonse
- cast vs bible: ⚠ DRIFT — victor (desc ≠ bible); clerval (desc ≠ bible); creature (desc ≠ bible); alphonse (desc ≠ bible); ernest (desc ≠ bible); elizabeth (desc ≠ bible)

## Cross-chapter continuity
| character | bible signature | appears in |
|---|---|---|
| Victor | undefined | used:1,5,6,7 / bible:1,5,6,7 ✓ |
| the Creature | undefined | used:5,7 / bible:5,7 ✓ |
| Clerval | undefined | used:5,6,7 / bible:5,6,7 ✓ |
| Elizabeth | undefined | used:1,5,6,7 / bible:1,5,6,7 ✓ |
| Alphonse | undefined | used:1,7 / bible:1,7 ✓ |
| Ernest | undefined | used:7 / bible:7 ✓ |
| Justine | undefined | used:6 / bible:6 ✓ |
| William | undefined | used:6 / bible:6 ✓ |
| Waldman | undefined | used:6 / bible:6 ✓ |
| Krempe | undefined | used:6 / bible:6 ✓ |
| Caroline | undefined | used:1 / bible:1 ✓ |
| Beaufort | undefined | used:1 / bible:1 ✓ |

## Remediation queue (priority order)
1. ch5: cast drift (victor (desc ≠ bible), creature (desc ≠ bible), clerval (desc ≠ bible), elizabeth (desc ≠ bible)) → run --sync-cast + regen those panels
2. ch6: cast drift (victor (desc ≠ bible), clerval (desc ≠ bible), elizabeth (desc ≠ bible), justine (desc ≠ bible), william (desc ≠ bible), waldman (desc ≠ bible), krempe (desc ≠ bible)) → run --sync-cast + regen those panels
3. ch7: cast drift (victor (desc ≠ bible), clerval (desc ≠ bible), creature (desc ≠ bible), alphonse (desc ≠ bible), ernest (desc ≠ bible), elizabeth (desc ≠ bible)) → run --sync-cast + regen those panels