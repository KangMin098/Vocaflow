// scripts/csat/export-choice-blind.mjs
//
// **맹검 손판독 배치 — 1단계(뽑기). §6.14.5 가 남긴 "왜 짧은가" 를 가른다.**
//
// §6.14 는 빈칸 정답이 오답보다 짧다는 것을 보였고(⑤ 제외 1.809 vs 기저 2.5, p=0.0001),
// §6.14.5 는 그럴듯한 설명(= §6.12 미끼와 한 몸)이 **틀렸음**을 보였다(r=0.098).
// 남은 후보 셋은 전부 **의미**라 어휘 유사도로는 못 가른다:
//
//   (a) 추상 — 정답은 추상 명사구, 오답은 구체 서술이라 길다
//   (b) 회피 — 정답만 지문 표현을 피해 바꿔 쓰느라 짧아진다
//   (c) 압축 — 재진술이란 것 자체가 압축이다
//
// CLAUDE.md §🤖 대로 **Claude Code 가 그 LLM이다.** 이 파일이 몫을 뽑고,
// Claude Code 가 채워 `chunk-NN.out.json` 으로 저장하고, score-choice-blind.mjs 가 채점한다.
//
// **맹검 방법.** 선지 다섯을 문항마다 고정 시드로 섞어 A~E 로 다시 붙이고,
// 정답·배점·번호를 **청크 파일에 쓰지 않는다.** 대응표는 별도 key 파일로 나간다.
// 판독자가 정답을 모르는 채로 규칙표만 적용해야 한다 —
// 정답을 알면 "정답이니까 추상적이다" 로 채점하게 되고, 그러면 아무것도 검증하지 못한다.
//
// **재실행 안전.** 이미 `chunk-NN.out.json` 이 있는 문항은 다시 뽑지 않는다.
//
// 실행: pnpm dlx tsx scripts/csat/export-choice-blind.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

// 인자: --types=R-TOPIC,R-TITLE --dir=choice-blind2  (기본 = 빈칸)
const arg = (k, d) => (process.argv.find((x) => x.startsWith('--' + k + '=')) ?? '').split('=')[1] || d
const TYPES = arg('types', 'R-BLANK').split(',')
const WORK = path.resolve('scripts/csat/' + arg('dir', 'choice-blind'))
const PER = Number(arg('per', 21))
fs.mkdirSync(WORK, { recursive: true })

const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 2147483647; return h }

const items = []
for (const r of allRows()) {
  if (!TYPES.includes(r.type)) continue
  const a = answerOf(r.exam, r.no)
  if (!a || a.answer < 1 || a.answer > 5) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const ch = choicesOf(b)
  const pas = passageOf(b)
  if (!ch || ch.length !== 5 || !pas || pas.length < 150) continue
  if (ch.some((c) => !c || c.length < 2)) continue

  // 섞기 — 문항마다 고정 시드
  const idx = [0, 1, 2, 3, 4]
  const rnd = mkRnd(hash(`${r.exam}#${r.no}`))
  for (let i = idx.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t }

  items.push({
    id: `${r.exam}#${r.no}`,
    type: r.type,
    passage: pas.replace(/\[\s*3\s*점\s*\]/g, '').replace(/\s+/g, ' ').trim(),
    choices: idx.map((k, s) => ({ label: 'ABCDE'[s], text: ch[k] })),
    _key: { answerLabel: 'ABCDE'[idx.indexOf(a.answer - 1)], points: a.points, order: idx },
  })
}

// 이미 채운 것은 건너뛴다
const done = new Set()
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.out.json')) continue
  for (const row of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) done.add(row.id)
}
const todo = items.filter((x) => !done.has(x.id))

const keyPath = path.join(WORK, 'KEY.json')
fs.writeFileSync(keyPath, JSON.stringify(Object.fromEntries(items.map((x) => [x.id, { ...x._key, type: x.type }])), null, 1))

const RUBRIC = {
  note: '자료를 보기 전에 고정한 규칙표. 선지마다 세 값을 매긴다. 정답이 무엇인지 모르는 채로 매겨야 한다.',
  abstractness: '1~5. 이 선지가 얼마나 추상적인가. 1 = 구체 사건·사례·수치·행위 서술. 3 = 일반 진술. 5 = 상위 개념을 가리키는 추상 명사구(예: the limits of perception). 길이를 보지 말고 지시 대상의 층위만 볼 것.',
  passageEcho: '0~2. 이 선지가 지문의 표현을 얼마나 그대로 쓰는가. 0 = 지문에 없는 낱말로 다시 썼다. 1 = 지문의 핵심어 한둘을 그대로 가져왔다. 2 = 지문의 구절을 거의 그대로 옮겼다. **낱말 겹침이 아니라 표현을 그대로 쓰는가**를 볼 것 — 같은 뜻 다른 낱말은 0 이다.',
  concreteMarker: 'true/false. 구체 표지(고유명사·숫자·예시 도입어·시제 있는 사건 서술)가 하나라도 있는가. 이건 abstractness 와 따로 매긴다 — 내 추상도 판단이 길이만 따라간 것인지 검사하는 대조 항목이다.',
}

const chunks = []
for (let i = 0; i < todo.length; i += PER) chunks.push(todo.slice(i, i + PER))
chunks.forEach((c, i) => {
  const name = `chunk-${String(i).padStart(2, '0')}.json`
  fs.writeFileSync(path.join(WORK, name), JSON.stringify({
    rubric: RUBRIC,
    fillInstruction: '각 choices 원소에 abstractness(1~5) · passageEcho(0~2) · concreteMarker(true/false) 세 키를 더해 chunk-NN.out.json 으로 저장할 것. 다른 키는 건드리지 말 것.',
    items: c.map((x) => ({ id: x.id, type: x.type, passage: x.passage, choices: x.choices })),
  }, null, 1))
})

console.log('맹검 손판독 — 몫 뽑기')
console.log('='.repeat(70))
console.log(`  대상(${TYPES.join(",")}) 전체 ${items.length}문항 · 이미 채운 것 ${done.size} · 이번에 뽑은 것 ${todo.length}`)
console.log(`  청크 ${chunks.length}개 (문항 ${PER}개씩) → ${WORK}`)
console.log(`  대응표(정답·배점) → ${keyPath}  ← **채점 전까지 열지 않는다**`)
if (!todo.length) console.log('  → 남은 몫이 없다. score-choice-blind.mjs 로 채점할 것.')
