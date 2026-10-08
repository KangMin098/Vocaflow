-- scripts/knowledge/vnext-pilot-seed.sql
-- 학습 원리 vNext 첫 수직 경로 「주장과 근거 관계 이해」 시범 시드 (docs/methodology/VNEXT.md §6).
-- 전제: 마이그레이션 20261008120000_knowledge_vnext 적용 뒤. 한 트랜잭션 · 재실행 안전(있으면 건너뜀) · 지우는 것 없음.
-- 쓰는 표와 범위:
--   knowledge_items     — 새 2행(역량 cap-claim-evidence · 방법론 method-claim-first-marking, 둘 다 in_review) · 기존 원리 13행의 facet 만(비어 있을 때만)
--   knowledge_links     — 새 implements 5 · complements 1
--   knowledge_evidence  — 새 외부 연구 근거 6행(전부 B: 서지 Crossref/발행처 확인, 본문 대조 미완) · 기존 강사 근거의 research_level 을 not_assessed 일 때만 practitioner_claim/observation 으로
--   knowledge_inquiries · _positions — 질문 1 · 입장 6
--   knowledge_gaps      — 공백 1(반례 미탐색)
--   knowledge_designs · _design_items — 설계 1(ready) · 연결 8
-- 채택은 하지 않는다(사람 몫). 배포도 하지 않는다.
-- 서지 확인(2026-10-08): Crossref API 로 DOI 4건 제목·저자·권호·쪽 대조 · Jiang(2012) 은 발행처(NFLRC) 초록 확인.
begin;

-- ── 1. 원리 면 — 비어 있는 것만 ─────────────────────────────────────
update public.knowledge_items set facet = 'language', updated_by = 'seed:vnext-pilot'
 where layer = 'principle' and facet is null
   and slug in ('cohesion-cues','sequential-processing','task-directed-attention','phonological-decoding');
update public.knowledge_items set facet = 'learning', updated_by = 'seed:vnext-pilot'
 where layer = 'principle' and facet is null
   and slug in ('active-recall','spaced-repetition','desirable-difficulty','dual-coding','context-dependent',
                'cognitive-load','emotional-encoding','feedback-comparison','output-automatization');

-- ── 2. 기존 강사 근거의 연구 수준 — 미평가일 때만 ─────────────────────
update public.knowledge_evidence e set research_level = case e.attribution when 'observed' then 'observation' else 'practitioner_claim' end
  from public.knowledge_items i
 where i.id = e.item_id and i.layer = 'practice' and i.slug like 'yt-%' and e.research_level = 'not_assessed';

-- ── 3. 새 항목 ───────────────────────────────────────────────────────
insert into public.knowledge_items (layer, slug, title, statement, skill_ids, status, created_by, updated_by)
values
  ('essence', 'cap-claim-evidence', '주장과 근거의 관계를 복원한다',
   '영어 글에서 글쓴이의 주장 문장을 찾고, 그 주장을 받치는 근거·예시 문장과 주장을 구분해 둘의 관계를 다시 세운다. 대의 파악(주장·요지·주제·제목) 문항과 근거 판단의 공통 역량. (역량 정의 초안 — 근거: 텍스트 구조 지도 연구, 기출 정답 근거 문장 관찰)',
   array['skill:reading'], 'in_review', 'seed:vnext-pilot', 'seed:vnext-pilot'),
  ('method', 'method-claim-first-marking', '주장 문장 먼저, 근거 번호, 그다음 선지',
   '선지를 보기 전에 글쓴이의 주장 문장을 먼저 표시하고, 그 주장을 받치는 근거 문장 번호를 적은 뒤 선지를 고르고, 정답 근거 문장과 대조해 차이를 한 줄로 설명한다. (설계 초안 — 텍스트 구조 지도·자기 설명 연구와 강사 공부법 묶음에서 도출)',
   array['skill:reading'], 'in_review', 'seed:vnext-pilot', 'seed:vnext-pilot')
on conflict (slug) do nothing;

-- ── 4. 연결 ──────────────────────────────────────────────────────────
insert into public.knowledge_links (from_id, to_id, kind, reason, created_by)
select f.id, t.id, x.kind, x.reason, 'seed:vnext-pilot'
  from (values
    ('cohesion-cues', 'cap-claim-evidence', 'implements', '주장·근거 관계는 연결 단서로 드러난다(언어 처리 기제)'),
    ('task-directed-attention', 'cap-claim-evidence', 'implements', '발문이 요구하는 대상(주장)을 먼저 잡는다(언어 처리 기제)'),
    ('feedback-comparison', 'cap-claim-evidence', 'implements', '고른 문장을 정답 근거와 대조해 판단 방식을 고친다(학습 기제)'),
    ('method-claim-first-marking', 'cohesion-cues', 'implements', '주장·근거 문장 표시는 응집 단서 추적의 적용'),
    ('method-claim-first-marking', 'feedback-comparison', 'implements', '정답 근거와의 대조·한 줄 설명은 피드백 대조의 적용'),
    ('method-claim-first-marking', 'method-gist-synthesis', 'complements', '요지 종합(소재+필자 생각)과 같은 대의 문항을 다른 절차로 다룬다')
  ) as x(f, t, kind, reason)
  join public.knowledge_items f on f.slug = x.f
  join public.knowledge_items t on t.slug = x.t
on conflict (from_id, to_id, kind) do nothing;

-- ── 5. 연구 근거(외부 · B) ──────────────────────────────────────────
insert into public.knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, locator, note, research_level, fit, fit_note, created_by)
select i.id, 'B', 'stated', 'external', x.url, x.title, x.locator, x.note, x.level, x.fit, x.fit_note, 'seed:vnext-pilot'
  from (values
    ('method-claim-first-marking', 'https://doi.org/10.1037/edu0000082',
     'Hebert, Bohaty, Nelson & Brown (2016). The effects of text structure instruction on expository reading comprehension: A meta-analysis. J. Educ. Psychol. 108(5), 609–629',
     '초록', '설명문 구조(주장·근거 포함) 지도가 독해를 높인다는 메타분석. 본문 효과 크기·조절 변인 대조 미완.',
     'meta_analysis', 'adapted', '모국어(영어) 초중등 대상 중심 — 한국 고등학생 EFL 로 옮겨 쓴다'),
    ('cap-claim-evidence', 'https://doi.org/10.1037/edu0000082',
     'Hebert, Bohaty, Nelson & Brown (2016). The effects of text structure instruction on expository reading comprehension: A meta-analysis. J. Educ. Psychol. 108(5), 609–629',
     '초록', '글 구조 파악을 독해의 독립된 역량으로 다룬다는 근거.', 'meta_analysis', 'adapted', '모국어 대상'),
    ('method-claim-first-marking', 'https://doi.org/10.1002/rrq.179',
     'Pyle et al. (2017). Effects of expository text structure interventions on comprehension: A meta-analysis. Reading Research Quarterly 52(4), 469–501',
     '초록', '설명문 구조 개입의 독해 효과 메타분석. 본문 대조 미완.', 'meta_analysis', 'adapted', '모국어 K-12 중심'),
    ('method-claim-first-marking', 'https://nflrc.hawaii.edu/rfl/item/254',
     'Jiang, X. (2012). Effects of discourse structure graphic organizers on EFL reading comprehension. Reading in a Foreign Language 24(1)',
     '초록', '중국 대학 EFL 340명·16주. 담화 구조 과제는 7주 뒤까지 유지, 일반 독해(TOEFL) 향상은 지연 측정에서 사라짐.', 'quasi_experimental', 'adapted', 'EFL 이지만 대학생·중국 — 대상 연령 다름'),
    ('feedback-comparison', 'https://doi.org/10.1007/s10648-018-9434-x',
     'Bisra, Liu, Nesbit, Salimi & Winne (2018). Inducing self-explanation: A meta-analysis. Educ. Psychol. Rev. 30(3), 703–725',
     '초록', '자기 설명 유도의 학습 효과 메타분석. 본문 대조 미완.', 'meta_analysis', 'adapted', '교과 일반 — 영어 독해 특정 아님'),
    ('active-recall', 'https://doi.org/10.3102/0034654316689306',
     'Adesope, Trevisan & Sundararajan (2017). Rethinking the use of tests: A meta-analysis of practice testing. Rev. Educ. Res. 87(3), 659–701',
     '초록', '인출(연습 시험)의 학습 효과 메타분석. 본문 대조 미완.', 'meta_analysis', 'adapted', '교과 일반')
  ) as x(slug, url, title, locator, note, level, fit, fit_note)
  join public.knowledge_items i on i.slug = x.slug
 where not exists (select 1 from public.knowledge_evidence e where e.item_id = i.id and e.external_url = x.url);

-- ── 6. 탐구 질문 · 입장 · 공백 ──────────────────────────────────────
insert into public.knowledge_inquiries (slug, question, capability_item_id, status, next_action, created_by, updated_by)
select 'claim-first-reading',
       '글쓴이의 주장 문장을 먼저 찾게 하면 대의 파악(주장·요지·주제·제목) 정답률과 근거 판단이 나아지는가?',
       i.id, 'collecting', '반례·무효과 연구 탐색 · EFL 고등학생 연구 찾기 · 시범 설계 실학습 기록', 'seed:vnext-pilot', 'seed:vnext-pilot'
  from public.knowledge_items i where i.slug = 'cap-claim-evidence'
on conflict (slug) do nothing;

insert into public.knowledge_inquiry_positions (inquiry_id, item_id, evidence_id, stance, note, created_by)
select q.id, x.item_id, x.evidence_id, x.stance, x.note, 'seed:vnext-pilot'
  from public.knowledge_inquiries q
  cross join lateral (
    select null::uuid as item_id, e.id as evidence_id, 'supports'::text as stance, '설명문 구조 지도 메타분석 — 구조 파악 훈련이 독해를 높인다(모국어 대상)'::text as note
      from public.knowledge_evidence e join public.knowledge_items i on i.id = e.item_id
     where i.slug = 'method-claim-first-marking' and e.external_url = 'https://doi.org/10.1037/edu0000082'
    union all
    select null, e.id, 'supports', '설명문 구조 개입 메타분석 — 같은 방향(모국어 K-12)'
      from public.knowledge_evidence e join public.knowledge_items i on i.id = e.item_id
     where i.slug = 'method-claim-first-marking' and e.external_url = 'https://doi.org/10.1002/rrq.179'
    union all
    select null, e.id, 'qualifies', 'EFL 대학생: 구조 과제 효과는 7주 유지, 일반 독해 효과는 지연 측정에서 사라짐 — 「기출 정답률」 같은 먼 지표는 오래 안 갈 수 있다'
      from public.knowledge_evidence e join public.knowledge_items i on i.id = e.item_id
     where i.slug = 'method-claim-first-marking' and e.external_url = 'https://nflrc.hawaii.edu/rfl/item/254'
    union all
    select null, e.id, 'supports', '정답과 대조해 스스로 설명하게 하는 단계의 근거(교과 일반)'
      from public.knowledge_evidence e join public.knowledge_items i on i.id = e.item_id
     where i.slug = 'feedback-comparison' and e.external_url = 'https://doi.org/10.1007/s10648-018-9434-x'
    union all
    select i.id, null, 'supports', '강사 공부법(가설): 주제·제목은 소재와 필자 생각을 합쳐 판단 — 효과 검증 아님'
      from public.knowledge_items i where i.slug = 'yt-e4ce5f5963d2'
    union all
    select i.id, null, 'supports', '강사 공부법(가설): 판단 근거를 적고 유사 기출에 적용 — 효과 검증 아님'
      from public.knowledge_items i where i.slug = 'yt-7463360832d2'
  ) x
 where q.slug = 'claim-first-reading'
   and not exists (select 1 from public.knowledge_inquiry_positions p where p.inquiry_id = q.id and p.note = x.note);

insert into public.knowledge_gaps (skill_ids, layer, question, cause, next_action)
select array['skill:reading'], 'method', '주장 문장 먼저 찾기가 효과가 없거나 해가 된 연구·사례가 있는가(반례)',
       'not_researched', '「text structure instruction null effect」·「EFL main idea strategy」 검색 → 탐구 질문 claim-first-reading 에 반례·조건부로 더한다'
 where not exists (select 1 from public.knowledge_gaps g where g.question = '주장 문장 먼저 찾기가 효과가 없거나 해가 된 연구·사례가 있는가(반례)');

-- ── 7. 학습 설계 + 연결 ──────────────────────────────────────────────
insert into public.knowledge_designs (slug, title, learner_summary, procedure, module_key, train_type_ids, transfer_type_ids, map_codes, assessment, inquiry_id, status, created_by, updated_by)
select 'claim-evidence-v1', '주장 문장 먼저 찾기',
       '대의 문항(주장·요지)은 선지보다 글쓴이의 주장 문장을 먼저 잡을 때 오답 선지에 덜 끌려요. 문제지를 보며 주장 문장과 그 근거 문장을 번호로 고르고, 정답 근거와 맞춰 봐요.',
       '[{"title":"선지를 가리고 글쓴이의 주장 문장을 고른다","detail":"문제지에서 지문을 읽고, 막대에서 그 문장 번호를 누른다"},{"title":"주장을 받치는 근거 문장을 0~3개 고른다","detail":"예시·근거·대조 문장 중 주장을 직접 받치는 것"},{"title":"선지를 고르고 확신을 적는다","detail":"주장 문장과 가장 가까운 선지"},{"title":"정답 근거 문장과 맞춰 본다","detail":"어긋났다면 왜 그 문장이 글 전체를 묶는지 한 줄로 적는다"}]'::jsonb,
       'csat_claim_evidence', array['R-CLAIM','R-GIST'], array['R-TOPIC','R-TITLE'], array['A5','B6'],
       '{"thresholds":{"preCount":3,"minPostPerLearner":5,"minLearners":20,"delayDays":7},"metrics":["claim_hit","option_correct"],"pre":"첫 3회","post":"4회째 이후","delayed":"7일 쉰 뒤 첫 수행","transfer":"R-TOPIC·R-TITLE","note":"대조군 없음 — 사전·사후 비교"}'::jsonb,
       q.id, 'ready', 'seed:vnext-pilot', 'seed:vnext-pilot'
  from public.knowledge_inquiries q where q.slug = 'claim-first-reading'
on conflict (slug) do nothing;

insert into public.knowledge_design_items (design_id, item_id, role)
select d.id, i.id, x.role
  from (values
    ('cap-claim-evidence', 'capability'),
    ('cohesion-cues', 'language_mechanism'),
    ('task-directed-attention', 'language_mechanism'),
    ('feedback-comparison', 'learning_mechanism'),
    ('method-claim-first-marking', 'method'),
    ('method-gist-synthesis', 'method'),
    ('yt-e4ce5f5963d2', 'practice'),
    ('yt-7463360832d2', 'practice')
  ) as x(slug, role)
  join public.knowledge_items i on i.slug = x.slug
  join public.knowledge_designs d on d.slug = 'claim-evidence-v1'
 where d.status <> 'deployed'
on conflict (design_id, item_id) do nothing;

commit;
