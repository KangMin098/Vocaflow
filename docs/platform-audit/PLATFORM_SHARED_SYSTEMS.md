# PLATFORM_SHARED_SYSTEMS — 공통 DB·인증·권한·학습 기록·분석·운영

> 기준 a7c986469 · DB SELECT 2026-10-09 · 상세: [_raw/area-shared.md](./_raw/area-shared.md) · [_raw/area-admin-ops.md](./_raw/area-admin-ops.md) · [_raw/db-demand.md](./_raw/db-demand.md)

## 1. DB 개관

- public 테이블 약 245개 · 함수 585개 · RLS 꺼진 테이블 1개(`textbook_shelf_stats_meta`, 메타 1행).
- 0행 테이블 약 70개(대부분 최근 설계분): csat_ec_* · reading_promotion/production 8 · methodology_* 8 · B2B 3 · csat_review_visual_* 5 · 영상 요청 계열.
- 스토리지 버킷 3(vocab-sources-raw 비공개 · comic · video 공개). 오디오 버킷 없음.

## 2. 시스템별 상태

| 시스템 | 상태 | 근거 |
|---|---|---|
| 인증 · 역할 | VERIFIED_WORKING | users 5 = profiles 5 (admin 1 · user 4). role 허용값 `user/admin/curator`(`20260504101620…:43`) — teacher 는 role 이 아니라 `classes.teacher_id` 소유로 판정(`lib/teacher/class-actions.ts:41` · RLS `20260812124500…:49`) |
| 학습 기록 코어 | VERIFIED_WORKING(검증 계정) | learning_records 672 · scores 80 · reading_sessions 287 · daily_activity 85 |
| FSRS · Memory Decay 4색 | IMPLEMENTED_UNVERIFIED | `lib/srs/fsrs.ts` · R(t) 동적 계산 · CSAT 는 문항 단위 자체 복습 큐(`lib/csat/session/model.ts`)를 따로 쓴다 |
| 레벨 · 진단(VRL) | IMPLEMENTED_UNVERIFIED | 시험 5 · 문항 185 · 결과 23 · 스냅샷 22 |
| 목표 · 개인화 | PARTIAL | study_plan_items 6 · csat_map_goal 1 · i+1 추천 70/30 구현 위치 미발견 |
| 교사 · B2B | PARTIAL | classes 1 · members 0 · assignments 0 · progress 0 · `teacher/page.tsx` 있음 |
| 계측(funnel_events) | VERIFIED_WORKING(수집) | 21,081행 · 사용자 4 · 마지막 10-08 · 69% screen_viewed |
| 관리자 리텐션 패널 | IMPLEMENTED_UNVERIFIED | 분모 20 미만이라 퍼센트를 그리지 않음 |
| 결제 · 요금제 | **DESIGN_ONLY** | subscriptions/payments 테이블 0 · `admin/billing` 은 PG 미연동 안내 · plan 컬럼 없음 |
| 알림 · 푸시 | 없음(UNKNOWN → 사실상 미구현) | 테이블·코드 0 |
| TTS · 오디오 | EXPERIMENTAL | 브라우저 음성합성뿐 |
| 지식 레지스트리 | PARTIAL | knowledge_items 157 · methodology_* 대부분 0행 |
| Admin 콘솔 | IMPLEMENTED_UNVERIFIED | page 87개 전부 `require-admin` · 고아 화면 0 · **6개 화면 목업**(analytics · billing · library · reports · settings · users) |
| Admin 도움말 | VERIFIED_WORKING(정적) | help 레지스트리 16파일 + `help-registry`·`help-links` 회귀 |
| DB 헬스 | PARTIAL | 지표 10,466행 자동 수집 · 미해결 발견 26 · 판정·조치는 수동 |
| 스케줄러 | VERIFIED_WORKING(DB) | pg_cron 15 중 14 활성 · 14일 실패 0 · 마이그레이션에 없는 job 2개(`purge-cron-history-7d` · `vrl-auto-promote-daily`) |
| CI | 정적 검사 VERIFIED_WORKING · **e2e 미실행** | `ci.yml` lint/typecheck/test · `sync-check` 10-08 성공. 같은 run 의 e2e job 은 「e2e 건너뜀 — 저장소 시크릿 미설정」(`ci.yml:98`) |
| **프로덕션 배포** | **PARTIAL** | `deploy.yml` 은 초록이지만 run 2026-10-08 로그에 「배포 건너뜀 — VERCEL_TOKEN / VERCEL_PROJECT_ID 미설정」(`deploy.yml:46`) · `vercel.json` 없음 · 다른 경로(Vercel Git 연동 등)로 배포되는지는 미확인 |
| CSAT 원문 일일 감사 | 실패 중 | `csat-source-audit.yml` 최근 3회 failure · 알림 없음 |
| 에이전트 인프라 | IMPLEMENTED_UNVERIFIED | lock(권고형) · handoff · review · check · AGENTS.md 의 `.agents/skills/csat-source-audit/SKILL.md` 링크가 깨져 있음 |

## 3. 중복 · 병렬 모델 (구조 위험 순)

1. **학습 기록 이원화** — 공용 `learning_records`(+FSRS) vs CSAT `csat_item_attempts` · `csat_session_attempts` · `csat_dx_response` · `csat_learner_state` · `csat_item_state` · `learning_task_attempts`. CSAT 응답은 공용 FSRS·Dashboard 에 합류하지 않고 자체 복습 큐를 쓴다. 단위가 다른 것(문항 vs 단어)은 의도일 수 있으므로, 결함은 「학습자에게 보이는 회고가 갈라진다」로 한정한다.
2. 레벨 모델: VRL 스냅샷(어휘 수준) vs `csat_dx_snapshot` / `csat_learner_state`(성취·함정 취약성) — 척도가 달라 단순 통합 대상은 아니다.
3. 목표: `study_plan_items` vs `csat_map_goal`.
4. 지식: knowledge_* vs methodology_*.
5. 어휘 자원: `shared_dictionary` 49k vs `shared_words` 약 681k vs `lexicon_clean` 약 455k · `archaic_dictionary`.
6. 단어 숙련도: learning_records(FSRS) vs `word_familiarity`(0행).
