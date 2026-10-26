# R0-ANON-ACCOUNT — 익명 체험 → 계정 연결 계약 초안

- TASK T-0004 · 조사·계약 초안(구현 아님) · 기준 HEAD 544ee8867 · 2026-10-25
- 게이트 정의: `Vocaflow-AI-Control/goals/GOAL_ACCEPTANCE_CRITERIA.json` release_gates `R0-ANON-ACCOUNT`(status not_evaluated)

## 1. 현행 경로 판정 — 익명 체험 이관 **없음** · 로그인 사용자 기기 로컬 기록(CSAT·SRS) → 계정 반영 **있음(§1-1)** (수용 기준 [0])

익명 **식별자**를 발급하고 그 식별자로 비로그인 기록을 가입 후 계정에 옮기는(link/claim) 코드는 저장소에 없다. 다만 **기기 로컬 기록 → 로그인 계정 서버 병합** 경로가 하나 있다(아래 1-1). 이것은 공개(비로그인) 체험에서는 도달하지 못하므로 익명 체험 이관으로 보지 않지만, 소유자 없는 기기 기록을 병합한다는 점에서 이 계약의 위험 범주에 든다.

| 근거 | 내용 |
|---|---|
| `apps/web/src/app/api/analytics/event/route.ts:85-105` | 주체는 세션에서만 읽는다(`auth.getUser()`). 비로그인이면 `user_id: null` 로 서비스 롤 insert. 익명 식별자(쿠키·기기 id)를 받거나 쓰지 않는다. |
| 같은 파일 `:30` | 클라이언트가 보낸 `user_id` 를 믿지 않는다 — 이관 키를 받을 통로 자체가 없다. |
| `apps/web/src/lib/analytics/funnel.ts:21` | 클라이언트 경로도 user_id 를 넘기지 않는다. |
| `apps/web/src/lib/analytics/client.ts` | PostHog 래퍼에 `identify`/`alias` 호출 없음(grep 0건), 녹화 off(`:67`). 키가 비면 무동작. |
| 전체 `apps/web/src` grep | `signInAnonymously` · `is_anonymous` · `linkIdentity` · `anon_id` · `anonymous_id` · `visitor_id` 0건. (merge 계열은 0건이 아니다 — 1-1.) |
| `supabase/migrations/20260825161641_funnel_events.sql` | 테이블에 익명 식별 컬럼 없음. |

`/fit` 등 비로그인 체험 화면은 있으나 기록을 브라우저나 서버에 익명 키로 남기지 않으므로 「연결 경로」로 보지 않는다.

### 1-1. 로컬 → 서버 병합 경로 (r1 지적 반영)

| 근거 | 내용 |
|---|---|
| `apps/web/src/lib/csat/session/store.ts:153-168` | `loadSyncedDissectionRecord`: IndexedDB 기록을 서버 사본과 항목 단위로 합치고, 서버에 없으면 로컬 기록 전체를 `putServer` 로 올린다. |
| 같은 파일 `:18` · `:177` | IndexedDB 이름은 고정 `vocaflow-csat` — 사용자 키가 없다. |
| 같은 파일 `:288` `clearAll` | 정의만 있고 호출처 0건(grep) — 로그아웃·계정 전환 때 기기 기록을 지우지 않는다. |
| `apps/web/src/app/api/csat/state/route.ts:16` · `:110-118` | 비로그인은 401. 로그인 시 `csat_learner_state` 를 `user.id` 행으로만 읽고 병합 뒤 insert/CAS update. 클라이언트가 소유자를 지정할 수 없다. |
| `apps/web/src/lib/auth/protected-routes.ts:54` | `/csat` 은 보호 접두사 — 비로그인은 로그인으로 보내진다. |
| `apps/web/src/lib/dictation/persist.ts:73-100` | 비로그인이면 `local-…` id 만 돌려주고 서버에 쓰지 않는다. 나중에 올리는 코드 없음 — 병합 경로 아님. |
| `apps/web/src/lib/srs/session-storage.ts:12` · `:77-84` | `srs_pending` localStorage 큐 — 항목에 cardId·word·cardUpdate 만 있고 **소유 user_id 없음**. |
| `apps/web/src/hooks/useSrsFlushOnLeave.ts:42` | 화면 진입 시 지난 큐를 `flushPendingSession()` 으로 먼저 올린다. 호출처: `FlashcardSession.tsx:110` · `PairFlipGameScreen.tsx:49` · `SpellForge.tsx:126` · `StudyMode.tsx:62`. |
| `apps/web/src/lib/srs/flush-session.ts:29-35` · `:80` | 큐를 서버로 보내고 성공 시에만 비운다. `clearPendingResults` 호출은 이 두 곳뿐 — 로그아웃 때 지우지 않는다. |
| `apps/web/src/lib/srs/flush-actions.ts:57-75` | **전송 시점** 인증 사용자(`user.id`)와 `word` 로 `vocabularies` 행을 찾는다 — 원래 cardId·소유자를 검증하지 않는다. |

SRS 판정: 보호 라우트(`protected-routes.ts` 의 `/flashcard` · `/pairflip` · `/spellforge` · `/wordvault`)라 공개 체험에서는 큐가 쌓이지 않는다. 그러나 A 가 남긴 미전송 큐가 있고 같은 기기에서 B 가 로그인해 위 화면에 들어가면, B 에게 같은 단어가 있을 때 **A 의 평가가 B 의 FSRS·학습기록에 반영될 수 있다**(코드 추론, 재현 안 함). 익명 claim 은 아니지만 「소유자 결속 없는 로컬→계정 경로」다.

#### 로컬 큐 → 서버 전송 후보 목록 (grep: `flush|putServer|pending|syncTo|sendBeacon|enqueue` ∩ `localStorage|indexedDB|sessionStorage`, `lib` · `hooks` · `components`)

| 파일 | 상태 |
|---|---|
| `lib/csat/session/store.ts` | 정독 — 경로 있음(위) |
| `lib/srs/session-storage.ts` · `flush-session.ts` · `flush-actions.ts` | 정독 — 경로 있음(위) |
| `lib/dictation/persist.ts` | 정독 — 비로그인 서버 쓰기 없음, 사후 업로드 없음 |
| `lib/flashcard/session-cursor.ts` · `lib/game/play-scaffold.tsx` · `components/game/ghost-race/GhostRaceGame.tsx` · `components/game/scriptquiz/ScriptQuiz.tsx` · `components/pairflip/PairFlipGameScreen.tsx` · `components/spellforge/SpellForge.tsx` · `components/csat/diagnosis/map/PlanSection.tsx` · `components/csat/theater/AnalysisTheater.tsx` · `lib/admin/help/vocab.ts` | **정독 안 함** — 키워드만 일치. 앞의 두 화면은 SRS 훅 호출처. 나머지가 학습 기록을 계정에 올리는지는 미판정. |


판정: 공개 체험에서 **도달 불가**(보호 라우트 + API 401). 그러나 코드상 **같은 기기에서 A 가 남긴 IndexedDB 기록이 다음에 로그인한 B 계정에 병합될 수 있다**(사용자 키 없음·로그아웃 미삭제 — 코드 추론, 재현 테스트는 안 함). CSAT·SRS 두 경로 모두, 익명 이관 계약(§2)을 구현할 때 같은 결속(인증 주체·동의·1회성)을 적용하거나, 기기 기록에 소유 user_id 를 붙여 불일치 시 병합을 막아야 한다.

### DB 실측(개발 DB, SELECT 전용, 2026-10-25)

| 항목 | 값 |
|---|---|
| `to_regclass('public.funnel_events')` | 존재 |
| 컬럼 | id bigint · occurred_at timestamptz · user_id uuid · event text · surface text · meta jsonb |
| 전체 / `user_id is null` | 50,592 / 26,097 (51.6%) |
| `auth.users where is_anonymous` | 0 (Supabase 익명 로그인 미사용) |
| public 스키마의 `(anon|visitor|device|distinct)_id` 류 컬럼 | 0 |
| 익명 행 meta 키 상위 | screen · workspace · reason · goal_set · goal · known · group … — 전부 열거형/불리언, 식별자 없음 |
| meta `session` 키(익명 239행) | `csat_ec_capture_closed` 의 수집 세션 uuid. 익명 130개 중 같은 값이 user_id 행에 나타난 것 0 — 방문자 연결 키가 아니다. |

결론: 익명 행은 **누구의 것인지 사후에 판별할 수 없다**. 따라서 현재 데이터에는 이관할 대상도 없고, 이중 이관·탈취 위험도 구조적으로 0 이다. 연결 기능을 만들면 그때 아래 계약이 필요하다.

## 2. 계약 요구사항 (수용 기준 [1])

연결 기능을 도입할 때 아래를 모두 만족해야 한다. 「MUST」 하나라도 빠지면 게이트 미통과.

### 2.0 이관 순서 (인증과 동의는 별개 조건)
1. 인증 성공(서버가 세션에서 user.id 를 확인) — 이것만으로는 이관하지 않는다.
2. 동의 확인 — 서버에 저장된 「이 user.id 가 이 토큰 해시의 범위 R 연결에 동의」 기록이 있어야 한다. 미선택이면 이관하지 않고 연결 대기 핸들(§2.1 회전)로 기록을 익명 상태로 유지, 거부·만료면 핸들 폐기.
3. 1·2 가 같은 요청의 서버 측 검증 결과일 때만 이관 트랜잭션을 연다. 동의 화면은 인증 뒤에 보여 주고, 동의 기록은 인증 주체와 토큰 해시에 결속한다(다른 탭·다른 계정이 만든 동의를 재사용 불가).

### 2.1 익명 토큰 · 세션 고정 공격 방지
- MUST: 익명 키는 서버가 발급하는 고엔트로피 난수(≥128bit), `HttpOnly; Secure; SameSite=Lax` 쿠키. URL·쿼리·localStorage·이벤트 meta 로 운반하지 않는다(외부에서 심을 수 없게).
- MUST: 쿠키 이름은 `__Host-` 접두(Path=/, Domain 없음, Secure) — 하위 도메인·비보안 출처가 같은 이름을 심을 수 없다.
- MUST: 같은 이름 쿠키가 둘 이상 오면(주입 흔적) 모두 무효로 보고 이관하지 않는다.
- MUST: 쿠키 소지만으로는 연결하지 않는다 — 토큰은 그 토큰을 발급받은 브라우저에서 진행한 체험 기록에만 유효하고, 이관은 §2.0 의 인증 주체+동의 결속이 있어야 한다. 그래도 심어진 유효 토큰(공격자가 자기 체험 토큰을 피해자 브라우저에 심음)은 피해자 계정에 공격자 기록을 넣는 오염 공격이 되므로, 동의 화면에 연결할 기록 요약(건수·기간)을 보여 주고 피해자가 거부할 수 있게 한다.
- 정의할 공격 테스트: (a) 심어진 유효 토큰 + 피해자 로그인 + 동의 안 함 → 이관 0, (b) 중복 쿠키 → 이관 0, (c) `__Host-` 아닌 동명 쿠키 무시, (d) 본문·쿼리 토큰 무시, (e) 로그인 후 토큰 회전·로그인 전 토큰 무효 확인, **(f) 공격자 보유 토큰 T 주입 → 피해자가 T 로 체험 기록 생성 → 공격자가 자기 브라우저에서 T 로 로그인·동의 → 이관 0 · 체인 동결**, (g) 피해자 회전 전에 공격자가 T 로 먼저 기록 → 이후 피해자 요청에서 분기 탐지 → 동결·이관 0, (h) 동의 대기 중 다른 계정 세션이 대기 핸들 제시 → 거부.
- MUST: 서버는 쿠키 원문을 저장하지 않고 해시만 저장한다. 클라이언트가 본문으로 보낸 익명 키는 무시한다(현행 `user_id` 원칙의 연장).
- MUST: **회전과 소비를 분리한다.**
  - 회전(인증 직후): 서버가 로그인 전 익명 토큰 체인 머리를 확인하고 즉시 무효화한 뒤, 같은 체인의 기록을 가리키는 **연결 대기 핸들**(새 난수, `__Host-` 쿠키, 해시만 저장)을 발급한다. 대기 핸들은 이 `user.id` 에만 결속되고 TTL(예: 15분)이다. 로그인 전 토큰은 이후 어떤 용도로도 쓸 수 없다. 기록은 익명 상태 그대로 유지된다.
  - 소비(인증 + 명시 동의 검증 완료 후): 대기 핸들 해시 · 세션 user.id · 동의 기록 셋이 일치할 때만 이관 → `consumed_at` 기록 → 대기 핸들 삭제. 거부면 대기 핸들 폐기·기록 비연결. TTL 만료면 비연결로 끝난다(재요청 불가 — 비연결이 기본값).
- MUST: 토큰 TTL(예: 30일) 경과·소비 완료 토큰은 거부.
- MUST(공격자 사전 보유 토큰 차단): 쿠키 값 소유만으로 이관 권한을 주지 않는다 — 토큰은 **회전 체인**이다.
  - 익명 기록을 쓰는 모든 서버 응답이 토큰을 새 값으로 회전하고 이전 값을 「사용됨」으로 표시한다. 회전·인증 직후 회전·소비는 체인의 **현재 머리**로만 가능하다.
  - 공격자가 자기 토큰 T 를 피해자 브라우저에 심어도, 피해자의 첫 기록 쓰기에서 T 는 T' 로 회전되고 T' 는 피해자 브라우저에만 있다. 공격자가 T 로 로그인·동의해도 머리가 아니므로 이관 0.
  - 「사용됨」 토큰이 다시 오면(체인 분기 = 두 브라우저가 같은 체인을 씀) 체인 전체를 **동결**하고 어느 쪽에도 이관하지 않는다(refresh-token 재사용 탐지와 같은 원리). 분기 전에 공격자가 먼저 기록을 쓴 경우도 동결로 끝난다.
  - 동의 화면은 연결할 기록 요약(건수·기간·모듈)을 보여 주어 본인 기록인지 확인하게 한다.
- 남는 위험(완전 방어 불가, 명시): ① 피해자 브라우저의 **현재** 쿠키를 탈취하는 공격(XSS 로 요청 대행·기기 물리 접근·악성 확장) — HttpOnly 는 읽기만 막는다. ② 공용 기기에서 다음 사람이 이전 사람의 체인 머리를 이어 받는 경우 — 로그아웃/체험 종료 시 체인 폐기 버튼과 짧은 TTL 로 줄일 뿐이다. ③ 피해자가 요약을 보지 않고 동의하는 경우.
- SHOULD: Supabase `signInAnonymously` 를 쓰면 `linkIdentity`/updateUser 경로를 쓰고 동일 원칙(서버 확인·1회) 적용.

### 2.2 동의
- MUST: 연결 전에 무엇을(이벤트 종류·학습 기록 범위·기간) 연결하는지 고지하고 명시 선택을 받는다. 기본값은 비연결.
- MUST: 거부하면 익명 기록은 계정에 붙지 않고 익명으로 남거나 TTL 후 삭제. 거부가 가입을 막지 않는다.
- MUST: 동의 기록(버전·시각·user_id·범위)을 남기고, 연결 후 철회 시 연결분 분리/삭제 절차를 둔다.

### 2.3 중복 · 탈취 방지
- MUST: 이관 단위에 멱등 키(토큰 해시) — `unique(anon_token_hash)` 연결 원장(토큰 해시·user_id·consumed_at·결과 요약). 원장 기록·행 이관·소비 표시는 한 트랜잭션.
- 커밋 뒤 응답 유실 처리:
  - 연결 대기 핸들 쿠키가 아직 남은 경우: 재시도는 원장을 조회해 **같은 user_id 면 저장된 완료 결과를 그대로 돌려주고**(재이관 없음) 그때 쿠키를 삭제·재발급한다. **다른 user_id 면 거부**(409)하고 이관하지 않는다.
  - 쿠키가 이미 삭제된 경우: 재시도할 키가 없으므로 클라이언트는 「내 연결 결과」 조회(인증 주체 기준 원장 조회)로 결과를 확인한다. 토큰 없이 이관을 다시 시작하는 경로는 없다.
  - 즉 「소비 완료 거부」는 **다른 계정의 재사용**에만 적용하고, 같은 계정의 재시도는 완료 결과 반환으로 멱등이다.
- MUST: 이미 다른 계정에 연결된 토큰은 거부(첫 소비자 고정). 덮어쓰기 금지.
- MUST: 이관은 `user_id is null and anon_token_hash = $1` 인 행만 갱신(이미 소유자 있는 행 불가침), 한 트랜잭션.
- MUST: 학습 기록(FSRS 상태 등)은 기존 계정 기록과 충돌 시 병합 규칙을 정의(덮어쓰기 금지, 더 이른/늦은 기준 명시).

### 2.4 개인정보 최소화
- MUST: 익명 단계에서 IP·UA·자유 문자열 저장 금지(현행 `isSafeProps` 유지). 익명 키는 계정과 연결 전 어떤 개인 식별 정보와도 결합하지 않는다.
- MUST: 연결되지 않은 익명 기록 보존 기한을 정하고 자동 정리(데이터 삭제는 별도 DB 승인).
- 스키마 추가(토큰 원장·익명 키 컬럼)는 DB 변경 → 사용자 승인형 러너로만.

## 3. 게이트 증거 대응 (수용 기준 [2])

| required_evidence | 현행 | 근거 · 필요 |
|---|---|---|
| anonymous session authorization tests | 없음 | 익명 세션 개념 자체가 없음(§1). 현행에 대해 증명 가능한 것은 「클라이언트 user_id 불신」뿐 — 해당 테스트 존재 여부는 별도 확인 필요. 필요: §2.1 토큰 발급·서버 검증·본문 키 무시 테스트. |
| data migration integrity and consent test | 없음 | 이관 코드 없음. 필요: §2.2 거부 시 비연결, §2.3 멱등·이중 이관·타 계정 거부·소유 행 불가침 테스트. |
| session fixation protection check | 없음 | 익명 토큰이 없어 고정 대상은 없으나 검증 증거도 없다. 기기 기록 병합(§1-1)은 소유자 결속이 없어 별도 위험. 필요: §2.1 로그인 후 재발급·1회 소비·심은 키 거부 테스트. |

게이트 판정: **미구현·증거 없음**. 정본 `r0_scope.required_journey` 에 `registration_login_with_safe_state_transfer` 가 있고 R0-CORE-JOURNEY 도 익명→계정 이관 테스트를 요구하므로 연결은 R0 범위다. 「해당 없음(N/A)」은 정본 상태 어휘에 없으며, 쓰려면 별도의 정본 범위 변경 승인이 필요하다 — 이 문서는 그것을 제안하지 않는다. §2 구현과 §3 테스트가 게이트 통과의 선행 조건이다.

## 하지 않은 것
- 구현·마이그레이션·테스트 작성 없음. 운영 DB 미조회(개발 DB 만). Supabase Auth 설정(익명 로그인 활성 여부)은 대시보드 설정이라 확인 못 함 — `is_anonymous` 사용자 0 으로만 간접 확인.
