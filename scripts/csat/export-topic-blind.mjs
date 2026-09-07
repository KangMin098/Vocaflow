// scripts/csat/export-topic-blind.mjs
//
// **소재 분류기 재검(P0.5) — 1단계(뽑기).**
//
// §6.11 은 지문 300편의 소재 비율을 실었다. 그 비율은 `measure-topic.mjs` 의
// **키워드 목록 8종**이 붙인 라벨에서 나온다. 그리고 그 목록은 **전 회차를 보고** 쓰였다 —
// 자료 홀드아웃이 없다.
//
// P0.5 는 이렇게 말한다: *"자료를 보고 만든 분류기의 적합도는 그 자료에서 재지 않는다."*
// 홀드아웃이 없으면 **분류기가 안 본 판정자**를 쓴다 — 사람의 맹검 판독이다.
//
// §6.11 에도 이미 손판독 대조가 있다: **10/12 = 83%**. 그러나 **n=12 로 300편의 비율을
// 떠받치기엔 얇다.** 표본을 넓히고, 일치율만이 아니라 **카파**와 **범주별 정확·재현**까지 낸다.
//
// **맹검.** 기계 라벨은 청크에 안 쓴다(KEY.json 으로 격리).
// 표본은 고정 시드로 뽑으므로 재현된다. 범주 8종은 `measure-topic.mjs` 의 것을 그대로 쓴다 —
// **판정자가 기계와 다른 범주를 쓰면 대조가 성립하지 않는다.**
//
// 실행: pnpm dlx tsx scripts/csat/export-topic-blind.mjs
//   인자: --n=48 (표본 크기)

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, allRows } from './lib-passage.mjs'

const arg = (k, d) => (process.argv.find((x) => x.startsWith('--' + k + '=')) ?? '').split('=')[1] || d
const N = Number(arg('n', 48))  // --n=300 이면 전수
const PER = Number(arg('per', 16))
const TAG = arg('tag', 'chunk')  // 배치마다 다른 이름을 준다 — 앞 배치의 산출을 덮지 않으려고
const WORK = path.resolve('scripts/csat/topic-blind')
fs.mkdirSync(WORK, { recursive: true })

const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

// measure-topic.mjs 와 **같은 대상**을 잡는다 — 읽기 지문
const READ = ['R-PURPOSE', 'R-MOOD', 'R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'R-IMPLY',
  'R-GRAMMAR', 'R-VOCAB', 'R-BLANK', 'R-IRRELEVANT', 'R-ORDER', 'R-INSERT', 'R-SUMMARY']

const pool = []
for (const r of allRows()) {
  if (!READ.includes(r.type)) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (!p || p.length < 200) continue
  pool.push({ id: `${r.exam}#${r.no}`, type: r.type, passage: p.replace(/\s+/g, ' ').trim() })
}
pool.sort((a, b) => a.id.localeCompare(b.id))

// 고정 시드 표본 — 층화하지 않는다. 장르 편중까지 그대로 받아야 실제 정확도가 나온다
const rnd = mkRnd(20260826)
const idx = pool.map((_, i) => i)
for (let i = idx.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t }
const sample = idx.slice(0, Math.min(N, pool.length)).map((i) => pool[i]).sort((a, b) => a.id.localeCompare(b.id))

fs.writeFileSync(path.join(WORK, 'SAMPLE.json'), JSON.stringify({ n: sample.length, poolSize: pool.length, ids: sample.map((x) => x.id) }, null, 1))

const done = new Set()
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.out.json')) continue
  for (const row of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) done.add(row.id)
}
const todo = sample.filter((x) => !done.has(x.id))

const CATS = ['과학·자연', '심리·인지', '사회·경제', '기술·매체', '예술·문화', '역사·인류', '교육·언어', '철학·윤리', '분류불가']
const RUBRIC = {
  note: '자료를 보기 전에 고정한 규칙표. 지문마다 소재 하나를 고른다. 기계가 뭐라고 했는지 모르는 채로 고른다.',
  categories: CATS,
  rule: '**지문이 무엇에 관한 글인지**로 고른다. 소재 낱말이 몇 개 나오는지가 아니라 글의 주제가 어느 영역에 속하는지를 본다. '
    + '두 영역에 걸치면 **논지가 걸린 쪽**을 고른다(예: 뇌과학으로 학습을 설명하면 학습이 논지면 교육·언어). '
    + '학술 소재 축에 안 맞는 글(안내문·편지·서사·심경)은 **분류불가**로 둔다 — 억지로 밀어 넣지 않는다.',
}

const chunks = []
for (let i = 0; i < todo.length; i += PER) chunks.push(todo.slice(i, i + PER))
chunks.forEach((c, i) => {
  fs.writeFileSync(path.join(WORK, `${TAG}-${String(i).padStart(2, '0')}.json`), JSON.stringify({
    rubric: RUBRIC,
    fillInstruction: `각 items 원소에 hand 키(위 categories 중 하나)를 더해 ${TAG}-NN.out.json 으로 저장할 것.`,
    items: c.map((x) => ({ id: x.id, type: x.type, passage: x.passage })),
  }, null, 1))
})

console.log('소재 분류기 재검 — 맹검 표본 뽑기')
console.log('='.repeat(70))
console.log(`  전체 지문 ${pool.length}편 · 표본 ${sample.length}편(고정 시드, 층화 없음)`)
console.log(`  이미 채운 것 ${done.size} · 이번에 뽑은 것 ${todo.length} · 청크 ${chunks.length}개`)
console.log(`  → ${WORK}`)
if (!todo.length) console.log('  → 남은 몫이 없다. score-topic-blind.mjs 로 채점할 것.')
