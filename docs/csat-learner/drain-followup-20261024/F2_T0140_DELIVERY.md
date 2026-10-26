# T-0140 owner 전달 — drain D6 반례 3건(연구 자료)

> 받는 쪽: owner `csat-lecture-disclosure` · T-0140(BLOCKED_AUTH) · 기준 `feat/lecture-learner-control@6eb6f3451`.
> 보낸 쪽: drain 총괄 세션(작성자 아님 · T-0140 판정·상태·코드 변경 없음). 원 근거: `backup/research-drain-20261024@3d0079043` `docs/csat-learner/all-types-research-20261024/drain-20261024/D6_DISCLOSURE_COUNTEREX.md`.
> 확인 수준: 셋 다 **정적 분석**. 브라우저·jsdom 실행 재현 없음(AnalysisTheater 를 로그인 없이 띄우는 격리 하네스가 없다 — D7 F6). Codex r3 의 「P0/P1/P2 없음」 판정을 뒤집는 주장이 아니라 **r3 이 다루지 않은 경로**다.

## D6-02 — `move()` 가 경계 안내를 건너뛴다(총괄 직접 확인)

- 코드: `AnalysisTheater.tsx:913-918` `move()` 는 `playing && lec` 가 아니면 `setCursor(to)` — `goto()`(919~)의 `lecturePath==='until' && index >= stopAt` 검사를 거치지 않는다. 호출처: ←/→ 키(961-966) · 「이전/다음 차례」 단추(1595 · 1601).
- 강조: `liveKey`(831)는 강의가 playing/paused 가 아니면 `step.targetKey` 를 쓴다 → idle · ended 에서 cursor 가 경계 뒤로 가면 그 블록에 `data-live=true`.
- 재현 조건: 「정답 직접 안내 전까지」 선택 → 경계까지 재생 끝(status=ended, 경계 안내 열림) 또는 강의 시작 전(idle) → → 키 반복 / 「다음 차례」 단추.
- 기대(17 계약 R3·U3): 경계 뒤 차례 진입은 경계 안내로 막힌다. 실제(코드): cursor 가 넘어가고 정답 블록이 강조된다.
- **새는 것:** 강조뿐. 음성·대본은 `requestPlay → untilFrom` 과 서버 `scope=until` 절단으로 넘지 않는다. 블록 본문은 F03(「모든 블록은 처음부터 읽을 수 있다」, 790행)로 원래 보이므로 새 정보 노출은 D6-01 에 포함된다. → 등급 P2(공개 수준 불일치) · 정보 유출 자체는 D6-01.
- 격리 재현 테스트(제안): jsdom 에서 `AnalysisTheater` 를 `lectureDisclosure={status:'VERIFIED', stopBefore:k}` · `steps` 경계 뒤 1개 이상으로 렌더 → path-until 선택 → `lec.status='ended'` 로 만든 뒤 `keydown ArrowRight` → 단정: 경계 안내가 열리고 `[data-live="true"]` 가 경계 뒤 블록이 아니다. 같은 단정을 「다음 차례」 단추로 반복.
- 최소 수정 방향: `move()` 의 비재생 분기를 `goto(to)` 로 보내 경계 검사를 한 곳으로 모은다.

## D6-01 — 「정답 직접 안내 전까지」 에서도 정답 칩·오답 번호가 처음부터 DOM 에 있다

- 근거: `theater.ts:182-227`(head 칩 `정답 ⓝ` · answer 블록 칩) · `236-250`(오답 블록 제목 번호)이 RSC props·DOM 에 처음부터 실린다. 레일만 마스킹.
- 충돌 확인 필요: P6 에서 고른 「정답 블록 지연 서버 조회」 계약(연구 25·26 — 다른 세션 커밋 613215067 · 976e8ab0a, 미수용)과 같은 방향인지. 이 경로가 무엇을 보호하는지(강의 음성만 vs 화면 전체)는 **제품 결정**이 먼저다.
- 재현: path-until 선택 직후 DOM 에서 `data-kind="answer"` 블록 · head 칩 텍스트 확인(실행 미검증).

## D6-03 — 경계 안내에 「건너뛰기」 가 없다

- 근거: 경계 안내 선택지가 계속(=`continuePastBoundary`, `lec.start(stopAt,…,'full')` — 정답 cue 부터) · 멈춤 · 원문뿐. 계약 R3·U3 의 「정답 안내를 건너뛰고 다음으로」 가 없다.
- 주의: 건너뛰기를 「경계 뒤 cue 를 재생하지 않고 다음 장면/차례로」 로 만들면 D6-02 와 같은 강조 우회가 다시 생긴다 — 건너뛰기도 `goto` 경계 검사를 거치고, 정답 블록 강조를 켜지 않게 해야 한다.

## 함께 넘기는 관련 사실

- 2015#25 는 DB `answers=[4,5]`(평가원 2014-11-24 복수정답, 보도 확인) — sidecar·`disclosure-data.json` 은 `official_answer=4` 단일. 이 강의의 ⑤ 언급 cue 는 경계 계산에서 HINT 로만 분류된다(상세 F3).
