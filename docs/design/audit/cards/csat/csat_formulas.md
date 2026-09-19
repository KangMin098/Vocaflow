# S020 `/csat/formulas` — 내 공식

> 생성 2026-09-18 · Claude Opus 5 (서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "해부를 몇 번 한 뒤, 내가 모은 출제 공식을 유형별로 다시 보고 싶다, 그래서 그 공식으로 다시 해부한다"
- 주 사용자: 학생 · 인지 계층: 없음(기록 화면)

## 흐름
- 진입: S019 마스트헤드·지도 발 `SessionHome.tsx:56,88` · 학습 경로 「패턴 축적」 `:83` · S061 분석 읽기 「내 공식 보기」 `AnalysisWorkbench.tsx:51`. 해부 완료 화면(`SessionRunner.tsx:72`)엔 이 화면으로 가는 링크가 없다
- 단계: 1. 지표 3개 확인 2. 유형 펼치기 3. 공식 한 줄 펼치기 → 출처 문항 확인
- 완료 조건: 「이 공식으로 해부하기」 → `/csat/dissect?formula=`
- 1차 행동: 「이 공식으로 해부하기」(`ProgressView.tsx:19`) · 보조: 「← 오늘의 해부」(`:17`)
- 나가는 길: `/csat` · `/csat/dissect`

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | ○ | 「직접 대조한 출제 공식이 여기에 남아요」 `ProgressView.tsx:19` | ✓ 「첫 공식 만나기」 → `/csat` |
| 로딩 | ○ | 「공식을 펼치는 중…」 `ProgressView.tsx:13` | — |
| 오류 | ✗ | 화면 전용 없음. 카탈로그 throw(`lib/csat/dissect-catalog.ts:30,33`) → 루트 error | ✗ |
| 부분 | ○ | 적중률 표본 없음 「—」 `ProgressView.tsx:18` | — |
| 완료 | — | 목록 화면이라 완료 상태 없음 | — |

## 자산
- N1 자산: CSAT 코퍼스(공식·계열 `catalog.families`) + 기기 기록 — 역할: **칩·숫자**(공식 수 · 적중률 · 계열 커버리지 `ProgressView.tsx:18`)
- 형태 씨앗: 없음. S6 기록 지도(○•✓↻)는 홈 `PatternMap.tsx:20` 에 있고 여기엔 안 쓰인다
- 학습과학 원칙: #7 Emotional Encoding(내 언어로 남긴 공식) · #2 Spaced 는 약함(재확인 큐가 여기 안 보임)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 뒤로 링크 + h1 「내 공식」 + 지표 3칸 `dl` + 유형별 `details` 목록
- 골격 판정(코드 추정): **표(지표 3칸) + 접이식 목록** — 평균. 「계열 커버리지 n/총」이 형태 없이 숫자만(`:18`). 「예측 적중률 %」은 정답률 게이지에 가깝다(Implicit Progress 약함)
- 평균 신호(정적, 자기 트리): 0 — 신호는 없지만 골격이 G1 축이 아니다

## 근거
- `apps/web/src/app/(main)/csat/formulas/page.tsx:7` — SSR 카탈로그 → ProgressView
- `apps/web/src/components/csat/session/ProgressView.tsx:14-19` — predictionStats · 유형 그룹
- `apps/web/src/components/csat/session/PatternMap.tsx:15-21` — 같은 기록으로 이미 그리는 기록 지도(여기선 미사용)
