# S065 `/scriptquiz/play` — ScriptQuiz 세션 (챕터 이해 확인)

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "읽은 챕터를 확인할 때, 본문 근거로 푸는 문항을 하나씩 풀고 틀린 것은 근거 문장과 함께 되짚고 싶다"
- 주 사용자: 학생 · 인지 계층: L5 정복(Recognition + Transfer)

## 흐름
- 진입: /scriptquiz 대기열(`?book=&ch=` 템플릿 `components/game/scriptquiz/ScriptQuizQueue.tsx:53`) · `?text=`(개인 퀴즈) · SessionFrame 단계 콤보(`components/layout/SessionFrame.tsx:79`, 파라미터 없음)
- 단계: 1. Start 화면(제목·문항 수·시간 3칸) 2. 문항(4지/OX) 선택 → 서버 채점 → 근거 문장 3. 다음 4. 결과(링 + 3칸 + 오답 복습)
- 완료 조건: 마지막 문항 → `setScreen('result')`(`components/game/scriptquiz/ScriptQuiz.tsx:222`)
- 1차 행동: 선택지 선택·제출 · 보조: 한국어 보조(`?ko=1`), 다시 풀기(`ScriptQuiz.tsx:995`)
- 나가는 길: 결과 /wordvault(`:1003`) · SessionFrame 닫기 → /scriptquiz(`SessionFrame.tsx:45`)

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | **목업으로 덮음** | 세션 없음(파라미터 없음·비로그인 `?text=`·조회 실패) → `MOCK_SESSION` "The Great Gatsby (데모)"(`app/(main)/scriptquiz/play/page.tsx:7,59-64`, `ScriptQuiz.tsx:70`) | △ 셸 라벨에 "(데모)"·"(샘플)"만, 본문은 실제처럼 진행 |
| 로딩 | 전역만 | 서버 조회 — `app/loading.tsx` | — |
| 오류 | 있음 | 채점 실패 alert "오답 처리하지 않았어요"(`ScriptQuiz.tsx:531-545`) | ○ 다시 고르기 |
| 부분 | 있음 | 상단 sticky 진행 바 + n/N(`:489-510`) | — |
| 완료 | 있음 | "오늘 잘 마쳤어요" + 정확도 링 + 3칸 + 오답 복습(`:852-929`) | ○ 다시 풀기 / WordVault |

## 자산
- N1 자산: `library_chapter_quiz`(큐레이션 드레인 산출) · 근거 스니펫(`sourceSnippet` `:84`) — 역할: **산문(근거 문장)**. FSRS·R(t) 결합 없음(`docs/design/00-form-seeds.md` 계보 축 "코드 0")
- 형태 씨앗: 없음 — 오답→다음 문항 사슬(G1 계보)의 정확한 자리
- 학습과학 원칙: #5 Context-Dependent(본문 근거) · #1 Active Recall

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트(Start): 64–80px **그라디언트 글자** "ScriptQuiz"(`#5BC8F5→#1A7AB8` `bg-clip-text` `:368-370`) → `rounded-2xl shadow-md` 카드 안 책 제목 + `grid-cols-3` 통계(`:392`) → 시작 버튼(`:426-427`)
- 골격 판정: **카드 + 점수 히어로**(Start·Result 모두 3칸 통계) — **공유 골격 ★** 결과 틀이 dictate/pairflip 결과와 동일(`:859-898`)
- 모션: 진행 바 ○(`:496-497`) · O/X 오버레이 `feedbackPop` scale 0.5→1.1→1, 140px 전면 고정(`:313-346`) △ 정답 scale 류지만 전면 오버레이 · 선택지 hover `scale-[1.02]`(`:648`) △ · 결과 링 stroke 1s(`:883`) ✗ 예산(1s) 경계 · **이 모듈은 `components/game/` 에 있어 learning-tone 회귀에서 제외**(`components/__tests__/learning-tone.test.ts:18-24`) — L5 학습 모듈인데 아케이드 예외를 받는다
- 평균 신호(정적): 8 (gradient 3 · grid-3eq 2 · glass 2 · ai-purple 1)

## 근거
- `apps/web/src/app/(main)/scriptquiz/play/page.tsx:49-52` — 「본문으로」가 book id 를 text id 로 넘겨 목업 폴백되던 버그 수정 이력
