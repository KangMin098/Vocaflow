// fn-plan.json → 권한 회수 SQL 초안 + 정확 복원 롤백 + 함수 목록 manifest 초안. DB 를 건드리지 않는다.
import fs from 'node:fs'
const [IN, SQL, RB, MAN] = process.argv.slice(2)
const plan = JSON.parse(fs.readFileSync(IN, 'utf8'))
const sig = (f) => `public.${f.name}(${f.args.split(',').map(a => a.trim()).filter(Boolean).map(a => a.replace(/^(\w+)\s+/, (m, n) => /^(in|out|inout|variadic)$/i.test(n) ? m : '').replace(/\s+default\s+.*$/i, '')).join(', ')})`
const A = plan.filter(f => f.action === 'revoke_public_anon_authenticated')
const B = plan.filter(f => f.action.startsWith('revoke_public_anon') && f.action !== 'revoke_public_anon_authenticated')
let s = `-- 함수 EXECUTE 권한 정리 — **초안 · 미적용**. 근거: docs/reports/function-execute-audit-2026-10-05.md
-- 생성: scratchpad fn-sql.mjs (fn-census → fn-plan). 손으로 고치지 말고 다시 생성한다.
-- 원칙: 함수마다 PUBLIC · anon (· authenticated) 를 회수하고 service_role 은 명시 GRANT 로 남긴다.
-- 소유자(postgres)가 부르는 경로 — cron · SECURITY DEFINER 내부 호출 · 트리거 발화 — 는 영향이 없다
-- (트리거 함수 EXECUTE 는 CREATE TRIGGER 때만 검사된다).
begin;

-- ① 서비스 전용 · 트리거 함수 ${A.length}개 — PUBLIC · anon · authenticated 회수
`
for (const f of A) s += `revoke execute on function ${sig(f)} from public, anon, authenticated;\ngrant execute on function ${sig(f)} to service_role;\n`
s += `\n-- ② 로그인 학습자 · 관리자 함수 ${B.length}개 — PUBLIC · anon 만 회수(본문이 auth.uid()/is_admin 을 요구하거나 정책 · 뷰가 쓴다)\n`
for (const f of B) s += `revoke execute on function ${sig(f)} from public, anon;\ngrant execute on function ${sig(f)} to authenticated, service_role;\n`
s += `\n-- ③ 앞으로 만들 함수: authenticated 기본 EXECUTE 도 끈다(anon · PUBLIC 은 2026-09-19 에 이미 끔).
--    이후 학습자 RPC 는 마이그레이션에 GRANT ... TO authenticated 를 명시해야 한다 — 회귀 가드가 빠뜨림을 잡는다.
alter default privileges in schema public revoke execute on functions from authenticated;

commit;
`
fs.writeFileSync(SQL, s)
// 롤백: 지금 proacl 을 그대로 되살린다
let r = `-- 위 초안의 정확 복원 — 적용 전 proacl(2026-10-05 실측)로 되돌린다.\nbegin;\nalter default privileges in schema public grant execute on functions to authenticated;\n`
for (const f of [...A, ...B]) {
  const g = []
  if (f.via_public) g.push('public')
  if (f.anon_direct) g.push('anon')
  if (f.au_direct) g.push('authenticated')
  if (g.length) r += `grant execute on function ${sig(f)} to ${g.join(', ')};\n`
}
r += 'commit;\n'
fs.writeFileSync(RB, r)
// manifest 초안
const man = { note: '함수 EXECUTE 허용 목록 — 여기 없는 public 함수는 실패(기본 거부). review 항목은 사람이 확정한 뒤 class 를 고친다.', generated: '2026-10-05',
  functions: Object.fromEntries(plan.map(f => [`${f.name}(${f.args})`, { class: f.cls, action: f.action, ...(f.action.startsWith('review') ? { review: true } : {}) }])) }
fs.writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n')
console.log({ A: A.length, B: B.length, review: plan.filter(f => f.action.startsWith('review')).length, keep: plan.filter(f => f.action === 'keep').length })
