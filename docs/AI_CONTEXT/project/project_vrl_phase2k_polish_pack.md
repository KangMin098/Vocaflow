> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2k_polish_pack.md
> category: project

---

Phase 2K — Phase 2 polish 4종 일괄 완료 2026-05-25. 사용자 요청 "남은 후보 모두 진행".

**4 변경**:

### 1. Sidebar /admin/vrl/automation 메뉴
- `apps/web/src/components/admin/AdminSidebar.tsx`
- '사용자 & 콘텐츠' 그룹 끝에 `'VRL Automation' (Workflow icon)` 추가
- VRL Pipeline → VRL Automation 순차 진입

### 2. middleware admin RBAC guard
- `apps/web/src/middleware.ts` 전면 재작성
- 동작:
  - 모든 요청 — Supabase 세션 갱신 (createServerClient + getUser)
  - `/admin/*` 경로:
    - 미인증 → `/login?next=<path>` redirect
    - 인증 + role !== 'admin' → `/hub` redirect
    - admin → 통과
- `user_profiles.role` 컬럼 활용

### 3. cron alert (pg_notify)
- `cron_auto_promote_all_users()` 함수 확장
- failed > 0 시 `pg_notify('vrl_cron_alert', jsonb)` 발행
- payload: `{event, failed, total_users, timestamp}`
- 외부 listener (Edge Function, Realtime channel) 등록 시 알림 전달
- pg_net webhook은 webhook URL 설정 필요 (Phase 3 wire-up)

### 4. track distribution 도표
- 신규 RPC: `admin_vrl_track_distribution()`
- 반환: (track_id, level, user_count) — 진단 완료자(level>0)만
- Dashboard 페이지에 신규 섹션 추가 — 3 track별 L1-L10 bar chart
- 각 track마다 group + max 기반 막대 높이 정규화

**Phase 2 통합 완성 최종 (이 세션 누적)**:

DB (16 layer):
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / 2D.3 / 2E / 2F / 2G / 2H / 2I / 2J / **2K**

Frontend (11 자산):
- /diagnostic v3 (5 진단)
- Sidebar 진단 메뉴
- WordVault hub 추천 + Set wire-up
- VLevelPromotionCheck UI
- /diagnostic/history timeline + inline 통합 + track scope
- /admin/vrl/automation dashboard (6 섹션 with track distribution)
- **AdminSidebar VRL Automation 메뉴**
- **middleware /admin/* RBAC guard**

**E2E 완전 자동화 + 모니터링 + 보안 + 알림 loop**:
1. 사용자 5 진단 자율 선택 → 4축 측정
2. 5-tier 추천 자동 → 학습 누적
3. 매일 KST 03:00 pg_cron 자동 promotion (base + 3 tracks)
4. snapshots audit chain 기록
5. failed > 0 → pg_notify alert
6. Admin /admin/vrl/automation 6 섹션 모니터링 (cron + snapshots + V-Level + tracks + diagnostics)
7. middleware /admin/* admin role 가드 (보안)

**알려진 한계 (Phase 3 후보)**:
- pg_net webhook URL 환경변수 설정 + listener 함수 wire-up
- admin role middleware는 user_profiles.role 컬럼 신뢰 (어드민 추가/삭제 UI 별도)
- track distribution이 V8-V10 specialty 측정 안 (NGSL 기반 진단 한계)

**Phase 2 모든 요청된 작업 완료 — End**

관련: [[vrl-phase2j-admin-dashboard]] [[vrl-phase2h-track-auto-promote]] [[claude-code-is-llm]]

