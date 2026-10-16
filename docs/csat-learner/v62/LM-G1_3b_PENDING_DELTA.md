# LM-G1.3b — 승인 대기 변경안(SQL 미적용)

> LM-G1.3a 에서 지금 DB 계약으로 **안전하게 할 수 없는** 목표 기능만 모았다. 아래 SQL 은 **적용하지 않았다** — 사용자 승인 뒤 별도 PR · 마이그레이션.
> 승인 대기는 LM-G1.3a 의 다른 작업(점수 · 시험 · 등급 · 목표일 저장 · 기준 시험 범위 · PLAN 목표 버전)을 막지 않는다.

## 1. 왜 지금 스키마로 안 되나

| 기능 | 막는 것 |
|---|---|
| 등급만인 목표 | `csat_map_goal.target_score` · `csat_map_goal_version.target_score` NOT NULL — 점수를 지어 넣을 수 없다 |
| 회차 · 형 · 복합 시험 범위 | `target_exam` 은 단일 text + CHECK 4값 — 여러 시험 · 회차 · 형을 담을 칸이 없다 |
| 주간 시간 예산 · 개인 초점 | 열 없음 |
| 같은 키 다른 본문 원자 거절 | RPC 가 키만 본다 — 지금은 앱이 먼저 비교(경합 창: 같은 키 두 다른 요청이 동시에 오면 RPC 는 먼저 들어간 쪽만 저장하고 다른 쪽에도 같은 id 를 돌려줄 수 있다) |
| 등급을 계산에 쓰기 | 시험 체제별 등급 규칙 정본이 없다(절대평가 구간 표는 참고일 뿐) |

## 2. 재사용 가능한 기존 필드

`csat_map_goal_version`(target_grade · target_exam · target_date · client_key · created_at) · `learner_workspace_plan.goal_version_id` · `csat_map_goal_set` 의 잠금 · 멱등 구조 · RLS(본인 읽기 · 쓰기는 service role RPC).

## 3. 최소 변경안(초안 — 미적용)

```sql
-- (a) 등급만 목표: 점수 NULL 허용 + 점수/등급 중 하나는 필수
alter table public.csat_map_goal_version alter column target_score drop not null;
alter table public.csat_map_goal_version add constraint csat_map_goal_version_score_or_grade check (target_score is not null or target_grade is not null);
-- csat_map_goal(최신 표)은 점수 계산 경로가 읽으므로 NOT NULL 유지 — 등급만 목표일 때 최신 표를 갱신하지 않고 계산은 「목표 점수 없음」(toBe null)으로

-- (b) 확장 목표 snapshot(회차 · 형 · 복합 범위 · 시간 예산 · 개인 초점) — 검증은 RPC 에서
alter table public.csat_map_goal_version add column target_spec jsonb;  -- { examScope: { kinds[], rounds[], form }, minutesPerWeek, personalFocus[] , specVersion }

-- (c) RPC v2: 같은 키 다른 본문을 원자적으로 거절
create or replace function public.csat_map_goal_set_v2(p_user uuid, p_score smallint, p_grade smallint, p_exam text, p_date date, p_spec jsonb, p_client_key uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; v_row public.csat_map_goal_version;
begin
  -- 검증(점수 또는 등급 · spec 형식) 생략 — 승인안 리뷰 때 확정
  perform pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text));
  select * into v_row from public.csat_map_goal_version where user_id = p_user and client_key = p_client_key;
  if found then
    if v_row.target_score is distinct from p_score or v_row.target_grade is distinct from p_grade or v_row.target_exam is distinct from p_exam
       or v_row.target_date is distinct from p_date or v_row.target_spec is distinct from p_spec then
      raise exception 'goal_client_key_reused' using errcode = '23505';
    end if;
    return v_row.id;
  end if;
  if p_score is not null then
    insert into public.csat_map_goal (user_id, target_score, updated_at) values (p_user, p_score, now())
      on conflict (user_id) do update set target_score = excluded.target_score, updated_at = now();
  end if;
  insert into public.csat_map_goal_version (user_id, target_score, target_grade, target_exam, target_date, target_spec, client_key)
    values (p_user, p_score, p_grade, p_exam, p_date, p_spec, p_client_key) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.csat_map_goal_set_v2(uuid, smallint, smallint, text, date, jsonb, uuid) from public, anon, authenticated;
```

## 4. 호환 · 이관

- 기존 이력 행은 그대로(새 열 null). 읽기는 `target_spec is null` 이면 지금 의미.
- PLAN `goal_version_id` 는 그대로 — 새 목표 행도 같은 id 계열.
- 등급만 목표의 계산: 점수가 없으므로 toBe 는 「목표 점수 없음」 — 등급을 점수로 바꾸지 않는다(정본 등급 규칙이 생기기 전까지).

## 5. 권한 · RLS · 멱등 · 충돌

- 쓰기는 service role RPC 만(기존과 같음) · 학습자 RLS 는 본인 읽기만.
- v2 RPC 가 같은 키 다른 본문을 `23505 goal_client_key_reused` 로 거절 → 앱 409(앱 사전 비교는 남겨 두되 경합 창을 DB 가 닫는다).

## 6. 검증 계획(적용 전후)

- 적용 전: `/db-checkpoint before lm-g1-3b` · PGlite 격리 실행(등급만 · 같은 키 다른 본문 동시 2요청 · spec 검증 실패) · 기존 행 수 · 최신 표 = 최신 이력 점수 불변식.
- 적용 후: `db_health_checkpoint_diff` · LM-G1.3a e2e(T01–T15) · R5 수직 회귀 · 기존 목표 이력 행 수 불변.

## 7. 되돌리기 · 보존

- (a) 되돌림: 점수 null 행이 생겼다면 되돌리기 전 그 행을 보존 테이블로 복사 → NOT NULL 재설정. (b) 열 drop 은 데이터 손실이므로 되돌림 대신 무시(읽기 중단). (c) v2 함수 drop · 앱은 v1 로.

## 8. 사용자 승인 필요 사항

1. (a) 등급만 목표 허용 여부와 그때의 계산 의미(목표 점수 없음).
2. (b) 확장 목표 snapshot 의 범위(회차 · 형 · 복합 · 시간 예산 · 개인 초점) 중 무엇을 받을지.
3. (c) RPC v2 로 같은 키 다른 본문을 DB 에서 원자 거절.
4. 등급 규칙 정본(시험 체제별) — 등급을 계산에 쓸지.
5. 학평 계산 지원 — 오답률 · 검수 자료 확보(콘텐츠 작업 · SQL 아님).


## 독립 T3 감사 보충(2026-10-16)

위 SQL은 **승인 가능한 완성 마이그레이션이 아닌 초안**이다. 검증 로직 생략을 유지한 채 적용하면 안 된다. 이번 검증에서는 실행하지 않았다.

- (c) 같은 키 경합은 현행 API에서 RPC 후 불변 저장 행의 본문·ID까지 대조해 잘못된 성공 응답을 차단했다. DB 내부의 본문 원자 거절 자체를 구현한 것은 아니다. v2는 직접 서비스 호출까지 강화하는 별도 승인안으로 분리하며 grade-only/spec 확장과 묶어 승인할 필요가 없다.
- (a) 최신 점수 표를 그대로 두고 grade-only 이력만 추가하면 score fallback이 과거 점수를 현재 목표로 되살릴 수 있다. nullable 목표의 명시적 없음과 이력 없음은 달라야 한다. 최신 표/현재 포인터/읽기 계약을 함께 정해야 하며 null 점수를 기존 점수로 보충하지 않는다.
- (b) specVersion, 허용 kind/round/form, 조합의 교집합/합집합, 정렬·중복, 실제 회차 적격성, 예산 단위·범위, personalFocus 영구 TASK ID와 사용처가 미정이다. 저장만으로 추천 계산 지원이라고 하지 않는다.
- v2에는 user/key null, 점수/등급 범위와 적어도 하나 필수, 실제 달력/신규 날짜/과거 정확한 재전송 순서, JSON 객체 및 필드별 검증, 기존값 재전송 호환 검사가 빠짐없이 필요하다. 기존 목표 행을 고치지 않고 append-only 및 PLAN 참조를 보존한다.
- SECURITY DEFINER는 고정 search_path·schema-qualified 객체, public/anon/authenticated 실행권한 회수와 service_role의 명시적 grant를 실제 설치 결과로 검증해야 한다. p_user는 인증된 서버 세션에서만 결정하며 외부 본문을 신뢰하지 않는다.
- v2→v1 복귀는 다른 본문 키 충돌 보호를 약화할 수 있으므로 앱의 저장 후 대조를 보존한다. nullable 행 생성 후 NOT NULL 복구는 자동 rollback으로 실행하지 않는다. 데이터 보존·읽기 호환을 먼저 설계하고 별도 승인한다.
- 현재 카탈로그(이번 읽기 전용 스냅샷)는 교육청104회·적격 정답표104회·오답률 관측0이다. 이전 문서의110은 이번 snapshot의 분모로 재사용하지 않는다. 실제 자료/검수/지원 계약이 없는 상태는 BLOCKED_CONTENT이며 SQL 적용으로 해결되지 않는다.

**현재 T3 안전 보완에 DB 적용은 불필요하다.** 후속 최소 승인 항목은 (1) RPC v2 원자 본문 비교 강화, (2) grade-only의 일관된 현재 목표 읽기 계약, (3) 실제 계산에 사용하는 확장 spec으로 각각 분리한다. 완성 SQL·격리 PostgreSQL 검사·권한·호환·rollback 검토 전에는 적용 승인을 요청하지 않는다.
