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

/**
 * 지문이 미덥지 않은 문항에 싣는 **원문**.
 *
 * ⚠️ 문항 블록만 실으면 부족하다. 단 나누기가 실패한 페이지에서는 **블록 자체가 두 단이 섞인
 *    뭉갬**이라(실측 M2306#39: `sunk cost ______ This makes sense from the perspective of
 *    information fallacy` — 두 단이 낱말 단위로 교대) 블록을 줘도 복원할 수 없다.
 *    서브에이전트가 결국 `columns2/*.txt` 를 직접 열어야 했다.
 *
 * 그래서 **회차 원문의 창(window)** 을 함께 싣는다 — 문항 번호가 나온 줄 앞뒤 40줄.
 * 그 안에 옆 단이 통째로 들어 있으므로 사람이(=분석하는 쪽이) 눈으로 갈라 읽을 수 있다.
 */
const COL_DIR = path.resolve('scripts/csat/data/columns2')
const colCache = new Map()
function colLines(exam) {
  if (!colCache.has(exam)) {
    const p = path.join(COL_DIR, `${exam}.txt`)
    colCache.set(exam, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : [])
  }
  return colCache.get(exam)
}

function rawBlock(it) {
  const blocks = itemBlocks(it.exam, it.no)
  const lines = blocks.length ? blocks[0] : []
  const set = setBlockFor(it.exam, it.no)
  const all = set ? [...set, '', ...lines] : lines
  const block = all.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  const ls = colLines(it.exam)
  const re = new RegExp(`(?:^|\\s)${it.no}\\s*[.．]`)
  const at = ls.findIndex((l) => re.test(l))
  const window = at >= 0 ? ls.slice(Math.max(0, at - 6), at + 40).join('\n').replace(/\n{3,}/g, '\n\n') : ''

  const parts = []
  if (block) parts.push('── 문항 블록 ──\n' + block)
  if (window) parts.push('── 회차 원문 창(단이 안 갈렸으면 여기서 좌우를 갈라 읽는다) ──\n' + window)
  return parts.join('\n\n') || null
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

// 끝난 청크는 지운다 — 남은 몫이 줄었는데 옛 청크가 남아 있으면 두 번 일한다.
//
// ⚠️ **아직 안 끝난 청크는 건드리지 않는다.** 청크는 서브에이전트의 **입력 파일**이고,
//    돌고 있는 에이전트의 입력을 지우면 그 몫이 통째로 날아간다(2026-09-02 실제로 겪었다 —
//    `--limit 0` 으로 재실행했더니 작업 중이던 청크가 사라졌다). 그 청크의 문항이 전부
//    완료된 것만 지운다.
let removed = 0
let kept = 0
for (const f of fs.readdirSync(WORK).filter((f) => f.startsWith('chunk-') && f.endsWith('.json') && !f.endsWith('.out.json'))) {
  let ids = []
  try {
    ids = (JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []).map((i) => i.item_id)
  } catch {
    ids = [] // 못 읽는 청크는 소모품으로 본다
  }
  if (ids.length && !ids.every((id) => done.has(id))) { kept += 1; continue }
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
      // 청크는 뽑힌 시점의 코퍼스를 담는다. 파서를 고치면 코퍼스가 바뀌므로 **작업 중이던
      // 청크는 낡는다** — 실측: 서브에이전트가 낡은 청크 본문으로 인용을 뽑아 게이트가 어긋났다.
      // 게이트는 코퍼스를 건초더미로 쓰므로, 둘이 다르면 **코퍼스가 정본**이다.
      corpus_built_at: corpus.report?.built_at ?? null,
      exported_at: new Date().toISOString(),
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
console.log(`  끝난 청크 ${removed}개 삭제 · 작업 중이라 남긴 청크 ${kept}개 · 새 청크 ${n}개 (청크당 ${SIZE})`)
if (ONLY_TYPE) console.log(`  유형 한정: ${ONLY_TYPE}`)
console.log(`→ ${WORK}`)
