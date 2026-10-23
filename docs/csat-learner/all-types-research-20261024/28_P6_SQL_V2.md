# 28 — P6 노출 원장 SQL v2(적용 후보) · 검증 · RLS · 마이그레이션 · 비파괴 복구

> 상태: **적용 후보 · 개발 DB 미적용.** 사용자 승인(SQL 전문 확인) 전 실행하지 않는다. T-0140 은 BLOCKED_AUTH, main 통합 보류 유지.
> SQL 전문: `p6-sql/20261024100000_learning_exposures.v2.sql`(이 문서와 같은 커밋). 검증: `p6-sql/pglite-test.mjs` → `p6-sql/pglite-results.json`.
> 독립 검토: `27_P6_SQL_INDEPENDENT_REVIEW.md`(작성에 참여하지 않은 서브에이전트, DB 질의 없음 · 코드 읽기만).

## 1. v1(26 §4) 대비 변경

| # | 문제(v1) | v2 변경 | 근거 |
|---|---|---|---|
| 1 | **P0** `on delete cascade` 인데 삭제 거부 트리거가 실학습자 행에서 예외 → 계정 삭제 전체 실패 | 트리거를 `security definer` 로, `auth.users` 에 행이 없으면(계정 삭제 cascade) 삭제 허용. 합성 행도 허용 | 27 P0 · 기존 `learning_records_delete_guard` 와 같은 방식 · PGlite 「계정 삭제 cascade」 |
| 2 | **P1** `received_at default now()` = 트랜잭션 시작 시각 → 시도 · 노출 순서 오판 | `clock_timestamp()`. 판정 동률은 「노출 먼저」(독립 아님) | 27 P1 · PGlite 「동률」 |
| 3 | **P1** 새 표 기본 권한(Supabase 기본 GRANT)에 기대 — 익명 SELECT 회수 안 됨 | `revoke all … from anon, authenticated` 뒤 `grant select` 만 명시. service_role 은 select · insert · delete(트리거가 실행 제한), update · truncate 회수 | 27 P1 · PGlite 권한 9건 |
| 4 | **P1** P6 이전 시도를 독립으로 셀 위험 | `learning_exposure_tracking`(1행 · 시작 시각). 이전 시도 → `unknown_pre_tracking` | 27 P1 · PGlite 「추적 시작 이전」 |
| 5 | **P1** 독립 판정 조건 없음 | `learning_attempt_independence(attempt_id)` 조회 시 계산: synthetic · assisted(hint/viewed_first) · after_exposure(새 원장 + 기존 `learning_sessions.help_server_at · explanation_server_at`) · repeat(같은 문항 앞선 시도) · independent | 27 P1 · PGlite 독립 판정 8건 |
| 6 | **P2** 같은 요청 id 로 다른 내용 재전송 시 기존 id 반환 | 내용(item · kind · source) 다르면 예외 | 27 P2 |
| 7 | **P2** kind · source 조합 검증 없음 | `decisive_hint` 는 강의 경로(lecture_until · full · continue)만 | 27 P2 |
| 8 | 동시 재전송 경합 | RPC 안 `pg_advisory_xact_lock(user|item)` + UNIQUE | 27 P1(직렬화 권고 중 노출 쪽) |
| 9 | 사용자 검증 없음 | `p_user` null · 없는 사용자 거부 | 27 P2 |
| 10 | 출처 | `item_page_render` 값 추가(판단 장면 정답 블록이 첫 HTML 에 실리는 문제 — 사용 여부는 제품 결정) | 27 P0(원자성) |

## 2. 원자성 · 동시성 계약(코드 쪽, 승인 뒤 구현)

- **서버가 정답 내용을 보내는 경로**(강의 `scope=full` · 경계 「계속」 · reveal API): 노출 RPC 가 **커밋된 뒤에** 응답한다. 기록 실패 → 503, 정답 내용을 보내지 않는다(fail-closed). PGlite 「기록 실패 시 롤백 · 행 없음」 이 DB 쪽 전제를 확인.
- **결정적 단서**: `scope=until` 응답 때 그 강의 정지 전 위험이 `decisive_confirmed` 면 서버가 `decisive_hint`(lecture_until)를 같은 방식으로 먼저 기록.
- **판단 장면 정답 블록**: 지금은 문항 화면 첫 HTML 에 실려 있어 「보낸 순간」 = 페이지 렌더다. 원자 기록이 가능한 선택지는 (a) 렌더 때 `answer_direct · item_page_render` 기록(보수 — 해설 화면을 연 문항의 이후 시도는 독립 아님) 또는 (b) 정답 블록을 장면 진입 때 서버에서 받게 바꾸기. **제품 결정 필요** — 결정 전에는 「계측 범위 안의 독립」 으로만 주장한다.
- **남는 경합**: 기존 시도 RPC(`learning_attempt_submit` 등)는 바꾸지 않는다 — 시도와 노출이 같은 순간이면 `clock_timestamp` 동률 → 독립 아님. 서로 다른 트랜잭션의 커밋 순서 차이는 판정을 시도 쪽에 불리하게만(독립 아님 쪽으로) 만든다.

## 3. RLS · 권한(최종)

| 대상 | anon | authenticated | service_role |
|---|---|---|---|
| `learning_exposures` | 없음 | SELECT(본인 행 · RLS) | SELECT · INSERT · DELETE(합성 · cascade 만 트리거 통과) |
| `learning_exposure_tracking` | 없음 | SELECT | SELECT |
| `learning_exposure_record()` | 없음 | 없음 | EXECUTE |
| `learning_attempt_independence()` | 없음 | EXECUTE(RLS 로 본인 시도만 · 남의 것은 null) | EXECUTE |
| UPDATE · TRUNCATE | 모두 회수 · UPDATE 는 소유자도 트리거 거부 |

`p_user` 는 서버 라우트가 인증 세션에서 얻은 id 만 넘긴다(라우트 테스트로 고정 — 승인 뒤).

## 4. PGlite 검증 결과 — 33/33 PASS(`p6-sql/pglite-results.json`)

마이그레이션 적용 · 중복 재전송 1행 · 다른 내용 재전송 거부 · kind·source 제약 · 없는 사용자 · null 사용자 · clock_suspect · digest 형식 · **기록 실패 롤백(행 없음)** · 학습자 INSERT/RPC/UPDATE/DELETE 거부 · 본인 행만 SELECT · 익명 SELECT 거부 · service_role UPDATE/TRUNCATE 거부 · 실학습자 DELETE 거부 · 합성 DELETE 허용 · 소유자 UPDATE 거부 · 독립 판정(추적 이전 · 노출 없음 · 비소급 · 노출 뒤 · 동률 · assisted · repeat · synthetic · 기존 세션 해설 시각) · 남의 시도 판정 null · 익명 판정 거부 · **계정 삭제 cascade 성공** · 같은 요청 10회 → 1행.

한계: PGlite 는 연결이 하나 — 진짜 동시 트랜잭션 · advisory 잠금 대기는 재현하지 않았다(순차 재전송 · 고유 제약 · 동률로 근사). 기존 표는 판정에 쓰는 열만 둔 스텁이다(실제 RPC · 트리거 미포함). Supabase 실제 기본 권한 · `auth.uid()` 구현은 스텁.
v1 대조: 같은 검사를 v1 에 돌리면 독립 판정 · 추적 표식이 없어 해당 단계에서 실행이 멈춘다(계약 미충족 확인).

## 5. 마이그레이션 계획(승인 뒤)

1. 적용 직전 `ls supabase/migrations` · `list_migrations` 로 번호 충돌 확인(필요 시 번호만 바꿈).
2. SQL 전문 sha256 을 승인 기록에 남기고 `apply_migration` 으로 개발 DB 적용.
3. 적용 직후 읽기 전용 확인: 표 · 함수 · 트리거 · 정책 존재(`pg_policies` · `pg_proc` · `information_schema.role_table_grants`), `learning_exposure_tracking` 1행, 기존 `learning_*` 표 행 수 불변.
4. 합성 사용자로 기록 · 재전송 · 삭제 1회씩(합성 행 → 정리) — 실학습자 데이터 쓰기 없음.
5. 같은 SQL 을 저장소 `supabase/migrations/` 에 커밋(적용 이력과 본문 일치) + `docs/DB_SCHEMA.md` · CHANGELOG.

## 6. 비파괴 복구 계획

- **1단계(기본 · 데이터 보존)**: 쓰기 중단 — `revoke execute on function public.learning_exposure_record(…) from service_role;` 그리고 앱의 기록 호출을 끔. 표 · 기록 · 판정 함수는 남긴다(이미 쌓인 노출은 비소급 판정의 근거라 지우지 않는다). 되돌리기: 같은 GRANT 재부여.
- **2단계(판정 함수 결함)**: `create or replace function public.learning_attempt_independence` 로 교체(저장 데이터 무변경 — 조회 때 계산이라 소급 문제 없음).
- **3단계(완전 철거)**: `drop` 은 데이터 삭제를 동반 → 별도 명시 승인 · 사전 스냅샷(`/db-checkpoint`) 필수. 이번 승인 범위에 넣지 않는다.

## 7. 남은 결정 · 미검증

- 판단 장면 정답 블록 노출 처리(§2 a/b) — 제품 결정.
- 「첫 풀이 단계(phase) · 같은 판본(content_hash)」 을 독립 조건에 넣을지 — 현재 판정은 문항 단위(판본 무관: 답이 같으므로 노출은 판본을 넘는다). phase 제한은 소비자(학습지도) 계약과 맞춰 결정.
- 실제 Supabase 에서의 권한 · RLS · advisory 잠금 동작: 적용 후 확인 전까지 미검증.
- 학습 효과: 미검증.
