// scripts/textbook/explain-drain-export.mjs
//
// **해설 드레인 ①/② — Claude Code 가 쓸 몫을 청크로 뽑는다.**
//
// ── 왜 배치인가 ──────────────────────────────────────────────────────
// 결정론 해설(`explain.ts`)은 **6.9%** 에서 멈춘다. 지문 표면의 단서만으로는 결속을 다
// 못 읽고, 두 번의 개선 실험(희소도 문턱 · 근거 다중화)이 실측으로 실패했다.
// 나머지 93%는 **글을 읽어야** 쓸 수 있다 — 그게 Claude Code 가 할 일이다.
//
// ⚠️ **이미 결정론으로 쓴 해설은 뽑지 않는다.** 그것은 근거가 지문에서 확정된 것이라
//   덮어쓸 이유가 없고, 덮어쓰면 "왜 이 답인지" 의 근거 종류가 섞인다.
//
// ── 저장 자리 ────────────────────────────────────────────────────────
// `csat_dcp_items.answer_key` 는 jsonb 다. 해설은 `answer_key.explanation_ko` 에 넣는다 —
// **마이그레이션이 필요 없다.** 채점 RPC(`grade_dcp_item`)는 `position`·`source_order` 만
// 읽으므로 키가 하나 늘어도 영향이 없다.
//
// 재실행 안전: 읽기만 한다. 청크 파일은 덮어쓴다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/explain-drain-export.mjs --band 5 --size 10
//   → scripts/textbook/explain-drain/chunk-00.json …

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const SIZE = Number(arg('size') ?? 10)
const DIR = path.resolve('scripts/textbook/explain-drain')

const { createClient } = await import('@supabase/supabase-js')
const { toCsatOrder, toCsatInsert, explainOrder, explainInsert } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, type, payload, answer_key, v_level')
    .eq('kind', 'article')
    .eq('v_level', BAND)
    .in('type', ['order', 'insert'])
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error('문항 조회 실패: ' + error.message)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 500) break
}

const CIRCLED = ['①', '②', '③', '④', '⑤']
const tasks = []
let already = 0
let unprintable = 0

for (const r of rows) {
  // 이미 배치가 쓴 것은 건너뛴다 — 재실행 안전.
  if (r.answer_key?.explanation_ko) {
    already++
    continue
  }
  const isOrder = r.type === 'order'
  const item = isOrder
    ? toCsatOrder(r.payload?.presented ?? [], r.answer_key?.source_order ?? [])
    : toCsatInsert(r.payload?.remaining ?? [], r.payload?.insert_sentence ?? '', r.answer_key?.position)
  if (!item) {
    unprintable++
    continue
  }
  // 결정론으로 이미 쓴 것은 뽑지 않는다.
  const det = isOrder ? explainOrder(item) : explainInsert(item)
  if (det.body) {
    already++
    continue
  }

  tasks.push(
    isOrder
      ? {
          id: r.id,
          type: 'order',
          answer: `${CIRCLED[item.answer - 1]} ${item.choices[item.answer - 1].map((l) => `(${l})`).join('-')}`,
          intro: item.intro,
          blocks: item.blocks.map((b) => ({ label: b.label, text: b.sentences.join(' ') })),
          explanation_ko: '',
        }
      : {
          id: r.id,
          type: 'insert',
          answer: `${CIRCLED[item.answer - 1]} (${item.slots[item.answer - 1]}번째 문장 뒤)`,
          given: item.sentence,
          body: item.body.map((s, i) => {
            const slot = item.slots.indexOf(i + 1)
            return slot >= 0 ? `${s} ${CIRCLED[slot]}` : s
          }),
          explanation_ko: '',
        },
  )
}

fs.mkdirSync(DIR, { recursive: true })
// 이전 청크를 남겨 두면 다음 드레인이 낡은 것을 다시 읽는다.
for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}

console.log(`V${BAND} — 문항 ${rows.length}`)
console.log(`  이미 해설 있음(결정론 또는 배치)  ${already}`)
console.log(`  수능 형식 변환 실패              ${unprintable}`)
console.log(`  **배치가 쓸 몫                  ${tasks.length}**  → 청크 ${chunks.length}개 (${SIZE}개씩)`)
console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
console.log(`  각 항목의 explanation_ko 를 채운 뒤 같은 이름 + .out.json 으로 저장하면`)
console.log(`  explain-drain-import.mjs 가 DB 에 넣는다.`)
