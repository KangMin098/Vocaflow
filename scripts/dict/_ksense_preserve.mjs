// 읽기 전용: 정확도 검증 — current sense 가 output 에 보존됐는지 (드롭/열화 탐지)
import fs from 'node:fs'
const bg = (s) => { const t = (s || '').replace(/[^가-힣a-zA-Z0-9]/g, ''); const o = new Set(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o }
const jac = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i) }
let ent = 0, curSenses = 0, dropped = 0, posMismatch = 0
const examples = []
for (let s = 1; s <= 6; s++) {
  const dir = 'scripts/dict/ksense-s' + s
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => /\.out\.json$/.test(x))) {
    let arr, chunk
    try { arr = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')); chunk = JSON.parse(fs.readFileSync(dir + '/' + f.replace('.out', ''), 'utf8')) } catch { continue }
    const cur = new Map(chunk.map((e) => [e.word, e]))
    for (const e of arr) {
      const c = cur.get(e.word); if (!c) continue
      ent++
      const outBg = e.meanings_ko.map((m) => ({ pos: m.pos, bg: bg(m.meaning) }))
      for (const cm of c.current) {
        curSenses++
        const cbg = bg(cm.meaning)
        let best = 0, bestPos = false
        for (const o of outBg) { const v = jac(cbg, o.bg); if (v > best) { best = v; bestPos = (o.pos === cm.pos) } }
        // current sense 가 output 어디에도 0.2 미만으로만 매칭 = 사실상 사라짐
        if (best < 0.2) { dropped++; if (examples.length < 12) examples.push(`S${s} ${e.word}: 잃음? "${cm.meaning}" (best ${best.toFixed(2)})`) }
      }
    }
  }
}
console.log(`검사 엔트리: ${ent} · current sense 총 ${curSenses}`)
console.log(`보존 실패(어떤 output 과도 유사도<0.2): ${dropped} (${(dropped / curSenses * 100).toFixed(2)}%)`)
console.log('예시(정말 드롭인지 육안 확인용):')
for (const x of examples) console.log('  ' + x)
