// scripts/knowledge/build-g2-integrated.mjs
//
// G2 통합 SQL 조립(2026-10-08 · methodology 세션 = 공통 스키마 계약 · 설계 담당). 기출 쪽 검토 초안을 그대로 가져와
// methodology 계약 쪽 변경만 정확한 치환으로 얹는다 — 나머지 줄은 검토된 초안과 바이트 단위로 같게 둔다.
//   입력: tmp/g2-draft.sql = origin/feat/csat-learning-loop-g1:docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql
//         (sha256 779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01 일 때만)
//   출력: supabase/migrations/_pending_20261008160000_learning_sessions_integrated.sql + sha256
// 얹는 것:
//   M1 (B8) learning_sessions.explanation_viewed_at — 판단 뒤 해설 열람 시각(먼저 정한 값 유지) · learning_session_apply 에 p_explanation_viewed_at
//   M2 첫 시도 뷰에 after_explanation — 해설을 연 뒤의 판단은 독립 판단이 아니다(서버 쪽 판정 근거)
//   M3 knowledge_trials_analyzed_guard — 최소 표본을 「실제 학습자의 독립 첫 시도」로만 센다(합성 · 해설 먼저 · 해설 뒤 판단 · 반복 시도 제외)
//   M4 머리말 — 대체 관계(_pending_20261008140100 흡수) · 배포 순서 계약 · methodology 문항 과제 경로
//   node scripts/knowledge/build-g2-integrated.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const SRC = path.join(ROOT, 'tmp/g2-draft.sql')
const OUT = path.join(ROOT, 'supabase/migrations/_pending_20261008160000_learning_sessions_integrated.sql')
const DRAFT_SHA = '779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01'

const raw = fs.readFileSync(SRC, 'utf8')
const sha = crypto.createHash('sha256').update(raw).digest('hex')
if (sha !== DRAFT_SHA) throw new Error(`초안 sha 가 다르다: ${sha}`)
let s = raw.replace(/\r\n/g, '\n')
const rep = (name, a, b) => {
  const n = s.split(a).length - 1
  if (n !== 1) throw new Error(`${name}: 치환 대상이 ${n}곳`)
  // 함수형 치환 — 문자열 치환은 대체문의 $ 를 $ 하나로 바꿔 함수 본문 구분자를 깬다(2026-10-08 실측)
  s = s.replace(a, () => b)
}

// M4 머리말
rep('M4 header',
  '-- docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql\n',
  `-- supabase/migrations/_pending_20261008160000_learning_sessions_integrated.sql
--
-- **통합 SQL 세트 — 미적용 · 승인 대기 · 적용 담당 vocaflow-18 단독**(2026-10-08 사용자 결정). methodology 세션 = 계약 · 설계 · 검증.
-- 원본: 기출 쪽 검토 초안 sha256 ${DRAFT_SHA}(origin/feat/csat-learning-loop-g1 · docs/csat-learner/g2-draft/)를
--       scripts/knowledge/build-g2-integrated.mjs 가 정확한 치환으로 조립 — 바뀐 곳은 M1–M4 표시가 붙은 줄뿐.
-- methodology 쪽 추가(M1–M3):
--   M1 (B8) learning_sessions.explanation_viewed_at — 판단 뒤 해설 열람 시각(먼저 정한 값 유지) · learning_session_apply(p_explanation_viewed_at)
--   M2 learning_first_attempts.after_explanation — 해설을 연 뒤의 판단은 독립 판단이 아니다
--   M3 knowledge_trials_analyzed_guard — 최소 표본을 실제 학습자의 「독립 첫 시도」로만 센다(합성 · 해설 먼저 · 해설 뒤 · 반복 제외)
-- 대체: methodology _pending_20261008140100(client_attempt_id) 은 이 세트의 client_mutation_id 로 흡수 — 그 후보는 적용하지 않는다.
-- 배포 순서 계약: ① 이 SQL 적용(vocaflow-18) ② 사후 검사 ③ 코드 전환 — 문항 과제 POST /api/csat/item/[slug]/task · /csat/practice 기록을
--   learning_attempt_record(client_mutation_id · answered_at 필수)로. ①보다 먼저 ③을 배포하지 않는다(RPC 없음 → 500).
--   기존 직접 INSERT 경로는 ③ 전까지 그대로 동작한다(새 열은 모두 NULL 허용).
--
-- 아래는 원본 초안 머리말이다.
-- docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql
`)

// M1 — 열
rep('M1 column',
  '  review_at timestamptz,\n  deleted_at timestamptz,',
  '  review_at timestamptz,\n  explanation_viewed_at timestamptz,                               -- M1(B8) 판단 뒤 해설 열람 시각 — 먼저 정한 값 유지\n  deleted_at timestamptz,')
// M1 — RPC 인자 · 멱등 비교 · 단조 갱신
rep('M1 param',
  '  p_task_key text default null, p_application_id uuid default null, p_trial_id uuid default null\n) returns table (session_id uuid, outcome text)',
  '  p_task_key text default null, p_application_id uuid default null, p_trial_id uuid default null,\n  p_explanation_viewed_at timestamptz default null   -- M1(B8)\n) returns table (session_id uuid, outcome text)')
rep('M1 claim payload',
  "                       'synthetic', coalesce(p_synthetic, false)));\n  if v_claim <> 'new' then\n    select id into v_id",
  "                       'synthetic', coalesce(p_synthetic, false), 'explanation_viewed_at', p_explanation_viewed_at));  -- M1\n  if v_claim <> 'new' then\n    select id into v_id")
rep('M1 update',
  '    review_at = coalesce(s.review_at, p_review_at),\n',
  '    review_at = coalesce(s.review_at, p_review_at),\n    explanation_viewed_at = coalesce(s.explanation_viewed_at, p_explanation_viewed_at),  -- M1 먼저 정한 값\n')
// M1 — 권한 시그니처(인자 하나 늘었다)
const oldSig = 'public.learning_session_apply(uuid, uuid, uuid, text, text, text, text, integer, integer, text, timestamptz, timestamptz, boolean, boolean, text, uuid, uuid)'
const newSig = 'public.learning_session_apply(uuid, uuid, uuid, text, text, text, text, integer, integer, text, timestamptz, timestamptz, boolean, boolean, text, uuid, uuid, timestamptz)'
const nSig = s.split(oldSig).length - 1
if (nSig !== 3) throw new Error(`M1 sig: ${nSig}곳`)
s = s.split(oldSig).join(newSig)

// M2 — 첫 시도 뷰
rep('M2 view',
  "  (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,\n",
  "  (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,\n  -- M2 해설을 연 뒤의 판단은 독립 판단이 아니다(B8 — 세션의 열람 시각보다 늦은 판단)\n  (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,\n")

// M3 — 효과 게이트(권한 블록 앞 · 뷰를 쓴다)
rep('M3 guard',
  '-- ── 권한 ────',
  `-- ── M3 학습 원리 효과 게이트 — 최소 표본 = 실제 학습자의 독립 첫 시도 ────────────────────────
-- 20261008120000 의 knowledge_trials_analyzed_guard 는 trial 의 pre · post 기록 수를 학습자 단위로 셌다(반복 · 해설 뒤 판단 포함).
-- 이제 그 trial 에 묶인 시도 중 첫 시도 뷰에 오른 것 · 합성 아님 · 해설 먼저 아님 · 해설 뒤 아님만 센다.
create or replace function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and not f.after_viewed_first and not coalesce(f.after_explanation, false)) < need
       or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and not f.after_viewed_first and not coalesce(f.after_explanation, false)) < need then
      raise exception '실제 학습자의 독립 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 분석 완료로 바꿀 수 없다', need;
    end if;
  end if;
  return new;
end $$;

-- ── 권한 ────`)

// M4 되돌리기 — 이 세트가 바꾼 함수 본문 복원 안내
rep('M4 rollback',
  '-- begin;\n--   alter table public.funnel_events drop constraint funnel_events_event_check;',
  `-- M3 되돌리기: knowledge_trials_analyzed_guard 를 20261008120000 의 본문으로 다시 만든다(뷰를 지우기 전에).
-- begin;
--   alter table public.funnel_events drop constraint funnel_events_event_check;`)

// ── M5 통합 리뷰(Codex · 2026-10-08) P1 4건 ─────────────────────────────────────────────
// M5a 공개 시각 · 도움 수준 · 해설 열람 시각 = **가장 이른 시각**이 이긴다(도착순 아님) — 늦게 동기화된 더 이른 「해설 먼저」 · 열람이 버려지지 않게
rep('M5a help/revealed',
  '    help_level = coalesce(s.help_level, case when v_rank_new >= 1 then p_help_level end),\n    revealed_at = coalesce(s.revealed_at, case when v_rank_new >= 1 then p_at end),\n',
  '    -- M5a 가장 이른 공개가 이긴다(도착순 아님 — 오프라인 동기화 순서와 무관)\n    help_level = case when v_rank_new >= 1 and (case p_help_level when \'viewed_first\' then 2 when \'hint\' then 1 when \'independent\' then 0 else -1 end) > (case s.help_level when \'viewed_first\' then 2 when \'hint\' then 1 when \'independent\' then 0 else -1 end) then p_help_level else s.help_level end,  -- M5a′ 도움 수준 = 더 많이 도움받은 쪽(viewed_first > hint > independent) — 여러 기기가 한 세션을 공유해도 해설 먼저가 독립으로 둔갑하지 않는다(G2 심사 P1)\n    revealed_at = case when v_rank_new >= 1 and (s.revealed_at is null or p_at < s.revealed_at) then p_at else s.revealed_at end,\n')
rep('M5a explanation',
  '    explanation_viewed_at = coalesce(s.explanation_viewed_at, p_explanation_viewed_at),  -- M1 먼저 정한 값\n',
  '    explanation_viewed_at = least(s.explanation_viewed_at, p_explanation_viewed_at),  -- M1 · M5a 가장 이른 열람(least 는 NULL 을 건너뛴다)\n')
// M5b 첫 시도 뷰에 실효 도움 수준
rep('M5b view help',
  "  (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,\n",
  "  coalesce(s.help_level, a.help_level) as help_level,   -- M5b 실효 도움 수준(세션이 정본)\n  (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,\n")
// M5c 효과 게이트 — 독립(independent)만 · 세션 행을 잠근 뒤 센다(동기화와 직렬화)
const nInd = s.split('not f.synthetic and not f.after_viewed_first and').length - 1
if (nInd !== 2) throw new Error(`M5c: ${nInd}곳`)
s = s.split('not f.synthetic and not f.after_viewed_first and').join("not f.synthetic and f.help_level = 'independent' and")
rep('M5c lock',
  "  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then\n    if (select count(distinct f.user_id)",
  "  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then\n    -- M5c 표본 세션을 잠근다 — 세는 동안 공개 · 해설 시각이 바뀌지 않게(아래 고정 트리거와 직렬화)\n    perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;\n    if (select count(distinct f.user_id)")
rep('M5c message', '실제 학습자의 독립 첫 시도(사전 · 사후)가', '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가')
// M5d 분석 완료된 실제 검증의 표본 고정 — 뒤늦은 시도 · 공개/해설 시각 변경으로 표본 자격이 바뀌지 않게(삭제는 막지 않는다 — 계정 삭제)
rep('M5d freeze',
  '-- ── 권한 ────',
  `-- ── M5d 분석 완료된 실제 검증의 표본 고정 ────────────────────────────────────────────
create function public.learning_trial_sample_frozen_attempt() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.knowledge_trials t
             where t.id in (new.trial_id, case when tg_op = 'UPDATE' then old.trial_id end)
               and t.status = 'analyzed' and not t.synthetic for share) then
    raise exception '분석 완료된 검증의 표본에는 시도를 더하거나 고칠 수 없다 — 새 검증으로';
  end if;
  -- 첫 시도 뷰는 검증 구분 없이 (학습자 · 과제 · 문항 · 단계)마다 가장 이른 판단을 고른다 — 분석된 표본 시도보다 이르거나 같은 시도가
  -- 같은 묶음에 들어오면(검증 없는 시도라도) 표본의 첫 시도가 바뀐다. 그런 시도를 막는다(Codex P1 재리뷰 · 2026-10-08)
  if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
             where t.status = 'analyzed' and not t.synthetic and x.user_id = new.user_id
               and x.task_key is not distinct from new.task_key and coalesce(x.item_ref, '') = coalesce(new.item_ref, '') and x.phase = new.phase
               and new.answered_at <= x.answered_at and x.id is distinct from new.id
             for share of t) then
    raise exception '분석 완료된 검증 표본의 첫 시도보다 이른 시도는 넣을 수 없다 — 표본의 첫 시도가 바뀐다';
  end if;
  return new;
end $$;
create trigger learning_trial_sample_frozen_attempt before insert or update on public.learning_task_attempts
  for each row execute function public.learning_trial_sample_frozen_attempt();

create function public.learning_trial_sample_frozen_session() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.help_level is distinct from old.help_level or new.revealed_at is distinct from old.revealed_at
      or new.explanation_viewed_at is distinct from old.explanation_viewed_at)
     and exists (select 1 from public.learning_task_attempts a join public.knowledge_trials t on t.id = a.trial_id
                 where a.session_id = new.id and t.status = 'analyzed' and not t.synthetic for share of t) then
    raise exception '분석 완료된 검증 표본의 세션은 공개 · 도움 · 해설 시각을 바꿀 수 없다';
  end if;
  return new;
end $$;
create trigger learning_trial_sample_frozen_session before update on public.learning_sessions
  for each row execute function public.learning_trial_sample_frozen_session();

-- ── 권한 ────`)
// M5e 되돌리기 — 실행 가능한 완성본(주석을 벗기면 그대로 돈다)
const rbAt = s.indexOf('-- ── 되돌리기')
if (rbAt < 0) throw new Error('M5e: 되돌리기 블록 없음')
const funnelBlk = s.slice(s.indexOf("add constraint funnel_events_event_check"), s.indexOf('-- knowledge(Practice) 2'))
const old68 = [...funnelBlk.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])
if (old68.length !== 68) throw new Error(`M5e: 기존 이벤트 ${old68.length}`)
const vnext = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261008120000_knowledge_vnext.sql'), 'utf8').replace(/\r\n/g, '\n')
const gStart = vnext.indexOf('create function public.knowledge_trials_analyzed_guard()')
const gEnd = vnext.indexOf('end $$;', gStart) + 'end $$;'.length
const origGuard = vnext.slice(gStart, gEnd).replace('create function', 'create or replace function')
const rollback = [
  '-- ── 되돌리기(한 트랜잭션 · 실행 가능한 완성본 — 각 줄 앞의 「-- 」를 벗겨 실행) ────────────────────',
  '-- 전제: 적용 뒤 새 이벤트 · review phase · 세션 연결 시도 행이 생겼다면 먼저 처리해야 CHECK · FK 복원이 통과한다(G2_INTEGRATION_REVIEW §8).',
  '-- 검증: scripts/knowledge/g2-integrated-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.',
  'begin;',
  'alter table public.funnel_events drop constraint funnel_events_event_check;',
  `alter table public.funnel_events add constraint funnel_events_event_check check (event in (${old68.map((e) => `'${e}'`).join(', ')}));`,
  'drop trigger learning_trial_sample_frozen_session on public.learning_sessions;',
  'drop function public.learning_trial_sample_frozen_session();',
  'drop trigger learning_trial_sample_frozen_attempt on public.learning_task_attempts;',
  'drop function public.learning_trial_sample_frozen_attempt();',
  ...origGuard.split('\n'),
  'drop view public.learning_first_attempts;',
  'drop function public.learning_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean, uuid, uuid, timestamptz);',
  `drop function ${newSig};`,
  'drop function public.learning_mutation_claim(uuid, uuid, text, uuid, jsonb);',
  'alter table public.learning_task_attempts drop constraint learning_task_attempts_phase_check;',
  "alter table public.learning_task_attempts add constraint learning_task_attempts_phase_check check (phase in ('pre','practice','post','delayed','transfer'));",
  'drop index public.learning_task_attempts_session_idx;',
  'drop index public.learning_task_attempts_mutation_uniq;',
  'alter table public.learning_task_attempts drop column client_mutation_id, drop column help_level, drop column activity, drop column session_id;',
  'drop table public.learning_mutations;',
  'drop table public.learning_sessions;',
  'commit;',
].map((l, i) => (i < 3 ? l : `-- ${l}`)).join('\n')
s = s.slice(0, rbAt) + rollback + '\n'

// M6 (Codex 리뷰 P1 · 2026-10-08) 재전송 비교는 **요청 원문**으로 — 세션 상속값으로 비교하면 첫 기록 뒤 세션 도움 수준이
//    바뀌었을 때 같은 재전송이 conflict(생략 시) · 모순 예외(명시 시)가 된다. claim 을 세션 검증 · 상속보다 앞에 둔다.
//    claim 이 new 인데 뒤 검증이 예외면 함수 전체가 되돌려져 claim 행도 남지 않는다.
{
  const i0 = s.indexOf('  -- 세션에 붙는 시도는 세션의')
  const c0 = s.indexOf('  -- 저장하는 모든 의미 입력을 비교한다')
  const c1 = s.indexOf('  if v_claim <> \'new\' then', c0)
  const c2 = s.indexOf('  end if;\n', c1) + '  end if;\n'.length
  if (i0 < 0 || c0 < i0 || c1 < 0) throw new Error('M6 anchor')
  let claim = s.slice(c0, c2)
  for (const [a, b] of [['v_task', 'p_task_key'], ['v_activity', 'p_activity'], ['v_phase', 'p_phase'], ['v_help', 'p_help_level'], ['v_item', 'p_item_ref']]) {
    claim = claim.split("'" + a.slice(2) + "', " + a + ',').join("'" + a.slice(2) + "', " + b + ',')
  }
  claim = claim.replace("'task', v_task,", () => "'task', p_task_key,").replace("'help', v_help,", () => "'help', p_help_level,").replace("'item', v_item,", () => "'item', p_item_ref,")
  if (/'(task|activity|phase|help|item)', v_/.test(claim)) throw new Error('M6 payload')
  claim = '  -- M6 재전송은 요청 원문으로 비교(세션 상속 전 · Codex P1)\n' + claim
  s = s.slice(0, i0) + claim + s.slice(i0, c0) + s.slice(c2)
}
// M7 (Codex 리뷰 P1 · 2026-10-08) 합성 세션의 시도가 실제 표본으로 세지지 않게 — 기록 때 세션과 다른 합성 표시는 거부하고,
//    첫 시도 뷰의 synthetic 은 시도 · 세션 둘 중 하나라도 합성이면 합성(이미 들어간 행도 막는다)
{
  const a1 = "       or (p_help_level is not null and p_help_level <> v_s.help_level) then"
  if (!s.includes(a1)) throw new Error('M7 a1')
  s = s.replace(a1, () => "       or (p_help_level is not null and p_help_level <> v_s.help_level)\n       or (coalesce(p_synthetic, false) <> v_s.synthetic) then  -- M7 합성 표시는 세션과 같아야 한다")
  const a2 = "from public.learning_task_attempts a\nleft join public.learning_sessions s on s.id = a.session_id"
  const a3 = "  a.synthetic\n" + a2
  if (!s.includes(a3)) throw new Error('M7 a3')
  s = s.replace(a3, () => "  (a.synthetic or coalesce(s.synthetic, false)) as synthetic   -- M7 시도 · 세션 어느 쪽이든 합성이면 합성\n" + a2)
}
fs.writeFileSync(OUT, s)
const outSha = crypto.createHash('sha256').update(s).digest('hex')
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), sha256: outSha, draft: DRAFT_SHA }))
