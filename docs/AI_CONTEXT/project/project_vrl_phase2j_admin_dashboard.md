> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2j_admin_dashboard.md
> category: project

---

Phase 2J — `/admin/vrl/automation` Admin Dashboard 완료 2026-05-25. Phase 2 자동화 운영 모니터링.

**신규 파일**:
1. `apps/web/src/app/admin/vrl/automation/page.tsx` — Server Component dashboard
2. Migration `vrl_phase2j_admin_dashboard_rpcs` — 5 admin RPC 함수

**5 RPC 함수** (admin_vrl_*):
| 함수 | 반환 |
|---|---|
| admin_vrl_cron_jobs() | cron.job WHERE jobname LIKE 'vrl-%' (jobid, jobname, schedule, active) |
| admin_vrl_cron_runs() | 최근 10건 cron.job_run_details (runid, status, return_message, start/end_time) |
| admin_vrl_snapshot_counts() | snapshots GROUP BY taken_reason + scope (count) |
| admin_vrl_v_level_distribution() | user_profiles GROUP BY current_v_level (분포 막대) |
| admin_vrl_diagnostic_use() | 5 diagnostics + 응시 count (활용도) |

**Dashboard UI** (5 섹션):
1. pg_cron jobs — 활성 VRL job 테이블 (jobid/이름/schedule/active)
2. 최근 cron 실행 (10) — status 색 (succeeded=초록/실패=빨강) + 시간 + return_message
3. snapshots by reason/scope — grid card (taken_reason · scope · count)
4. V-Level 분포 — bar chart (V0-V11 + NULL)
5. 진단 활용도 — 5 diagnostics 별 taken_count 테이블

**접근 권한**:
- SECURITY DEFINER + search_path='public' 적용
- 현재 admin role 가드 X (Phase 3에서 RLS or middleware admin check 추가 권장)
- 향후: middleware.ts에 /admin/* role check + admin RPC도 admin role 검증

**Phase 2 운영 모니터링 가용**:
- cron 실행 성공 여부 즉시 확인
- snapshot 누적 패턴 (진단 vs 자동상향 비율)
- V-Level 분포 — 사용자 cohort 분석
- 5 진단 어떤 게 가장 활용되는지

**Phase 2 통합 최종 완성 (이 세션 누적)**:

DB (15 layer):
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / 2D.3 / 2E / 2F / 2G / 2H / 2I / **2J**

Frontend (10 자산):
- /diagnostic v3 (5 진단 wire-up)
- Sidebar 진단 메뉴
- WordVault hub 추천 카드 + Set wire-up
- VLevelPromotionCheck UI
- /diagnostic/history timeline + inline 통합
- HistoryTimeline (base + track scope)
- **/admin/vrl/automation dashboard** (이 문서)

**E2E 완전 자동화 + 모니터링 완성**:
1. 사용자 진단 (5 진단 자율 선택)
2. 4축 측정 → user_profiles 셋팅
3. 5-tier 추천 (V-Level + interests + track-based 자동)
4. 학습 → learning_records 누적
5. 매일 KST 03:00 — pg_cron 자동 promotion (base + 3 tracks)
6. snapshots audit chain 자동 기록
7. **Admin /admin/vrl/automation에서 모든 자동화 상태 모니터링** ★

**다음 후보 (Phase 3)**: (Sidebar 메뉴·RBAC guard·cron alert·track 분포 — 2K에서 완료)

**v06.147~148 현행화 (2026-07-06)**:
- automation 페이지 고도화 — "최근 레벨 변경" 테이블(user_level_snapshots 직접 read 10건) + V-Level 분포에 근거(진단/학습/수동) vs 기본값(미진단) 인원 분리.
- **RLS 발견·수리**: user_level_snapshots/user_profiles/user_diagnostic_results 가 본인 read 전용이라 /admin/vrl/users·snapshots·diagnostic 하위 페이지가 admin 에게도 빈 화면이었음 → migration `20260706010000_vrl_admin_read_policies`: **`is_admin()` SECURITY DEFINER 헬퍼**(user_profiles 자기참조 정책은 헬퍼 없이는 infinite recursion) + admin SELECT 정책 4건(vrl_diagnostic_tests 비활성 포함). 검증: admin 전체 가시·학습자 격리 유지.
- ⚠️ RBAC 성격의 RLS 변경은 auto mode 분류기가 "다음" 승인으로도 거부 — 사용자 "적용" 명시 후 apply_migration 통과.
- /admin/vrl(사전 Health) 쪽: backlog D1/V1/C1/D4 완료 반영 + 결함룰 13(CEFR C2) categorical 라이브화.

관련: [[vrl-phase2g-pg-cron-promotion]] [[vrl-phase2h-track-auto-promote]] [[vrl-phase2i-comprehensive-diagnostic]] [[claude-code-is-llm]]

