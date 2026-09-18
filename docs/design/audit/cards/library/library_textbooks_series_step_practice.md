# S037 `/library/textbooks/[series]/[step]/practice` — 교재 연습 (순서·삽입 문항)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "이 교재 계단이 내 수준인지 확인할 때, 그 수준의 문항을 바로 몇 개 풀어 보고 싶다, 그래서 담을지 정한다"
- 주 사용자: 학생 · 인지 계층: L5(문항 인출)

## 흐름
- 진입: 권 상세 「문항 풀어 보기」(`[step]/page.tsx:179`) 한 곳뿐
- 단계: 1. 권 제목 뒤로 링크 2. 「연습」 제목+설명(`page.tsx:79-91`) 3. `DcpPlayer` 최대 8문항(`:33, :94`)
- 완료 조건: DcpPlayer 세트 종료(추정 — 완료 처리는 `components/practice/DcpPlayer` 내부)
- 1차 행동: 문항 풀이 · 보조: 로그인하고 풀기(`:122-129`)
- 나가는 길: 권 상세(`:81`) · 교재 서가(`:131`) · /flashcard/play(`lib/learner/dcp.ts:92`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 재고 없음 `page.tsx:112, 119` | ○ 교재 서가로 — 단 시리즈 무관 `/library/textbooks`(`:131`) |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 있음 | `unavailable` `page.tsx:111, 118` | △ "잠시 뒤" 문구 + 서가로 — 재시도 버튼 없음 |
| 부분 | 있음 | 비로그인 `signedOut` `:109, 116, 122-129`(셋을 구별 `:102-106`) | ○ 로그인 후 이 화면 복귀 |
| 완료 | 추정 | DcpPlayer 내부 | — |

## 자산
- N1 자산: V-Level — 계단의 **첫 V-Level 하나만** 씀(`page.tsx:69-70`) · CSAT 계열 순서·삽입 문항 — 역할: **문항 그 자체**(형태 아님). 조회가 시리즈를 받지 않아 어휘·구문 시리즈도 같은 순서·삽입 문항을 받는다(`fetchTextbookPracticeItems(vLevel, ITEM_LIMIT)` `:70`, 추정)
- 형태 씨앗: 없음
- 학습과학 원칙: #1 Active Recall · 기록이 다음 문항 선택에 쓰임(`:89`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: compact 폭(`page.tsx:77`) — 20px 제목 + 첫 문항
- 골격 판정: 단일 문항 플레이어(학습 화면). G1 없음
- 평균 신호(정적): 1 · 뒤로 링크에 `min-h` 없음(`:80-86`) → 44px 미만 터치 대상(추정)

## 근거
- `apps/web/src/app/(main)/library/textbooks/[series]/[step]/practice/page.tsx:36-43` — 시리즈별 계단 조회(과거 404 수정)
- 병합 후보: `/practice/dcp` 도 같은 `DcpPlayer` 를 쓴다(`apps/web/src/app/(main)/practice/dcp/page.tsx:14,59`) — 이 화면은 V-Level 고정 입구일 뿐. 여기선 `backHref` 를 넘기지 않음(`page.tsx:94`)
