# S059 `/wordvault/review` — WordVault 복습 (/study 와 같은 화면·같은 쿼리)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD(의도): "복습할 때가 된 단어만 모아 다시 떠올리고 평가하고 싶다" — 실제 동작은 아래 흐름 참조
- 주 사용자: 학생 · 인지 계층: L3(→ FSRS 적재)

## 흐름
- 진입: /wordvault 세그먼트 「복습」 하나뿐(`components/wordvault/hub/WordVaultHubChrome.tsx:43`)
- 단계: /wordvault/study 와 동일 — 단어 → 뜻 → 예문 → 1–5 평가(`components/wordvault/StudyMode.tsx`)
- 완료 조건: 마지막 평가 → "오늘 잘 마쳤어요"(`components/wordvault/WordVaultStudyClient.tsx:74-105`)
- 1차 행동: 평가 5버튼 · 보조: 발음, 설정
- 나가는 길: 종료·완료 → **항상 /wordvault**(backHref 미전달 `app/(main)/wordvault/review/page.tsx:34`, 기본값 `WordVaultStudyClient.tsx:32`) · 내 단어 보기

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 문구만 | "지금 복습할 단어가 없어요 — 잘 따라가고 있어요"(`WordVaultStudyClient.tsx:50-55`) — 그러나 쿼리가 due 필터가 아니라 **보유 단어가 1개라도 있으면 비지 않음**(아래) → 사실상 보유 0 일 때만 뜨고, 그때 "잘 따라가고 있어요"는 틀린 말 | △ /wordvault/browse |
| 로딩 | 전역만 | `review/page.tsx:31` 서버 조회 | — |
| 오류 | 없음 | throw → `app/error.tsx` | 전역 |
| 부분 | 있음 | 이탈 시 flush(study 와 동일) | — |
| 완료 | 있음 | study 와 같은 완료 화면, 이름만 "복습"(`WordVaultStudyClient.tsx:37`) | ○ |

## 자산
- N1 자산: 주석은 "복습 대상 = due+new(next_review_at ≤ now 또는 NULL)"(`review/page.tsx:4-5`)이지만 호출은 `fetchStudyVocabularies(supabase, user.id)` 필터 없음(`:31`) → `next_review_at` 오름차순 상한 N개(`lib/wordvault/study-queries.ts:51-58`). 즉 **/wordvault/study(필터 없음)와 같은 단어 집합** — due 가 아닌 단어도 담긴다. 역할: **없음**(R(t) 표시 0, 간격 상수 `StudyMode.tsx:42-48`)
- 형태 씨앗: 없음
- 학습과학 원칙: #2 Spaced 를 표방하나 due 판정이 없어 약화

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: /wordvault/study 와 픽셀 단위 동일(추정) — 상단 바 + 520px `rounded-3xl` 카드 + 64px 단어
- 골격 판정: **단일 카드** — **공유 골격 ★** 동일 컴포넌트 `WordVaultStudyClient`(`review/page.tsx:34` vs `app/(main)/wordvault/study/page.tsx:49-52`). 라우트 둘 · 화면 하나 · 쿼리 하나 — 세그먼트가 「학습」「복습」을 서로 다른 행동처럼 판다
- 모션: study 와 같음 — revealIn 320ms △ · `audio-glow` infinite ✗(`StudyMode.tsx:273`) · 진행 바 ○
- 평균 신호(정적): 17 (study 와 동일 트리: rounded-big 7 · shadow-heavy 4 · float-hover 4 · gradient 1 · infinite-anim 1)

## 근거
- `apps/web/src/app/(main)/wordvault/review/page.tsx:1-6` — "study 라우트 미러" 명시
- `apps/web/src/app/(main)/flashcard/play/page.tsx:94-95` — 같은 쿼리를 "due 필터가 아니라 급한 순 상한"이라 다른 화면은 이미 인정
