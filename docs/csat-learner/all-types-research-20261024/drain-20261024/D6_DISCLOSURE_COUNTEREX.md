# D6 — 정답 공개 · 학습자 제어 반례 후보 (T-0140 코드 읽기 전용)

> 연구 산출물. T-0140 판정을 대신하지 않는다(독립 리뷰 r3 = REJECT, 실계정 화면 검증 미완료). 작성: Claude 서브에이전트(내부 검토).
> 대상: `feat/lecture-learner-control@6eb6f3451` — `git show 6eb6f3451:<path>` 로만 읽음. 실행 · 수정 없음. **모든 항목 확인 방법 = 정적 분석만**(브라우저 · 단위 실행 안 함).
> 계약: 37f8b7219 의 14(결정 1 R1~R5 · 결정 2 D2-A~D) · 17 · 21 §6(U1~U6) · 23 · 24. 줄 번호는 6eb6f3451 기준.
> 약어: AT = `apps/web/src/components/csat/theater/AnalysisTheater.tsx` · LS = `apps/web/src/components/csat/lecture/LectureStage.tsx` · TH = `apps/web/src/lib/csat/theater.ts` · PG = `apps/web/src/app/(app)/csat/item/[slug]/page.tsx`

## KNOWN 확인(신규로 세지 않음)

| 출처 | 내용 | 6eb6f3451 상태(정적) |
|---|---|---|
| Codex r1 P1 | 레일 오답 번호 마스킹 정규식 `d` | 수정 — TH:107 `\d` |
| Codex r1 P2 | 경계 자동 도달 시 포커스 탈취 | 수정 — AT:891-905 byLearner 만 focus |
| Codex r2 P2 | 일시정지 중 경계 뒤 레일 → 재개 · 멈춤 미정지 | 수정 — AT:311-314 pauseLecture, AT:922-925 |
| Codex r3 | AnalysisTheater 통합 화면 실검증 부재(BLOCKED_AUTH) | 미해결(검증 공백) |
| 14 D2-A / route.ts:9 주석 | 같은 학습자가 `scope` 없이 전체(정답 포함) 강의 수신 가능 — 보안 경계 아님 | 정책상 허용 |
| 14 D2-B | UI 정답 미표시 「미구현」 | 아래 D6-01 이 그 구체 경로 |
| 23 §(P6) · 14 R5 | 경계 통과(answer_viewed) 기록 미구현 | 아래 D6-05 참조 |

## 반례 후보

### D6-01 · P1(실제품, 계약) · KNOWN(14 D2-B 미구현) 의 구체화 — 「정답 직접 안내 전까지」 를 골라도 같은 화면 블록이 정답을 표시
- 위치: TH:182-185(head 블록 칩 `정답 ⓝ`) · TH:216-227(`analysis:answer` 블록 칩에 정답 번호) · TH:236-250(오답 블록 제목 `ⓝ가 왜 아닌가` — 번호가 정답 외 전부) · PG:144,243(blocks 를 RSC props 로 전달) · PG:287(`gate.answer`) · AT:796-797 주석 「모든 블록은 처음부터 읽을 수 있다(F03)」 · AT:1424-1431 렌더.
- 재현: 문항 해설 화면 진입 → 강의 경로 「정답 직접 안내 전까지」 선택 → 해당 장면(블록이 속한 장면) 열기.
- 기대(14 R4 · 21 U4): 화면 정답 표시 · 오답 소거 · 역할 라벨이 **강의와 같은 공개 상태**를 읽는다. 실제: 레일만 마스킹(TH:106-108)하고 블록 · RSC payload · DOM 에는 정답 번호와 오답 번호 4개가 처음부터 있다. until 경로의 약속(대본 · 음성 · 강조 범위 제한)은 지켜지지만 단일 공개 상태는 아니다. T-0140 의 마스킹(TH:103 주석의 근거 「남은 번호가 정답」)이 같은 화면의 블록 제목에는 적용되지 않는 비대칭.
- 비고: 화면 진입 자체를 `viewed_first` 로 기록(AT:403-411)하므로 제품이 「해설 화면 = 공개됨」 으로 보는 설계일 수 있다. 그렇다면 until 경로의 의미(무엇을 보호하는가)를 계약에 명시해야 함 — **제품 결정 필요**.

### D6-02 · P2(실제품) · 신규 — ←/→ 키로 경계 뒤 차례로 이동하면 경계 확인 없이 정답 블록이 강조됨
- 위치: AT:913-918 `move()` 는 `goto()`(AT:919-928)의 `index >= stopAt` 검사를 거치지 않는다. `playing`=false(idle · ended) 면 `setCursor(to)` 만 한다. AT:831 `liveKey` 가 그 step 의 targetKey 로 블록 `data-live` 를 켠다.
- 재현: until 선택 → 경계 직전까지 재생해 `ended`(AT:904 atBoundary 표시) → 본문 포커스에서 → 키 반복 → cursor 가 stopAt 이상. 다음 차례가 `analysis:answer`(23 R2 경계 정의 「정답 블록 강조」) 이면 그 블록이 live 강조.
- 기대(21 U3 · U4 「소거 강조도 같은 경계를 넘지 않는다」): 레일 클릭과 같이 경계 안내를 연다. 실제: 강조만 경계를 넘는다(음성 · 대본은 안 넘음 — 공개 수준 불일치). 레일 차례 이름도 경계 뒤를 그대로 보인다(마스킹 대상은 오답 번호뿐).
- 확인 방법: 정적 분석만. `blockKeyForTarget`(TH:294-299)이 `analysis:answer` 를 그대로 돌려주는지 = blockKeys 에 있으면 그렇다(TH:295).

### D6-03 · P2(실제품, 계약) · 신규 — 경계 안내에 「건너뛰기」 없음
- 위치: AT:1120-1148 — 선택지 = 계속 듣기(정답 공개) / 여기서 멈춤 / 원문 분석으로.
- 기대(14 R3 · 21 U3): 계속 / **이 구간 건너뛰기** / 여기서 멈춤. 실제: 정답 구간 뒤(절차 · 어휘 등 경계 후 비정답 cue)로 넘어가 계속 듣는 경로가 없다 — 「계속」 은 `lec.start(stopAt,'full')`(AT:910) 로 정답 cue 부터 재생. until 응답에는 경계 뒤 cue 가 없으므로(route.ts:56) 건너뛰기는 서버 범위 설계부터 필요.

### D6-04 · P2(실제품, 계약 해석) · 연구 쟁점 — 경계 앞 결정적 단서가 확정된 강의에도 until 경로 제공
- 위치: `apps/web/src/lib/csat/lecture/disclosure-data.json` 실측(정적 집계): 796항목 중 preStopRisk `decisive_confirmed` 254 · `decisive_possible` 5 · `hint` 500 · `none` 37 · stopBefore=0 3. AT:877-879 untilOk 는 risk 와 무관. 안내 문구만 다르다(disclosure-copy.ts:9).
- 기대(21 U3 「누적 소거 DECISIVE(R7) 도 같은 경계로 본다」): 결정적 단서 cue 가 경계. 실제: 254 강의는 경계 앞에서 답이 사실상 정해짐을 알리고도 「정답 직접 안내 전까지」 를 그대로 내준다. 23 의 「경계 앞 cue 가 최종 ANSWER 이면 당긴다」 규칙과 R7 처리 범위가 일치하는지 **UNKNOWN**(cue 916 재판정 안 함 — 24 소관). 이름 「정답 직접 안내 전까지」 가 학습자에게 「그 전엔 답이 안 나온다」 로 읽힐 위험.
- 수치 메모: 데이터 796 항목 vs 00_ASSIGNMENT 의 main 실측 792 — 이 브랜치 lecture-data 와 main 차이 여부 NOT_VERIFIED. 결속은 요청마다 version · cues · digest 로 검사(disclosure.ts:30-36)하므로 어긋난 강의는 409 → until 숨김(fail-closed).

### D6-05 · P2(실제품) · KNOWN(14 R5 · 23 P6) 의 구체 경로 — 경계 통과 · 경로 선택이 기록 · 공유되지 않음
- 위치: `lecturePath` · `atBoundary` 는 컴포넌트 state 뿐(AT:869-872). `continuePastBoundary`(AT:907-911)에 기록 · track 없음(AT 의 track 호출 중 lecture/path/boundary 관련은 finder 1건뿐, AT:317).
- 재현: 탭 A 에서 until → 계속(정답 들음) → 새로고침 또는 탭 B 로 같은 문항. 기대(21 U5 「answer_viewed(경계를 넘은 시각 포함)」): 정답 청취 이력이 남고 다른 화면이 같은 공개 상태를 안다. 실제: 다시 미선택 상태(chooser)로 시작, 탭 간 정합 없음. 해가 큰 쪽은 「청취 뒤 독립 시도」 오분류 — 단 화면 진입이 이미 viewed_first 이므로 숙달 오산입 영향은 제한적(AT:403-411).

### D6-06 · P3(실제품) · 신규 — 경계 뒤 레일 차례의 마스킹 범위가 오답 번호뿐
- 위치: TH:106-108. 정답 step 이름 「답이 왜 이것인가」(TH:69) · anchor 「n번째 문장」 · 순서 · 개수는 그대로. 정답 번호 자체는 없음.
- 의미: 레일에서 경계 뒤 차례 구성(소거 몇 개 뒤 정답 설명)이 선택 전에 보인다. 결정적 암시는 아님(번호 없음) — 단 D6-01 이 있는 한 실익 없음. 정적 분석만.

### D6-07 · P3 · 확인 결과 반례 아님(기록)
- 서버 범위 절단: until 응답은 `cues.slice(0, stopBefore)`(disclosure.ts:40-42) — 음성 · 대본 탭(LS:197-203 cues) · 블록 클릭 이동(LS:418-431, cues 에서만 찾음)은 같은 범위. 네트워크 응답에 경계 뒤 cue 없음(until).
- 범위 전환: until→full 은 플레이어 파기 후 재수신(LS:161-169). 로딩 중 Space/주버튼 → `toggle()` → `start(…, undefined)` 지만 `loading.current` 가 진행 중 요청(until)을 돌려줘(LS:170) full 로 새지 않음. 단 이 보호는 호출 순서에 의존 — 로딩 실패 직후(loading.current=null, LS:209) 플레이어 없이 toggle 이 불리면 `scopeRef ?? 'full'` 로 **full** 요청이 된다(LS:227,251). AT 는 error 에서 requestPlay 로 가서(AT:957,1082) 현재 경로상 도달 불가로 판단 — NOT_VERIFIED(실행 안 함).
- 결속 불일치: page(PG:143)와 route(route.ts:48) 모두 같은 함수로 재계산 → 불일치면 until 미제공 / 409 → chooser 재개(AT:899-903). 추정 절단 없음.
- 자동 따라가기 해제/재개: AT:1157-1163 버튼 · AT:937-942 레일 스크롤 억제 — 17 하네스 범위, 신규 반례 없음.

## 조사 범위(실제로 본 개수)
- 코드 파일 9: route.ts · disclosure.ts · disclosure-copy.ts · disclosure-data.json(집계) · theater.ts(부분) · player.ts(부분) · LectureStage.tsx(부분) · AnalysisTheater.tsx(약 300줄: 300-330, 395-425, 755-1010, 1100-1190 + grep) · page.tsx(부분).
- 계약 문서 4: 14 결정 1·2 · 17 · 21 §6 · 23(grep). 24 는 grep 만(916 재판정 안 함).
- AI-Control 리뷰 3: T-0140 Codex r1 · r2 · r3.
- 보지 않음: e2e spec · 단위 테스트 본문 · LecturePlayerBar · targets/focus/speakable/tts · lecture-data JSON 본문.

## 완료/부분/미완료
- 완료: 중점 반례 11축 중 정답 직접 공개 전 암시(D6-01·04·06) · 누적 소거(D6-04, 916 재판정 없이 데이터 집계만) · 공개 수준 불일치(D6-01·02) · sidecar 결속(D6-07) · 장면 이동/경계 직전 정지/건너뛰기(D6-02·03) · 이력 보존 · 탭 정합(D6-05) · API 정답 수신(KNOWN D2-A, until 은 미수신 D6-07).
- 부분: UNKNOWN · 누적 상태 미확정 — D6-04 의 R7 처리 일치 여부 UNKNOWN. ARIA — AT:1184-1187 문구만 확인, 스크린리더 실측 없음.

## 미검증
- 모든 항목 정적 분석만 — 브라우저 · 단위 실행 없음. 실계정 AnalysisTheater 화면: BLOCKED_AUTH(17 · r3).
- D6-02 실제 키 이벤트 경로(포커스 위치 · 다른 핸들러 선점) NOT_VERIFIED.
- disclosure-data 796 vs main 792 차이 원인 NOT_VERIFIED.
