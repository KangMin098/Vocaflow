<!-- 생성물: node scripts/design/render-ledger.mjs docs/design/shots/learner-tines tmp/s3 tmp/s4 tmp/s5 apps/web/tmp/s3 apps/web/tmp/s4 — 손으로 고치지 말 것. 증거 파일(tmp/ · shots/)은 커밋하지 않는 로컬 보관이다. -->
# 렌더 증거 원장 (2026-10-19)

- 결과 파일 51개를 읽었다. 정상 렌더 = 기록 통과 · 로그인으로 튕기지 않음 · 오류 화면 아님.
- **학습자 91 라우트 중 정상 렌더 증거 81** (격리 화면만 1) · **CSAT 11 중 1**

| 라우트 | 렌더 | 기록 수 | 마지막 | 증거(앞 2개) |
|---|---|---|---|---|
| `/` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0-root/_report.json |
| `/play/cascade` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/connections` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/daily-blitz` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/ghost-race` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/glyph-tongue` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/letter-forge` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/lexicon-detective` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/lexicon-estate` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/lexicon-hands` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/morpheme-rules` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/morphmerge` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/pirate-quest` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/silent-rule` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/word-customs` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/word-economy` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/word-orrery` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/wordblitz` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/wordfall-cadence` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/play/wordsmith-vigil` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/login` | ✓ | 8 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/auth-after/_layout.json |
| `/reset-password` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/signup` | ✓ | 6 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/hda/_layout.json |
| `/verify-email` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/arcade` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/arcade/ranking` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/comics` | — | 0 |  |  |
| `/comics/adapted` | ✓ | 2 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/comics/adapted/[bookId]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/comics/restored` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/comics/restored/[slug]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/dashboard` | ✓ | 8 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s4/hda/_layout.json |
| `/diagnostic` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/diagnostic/history` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/dictate` | ✓ | 3 | 2026-10-19 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/dictate/results` | — | 0 |  |  |
| `/dictate/session` | 격리만 | 2 | 2026-10-19 | tmp/s4/dictation/_dictation@1440-light.json<br>tmp/s5/dictation/_dictation@1440-light.json |
| `/dictate/setup` | ✓ | 1 | 2026-10-19 | tmp/s5/setup/_report.json |
| `/flashcard` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/flashcard/play` | ✓ | 11 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/hub` | ✓ | 18 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/hub-lab` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/library` | — | 0 |  |  |
| `/library/books` | ✓ | 21 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/library/books/[bookId]` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/library/scripts` | ✓ | 2 | 2026-10-18 | tmp/s3/scope-3000/_report.json<br>tmp/s3/scope-3041/_report.json |
| `/library/scripts/[bookId]` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/library/textbooks` | ✓ | 2 | 2026-10-18 | tmp/s3/scope-3000/_report.json<br>tmp/s3/scope-3041/_report.json |
| `/library/textbooks/[series]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/library/textbooks/[series]/[step]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/library/textbooks/[series]/[step]/practice` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/library/vocab` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/my` | — | 0 |  |  |
| `/my/books` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/my/books/[bookId]` | — | 0 |  |  |
| `/my/texts` | — | 0 |  |  |
| `/my/words` | — | 0 |  |  |
| `/pairflip` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/pairflip/play` | ✓ | 3 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s3/session-check-3041/_sessions@1440.json |
| `/pairflip/results` | — | 0 |  |  |
| `/plan` | ✓ | 2 | 2026-10-19 | tmp/s5/probe/_report.json<br>tmp/s5/remaining2/_report.json |
| `/practice` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/practice/dcp` | ✓ | 2 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s4/dcp/_sessions@1440.json |
| `/practice/dcp/session` | ✓ | 2 | 2026-10-18 | tmp/s4/sessions-final/_sessions@1440.json |
| `/reports` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/scriptquiz` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/scriptquiz/play` | ✓ | 4 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s3/session-check-3000/_sessions@1440.json |
| `/settings` | ✓ | 2 | 2026-10-18 | tmp/s4/hds-post/_report.json<br>tmp/s4/hds-pre/_report.json |
| `/sitemap` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/spellforge` | ✓ | 2 | 2026-10-18 | tmp/s3/scope2-3000/_report.json<br>tmp/s3/scope2-3041/_report.json |
| `/spellforge/play` | ✓ | 3 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json<br>tmp/s4/session-3041/_sessions@1440.json |
| `/teacher` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/text` | ✓ | 5 | 2026-10-19 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s5/remaining2/_report.json |
| `/text/new` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/text/[id]` | ✓ | 25 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2/_overlays.json |
| `/text/[id]/comic` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/text/[id]/echo` | ✓ | 1 | 2026-10-18 | tmp/s3/session-before/_sessions@1440.json |
| `/wordblitz` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/wordvault` | ✓ | 19 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>docs/design/shots/learner-tines/s2-after/_report.json |
| `/wordvault/browse` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/wordvault/review` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s3/session-before/_sessions@1440.json |
| `/wordvault/study` | ✓ | 7 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json<br>tmp/s3/session-before/_sessions@1440.json |
| `/about` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/fit` | ✓ | 4 | 2026-10-18 | docs/design/shots/learner-tines/s0/_report.json |
| `/fit/s/[payload]` | — | 0 |  |  |
| `/join/[code]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/pricing` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/privacy` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/terms` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/video` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |
| `/video/[id]` | ✓ | 1 | 2026-10-19 | tmp/s5/remaining2/_report.json |

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
