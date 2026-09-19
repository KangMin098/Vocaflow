# S040 `/my/texts` — 폐지 주소 (→ `/text`)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: 없음 — ADR 0006 D4 로 폐지된 옛 주소를 `/text` 로 보내는 redirect 전용(`app/(main)/my/texts/page.tsx:3-12`)
- 주 사용자: 옛 북마크·외부 링크로 오는 학생 · 인지 계층: 해당 없음

## 흐름
- 진입: 저장소 안 링크 0(정적 in=0, `/my/texts` grep 결과 자기 파일·`learner-routes.ts:325` · `axes.ts:321` retire 목록뿐)
- 단계: 1. 서버 `redirect('/text')`
- 완료 조건: `/text` 착지
- 1차 행동: 없음(화면 없음) · 보조: —
- 나가는 길: `/text`

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 해당 없음 | redirect 전용 | — |
| 로딩 | 해당 없음 | — | — |
| 오류 | 해당 없음 | — | — |
| 부분 | 해당 없음 | — | — |
| 완료 | 해당 없음 | `/text` 로 이동 `page.tsx:12` | — |

## 자산
- N1 자산: 없음 — 역할: **없음**
- 형태 씨앗: 없음
- 학습과학 원칙: —

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 없음(`/text` 가 그린다)
- 골격 판정: `경유`(redirect 전용 — vocaflow-design §G5 예외)
- 평균 신호(정적): 0

## 근거
- `apps/web/src/app/(main)/my/texts/page.tsx:5-7` — "`/text` 와 동작이 같았다 … 같은 것을 두 이름으로 부른 자리"
- `apps/web/src/lib/framework/learner-routes.ts:325` — `kind: 'redirect'` 로 등록. 같은 세트의 `/my`(`my/page.tsx:9-11`)도 redirect — `/my/books` 만 단독 화면으로 남음
