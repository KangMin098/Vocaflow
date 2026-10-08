<!-- docs/csat-learner/vnext-audit/04-PLAN.md -->
# 04. 우선순위 · 검증 · 변경 대상 (제안)

기간은 작업 구획일 뿐이며 소요 시간을 보장하지 않습니다. **이 조사 결과를 바로 구현하지 않습니다.** 2차 심사와 승인을 거친 뒤에 구현합니다.

## 1. 우선순위와 로드맵

### P0: 학습 루프와 신뢰
| # | 항목 | 근거 | DB 변경 |
|---|---|---|---|
| P0-1 | 극장 완료·재개 (기기 레코드의 `sessions`) | 완료 개념 없음 [화면 C3] | 없음 |
| P0-2 | 모르겠어요를 `viewed`로 분리하고 적중 통계에서 제외 | hit=false로 오염 [코드·화면] | 없음 |
| P0-3 | 핵심 행동 이벤트 7종 (확정·건너뜀·완료·원리 저장·서가 필터·PDF 실패·오류) | 이벤트 0 | **허용 목록 SQL** (승인 필요) |
| P0-4 | 측정 분리 (합성·내부 계정) | 플래그 없음 | 열 또는 서버 판정 (승인 필요) |
| P0-5 | 평가원 독립 검수 계획과 노출 순서 | 독립 검수 0 / 802 | 없음 (계획만) |
| P0-6 | 홈 머리 수치를 집합별로, 진단 카드 503 수정 | [화면 A2] | 없음 |

### P1: 경험 통합
- 홈 단일 주 행동 (화면 1)
- 극장 2열 + 보조 패널 (화면 2)
- 해부 3B 스킨, 개발용 로컬 원문 적용
- 복습을 「원리 + 새 문항」으로
- 정본 표 이중 기록 (합의 뒤)
- 함정 1,726종 전량 분류 실험 (확정이 아님)
- 평가원 단위 생성

### P2: 운영 확장
- 자산 결속과 CI `--check`
- 배포 manifest
- 관리자 메뉴 분리
- 작업 큐 실행
- FSRS 실험
- map-vnext Workspace 머지

### 기간별
| 기간 | 목표 | 검증 |
|---|---|---|
| 1주 | P0-1, P0-2, P0-6 + P0-3·P0-4의 SQL 초안(승인 대기) | E2E: 시작 → 확정 → 완료 → 재접속 → 재개 → 복습 생성. 이벤트 중복 0 |
| 4주 | P1 화면 3종, 해부 스킨, 정본 이중 기록(합의 뒤), 함정 분류 실험 | 합성 학습자 시나리오 12종 통과 · 단계 이탈 지점 측정 |
| 12주 | P2, 평가원 재검수 확대, 실제 학습자 모집 뒤 효과 프로토콜 | 효과는 실제 학습자 N≥20(정본 `min_n`)에서만 판정 |

### 멈출 것
- 새 대량 분석 배치 (공급은 3,408문항으로 이미 충분)
- 평가원 자기 검수만으로 하는 새 배포
- 실제 참가자 없이 「효과」를 주장하는 문구

## 2. 검증 계획

| 층 | 무엇 | 도구 |
|---|---|---|
| 단위 | 세션 상태 머신, 병합 (삭제 표시), 완료 수준 판정, 적중 통계 제외 | vitest (`lib/csat/*`) |
| 계약 | 정본 표 멱등성 (같은 `client_attempt_id` 두 번 → 행 1개) | DB 스모크 (승인 뒤) |
| E2E | 화면 1–3, 원문 없음 3갈래, 모달 포커스, 오류 복구 | Playwright (기존 `csat-item-layout.spec.ts` 확장) |
| 합성 학습자 | 12종: 첫 방문 · 재방문 · 공백 복귀 · 모르겠어요만 · 확신 높은 오답 · 원문 없음 · 두 기기 · 중도 이탈 · 복습 due · 전이 성공 · 전이 실패 · 진단만 | Playwright + `synthetic=true` |
| 측정 | 퍼널 각 단계 > 0, 중복 0, 합성 혼입 0 | SELECT 질의 |
| 효과 | **실제 학습자만.** pre/post/delayed/transfer | 정본 `evaluateProtocol` (이식 뒤) |

이번 조사에서 쓴 쓰기 차단 프로브(모든 쓰기 요청을 기록하고 막음)는 합성 검증의 「DB 무쓰기 모드」로 재사용할 수 있습니다.

## 3. 변경 대상 목록 (구현할 때)

| 구분 | 대상 |
|---|---|
| 화면 | `components/csat/space/SpaceScreen.tsx` · `theater/{AnalysisTheater,PredictGate,ItemPaper}.tsx` · `session/{SessionRunner,ItemScreen}.tsx` · `home/RecordScreen.tsx` · `ProgressView` · `browse/CsatWorkspace.tsx` · `rail/CsatRail.tsx` |
| 로직 | `lib/csat/dissect.ts` (기록 모델) · `continuity.ts` (병합 · 삭제 표시) · `reveal-gate.ts` · `session/store.ts` · `space-model.ts` · `skeleton.ts` (평가원 단위 이전 때) |
| 이벤트 | `lib/analytics/events.ts` · `client.ts` (surface) · 허용 목록 마이그레이션 (새 번호, 승인) |
| API | `app/api/csat/state/route.ts` (트랜잭션 병합) · 새 시도 기록 API (정본, 합의 뒤) · `session/{record,reveal}` 폐기 표시 |
| DB (승인) | `learning_task_attempts` (+`client_attempt_id`, `mode`, `completion`) · `funnel_events` 측정 분리 · 평가원 `csat_item_units` · 자산 결속 열 |
| 스크립트 | `build-skeleton-data.mjs` · `build-trap-atlas.mjs` (버전 규칙 통일) · 강의 빌드 결속 · CI `--check` |
| 도움말·문서 | `lib/admin/help/kice.ts:43` 정정 · `help/csat.ts` 도표 SQL 표현 정리 · ROUTES · MODULES · DESIGN_SYSTEM · CHANGELOG |
