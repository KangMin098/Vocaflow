# AD — 정답 공개 경로 · P6 노출 원장 검증 (읽기 전용)

> 작성: drain-product 서브에이전트(작성자 아님 · 제품 파일 수정 없음 · 커밋 없음). 2026-10-24.
> 검증 기준 HEAD
> - T-0140/0146/0147 `feat/lecture-learner-control@94c0170c6` (status 깨끗). **main `7f11a8538` 에는 이 브랜치 커밋이 하나도 없다**(6eb6f3451 · 5f3228a5c · 6ec5af6fd · 562953438 모두 비조상).
> - T-0145 `feat/csat-s2b-34-interactive@f53ae51fb` (base ca4b1467b) — main 비조상.
> - DB `jajenrevcbmrpaliomxv` SELECT 6건(카탈로그·함수 정의·마이그레이션 이력·행 수). 쓰기·RPC 호출 없음.
> 방법: 정적 코드 읽기만. 브라우저·jsdom·Flight 직렬화 실행 없음 → 실행 결과는 모두 NOT_VERIFIED.
> KNOWN 근거: AI-Control `verification/reviews/T-0140-codex-review-r2~r13` · `T-0147-codex-review-r1~r7` · `T-0145-codex-review-542a5ea99/e08a522af` · `runtime/t0140-drain-counterexamples-20261024/DELIVERY.md`. T-0146 전용 리뷰 파일은 reviews/ 에 없다(NOT_VERIFIED).

## A. 정답 공개 경로

| ID | 항목 | 판정 | 근거 (파일:줄, lecture 브랜치) | 재현 조건 / 비고 |
|---|---|---|---|---|
| A1 | 2026#34 c3 UNKNOWN 경계 | **FIXED** (KNOWN r13) | `lib/csat/lecture/disclosure-data.json` `2026#34 = {version 2, cues 12, stopBefore 2, preStopRisk hint}` · `disclosure.ts:35-41` `lectureUntil = cues.slice(0, stopBefore)` · `app/api/csat/lecture/route.ts:48-58` | until 응답은 c1·c2 만. c3 은 hint 구간에 들어가지 않는다. digest/version/cue 수 불일치 → 409(`binding_mismatch`). |
| A2 | D6-01 초기 정답 칩·오답 번호(화면) | **FIXED** (`6cb36a366`·`e6efaa35b` 화면, 첫 응답 `562953438`~`760aadad0`) | `lib/csat/lecture/answer-gate.ts:61-75` `gateBlocks`(머리 칩 → 「정답 공개 전」, answer/reject 블록 → `analysis:withheld:n` 자리표시) · `AnalysisTheater.tsx:939` withheld 블록 `data-live=false` | 동의 전 화면 미표시. |
| A3 | D6-01 초기 HTML·RSC props | **FIXED (코드)** / 실직렬화 NOT_VERIFIED | `page.tsx:104-211` `initial.*` 만 전달 · `answer-split.ts:63~` `splitAnswer`(정답 칩·근거·소거·이해 확인·비교 선지·v3 판정·설계·meaningSupport·지도 reveals·레일 대상 전부 reveal 로 이동) · `neutralSteps`(R147-10) | 실제 Flight payload grep 은 r13 에서도 NOT_RUN. |
| A4 | D6-02 `move()` 경계 우회 | **FIXED** | `AnalysisTheater.tsx:1038-1044` 비재생/경계 이동은 `goto()` 로 · `1045-1055` `boundaryGate` · `874` 동의 전 `cursor>=stopAt` 이면 liveKey=null | ←/→·이전/다음 차례·idle/paused/ended 모두 경계 안내로. 재생 중 `lec.next()` 는 서버 절단 cue 안에서만 이동. |
| A5 | D6-03 건너뛰기 | **FIXED** (`6ec5af6fd`, KNOWN r13) | `AnalysisTheater.tsx:1262-1275` `lecture-boundary-skip` = `pauseLecture · setAtBoundary(false) · setBoundaryNote('closed')` — 공개 요청·cursor·장면·포커스 변경 없음 | 정답 공개 없이 종료. 실제 DOM 포커스 보존은 BLOCKED_AUTH(r13). |
| A6 | 강의 전체(full) cue 응답 | **FIXED** (R147-03) | `lecture/route.ts:61-77` 본인 `learning_exposures(kind answer_direct)` 행이 없거나 조회 오류면 403 · `continuePastBoundary` `AnalysisTheater.tsx:1028-1036` 은 `requestReveal` 성공 뒤에만 `start(...,'full')` | scope 생략도 full 분기로 같은 검사. |
| A7 | 근거 위치·강조(data-live) | **FIXED** (R147-10 CLOSED r6/r7) | `gatedLiveKey`(answer-gate.ts:51) · 첫 응답 steps 중립화 | 잔여: until 재생 중 cue 의 `activeKey` 가 문장 앵커면 그 문장이 강조될 수 있다 — 설계상 `preStopRisk: hint` 범위(2026#34 c1·c2). 결정적 노출 아님으로 판단, 브라우저 NOT_VERIFIED. |
| A8 | 선택지 소거(reject) | **FIXED** | `confirmsAnswer`(answer-gate.ts:45) + split 이 `reject:n` 키까지 제거 | — |
| A9 | T-0147 UI 지적(R147-01~10, 포커스·빈 장면) | **FIXED**(r7 PASS, 격리 하네스 범위) | r7: 공개 뒤 `judgment_scene` 만 h2 포커스, 공개 전 `scene-empty` 미렌더 | 실계정 통합 E2E 는 BLOCKED_AUTH 유지. |
| A10 | 강의 라우트 머리 주석 | **STILL_PRESENT (P3 문서)** | `app/api/csat/lecture/route.ts:9` 「보안 경계가 아니다 — scope 없이 전체를 받을 수 있다」 — 61-77 의 원장 확인과 모순 | 낡은 주석. 오판 유도. |
| A11 | 「원문 분석으로」 선택 뒤 감춤 유지 | **FIXED (코드)** | `answerWithheld` 가 `hideAnswer` 우선(answer-gate.ts:30) — `setLecturePath('self')` 해도 동의 전 감춤 유지(r4 R4-02) | — |

### Interactive34 (T-0145) 연결 상태

- 도구 4종(`Scope34` · `Compare34` · `Design34` · 공개 전 `InquiryDisclosureNotice`)은 `InquiryV3Panels.tsx:34-178` 의 `V3Task/V3Meaning/V3Judgment/V3Design` 안에만 연결돼 있다.
- **AnalysisTheater(s2b 브랜치 `:1210-1243`)는 `answerRevealed` 를 넘기지 않는다** → 기본값 false → interaction34 가 있는 문항(2026#34)에서 네 패널 모두 항상 「정답 공개 후에 판단 도구를 볼 수 있어요」만 보인다. 즉 **도구는 import·조건 분기까지 연결, 실제 화면 노출은 미연결**(정답 노출 위험 0 · 기능 도달 0).
- 통합 위험(STILL_PRESENT, P1 통합 전 조건): s2b 는 (b) 분리 이전 base 위에 있어 `v3.choices[].selected_as_answer`(`Interactive34.tsx:78` 「공식 정답」)·`interaction34` 가 RSC props 로 그대로 간다. lecture 브랜치 `answer-split.ts` 는 v3 선지 판정을 reveal 로 옮기므로, 합칠 때 `interaction34` 필드도 split 대상에 넣고 `answerRevealed = !withheld && revealed` 를 넘겨야 한다. lecture 브랜치 `AnalysisTheater.tsx:1564` 는 이미 `V3Judgment` 를 `!withheld` 일 때만 렌더하나 `V3Task/V3Meaning/V3Design`(1536·1562·1570)은 무조건 렌더 — Interactive34 쪽 `answerRevealed` 기본 false 가 막아 주는 구조라 연결 누락 시 기능만 죽고 노출은 없다.

## D. P6 노출 원장

### DB 실측 (SELECT)

| 항목 | 결과 |
|---|---|
| 테이블 `public.learning_exposures` | 존재(to_regclass). 14 컬럼(user_id·client_exposure_id·item_ref·kind·source·analysis_version·lecture_version·lecture_digest·cue_id·occurred_at·received_at·clock_suspect·synthetic). **행 0** |
| RLS | enabled / not forced. 정책 1: `learning_exposures_own_select` SELECT to authenticated `user_id = (select auth.uid())`. INSERT/UPDATE/DELETE 정책 없음 |
| GRANT | authenticated: SELECT 만 · service_role: SELECT·INSERT·DELETE·REFERENCES·TRIGGER(UPDATE 없음) · postgres 전권 |
| 트리거 | `learning_exposures_append_only` BEFORE UPDATE OR DELETE — UPDATE 항상 거부, DELETE 는 synthetic 이거나 auth.users 에 없는 사용자 행만 허용, 실제 학습자 행 삭제 거부 |
| RPC `learning_exposure_record(uuid,uuid,text,text,text,int,int,text,text,timestamptz,bool)` | SECURITY INVOKER · `search_path=public,pg_temp` · EXECUTE: postgres·service_role 만(anon/authenticated 없음). advisory xact lock(사용자|문항) → insert … on conflict (user_id, client_exposure_id) do nothing → 기존 행이면 item_ref/kind/source 불일치 시 예외(멱등·충돌 거부). `clock_suspect = |now − occurred_at| > 600s` |
| 마이그레이션 이력 | `20261023194123 learning_exposures` · `20261024012226 learning_exposures_fix_v3_1` 적용. **저장소 파일은 `fix/csat-p6-migrations`(e9c2fe99c)에만** — main·lecture 브랜치·main-serving 에 없음 |
| 뷰 의존 | `learning_exposures` 를 읽는 뷰 0 (`learning_first_attempts` 포함) |

### 코드 순서 (lecture 브랜치 `app/api/csat/item/[slug]/judgment/route.ts`)

인증(401 no-store) → slug·본문 검증(400) → `canRevealItem` 보류(423) → `loadCsatItemExplain`(404/503) → 분석 버전 결속(409) → `learning_exposure_record`(service_role client, `p_user = 세션 user.id`) → `recErr || data == null` 이면 **503, 본문에 reveal 없음** → 커밋 뒤 보류 재확인(423) → `loadTheaterAnswer` 의 `reveal` 만 200.

- 「기록 성공 뒤에만 정답 포함 응답」: **충족(정적)**. reveal 자료 로드가 RPC 성공 분기 뒤에만 있다.
- 「기록 실패 시 정답 미전송」: **충족(정적)**. 실패 경로 응답은 `{ok:false,error}` 만. 클라이언트(`AnalysisTheater.tsx:881-896`)는 `!res.ok || !body.reveal` 이면 throw → 공개 안 함.
- `p_user` 는 클라이언트 값이 아니라 서버 세션 값 → 타인 명의 기록 경로 없음. RPC 는 authenticated 에 EXECUTE 가 없어 브라우저 직접 호출 불가.
- 강의 full 은 원장 행 존재를 RLS SELECT 로 확인, 오류 시 fail-closed(A6).
- route.test 실행 여부: 이번 검증에서 미실행(NOT_VERIFIED).

### 숙달 구분 재확인 (D8 출발점 이후 변한 것만)

- main `e3e0a6a0e → 7f11a8538` 에서 `lib/csat/map`·`effect-signals`·`api/csat/item`·`lib/csat/diagnosis` 변경은 5파일 11줄(테스트 2 · `final-assessment-store.ts` · `target-goal.ts` 각 1줄)뿐 — D8 의 「클릭·강의 청취·완주·열람 → 숙달 경로 없음」, 「해설 뒤 풀이 → after_explanation, 독립 아님」 결론 **유지**(main 기준).
- lecture 브랜치에서 `learning_exposures` 를 참조하는 코드는 judgment route · lecture route · answer-split 주석뿐, map/숙달/진단 코드 참조 0 → **원장이 숙달로 가는 경로 없음**.
- **새 관찰 (P2, NOT_VERIFIED 실데이터)**: 판단 장면·강의 full/continue 의 정답 열람은 `learning_exposures` 에만 남고 `learning_sessions.explanation_viewed_at` 은 쓰지 않는다. `learning_first_attempts` 는 원장을 읽지 않으므로, 이 경로로 정답을 본 뒤의 시도가 `after_explanation` 으로 분류되는지는 기존 `/reveal`(문항 열람 시 viewed_first) 호출에 달려 있다. 같은 세션에서 /reveal 이 항상 먼저 불리는지 확인 필요 — 안 불리면 「정답 열람 후 수행」이 독립 수행처럼 보일 수 있다.
- D8-01~03 은 main 에서 변경 없음 → 그대로 유효(KNOWN).

## 미검증

브라우저/Flight 실직렬화 · 실계정 통합 E2E(BLOCKED_AUTH) · route.test/answer-gate 테스트 재실행 · T-0146 리뷰 기록 · 위 P2 의 실제 세션 순서.

## owner 별 handoff

- **csat-lecture-disclosure (T-0140/0146/0147)**
  1. `app/api/csat/lecture/route.ts:9` 낡은 주석 정정(P3).
  2. 판단 장면/강의 공개 시 `explanation_viewed_at`(또는 `learning_first_attempts` 가 원장을 반영)으로 이어지는지 확인·결정(P2).
  3. 통합 전: P6 마이그레이션 2건이 `fix/csat-p6-migrations` 에만 있다 — 브랜치와 함께 main 으로 들어가야 저장소·DB 이력 일치.
  4. 브랜치가 main 미통합 — main 은 여전히 D6-01/02/03 상태(move() 경계 검사 없음, `main:AnalysisTheater.tsx:855-860`).
- **csat-v4-s0 (T-0145)**
  1. AnalysisTheater 가 `answerRevealed` 를 넘기지 않아 Interactive34 4종이 실화면에 안 나온다(기능 미도달).
  2. lecture 브랜치와 합칠 때 `interaction34`·`selected_as_answer` 를 `answer-split` reveal 쪽으로 옮기고 `answerRevealed={!withheld && !!revealed}` 연결 — 이 순서가 어긋나면 RSC props 에 공식 정답이 실린다(통합 P1 조건). AnalysisTheater 는 csat-lecture-disclosure 소유라 두 owner 합의 필요.
- **총괄**: DB 쓰기·승인 필요 항목 없음.
