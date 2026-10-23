# D7 — 실제 제품 수용 테스트 공백 설계

> 연구 산출물(설계만). 테스트 코드·E2E 스펙을 쓰거나 고치지 않았다. 아무 테스트도 실행하지 않았다 — 아래의 「덮음」은 **소스를 읽어 단정 내용을 확인한 것**이지 실행 PASS 가 아니다.
> 기준: main `e3e0a6a0e`(배정표) · feat/lecture-learner-control `6eb6f3451` · 연구 `37f8b7219`(17_LEARNER_CONTROL_GATE · harness-results.json). 작성 Claude 서브에이전트 D7.

## 0. 실행 환경 표기

| 표기 | 뜻 |
|---|---|
| ISO-PG | `tests/e2e-isolated*` 계열(PGlite 격리 + 로컬 Chromium, 로그인 없는 고정 하네스) |
| HARNESS | LectureStage 단독 브라우저 하네스(17 §2) |
| UNIT | vitest(소스 계약 가드 · 라우트 모의) |
| REAL | 실계정 storageState + dev 서버 실제 문항 화면 — `PLAYWRIGHT_RUNTIME_PASSWORD` 부재로 **BLOCKED_AUTH**(17 §2 KNOWN) |

## 1. 동작별 표

각 행: 기존 덮음(파일:테스트 — 단정) → 공백 → 제안(전제 / 조작 / 관측 / 합격) → 환경.

### D7-01 1280/1440 실제 화면
- 덮음: `tests/e2e/csat-lecture-learner-control.spec.ts` `① ② ③ ④ ${width}px`(1280·1440, 장면·선택·스크롤 유지) · `csat-lecture-disclosure.spec.ts` 동일 폭 — 둘 다 REAL 이라 **미실행(BLOCKED_AUTH, KNOWN 17 §2)**. HARNESS 32/32 는 LectureStage 만(17 §2 「못 보는 것」).
- 공백: AnalysisTheater 전체 레이아웃(원문·근거·선지 3영역이 1280 에서 가로 넘침/겹침 없음)을 실측하는 검사 없음. `workspace-geometry.test.ts`·`meaning-panel-geometry.test.ts` 는 CSS 수치 계약(UNIT)이지 렌더 폭이 아님.
- 제안: 전제 — 고정 문항 픽스처 3종(일반 독해 · 도표 · 장문). 조작 — 1280×800, 1440×900 진입. 관측 — `document.scrollingElement.scrollWidth`, 세 영역 bounding box. 합격 — 가로 스크롤 0 · 영역 교차 0 · 선지 5개 모두 첫 뷰 또는 영역 내부 스크롤로 도달.
- 환경: ISO-PG 로 **AnalysisTheater 를 띄우는 하네스가 새로 필요**(현재 ISO 하네스는 system-learning·v31-meaning 뿐). 없으면 REAL → BLOCKED_AUTH.

### D7-02 AnalysisTheater 전체 경로(진입→예측/확정→공개→강의→종료)
- 덮음: `46-csat-lecture.spec.ts` ①②③(375px·키보드·목소리 없음 — **데스크톱 범위 밖**, 문서 범위 결정과 어긋남) · `csat-learning-loop.spec.ts`(NOT_VERIFIED: 단정 내용 미확인) · `learning-session.test.ts`(상태기계 UNIT: 공개 전 마침 불가·멱등 등).
- 공백: 한 화면에서 「확정 → 공개 → 강의 경로 선택 → 경계 정지 → 계속 → 끝 → 처음부터 다시」를 잇는 PC 폭 E2E 없음. 서버 기록(`/api/csat/item/[slug]/reveal`)이 실제로 1건 남는지 확인 없음.
- 제안: 조작 — 위 순서를 키보드만으로. 관측 — 단계별 `data-stage`, reveal POST 횟수·응답 `outcome`, 새로고침 후 재개 위치. 합격 — reveal 정확히 1회(`applied`, 재전송 `duplicate`) · 새로고침 후 같은 세션 · 「처음부터 다시」 후 옛 완료 보존.
- 환경: REAL(BLOCKED_AUTH). ISO-PG 로 옮기려면 learning_session_apply 를 PGlite 에 올린 하네스 필요.

### D7-03 원문↔근거↔선지 양방향 탐색
- 덮음: `csat-system-learning.browser.spec.ts` 「선택지를 바꾸면 해설 하나와 해당 원문 연결이 함께 바뀐다」(ISO-PG, 선지→원문 한 방향) · `46-csat-lecture` ⑤ 「설명 블록을 누르면 그 블록을 설명하는 큐로」 · `EvidenceQuote.test.tsx`·`quote-match.test.ts`(UNIT 매칭).
- 공백: **원문 문장 → 그 문장을 근거로 쓰는 선지/분석 블록** 역방향, 그리고 왕복 뒤 원래 선택 복귀가 없다. 근거 없는 선지에서 원문 강조가 「추측 강조」를 하지 않는지 AnalysisTheater 에서 미검.
- 제안: 조작 — 선지 ③ 선택 → 근거 칩 → 원문 문장 활성 → 원문 문장에서 「이 문장을 쓰는 곳」 → 선지 ③ 로 복귀. 관측 — `aria-current`/강조 대상 id, 주소 `meaning`·`rel`. 합격 — 왕복 후 선택·강조 id 원상 · 근거 없는 선지는 강조 0 + 「연결 없음」 문구.
- 환경: ISO-PG(새 AnalysisTheater 하네스) — 인증 불필요하게 설계 가능.

### D7-04 장면·스크롤·포커스 유지(강의 진행 중)
- 덮음: HARNESS 32/32(재생=따라가기 · 휠/Space/Tab/스크롤바 해제 · 큐 진행 중 스크롤·포커스 유지 · 닫은 층 재오픈 안 함) · `theater-delivery-guard.test.ts` 「강의 진행이 장면을 저절로 바꾸지 않는다」·「학습자가 스크롤하면 따라가기가 꺼지고」(소스 문자열 가드) · REAL 스펙 ①~④(미실행).
- 공백(신규로 반복하지 않을 것: 위 HARNESS 항목): **AnalysisTheater 의 장면 안내 단추·고정 안내 줄·포커스 이동**(6f7fbe1ce·2bd99a0f1) 실행 증거 0(KNOWN 17 §3 P2-4). 강의 **종료** 시 안내 줄·포커스 처리(R3 P2-1 해소 커밋 미검증). 장면 전환 후 브라우저 뒤로가기 시 scene·스크롤 복원 미검.
- 제안: 조작 — 강의 끝까지 진행(`lecture-silent`) → 종료 / 안내 단추로 장면 이동 → 뒤로가기. 관측 — `document.activeElement` 이 body 로 떨어지는지, `scene` 쿼리, 스크롤 값. 합격 — 종료 후 포커스가 재생 단추 또는 안내 줄(사라진 요소 아님) · 뒤로가기로 이전 scene·선택 복원.
- 환경: REAL(BLOCKED_AUTH) 또는 ISO-PG 하네스 확장.

### D7-05 Space/Tab/휠/스크롤바 입력
- 덮음: HARNESS(각 입력의 따라가기 해제/유지 — 반복 설계 금지).
- 공백: KNOWN 17 §3 남은 P2 a)(RTL·중클릭 자동 스크롤·키보드 PageDown/Home/End 미감지) · b)(Tab 만으로 해제 불편). **PageDown/End/방향키↓ 로 본문 스크롤** 시 해제 여부 미검(F12 「→ 는 스크롤 키가 아니다」만 사용).
- 제안: 조작 — 재생 중 본문 포커스에서 PageDown·End·↓. 관측 — `lecture-offer-follow` aria-pressed, 다음 큐 후 scrollTop. 합격 — 스크롤 키 3종 모두 해제 + 이후 위치 불변. (Tab 해제는 제품 판단 대기 — 합격 기준 확정 전 UNKNOWN.)
- 환경: HARNESS 로 충분(인증 불필요).

### D7-06 키보드 전체 경로
- 덮음: `46-csat-lecture` ① 「키보드만으로 끝까지」— **375px**(데스크톱 아님) · `csat-system-learning.browser.spec.ts` 「조건을 키보드로 바꾸면」(ISO, 한 패널).
- 공백: PC 폭 AnalysisTheater 에서 진입→선지 확정→공개→경로 선택 대화상자(`lecture-chooser`)→경계 결정(`lecture-boundary-*`)까지 Tab 순서·포커스 가둠·Esc 닫기 미검. 대화상자 닫힌 뒤 포커스 반환 미검.
- 제안: 조작 — 마우스 금지, Tab/Shift+Tab/Enter/Space/Esc 만. 관측 — 포커스 순서 로그, 각 단계 visible focus(outline 폭 ≥2px 또는 box-shadow). 합격 — 모든 단계 도달 · 함정 0 · 대화상자 Esc 후 연 단추로 포커스 복귀 · 포커스 표시 누락 0.
- 환경: ISO-PG(새 하네스) 우선, 아니면 REAL(BLOCKED_AUTH).

### D7-07 스크린리더 안내
- 덮음: 소스 가드만(R3 P2-2 이중 낭독·P2-3 알림 영역 조건부 렌더 → 2bd99a0f1, **독립 재검증 없음** KNOWN 17 §3).
- 공백: live region 이 **처음부터 DOM 에 존재**하는지, 장면 안내·경계 정지·409(경계 미검증)·423(보류) 안내가 각각 한 번만 낭독되는지 실행 검사 없음.
- 제안: 조작 — Playwright accessibility snapshot + `aria-live` 노드 텍스트 변화 기록. 관측 — 이벤트별 live 텍스트 변화 횟수. 합격 — 이벤트당 1회 · 재생/정지 단추 이름이 상태와 일치(aria-pressed 와 라벨 동시 변경 없음). 실제 NVDA 청취는 사람 필요 → NOT_VERIFIED 로 남김.
- 환경: ISO-PG/HARNESS(자동 부분) · 실제 SR 은 범위 밖.

### D7-08 색 대비
- 덮음: `43-csat-map-a11y.spec.ts` 「${theme} — axe WCAG2 A/AA 위반 0」— **학습 지도 하네스만**. AnalysisTheater·강의 레일·경계 패널 axe 없음(검색 결과 0).
- 공백: theater 화면(라이트/다크), Memory Decay 4색 위 글자, 근거 강조색 위 원문 글자 대비.
- 제안: 조작 — 공개 전/후 · 강의 재생 중 · 경계 정지 4상태에서 axe(color-contrast 포함). 합격 — 위반 0, 강조 상태 텍스트 4.5:1 이상.
- 환경: ISO-PG(새 하네스).

### D7-09 정답 공개 전후 상태
- 덮음: `csat-lecture-disclosure.spec.ts` ①~④(REAL 미실행) · `route.test.ts` 「scope=until — 경계 앞 cue 만 · 정답 낭독 없음 · no-store」·「409」·「400」 · `disclosure.test.ts` 결속 7건 · `theater-disclosure-mask.test.ts`(레일 오답 번호 마스킹) · `reveal-gate.test.ts`(정답 칩 가림).
- 공백: (a) **공개 전 화면 DOM/네트워크 전체**(`/structure`·`/task`·RSC payload)에 정답 번호·오답 설계가 없는지 — 레일만 검사됨. (b) `scope=until` 경로에서 강조·소거 표시가 경계 뒤 정보를 쓰지 않는지(화면 측). (c) 409 를 받았을 때 화면 안내 후 재선택 흐름.
- 제안: 조작 — 공개 전 페이지 로드, 모든 응답 본문 수집. 관측 — 정답 번호 패턴·`answer` 키. 합격 — 0건. 409 모의(경계 없는 문항) → 화면 안내 + 경로 재선택, 자동 full 전환 0.
- 환경: (a)(c) REAL(BLOCKED_AUTH) — 서버 라우트가 로그인 요구. (b) HARNESS 확장 가능.

### D7-10 PDF 부재·해시 불일치
- 덮음: `original-paper.test.tsx` 「원본이 없는 캐시는 분석 읽기를 시작하지 않고 재입력을 요구」·「원본이 없으면 예측 화면은…진행하지 않는다」(UNIT 렌더) · `csat-f08-paper-marks.spec.ts`(NOT_VERIFIED 단정 미확인) · `8cd15b7b6` dev-paper 기본 로드 회귀.
- 공백: `POST /api/csat/paper` 의 `known:false`(모르는 sha256) 분기·400(형식) 라우트 테스트 **0**(테스트 파일 없음). 학습자가 다른 회차 PDF 를 놓았을 때(해시는 알려졌지만 문항 회차 불일치) 화면 반응 미검. `dev-paper` 프로덕션 404(`devPaperEnabled`) 테스트 미확인.
- 제안: UNIT — 라우트에 sha 형식 오류/미등록/등록 3입력 → 400/`known:false`/좌표만(글자 없음). E2E — 다른 회차 PDF 투입 → 「이 시험지가 아니에요」류 안내, 분석 시작 0, 업로드 내용 서버 전송 0(해시만).
- 환경: UNIT(인증 모의) · E2E 는 REAL(BLOCKED_AUTH) 또는 ISO-PG.

### D7-11 강의 재생 실패
- 덮음: `46-csat-lecture` ① 목소리 없는 기기(375px) · 라우트 404(강의 없음)·409 UNIT.
- 공백: 강의 API 5xx/타임아웃·네트워크 끊김·TTS `speechSynthesis` 오류 이벤트 중간 발생 시 화면 상태(재생 단추 복귀, 읽기 강의 탭 대체, 학습자 선택 보존) 미검. 401(세션 만료) 시 안내.
- 제안: `page.route('/api/csat/lecture*')` 로 500/지연 30s/401 주입. 합격 — 무한 로딩 0 · 오류 문구 1회 낭독 · 장면·선택 불변 · 재시도 가능.
- 환경: 화면 진입이 로그인 필요 → REAL(BLOCKED_AUTH). HARNESS 에 어댑터 실패 주입은 인증 없이 가능.

### D7-12 접근 권한·미공개 분석 노출(API 직접 호출)
- 덮음: `api/__tests__/route-guards.test.ts`(NOT_VERIFIED: 전 라우트 인증 가드 정적 검사로 추정) · `embargo-gate*.test.ts`(보류 423 · fail-closed · 로더 커버리지) · `state/route.test.ts` 「로그인 없으면 401」 · lecture `route.test.ts`.
- 공백: **lecture `scope=full` 은 UI 계약이지 보안 경계가 아니다**(route.ts 주석 — 같은 학습자가 경계 전에 전체 정답 강의를 받는다) → 이를 「알려진 허용」으로 고정하는 테스트도, 막는 테스트도 없음(제품 판단 필요, D6 영역과 겹침 — 판단은 D6). 비로그인 직접 호출을 **실제 서버**에 보내는 검사 없음(UNIT 모의뿐). 미공개(analysis 미발행·held) 문항의 `/structure`·`/task`·`/lecture` 직접 호출 실서버 검사 없음. `/item/[slug]/reveal` 은 embargo 관문을 부르지 않음(기록만 남김 — 정답 비노출이라 위험 낮음, 확인용).
- 제안: dev 서버에 쿠키 없이 GET/POST 전 csat 학습자 라우트 → 401 표. 보류 문항 slug 로 로그인 호출 → 423 `held` no-store. 다른 계정 userId 로 reveal → 409 `dropped`. 합격 — 표 전 칸 기대 코드, 본문에 cue/정답 키 0.
- 환경: 비로그인 부분은 로컬 dev 서버로 **인증 없이 실행 가능**. 로그인 부분 REAL(BLOCKED_AUTH).

### D7-13 직접 수행과 숙달 기록 분리
- 덮음: `learning-session.test.ts` 「확정은 independent · 모르겠어요는 viewed_first, 한 번 정한 help 는 바뀌지 않는다」·「두 기기가 다르게 공개하면 먼저 공개한 쪽」 등 UNIT · `csat-system-learning` 「채점·완료 관문 없음」(ISO).
- 공백: **강의 `full` 청취·경계 뒤 계속 후의 확인 과제(`/task`)가 helpLevel 을 independent 로 보낼 수 있는지** 서버 측 검사 없음(서버는 클라이언트 helpLevel 을 받음 — NOT_VERIFIED, product-server 미열람). 탐색·클릭이 숙달 산입되지 않는지(정책 learning_interaction) DB 행 수준 검증 없음.
- 제안: 조작 — 공개(viewed_first) 후 같은 문항 task 제출 helpLevel=independent 위조. 관측 — learning_task_attempts·session 행의 help_level·explanation_viewed_at. 합격 — 서버가 공개 이력 기준으로 강등(또는 거부) · 탐색 이벤트만으로 attempts 증가 0.
- 환경: ISO-PG(PGlite 에 learning_session_apply·task 스키마) — 인증 모의 가능. 실DB 는 SELECT 확인만.

## 2. 우선순위 상위 10(학습 목표 · 위험)

| 순위 | ID | 이유 | 환경 | 지금 실행 가능? |
|---|---|---|---|---|
| 1 | D7-09(a) 공개 전 전체 응답 정답 0 | 독립 판단(학습 목표 L0)을 직접 무너뜨림 | REAL | BLOCKED_AUTH |
| 2 | D7-13 공개 후 independent 위조 차단 | 숙달 기록 오염 = 진단 전체 오염 | ISO-PG | 가능(하네스 필요) |
| 3 | D7-12 비로그인·보류 실서버 직접 호출 | 노출 사고는 되돌릴 수 없음 | 로컬 dev | 비로그인 부분 가능 |
| 4 | D7-04 AnalysisTheater 안내 줄·포커스·종료 | 통합 게이트 미충족 항목(17 §4) | REAL | BLOCKED_AUTH |
| 5 | D7-03 원문↔근거↔선지 역방향 | 근거 추적이 핵심 학습 행동 | ISO-PG | 하네스 필요 |
| 6 | D7-06 PC 키보드 전체 경로 | 현재 키보드 E2E 는 375px 뿐 | ISO-PG/REAL | 하네스 필요 |
| 7 | D7-10 PDF 미등록·회차 불일치 | 원본 없이 분석 진행하면 범위 잃음 | UNIT+E2E | UNIT 가능 |
| 8 | D7-11 강의 실패 주입 | 무한 로딩·선택 손실 | HARNESS/REAL | HARNESS 가능 |
| 9 | D7-08 theater axe 대비 | axe 가 지도에만 있음 | ISO-PG | 하네스 필요 |
| 10 | D7-01 1280/1440 실제 3영역 | 화면 실측 0 | ISO-PG/REAL | 하네스 필요 |

공통 선행 과제: **AnalysisTheater 를 로그인 없이 고정 문항으로 띄우는 격리 하네스**가 없다(D7-H). 이것이 생기면 1·4 를 제외한 대부분이 BLOCKED_AUTH 에서 풀린다. 1·4 는 실계정 자격 증명이 필요(우회 금지).

## 3. 발견

| ID | 내용 | 근거 | 심각도 | 신규/KNOWN |
|---|---|---|---|---|
| D7-F1 | 강의 실계정 E2E 2건 미실행 | 17 §2 | P1(통합 게이트) | KNOWN(17 §2) |
| D7-F2 | 기존 키보드 전체 경로 E2E 가 375px — 데스크톱 범위 결정과 어긋나고 PC 경로 무검 | `46-csat-lecture.spec.ts:67` | P2 | 신규 |
| D7-F3 | `/api/csat/paper` 라우트 테스트 0 | ls-tree 결과 | P2 | 신규 |
| D7-F4 | axe 검사가 theater 에 없음 | grep AxeBuilder: 43·47 외 csat theater 없음 | P2 | 신규 |
| D7-F5 | lecture full 은 비보안 경계(설계상) — 고정 테스트 부재 | route.ts 주석 | P2(제품 판단) | 신규(판단은 D6) |
| D7-F6 | AnalysisTheater 격리 하네스 부재 | e2e-isolated 목록 | P1(검증 능력) | 신규 |

## 조사 범위(실제로 본 개수)
- csat 관련 vitest 파일 목록 ~150 확인, 단정 내용 열람 12 파일(lecture route · disclosure · mask · delivery-guard · original-paper · embargo-gate 3 · reveal-gate · state route · learning-session · system-learning browser spec).
- playwright csat 스펙 목록 27 + 브랜치 신규 2, 본문 열람 2(learner-control · disclosure), 테스트명만 3(46·47·43).
- 라우트 소스 9(lecture · paper · dev-paper · reveal · structure · task · session/reveal · session/record · practice/view — 일부 grep).
- 17 문서 · harness-results.json 앞부분.

## 완료/부분/미완료
- 완료: 13개 동작 표 · 상위 10 표.
- 부분: `csat-learning-loop` · `csat-f08-paper-marks` · `route-guards.test.ts` · `47-csat-session` 의 단정 내용은 이름만 보고 NOT_VERIFIED 로 둠.
- 미완료: 없음(실행은 과제 범위 밖).

## 미검증
- 어떤 테스트도 실행하지 않음 — 「덮음」은 실행 PASS 가 아님.
- product-server 의 helpLevel 서버 강등 여부(D7-13) NOT_VERIFIED.
- 실제 스크린리더 낭독 · REAL 전 항목 BLOCKED_AUTH.
