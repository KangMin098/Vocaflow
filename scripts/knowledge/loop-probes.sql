-- scripts/knowledge/loop-probes.sql
-- 학습 원리 vNext 두 고리(결과 → 재평가 · 진단 → 원리 → 과제)의 **읽기 전용** 점검 쿼리. 쓰기 없음 — 어느 DB 에서 돌려도 안전.
-- 판정 기준은 docs/methodology/VNEXT_LOOP_ACCEPTANCE.md. 각 쿼리는 한 행을 돌려준다(probe 이름 · 값).

-- A1 학습 개입 식별: 시도에 적용(application) · 버전이 붙는가
select 'A1_attempts_with_application' probe, count(*) filter (where application_id is not null) || ' / ' || count(*) val from public.learning_task_attempts
union all
-- A2 효과 표본 적격: 실제(비합성) · 독립 · 해설 뒤 아님 · 첫 시도
select 'A2_eligible_first_attempts', count(*)::text from public.learning_first_attempts
 where not synthetic and coalesce(help_level, 'independent') = 'independent' and not coalesce(after_viewed_first, false) and not coalesce(after_explanation, false)
union all
-- A3 trial 단계: 계획 · 진행 · 분석 · 중단 수(합성 따로)
select 'A3_trials_by_status', coalesce(string_agg(status || case when synthetic then '(합성)' else '' end || ':' || n, ' · '), '없음')
  from (select status, synthetic, count(*) n from public.knowledge_trials group by 1, 2) x
union all
-- A4 trial 에 묶인 시도(표본이 실제로 모이는가)
select 'A4_attempts_with_trial', count(*)::text from public.learning_task_attempts where trial_id is not null
union all
-- A5 효과 판정이 열린 항목(실제 근거 없이 열리면 안 된다)
select 'A5_items_efficacy_set', coalesce(string_agg(slug || '=' || efficacy, ' · '), '없음') from public.knowledge_items where efficacy <> 'not_assessed'
union all
-- A6 결과로 촉발된 재검토 — 「검토 중」으로 **내려간** 전이 중 사유가 trial·성과 신호인 것만
--    (채택 사유의 「효과 입증이 아니다」 같은 단서 문구를 세지 않게 — 2026-10-08 첫 측정에서 9건 오탐)
select 'A6_reviews_from_results', count(*)::text from public.knowledge_reviews
 where to_status = 'in_review' and coalesce(reason, '') ~* '(trial|성과 신호|분석 결과|효과 검토)'
union all
-- B1 진단 산출(학습자별 최신 스냅샷 수)
select 'B1_dx_snapshots', count(*)::text from public.csat_dx_snapshot
union all
-- B2 학습 지도에서 원리 과제로 가는 적용(learning_map_find)
select 'B2_map_find_applications', coalesce(string_agg(surface_ref || ':' || status, ' · '), '없음') from public.knowledge_applications where surface = 'learning_map_find'
union all
-- B3 학습자에게 열린 원리 과제(active 적용)
select 'B3_active_applications', coalesce(string_agg(surface || '/' || surface_ref, ' · '), '없음') from public.knowledge_applications where status = 'active'
union all
-- B4 노출 제한 3항목의 현재 상태(사람 검토 전 비노출 결정 · 2026-10-08)
select 'B4_restricted_items', coalesce(string_agg(slug || '=' || status, ' · ' order by slug), '없음') from public.knowledge_items
 where slug in ('method-claim-support-marking', 'claim-support-relation', 'task-claim-support-link');
