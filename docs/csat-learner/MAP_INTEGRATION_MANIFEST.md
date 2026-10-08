# 학습 지도 vNext — main 통합 의존성 목록(2026-10-08)

> `feat/map-vnext` 를 통째로 합치지 않고 **최신 `origin/main`(81bdc0e26) 위에 학습 지도에 필요한 변경만** 다시 세운 기록.
> 원본 브랜치는 그대로 둔다(기준본). 브랜치 `feat/map-vnext-integration`.
> 원본: main 대비 커밋 100 · 파일 451. 통합: 파일 약 150 — 아래 A·B·C 의 합. 나머지는 D 로 뺐다.

## A. 학습 지도 제품 코드 — 원본과 바이트 동일

| 영역 | 경로 |
|---|---|
| 지도 모델 · 경로 · routing · 순위 | `apps/web/src/lib/csat/map/**` (axis-routing · core · distinguish · evidence · graph · learner-path · load · memberships · model · payload · prescription · server · target + 테스트) |
| 지도 화면 | `apps/web/src/components/csat/diagnosis/map/**` (LearnerMap · LearningMap · MapScreen · StepSheet · NodePopup · GoalBar …) |
| 지도 API | `apps/web/src/app/api/csat/diagnosis/map/{goal,tasks/[id]}` |
| 진단 판정 | `lib/csat/diagnosis/{observability,readiness,seed-rules}.ts` · `engine/{map-evidence,record-quality}.ts` · `server.ts` · `snapshot.ts` · `admin.ts` · `engine/{types,rule-v1,exam-report}.ts` |
| 진단 화면 연결 | `(app)/csat/diagnosis/page.tsx`(지도 탭) · `DiagnosisBoard` · `RecordsList` · `RecordDetailModal` · 관리자 진단 `actions.ts` · `learners/[id]` · `ExamsTable` · 도움말 `csat-diagnosis.ts` |
| 전역 | `globals.css` `--csat-fs-scale` · `--csat-fs-min`(지도 글자 비율) · 라우트 가드 허용 2줄 |

main 은 위 공유 파일들을 merge-base 이후 고친 적이 없다(각 파일 main 쪽 변경 0 확인) — 그래서 원본 파일을 그대로 쓸 수 있었다.

## A'. 원본과 다르게 옮긴 것(hunk 단위)

| 파일 | 옮긴 것 | 뺀 것 |
|---|---|---|
| `lib/analytics/events.ts` · `__tests__/events.test.ts` | 지도 이벤트 4종 | 학습 Workspace 이벤트 5종 |
| `components/csat/diagnosis/board.module.css` | `.qualityNote`(입력 신뢰도 안내) | /csat 글자 크기 일괄 변환(디자인 작업) |
| `components/csat/diagnosis/map/__tests__/type-scale.test.ts` | 비율 · 토큰 검사 | 검사 범위를 `components/csat` 전체 → **지도 디렉터리**로(/csat 전체 변환은 design/replica-first 몫) |
| `docs/DB_SCHEMA.md` · `ROUTES.md` · `MODULES.md` · `ADMIN_CONSOLE.md` | 지도 · 진단 반영 판정 문단 | Workspace · 철자 정본 · 오답 원인 Evidence 문단 |
| `package.json` | `design:ref-measure` · `design:ref-compare`(AGENTS 가 요구하는 측정 명령) | — |
| `(app)/csat/diagnosis/page.tsx` 의 `DiagnosisShell` 레일 | — | `railWorkspaces`(Workspace 레일) — 셸 파일은 main 그대로 |

## B. DB 기반

| 마이그레이션 | 의존 | 판정 |
|---|---|---|
| `20261002120000_csat_map` | `public.csat_exams`(main) · `auth.users` · `auth.uid()` | 그대로 이식. 기존 표는 바꾸지 않는다 |
| `20261002120100_funnel_allow_csat_map` | `public.funnel_events`(main `20260825161641`) | main 최신 허용 목록(`20261001160000`)과 비교해 **정확히 지도 4종만 추가**(뺀 이벤트 0) — 그대로 이식 |
| `20261002130000_csat_map_item_rate_ledger` | 지도 표만 | 그대로 이식 |

세 파일 모두 개발 DB 에 이미 적용돼 있고 내용이 같다(원본 브랜치의 적용본). 이 PR 은 DB 를 바꾸지 않는다.

지도 코드가 읽는 표 25개 · RPC `csat_dx_record_session` · `csat_exams.diagnosis_ready` 는 모두 main 마이그레이션(`20261001150000_csat_diagnosis_mvp` 등)에 있다.

**빈 DB 검증**(`scripts/csat/map/fresh-db-check.mjs`): 빈 PostgreSQL 에 main 마이그레이션 전부 → 지도 3개 순서로 적용. 지도 3/3 성공 · 앱이 읽는 객체 전부 존재 · 로더 select 컬럼 일치 · 권한(학습자 직접 쓰기 거부 · 본인 목표만 보임 · 지도 정의 쓰기 불가 · 익명 0행).
주의: main 마이그레이션 이력은 그 자체로 빈 DB 에서 완전 재생되지 않는다(이력 이전 대시보드 기준선 · Supabase 전용 확장 pgmq/pg_net/storage). 지도와 무관한 기존 사실이며, 지도의 유일한 간접 선행 객체 `funnel_events` 가 기대는 `is_admin_or_curator()` 하나만 스텁으로 두었다.

**시드(구조 재현)**: 노드 · 연결선 · 과제 정의는 `scripts/csat/map/source/*.json` + `seed.mjs`(RPC `csat_map_seed`), FIND 과제 보강 `scripts/db/seed-20261007-find-tasks.sql`(+ 되돌리기), S 직접 확인 과제 `scripts/db/proposed-20261008-s-direct-task.sql`(개발 DB 적용분). 모두 저장소에 있다.
**개발 DB pilot 데이터와 구분**: M2409 pilot canon · `diagnosis_ready=true` · capability 검수 데이터는 운영 데이터이지 코드 계약이 아니다 — production seed 로 넣지 않았다. 지도 E2E 는 실행 동안만 있는 TEST 시험(M2098)을 만들어 지우고, 단위 테스트는 저장소 fixture(`scripts/csat/diagnosis/pilot/*.json`)를 쓴다.

## C. 다른 브랜치에서 왔지만 지도가 쓰는 것

| 것 | 출처 | 판정 |
|---|---|---|
| 참조 측정 도구 `scripts/design/{ref-measure,ref-compare,ref-scan,ours-text-metrics,capture-map-core}.mjs` · `docs/design/refs/3b/access-map/**` · `CAPTURE.md` 2줄 | design/replica-first(지도 작업 중 생성) | 지도 기하 · 글자 가드(`geometry.test` · `type-scale.test`)가 `spec.json` 을 읽는다 — **포함** |
| CSS 상속 스코프 `tokens-from:`(token-exists 가드) | 지도 작업 | 지도 팝업이 `map.module.css` 변수를 받아 쓴다 — **포함** |
| `20261003230000_csat_error_evidence` · `docs/csat-learner/choice-traps/v0.1.json` · `choice-traps-artifact.test` | ec-smoke | 지도 코드(`lib/csat/map` · `lib/csat/diagnosis` · 화면 · API)가 `csat_ec_*` · choice-traps 를 **읽지 않는다**(grep 0) — **제외** |
| `spelling_canonical`(20260926120000 · _pending) | dict | 지도 무관 — **제외** |

## D. 제외(지도 무관)

- 어휘 단어장 표지 55장 · `VocabShelf3D` · 표지 파이프라인(`scripts/vcb/**`, `packages/library-pipeline` trade-cover)
- 사전 철자 정본 · vlevel 채우기 · `resolve_dict_headword` 문서
- 학습 Workspace(`components/csat/workspace/**` · `lib/csat/workspace*.ts` · 라우트 3 · 이벤트 5 · `20260929090000` · e2e 51) · 레일 재구성 · 세션/theater/space 화면 · e2e 47 · continuity 수정
- 강의 나레이션 `lecture-data/*.json` · 설계 주석 · reflow · passage-skeleton · type-report-recount · source-check 회차 · source-origin 크롤러
- 오답 원인 Evidence 전체(마이그레이션 · 코드북 · isolated-pg 하네스 · dev-smoke)
- 에이전트 설정(`agents/**` · `AGENTS.md` · `CLAUDE.md` · `.codex`) — main 이 이미 최신
- `scripts/db/proposed-20261008-seed-v2.sql`(seed v2 — 미실행 · 승인 보류) · `scripts/db/apply-approved-sql.mjs`(methodology 브랜치가 따로 가진다)

## 기능 동등성

| 기능 | 원본 map-vnext | 통합 | 근거 |
|---|---|---|---|
| 학습자 지도(읽기 길 7 · 듣기 4) | yes | yes | 지도 E2E 상태 A·B·C |
| routing(R/E · V · X · S · 누적 S) | yes | yes | `axis-routing.test` · `routing-eval`(M2409 after: unsafeDirect 0 · wrongDirect 0) |
| 관측 특성(observability) | yes | yes | `observability.test` |
| k=8 순위 축소 · RANKING_GATE | yes | yes | `ranking-gate.test` |
| S 직접 확인(FIND) | yes | yes | `axis-routing.test` · `prescription.test` |
| 진단 반영 판정(readiness) | yes | yes | `readiness.test` · `readiness-smoke` 5/5 |
| verified 전 확정 금지 · 처방 게이트 · CTA 하나 | yes | yes | 지도 E2E C · D 게이트 |
| M2409 회귀(fixture) | yes | yes | `seed-rules.test` · `ranking-gate.test` |
| /csat 전체 글자 비율 변환 | yes | **no** | 디자인 작업(design/replica-first) — 지도 CSS 는 이미 비율 사용 |
