# S036 `/library/textbooks/[series]/[step]` — 교재 한 권 상세

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "교재 한 권을 집었을 때, 목차·구성·수준을 보고 나한테 맞는지 판단하고 싶다, 그래서 풀어 보거나 담거나 학생에게 보낸다"
- 주 사용자: 학생 · 교사(공유는 로그인 무관 `page.tsx:195-197`) · 방문자 · 인지 계층: L5 앞단

## 흐름
- 진입: 서가 「펼쳐 보기」(`ShelfControls.tsx:179`) · 연습 화면 뒤로(`practice/page.tsx:81`) · /text
- 단계: 1. 「교재 서가」 뒤로 2. VolumeHero(표지·요약+행동 3) 3. 머리말 4. 구성과 특징 5. 목차 6. 수록 구성(유형별 막대) 7. 미리보기·단어 목록 8. 학습 계획표 9. 계단 안내(이전/다음 권) 10. 판권·뒷면 11. 「오늘의 학습으로」
- 완료 조건: 연습 시작 또는 담기
- 1차 행동: 「문항 풀어 보기」(`page.tsx:178-184`) · 보조: 담기(`:186-194`) · 공유(`:197`) · 오늘의 학습(`:312-318`)
- 나가는 길: /library/textbooks · practice · /hub · 이웃 권(`NeighborCard` `:277-278`)
- 결함: 뒤로 링크가 시리즈와 무관하게 `/library/textbooks`(= 독해) 고정(`page.tsx:169-174`) — 어휘·구문 권에서 누르면 **다른 코너**로 간다

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 목차 없는 권은 절을 빼고 이유를 적음 `page.tsx:252`(`ContentsUnavailable`) · 없는 시리즈/권 → 404 `:124-134` | ○ 이유 + 이웃 권 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 전역만 | catch 없음(`page.tsx:129-132`) → `app/error.tsx`(추정) | 전면 오류 |
| 부분 | 있음 | 유형 문항 0 → '준비 중' `page.tsx:242` | — |
| 완료 | 있음 | → practice | ○ |

## 자산
- N1 자산: CSAT 계열 문항 재고(유형별 수 막대 `page.tsx:216-243`) · V-Level(`buildDossier` `:138-156`) · 권 단어 목록(`VolumeWordList` `:251`) — 역할: **칩·숫자**(막대는 112px 보조 게이지)
- 형태 씨앗: 없음 — G1 「시험지 사물」의 재료(유형·문항 번호)가 있는데도 쓰지 않음
- 학습과학 원칙: #3 Desirable Difficulty(계단 = 학년 하나 `:268-274`) · Progressive Disclosure(판단 먼저, 풀이는 다음 화면)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 뒤로 링크 + `VolumeHero`(표지+제목+행동 3개 `page.tsx:177-198`)
- 골격 판정: **문서형 카드 스택** — 같은 `rounded-ios-2xl shadow-ios-2` 섹션이 반복(`:207, :263, :287`). 시중 교재 "구성요소"를 파이프라인이 조립(`:15-17`). G1 없음
- 평균 신호(정적): 2

## 근거
- `apps/web/src/app/(main)/library/textbooks/[series]/[step]/page.tsx:9-17` — 재설계 동기(시중 중앙값 5축 vs 1축)
- `apps/web/src/components/library/textbooks/VolumeDossier.tsx:102` — VolumeHero 정의
