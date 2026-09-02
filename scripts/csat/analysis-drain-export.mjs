// scripts/csat/analysis-drain-export.mjs
//
// **기출 문항 분석 드레인 — 1단계(export).** 할 몫을 청크로 뽑는다.
//
// 3단 구조(CLAUDE.md §🤖):
//   ① 이 스크립트          → scripts/csat/analysis-drain/chunk-NN.json
//   ② Claude Code          → chunk-NN.out.json  (문항마다 분석 + 3인 검수)
//   ③ analysis-drain-import → DB 적재
//
// **재실행 안전.** 이미 채워진 문항(= 같은 폴더의 *.out.json 에 들어 있고 검수 3인이 붙은 것)은
// 건너뛴다. 몇 번을 돌려도 남은 몫만 나온다. 건너뛴 수를 반드시 출력한다.
//
// 청크는 **유형별**로 묶는다. 회차별로 묶으면 한 청크 안에서 22개 유형을 오가야 해서
// 분석의 잣대가 문항마다 흔들린다. 같은 유형을 한 번에 보면 오답 함정의 **재사용 패턴**이 보이고,
// 그것이 유형별 분석 결과의 알맹이다. 유형 안에서는 **최신 회차 먼저** — 현행 설계부터 덮는다.
//
// 실행:
//   node scripts/csat/analysis-drain-export.mjs                 (남은 전부)
//   node scripts/csat/analysis-drain-export.mjs --type R-BLANK  (한 유형만)
//   node scripts/csat/analysis-drain-export.mjs --size 10       (청크당 문항 수, 기본 12)
//   node scripts/csat/analysis-drain-export.mjs --limit 5       (청크 수 상한)

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, setBlockFor } from './lib-passage.mjs'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}

const DIR = path.resolve('scripts/csat/data')
const WORK = path.resolve('scripts/csat/analysis-drain')
fs.mkdirSync(WORK, { recursive: true })

const SIZE = Number(arg('size', 12))
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const ONLY_TYPE = arg('type')

const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))

// ── 이미 채워진 몫 ────────────────────────────────────────────────────
// out 파일에 있고 **검수 3인이 서로 다른 페르소나로 붙어 있는 것**만 완료로 센다.
// 분석만 있고 검수가 비면 완료가 아니다 — 여기서 느슨하게 세면 구멍이 영영 남는다.
const done = new Set()
let partial = 0
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json'))) {
  let j
  try {
    j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  } catch (e) {
    console.log(`  ⚠ ${f} 파싱 실패 — 완료로 세지 않는다 (${e.message})`)
    continue
  }
  for (const a of j.analyses ?? []) {
    const personas = new Set((a.reviews ?? []).filter((r) => r.verdict === 'pass').map((r) => r.persona))
    if (a.item_id && personas.size >= 3) done.add(a.item_id)
    else if (a.item_id) partial += 1
  }
}

// ── 남은 몫 ──────────────────────────────────────────────────────────
const pool = corpus.items
  .filter((it) => it.in_scope)
  .filter((it) => (ONLY_TYPE ? it.type_id === ONLY_TYPE : true))
  .filter((it) => !done.has(it.id))

// 유형별 → 최신 회차 먼저
const byType = new Map()
for (const it of pool) {
  if (!byType.has(it.type_id)) byType.set(it.type_id, [])
  byType.get(it.type_id).push(it)
}
for (const arr of byType.values()) {
  arr.sort((a, b) => b.year - a.year || b.month - a.month || a.no - b.no)
}
// 문항이 많은 유형부터 — 회차 커버 곡선이 가장 빨리 오른다
const types = [...byType.entries()].sort((a, b) => b[1].length - a[1].length)

/** 파서가 지문·선지를 못 뜬 문항이 3~4% 있다. 그 문항은 **원문 블록을 통째로 실어** 보낸다. */
function rawBlock(it) {
  const blocks = itemBlocks(it.exam, it.no)
  const lines = blocks.length ? blocks[0] : []
  const set = setBlockFor(it.exam, it.no)
  const all = set ? [...set, '', ...lines] : lines
  return all.join('\n').replace(/\n{3,}/g, '\n\n').trim() || null
}

function pack(it) {
  // 지문·선지를 못 떴거나(3%) 한글이 섞였거나(5%) 하면 원문 블록을 함께 싣는다
  const bodyOk = Boolean(it.passage && it.choices) && !it.body_suspect
  return {
    item_id: it.id,
    exam: it.exam,
    exam_label: it.exam_label,
    exam_kind: it.exam_kind,
    no: it.no,
    section: it.section,
    type_id: it.type_id,
    type_name: it.type_name,
    stem: it.stem,
    passage: it.passage,
    choices: it.choices,
    answer: it.answer,
    points: it.points,
    // 정답표가 없는 회차가 7개다. 정답을 모르는 채로 "정답 근거" 를 쓰면 그건 창작이다 —
    // 분석 지시문이 이 딱지를 보고 근거 서술을 요구하지 않는다.
    answer_known: it.answer != null,
    body_ok: bodyOk,
    raw_block: bodyOk ? null : rawBlock(it),
  }
}

// 기존 청크는 지운다 — 남은 몫이 줄었는데 옛 청크가 남아 있으면 두 번 일한다
let removed = 0
for (const f of fs.readdirSync(WORK).filter((f) => f.startsWith('chunk-') && f.endsWith('.json') && !f.endsWith('.out.json'))) {
  fs.rmSync(path.join(WORK, f))
  removed += 1
}

let n = 0
const manifest = []
outer: for (const [typeId, arr] of types) {
  for (let i = 0; i < arr.length; i += SIZE) {
    if (n >= LIMIT) break outer
    const slice = arr.slice(i, i + SIZE)
    n += 1
    // **청크 이름에 일련번호를 쓰지 않는다.** export 를 다시 돌리면 남은 몫이 줄어
    // `chunk-01` 이 어제와 다른 문항을 담는다. 그러면 `chunk-01.out.json` 이
    // 다른 문항의 원장을 덮어쓴다 — 재실행 안전이 정반대로 뒤집힌다.
    // 첫 문항 id 로 이름을 지으면 같은 몫은 늘 같은 이름, 다른 몫은 늘 다른 이름이다.
    const name = `chunk-${typeId}-${slice[0].id.replace('#', '-')}.json`
    const payload = {
      chunk: n,
      type_id: typeId,
      type_name: slice[0].type_name,
      count: slice.length,
      items: slice.map(pack),
    }
    fs.writeFileSync(path.join(WORK, name), JSON.stringify(payload, null, 1))
    manifest.push({ seq: n, file: name, type_id: typeId, type_name: slice[0].type_name, count: slice.length })
  }
}

fs.writeFileSync(path.join(WORK, '_MANIFEST.json'), JSON.stringify({ built_at: new Date().toISOString(), size: SIZE, chunks: manifest }, null, 1))

const total = corpus.items.filter((it) => it.in_scope).length
console.log(`  사정권 ${total} · 완료 ${done.size} · 검수 미완 ${partial} · 남은 몫 ${pool.length}`)
console.log(`  옛 청크 ${removed}개 삭제 · 새 청크 ${n}개 (청크당 ${SIZE})`)
if (ONLY_TYPE) console.log(`  유형 한정: ${ONLY_TYPE}`)
console.log(`→ ${WORK}`)
