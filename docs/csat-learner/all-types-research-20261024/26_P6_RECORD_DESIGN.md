# 26 — P6 학습 기록 설계(정답 열람 · 해설 후 확인 · 독립 수행 · 숙달 구분)

> 상태: **설계 제안 · DB 미적용.** 아래 SQL 은 승인 전 실행하지 않는다. 근거 조사: `25_P6_RECORD_SURVEY.md` + 2026-10-24 직접 SELECT(information_schema · pg_proc · pg_policies · pg_constraint).
> 대상 화면: 기출 해설 화면(AnalysisTheater) · 강의 정답 공개 경로(T-0140).

## 1. 현재 구조 사실(직접 확인)

| 대상 | 사실 |
|---|---|
| `learning_sessions` | 문항 × 학습자 세션 1행. `help_level` 3단계(independent · hint · viewed_first) · `revealed_at` · `explanation_viewed_at` · 서버 시각 `help_server_at` · `explanation_server_at` · `help_clock_suspect`. `stage_shape` CHECK 가 stage 와 help_level · revealed_at 을 묶는다. UNIQUE(user_id, client_session_id). 쓰기는 `learning_session_apply`(security invoker, `p_user` 를 받는 서버 경로) |
| `learning_task_attempts` | 시도 append-only. `content_hash`(버전 결속) · `help_level` · `phase`(pre · practice · post · delayed · transfer · review) · `received_at`(서버). UPDATE 거부 트리거 · 실학습자 행 DELETE 거부 |
| `learning_mutations` | 요청 원장(중복 방지 키 `client_mutation_id`) · append-only 트리거. `kind` CHECK = session · attempt |
| RLS | 세 표 모두 학습자 본인 SELECT 만. 쓰기는 서버(RPC) |
| 숙달 | 판정 로직 없음(자동 승격 경로 없음 — 25 참조) |
| `csat_learner_state` | 기기 화면 상태(jsonb 통째) — 병합 · 삭제 가능, 기록 정본 부적합 |

## 2. 기능별 방식 선정(목표 적합성 먼저, 비용 나중)

| 기능 | 후보 | 판단 |
|---|---|---|
| **노출 기록**(정답 직접 · 결정적 단서 · 정답 블록 열람) | REUSE `learning_sessions.help_level` | **탈락** — 3단계라 정답 직접/결정적 단서를 못 가르고, 강의 digest · 경계 · analysis_version 결속이 없다 |
| | IMPROVE `learning_sessions` + RPC 서명 변경 | 가능하나 `stage_shape` CHECK · 기존 RPC 소비자 전부 영향 — 한 세션 1행이라 노출 「사건」 여러 개(언제 · 어떤 경로)를 남기지 못한다 |
| | **NEW 최소 원장 `learning_exposures`(append-only)** | **선정** — 사건 단위 · 비소급(UPDATE/DELETE 거부) · 결속 열 · 기존 표 무변경 |
| **독립 수행** | **REUSE `learning_task_attempts`** | **선정** — append-only · content_hash 결속 · 서버 수신 시각. 「독립」 여부는 저장값이 아니라 **조회 시 계산**: 같은 학습자 · 문항의 첫 노출(answer_direct · decisive_hint) 서버 시각보다 시도 `received_at` 이 앞서면 독립. 나중 노출이 앞 시도를 바꾸지 못한다(비소급) |
| **해설 후 확인** | **REUSE `learning_task_attempts`** | 선정 — 첫 노출 뒤의 시도(같은 문항) = 해설 후 확인. 별도 열 불필요 |
| **숙달** | REUSE(현 판정 없음 유지) | 선정 — 노출 · 강의 재생 · 완주 · 세션 종료는 숙달 입력이 아니다. 회귀 테스트로 고정 |
| **복구(재로그인 · 다기기)** | 서버 원장 정본 · `csat_learner_state` 는 화면 재개 캐시 | 선정 |

## 3. 데이터 계약

노출 사건 1행 = (학습자, 문항, 종류, 출처, 결속, 시각). 종류:
- `answer_direct` — 정답 번호 · 정답 블록이 학습자에게 실제로 나갔다(강의 경계 통과 「계속」, 전체 강의 경로에서 확정 공개 cue 재생, 판단 장면 정답 블록 열람, 기존 reveal API)
- `decisive_hint` — 결정적 단서 확인(`decisive_confirmed`) 구간이 재생됐다(정답 직전 경로 포함)
- 출처 `source`: lecture_until · lecture_full · lecture_continue · judgment_scene · reveal_api
- 결속: `item_ref` · `analysis_version` · `lecture_version` · `lecture_digest` · `cue_id`(강의일 때)
- 시각: `occurred_at`(클라이언트) · `received_at`(서버 now(), 판정 기준) · `clock_suspect`(차이 > 10분)
- 중복: UNIQUE(user_id, client_exposure_id) — 같은 사건 재전송은 1행

「실제로 나갔다」 의 기준: 서버가 해당 cue 를 응답으로 보낸 시점이 아니라 **학습자 화면에서 재생 · 표시된 시점**을 클라이언트가 보고한다. 서버 응답 기록(scope=full 응답 발송)은 보조 증거로 같은 원장에 `source=lecture_full` · `kind=answer_direct` 로 남길 수 있다 — 응답을 받았으나 재생 전에 떠난 경우도 「노출됨」 으로 보수 처리(독립 수행을 과대 인정하지 않는다).

## 4. 승인 요청 SQL(제안 · 미적용)

파일명 제안: `supabase/migrations/20261024100000_learning_exposures.sql` (적용 직전 `ls supabase/migrations` 로 번호 재확인).

```sql
-- 학습자 노출 원장(P6) — 정답 직접 · 결정적 단서 노출 사건. append-only · 본인 SELECT · 쓰기는 서버 RPC
create table public.learning_exposures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_exposure_id uuid not null,
  item_ref text not null check (length(item_ref) between 1 and 120),
  kind text not null check (kind in ('answer_direct', 'decisive_hint')),
  source text not null check (source in ('lecture_until', 'lecture_full', 'lecture_continue', 'judgment_scene', 'reveal_api')),
  analysis_version integer,
  lecture_version integer,
  lecture_digest text check (lecture_digest is null or lecture_digest ~ '^[0-9a-f]{64}$'),
  cue_id text check (cue_id is null or length(cue_id) between 1 and 40),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  clock_suspect boolean not null default false,
  synthetic boolean not null default false,
  unique (user_id, client_exposure_id)
);
create index learning_exposures_user_item on public.learning_exposures (user_id, item_ref, received_at);

alter table public.learning_exposures enable row level security;
create policy learning_exposures_own_select on public.learning_exposures for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.learning_exposures from anon, authenticated;
revoke update, truncate on public.learning_exposures from service_role;

-- 비소급: 실학습자 행은 고치지도 지우지도 못한다(합성 행만 삭제 허용 — 기존 원장과 같은 규칙)
create function public.learning_exposures_append_only() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then raise exception '노출 원장은 고칠 수 없다(append-only)'; end if;
  if not old.synthetic then raise exception '실제 학습자의 노출 기록은 지울 수 없다 — 합성 기록만 정리할 수 있다'; end if;
  return old;
end $$;
create trigger learning_exposures_append_only before update or delete on public.learning_exposures
  for each row execute function public.learning_exposures_append_only();

-- 기록 RPC — 서버(service role) 경로에서만 부른다. 같은 client_exposure_id 재전송은 기존 행을 돌려준다
create function public.learning_exposure_record(
  p_user uuid, p_client_exposure_id uuid, p_item_ref text, p_kind text, p_source text,
  p_analysis_version integer, p_lecture_version integer, p_lecture_digest text, p_cue_id text,
  p_occurred_at timestamptz, p_synthetic boolean default false
) returns bigint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  insert into public.learning_exposures (user_id, client_exposure_id, item_ref, kind, source, analysis_version, lecture_version, lecture_digest, cue_id, occurred_at, clock_suspect, synthetic)
  values (p_user, p_client_exposure_id, p_item_ref, p_kind, p_source, p_analysis_version, p_lecture_version, p_lecture_digest, p_cue_id, p_occurred_at,
          abs(extract(epoch from (now() - p_occurred_at))) > 600, coalesce(p_synthetic, false))
  on conflict (user_id, client_exposure_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.learning_exposures where user_id = p_user and client_exposure_id = p_client_exposure_id;
  end if;
  return v_id;
end $$;
revoke all on function public.learning_exposure_record(uuid, uuid, text, text, text, integer, integer, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.learning_exposure_record(uuid, uuid, text, text, text, integer, integer, text, text, timestamptz, boolean) to service_role;
grant insert, select, delete on public.learning_exposures to service_role;
```

롤백(같은 승인 범위 · 실데이터가 있으면 별도 삭제 승인 필요):
```sql
drop function if exists public.learning_exposure_record(uuid, uuid, text, text, text, integer, integer, text, text, timestamptz, boolean);
drop trigger if exists learning_exposures_append_only on public.learning_exposures;
drop function if exists public.learning_exposures_append_only();
drop table if exists public.learning_exposures; -- 데이터 삭제를 동반 — 별도 명시 승인
```

영향 범위: 새 표 1 · 함수 2 · 트리거 1 · 정책 1. 기존 표 · 함수 · 정책 · 데이터 변경 없음. 기존 소비자 영향 없음.

## 5. 검증 계획(적용 후)

1. PGlite 격리(저장소 기존 `*.pglite.test.ts` 방식): 같은 client_exposure_id 2회 → 1행 · UPDATE 거부 · 실학습자 DELETE 거부 · 합성 DELETE 허용 · anon/authenticated INSERT 거부 · 본인 SELECT 만.
2. 독립 판정 순수 함수 단위 테스트: (시도 received_at, 첫 노출 received_at) 조합 — 노출 전 시도 독립 · 노출 후 시도 해설 후 확인 · 나중 노출이 앞 시도 판정을 바꾸지 않음 · clock_suspect 는 서버 시각만 사용.
3. API 라우트(서버 RPC 호출) 테스트 · 실계정 E2E(BLOCKED_AUTH 해소 뒤): 경계 「계속」 · 판단 장면 정답 블록 열람이 노출 1행씩.
4. 숙달 비산입 회귀: 노출 · 재생 · 완주 · 세션 종료가 학습지도 상태를 바꾸지 않음.

## 6. 미구현 · 미검증

- 클라이언트 보고 지점(경계 계속 · 전체 강의의 확정 공개 cue 재생 · 판단 장면 열람)과 API 라우트는 승인 뒤 구현.
- 판단 장면 정답 블록은 현재 공개 통제 대상이 아니다 — 열람 기록만 남기는 설계(노출 차단은 별도 제품 결정).
- 학습 효과 · 이해 · 숙달: 미검증.
