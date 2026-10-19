<!-- 생성물: node scripts/design/render-ledger.mjs docs/design/shots/learner-tines tmp/s3 tmp/s4 apps/web/tmp/s3 apps/web/tmp/s4 — 손으로 고치지 말 것. 증거 파일(tmp/ · shots/)은 커밋하지 않는 로컬 보관이다. -->
# 렌더 증거 원장 (2026-10-18)

- 결과 파일 46개를 읽었다. 정상 렌더 = 기록 통과 · 로그인으로 튕기지 않음 · 오류 화면 아님.
- **학습자 91 라우트 중 정상 렌더 증거 30** (격리 화면만 1) · **CSAT 11 중 1**

| 라우트 | 렌더 | 기록 수 | 마지막 | 증거(앞 2개) |
|---|---|---|---|---|
| `/` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0-root/_report.json |
| `/play/cascade` | — | 0 |  |  |
| `/play/connections` | — | 0 |  |  |
| `/play/daily-blitz` | — | 0 |  |  |
| `/play/ghost-race` | — | 0 |  |  |
| `/play/glyph-tongue` | — | 0 |  |  |
| `/play/letter-forge` | — | 0 |  |  |
| `/play/lexicon-detective` | — | 0 |  |  |
| `/play/lexicon-estate` | — | 0 |  |  |
| `/play/lexicon-hands` | — | 0 |  |  |
| `/play/morpheme-rules` | — | 0 |  |  |
| `/play/morphmerge` | — | 0 |  |  |
| `/play/pirate-quest` | — | 0 |  |  |
| `/play/silent-rule` | — | 0 |  |  |
| `/play/word-customs` | — | 0 |  |  |
| `/play/word-economy` | — | 0 |  |  |
| `/play/word-orrery` | — | 0 |  |  |
| `/play/wordblitz` | — | 0 |  |  |
| `/play/wordfall-cadence` | — | 0 |  |  |
| `/play/wordsmith-vigil` | — | 0 |  |  |
| `/login` | ✓ | 8 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/auth-after/_layout.json |
| `/reset-password` | — | 0 |  |  |
| `/signup` | ✓ | 6 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/hda/_layout.json |
| `/verify-email` | — | 0 |  |  |
| `/arcade` | — | 0 |  |  |
| `/arcade/ranking` | — | 0 |  |  |
| `/comics` | — | 0 |  |  |
| `/comics/adapted` | — | 0 |  |  |
| `/comics/adapted/[bookId]` | — | 0 |  |  |
| `/comics/restored` | — | 0 |  |  |
| `/comics/restored/[slug]` | — | 0 |  |  |
| `/dashboard` | ✓ | 8 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/hda/_layout.json |
| `/diagnostic` | — | 0 |  |  |
| `/diagnostic/history` | — | 0 |  |  |
| `/dictate` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/dictate/results` | — | 0 |  |  |
| `/dictate/session` | 격리만 | 1 | 2026-10-18 | tmp/s4/dictation/_dictation@1440-light.json |
| `/dictate/setup` | — | 0 |  |  |
| `/flashcard` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/flashcard/play` | ✓ | 11 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/hub` | ✓ | 18 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/hub-lab` | — | 0 |  |  |
| `/library` | — | 0 |  |  |
| `/library/books` | ✓ | 21 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/library/books/[bookId]` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/library/scripts` | ✓ | 2 | 2026-10-18 | tmp/s3/scope-3000/_report.json<br>tmp/s3/scope-3041/_report.json |
| `/library/scripts/[bookId]` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/library/textbooks` | ✓ | 2 | 2026-10-18 | tmp/s3/scope-3000/_report.json<br>tmp/s3/scope-3041/_report.json |
| `/library/textbooks/[series]` | — | 0 |  |  |
| `/library/textbooks/[series]/[step]` | — | 0 |  |  |
| `/library/textbooks/[series]/[step]/practice` | — | 0 |  |  |
| `/library/vocab` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/my` | — | 0 |  |  |
| `/my/books` | — | 0 |  |  |
| `/my/books/[bookId]` | — | 0 |  |  |
| `/my/texts` | — | 0 |  |  |
| `/my/words` | — | 0 |  |  |
| `/pairflip` | — | 0 |  |  |
| `/pairflip/play` | ✓ | 3 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s3/session-check-3041/_sessions@1440.json |
| `/pairflip/results` | — | 0 |  |  |
| `/plan` | — | 0 |  |  |
| `/practice` | — | 0 |  |  |
| `/practice/dcp` | ✓ | 2 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s4/dcp/_sessions@1440.json |
| `/practice/dcp/session` | ✓ | 2 | 2026-10-18 | tmp/s4/sessions-final/_sessions@1440.json |
| `/reports` | — | 0 |  |  |
| `/scriptquiz` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/scriptquiz/play` | ✓ | 4 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s3/session-check-3000/_sessions@1440.json |
| `/settings` | ✓ | 2 | 2026-10-18 | tmp/s4/hds-post/_report.json<br>tmp/s4/hds-pre/_report.json |
| `/sitemap` | — | 0 |  |  |
| `/spellforge` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/spellforge/play` | ✓ | 3 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s4/session-3041/_sessions@1440.json |
| `/teacher` | — | 0 |  |  |
| `/text` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/text/new` | — | 0 |  |  |
| `/text/[id]` | ✓ | 25 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/text/[id]/comic` | — | 0 |  |  |
| `/text/[id]/echo` | ✓ | 1 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json |
| `/wordblitz` | — | 0 |  |  |
| `/wordvault` | ✓ | 19 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2-after/_report.json |
| `/wordvault/browse` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/wordvault/review` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s3/session-before/_sessions@1440.json |
| `/wordvault/study` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s3/session-before/_sessions@1440.json |
| `/about` | — | 0 |  |  |
| `/fit` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/fit/s/[payload]` | — | 0 |  |  |
| `/join/[code]` | — | 0 |  |  |
| `/pricing` | — | 0 |  |  |
| `/privacy` | — | 0 |  |  |
| `/terms` | — | 0 |  |  |
| `/video` | — | 0 |  |  |
| `/video/[id]` | — | 0 |  |  |

### CSAT(3B 유지 — 경계 확인용)

| 라우트 | 렌더 | 기록 수 | 마지막 | 증거(앞 2개) |
|---|---|---|---|---|
| `/csat` | ✓ | 10 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2-after/_report.json |
| `/csat/browse` | — | 0 |  |  |
| `/csat/diagnosis` | — | 0 |  |  |
| `/csat/diagnosis/attempts/new` | — | 0 |  |  |
| `/csat/dissect` | — | 0 |  |  |
| `/csat/formulas` | — | 0 |  |  |
| `/csat/item/[slug]` | — | 0 |  |  |
| `/csat/practice` | — | 0 |  |  |
| `/csat/practice/[slug]` | — | 0 |  |  |
| `/csat/record` | — | 0 |  |  |
| `/csat/space` | — | 0 |  |  |
