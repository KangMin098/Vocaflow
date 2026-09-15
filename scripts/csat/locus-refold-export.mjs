// scripts/csat/locus-refold-export.mjs
//
// **근거 서술 재작성 드레인 — 1단계(export).** 학습자에게 못 내보낼 유형을 청크로 뽑는다.
//
// 무엇을 고치나: 유형 리포트의 `answer_locus_pattern`(「정답 근거가 어디 있나」)은 드레인
// 청크마다 **덧붙어** 쌓인다. 그래서 분석자끼리 하는 말이 그대로 남고, 그 글이 학습자 화면
// `/csat/<유형>` 에 그대로 나간다. 실측 2026-09-05: **26유형 중 13개.**
//
// 3단 구조(CLAUDE.md §🤖):
//   ① 이 스크립트        → scripts/csat/locus-refold/chunk-<TYPE>.json
//   ② Claude Code        → chunk-<TYPE>.out.json  (학습자용으로 다시 쓴 서술)
//   ③ locus-refold-import → DB 적재 (--commit · 게이트 통과 시에만)
//
// **재실행 안전.** 표지가 없어진 유형(= 이미 고쳐 올린 것)과 `.out.json` 이 이미 있는 유형은
// 뽑지 않는다. 몇 번을 돌려도 남은 몫만 나온다. 건너뛴 수를 출력한다.
//
// 청크를 유형 하나씩 두는 이유: 이 작업은 문항이 아니라 **글 한 편을 다시 쓰는 일**이라
// 여럿을 한 파일에 묶으면 잣대가 흔들리고, 하나가 잘못돼도 파일 전체를 되돌려야 한다.
//
// 실행:
//   node scripts/csat/locus-refold-export.mjs                (남은 전부)
//   node scripts/csat/locus-refold-export.mjs --type R-BLANK (한 유형만)
//   node scripts/csat/locus-refold-export.mjs --limit 3      (유형 수 상한)

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { detectAnalystMeta } from './lib-analyst-markers.mjs'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}

const WORK = path.resolve('scripts/csat/locus-refold')
fs.mkdirSync(WORK, { recursive: true })

const ONLY_TYPE = arg('type')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const [reports, types] = await Promise.all([
  db
    .from('csat_type_reports')
    .select('type_id, n_analyzed, answer_locus_pattern, procedure_steps, recurring_traps, failure_modes, time_budget_sec')
    .eq('status', 'published'),
  db.from('csat_types').select('id, name, section, status').eq('in_scope', true),
])
if (reports.error) throw new Error(`csat_type_reports: ${reports.error.message}`)
if (types.error) throw new Error(`csat_types: ${types.error.message}`)

const nameOf = new Map((types.data ?? []).map((t) => [t.id, t.name]))

// ── 이미 채운 몫 ──────────────────────────────────────────────────────
// out 파일이 있고 그 안의 재작성이 비어 있지 않은 것만 완료로 센다.
// 느슨하게 세면(파일 존재만 보면) 빈 파일이 그 유형을 영영 가린다.
const done = new Set()
let emptyOut = 0
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json'))) {
  let j
  try {
    j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  } catch (e) {
    console.log(`  ⚠ ${f} 파싱 실패 — 완료로 세지 않는다 (${e.message})`)
    continue
  }
  const text = (j.answer_locus_pattern ?? '').trim()
  if (j.type_id && text.length >= 200) done.add(j.type_id)
  else if (j.type_id) emptyOut += 1
}

const rows = (reports.data ?? [])
  .map((r) => ({ ...r, markers: detectAnalystMeta(r.answer_locus_pattern), name: nameOf.get(r.type_id) ?? r.type_id }))
  .filter((r) => r.markers.length > 0)
  .filter((r) => (ONLY_TYPE ? r.type_id === ONLY_TYPE : true))
  .sort((a, b) => (b.answer_locus_pattern?.length ?? 0) - (a.answer_locus_pattern?.length ?? 0))

const pending = rows.filter((r) => !done.has(r.type_id))

console.log(`  유형 ${reports.data?.length ?? 0} · 표지 있는 유형 ${rows.length} · 완료 ${done.size} · 남은 몫 ${pending.length}`)
if (emptyOut) console.log(`  ⚠ 비어 있는 .out.json ${emptyOut}개 — 완료로 세지 않았다`)

let written = 0
for (const r of pending) {
  if (written >= LIMIT) break
  const file = path.join(WORK, `chunk-${r.type_id}.json`)
  const chunk = {
    type_id: r.type_id,
    name: r.name,
    n_analyzed: r.n_analyzed,
    time_budget_sec: r.time_budget_sec,
    detected_markers: r.markers,
    // 다시 쓸 원본. 여기 있는 사실 말고 **새 사실을 지어내지 않는다** — 게이트가 문항 id 로 대조한다.
    current_answer_locus_pattern: r.answer_locus_pattern,
    // 맥락 — 재작성이 절차·함정과 어긋나지 않게 함께 싣는다 (이 둘은 고치지 않는다)
    context: {
      procedure_steps: r.procedure_steps ?? [],
      recurring_traps: (r.recurring_traps ?? []).slice(0, 8),
      failure_modes: (r.failure_modes ?? []).slice(0, 8),
    },
    instructions_ref: 'scripts/csat/locus-refold/_PROMPT.md',
  }
  fs.writeFileSync(file, JSON.stringify(chunk, null, 2) + '\n', 'utf8')
  console.log(`  → ${path.basename(file)}  ${r.name} (${r.answer_locus_pattern.length}자 · ${r.markers.join(', ')})`)
  written += 1
}

if (!written) console.log('  새 청크 없음 — 남은 몫이 없거나 --limit 0 이다')
else console.log(`\n  새 청크 ${written}개. 다음: 청크를 읽고 chunk-<TYPE>.out.json 으로 저장한다.`)
