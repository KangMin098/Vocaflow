# S044 `/practice` — 연습 단일 진입면 (면 6개 중 가장 무른 곳)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "연습하고 싶을 때, 게임 이름이 아니라 내가 약한 쪽을 바로 고르고 싶다, 그래서 도구 선택 없이 시작한다"
- 주 사용자: 학생 · 인지 계층: L4a·L4b 진입(Flashcard·WordBlitz·PairFlip·SpellForge 흡수 — `app/(main)/practice/page.tsx:12-13`)

## 흐름
- 진입: 셸 사이드바(`components/layout/sidebar-config.ts:221`) — 화면 간 정적 진입 0
- D7 활성화 경로 밖(추정: 경로는 /diagnostic→/flashcard/play 직행)
- 단계: 1. 헤더 "연습 · 내 단어 n개" 2. LeadCard(가장 무른 면) 3. 나머지 5면 카드 + Game Lab 링크
- 완료 조건: 도구 화면으로 이동
- 1차 행동: LeadCard 「{도구} 로 연습」(`app/(main)/practice/PracticeChooser.tsx:217-223`) · 보조: 다른 면 도구, Game Lab
- 나가는 길: /flashcard · /pairflip · /spellforge · /wordblitz(`lib/learner/practice-map.ts:32-36`) · /practice/dcp?from=(활성일 때만 `PracticeChooser.tsx:70`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 부분 | 도구 없는 면 "아직 전용 연습이 없어요" `PracticeChooser.tsx:294-297` · 무른 면에 도구 없음 문장 `:113-117` · 비로그인 시 숫자 전부 null `page.tsx:66-72` | ○ 가까운 면으로 대체 권유 |
| 로딩 | 암묵 | facet 요약 로딩 중엔 'recognize' 로 조용히 대체 `PracticeChooser.tsx:58-59,79` — 준비 후 Lead 가 바뀔 수 있음(추정: 레이아웃 점프) | — |
| 오류 | 암묵 | facet 실패도 동일 대체(`ready=null`) — 고지 없음 | ✗ |
| 부분 | 있음 | 면별 대기·통과 수 없으면 안 그림 `:83-96` | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: 면별 facet 분포(`/api/wordvault/facets`) · 실제 큐 크기 — 역할: **칩·숫자**("대기 n개", "p/t 통과" `:196-199,224-228`)
- 형태 씨앗: 없음
- 학습과학 원칙: #3 Desirable Difficulty(약한 면 우선) · #6 Cognitive Load(도구 선택 판단 제거)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 30–36px "연습" + LeadCard(`rounded-ios-2xl shadow-ios-1` `:202-205`) + 2열 카드 격자 시작(`:152`)
- 골격 판정: **강조 카드 1 + 2열 카드 격자** — G1 축 없음
- 평균 신호(정적): 1 (float-hover 1) — "그라디언트 0 · 이모지 0" 의도적 정리(`page.tsx:15-21`)

## 근거
- `apps/web/src/app/(main)/practice/page.tsx:51-65` — 각 도구가 실제 쓰는 큐 함수를 그대로 호출
- `apps/web/src/app/(main)/practice/PracticeChooser.tsx:78-80` — "계산된 사실일 때만 가장 무른 곳"
