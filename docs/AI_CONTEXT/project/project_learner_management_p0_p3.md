> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_learner_management_p0_p3.md
> category: project

---

학습자 관리 모델 구현 (2026-06-28). 설계 SSoT = `docs/LEARNER_MANAGEMENT.md`(PR #61). 비교군(LingQ/Busuu/리틀팍스/클래스카드) 분석 + 라이브 진단 기반. **타겟 = 수능생 단일 집중 · L3(B2B) 데이터모델 선반영(화면 Phase 2)**.

**라이브 진단 핵심**: learning_records 는 이번 세션 SRS flush(#38)+게임 5종(#51~#59)으로 이미 가동(실 row 有) → synthesis 의 "P0=INSERT 파이프라인" 전제는 절반 완료. 진짜 P0 = 집계층(daily_activity writer 0).

**구현 (전부 머지, 마이그레이션 적용)**:
- **P0** (PR #62, mig `20260628150000`): `daily_activity` 자동 집계 트리거 2(learning_records→총복습/모듈별, scores→분/단어, KST date) + `user_stats.known_word_count`(stability≥21 derived 캐시) + `refresh_user_known_word_count` 함수(flush-actions 가 flush 후 호출).
- **P1** (PR #63 → **재설계 PR #75 `510fc5c`**, mig `20260628200000`): ⚠️ 초안(수능 D-day 역산 `learning_goals`/`/onboarding`/study-plan.ts/goal-actions.ts)은 **전면 폐기**. 사용자 피드백 "계획이 왜 수능이냐 — 플랫폼 학습 계획이어야" → **자료×활동 학습 계획**(리틀팍스 코스형). `study_plan_items`(material_type book/script/word_set + material_id 다형 + modules text[]) + `lib/learner/plan-activities.ts`(활동 10종 listen/read/echo/vocab/flashcard/wordblitz/pairflip/spellforge/scriptquiz/dictation + 자료유형별 가용: 본문=10/단어장=어휘5) + `plan-actions.ts` + `/plan` + `PlanClient.tsx`(자료 탭→활동 체크→담은 카드 활동 토글 즉시저장). learning_goals(0rows) DROP. **"수능생 단일 집중"은 타겟 페르소나로만 유지, 계획 substance 아님.**
- **P2** (PR #65, mig `20260628170000`): `weekly_reports` 테이블 + `lib/learner/weekly-report.ts`(daily_activity 주간 집계 + 템플릿 격려 코멘트, KST 월요일, 멱등) + `/reports` Report Card(갱신 버튼, cron 자동생성은 후속).
- **P3** (PR #66, 마이그레이션 0): `/dashboard` TodayHero 하드코딩(23/30/학습자) → 실데이터(`dashboard-data.ts fetchDashboardHero`) + known-word Implicit Progress 표시. WeeklyHeatmap/MemoryStatus/RecentActivity 는 P0 데이터로 자동 실데이터화.

- **P4.1** (PR #67, mig `20260628180000`): L3 B2B 데이터 모델 `classes`/`class_members`/`assignments` + recursion-safe RLS(`is_class_teacher`/`is_class_member` SECURITY DEFINER 헬퍼로 classes↔class_members 순환 회피, 정책 8). user_profiles.role 에 'teacher'.
- **P4.2** (PR #68, mig `20260628190000`): 교사 허브 `/teacher` — `lib/teacher/class-actions.ts`(createClass 초대코드 자동생성 / joinClassByCode RPC / fetchTeacherClasses 멤버수 / fetchMyMemberships) + TeacherClient(개설/목록/초대코드 복사/참여). `join_class_by_code(text)` SECURITY DEFINER(비멤버 RLS 우회 lookup+가입).

**로드맵 P0~P4.2 전부 머지 완료(#61~#68)**. 적용 마이그레이션: P0/P1/P2/P4.1/P4.2.

**통합 관리 화면 `/manage`(#70, 리틀팍스 MY 학습 참고)**: `lib/learner/manage-overview.ts fetchManageOverview` — V-Level/known-word/streak/오늘단어/Study Plan/최근 리포트 통합 → 진단·학습계획·학습현황·주간리포트 4 카드 + 상세 CTA(/diagnostic·/onboarding·/hub·/reports). Sidebar: 학습계획·리포트 별도 항목(#69) → 단일 '내 학습'(/manage)으로 통합. 마이그레이션 0.

**잔여**: P4.3 = 과제배포(assignments UI) + 주간리포트 학부모 공유 + `/teacher/[classId]` 상세 (투기적 — 실 클래스/학생 없음). · 모든 P1~P4.2 UI 런타임 미검증(서버 fetch/폼/게임 — 무회귀 설계). · daily_activity/known_word_count/scores 는 실플레이 누적 시 채워짐(현 dev 0). · weekly_reports cron 자동생성 · 추천 P2(reading_session 연동) · 사이드바에 /onboarding·/reports·/teacher 메뉴 미등재(라우트만 존재).

관련: [[project-a3-game-real-data-sweep]] · [[project-srs-persistence-a1]] · `docs/LEARNER_MANAGEMENT.md`(SSoT 설계)

