// scripts/dict/wordset-inflection-audit.mjs
//
// **공용 단어장 표제어 중 굴절형을 골라내되, 오탐을 함께 갈라 낸다.**
//
// ── 왜 등급을 나누는가 ───────────────────────────────────────────────
// 단순 형태소 규칙만 쓰면 `aces → ac` 처럼 **말이 안 되는 짝**이 나온다(실측).
// 그대로 일괄 치환하면 멀쩡한 표제어를 망가뜨린다. 그래서 확신도로 나누고,
// **확신 없는 것은 사람에게 넘긴다.**
//
// 더 조심할 것이 하나 더 있다 — **굴절형처럼 보이지만 뜻이 갈라진 낱말**이다:
//   building ≠ build 의 단순 진행형 (건물)
//   glasses  ≠ glass 의 복수 (안경)
//   arms     ≠ arm 의 복수 (무기)
//   customs  ≠ custom 의 복수 (세관)
// 이런 것을 합치면 학습자가 배워야 할 뜻이 사라진다. 그래서 **뜻을 대조**한다 —
// 단어장이 그 표제어에 붙여 둔 우리말 뜻과, 사전이 원형에 붙여 둔 뜻이 겹치는지 본다.
//
// ── 등급 ─────────────────────────────────────────────────────────────
//   A 확실   사전의 `inflected_forms` 가 이 표면형을 **직접 적어 두었다**. 기계가 정한 게 아니다.
//   B 유력   규칙 형태소로 원형이 잡히고 **뜻도 겹친다**.
//   C 의심   규칙으로는 잡히는데 뜻이 안 겹친다 — 뜻이 갈라진 낱말이거나 오탐. **사람이 본다.**
//
// 재실행 안전: 읽기만 한다. DB 를 건드리지 않는다.
//
// 실행: pnpm dlx tsx scripts/dict/wordset-inflection-audit.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const page = async (table, cols, tweak = (q) => q) => {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(db.from(table).select(cols)).range(from, from + 999)
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// ── 사전 ────────────────────────────────────────────────────────────
const dict = new Map() // word → { meaningKo }
const inflectOf = new Map() // 표면형 → 원형 (사전이 직접 적어 둔 것)
for (const r of await page('shared_dictionary', 'word, meaning_ko, inflected_forms')) {
  const w = String(r.word ?? '').toLowerCase()
  if (!w) continue
  dict.set(w, { meaningKo: String(r.meaning_ko ?? '') })
  for (const f of r.inflected_forms ?? []) {
    const s = String(f).toLowerCase()
    if (s && s !== w && !inflectOf.has(s)) inflectOf.set(s, w)
  }
}
console.log(`사전 ${dict.size.toLocaleString()} · 사전이 적어 둔 굴절형 ${inflectOf.size.toLocaleString()}\n`)

// ── 단어장 표제어 ───────────────────────────────────────────────────
const heads = new Map() // 표면형 → { word, meaningKo, sets:Set }
for (const r of await page('shared_words', 'word, meaning_ko, set_id')) {
  const w = String(r.word ?? '').toLowerCase()
  if (!w) continue
  if (!heads.has(w)) heads.set(w, { word: r.word, meaningKo: String(r.meaning_ko ?? ''), sets: new Set() })
  heads.get(w).sets.add(r.set_id)
}
console.log(`단어장 고유 표제어 ${heads.size.toLocaleString()}`)

/** 규칙 형태소로 얻는 원형 후보들. 순서가 곧 우선순위다. */
function bases(w) {
  const out = []
  const add = (s) => {
    if (s && s.length >= 3 && !out.includes(s)) out.push(s)
  }
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s')) add(w.slice(0, -1))
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('ed')) {
    add(w.slice(0, -2))
    add(w.slice(0, -1))
    // 자음 중복(stopped → stop)
    if (/([bdfglmnprt])\1ed$/.test(w)) add(w.slice(0, -3))
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3))
    add(w.slice(0, -3) + 'e')
    if (/([bdfglmnprt])\1ing$/.test(w)) add(w.slice(0, -4))
  }
  return out
}

/** 우리말 뜻이 겹치는가 — 뜻이 갈라진 낱말(building·glasses·arms)을 가려낸다. */
function meaningOverlap(a, b) {
  const norm = (s) =>
    String(s)
      .replace(/\([^)]*\)/g, ' ')
      .split(/[;,·/]|\s\d[.)]/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  const A = norm(a)
  const B = norm(b)
  if (!A.length || !B.length) return false
  for (const x of A) for (const y of B) if (x === y || x.includes(y) || y.includes(x)) return true
  return false
}

const rows = { A: [], B: [], C: [] }
for (const [w, h] of heads) {
  if (dict.has(w)) continue // 표제어 자체가 사전에 있으면 굴절형이 아니다

  // A — 사전이 직접 적어 둔 굴절형.
  const declared = inflectOf.get(w)
  if (declared && dict.has(declared)) {
    rows.A.push({ surface: h.word, base: declared, sets: h.sets.size, why: '사전 inflected_forms 명시' })
    continue
  }

  // B/C — 규칙 형태소.
  const base = bases(w).find((b) => dict.has(b))
  if (!base) continue
  const overlap = meaningOverlap(h.meaningKo, dict.get(base).meaningKo)
  ;(overlap ? rows.B : rows.C).push({
    surface: h.word,
    base,
    sets: h.sets.size,
    surfaceKo: h.meaningKo.slice(0, 40),
    baseKo: dict.get(base).meaningKo.slice(0, 40),
  })
}

const total = rows.A.length + rows.B.length + rows.C.length
console.log(`\n굴절형으로 보이는 표제어 ${total.toLocaleString()}\n`)
console.log(`  A 확실  ${String(rows.A.length).padStart(5)}  사전이 굴절형이라고 적어 둔 것 — 그대로 정리 가능`)
console.log(`  B 유력  ${String(rows.B.length).padStart(5)}  규칙으로 원형이 잡히고 뜻도 겹침`)
console.log(`  C 의심  ${String(rows.C.length).padStart(5)}  뜻이 안 겹침 — 뜻이 갈라진 낱말이거나 오탐. 사람이 볼 것`)

const show = (label, list, n = 10) => {
  console.log(`\n── ${label} 표본 ──`)
  for (const r of list.slice(0, n)) {
    console.log(
      `  ${r.surface} → ${r.base}` +
        (r.surfaceKo !== undefined ? `    [${r.surfaceKo}] vs [${r.baseKo}]` : `    (${r.why})`),
    )
  }
}
show('A 확실', rows.A)
show('B 유력', rows.B)
show('C 의심 — 이쪽이 오탐이 섞이는 자리다', rows.C, 16)

fs.writeFileSync(
  'scripts/dict/wordset-inflection-audit.json',
  JSON.stringify({ measured_at: new Date().toISOString(), counts: { A: rows.A.length, B: rows.B.length, C: rows.C.length }, rows }, null, 2),
)
console.log('\n→ scripts/dict/wordset-inflection-audit.json (전체 목록)')
