> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_phase12a_meaning_audit_done.md
> category: project

---

Phase 12-A (Tier A = V≥5 AND frequency_rank<3000, 978 candidates) meaning audit complete 2026-05-25.

**Applied**: 2 migrations `phase_12a_meaning_audit_p1` + `_p2` = 182 row updated in shared_dictionary.

**Fix categories**:
- pos 오류 + 주된 의미 누락: court/wave/tire/shoot/chief/combine/relative/express/associate/appropriate/overall/wake/lock/cast/register/principal/till/row/grade/electric 등
- 다의 누락 (단일 sense → multi-sense): cell(세포+감방+휴대전화), bill(청구서+법안+지폐), application(지원+응용+앱), cast(던지다+배역+출연진+깁스), shot(발사+슛+사진+주사) 등
- V-level 과대 (downgrade): vote V?→V3, divide→V3, noise→V3, path→V3, tear→V3, lock→V3, escape→V3, soft→V3, transport→V3, shoulder→V3, kiss→V2, pen→V2, cloud→V2

**V-level 변경 분포**: V2=3, V3=30, V4=49, V5=74, V6=25, V7=1 — 압도적 다운그레이드 (high-freq 단어들이 의미 누락 + V 과대 평가받고 있었음).

**SET 절**: pos, meanings_ko, meaning_ko, v_level, cefr_level (track/domain/skill 미변경 — semantic audit only).

**잔존 이슈**:
- `unlike` (V6 B2 "좋아요를 취소하다") 트리거 단어 자체가 182 fix 누락 — Tier A 후보였으나 subagent 가 catch 못함. SNS slang 만 있고 preposition 주된 의미 "~와 달리" 누락. spot-fix 필요.

**Pending tasks**:
- spot-fix unlike + 잠재적 다른 누락 (sample 검증 권장)
- Round 11B 잔여 13 migrations (c01_p3~c11_p3 = 1,250 row) 적용
- Round 11B partial 6 chunks (05-10) re-classification
- Tier B 확장 (V≥5 AND rank>=3000) — Phase 12-B 후속

Files: tmp_p12a_chunk0[1-4].txt (input 978 row), tmp_p12a_result_0[1-4].txt (182 fixes), tmp_p12a_mig_p1.sql + tmp_p12a_mig_p2.sql.

