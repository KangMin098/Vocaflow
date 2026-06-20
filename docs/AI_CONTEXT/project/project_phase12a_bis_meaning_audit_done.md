> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_phase12a_bis_meaning_audit_done.md
> category: project

---

Phase 12-A-bis full audit complete 2026-05-25 — V≥5 ∧ frequency_rank<3000 ∧ meanings_ko 단일 sense (634 candidates) 전수 검토.

**Subagent fan-out**: 3 parallel chunks (~211 row each) via Claude Code subagents → 311 fixes proposed (49.1% fix rate, 323 skipped as already accurate Sino-Korean direct mapping or sufficient single sense).

**Applied migrations**:
- `phase_12a_bis_meaning_audit_p1` (100 row, rank 436-1955)
- `phase_12a_bis_meaning_audit_p2` (100 row, rank 1956-2434)
- `phase_12a_bis_meaning_audit_p3` (111 row, rank 2434-2991)
- `phase_12a_spot_fix_unlike` (1 row, trigger word — preposition primary "~와 달리" 추가)

**Phase 12 누적 (12-A + spot-fix + 12-A-bis)**: 182 + 1 + 311 = **494 row** in shared_dictionary 의미 정합 정정.

**주요 fix 카테고리**:
- **Multi-POS 통합**: firm(noun+adj+verb), senior(adj+noun), prime(adj+n+v), classic(adj+n), chemical/criminal/musical/commercial/electric/intellectual/dynamic adj↔noun pair, client(고객+컴퓨터 클라이언트), wire(n+v 배선/송금), wound(n+v+wind 과거), motor(모터+자동차+adj)
- **Verb 누락** (noun-primary에 동사 추가): manufacture, reform, ban, protest, command, defeat, purchase, aim, contrast, harm, curve, bend, edit, seal, sponsor, burden, exit, lease, fence, hint, panic, slope, chase, rat, substitute, divorce, ruin
- **Missing primary sense**: port(항구+포트와인), regime(체제+식이요법), vice(악덕+부-(직위)), meter(계량기+운율), grand(웅장한+천달러), coin(동전+(말을)만들어내다), flash(verb senses + noun 섬광/플래시), snap(4-pos 정리), bless+blessing 종교/세속 sense
- **V-level downgrade** (pure semantic 일상어): committee V5→V4, warn V5→V4, amaze V5→V4, gap V5→V4, victory V5→V4, advise V5→V4, outcome V6→V5, reputation V6→V5, politician V5→V4, abandoned V6→V5, bury V6→V5, biased V6→V5, celebration V5→V4, friendship V5→V4, throat V5→V4, joy V5→V4, reliable V5→V4, poetry V5→V4, mystery V5→V4, happiness V5→V4, departure V5→V4, golden V5→V4, athlete V5→V4, darkness V5→V4, cheek V5→V4
- **CEFR 보정** (A2/B1 적정화): silent A2, wise A2, gentle A2, pretend A2, hesitate A2, friendship A2, joy A2, throat A2, mystery A2, golden A2, weekly A2, monthly A2, cheek A2, happiness A2
- **영국/미국/짝 동기화**: labor/labour, disc/disk, bias/biased, stimulate/stimulating(skip), fulfilling/fulfilled(skip), restrict/restricted, isolate/isolated, abandon/abandoned, curve/curved, broadcasting/broadcast(verb 우선), spin/spinning(skip)
- **(트리거) unlike**: SNS slang only → preposition primary "~와 달리" + adjective "~와는 다른" + verb (SNS), V6→V4, pos verb→preposition

**SET 절**: pos, meanings_ko, meaning_ko, v_level, cefr_level (track/domain/skill 미변경 — semantic audit only).

**Pending tasks**:
- Phase 12-B 확장 후보 (V≥5 ∧ rank≥3000) — 약 500+ row 예상, 다음 세션
- Round 11B 잔여 13 migrations (1,250 row) 적용
- Round 11B partial 6 chunks (05-10) 재분류
- frequency_boost weight 논의 (0.15 유지 vs 0.20-0.25 상향)

Files: tmp_p12bis_chunk0[1-3].txt (input 634 row), tmp_p12bis_result_0[1-3].txt (311 fixes), tmp_p12bis_mig_0[1-3].sql.

Subagent IDs (참고용 transcript 0 byte이므로 더 이상 접근 불가): a5036c8d233f2310a / a2e6616772c5686f2 / a110aa81a01129874.

