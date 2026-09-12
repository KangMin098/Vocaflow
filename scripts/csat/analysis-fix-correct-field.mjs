// scripts/csat/analysis-fix-correct-field.mjs
//
// **정답 선지의 서술이 오답용 필드에 들어가 있던 것을 제자리로 옮긴다.**
//
// 배경 — 드레인 스키마가 「② 오답 층위」로 설계돼 있어서 선지에 쓸 수 있는 필드가
// `why_tempting`(왜 골라지나)·`how_to_reject`(어떻게 배제하나) 둘뿐이었다. 그런데 이 둘은
// **오답에만 뜻이 있는 이름**이다. 정답 선지를 맡은 분석자들은 갈 곳이 없어 두 갈래로 갈렸다:
//
//   · 398문항 — `why_tempting` 에 **정답 확정 서술**을 썼다(내용은 옳다. 이름만 틀렸다)
//   · 168문항 — 아예 비워 뒀다(`{verdict:"correct", why_tempting:null, how_to_reject:null}`)
//
// 이 스크립트는 **앞의 398건만** 옮긴다. 뒤의 168건은 사람이(=Claude Code 배치가) 써야 한다.
//
// ⚠️ **검수를 다시 받아야 하나?** 받지 않는다. 옮기는 것은 **같은 문장**이고, 3인은 이미 그
//    문장을 읽고 판정했다. 필드 이름이 바뀐다고 주장이 달라지지 않는다. 반대로 여기서 검수를
//    새로 요구하면, 내용이 그대로인데 2,478건을 다시 찍는 **도장 검수**가 된다.
//    내용을 **고치는** 168건은 당연히 3인을 다시 받는다.
//
// 재실행 안전 — 이미 `why_correct` 가 40자 이상이면 건드리지 않는다.
//
// 실행:
//   node scripts/csat/analysis-fix-correct-field.mjs            (미리보기)
//   node scripts/csat/analysis-fix-correct-field.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

const COMMIT = process.argv.includes('--commit')
const WORK = path.resolve('scripts/csat/analysis-drain')

/** 정답 확정 서술로 쓸 수 있을 만큼 실한가 */
const substantive = (s) => typeof s === 'string' && s.trim().length >= 40

let moved = 0
let empty = 0
let already = 0
let cleaned = 0
const emptyIds = []
const touched = new Map()

for (const f of fs.readdirSync(WORK).filter((x) => x.endsWith('.out.json')).sort()) {
  const p = path.join(WORK, f)
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  let changed = 0

  for (const a of j.analyses ?? []) {
    if (a.answer_unknown === true) continue
    const c = (a.choices ?? []).find((x) => x.verdict === 'correct')
    if (!c) continue

    if (substantive(c.why_correct)) {
      already += 1
    } else if (substantive(c.why_tempting)) {
      c.why_correct = c.why_tempting.trim()
      moved += 1
      changed += 1
    } else {
      empty += 1
      emptyIds.push(a.item_id)
    }

    // 정답 선지에 오답용 필드가 남아 있으면 걷는다 — 이름이 뜻과 어긋나면 다음 사람이 또 헷갈린다.
    // `trap` 도 정답에는 뜻이 없다(대부분 "-" 나 null 로 채워져 있었다).
    for (const k of ['why_tempting', 'how_to_reject', 'trap']) {
      if (k in c) { delete c[k]; cleaned += 1; changed += 1 }
    }
  }

  if (changed) {
    touched.set(f, changed)
    if (COMMIT) fs.writeFileSync(p, JSON.stringify(j, null, 2))
  }
}

console.log(`\n  옮김 ${moved} · 이미 갖춤 ${already} · **비어 있어 사람이 써야 함 ${empty}** · 오답용 필드 정리 ${cleaned}`)
console.log(`  손댄 청크 ${touched.size}개`)
if (empty) {
  console.log('\n  ── 서술이 아예 없는 문항 (드레인 대상) ──')
  console.log('  ' + emptyIds.join(' '))
}
if (!COMMIT) console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
