// scripts/dict/vrl-rule-recompute.mjs
//
// **`shared_dictionary.v_level_rule_v1` 을 현재 룰(`calc_v_level`)로 다시 맞춘다.**
// 기본은 백업만(dry-run). `--commit` 을 줘야 쓴다.
//
// ── 무엇을 잃는지 먼저 (실측 2026-08-22) ────────────────────────────
// non-kice 42,249행의 `vrl_calculated_at` 이 **2026-05-23 단일 날짜**다 — 즉 이 컬럼은
// 그날 찍은 **동결 스냅샷**이고, 그 뒤 `calc_v_level` 이 개정됐다(본문에 "★ NEW: 우선순위 4.5").
// 그래서 지금 보이는 drift 18.4% 는 **입력이 변해서가 아니라 룰 버전이 변해서** 생긴 것이다.
//
// 덮어쓰면 `_sanity.ts` 가 `V{rule_v1}→V{v_level}` 로 보여 주던 **"Round 1-6 재분류" 기준선이
// 사라진다.** 그런데도 맞추는 이유: 2026-08-21~22 에 kice 5,254행을 이미 현재 룰로 덮었고,
// 그대로 두면 한 컬럼에 **두 시점이 섞인다**(11% 새 룰 · 89% 옛 스냅샷). 섞인 상태는
// 어느 쪽으로도 해석할 수 없어 둘 중 어느 순수 상태보다 나쁘다.
//
// 그래서 **바뀔 행의 옛 값을 파일로 남기고** 맞춘다. DB 안에 남기려면 컬럼이나 backup 스키마가
// 필요하고 그건 마이그레이션이다 — 검사 하나 때문에 스키마를 늘리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/dict/vrl-rule-recompute.mjs            # 백업 파일만 쓴다
//   pnpm dlx tsx scripts/dict/vrl-rule-recompute.mjs --commit   # 백업 후 갱신

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')
const OUT = 'scripts/dict/vrl-rule-v1-snapshot.json'

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 전 행 읽기 ──────────────────────────────────────────────────────
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, v_level, v_level_rule_v1, vrl_calculated_at')
    .order('word', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  rows.push(...data)
  if (data.length < 1000) break
}
console.log(`사전 ${rows.length}행`)

// ── 현재 룰 값 계산 (묶어서 동시 호출) ───────────────────────────────
const computed = new Map()
const CONC = 25
for (let i = 0; i < rows.length; i += CONC) {
  const batch = rows.slice(i, i + CONC)
  const res = await Promise.all(batch.map((r) => db.rpc('calc_v_level', { p_word: r.word })))
  for (let j = 0; j < batch.length; j++) {
    if (res[j].error) throw new Error(`calc_v_level(${batch[j].word}) 실패: ` + res[j].error.message)
    computed.set(batch[j].word, res[j].data ?? null)
  }
  if (i % 5000 === 0) process.stdout.write(`\r계산 ${i}/${rows.length}`)
}
console.log(`\r계산 ${rows.length}/${rows.length}`)

const changing = rows.filter((r) => (r.v_level_rule_v1 ?? null) !== (computed.get(r.word) ?? null))
console.log(`바뀔 행 ${changing.length} (${((100 * changing.length) / rows.length).toFixed(1)}%)`)

// ── 백업 — 잃을 값만 남긴다(안 바뀌는 행은 재계산으로 되찾을 수 있다) ─
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      what: 'shared_dictionary.v_level_rule_v1 덮어쓰기 직전 값',
      why: '2026-05-23 동결 스냅샷 — calc_v_level 개정 전 룰의 출력. 덮어쓰면 달리 되찾을 방법이 없다',
      caveat:
        'kice 5,254행은 2026-08-21~22 에 이미 덮어써서 그 옛 값은 여기에도 없다 — 그때는 백업하지 않았다',
      taken_at_note: '시각은 커밋 이력으로 확인할 것 (스크립트는 결정성을 위해 시각을 박지 않는다)',
      count: changing.length,
      rows: changing.map((r) => ({
        word: r.word,
        old_rule_v1: r.v_level_rule_v1,
        new_rule: computed.get(r.word) ?? null,
        v_level: r.v_level,
        old_calculated_at: r.vrl_calculated_at,
      })),
    },
    null,
    1,
  ),
)
console.log(`백업 → ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`)

const delta = changing.filter((r) => r.v_level_rule_v1 != null && computed.get(r.word) != null)
const up = delta.filter((r) => computed.get(r.word) > r.v_level_rule_v1).length
const down = delta.filter((r) => computed.get(r.word) < r.v_level_rule_v1).length
console.log(`  NULL 채움 ${changing.filter((r) => r.v_level_rule_v1 == null).length} · 상향 ${up} · 하향 ${down}`)

if (!commit) {
  console.log('\n백업만 했다. 갱신하려면 --commit')
  process.exit(0)
}

let done = 0
for (const r of changing) {
  const { error } = await db
    .from('shared_dictionary')
    .update({ v_level_rule_v1: computed.get(r.word) ?? null, vrl_calculated_at: new Date().toISOString() })
    .eq('word', r.word)
  if (error) throw new Error(`${r.word} 갱신 실패: ` + error.message)
  done += 1
  if (done % 500 === 0) process.stdout.write(`\r갱신 ${done}/${changing.length}`)
}
console.log(`\r갱신 ${done}/${changing.length}  완료`)
