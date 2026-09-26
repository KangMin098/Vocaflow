// scripts/csat/checklist-exp/plos-export.mjs
//
// **PLOS 검증 표본 — 논문 50편을 세 읽기 방식의 눈가림 청크로 만든다(읽기 전용 · DB 0).**
//
// 정답: PLOS 원본 보관 판정 전문 기록(`scripts/csat/plos-raw-triage-{r3,v7,v7b}/chunk-*.out.json`, basis full).
// 모집단(중복 제거 2,986편)이 keep 94% · hold 5% · discard 0.6% 라 판정값별로 층화해 뽑는다(`--keep 25 --hold 15 --discard 10`).
// 제목이 `RETRACTED:` 인 논문은 뺀다 — 기준 §5 가 이미 규칙으로 가르는 것이라(obsolete-fact) 판정 방식 비교에 넣을 이유가 없다.
//
// 세 방식(같은 50편):
//   full1  — 전문 · 청크당 한 편(에이전트 하나가 논문 하나)
//   full2  — 전문 · 청크당 두 편
//   sect   — 서론·논의·결론 절만(본문의 절 제목 줄로 자른다) · 청크 예산 75,000자
// 기준 §2 는 판정자가 전문을 읽으라고 한다 — sect 는 **그 규칙을 바꿀지 재기 위한 비교**이지 채택이 아니다.
//
// 실행: node scripts/csat/checklist-exp/plos-export.mjs [--seed plos1] [--keep 25 --hold 15 --discard 10]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const argOf = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SEED = argOf('seed', 'plos1')
const WANT = { keep: Number(argOf('keep', 25)), hold: Number(argOf('hold', 15)), discard: Number(argOf('discard', 10)) }
const OUT = path.resolve('scripts/csat/checklist-exp/work-plos')
const DIRS = ['plos-raw-triage-r3', 'plos-raw-triage-v7', 'plos-raw-triage-v7b']

// ── 정답 모으기 — 같은 id 가 여러 번 판정됐으면 기준 버전이 가장 높은 것 ─────
const truth = new Map()
for (const d of DIRS) {
  const dir = path.resolve('scripts/csat', d)
  for (const f of fs.readdirSync(dir).filter((x) => /^chunk-\d+\.out\.json$/.test(x))) {
    const inp = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.out.json', '.json')), 'utf8'))
    const byId = new Map((Array.isArray(inp) ? inp : inp.items).map((x) => [x.id, x]))
    for (const o of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      const i = byId.get(o.id)
      if (!i || o.basis !== 'full') continue
      const prev = truth.get(o.id)
      if (!prev || (o.criteria_version ?? 0) > (prev.o.criteria_version ?? 0)) truth.set(o.id, { o, i })
    }
  }
}
const population = { keep: 0, hold: 0, discard: 0 }
const pool = { keep: [], hold: [], discard: [] }
for (const t of truth.values()) {
  if (/^RETRACTED/i.test(String(t.i.title))) continue
  if (!pool[t.o.retention]) continue
  population[t.o.retention]++
  pool[t.o.retention].push(t)
}
const order = (id) => crypto.createHash('sha256').update(`${SEED}:${id}`).digest('hex')
const picked = Object.entries(WANT)
  .flatMap(([v, n]) => pool[v].sort((a, b) => order(a.o.id).localeCompare(order(b.o.id))).slice(0, n))
  .sort((a, b) => order(`mix:${a.o.id}`).localeCompare(order(`mix:${b.o.id}`)))

// ── 서론·논의·결론만 — 절 제목에서 자른다 ──────────────────────────────────
// 본문 대부분이 한 줄이고 절 제목이 문장 사이에 붙어 있다(「… 0.05. Results Five hundred …」 · 실측 50편 중 37편).
// 그래서 줄 단위가 아니라 **문장 경계 뒤에 오는 제목 낱말 + 대문자로 시작하는 다음 낱말**을 절 경계로 본다.
const HEADS = ['Abstract', 'Introduction', 'Background', 'Materials and methods', 'Methods', 'Method', 'Results and discussion', 'Results', 'Discussion', 'Conclusions', 'Conclusion', 'Concluding remarks', 'General discussion', 'Supporting information', 'Acknowledgments', 'Acknowledgements', 'References', 'Author contributions']
const KEEP_HEAD = /^(Introduction|Background|Results and discussion|Discussion|Conclusions?|Concluding remarks|General discussion)$/i
const HEAD_RE = new RegExp(`(^|[.!?)\\]\\d%]\\s+|\\n\\s*)(${HEADS.join('|')})(?=\\s*\\n|\\s+[A-Z])`, 'g')
function sections(text) {
  const s = String(text)
  const marks = [...s.matchAll(HEAD_RE)].map((m) => ({ at: m.index + m[1].length, head: m[2] }))
  if (!marks.length) return ''
  let out = ''
  marks.forEach((m, i) => {
    if (KEEP_HEAD.test(m.head)) out += s.slice(m.at, i + 1 < marks.length ? marks[i + 1].at : s.length).trim() + '\n\n'
  })
  return out.trim()
}

const view = (t, content) => ({ id: t.o.id, title: t.i.title, source: t.i.source ?? 'plos', words: t.i.words ?? null, v_level: t.i.v_level ?? null, content })
const key = {
  seed: SEED,
  population,
  items: picked.map((t) => ({ id: t.o.id, source: 'plos', truth: t.o.retention, hold_reason: t.o.hold_reason ?? null, why: t.o.why, criteria_version: t.o.criteria_version, second: null })),
}

function write(sub, chunks) {
  const dir = path.join(OUT, sub)
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir).filter((x) => /^chunk-\d+\.json$/.test(x))) fs.rmSync(path.join(dir, f))
  chunks.forEach((c, i) => fs.writeFileSync(path.join(dir, `chunk-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(c, null, 1) + '\n'))
  fs.writeFileSync(path.join(dir, 'key.json'), JSON.stringify(key, null, 1) + '\n')
  const chars = chunks.flat().reduce((s, x) => s + x.content.length, 0)
  console.log(`  ${sub}: 청크 ${chunks.length} · ${chunks.flat().length}편 · ${chars.toLocaleString()}자`)
}

write('full1', picked.map((t) => [view(t, t.i.content)]))
const pairs = []
for (let i = 0; i < picked.length; i += 2) pairs.push(picked.slice(i, i + 2).map((t) => view(t, t.i.content)))
write('full2', pairs)
const sect = [[]]
let size = 0
let empty = 0
for (const t of picked) {
  let s = sections(t.i.content)
  if (s.length < 500) { empty++; s = t.i.content } // 절 제목을 못 찾으면 전문 — 몇 편인지 센다
  if (sect.at(-1).length && size + s.length > 75000) { sect.push([]); size = 0 }
  sect.at(-1).push(view(t, s))
  size += s.length
}
write('sect', sect)
const full = picked.reduce((s, t) => s + t.i.content.length, 0)
const cut = sect.flat().reduce((s, x) => s + x.content.length, 0)
console.log(`  모집단(RETRACTED 제외) ${JSON.stringify(population)} · 표본 ${picked.length} · sect 분량 ${((cut / full) * 100).toFixed(0)}% · 절 제목 못 찾아 전문 ${empty}편`)
