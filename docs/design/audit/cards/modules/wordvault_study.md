# S060 `/wordvault/study` — WordVault 학습 (큰 카드 · 3단 공개 · 5단 자가평가)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "모은 단어를 하나씩 익힐 때, 단어만 보고 떠올린 뒤 뜻·예문을 차례로 열고 얼마나 알았는지 평가하고 싶다"
- 주 사용자: 학생 · 인지 계층: L3 능동 부호화(자가평가는 FSRS 로 적재)

## 흐름
- 진입: /wordvault 세그먼트 「학습」(`components/wordvault/hub/WordVaultHubChrome.tsx:42`) · browse 기억 필터 바 `?filter=state:*`(`components/wordvault/MemoryFilterBar.tsx:78`, 템플릿)
- 단계: 1. 단어·품사·수준 + 발음(느리게/보통) 2. 뜻 공개 3. 예문 공개 4. 1–5 평가 5. 다음 — 마지막이면 완료
- 완료 조건: 마지막 평가 → flush + 완료 화면(`components/wordvault/StudyMode.tsx:121-124`, `WordVaultStudyClient.tsx:74-105`)
- 1차 행동: 평가 5버튼(`StudyMode.tsx:330-350`) — 키보드 1–5(`:169`) · 보조: 발음, 설정(`:214`)
- 나가는 길: ← 종료 → backHref(`?from` 해석 `app/(main)/wordvault/study/page.tsx:51`) · 완료 후 돌아가기 / 내 단어 보기(`WordVaultStudyClient.tsx:88-101`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | 단어 0 → "오늘 학습할 단어가 아직 없어요"(`WordVaultStudyClient.tsx:39-64`) | △ /wordvault/browse — 단어를 **모으는** 곳(/library·/text)이 아니라 빈 목록으로 보냄 |
| 로딩 | 전역만 | 서버 조회(`study/page.tsx:45`) | — |
| 오류 | 없음 | `fetchStudyVocabularies` throw(`lib/wordvault/study-queries.ts:57`) → `app/error.tsx` | 전역 |
| 부분 | 있음 | 중도 이탈해도 평가 flush(`StudyMode.tsx:59-` 주석) | — |
| 완료 | 있음 | "오늘 잘 마쳤어요" + 두 길(`WordVaultStudyClient.tsx:74-105`) — 폭죽 없음 | ○ |

## 자산
- N1 자산: FSRS(평가 → `applyReview` `StudyMode.tsx:104-110`, 5→4 매핑 `lib/srs/rating-mapper.ts:42`) — 역할: **없음/거짓 숫자**: 버튼 아래 간격 "10 min·1 day·3 days·7 days·14 days" 는 **상수**(`StudyMode.tsx:42-48`) — FSRS 가 계산한 다음 간격이 아님(Flashcard 는 계산값 `components/flashcard/SRSBar.tsx:97`). I5「상수 금지」 위반
- 형태 씨앗: 없음 · R(t) 상태 표시 0
- 학습과학 원칙: #1 Active Recall(단계 공개) · #4 Dual Coding(발음) · #2(FSRS 적재)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 상단 바(종료·6px 진행 바·설정 `:183-219`) → `rounded-3xl` 520px 카드(`:223`) 안 64px 세리프 단어 + 블러 원형 장식(`:224-231`) + 60px 발음 버튼 둘(🐢 이모지 `:258-261`)
- 골격 판정: **단일 카드**(Flashcard 와 같은 역할의 두 번째 구현) — 풀스크린 아님(사이드바 유지, `lib/layout/full-screen-routes.ts:59-65` 목록 밖)
- 모션: 진행 바 ○(`:196`) · 뜻/예문 `revealIn` 320ms(`:293,307`) △ 페이드지만 300ms 초과 · 발음 버튼 `audio-glow` infinite(`:273`) ✗ 루프 · 평가/발음 hover `-translate-y-1`+그림자(`:258,271,338`) △ · 카드 뒤집기 없음
- 평균 신호(정적): 17 (rounded-big 7 · shadow-heavy 4 · float-hover 4 · gradient 1 · infinite-anim 1) · 하드코딩 `#2563EB`·`rgba(59,130,246)`(`:196,271-272`)

## 근거
- `apps/web/src/components/wordvault/StudyMode.tsx:199-201` — 파랑→보라 그라디언트 제거 이력(AI 표식)
