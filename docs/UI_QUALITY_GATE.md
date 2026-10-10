# UI Quality Gate · 목표 속도 지표

> 2026-10-10 사용자 최상위 요구: **A. 목표 달성 속도 극대화 · B. 화면 UX/UI·시각 디자인 품질 극대화.**
> 규칙만으로 동작한다. Codex·LLM 자동 호출은 없다(RP-2026-10-10.2 유지). 코드: `lib/uigate.mjs` · `lib/perf.mjs goalMetrics`.

## 1. 언제 적용되나

**화면 경로**는 다음 둘 중 하나입니다.

- `apps/web/src/app/` · `apps/web/src/components/` · `apps/web/src/styles/` · `apps/web/public/` · `packages/design-tokens/` · `packages/ui-shared/`
- `.tsx`·`.jsx`·`.css`·`.scss` 파일

glob 이면 고정 접두로 판정합니다. 예를 들어 `apps/web/src/**` 는 화면이고, `apps/web/src/lib/**` 는 아닙니다.

| 대상 | 적용 |
|---|---|
| 설계 승인 | 화면 경로를 건드리는 설계는 `ui_design` 이 있어야 승인됩니다. 없으면 `UI_DESIGN_REQUIRED` 이고, 다음 Work 요청이 그 보완을 묻습니다 |
| 새 작업 | 화면 경로를 건드리면 `ui_gate: true` 와 설계의 `ui_acceptance` 사본이 붙습니다 |
| 기존 작업 · 완료 증거 | **소급하지 않는다** — 적용 시점 이후 새로 만든 작업부터 |

## 2. Work 화면 설계 계약 — `plan.ui_design`

Work 기획 요청의 응답 형식에 들어 있습니다(`lib/planning.mjs`). 다음 증분 질문(`nextDesignIssue`)도 화면 영역이 위임돼 있으면 이 계약을 요구합니다.

| 키 | 내용 |
|---|---|
| `users_and_purpose` | 대상 사용자와 화면 목적 |
| `user_journey` | 핵심 사용자 여정 |
| `information_architecture` | 정보 구조·내비게이션 |
| `visual_direction` | 시각 디자인 방향(기존 디자인 시스템·우수 화면 참고, 템플릿 반복·기능 나열 금지) |
| `screens` | 화면별 레이아웃·컴포넌트·상호작용 |
| `typography_color_spacing` | 타이포그래피·색상·간격·대비 |
| `learner_fit` | 학습자 수준·교육 목적 적합성 |
| `states` | 로딩·빈 상태·오류·완료 상태 |
| `accessibility` | 접근성·사용성 |
| `implementation_scope` | 구현 허용 범위 |
| `ui_acceptance` | UI·디자인 수용 기준 — 실제 브라우저(PC ≥1280px)에서 확인 가능한 문장 배열 |
| `browser_verification` | 검증 방법(URL · viewport · 도구) |

`ui_acceptance` 는 설계 계약 해시에 들어갑니다. 바뀌면 계약 변경이고, 해당 작업을 다시 검증합니다. `ui_design` 이 없는 기존 설계의 해시는 그대로입니다.

## 3. UI 증거 — `task evidence <id> --file ui.json`

일반 증거 필드(`type: "ui"` · `command_or_protocol` · `result` · `skip_count` · `artifact_path_or_url` · `observed_at` · `covers`)에 다음을 더합니다.

```json
{
  "type": "ui",
  "result": "pass",
  "commit": "16df6cf2c",
  "urls": ["http://localhost:3000/csat/map"],
  "viewport": { "width": 1440, "height": 900 },
  "environment": "next dev localhost:3000 · chromium (playwright)",
  "screenshots": ["tmp/ui/map-1440.png"],
  "checks": {
    "render": "pass", "layout_pc": "pass", "readability_hierarchy": "pass", "design_system": "pass",
    "journey_interaction": "pass", "states": "pass", "accessibility": "pass",
    "navigation_progress": "pass", "visual_regression": "pass", "design_acceptance": "pass"
  },
  "defects": [{ "kind": "suggestion", "claim": "카드 사이 여백 8px 더", "status": "open" }],
  "ui_acceptance_results": ["pass", "pass"]
}
```

- **스크린샷**은 공간 루트나 작업 worktree 기준으로 실제 파일이어야 하고, 기록 시점의 sha256 이 함께 남습니다.
- **SKIP 은 PASS 가 아니다.** 검사나 UI 수용 기준 중 pass 가 아닌 것이 있는데 `result: "pass"` 라고 적으면 기록 자체가 거부됩니다.
- **결함은 두 종류로 나눈다.**
  - `objective` 는 구현 결함입니다. 열려 있으면 완료가 막힙니다.
  - `suggestion` 은 주관적 개선 제안입니다. 완료를 막지 않아, 무한 수정 루프를 막습니다.
- **도구**는 제품 저장소의 기존 것을 씁니다: playwright(`pnpm --filter web test:e2e`) · `pnpm design:ref-compare` · `scripts/design/capture-*.mjs`. 새 UI 검사 시스템은 만들지 않았습니다.
- 실제 사용성·학습 효과는 이 게이트가 아니라 별도 학습자 증거로 평가합니다.

## 4. 완료 판정(`completeTask`)

`ui_gate` 작업은 기존 검사(증거 통과 · 수용 기준 덮음 · 커밋 일치 · 설계 판 · CRIT-EV-1)에 더해 다음을 모두 만족해야 완료됩니다. 하나라도 빠지면 `UI_GATE` 로 거부하고, 빠진 항목을 적습니다.

1. 이번 run 에 `type: "ui"` 증거가 있다.
2. 그 commit 이 검증 커밋과 같다.
3. `result: "pass"` 이고 10개 검사가 전부 pass 다.
4. 열린 객관 결함이 0이다.
5. UI 수용 기준이 전부 pass 다.

## 5. 목표 속도 지표 — `node bin/vfc.mjs ugoal metrics <UG> --json`

상태 기록에서만 계산합니다(추정·상수 없음).

| 항목 | 출처 |
|---|---|
| 접수 → 첫 설계 승인 | 목표 `created_at` → 설계 `approved_at` 최솟값 |
| Work 왕복 | ChatGPT 대상 라운드 수(요청·응답) |
| 승인 대기 | 설계별 `created_at → approved_at` 합 |
| 배정 → 인수 · 설계 승인 → 완료 · 시작 → 완료 · 리뷰 대기 · 재작업 | 작업 `dispatch` · `history` |
| 사용자 개입 | 이 목표를 언급한 대화형(tty) 결정 수 |
| 목표 전체 경과 | `created_at → accepted_at`(열려 있으면 지금까지) |

**미계측**(값 대신 사유를 냅니다):

- 테스트·UI 검증 소요 시간 — 증거에 소요 시간이 없습니다.
- PR·CI·병합 시각 — 작업에 기록되지 않습니다.

이 둘을 재려면 증거와 작업에 해당 시각을 기록해야 합니다.
