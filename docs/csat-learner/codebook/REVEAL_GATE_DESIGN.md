# Pilot blocker 1 — 결과 · 정답 · 해설의 서버 측 보류 설계 (2026-10-05 · 미구현 · 미승인)

> 목적: Pilot 참가자의 증거 수집(capture)이 끝나기 전에는 그 시험의 결과(점수 · 정오) · 정답 · 해설이 **어떤 경로로도** 나가지 않게 한다. 화면에서 숨기는 것으로 끝내지 않는다.
> 근거: 노출 경로 전수 조사(아래 I — 코드 · DB 권한 실측 2026-10-05). 설계만 — 마이그레이션 · 구현 없음.

## A. authoritative capture state

새 표 `csat_ec_capture_session` — 현재 상태의 유일한 원천. 이벤트(`csat_ec_capture_opened` · `_finished`)는 감사 기록으로 남는다.

| 컬럼 | 뜻 |
|---|---|
| `session_id` PK · FK `csat_dx_session` on delete cascade | 학습자는 세션에서 도출(중복 저장 안 함) |
| `taxonomy_version` FK · CHECK 봉인 · `v99.*` 아님 | 생성 때 봉인(설정이 바뀌어도 그대로) |
| `config_hash` | 생성 당시 서비스 설정(참가자 판정 · 정답 대조 수 · probe 상한 · probe 판)의 sha256 |
| `targets smallint[]` | 생성 때 봉인한 수집 대상 문항 번호(번호순) — 완료 판정 · 보류 범위의 기준 |
| `status` | held · collecting · completed · closed_incomplete |
| `required_at` · `opened_at` · `completed_at` · `closed_at` · `closed_reason` · `closed_by` | 전이 시각 · 종료 사유 |

## B. 컬럼 vs 별도 표 → **별도 표(B)**

`csat_dx_session` 은 일반 진단의 핵심 표다. 보류 상태를 컬럼으로 넣으면 모든 진단 코드 · RLS 가 Pilot 수명주기와 묶이고, Pilot 이 끝나도 컬럼이 남는다. 별도 표는 taxonomy · 설정 출처 · 대상 봉인을 함께 담고, 행이 없으면 「보류 없음」(비참가자 · 기존 기록)으로 기존 동작이 그대로다. 비용은 join 하나.

## C. 상태 머신

```
(행 없음) ─ 기록 저장 + 참가자 ─▶ held ─ open ─▶ collecting ─ finish(완료 조건) ─▶ completed
                                   └──────────── close(관리자 · 사유) ──────────▶ closed_incomplete
```
- 전이는 SECURITY DEFINER RPC 만. 트리거가 역전(completed → 무엇이든, closed_incomplete → 무엇이든)과 건너뛰기(held → completed)를 거부한다.
- 설정 · 참가자 목록이 나중에 바뀌어도 기존 행은 바뀌지 않는다(생성 때 봉인).
- 생성은 기록 저장과 **한 트랜잭션** — 새 서비스 RPC `csat_ec_record_session_held(p_session, p_responses, p_taxonomy, p_config_hash, p_targets)` 가 `csat_dx_record_session` 뒤 같은 트랜잭션에서 행을 만든다(저장과 보류 사이 틈이 없다). 같은 client_key 재전송은 같은 세션 · 같은 행.

## D. 완료 조건(finish RPC 가 서버에서 확인)

1. 최신 학습자 확인이 「응시 · 선지별 판단」이고 지금 답안 해시와 같다.
2. 봉인된 대상 문항 **모두** 유효 interpretation 이 있다(answered · unknown · skipped 아무거나). 화면의 「이 문항 건너뛰기」는 interpretation `skipped` 를 저장하도록 바꾼다 — 건너뜀도 명시적 사건.
3. 추가 질문(probe)은 조건이 아니다(선택 · 건너뛰기 가능 — 대기 probe 가 있어도 완료를 막지 않는다).
- 「나중에 하기」는 완료가 아니다 — 결과는 계속 보류(지금 화면의 「나중에 하기 → 결과 공개」를 바꾼다).
- 멱등: completed 에서 같은 finish 는 같은 결과(completed_at 그대로). 조건 미달이면 남은 문항 번호를 돌려준다.
- 완료 때 보고 수치(대상 수 · answered/unknown/skipped 수 · probe 응답 수)를 행에 남긴다(분석에서 closed_incomplete 와 구분).

## E. 결과 API

`GET /api/csat/diagnosis/sessions/[id]/result` 와 기록 저장 응답은 공통 서버 함수 `getCaptureRevealState(sessionId)` 결과가 `unrestricted`(행 없음) · `completed` · `closed_incomplete` 일 때만 결과를 준다. held · collecting 이면 `{ held: true }`.

## F. 보고서 · 기록 상세 · 홈

- `loadExamReport`(보드 · 기록 상세 · 유형 · 함정 · 틀린 문항)와 `/csat` 홈 카드: 보류 중 세션을 **통째로 뺀다**(점수 · 정오 · 함정이 보드 어디에도 안 나온다). 보드에는 「풀이 알려 주기 남음」 행만(점수 없이).
- 스냅샷(`csat_dx_snapshot`): 보류 중 세션을 계산에서 빼고, 완료 · 종료 전이 때 다시 계산한다(지금은 저장 직후 이 세션을 포함한 스냅샷을 만든다).
- RLS: `csat_dx_session` · `csat_dx_response` 본인 SELECT 정책에 「보류 중 세션 아님」을 더한다(JWT 로 자기 is_correct · raw_score 를 직접 읽는 우회 차단). 앱 서버는 service role 로 읽으므로 위 서버 필터가 별도로 필요하다.
- 진단 페이지(`?capture=` 없이)도 같은 서버 함수로 거른다.

## G. 문항 해설 정책 — 문항 단위 전역 보류(embargo)

`csat_ec_item_embargoed(item_id)` = held · collecting 인 capture 세션 중 **그 시험의 문항**(세션의 응답 item_id 전체 — 대상만이 아니라)을 포함한 것이 하나라도 있다.
- 대상만 막으면 대상이 아닌 문항의 정답으로 「대상 = 대부분 오답」을 역산할 수 있다 → 시험 전체를 막는다.
- 요청자와 무관 — 누구든(다른 계정 포함) 그 문항의 정답 · 해설 · 강의 · 근거를 받지 못한다. 문항 본문(발문 · 지문 · 선지)은 보류하지 않는다.
- 모든 해당 capture 가 completed · closed_incomplete 가 되면 자동 해제(상태 표에서 매 요청 계산 — 캐시 없음).

## H. 로그아웃 · 다른 계정 우회

조사 결과 `/csat/**` 화면은 로그인 필수(미들웨어), CSAT API 는 각자 401 — 로그아웃 상태로는 아무것도 못 본다. 남는 우회는 **다른 로그인 계정** → G 의 전역 보류(요청자 무관)가 막는다.

## I. Answer/Explanation Exposure Matrix(실측) · 보류 적용 위치

| # | 경로 | 노출 | 지금 | 보류 적용 |
|---|---|---|---|---|
| 1 | `/csat/item/[slug]`(`loadCsatItemExplain` RLS · 뼈대 JSON · 화면 데이터에 정답 · 근거 포함) | 정답 · 선지 판정 · 해설 · 근거 | 로그인 | 서버: embargo 면 정답 · 분석 · 뼈대 · 강의 개요를 화면 데이터에서 뺀다(PredictGate 이전 단계라 화면 숨김은 무의미) |
| 1c | `GET /api/csat/lecture?item=` (번들 JSON · 메모리 캐시) | 강의 대본(정답 낭독) | 로그인 · 아무 문항 | 서버: embargo 면 404 형 응답 · `no-store` |
| 2 | `POST /api/csat/session/reveal` (지금 화면 미사용) | 정답 · 근거 · 함정 · 절차 | 로그인 · 아무 문항 | 서버: embargo 면 거부 |
| 3 · 4 | `/csat/dissect` · `/csat/formulas` 카탈로그(전 사용자 공유 10분 메모리 캐시) | 모든 ready 문항의 정답 · 근거 · 함정 | 로그인 | 캐시를 읽은 **뒤** 요청마다 embargo 문항을 걸러낸다(캐시 값에 굽지 않는다) |
| 5 | `/csat/browse` | 해설 유무만 | — | 변경 없음 |
| 7 | `/csat/diagnosis` 보드 · 기록 상세(service role) | 점수 · 정오 · 함정 | 보류 없음(`?capture=` 때만) | F |
| 8 · 9 | 기록 저장 응답 · 결과 API | 점수 · 오답 번호 | 저장 응답만 보류 · 결과 API 무조건 | E |
| 10 | `GET /api/csat/ec/capture` | 대상 목록(정답 대조 null 이면 = 오답 목록) | 참가자만 | O-1: 정답 대조 수를 Pilot 열기 조건으로 |
| 11 | `/csat` 홈 카드 | 최근 점수 · 등급 | 보류 없음 | F |
| 12 | 연습 기록 API · IndexedDB | 본인 연습 정오(받은 정답으로 자가 채점) | — | 3 · 4 가 정답을 안 주면 따라서 막힌다 |
| 13 | **PostgREST 직접(학습자 JWT)** | `csat_items_public.answer`(뷰 · 정의자 권한) · `csat_item_analyses`(published) · `csat_item_skeletons` · 본인 `csat_dx_response.is_correct` · `csat_dx_session.raw_score` | 로그인 사용자 누구나 | DB: 뷰는 embargo 면 `answer = null`, 분석 · 뼈대 정책에 `not csat_ec_item_embargoed(item_id)`, 본인 응답 · 세션 정책에 보류 제외 |
| 14 | 번들 JSON(강의 · 뼈대) | 근거 인용 · 정답 앵커 | 서버만 읽음 | 1 · 1c · 2 · 3 의 서버 확인으로 |
| 15 | 관리자 화면 | 전부 | 관리자 | 보류하지 않는다(판정 · 운영) |
| — | `csat_dx_answer_key` | 정답표 | 정책 없음(service 만) | 변경 없음 |
| — | 공개 파일 · sitemap · OG · 정적 생성 · ISR | 없음(조사) | — | — |

## J. 캐시

CSAT 경로에 ISR · `generateStaticParams` · `unstable_cache` 없음(조사). 남는 캐시: ① 카탈로그 10분 메모리 캐시 — 걸러내기를 캐시 뒤에 ② 강의 · 뼈대 JSON 메모리 캐시 — 요청마다 embargo 확인 ③ 보류 대상 응답에 `Cache-Control: no-store`(전체 사이트 캐시는 그대로) ④ 브라우저 IndexedDB 종이 캐시는 문항 본문만(정답 저장 여부는 구현 때 확인).

## K. RLS · RPC

| 객체 | 권한 |
|---|---|
| `csat_ec_capture_session` | 직접 권한 없음(학습자 · service · 판정자). FORCE RLS |
| `csat_ec_record_session_held(...)` | service_role(앱 서버의 저장 경로) |
| `csat_ec_my_capture_state(session)` | authenticated — 본인 세션 상태 · 남은 대상 |
| `csat_ec_capture_open(session)` · `csat_ec_capture_finish(session)` | authenticated — 본인 세션만, 전이 · 완료 조건은 함수 안 · 이벤트 행을 같은 트랜잭션에서 기록 |
| `csat_ec_capture_close(session, reason)` | authenticated + `is_admin()` |
| `csat_ec_item_embargoed(item_id)` · `csat_ec_session_held(session)` | 내부(정책 · 뷰 · 서버 함수) — 학습자 직접 실행 불가, 서버는 service role RPC 래퍼로 |
학생이 devtools 로 `status = completed` 를 쓸 경로가 없다(표 권한 0 · finish 는 서버 조건 확인).

## L. 전역 보류의 제품 영향

참가자 하나가 수집 중인 동안 **그 시험 45문항의 정답 · 해설 · 강의가 모든 사용자에게** 안 보인다(문항 본문은 보인다). 소규모 Pilot(학습자 3+ · 시험 몇 회)에서는 영향이 작지만 기간이 길어지면 커진다 → 보류 문항 수 · 보류 시간을 관리자 화면에서 보이게 하고, 오래 걸린 capture 는 관리자가 `closed_incomplete` 로 닫는다(자동 timeout 은 지금 정하지 않는다). 영향이 크면 Pilot 전용 문항 사본(별도 id 공간)으로 바꾼다 — 비교: 사본은 전역 영향 0 이지만 해설 · 분석 · 강의 데이터 복제와 진단 연결이 필요해 초기 Pilot 에는 과하다.

## M. 마이그레이션 객체(예상)

표 1(`csat_ec_capture_session` + 전이 가드 트리거) · RPC 6(record_session_held · my_capture_state · open · finish · close · 서버용 상태 조회) · 함수 2(item_embargoed · session_held) · 뷰 1 교체(`csat_items_public` — answer 를 embargo 면 null) · 정책 4 교체(`csat_item_analyses` · `csat_item_skeletons` · `csat_dx_session` · `csat_dx_response` 본인 SELECT) · 이벤트 1(`csat_ec_capture_closed`, 목록 preflight 포함). 기존 데이터 변경 없음. rollback SQL.

## N. 테스트

- 격리 PG: 전이(정상 · 역전 거부 · 건너뛰기 거부 · 멱등 finish) · 완료 조건(확인 없음 · 대상 하나 해석 없음 → 거부, skipped 포함 → 통과, 대기 probe 있어도 통과) · 생성 원자성 · embargo(A collecting · B completed → 보류 유지, 둘 다 끝 → 해제, closed_incomplete → 해제) · 뷰 · 정책(학습자 JWT 로 정답 · 분석 · 뼈대 · 본인 정오 직접 조회 → embargo 동안 null/0행) · 권한(학습자 상태 표 직접 쓰기 0).
- 개발 Supabase smoke(supabase-js): 위를 실제 PostgREST · GraphQL 로 + 다른 계정 우회 · 이벤트 행.
- 서버 단위: 각 경로(1 · 1c · 2 · 3/4 · 7 · 8 · 9 · 11)가 공통 함수를 쓰는지 · 캐시 뒤 필터.
- e2e: 참가자 저장 → 보드 · 결과 API · 문항 페이지 · 강의 API · 연습 카탈로그 모두 보류 → 다른 계정도 그 문항 해설 보류 → 수집 완료 → 해제 · 결과 공개. 「나중에 하기」 뒤에도 보류 유지. 비참가자 회귀 없음.

## O. 실제 Pilot 전에 남는 위험

1. **대상 목록 역산**: 정답 대조 수가 null 이면 대상 = 오답 목록이다 → 설정 검증이 `correctControls ≥ 1` 이 아니면 Pilot 을 열지 않는다(수치는 Pilot 승인 때). 대조를 넣어도 「대상은 대부분 오답」이라는 추론은 남는다 — 안내 문구에 정오를 암시하지 않는다.
2. **앱 밖 정답**: 평가원 · 교육청 정답표는 외부에 공개돼 있다 — 막을 수 없다. 학습자 확인(「응시 · 선지별 판단」)과 기록 시각 · 응시일 차이를 분석 때 함께 본다.
3. **수집 전 이미 본 해설**: 응시 전 · 저장 전에 같은 문항 해설을 봤는지는 알 수 없다(앱 로그로 일부만).
4. **관리자 화면**은 보류하지 않는다 — 관리자 계정을 참가자로 쓰지 않는다.
5. 전역 보류가 길어지면 다른 학습자 경험이 나빠진다(L) — 관리자 종료 절차가 Pilot 프로토콜에 있어야 한다.
6. 탐지기(blocker 2)는 이 설계 위에서 진행한다.

## P. 계획 리뷰(Codex) 반영 — 2026-10-05

| 지적 | 반영 |
|---|---|
| 전역 보류가 비참가자 흐름을 바꾼다 | **사용자 결정으로 유지**(다른 계정 우회 차단). 비참가자의 기록 · 결과 · 보고서 흐름은 불변, 바뀌는 것은 「보류 중인 시험 문항의 정답 · 해설 · 강의 · 연습 카탈로그 항목이 일시적으로 안 보임」뿐 — L 에 영향 · 관리 절차 |
| `closed_incomplete` 결과 공개 | 의도(사용자 지시 7항): 관리자의 **명시적** 종료(사유 필수)만 이 상태를 만든다. 결과는 공개되고, 그 세션 증거는 분석에서 「미완료」로 분리(완료 증거로 쓰지 않음). 학습자 스스로는 이 상태를 만들 수 없다 |
| 내부 함수 EXECUTE vs RLS 호출 | `csat_ec_item_embargoed` · `csat_ec_session_held` 를 **노출되지 않는 스키마**(`csat_ec_private`, PostgREST `db-schemas` 밖)의 읽기 전용 `SECURITY DEFINER` 함수로 두고 `authenticated` · `anon` 에 EXECUTE 만 준다 — 정책 · 뷰 평가에서는 호출되지만 REST · GraphQL 로는 부를 수 없다. 서버는 service role 래퍼 RPC(`public.csat_ec_reveal_state_for(session)` · `csat_ec_items_embargoed(item_ids)`, service_role 만)로 같은 함수를 부른다 |
| 삭제로 보류 해제 | ① `DELETE /api/csat/diagnosis/sessions` 는 held · collecting 세션을 거부(학습자는 수집을 끝내거나 관리자 종료). ② DB: 학습자 경로에서 쓰이는 삭제 RPC/정책도 같은 조건으로 거부. ③ 계정 삭제 같은 cascade 는 막지 않되 **AFTER DELETE 트리거가 묘비**(`csat_ec_capture_tombstone`: user_id · exam_id · 상태 · 시각)를 남기고, 같은 학습자가 같은 시험을 다시 기록하면 새 capture 행에 `reentry = true`(오염 가능 표시 — 분석에서 제외)를 단다. 테스트: 삭제 거부 · cascade 뒤 재기록 표시 |
| 설정 변경 뒤 영구 보류 | 수집 API(`ecContext`)의 접근 근거를 **현재 참가자 목록이 아니라 봉인된 capture 행**으로 바꾼다 — 행이 있는 본인 세션은 설정이 바뀌어도 열고 끝낼 수 있다. 새 capture 생성만 현재 설정(참가자 · v0.1 봉인 · TEST 아님)을 본다. taxonomy 는 행에 봉인돼 있어 설정의 버전이 바뀌어도 그 행의 v0.1 로 끝낸다 |
| 스냅샷 재계산 충돌 | 보류 세션은 저장 때 스냅샷을 **만들지 않는다**. completed · closed_incomplete 전이 때 처음 만든다(세션당 하나 제약과 충돌 없음 · `snapshotForSession` 의 기존 멱등 그대로). 보류 중에는 보드가 그 세션을 빼므로 이전 스냅샷이 보인다 |
| 대조 0개 | 생성 때 **실제 선정된** 정답 대조 수를 센다. 설정의 최소값(≥1, 수치는 Pilot 승인 때)보다 적으면 capture 를 만들지 않는다 — 그 기록은 일반 흐름(보류 없음 · Pilot 증거 아님)으로 남고 로그에 사유를 남긴다 |
| 탐지기 단계 언급 | 이 설계의 범위가 아니다 — O-6 은 「다음 별도 작업」 표시일 뿐 |

M(마이그레이션 객체) 갱신: + 스키마 `csat_ec_private` · 표 `csat_ec_capture_tombstone` · 컬럼 `reentry` · 삭제 경로 가드 · 서버 래퍼 RPC 2. N(테스트) 갱신: + 삭제 거부 · cascade 재기록 표시 · 설정 변경 뒤 재개 · 대조 0 이면 보류 없음 · 학습자 JWT 로 내부 함수 직접 호출 불가 · 정책 평가 정상.

## Q. 사용자 결정 · 계획 리뷰 2회차 반영 — 2026-10-05

**사용자 결정 1 — 보류의 목표 = 앱 안의 손쉬운 노출 차단.** 해설 · 정답 표시 · DB 직접 조회 · 연습 카탈로그 · 강의 · 함정 사례 · 판정 자료를 막는다. 다음은 막지 않고 **잔여 위험**으로 둔다: ① 다른(비참가자) 계정으로 같은 시험을 저장해 채점 결과로 정답을 역산 ② 평가원 · 교육청이 공개한 정답표. 관리: 학습자 확인(응시 · 선지별 판단) · 저장 시각 · 응시일 차이를 분석에 함께 둔다. 비참가자의 기록 · 채점 · 결과 · 보고서 흐름은 바꾸지 않는다.

**사용자 결정 2 — 수집 대상 = 정오와 무관하게 적격 문항 전체.** `selectTargets` 를 「고른 답 있음 · 듣기(1–17) 아님 · 발문 · 선지 있음 · body_ok」 문항 전부로 바꾼다(정오를 입력으로 받지 않는다). 대상 목록에서 정오를 역산할 수 없다. 부담은 문항당 입력을 가볍게(건너뛰기 = interpretation skipped 명시) 해서 줄인다. 설정의 `correctControls` 와 「대조 0개」 규칙은 없앤다(O-1 · P 「대조 0개」 해소 — 적격 문항이 0개인 기록은 Pilot 증거가 아니므로 capture 를 만들지 않는데, 이 판정도 정오와 무관하다).

| 리뷰 지적 | 반영 |
|---|---|
| 함정 아틀라스 JSON(`trap-atlas.ts`)이 클라이언트 번들에 문항 사례 · 오답 선지 · 해설 포함 | Matrix 16행 추가. 사례(examples)를 번들에서 빼고 서버 로더가 embargo 를 확인한 뒤 내려준다. 번들에 문항 id · 정답 · 해설 문자열이 남지 않는지 빌드 산출물 검사를 테스트에 추가 |
| 계정 삭제 cascade 가 embargo 를 푼다 | embargo 원천에 **묘비**를 포함: `csat_ec_capture_tombstone(exam_id, item_ids, status, deleted_at, closed_at)` — 학습자 · 세션이 지워져도 held · collecting 이던 capture 는 묘비에서 활성 embargo 로 남고, **관리자 명시적 종료**(`csat_ec_capture_close_tombstone`)로만 해제. 학습자 식별자는 묘비에 남기지 않는다(재진입 표시는 같은 계정일 때만 — 새 계정은 연결하지 않는다 = 잔여 위험 ①과 같은 범주) |
| 판정자 RPC `csat_ec_round_material` 이 배정된 비관리자에게 정답 반환 | Matrix 17행 추가. 판정 회차의 대상 문항이 embargo 면 비관리자 판정자에게 정답을 빼고 돌려준다(관리자는 예외 — 운영). Pilot 운영 규칙: 수집이 끝나지 않은 세션을 판정 회차 대상에 넣지 않는다(set_targets 가 held · collecting 세션을 거부) |
| 완료 뒤 확인 · 증거 변경 | 완료 · 종료 때 **봉인**: 확인 revision · 대상별 유효 증거 id 목록 · 판정 입력 해시를 capture 행에 저장. 그 뒤 `confirm_session` · `add_process_evidence` · `add_probe_response` 는 그 세션에 대해 거부(같은 응답 잠금 + 세션 잠금 아래 finish 와 직렬화) |
| 설정 해시만으로 봉인 판 복원 불가 | capture 행에 **설정 원문(jsonb)**: taxonomy · probe 상한 · 허용 probe {key, version, prompt_hash} 목록을 저장. 대기 질문 조회 · 응답 검증은 현재 `EC_PILOT`/`currentProbe` 가 아니라 행의 봉인 값과 `findProbe`(옛 판 포함)로 |

M 갱신(최종 예상): 스키마 `csat_ec_private` · 표 2(`csat_ec_capture_session` · `csat_ec_capture_tombstone`) · RPC: record_session_held · my_capture_state · open · finish · close · close_tombstone · 서버 래퍼 2 · 함수 2(private) · 뷰 1 교체 · 정책 4 교체 · RPC 수정 4(confirm · add_process_evidence · add_probe_response · round_material · set_targets) · 이벤트 1(`csat_ec_capture_closed`, preflight). 앱: selectTargets(정오 무관) · trap-atlas 사례 서버 로더 · 각 경로 서버 확인 · 「건너뛰기」= skipped 저장 · 「나중에 하기」 = 보류 유지.
N 갱신: + 번들 산출물에 사례 · 정답 문자열 없음 · 묘비 embargo 유지 · 판정자 정답 마스킹 · 완료 뒤 쓰기 거부 · 봉인 설정으로 판 검증 · 대상 = 정오 무관 전체(정오를 바꿔도 같은 대상).

## R. 계획 리뷰 3회차 반영 — 2026-10-05

| 지적 | 반영 |
|---|---|
| `csat_ec_add_student_claim` 이 오답일 때만 성공 → 정오 질의(oracle) | Matrix 18행. held · collecting 세션에는 **정오와 무관하게 거부**(먼저 capture 상태를 보고 같은 오류), 완료 · 종료 뒤에는 봉인 규칙(쓰기 거부). 이런 「성공/실패로 정오가 드러나는」 RPC 를 전수 점검: `add_process_evidence`(정오 무관) · `add_probe_response`(신호 유무 — 신호는 탐지기가 만들고, 탐지기는 정오를 입력으로 쓸 수 있으므로 **보류 중에는 정오를 쓰지 않는 신호만** — blocker 2 설계 조건으로 넘김) · 확인(무관) |
| `csat_ec_blind_queue` 가 비관리자 판정자에게 정답 | Matrix 19행. `blind_queue` · `round_material` 둘 다 요청마다 전역 embargo 를 적용(비관리자에게 embargo 문항의 정답 · 함정 키 마스킹). 기존 회차 · 다른 세션의 같은 문항 우회 테스트 |
| 연습 카탈로그의 파생 필드(`intentOptions` 가 다른 문항의 출제 의도를 복사) | 카탈로그 행과 파생 필드에 **출처 문항 id** 를 붙여 캐시하고, 요청마다 embargo 출처가 섞인 파생 값까지 제거 · 재구성(보류 문항이 다른 문항의 보기로 쓰이지 않게). 테스트: 보류 시작 **전**에 캐시를 채운 뒤 보류 → 요청에 그 문항 해설 · 의도가 어디에도 없음 |
| 묘비 생성 시 보류 범위 복원 불가 | capture 행에 생성 때 `exam_id` · `item_ids text[]`(그 세션 응답의 item_id 전체)를 **봉인**. 묘비는 capture 행의 BEFORE DELETE 트리거가 OLD 행의 봉인 값만으로 만든다(부모 · 응답 조회 없음 — cascade 순서와 무관). embargo 함수는 capture 행 ∪ 활성 묘비의 `item_ids` 를 본다 |
| 생성 · 조회의 적격성 불일치 | 적격 판정을 하나로: `pilotTargets(responses, items)` = 기록 품질 rq-1 trusted **그리고** 정오 무관 적격 문항. 생성 때 이 결과를 `targets` 로 봉인하고(0개 · trusted 아님이면 capture 를 만들지 않음 — 정오 무관 판정), 조회(`loadCapture`)는 다시 계산하지 않고 **봉인된 targets** 를 쓴다. 테스트: 생성 뒤 품질 규칙 · 문항 상태가 바뀌어도 같은 대상으로 재개 |
| `closed_incomplete` 증거가 완료 증거와 섞임 | `csat_ec_pilot_eligible` 에 「capture 행이 있으면 status = completed」 조건 추가(행 없는 기존 기록은 지금 규칙 그대로). `round_set_targets` · `ai_export` 도 같은 함수를 거친다. 회귀: closed_incomplete 세션은 회차 대상 · AI 입력에서 빠지고, 분석 집계에서는 별도 상태로 센다 |

## S. 계획 리뷰 4회차 반영 — 2026-10-05

| 지적 | 반영 |
|---|---|
| 참가자가 같은 시험을 부적격(전부 1번 등)으로 재기록해 보류 우회 | **증거 적격성과 공개 권한을 분리.** 참가자의 기록은 적격 여부와 무관하게 **항상** capture 행을 만든다(`evidence_eligible` 불리언 · targets 는 적격일 때만). 공개 규칙: 참가자 세션의 결과는 ① 그 세션 capture 가 completed · closed_incomplete 이고 ② **같은 학습자의 같은 시험에 활성(held · collecting) capture 가 하나도 없을 때**만. 부적격 기록(targets 없음)은 확인 뒤 바로 finish 할 수 있지만, ②때문에 같은 시험의 다른 활성 capture 가 끝나기 전에는 결과가 안 열린다. 비참가자는 결정 1 대로 그대로 |
| `csat_ec_reveal_view`(배정 판정자 — 판정 메모 · AI claim 근거) 누락 | Matrix 20행. `reveal_view` · `blind_queue` · `round_material` 모두 비관리자에게 요청마다 문항별 전역 embargo 마스킹(정답 · 함정 키 · AI claim 근거 · 판정 메모) |
| `csat_type_reports` published 직접 조회(오답 이유 등 문항 사례가 `open_questions` · `recurring_traps.signature` 에) | Matrix 21행. 사례 필드가 문항 id 를 구조적으로 담지 않을 수 있으므로 **보수적으로**: embargo 문항이 속한 유형(type_id)의 보고서는 비관리자에게 사례 필드(`open_questions` · `recurring_traps` · `answer_locus_pattern`)를 null 로 마스킹(뷰 · 정책 · 서버 로더 모두). 유형 화면 · DB 직접 조회 테스트 |
| 캐시가 학습자 RLS 로 채워져 보류 상태가 캐시에 굽히고, 해제 뒤 10분 복구 지연 | 원본 캐시는 **service role 로 읽은 보류 무관 원본**만(카탈로그 · 학평 뼈대), 보류 필터는 **요청마다** 적용 — 캐시에 보류 상태가 들어가지 않는다. 테스트: 보류 중 캐시 생성 → 해제 직후 요청에 곧바로 나타남 · 보류 시작 전 캐시 → 보류 요청에 안 나타남 |

## T. 계획 리뷰 5회차 반영 — 2026-10-05

| 지적 | 반영 |
|---|---|
| 같은 시험 A collecting · B completed 이면 B 경로로 우회 | 공개 판단의 단위를 세션이 아니라 **(학습자, 시험)** 으로: `csat_ec_private.exam_released(user, exam)` = 그 학습자의 그 시험에 활성 capture(held · collecting) 가 없다. 저장 응답 · 결과 API · 보고서 · 기록 상세 · 홈 · 스냅샷 · `csat_dx_session`/`csat_dx_response` 본인 SELECT 정책이 **모두 이 하나**를 쓴다(그 시험의 모든 세션이 함께 보류 · 함께 해제) |
| `csat_ec_process_evidence.item_input_hash`(정답 포함 · 비밀값 없는 sha256)를 본인 SELECT 로 읽어 정답 후보 대입 | 학습자의 원본 표 조회에서 `item_input_hash` 를 **컬럼 권한으로 회수**(authenticated 는 id · item_no · kind · value · created_at · supersedes_id 만). 앱 · RPC 는 `csat_ec_my_process_evidence`(해시 미포함)로 읽는다. 다른 학습자 노출 표도 점검: `csat_ec_claim.item_input_hash`(본인 학생 claim SELECT 가능) 같은 방식으로 회수. 테스트: 학습자 JWT 로 해시 컬럼 조회 거부 · 정답 후보 대조 불가 |
| 참가자 제거 · 설정 변경 뒤 같은 계정 재기록이 unrestricted 로 우회 | 생성 규칙: **(현재 참가자) 또는 (그 학습자의 그 시험에 활성 capture · 활성 묘비가 있음)** 이면 새 기록도 capture 행을 만든다(현재 설정과 무관하게 보류 유지). |
| 관리자 종료 뒤에도 다른 활성 capture 때문에 결과가 안 열림(수용 기준 충돌) | 관리자 종료 RPC 를 **(학습자, 시험) 단위**로: `csat_ec_capture_close(user_exam …, reason)` 가 그 학습자 · 시험의 활성 capture 를 한 트랜잭션에서 모두 `closed_incomplete` 로 — 종료와 공개 조건이 일치 |
| `csat_type_reports` 를 RLS 로 마스킹할 수 없음 · 원본 SELECT 가 마스킹 뷰를 우회 | 원본 표의 authenticated 정책을 관리자 전용으로 바꾸고(학습자 원본 SELECT 0), 학습자용 마스킹 뷰 `csat_type_reports_learner`(정의자 권한 · embargo 유형의 사례 필드 null)에만 SELECT 를 준다. 학습자 로더를 이 뷰로 바꾼다. 테스트: 학습자 JWT 로 원본 0행 · 뷰는 마스킹 |
| finish · close 직접 호출 · 커밋 뒤 장애 시 스냅샷 보장 안 됨 | 전이 RPC 가 같은 트랜잭션에서 **outbox** 행(`csat_ec_reveal_job(session_id, kind, created_at, done_at)`)을 남긴다. 앱 서버는 ① 학습자의 다음 진단 요청 ② 관리자 화면 ③ 주기 작업에서 미처리 job 을 멱등 처리(`snapshotForSession` 은 세션당 하나 · 이미 있으면 그대로). 스냅샷이 없을 때 보고서는 이전 스냅샷 + 「반영 중」으로 보인다(정오는 공개 조건이 열린 뒤에만) |

**리뷰 운영 메모**: 계획 리뷰 5회차까지 P1 이 매번 새 우회 경로를 찾았다(DB 직접 · 해시 · 판정자 RPC · 유형 보고서 · 캐시 · 재기록). 구현 단계에서 노출 경로 회귀 테스트(학습자 JWT 로 모든 csat 표 · 뷰 · RPC 를 훑어 보류 문항의 정답 · 해설 · 정오 문자열이 나오는지)를 **자동 전수 검사**로 만든다 — 목록을 손으로 늘리는 방식의 한계를 가드로 메운다.

## U. 계획 리뷰 6회차 반영 · 리뷰 종료 판단 — 2026-10-05

| 지적 | 반영 |
|---|---|
| 유형 보고서 `failure_modes` · `procedure_steps` 에도 문항 사례(「M2006#29 정답이 마지막 밑줄」) | 학습자 마스킹 뷰는 **허용 목록**으로 만든다 — 사례 가능 필드를 하나씩 빼는 게 아니라, embargo 유형이면 비사례 필드(유형 이름 · 개수 · 통계)만 내보내고 나머지 jsonb 는 전부 null. 직접 조회 테스트에 모든 jsonb 필드 |
| 기존 스냅샷(`csat_dx_snapshot`, 본인 SELECT)에 같은 시험 점수 · trend | 스냅샷 본인 SELECT 정책에 「스냅샷이 포함한 시험 중 공개 안 된 (학습자, 시험)이 없음」 — 포함 시험 목록을 스냅샷 행에 기록(`exam_ids`)해 정책이 판단. 보고서 로더도 같은 조건 |
| `add_student_claim` 이 같은 시험의 capture 없는 기존 세션에서 정오 oracle | 정오 검사 **전에** `exam_released(user, exam)` 를 확인하고, 아니면 정오와 무관한 같은 오류로 거부 |
| `reveal_view` 가 `to_jsonb(c)` 로 claim 전체(해시 포함) 반환 | 비관리자 반환을 **명시 필드 목록**으로 제한(해시 · 내부 키 제외). 모든 csat_ec RPC 반환에 `item_input_hash` · `input_hash` 가 비관리자에게 나가는지 자동 검사 |
| 묘비에서 학습자 식별자를 지우면 재기록 판정 불가 | 묘비 두 단계: 계정이 **있으면** capture 행 자체를 지우지 않는다(세션 삭제 API 는 보류 중 거부 — Q). 묘비는 **계정 삭제** cascade 때만 만들고 그때는 익명(재진입 연결 불필요 — 계정이 없다). embargo 는 묘비로 유지 |
| 생성 · finish · close 동시성 | 세 경로 모두 같은 `(학습자, 시험)` advisory 잠금(`csat_ec_exam|user|exam`) 아래서 판단 · 쓰기. 동시성 테스트(종료와 동시 재기록 → 둘 중 하나만 · 종료 뒤 결과 공개 일관) |
| 보고서는 세션 · 응답에서 즉시 계산하므로 「스냅샷 대기」가 안 생김 | 구분: 보고서 화면은 공개 조건이 열리면 **즉시** 세션 · 응답으로 계산해 보여 준다(대기 없음). 스냅샷 파생값(예측 · 추천 · 지도)만 outbox 처리 전까지 이전 값 + 「반영 중」 |

### 리뷰 종료 판단

계획 리뷰 6회 동안 P1 이 매번 새 경로를 찾았다(DB 뷰 · 해설 표 · 해시 · 판정자 RPC 3종 · 유형 보고서 · 스냅샷 · 캐시 · 파생 필드 · 재기록 · 묘비 · 동시성). **경로를 손으로 열거하는 설계는 수렴하지 않는다** — 구현의 핵심 통제는 다음 두 가지로 둔다.

1. **기본 거부(deny-by-default) 구조**: 학습자(authenticated)가 읽는 CSAT 표 · 뷰 · RPC 를 전수 목록화해, 문항 단위 데이터를 내보내는 객체는 모두 `csat_ec_private.item_embargoed` 또는 `exam_released` 를 거치게 한다. 새 객체가 이 목록에 없으면 실패하는 가드(마이그레이션 검사)를 둔다.
2. **자동 전수 노출 검사**(개발 DB smoke): 보류 상태를 만든 뒤 학습자 JWT 로 모든 노출 표 · 뷰 · RPC(목록은 `information_schema` · `pg_proc` 에서 자동 수집)와 앱 경로를 호출해, 보류 문항의 정답 번호 · 해설 문자열 · 정오 · 입력 해시가 응답에 나타나면 실패. 목록을 사람이 늘리지 않는다.

구현 승인 전 남은 위험: 이 두 통제가 생기기 전에는 「다 막았다」고 말할 수 없다. 사용자 결정 1의 잔여 위험(다른 계정 채점 역산 · 외부 정답표)은 그대로.

## V. 승인 조건 반영(사용자 2026-10-05) — SQL 초안의 기준

> **결정 변경**: 조건 2가 Q의 사용자 결정 1(「비참가자 결과 흐름 불변」)을 대체한다. 활성 capture 가 있는 시험은 **요청자 무관 · 정답 민감 출력 전체**(점수 · 정오 · 정답 · 해설 · 근거 · 강의 · 파생 보고 · 정오 oracle · 정답 파생 통계 · 해시)를 보류한다. 비참가자도 그 시험 결과 공개가 잠시 늦어질 수 있다. 영향이 크면 장기적으로 Pilot 전용 시험 사본.

### V1. 참가자는 capture 행이 없으면 fail-closed
- 저장 진입점을 하나로: `saveExamSession`(학습자 라우트 · 관리자 대리 라우트 공통). 참가자면 `csat_ec_record_session_held`(서비스 RPC — 기록 저장 · 적격 확정 · held 행 생성을 한 트랜잭션)만 쓴다. `csat_dx_record_session` 직접 호출은 이 함수 안에서만(가드 테스트: 다른 호출처 0).
- 서버 공개 판단: `참가자(설정) ∧ 행 없음` → **integrity error · 거부**(결과 공개 금지).
- DB 계층: 학습자 JWT 는 정오 · 점수(`csat_dx_response.is_correct` · `csat_dx_session.raw_score/grade` · `csat_dx_snapshot` 전체)를 **영구적으로 직접 못 읽는다**(컬럼 권한 회수) — 앱 서버만 단일 gate 를 거쳐 준다. 그래서 행이 빠진 버그가 있어도 DB 직접 조회로는 새지 않는다.

### V2. 시험 단위 전역 보류
- `csat_ec_private.exam_answer_embargoed(exam_id)` = 그 시험에 활성 capture(held · collecting) 또는 활성 묘비가 있다. `item_answer_embargoed(item_id)` = 그 문항의 시험이 보류. `can_reveal_exam(exam_id)` = not embargoed(전역이므로 요청자 인자 없음 — 참가자 fail-closed 는 V1 의 서버 단계).
- 비참가자 저장 응답 · 결과 API · 보고서 · 홈: 보류 시험이면 `{ held: 'exam_embargo' }` · 점수 없이 — 보류가 풀리면 다음 요청에 바로 보인다(상태 표 매 요청 계산).

### V3. 캐시는 gate 뒤
- 정답 민감 라우트는 `request → gate → data/cache` 순서. 해당 라우트만 `dynamic` · `no-store`. 공유 캐시는 **보류 무관 원본**만 담고(service role 로 채움), gate 는 요청마다 적용. 문항 본문 캐시는 유지.
- outbox(스냅샷 갱신)는 성능 · 파생값용 — 없거나 늦어도 공개 판단은 상태 표만으로 정확하다.

### V4. 자동 노출 검사 두 층
- **Layer A — 정적 분류 매니페스트**(`scripts/csat/reveal-gate/manifest.json`): 학습자(anon · authenticated)가 닿는 CSAT 객체 전수 — 표 · 뷰 · 컬럼(권한 기준) · RPC(EXECUTE 기준) · GraphQL 노출 · API 라우트 · 서버 로더 · 번들 JSON — 를 `PUBLIC_CONTENT` · `ANSWER_SENSITIVE` · `CORRECTNESS_ORACLE` · `DERIVED_SECRET` · `REVIEWER_INTERNAL` 로 분류. 스캐너가 DB(`information_schema` · `pg_proc` · `pg_class`)와 저장소(app/api · lib/csat import · 번들 대상)에서 목록을 **자동 수집**해 매니페스트에 없으면 실패. `DERIVED_SECRET`(item_input_hash · input_hash 등) · `REVIEWER_INTERNAL` 은 Pilot 무관 학습자 접근 영구 차단.
- **Layer B — 동적 canary 검사**: TEST 시험(`TEST_EC_CANARY`)에 고유 canary(정답 · 해설 · 근거 문자열)를 심고 활성 capture 를 만든 뒤, 학습자 JWT 로 모든 학습자 표면을 호출해 canary · 정답 파생 문자열이 나오면 실패.
- **행동 oracle 검사**: 선지 · 문항을 입력으로 받는 학습자 RPC · API 를 보기 1–5 로 각각 호출해 HTTP 상태 · 오류 코드 · 응답 모양 · 행 생성 · 후속 상태가 정답 여부에 따라 달라지면 실패.
- 성공 기준: 분류 누락 0 · canary 노출 0 · 행동 oracle 0 · 다른 계정 우회 0 · 오래된 캐시 우회 0. 「알려진 경로를 다 막았다」를 기준으로 쓰지 않는다.

### V5–V7. 상태 · 동시성 · 감사
- `held → collecting → completed`, 관리자 명시 종료 `closed_incomplete`(보류 해제에 쓰지만 분석에서는 attrition/exclusion — completed 와 동일 취급 금지). 역전 · 건너뛰기 · 완료 뒤 증거 쓰기 금지.
- 완료(finish)와 마지막 증거 쓰기는 같은 잠금 순서: ① `(학습자, 시험)` advisory ② 세션 행 FOR UPDATE ③ 응답 advisory. 완료 봉인 뒤 늦게 온 재시도는 새 행을 만들지 못하고(거부) 멱등 응답은 기존 결과.
- 상태 전이와 감사 이벤트(`funnel_events` 행: user_id · event · surface `csat_ec` · meta {session, from, to})는 **같은 트랜잭션**. 둘 중 하나만 남는 상태 없음.

### V8. 새 표 필요성
| 표 | 책임 | 수명 | FK · 삭제 | RLS · 권한 | 별도 표인 이유 |
|---|---|---|---|---|---|
| `csat_ec_capture_session` | 현재 상태(공개 판단의 원천) | 기록 저장 ~ completed/closed | `session_id` → `csat_dx_session` on delete cascade(+ 묘비 트리거) | FORCE RLS · 직접 권한 0 · RPC 전용 | 일반 진단 표와 Pilot 수명주기 분리 · 봉인 설정 · 대상 |
| `csat_ec_capture_tombstone` | 계정 삭제 cascade 뒤에도 남는 **활성 보류** | 삭제 시점 ~ 관리자 종료 | FK 없음(부모가 지워진 뒤에도 남아야 한다) · exam_id · item_ids 만, 학습자 식별자 없음 | 직접 권한 0 | 상태 행은 cascade 로 사라진다 — 보류를 계정과 독립으로 |
| `csat_ec_reveal_outbox` | 공개 뒤 파생값(스냅샷) 갱신 요청 | 전이 ~ 처리 | `session_id` on delete cascade | 직접 권한 0 · service | **선택 사항**(성능) — 공개 판단에 쓰지 않는다. 없어도 gate 는 정확 |

### V9. 단일 predicate
DB: `csat_ec_private.exam_answer_embargoed(exam)` · `item_answer_embargoed(item)` · `capture_state(session)`. 서버: `lib/csat/reveal-gate`(`canRevealExam(examId, userId)` · `isExamAnswerEmbargoed` · `isItemAnswerEmbargoed` · 참가자 fail-closed 포함). 라우트 · 로더는 상태 표를 직접 읽지 않는다(가드: `csat_ec_capture_session` 을 읽는 앱 파일은 reveal-gate 하나).

### V10. DB 접근 구조 — 기본 거부
학습자 JWT 의 정답 민감 객체 직접 접근을 **회수**하고, 학습자용 표면은 gate 를 내장한 **학습자 뷰**(`csat_learner_*`, 정의자 권한 · published · 보류 필터)만 둔다. 앱 로더 약 15파일(`csat_items_public` · `csat_item_analyses` · `csat_type_reports` · `csat_item_skeletons` · `csat_dx_*` 를 읽는 곳)을 학습자 뷰 또는 서버 gate 경로로 옮긴다. **적용 순서**: ① 앱 변경(뷰 · gate 경로 사용) 배포 ② 그 뒤 권한 회수 마이그레이션 — 거꾸로 하면 화면이 깨진다. SQL 은 ① 용(새 객체 · 뷰 · RPC)과 ② 용(회수)을 **두 파일**로 나눈다.

## W. SQL 초안 단계 산출물 (2026-10-05 · 미적용)

| 산출물 | 파일 | 상태 |
|---|---|---|
| migration ① 객체 · 정책 · RPC | `supabase/migrations/20261005170000_csat_ec_reveal_gate.sql` | 초안 · 격리 검증 |
| migration ② 정오 · 점수 학습자 직접 조회 회수 | `supabase/migrations/20261005170100_csat_ec_reveal_gate_revoke.sql` | 초안 · **앱 홈 카드 변경 뒤 적용** |
| rollback(②→①) | `scripts/csat/error-evidence/rollback-reveal-gate.sql`(원래 함수 원문 기계 추출) | 격리 검증 |
| 분류 매니페스트(Layer A) | `scripts/csat/reveal-gate/manifest.json` — DB 관계 39 · 함수 35(적용 뒤 +5) · API 15 · 페이지 12 · JSON lib 5 | 개발 DB 실측 대조: 분류 누락 0, 실패 2 = 비밀 해시 컬럼(① 이 막는다) |
| 표면 검사기 | `scripts/csat/reveal-gate/check-surfaces.mjs` | 동작 |
| canary · 행동 oracle 스캐너(Layer B) | `scripts/csat/reveal-gate/canary-scan.mjs` | 작성 — ① ② 적용 뒤 실행(`--app` 은 앱 gate 구현 뒤) |
| 격리 테스트 | `isolated-pg/t_reveal.mjs`(43) · `rollback-reveal.mjs`(11) | 통과 |

**SQL diff 요지(기존 객체)** — 함수 본문 교체 5: `add_student_claim`(보류 · 미완료면 정오 검사 **전에** 같은 오류) · `blind_queue` · `round_material`(비관리자 보류 문항 answer null) · `reveal_view`(명시 필드 — 해시 없음 · 비관리자 보류 문항 evidence/note null) · `pilot_eligible`(capture 행이 있으면 completed 만). 정책 조건 8(`csat_item_analyses` · `csat_item_skeletons` · `csat_type_reports` · `csat_dx_session` · `csat_dx_response` · `csat_dx_snapshot` · `csat_session_attempts` · `csat_trap_attempts`). 뷰 1(`csat_items_public.answer`). 컬럼 권한 2(`item_input_hash`). 확인 · 증거 · probe RPC 3종은 본문을 고치지 않고 **쓰기 가드 트리거**(완료 · 종료 뒤 거부)로 — 본문 복제를 줄였다. `round_set_targets` 는 고치지 않았다: 보류 세션을 대상에 넣어도 `start_blind` · `ai_export` · `round_inputs_intact` 가 `pilot_eligible` 로 막는다.

**격리 검증 결과**: 하네스 343/343(기존 300 + Reveal Gate 43) · 기본 하네스 225/225 · rollback 4종(기본 6 · Pilot 11 · 수집 12 · Reveal 11) 통과. 하네스 부트스트랩을 운영 정의로 맞췄다(진단 표 정책 이름 · SELECT 전용, `funnel_events` 컬럼, `csat_dx_record_session` 운영 원문, 보류 대상 표 요지, DB CREATE 권한) — 그 결과 기존 삭제 테스트 3건이 「학습자 직접 DELETE」에 기대고 있던 것을 운영 경로(service role)로 바로잡았다.

**동시성 테스트 계획**(격리 완료 · 개발 추가): ① 완료 vs 마지막 증거 쓰기(완료됨 — 봉인 밖 유효 증거 0) ② 관리자 종료 vs 같은 학습자 · 시험 재기록((학습자, 시험) advisory — 개발 smoke 에서 두 연결 겹치기) ③ 두 참가자 같은 시험 동시 생성(보류 유지 · 행 2) ④ finish 재시도 멱등(완료됨).
**캐시 테스트 계획**(앱 gate 구현 단계): ① 보류 시작 **전**에 카탈로그 · 뼈대 · 강의 캐시를 데운다 → 보류 → 요청에 보류 문항 · 파생 필드 없음 ② 보류 **중** 캐시 생성 → 해제 직후 요청에 곧바로 나타남(10분 지연 없음) ③ 정답 민감 응답의 `Cache-Control: no-store` 헤더 ④ outbox 를 끄고도 공개 판단 정확.

**앱 단계에서 해야 하는 것**(SQL 적용 · Pilot 전): `lib/csat/reveal-gate`(단일 서버 gate — 상태 표를 직접 읽는 앱 파일은 이것 하나) · 저장 단일 진입(`saveExamSession` → `csat_ec_record_session_held`) · 결과 · 보고서 · 기록 상세 · 홈 · 스냅샷 · 수집 화면 · 문항 페이지 · 강의 · reveal · 카탈로그 · 함정 아틀라스 사례의 gate · 「건너뛰기」= skipped · 「나중에 하기」= 보류 유지 · 수집 API 접근 근거를 봉인된 capture 행으로 · 삭제 API 보류 중 거부 · 홈 카드 서버 경로(② 전제).

### W-2. SQL · 보안 리뷰(Codex) 5회 반영 — 2026-10-05

| 회차 | 고친 결함(요지) |
|---|---|
| 1 | 관리자 종료와 증거 쓰기 직렬화(세션 행 잠금 순서) · 같은 client_key 로 다른 시험 · 답안이면 거부 · 스캐너 오류 처리 · SSR 쿠키 · 의도된 회수 |
| 2 | `round_material` · `reveal_view` 의 학생 범주 보고(존재 = 정오) 가림 · `csat_review_queue` 보류 · `csat_learner_state` ②회수 · rollback 컬럼 ACL · 스캐너 전수화(허용 컬럼 · 시그니처 · anon · 423 계약) |
| 3 | **학생 claim 본인 조회 보류 — 정책 안 `NOT EXISTS` 가 그 표의 RLS 로 평가돼 보류 행이 열리던 fail-open**(정의자 함수 `session_embargoed` + 구조 가드 · 운영 DB 기존 0건 실측) · 매니페스트 전 경로 요청 fixture · 서버 파일 로더 · `--bundle` |
| 4 | `add_student_claim` **정오 oracle 제거**(정답 문항 보고도 저장 — 참가자 capture 행이 빠져도 새지 않게) · 함수별 호출 계약 · 운영 제약 시험 id · 재귀 민감 필드 · rollback ACL 정렬 비교 |
| 5 | `reveal_view` 학생 claim 을 가리키는 검증 판정도 비관리자에게서 제외 · canary 소유 객체만 정리 · 역할별 컬럼 · oracle 값 비교 · HTML/RSC 근접 검사 · **앱 DB 로더 31개 자동 수집 · 분류**(앱 단계 작업 목록) · `v99` 정규식 `[.]` |

검증: 격리 PG 348/348 · 기본 225/225 · rollback(기본 6 · Pilot 11 · 수집 12 · Reveal 11) · 개발 DB 표면 검사 분류 누락 0(적용 전 실패 2 = 해시 컬럼, ① 이 막는다).
**리뷰 운영 메모**: 5회 모두 새 지적이 나왔고 뒤로 갈수록 스캐너 품질(P2) 비중이 커졌다. DB 층의 P1 은 회차마다 줄었다(5회차 P1 2 = canary 정리 · 판정 claim_id). 남은 검증은 개발 DB 적용 뒤 canary · oracle 실측과 앱 gate 구현 뒤 `--app` · `--bundle` 실측이 맡는다 — 손 리뷰를 더 돌리기보다 실측으로 닫는다.

## X. 앱 계층 구현 (2026-10-06 · `feat/ec-reveal-app`)

- **단일 관문** `apps/web/src/lib/csat/embargo-gate.ts`(server-only) — 판정은 서비스 RPC(`csat_ec_embargoed_exams` · `csat_ec_embargoed_items` · `csat_ec_reveal_state`)로만. `canRevealExam/Item/Session` · `embargoedExamIds/ItemIds` · `userHasHeldSession` · `loadRevealScope`(시험 → 문항 · 유형) · `assertRevealAllowed`(→ `RevealHeldError`) · `revealHeldResponse()`(423 · `{held:'exam_embargo'}` · no-store). **fail-closed**: RPC 오류 · 예외 = 보류.
- **경로**: reveal · lecture · 기록 결과 API = 데이터 읽기 전 423. 문항 해설 페이지 = 보류 안내(정답 · 분석 · 뼈대 · 강의 개요 없음). 진단 저장 = `csat_ec_record_session_held` 단일 진입(대상 = 정오 무관 · 적격 아니면 대상 0) → 보류면 `{held:true}` 만. 진단 입력 · 스냅샷 · 지도 · 보고서 = 보류 시험 기록 제외.
- **캐시**: 해부 카탈로그 · 세션 카탈로그 · Workspace 색인 · 뼈대 메모리 캐시는 **원본**을 담고 요청마다 `loadRevealScope` 로 거른다(파생 필드 — 함정 빈도 · 의도 대안 · 이력 — 도 거른 원본에서 다시 계산).
- **② 준비**: 홈 카드(`diagnosis/learner.ts`) · `/api/csat/state` 는 쿠키로 로그인만 확인하고 service role 로 읽는다. 앱의 학습자 JWT 직접 조회 중 ② 대상 컬럼(dx_session raw_score · grade, dx_response is_correct, snapshot, learner_state)은 남지 않는다.
- **분류 정정**(호출부 → 라우트 인증 근거): client · evidence · guide · hakpyeong-review-loader · heatmap · items · my-traps · order-view = 관리자 경로만 → `ADMIN_ONLY`(manifest 에 근거).
- **가드**: `embargo-gate-coverage.test.ts` — ANSWER_SENSITIVE · CORRECTNESS 파일이 관문 함수를 import · 호출하지 않거나, 민감 표면을 읽는 미분류 파일이 생기면 **실패**(기본 거부 · 픽스처로 실패 증명).
- **실측**(개발 DB · dev 서버): canary 기본 372/372 · `--app` 400/400(P · N 각 14 경로 + P·N 응답 모양 oracle) · `--bundle` 청크 382 통과. 남은 것: 공개 전이 뒤 스냅샷 재계산(`csat_ec_reveal_outbox` 처리기) 미구현 · `trap-atlas.json` 사례가 클라이언트 번들에 있다(check-surfaces `--bundle` 실패 2 — 하나는 관리자 도움말 문자열).

### X-2. 후속(2026-10-06 · 사용자 결정 7항)

- **ec-pilot 대상 = 정오 독립**: `selectTargets(cands, sealed)` — 봉인 capture 대상(`csat_ec_my_capture_state`) ∩ 내용 적격. `is_correct` · 정답표 · 채점 결과를 읽지 않는다(정적 가드 `targets-correctness-free.test.ts` + P/N 동일 대상 단위 테스트). 정답 대조군(`correctControls`)은 대상 결정에서 빠졌다.
- **trap-atlas 번들 분리**: `trap-atlas.json`(번들)의 예시는 slug · 회차 이름 · 번호 · 유형만. 문항 id · 오답 선지 · 끌리는 이유 · 버리는 법은 `trap-atlas-examples.json` + `trap-atlas-examples.ts`(server-only · 보류 필터) → 관리자 kice 화면이 props 로 받는다. `build-trap-atlas.mjs` 가 두 파일을 함께 굽고 `--check` 도 둘 다 본다. 관리자 도움말의 `--redo 2026#30,M1809#30` 은 정답 단서가 아닌 CLI 예시라 자리표시자로 바꿨다.
- **두 번들 검사는 다른 검사다**: `canary-scan --bundle` = TEST 시험 id · canary · 분석 키 / `check-surfaces --bundle` = 모든 문항 id 꼴 · 분석 키. 수정 뒤 둘 다 0.
- **스냅샷 따라잡기**: `csat_ec_reveal_outbox` 는 service_role 권한도 없는 표(FORCE RLS)라 앱이 읽지 못한다(새 DB 객체 금지). 같은 일을 `diagnosis/reveal-sync.ts` 가 워터마크 비교로 한다 — 보류가 없을 때만, 실패해도 보류로 되돌리지 않음, 재실행 안전. outbox 를 실제로 소비하려면 서비스 RPC 가 필요하다(다음 마이그레이션 후보).
- **관문 실패**: 판정 RPC 오류 · 시간 초과(4초) = 423 held · no-store. 로그는 `[reveal-gate] embargo`(info)와 `[reveal-gate] gate_failure`(error)로 가른다(`embargo-gate-failure.test.ts`).
- **함수 실행 정책 마이그레이션**(`20261006100000`, 다른 세션)이 학습자 EXECUTE 11개를 회수 → manifest `revoked_by` 로 기록, canary 는 회수된 함수를 거부 기대로 본다.


## G3 종료 (2026-10-06)

개발 DB 적용: ① `20261005170000` · ② `20261005170100` · ②b `20261006110000`(②가 남긴 anon 기본 표 권한 · authenticated 쓰기 권한 회수 — RLS 로 실제 노출은 0 이었으나 기본 거부를 권한 단위로 맞춤). 앱 계층(`lib/csat/embargo-gate.ts`)과 수집 상태 전이(open · finish) 배선 포함.

| 종료 기준 | 결과 |
|---|---|
| 표면 검사(분류 누락 · 낡은 항목 · 비밀 컬럼 · 비공개 스키마 · 번들 정적) | 0건 |
| 네 표(dx_session · dx_response · dx_snapshot · learner_state) anon 표 권한 · authenticated 금지 쓰기 권한 | 0 · 0 |
| ② 가 남긴 학습자 읽기 컬럼 | 정상(실제 API 스모크 22/22 — WHERE · ORDER BY 오라클 우회 거부 포함) |
| canary(production · --app · --bundle) | 392 PASS · 0 FAIL — leak 0 · oracle 0 · 참가자/비참가자 회귀 0 |
| Pilot 스모크 | capture 42 · pilot 104 · seed 12 |
| Security Advisor | 새 ERROR 0 |

**알려진 제한(P2 · 비차단)**: Snapshot correction is eventual, based on app-side reference-time comparison rather than a DB outbox; immediate snapshot consistency is not guaranteed. — 공개 전이 뒤 스냅샷 보정은 DB outbox 가 아니라 앱의 기준 시각 비교(`diagnosis/reveal-sync.ts`)로 나중에 맞춰진다. 「항상 즉시 일관된 스냅샷」을 보장하지 않는다. 그 밖의 리뷰 P2 6건은 Track B 보고에 기록.
