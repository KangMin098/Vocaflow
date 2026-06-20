> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2g_pg_cron_promotion.md
> category: project

---

Phase 2G — pg_cron 일별 자동 V-Level promotion 완료 2026-05-25. Phase 2 자동화 loop 최종 단계.

**Migration**: `vrl_phase2g_pg_cron_auto_promotion`.

**Extension 확인**: pg_cron 1.6.4 + pg_net 0.20.0 활성화 (Supabase managed).

**신규 함수**: `cron_auto_promote_all_users()`
- 진단 완료 + V11 미만 사용자 순회 (`current_v_level > 0 AND < 11`)
- 각 사용자 `auto_promote_v_level_for_user(user_id)` 호출
- 예외 isolated (한 사용자 실패가 다른 사용자 차단 X — EXCEPTION WHEN OTHERS)
- 반환: total_checked, promoted_count, failed_count

**Cron schedule**:
- jobid=8, jobname='vrl-auto-promote-daily'
- schedule: `0 18 * * *` (UTC 18:00 = KST 03:00 새벽)
- command: `SELECT public.cron_auto_promote_all_users();`
- active=true
- 멱등 등록: 기존 동일 jobname unschedule 후 schedule

**한국 학습자 정합**:
- 새벽 시간 (KST 03:00) — 사용자 학습 활동 없는 시점
- 일별 자동 실행 — 학습 누적이 다음 날 즉시 반영
- V11 도달 사용자 제외 (최고점 도달 시 더 상향 없음)

**E2E 자동화 완성 (Phase 2 마지막)**:
1. 진단 (1회) → V-Level + track_levels 초기값
2. 학습 (계속) → learning_records 누적
3. **매일 새벽 03:00 KST — cron_auto_promote_all_users 자동 실행**
4. promoted 사용자 user_profiles + snapshot 자동 갱신
5. 다음 WordVault 접속 시 갱신된 추천 자동 노출
6. Library Krashen i+1 자동 갱신
7. /diagnostic/history에 새 snapshot 자동 표시

**Smoke test**:
- cron.job 등록 확인 ✓ (jobid=8, daily 18:00 UTC, active)
- 수동 호출 ✓ (test 사용자 진단 미완료 → 0/0/0 정합)
- 실제 promotion은 학습 데이터 누적 후 자연 발생

**모니터링 옵션 (향후)**:
- `cron.job_run_details` 테이블 — 실행 history (return value, status, error)
- 알림: 실패 시 admin 알림 (pg_net으로 webhook)
- 통계: 일별 promoted 추세 dashboard

**Phase 2 통합 완성 (이 세션 누적)**:
DB (11 layer):
- ✅ 2A.2 analyze + apply (base)
- ✅ 2B.1 진단 시드 40q (base)
- ✅ 2B.2 CSAT track 진단 + analyze_track 함수
- ✅ 2B.3 Business + Academic track 진단
- ✅ 2C.1 V-Level 단어장 9개 (1,600 row)
- ✅ 2C.2 specialty 단어장 4개 (902 row)
- ✅ 2D 추천 3-tier
- ✅ 2D.2 specialty opt-in (4-tier)
- ✅ 2D.3 track-based 자동 (5-tier)
- ✅ 2E auto_promote 함수
- ✅ 2F track snapshot audit chain
- ✅ **2G pg_cron 일별 자동 promotion** (이 문서)

Frontend (8 자산):
- ✅ /diagnostic v2 (test-agnostic)
- ✅ Sidebar 진단 메뉴
- ✅ WordVault hub 추천 통합 + Set wire-up
- ✅ VLevelPromotionCheck UI
- ✅ /diagnostic/history timeline
- ✅ DiagnosticClient inline history
- ✅ HistoryTimeline track 모드 분기

**Phase 2 E2E 완전 자동화 loop**:
사용자 진단 (base + track) → 단어장 추천 (5-tier 자동) → 학습 누적 → **매일 새벽 자동 promotion** → 다음 추천 갱신 → Library i+1 갱신 → 진단 history audit chain

**다음 후보**:
- comprehensive 진단 (모든 axis 통합 측정)
- track auto_promote (current_track_levels도 학습 기반 상향)
- Admin dashboard (cron 실행 통계 모니터링)

관련: [[vrl-phase2e-auto-promote]] [[vrl-phase2f-track-snapshot-chain]] [[vrl-phase2d3-track-based-recommendations]] [[claude-code-is-llm]]

