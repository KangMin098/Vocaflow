# S024 `/dictate` — 받아쓰기 허브 (오늘의 5문장 + 자료 고르기)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "듣기·쓰기를 굳히고 싶을 때, 시스템이 골라 둔 오늘의 문장을 바로 시작하거나 내 자료를 골라 받아쓰고 싶다"
- 주 사용자: 학생 · 인지 계층: L6 완성(`docs/MODULES.md:28`)

## 흐름
- 진입: 사이드바(`components/layout/sidebar-config.ts:263`) · /dictate/results · /dictate/setup · /text/[id]/echo · 세션 닫기(`components/layout/SessionFrame.tsx:46`)
- 단계: 1. 히어로(이번 주 %·청취 폭·연속) 2. (있으면) 이어하기 3. 오늘의 받아쓰기 카드(구성 근거 칩) 4. 시작하기 — 또는 자료 탭(도서·스크립트·단어장) → setup
- 완료 조건: 세션 생성 후 `/dictate/session?sessionId=`(`components/dictation/DictationHubClient.tsx:103`)
- 1차 행동: 오늘의 받아쓰기 「시작하기」(`DictationHubClient.tsx:340-358`) · 보조: 이어하기(`:150-158`), 자료 고르기, 최근 결과
- 나가는 길: /dictate/session · /dictate/setup · /dictate/results · /library · /text/new · /wordvault

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 오늘 카드 점선 안내(`DictationHubClient.tsx:290-300`) · 탭별 빈 문구+링크(`components/dictation/SourcePicker.tsx:36-50,180-190`) | ○ 탭마다 /library · /text/new · /wordvault (오늘 카드 자체엔 링크 ✗) |
| 로딩 | 버튼만 | 서버 조립이라 화면 로딩 없음(`:288`) · 시작 중 스피너(`:347-351`) | — |
| 오류 | 있음 | 조회 실패 alert + 다시 시도(`:162-179`) · 히어로 '—'(`:120-125`) · 시작 실패 사유(`:183-190`) | ○ |
| 부분 | 있음 | 미완주 세션 이어하기(`:150`) | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: FSRS 복습 임박 단어 수·놓친 문장·청취 폭 — 역할: **칩·숫자**(ReasonChip `:330-338`, 히어로 수치)
- 형태 씨앗: 없음
- 학습과학 원칙: #1 Free Recall(L6) · #2(임박 단어로 문장 구성) · #7(연속일 카피 `:113-116`)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: **비-quiet** ModuleHero 그라디언트 띠(`#0EA5E9→#1D4ED8`, `:139-147`) → 오늘 카드(`bg-gradient-to-br` + 그라디언트 버튼 `:306-345`) → 자료 탭 카드
- 골격 판정: **카드 목록**(히어로·오늘·자료·약점·최근 5장 세로). **공유 골격 ★** ModuleHero 사용 — PRACTICE 4허브는 quiet 로 조용해졌는데 이 화면만 고채도 면이 남음(`components/hub/ModuleHero.tsx:36-39` 판단과 불일치)
- 평균 신호(정적): 6 (gradient 4 · float-hover 2)

## 근거
- `apps/web/src/app/(main)/dictate/page.tsx:4-11` — 클라이언트 요청 15건 → 서버 조립 전환, 실패를 빈 상태로 내리지 않음
- `apps/web/src/app/(main)/dictate/page.tsx:30` — 비로그인 서버 redirect(형제 허브와 달리 로그인 경로 명확)
