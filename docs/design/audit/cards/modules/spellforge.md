# S050 `/spellforge` — SpellForge 허브 (철자 연습 대기실)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "철자를 손으로 다시 써 보기 전에, 흔들리는 단어가 몇 개 담기는지 보고 길이만 골라 들어가고 싶다"
- 주 사용자: 학생 · 인지 계층: L4b 시각생성(`docs/MODULES.md:24`)

## 흐름
- 진입: /practice · /about · 세션 닫기(`components/layout/SessionFrame.tsx:44`) — 사이드바 직접 진입 없음
- 단계: 1. 히어로(이번 세션·Overdue·Best) 2. 오늘의 큐 4버킷 3. 최근 기록 4. 길이 선택 5. 시작하기
- 완료 조건: `/spellforge/play?limit=N` 이동(`app/(main)/spellforge/SpellForgeHubClient.tsx:43`)
- 1차 행동: 「시작하기」(`SpellForgeHubClient.tsx:126-133`) · 보조: 길이, 「내 자료」(`:119`)
- 나가는 길: /spellforge/play · /text

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 큐 0 → disabled + "연습할 단어가 아직 없어요"(`SpellForgeHubClient.tsx:131-132`) · 기록 0 → emptyHint(`:87`) · Best 는 '—'(`:74`) | ✗ 단어를 모으러 갈 1차 링크 없음 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 없음 | `app/(main)/spellforge/page.tsx:46-50` Promise.all 실패 → `app/error.tsx` | 전역 |
| 부분 | 비로그인 | 빈 큐·기록으로 렌더(`spellforge/page.tsx:42-44`) — 로그인 유도 없음 | ✗ |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: R(t) 4색 버킷(`lib/learner/session-queue-query.ts:48`) + scores 최근 기록 — 역할: **칩·숫자**; risk+shaky 합을 히어로 문장으로 씀(`SpellForgeHubClient.tsx:46-52,62-63`)
- 형태 씨앗: 없음(S10 류 4색 띠)
- 학습과학 원칙: #3 Desirable Difficulty(흔들리는 단어 강조·힌트 카피 `:115`) · #2

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: quiet 히어로 한 줄 → 「오늘의 큐」 숫자 카드 4칸 → 최근 기록 목록(`components/hub/RecentScoresList.tsx`)
- 골격 판정: **카드 목록** — **공유 골격 ★** /flashcard 와 같은 3부품(`FlashcardHubClient.tsx:48-75`), RecentScoresList 한 장만 추가. 로고를 가리면 두 화면을 구별할 형태가 없다(추정)
- 평균 신호(정적): 2 (gradient 2 — 공유 ModuleHero 정의)

## 근거
- `apps/web/src/app/(main)/spellforge/page.tsx:4-17` — 모드·난이도 컨트롤이 play 에서 무시되던 목업 제거 기록
- `apps/web/src/app/(main)/spellforge/SpellForgeHubClient.tsx:19` — 모듈 액센트 `#4A9FCF` 하드코딩(게임 예외 주석)
