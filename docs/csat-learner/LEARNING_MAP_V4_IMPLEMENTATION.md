# 학습 지도 rev4.0 — 2차 구현 기록(첫 수직 경로 · 2026-10-10)

> 기준: PR #205 head `d63e575fb`(1차 설계). 브랜치 `feat/map-v4-impl`. 설계 문서: [ARCHITECTURE](./LEARNING_MAP_V4_ARCHITECTURE.md) · [EXAM_INPUT_CONTRACT](./LEARNING_MAP_EXAM_INPUT_CONTRACT.md) · [WORKSPACE_CONTRACT](./LEARNING_MAP_WORKSPACE_CONTRACT.md) · [RELATIONSHIP_MODEL](./LEARNING_MAP_RELATIONSHIP_MODEL.md).
> 범위 밖(완료로 선언하지 않음): 134 시험 진단 확대 · 개인별 PLAN 저장 · 실제 학습 효과 검증 · DB 스키마 변경.

## 1. 무엇이 생겼나

| 층 | 파일 | 내용 |
|---|---|---|
| 정의 | `apps/web/src/lib/csat/map/v4/definition.ts` · `definition.data.ts`(생성물) · `types.ts` | `docs/csat-learner/v4/*.json` → `scripts/csat/map/v4/gen-definition.mjs` → 정적 import(요청마다 파일을 읽지 않음). TASK 30 · 라인 54 · 활동 183 대응 보존 · `CANON_VERSION` · 확인 과제 키 → 중심 TASK 하나 |
| As-Is | `v4/as-is.ts` | 세션 · 확인 시도 · 축 proxy → TASK 근거 상태 10종(측정 불가 · 기록 없음 · 분석 준비 중 · 근거 부족 · 관찰 · 먼저 확인 후보 · 확인 진행 중 · 직접 확인 요구 · 다시 확인 통과 · 만료). 직접 확인은 기존 `skillDiagnosis` 그대로. 시점 필터 · 재현 한계(`mode` · `exact` · `limits`) · 반영 중(`proxy_pending`) · diff |
| To-Be | `v4/to-be.ts` | 목표 관련도(`splitMust` 「꼭 맞힐 문항」 중 TASK 의 기존 라인 문항) · 요구 6유형(EXAM_PRACTICE 는 보류로만) · 순서 · 실행 가능 확인 문항 · 관련 Workspace |
| Workspace | `v4/workspace.ts` | live 템플릿 대표 하나 · 단계 4칸(확인 · 바로잡기 · 적용 · 다시 확인) 준비 여부와 실제 문항 수 · 구조적/제안 연결 구분 |
| 조립 | `v4/compose.ts` | 화면 데이터 → 세 계산. `currentAsOf`(시계 어긋남 보정) · `parseAsOf`(`?asof=`) |
| 데이터 | `lib/csat/map/load.ts` | `MapPageData.v4` — 본인 시험 기록 전부(기록 테이블 직접 · 입력일 · 입력 신뢰도 · 진단 준비) · 축 proxy 반영 세션 · 기준 시험 전 문항 · 적용 가능 문항 수(보류 문항 제외 · fail-closed) |
| 화면 | `components/csat/diagnosis/map/NeedPanel.tsx` · `needs.module.css` | LearnerMap 아래 읽기 전용 「목표까지 필요한 학습」. 기존 LearnerMap · GoalBar · StepSheet 교체 없음 |
| 그래프 | `lib/csat/map/graph.ts` · `LearningMap.tsx` | GAP-07 — 경로 안 미확정 연결선 `unconfirmed`, 화면은 흐린 강조(탐색 불변) |
| 관계 | `docs/csat-learner/v4/relations.json` | PART_OF 14 approved(S · R · E — 정본 §3 인용), X 4 · 나머지 16 proposed |
| 이벤트 | `lib/analytics/events.ts` | `csat_workspace_opened` · `csat_workspace_suggestion_applied` — DB 허용 목록은 기존(마이그레이션 없음) |
| 준비도 | `scripts/csat/map/v4/exam-readiness-report.mts` | [LEARNING_MAP_V4_EXAM_READINESS.md](./LEARNING_MAP_V4_EXAM_READINESS.md) · `v4/exam-readiness.json`(읽기 전용, 판정 = `examReadiness`) |

DB: 스키마 · 마이그레이션 · 운영 데이터 변경 0. E2E 가 만든 임시 계정(@example.com)과 TEST 시험(M2098)은 각 스크립트가 지운다. 한 번 중단된 상태 E2E 실행이 남긴 M2098 은 같은 정리 절차로 지우고 확인했다(남은 TEST 시험 0 · 진단 반영 1).

## 2. 실제 시험 기록별 동작(브라우저 E2E `scripts/csat/map/e2e-map-v4.mjs` · 1440px)

| 상태 | 결과 |
|---|---|
| A 목표 없음 · 기록 없음 | 「시험 기록 없음」 + 기록 링크 · 영역 「기록 없음」 · 목표 순서 대신 안내(To-Be 없음) · 대표 묶음은 지금 할 수 있는 확인 |
| C 분석 준비 전 시험만(목표 80) | 기록 칩 「이 시험은 분석 준비 중」 · 영역 「분석 준비 중인 시험만 있음」 · 근거로 쓴 시험 0회 — 능력 부족 문구 없음 |
| D M2409(진단 반영 · 목표 80) | 근거 1회 · 영역 근거(관찰 · 먼저 확인 후보 · 기록 더 필요) · 학습 요구 18 · 대표 「글의 핵심 잡기」 확인 9문항 · 나머지 단계 이유와 함께 닫힘 · 맨 앞 요구는 실행 가능 · 다음 행동 → `/csat/item/<문항>#principle` 이동 · 돌아오면 기존 지도 그대로 |
| D 목표 60 으로 변경 | 요구 순서 · 관련도 변경 · 영역 근거 문자열 동일(As-Is 불변) |
| F 2024 시행 기록 | 「2024.09.04 시행 · 입력일」 · 「지금 기준으로 다시 읽었어요」 표시 |
| P `?asof=` 이틀 전 | 「그 시점을 지금 기준으로 다시 분석 · 되살린 것 아님」 · 기준 뒤 입력 기록 제외 · 지금 할 행동 링크 없음(「지금 기준으로 보기」만) |
| 공통 | 약점 · 실력 부족 · 퍼센트 · 내부 코드 0 · 제목/내용 겹침 0 · 가로 넘침 0 · 390px 캡처 1장(사용자 지시) |

## 3. 시나리오 · 불변식 단위 검증(`v4/__tests__/v4.test.ts` · `definition.test.ts`)

시나리오 ①–⑧ + 보강(반영 중 · 날짜만 있는 시행일 · 시계 어긋남 · 정의 이전 시점) · 불변식 8(목표 ↛ As-Is · proxy ↛ verified · 합성/도움 시도 제외 · 증거 중복 금지 · 보류 TASK 요구 0 · 미준비 콘텐츠 실행 불가 · 미승인 관계 ≠ 구조 · 학습량 ≠ 점수) · 정의 무결성 7(생성물 최신 · 54/183 전수 · TASK 30 · 보류 실행 불가 · 확인 키 대응 · 승인 14 · 준비 상태).

## 4. 화면 검토에서 고친 것

1. 「확인 콘텐츠 준비 중」 항목이 1위 · 실행 가능한 확인이 5위 → 같은 유형 · 같은 근거 단계 안에서는 실행 가능한 것을 먼저(계약 §5 갱신).
2. 날짜만 있는 시행일(`2026-10-10`)을 ISO 문자열과 비교해 오늘 기록을 「지난 기록 재분석」으로 표시 → 밀리초 비교(`ms`).
3. 기록 직후 스냅샷 계산 전 「기록 없음」(경합) → 세션은 기록 테이블에서 직접 · 미반영은 「반영 중」.
4. DB 시계가 앱 시계보다 앞서 방금 넣은 기록이 「기준 뒤」로 빠져 지금 화면이 과거 재분석처럼 보임 → `currentAsOf`.
5. 과거 기준 보기에 지금 할 행동 링크 → 숨김.
6. 관련도 소수점(예: 20.8점)이 임계값 노출 회귀 검사에 걸림 → 정수 「약 N점」.
7. 기존 상태 E2E 의 낡은 셀렉터(`#step-check li strong` 가 생애주기 줄까지 읽음) → 과제 제목만.

독립 리뷰(서브에이전트 · 읽기 전용): **P0 0 · P1 1 · P2 5** → 고침 5 · GAP 1.
- P1 시각 없는 시도가 과거 기준 분석 · 「확인 진행 중」에 들어감 → 기준 시점 필터와 독립 시도 계산 모두 `answeredAt` 필수(skill-diagnosis 와 같은 자격) · 회귀 테스트.
- P2 `knowledge_applications` 전량 조회 → 확인 키 접두(`surface_ref.like.<키>:*`)로 좁힘.
- P2 ready(공개 승인 전) 템플릿이 링크만 있으면 실행 단계를 열 수 있음 → `awaiting_release` 로 닫음 · 회귀 테스트.
- P2 「꼭 맞힐 문항 약 N점」이 점수 환산으로 읽힘 → 「이어진 문항 N개(기준 시험 M회)」.
- P2 과거 기준 실행 링크 → 이미 숨김(§2 P).
- P2 `loadV4Sessions` 가 점수 흐름 조회와 같은 세션의 응답을 다시 읽음(최대 200세션) → **GAP-15**(성능 · 3차에서 두 조회 합치기).

## 5. 남은 GAP · BLOCKED

| ID | 내용 | 분류 |
|---|---|---|
| GAP-01 | 진단 반영 시험 1/134 — 검수 남은 130(남은 문항 3,640) · 구조 문제 3. 지금 켤 수 있는 시험 0 | BLOCKED(사람 검수 · 관리자 승인) |
| GAP-02 | V · S · 어법 · 추론 직접 확인 콘텐츠 0 → 해당 Workspace 「준비 중」 | GAP |
| GAP-03 | cohesion 확인 문항 연결 없음(ready 템플릿 · 실행 단계 0) | GAP |
| GAP-04 | evidence · option 전이 문항(확인 묶음 밖) 0 → 적용 단계 「준비 중」 | GAP |
| GAP-05 · 06 | 목표 · 정의 버전 이력 없음 → 과거 기준은 항상 「다시 분석」(정확 재현 아님) | GAP(3차) |
| GAP-11 | 실제 학습자 기록 0 — 효과 근거 없음 | UNKNOWN |
| GAP-13 | 최근 평가원 시험 문장 단위(`csat_item_units`) 0 — 원문 근거 결속 콘텐츠 확대의 선행 작업 | GAP |
| GAP-14 | 전체 vitest 중 실DB 통합 2(교사 초대 RPC · VCB 컴포저 평가) 실패 — 이 작업과 무관한 영역, 미조사 | 확인 필요 |
| GAP-15 | 지도 진입 시 응답 중복 조회(기록 많은 학습자 지연) | GAP(성능) |
| (해소) GAP-07 | pending 연결선 확정 강조 | 2차에서 수정 |
