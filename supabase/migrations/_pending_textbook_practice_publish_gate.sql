-- supabase/migrations/_pending_textbook_practice_publish_gate.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F7a 승인안 A 2판. 생성: scripts/textbook/gen-practice-gate-sql.mts(손으로 고치지 않는다)
--
-- 왜: 연습 RPC textbook_practice_items(p_v_level) 는 V레벨 문항 풀을 돌려주고 권 발행 · 권 유형과 무관하다.
--     ① 미발행 권의 V레벨도 받는다(지금은 19권 전부 발행이라 노출 0)
--     ② 어휘 · 구문 12권과 독해 1단은 자기 유형이 연습 재생 유형에 하나도 없는데, 연습 화면은 **독해 문항**을 내고 있었다(실측 2026-10-14)
-- 이전 제안 textbook_practice_items_for(series, step, v_level) 는 호출자 V레벨을 받아 위조 가능 → 폐기.
-- 수정: 권 → V레벨 · 유형 대응을 DB 에 두고(카탈로그 생성), 새 함수는 (series, step) 만 받는다.
--       로그인 · 대응 존재 · 발행 · V레벨 · 권 유형 ∩ 재생 유형 — 하나라도 없으면 0행(fail-closed).
-- 영향(실측 풀, 출처 적격성 전): 독해 2단 830→300 · 3단 867→536 · 4단 1,618→914 · 5단 11,089→11,025 · 6·7단 동일 ·
--       어휘 · 구문 12권 → 0(화면은 「아직 화면 연습이 없어요」). 문항 · 응답 · 서가 기록 불변(읽기 함수만).
-- 순서: ① 이 파일(표 · 새 함수) ② 앱 배포(새 함수 우선 · 함수 없을 때만 옛 함수) ③ 사용처 0 확인 뒤 맨 아래 회수문 실행.
-- 되돌리기: drop function public.textbook_practice_items_for(text, smallint, integer);
--           drop table public.textbook_rung_type; drop table public.textbook_rung_level;
--           (③ 실행했다면) grant execute on function public.textbook_practice_items(smallint, integer) to authenticated;
-- 검증: tests/sql/practice-gate-fixture.sql(트랜잭션 · rollback) · DB 대응 = 카탈로그(통합 테스트).

create table if not exists public.textbook_rung_level (
  series text not null,
  step smallint not null,
  v_level smallint not null,
  primary key (series, step, v_level)
);
create table if not exists public.textbook_rung_type (
  series text not null,
  step smallint not null,
  type text not null,
  primary key (series, step, type)
);
alter table public.textbook_rung_level enable row level security;
alter table public.textbook_rung_type enable row level security;
-- 읽기 정책 없음 — 아래 SECURITY DEFINER 함수와 관리자(서비스 키)만 읽는다
revoke all on public.textbook_rung_level, public.textbook_rung_type from anon, authenticated;

insert into public.textbook_rung_level (series, step, v_level) values
('reading', 1, 1),
('reading', 2, 2),
('reading', 3, 3),
('reading', 4, 4),
('reading', 5, 5),
('reading', 6, 6),
('reading', 7, 7),
('vocab', 2, 2),
('vocab', 3, 3),
('vocab', 4, 4),
('vocab', 5, 5),
('vocab', 6, 6),
('vocab', 7, 7),
('syntax', 2, 2),
('syntax', 3, 3),
('syntax', 4, 4),
('syntax', 5, 5),
('syntax', 6, 6),
('syntax', 7, 7)
on conflict do nothing;

insert into public.textbook_rung_type (series, step, type) values
('reading', 1, 'rhyme'),
('reading', 1, 'word_meaning'),
('reading', 1, 'spell_blank'),
('reading', 2, 'rhyme'),
('reading', 2, 'word_meaning'),
('reading', 2, 'spell_blank'),
('reading', 2, 'word_order'),
('reading', 2, 'title'),
('reading', 2, 'blank'),
('reading', 2, 'topic'),
('reading', 2, 'irrelevant'),
('reading', 2, 'blank_word'),
('reading', 2, 'content_match'),
('reading', 2, 'unit_vocab'),
('reading', 2, 'long_reference'),
('reading', 3, 'word_meaning'),
('reading', 3, 'word_order'),
('reading', 3, 'vocab_choice'),
('reading', 3, 'unit_vocab'),
('reading', 3, 'blank_word'),
('reading', 3, 'title'),
('reading', 3, 'topic'),
('reading', 3, 'blank'),
('reading', 3, 'content_match'),
('reading', 3, 'grammar_fix'),
('reading', 3, 'insert'),
('reading', 3, 'irrelevant'),
('reading', 4, 'word_order'),
('reading', 4, 'vocab_choice'),
('reading', 4, 'grammar_choice'),
('reading', 4, 'unit_vocab'),
('reading', 4, 'blank_word'),
('reading', 4, 'unit_grammar'),
('reading', 4, 'grammar_fix'),
('reading', 4, 'title'),
('reading', 4, 'topic'),
('reading', 4, 'blank'),
('reading', 4, 'content_match'),
('reading', 4, 'insert'),
('reading', 4, 'irrelevant'),
('reading', 5, 'blank'),
('reading', 5, 'vocab_choice'),
('reading', 5, 'grammar_fix'),
('reading', 5, 'order'),
('reading', 5, 'title'),
('reading', 5, 'topic'),
('reading', 5, 'content_match'),
('reading', 5, 'irrelevant'),
('reading', 5, 'insert'),
('reading', 5, 'purpose'),
('reading', 5, 'mood'),
('reading', 5, 'summary'),
('reading', 5, 'main_point'),
('reading', 5, 'claim'),
('reading', 5, 'implication'),
('reading', 5, 'long_reference'),
('reading', 5, 'word_order'),
('reading', 5, 'grammar_choice'),
('reading', 5, 'blank_word'),
('reading', 6, 'blank'),
('reading', 6, 'vocab_choice'),
('reading', 6, 'grammar_fix'),
('reading', 6, 'order'),
('reading', 6, 'title'),
('reading', 6, 'topic'),
('reading', 6, 'content_match'),
('reading', 6, 'irrelevant'),
('reading', 6, 'insert'),
('reading', 6, 'purpose'),
('reading', 6, 'mood'),
('reading', 6, 'summary'),
('reading', 6, 'main_point'),
('reading', 6, 'claim'),
('reading', 6, 'implication'),
('reading', 6, 'long_reference'),
('reading', 6, 'word_order'),
('reading', 6, 'grammar_choice'),
('reading', 6, 'blank_word'),
('reading', 7, 'blank'),
('reading', 7, 'vocab_choice'),
('reading', 7, 'grammar_fix'),
('reading', 7, 'order'),
('reading', 7, 'title'),
('reading', 7, 'topic'),
('reading', 7, 'content_match'),
('reading', 7, 'irrelevant'),
('reading', 7, 'insert'),
('reading', 7, 'purpose'),
('reading', 7, 'mood'),
('reading', 7, 'summary'),
('reading', 7, 'main_point'),
('reading', 7, 'claim'),
('reading', 7, 'implication'),
('reading', 7, 'long_reference'),
('reading', 7, 'word_order'),
('reading', 7, 'grammar_choice'),
('reading', 7, 'blank_word'),
('vocab', 2, 'vocab_choice'),
('vocab', 2, 'unit_vocab'),
('vocab', 2, 'blank_word'),
('vocab', 3, 'vocab_choice'),
('vocab', 3, 'unit_vocab'),
('vocab', 3, 'blank_word'),
('vocab', 4, 'vocab_choice'),
('vocab', 4, 'unit_vocab'),
('vocab', 4, 'blank_word'),
('vocab', 5, 'vocab_choice'),
('vocab', 5, 'unit_vocab'),
('vocab', 5, 'blank_word'),
('vocab', 6, 'vocab_choice'),
('vocab', 6, 'unit_vocab'),
('vocab', 6, 'blank_word'),
('vocab', 7, 'vocab_choice'),
('vocab', 7, 'unit_vocab'),
('vocab', 7, 'blank_word'),
('syntax', 2, 'grammar_choice'),
('syntax', 2, 'grammar_fix'),
('syntax', 2, 'unit_grammar'),
('syntax', 2, 'word_order'),
('syntax', 3, 'grammar_choice'),
('syntax', 3, 'grammar_fix'),
('syntax', 3, 'unit_grammar'),
('syntax', 3, 'word_order'),
('syntax', 4, 'grammar_choice'),
('syntax', 4, 'grammar_fix'),
('syntax', 4, 'unit_grammar'),
('syntax', 4, 'word_order'),
('syntax', 5, 'grammar_choice'),
('syntax', 5, 'grammar_fix'),
('syntax', 5, 'unit_grammar'),
('syntax', 5, 'word_order'),
('syntax', 6, 'grammar_choice'),
('syntax', 6, 'grammar_fix'),
('syntax', 6, 'unit_grammar'),
('syntax', 6, 'word_order'),
('syntax', 7, 'grammar_choice'),
('syntax', 7, 'grammar_fix'),
('syntax', 7, 'unit_grammar'),
('syntax', 7, 'word_order')
on conflict do nothing;

create or replace function public.textbook_practice_items_for(p_series text, p_step smallint, p_limit integer default 10)
returns table(id uuid, type text, paragraph_idx integer, payload jsonb, ref_title text)
language sql stable security definer set search_path to 'public' as $$
  select i.id, i.type, i.paragraph_idx, i.payload, a.title
  from csat_dcp_items i
  join library_articles a on a.id = i.ref_id
  where auth.uid() is not null
    and i.kind = 'article'
    -- 재생 · 채점 가능한 유형 ∩ 그 권의 유형
    and i.type in ('order','insert','topic','blank','main_point','title','summary','purpose','implication','content_match','claim','mood','long_order','long_reference','long_match','long_title','long_vocab')
    and i.type in (select t.type from textbook_rung_type t where t.series = p_series and t.step = p_step)
    -- 발행 결속: 그 권이 발행됐을 때만, 그 권의 V레벨만(호출자 V레벨을 받지 않는다)
    and exists (select 1 from textbook_volume_renders r where r.series = p_series and r.band = p_step and r.status = 'published')
    and i.v_level in (select l.v_level from textbook_rung_level l where l.series = p_series and l.step = p_step)
    and a.status in ('ready','published')
    and a.display_only = false
    and public.csat_source_is_eligible(a.id)
    and not exists (select 1 from csat_item_attempts t where t.dcp_item_id = i.id and t.user_id = auth.uid())
  order by i.id
  limit greatest(1, least(p_limit, 50));
$$;
revoke all on function public.textbook_practice_items_for(text, smallint, integer) from public, anon;
grant execute on function public.textbook_practice_items_for(text, smallint, integer) to authenticated;

-- ── ③ 앱이 새 함수로 옮겨 배포된 뒤 별도로 실행(사용처 0 확인 후) ──────────────────
-- revoke execute on function public.textbook_practice_items(smallint, integer) from authenticated;
