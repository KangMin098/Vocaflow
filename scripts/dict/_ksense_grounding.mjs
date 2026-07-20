// 읽기전용: 과다생성 검증 — 가장 많이 늘린 엔트리의 kaikki 근거 vs 산출물 대조
import fs from 'node:fs'
const rows = []
for (let s = 1; s <= 6; s++) {
  const dir = 'scripts/dict/ksense-s' + s
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => /\.out\.json$/.test(x))) {
    let arr, chunk
    try { arr = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')); chunk = JSON.parse(fs.readFileSync(dir + '/' + f.replace('.out', ''), 'utf8')) } catch { continue }
    const cur = new Map(chunk.map((e) => [e.word, e]))
    for (const e of arr) {
      const c = cur.get(e.word); if (!c) continue
      const grew = e.meanings_ko.length - c.current.length
      rows.push({ s, word: e.word, cur: c.current, kaikki: c.kaikki, out: e.meanings_ko, grew, kN: (c.kaikki || []).length })
    }
  }
}
// 늘어난 폭 최상위 + kaikki 후보수 대비 산출 sense 초과(=근거 부족 위험) 정렬
rows.sort((a, b) => (b.out.length - b.kN) - (a.out.length - a.kN) || b.grew - a.grew)
console.log('== 산출 sense가 kaikki 후보수를 가장 크게 초과한 상위 18 (근거부족 최고위험) ==')
for (const r of rows.slice(0, 18)) {
  console.log(`\n· S${r.s} ${r.word}  (cur ${r.cur.length} → out ${r.out.length}, kaikki후보 ${r.kN})`)
  console.log('  cur   : ' + r.cur.map((m) => m.pos[0] + ':' + m.meaning).join(' | '))
  console.log('  kaikki: ' + (r.kaikki || []).map((k) => k.pos[0] + ':' + k.gloss).join(' || '))
  console.log('  out   : ' + r.out.map((m) => m.pos[0] + ':' + m.meaning).join(' | '))
}
