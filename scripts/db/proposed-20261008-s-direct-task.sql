-- scripts/db/proposed-20261008-s-direct-task.sql
--
-- **제안 · 미실행.** 문장 이해(S) 직접 확인 과제 1행(과제 182 → 183). 사용자가 이 파일(sha256)을 보고 승인한 뒤에만 실행한다.
-- 왜: S 는 평가원 기출 응답만으로 관측되지 않는다(observability-audit-20261008 — 29/29 회 관측 미달). 지금 학습 지도는 같은 활동을
--     코드 정의(lib/csat/map/distinguish.ts S_DIRECT)로 보여 주지만 완료 기록이 남지 않는다 — 이 행을 넣으면 기록 · 단계 연결이 된다.
-- 기존 과제와 중복: A2-1(막히는 문장 수집 — 고르기만, 판정 없음) · I2-1~3(문장 고르기 · 뼈대 · 풀어 쓰기 — 연습 과제, 하위 원인 판정 없음) ·
--     A8-1(어법 포인트 정답률 — 어법이지 문장 이해가 아니다). 하위 원인 세 가지를 가르는 FIND 는 없다.
-- 입력: 오답 문항의 긴 · 복잡한 문장 3개(낱말 뜻은 먼저 확인). 판정: 학생의 주어–동사 밑줄 · 꾸밈 괄호 · 한 줄 해석을 해설과 비교.
-- 결과 → 하위 원인: ① 뜻을 알아도 한 줄 해석 어긋남 → 문장 구조 ② 밑줄 · 괄호 맞고 한 줄 어긋남 → 의미 조합 ③ 어긋난 자리(주어–동사 · 절 경계 · 꾸밈 범위).
-- 안전: 이미 있으면 건드리지 않는다(ON CONFLICT DO NOTHING) · 끝에서 183 · 라인 54 확인. 코드 쪽 대응표(prescription.ts TASK_STAGE 'A2-4': 'FIND')는
--     이 SQL 적용과 같은 커밋에서 더한다(DB = 대응표 회귀가 지킨다).
-- 되돌리기: delete from public.csat_map_task where id = 'A2-4' and not exists (select 1 from public.csat_map_task_done where task_id = 'A2-4');
begin;
insert into public.csat_map_task (id, line_code, ord, title, how, cadence, done_when, material, method_line) values
  ('A2-4', 'A2', 4, '문장 의미 직접 확인', '틀린 문항에서 길거나 복잡한 문장 3개를 고르고 낱말 뜻을 먼저 확인한 뒤, 주어와 동사에 밑줄 · 꾸며 주는 말에 괄호를 하고 「누가 무엇을 했는가」를 한 줄로 써서 해설과 비교합니다.', '오답 문장 3개, 10분', '문장마다 한 줄 일치 · 밑줄 · 괄호 일치 · 어긋난 자리(주어–동사 · 절 경계 · 꾸밈 범위) 기록', 'past', null)
on conflict (id) do nothing;
do $$ declare n int; nl int;
begin
  select count(*), count(distinct line_code) into n, nl from public.csat_map_task;
  if n <> 183 or nl <> 54 then raise exception 'S 직접 확인 과제 뒤 과제 % · 라인 % — 기대 183 · 54', n, nl; end if;
end $$;
commit;
