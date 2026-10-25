// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/make-package.mjs
// 확정 원문 오류 3건(2023#32 · 2014B#36 · 2017#42 — public.csat_items.passage)의 정정 패키지를 만든다. DB 는 읽기만 한다.
// 산출: forward.sql · recovery.sql · check.sql · recipe-D-three.json · manifest.json(전후 md5 · 전후 꼬리 · PDF 해시)
//   (kice 수리 worktree 루트에서) DOTENV_CONFIG_PATH=<apps/web/.env.local> node --require dotenv/config --tls-max-v1.2 <이 파일>
// 실행은 하지 않는다 — 사용자 별도 승인 뒤 승인형 러너로만(dev-mode db_apply 2026-10-25).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { applySourceRepair, repairPdfFolder, sourceDigest } from '../../../../../../scripts/csat/lib-source-repair.mjs'

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
const { createClient } = createRequire(path.resolve('package.json'))('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const corpus = JSON.parse(fs.readFileSync('scripts/csat/data/corpus.json', 'utf8'))

// [id, PDF, 지울/바꿀 원문, 바꿀 값, 변경 전 md5(2026-10-25 SELECT), 공식 문제지 근거]
const FIX = [
  ['2023#32', '2023_영어영역_문제지.pdf', 'trans-missible', 'transmissible', '03a62be16a1bc6357446a0d3a4c25ad9', '32번 지문 줄 끝 하이픈 「trans-」 + 다음 줄 「missible」 — 줄바꿈 하이픈'],
  ['2014B#36', '2014_영어B-홀수형_문제.pdf', ' [3점] (A) (B) (A) (B)', '', '4910c6d0824e9e5b8e1a29265b29659d', '배점 [3점] · 선지 표 머리 (A) (B) 는 지문이 아니다. 빈칸 표지 (A)(B) 는 지문 안에 그대로'],
  ['2017#42', '2017_영어_짝.pdf', '\n\n(A) (B) (A) (B)', '', '5bb996e451c82758a15c4fe0e5b00ea2', '선지 표 머리 (A) (B) 는 지문이 아니다'],
]

const rows = []
for (const [id, file, from, to, beforeMd5, basis] of FIX) {
  const { data, error } = await db.from('csat_items').select('id, passage').eq('id', id).single()
  if (error) throw new Error(`${id}: ${error.message}`)
  const before = data.passage
  if (md5(before) !== beforeMd5) throw new Error(`${id}: 현재 DB 지문 md5 가 다르다(${md5(before)})`)
  const n = before.split(from).length - 1
  if (n !== 1) throw new Error(`${id}: 바꿀 원문이 정확히 한 번이 아니다(${n})`)
  if (to === '' && !before.endsWith(from)) throw new Error(`${id}: 지울 꼬리가 지문 끝이 아니다`)
  const after = before.replace(from, to)
  const bytes = fs.readFileSync(path.join(repairPdfFolder(id), file))
  const led = corpus.items.find((x) => x.id === id)
  if (!led) throw new Error(`${id}: 원장에 없다`)
  // 원장이 이미 정정 뒤 값과 같으면 수리 기록이 필요 없다(재생성 원장이 DB 정정 값을 그대로 낸다)
  const recipe = led.passage === after ? null : { item_id: id, pdf_file: file, pdf_sha256: sourceDigest(bytes), before: { passage: led.passage }, after: { passage: after }, note: `C-D 2026-10-25: ${basis}` }
  if (recipe && applySourceRepair({ ...led }, recipe, bytes).passage !== after) throw new Error(`${id}: 수리 기록 적용 결과가 정정 값과 다르다`)
  rows.push({ id, file, pdf_sha256: sourceDigest(bytes), from, to, before_md5: beforeMd5, after_md5: md5(after), before_len: before.length, after_len: after.length, ledger_equals_after: !recipe, basis, recipe })
}

// 빈 문자열은 ''. $q$$q$ 는 안의 $$ 가 바깥 DO $$ 블록을 닫는다(c-src2 1차 apply 롤백 원인)
const lit = (s) => { if (s === '') return "''"; if (s.includes('$q$') || s.includes('$$')) throw new Error('인용 충돌'); return `$q$${s}$q$` }
const block = (title, pairs) => `do $$
declare n int; total int := 0;
begin
${pairs.join('\n')}
  if total <> ${FIX.length} then raise exception '${title}: 기대 ${FIX.length}행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', total; end if;
end $$;
`
const forward = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/forward.sql (make-package.mjs 생성)
-- 확정 원문 오류 3건: public.csat_items.passage 만. 2023#32 줄바꿈 하이픈 · 2014B#36 · 2017#42 지문 끝 배점·선지 표 머리 꼬리.
-- 개발 DB jajenrevcbmrpaliomxv. compare-and-set — 3행이 아니면 전체 롤백. 사용자 별도 승인 전 실행 금지 · 승인형 러너로만.
${block('C-D 정정', rows.map((r) => `  update public.csat_items set passage = replace(passage, ${lit(r.from)}, ${lit(r.to)})
   where id = '${r.id}' and md5(passage) = '${r.before_md5}';
  get diagnostics n = row_count; total := total + n;`))}`
const recovery = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/recovery.sql (make-package.mjs 생성)
-- 되돌리기: 정정 뒤 md5 가 같을 때만 원래 문자열로 되돌린다. 행 삭제·DDL 없음. 3행이 아니면 전체 롤백.
${block('C-D 되돌리기', rows.map((r) => r.to
  ? `  update public.csat_items set passage = replace(passage, ${lit(r.to)}, ${lit(r.from)})
   where id = '${r.id}' and md5(passage) = '${r.after_md5}';
  get diagnostics n = row_count; total := total + n;`
  : `  update public.csat_items set passage = passage || ${lit(r.from)}
   where id = '${r.id}' and md5(passage) = '${r.after_md5}';
  get diagnostics n = row_count; total := total + n;`))}`
const check = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/check.sql (make-package.mjs 생성) — 읽기 전용. 전: before 3 · 후: after 3
select id, md5(passage) as passage_md5, md5(choices::text) as choices_md5, right(passage, 40) as tail,
       case md5(passage)
${rows.map((r) => `         when '${r.before_md5}' then 'before' when '${r.after_md5}' then 'after'`).join('\n')}
         else 'UNEXPECTED' end as state
  from public.csat_items where id in (${rows.map((r) => `'${r.id}'`).join(', ')}) order by id;
`
fs.writeFileSync(path.join(here, 'forward.sql'), forward)
fs.writeFileSync(path.join(here, 'recovery.sql'), recovery)
fs.writeFileSync(path.join(here, 'check.sql'), check)
fs.writeFileSync(path.join(here, 'recipe-D-three.json'), JSON.stringify({ repairs: rows.filter((r) => r.recipe).map((r) => r.recipe) }, null, 1) + '\n')
fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify(rows.map(({ recipe, ...r }) => r), null, 1) + '\n')
console.log(JSON.stringify(rows.map((r) => ({ id: r.id, before: r.before_md5, after: r.after_md5, ledger_equals_after: r.ledger_equals_after }))))
