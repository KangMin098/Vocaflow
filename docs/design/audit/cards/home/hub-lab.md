# S029 `/hub-lab` — 허브 재설계 랩 (내부 후보 비교)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "허브를 재설계할 때, 후보 5안을 실데이터·같은 셸에서 한 클릭으로 갈아 끼워 캡처 비교하고 싶다, 그래서 점수로 고른다"
- 주 사용자: 내부(디자이너·에이전트) — 학습자 아님 · 인지 계층: 없음
- **고아 확인**: 들어오는 링크 0. 의도된 고아다 — "링크는 어디에도 걸지 않는다"(`app/(main)/hub-lab/page.tsx:7`), 링크 그래프 허용 목록 `app/__tests__/link-graph-ratchet.test.ts:32,38`, 길찾기 면제 `components/layout/__tests__/wayfinding.test.ts:76`, robots noindex `app/robots.ts:36`. 템플릿 링크 호출자도 grep 0건(주석 언급만: `hub/page.tsx:17`, `TodayStage.tsx:21`)
- ⚠️ 접근 제어 없음 — (main) 셸 안이라 로그인 사용자 누구나 URL로 진입 가능(`page.tsx:71-120` 에 역할 검사 없음)

## 흐름
- 진입: URL 직접 입력만(`?v=a|b|c|d|g`, `?t=dawn..night`) — `page.tsx:14,76-78`
- 단계: 1. LabBar 에서 후보 선택 2. 후보 렌더(A 오늘 하나 · B 지형도 · C 살아있는 서재 · D 합성 · G 관문 첫 줄) 3. "현행 →"으로 /hub 비교
- 완료 조건: 없음(비교 도구)
- 1차 행동: 후보 전환 · 보조: 각 후보 내부 CTA(/flashcard/play, /text/[id], /practice/dcp, /scriptquiz …)
- 나가는 길: /hub(`LabBar.tsx:49-54`) 외 후보별 12개 목적지

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 후보별 | B `NoTerrain` `_variants/VariantB.tsx:43` · C `QuietRoom` `_variants/VariantC.tsx:95,203` · A 미진단 분기 `_variants/VariantA.tsx:87` | 후보마다 다름 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | `app/error.tsx` | — |
| 부분 | 있음 | 후보별로 필요한 데이터만 조회 `page.tsx:82-90` | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: 처방·FSRS·지형(learning_records) — 역할: 후보별 상이. G 는 합성 상태(실데이터 아님, `page.tsx:106`)
- 형태 씨앗: 없음(C·D 가 현 /hub TodayStage 의 원형)
- 학습과학 원칙: 해당 없음(도구 화면)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 점선 테두리 LAB 바(`LabBar.tsx:17-20`) + 기본 후보 A
- 골격 판정: 후보 A = 그라디언트 히어로 카드(`_variants/VariantA.tsx:171,458`) — G1 축 아님
- 평균 신호(정적): 5 (gradient 3 · float-hover 2). LabBar 버튼 `min-h-[36px]` — 44px 하한 미달(`LabBar.tsx:33`)

## 근거
- `apps/web/src/app/(main)/hub-lab/page.tsx:3-16` — 랩의 목적·"목업 금지"
- `apps/web/src/app/(main)/hub-lab/page.tsx:38-44` — 후보 5안 정의
- `apps/web/src/app/__tests__/link-graph-ratchet.test.ts:38` — 허용 고아 목록
