# P6 노출 원장 SQL 독립 검토(2026-10-24)

대상: `26_P6_RECORD_DESIGN.md` §4(제안·미적용). 검토자는 작성자가 아니다. DB 에는 아무것도 적용하지 않았다. 근거로 읽은 것은 main 의 `20261008190000_learning_records_append_only.sql`(`learning_records_delete_guard` 는 security definer 함수이며 `auth.users` 에 행이 없으면 cascade 삭제를 허용한다)뿐이다.

## 판정 요약

| # | 심각도 | 문제 |
|---|---|---|
| 1 | **P0** | `on delete cascade` 와 append-only 트리거가 충돌한다. 실학습자 계정을 지우면 cascade DELETE 가 트리거에서 예외로 끝나고, 계정 삭제 전체가 실패한다(삭제권 침해·운영 장애). |
| 2 | **P0** | 정답을 전달하는 일과 노출 기록 사이에 원자성이 없다. 응답을 먼저 보내거나 기록 실패를 무시하면, 노출이 기록되지 않은 채 다음 시도가 '독립'으로 판정된다. |
| 3 | P1 | 순서 판정을 `received_at default now()` 에 맡긴다. `now()` 는 트랜잭션 시작 시각이므로, 동시에 들어온 시도와 노출의 순서가 커밋 순서와 어긋날 수 있다. 같은 시각이면 판정이 정의되지 않는다. |
| 4 | P1 | 새 표의 SELECT 권한이 Supabase 기본 권한에 맡겨져 있다(명시 revoke·grant 가 없다). 노출 행 id 만으로는 시도와 노출의 순서 결속이 없다. |
| 5 | P1 | P6 이전 기록과 계측하지 않은 화면에는 노출 정보가 없다. 이런 기록을 '독립'으로 셀 위험이 있다. |
| 6 | P2 | 같은 `client_exposure_id` 를 다른 내용으로 재전송해도 기존 id 를 그대로 돌려준다(충돌 은폐). `p_user` 는 서버가 신뢰하는 값이라 route 쪽 강제가 필요하다. 입력 검증(kind·source 조합)이 약하다. |

## 1. 원자성 · 경합

- **규칙**: 정답을 담은 응답(lecture `scope=full`, boundary continue, judgment 정답 블록, reveal API)은 **노출 RPC 가 커밋된 뒤에만** 보낸다. RPC 가 실패하면 503 을 돌려주고 내용은 보내지 않는다(fail-closed).
- 판단 장면 블록은 클라이언트가 이미 가진 데이터를 보여 주므로 원자성을 보장할 수 없다. 이 경로는 '열람 보고'일 뿐이니, 숙달 판정에서는 해당 문항의 판단 장면이 로드되기만 해도 노출로 보거나, 블록을 서버 경유로 바꿔야 한다(제품 결정).
- **순서**: `received_at` 을 `clock_timestamp()` 로 바꾸고, 시도와 노출이 같은 순서원을 쓰게 한다. 학습자·문항 단위 advisory 잠금으로 attempt 기록과 exposure 기록을 직렬화하고, 같은 시각이면 노출이 먼저인 것으로 본다(보수적).

## 2. RPC 권한

- security invoker + service_role 전용 + `search_path` 고정 + public/anon/authenticated 의 실행 권한 회수. 이 구성은 타당하다.
- `p_user` 는 route 가 `auth.getUser()` 로 얻은 id 만 넘긴다(바디 값 사용 금지). 테스트로 고정한다.
- 충돌 시에는 기존 행의 내용이 같을 때만 id 를 돌려주고, 다르면 예외를 낸다.

## 3. 삭제 · 권한

- 트리거는 기존 guard 와 같은 방식으로 `auth.users` 에 행이 없으면(cascade) 삭제를 허용해야 한다. 이 함수는 definer 여야 한다.
- TRUNCATE 는 행 트리거를 타지 않는다. service_role 의 TRUNCATE 회수는 이미 들어 있어 타당하다. postgres 소유자에게는 TRUNCATE 가 남는다(수용).
- `revoke all ... from anon, authenticated` 뒤에 `grant select ... to authenticated` 를 명시한다.

## 4. 기존 learning_task_attempts 를 '독립'으로 볼 추가 조건(모두 만족)

1. `synthetic = false`
2. help_level 0, 또는 도움 없음(`help_server_at is null`)
3. 해당 세션의 `revealed_at` 과 `explanation_server_at` 이 시도보다 앞서지 않는다(null 또는 시도보다 늦다).
4. phase·activity 가 첫 풀이 단계이다(복습·재시도 단계 제외).
5. content_hash·version 이 노출 행의 analysis_version·lecture_digest 와 같은 판본이다. 판본이 다른 노출도 보수적으로 노출로 셈한다(문항 단위).
6. 같은 문항의 이전 시도가 없다(첫 시도). 재시도는 노출 여부와 관계없이 독립이 아니다.
7. 계측하지 않은 화면(다른 모듈의 해설, 영상 등)에서 그 문항을 본 경우는 알 수 없다. 이런 시도는 '독립(계측 범위 내)'으로 표기하고, 전체 독립으로 주장하지 않는다.

## 5. P6 이전 기록

- `learning_exposure_tracking` 표(또는 설정 행)에 `tracking_since` 를 둔다. `received_at < tracking_since` 인 시도는 `unknown` 으로 분류해 독립에 산입하지 않는다.
- 판정 함수는 'unknown' 을 PASS 로 바꾸지 않는다.

## 최소 SQL 변경(diff)

```diff
-  received_at timestamptz not null default now(),
+  received_at timestamptz not null default clock_timestamp(),
+  check ((kind = 'answer_direct') = (source in ('lecture_full','reveal_api','judgment_scene')) or kind = 'decisive_hint'),

-create function public.learning_exposures_append_only() returns trigger
-language plpgsql set search_path = public, pg_temp as $$
+create function public.learning_exposures_append_only() returns trigger
+language plpgsql security definer set search_path = public, pg_temp as $$
 begin
   if tg_op = 'UPDATE' then raise exception '노출 원장은 고칠 수 없다(append-only)'; end if;
+  if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if; -- 계정 삭제 cascade 허용
   if not old.synthetic then raise exception ...; end if;

-revoke insert, update, delete, truncate on public.learning_exposures from anon, authenticated;
+revoke all on public.learning_exposures from public, anon, authenticated;
+grant select on public.learning_exposures to authenticated;

 -- RPC 본문 첫 줄
+  perform pg_advisory_xact_lock(hashtext('lx:' || p_user::text || ':' || p_item_ref));
 ...
   if v_id is null then
-    select id into v_id from public.learning_exposures where user_id = p_user and client_exposure_id = p_client_exposure_id;
+    select id into v_id from public.learning_exposures where user_id = p_user and client_exposure_id = p_client_exposure_id
+      and item_ref = p_item_ref and kind = p_kind and source = p_source;
+    if v_id is null then raise exception 'client_exposure_id 재사용 — 내용 불일치'; end if;
   end if;

+create table public.learning_exposure_tracking (id boolean primary key default true check (id), tracking_since timestamptz not null);
+-- 배포 시 insert (clock_timestamp()); 판정은 attempt.received_at < tracking_since → unknown
```

시도 기록 경로(`/api/csat/session/record`)도 같은 advisory 잠금 키를 잡고, 노출과 시도에 같은 `clock_timestamp()` 를 기록해야 순서가 확정된다. 이 부분은 코드 변경이며, 이번 범위의 SQL 이 아니다.
