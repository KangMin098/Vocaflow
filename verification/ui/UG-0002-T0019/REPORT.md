# UI Quality Gate 첫 실증 — 학습 지도 「학년별 권장 참고」(UG-c8315ad8-0002 · T-0019)

- **대상**: `/csat/diagnosis?tab=map` 의 LearnerMap · T-0019(설계 v8 범위 C, 정본 §15)가 더한 `grade-guide` 블록
- **기준 커밋**: `128fd78c1` (learning-map worktree `Vocaflow-map-feedback` · T-0019 검증 커밋 `16df6cf2c` 포함 — origin/main 병합됨)
- **환경**: 그 worktree 에서 이미 떠 있던 next dev(localhost:3000)에 요청만 보냈다(서버를 띄우거나 끄지 않음) · chromium(playwright) · 1440×900(+1920 레이아웃) · 테스트 계정 runtime-test
- **실행**: `node --env-file=<web .env.local> verification/ui/ui-verify-map.mjs --base http://localhost:3000 --out verification/ui/UG-0002-T0019 --commit 128fd78c1` · 2026-10-10T09:21:46Z → 09:21:55Z(9초)
- **증거**: [ui-evidence.json](./ui-evidence.json)(type "ui" 형식 — `validateUiEvidence` 형식 통과 · 스크린샷 3장 해시) · 스크린샷 [전체](./map-1440-full.png) · [안내 블록](./grade-guide-1440.png) · [단계 시트](./map-1440-stepsheet.png)

## 판정: **FAIL**(객관 결함 2) · UI_UNVERIFIED 3항목 — 게이트가 완료를 막는다(`uiGateMissing` → `result=fail`)

| # | 검사 | 결과 | 근거 |
|---|---|---|---|
| 1 | 렌더링 | pass | HTTP 200 · `learner-map` 렌더 · 콘솔 오류 0 |
| 2 | PC 레이아웃 | **fail** | 가로 넘침 0(1440·1920). 그러나 안내 제목이 듣기 트랙과 **−16px**(겹침) |
| 3 | 가독성·위계 | **fail** | 안내 글자 **11.04px**. 제목과 본문이 같은 클래스(`pathHint`)라 위계 없음 |
| 4 | 디자인 시스템 | pass | 지도 본문과 같은 서체(Inter) · 인라인 style 0 · CSS 모듈 클래스만 |
| 5 | 여정·상호작용 | pass | 단계 카드(어휘·표현) → 단계 시트(dialog) 열림 → Esc 로 닫힘 |
| 6 | 로딩·빈·오류 상태 | skip | 이 실행에 빈 상태·오류를 만들 계정·주입 수단이 없다 — **UI_UNVERIFIED** |
| 7 | 접근성 기본 | pass | 접근성 트리에 「학년별 권장 참고」 「실제 경로는 진단 결과가 결정」 「듣기는 별도 트랙」 3문구 · 최저 대비 6.32:1 · Tab 포커스 표시 20/20 |
| 8 | 화면 간 이동 | pass | 지도 안 링크 `/csat/diagnosis?tab=map&view=full` → 200 |
| 9 | 시각 회귀 | skip | 비교 기준 캡처 없음 — 이번 캡처가 다음 기준 · **UI_UNVERIFIED** |
| 10 | 설계 UI 수용 기준 | skip | 설계 v8 은 게이트 이전이라 `ui_design`·UI 수용 기준이 **없다** — 임의 PASS 하지 않음 · **UI_UNVERIFIED** |

## 발견한 디자인 결함

**객관 결함(완료를 막는 구현 결함)**
1. **겹침**: 「학년별 권장 참고」 제목(top 599px)이 듣기 트랙(bottom 615px)과 16px 겹친다. 화면에서 제목이 「듣기」 줄의 일부처럼 읽힌다.
2. **글자 크기·위계**: 안내 블록 전체가 11.04px 다. 제목도 본문과 같은 `pathHint` 클래스를 쓴다. 지도의 다른 블록 제목(예: 「수능 영어 독해 실력이 만들어지는 길」)과 위계가 맞지 않는다.

**주관적 개선 제안(완료를 막지 않음)**
- 학교급 줄의 `LP1·LP2…` 는 학생에게 뜻이 없는 내부 식별자다. 같은 화면의 7단계 이름(어휘·표현 → 시간 내 통합)과 연결해 보이면 「어느 단계를 주로 만나는지」 가 바로 읽힌다.
- 세 학교급이 텍스트 세 줄이라 위 7단계 아이콘 길과 시각적으로 연결되지 않는다.

## 이 결함을 고치려면

- **누가**: 고치는 일은 learning-map owner 몫이다. AI-Control 은 제품 코드를 고치지 않는다.
- **무엇이 먼저**: 화면 경로(`LearnerMap.tsx` · `learner.module.css`)를 건드리는 새 작업은 UI Quality Gate 를 거친다. 그런데 설계 v8 에 UI 수용 기준이 없어 검사 10 이 영원히 skip 이다. 먼저 Work 설계(v9)에 `ui_design` 12항목과 위 객관 결함 2건을 넣어야 한다.
- **막힌 곳**: 그 Work 요청은 다음 설계 예산(8/8 소진) 때문에 자동으로 나가지 않는다 — **BLOCKED(사용자 예산 결정)**.
