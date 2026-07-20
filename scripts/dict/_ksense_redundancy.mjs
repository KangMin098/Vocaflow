// 읽기 전용: sense 중복도(inflation) 스캔 — after 엔트리 내 두 sense 의 한국어 bigram Jaccard
import fs from 'node:fs'
const bg = (s) => { const t = (s || '').replace(/[^가-힣a-zA-Z0-9]/g, ''); const o = new Set(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o }
const jac = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i) }
const rows = []
for (let s = 1; s <= 6; s++) {
  const dir = 'scripts/dict/ksense-s' + s
  if (!fs.existsSync(dir)) continue
  let ent = 0, redun = 0, split1 = 0, compoundFix = 0
  const worst = []
  for (const f of fs.readdirSync(dir).filter((x) => /\.out\.json$/.test(x))) {
    let arr, chunk
    try { arr = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8')); chunk = JSON.parse(fs.readFileSync(dir + '/' + f.replace('.out', ''), 'utf8')) } catch { continue }
    const cur = new Map(chunk.map((e) => [e.word, e]))
    for (const e of arr) {
      ent++
      const c = cur.get(e.word)
      // before 가 1 sense 인데 그 텍스트가 이미 복합(;·또는·, 다수) → 정상화 대상
      if (c && c.current.length === 1) {
        split1++
        const t = c.current[0].meaning || ''
        if (/[;·]|또는|,\s*\S+\s*,/.test(t)) compoundFix++
      }
      const gs = e.meanings_ko.map((m) => bg(m.meaning))
      let mx = 0, pair = null
      for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) { const v = jac(gs[i], gs[j]); if (v > mx) { mx = v; pair = [e.meanings_ko[i].meaning, e.meanings_ko[j].meaning] } }
      if (mx >= 0.5) { redun++; if (worst.length < 3) worst.push(e.word + ': "' + pair[0] + '" ≈ "' + pair[1] + '" (' + mx.toFixed(2) + ')') }
    }
  }
  rows.push({ 세션: 'S' + s, 엔트리: ent, '중복sense(≥0.5)': redun, '중복률': ent ? (redun / ent * 100).toFixed(1) + '%' : '-', 'before=1sense': split1, '└복합뭉침(정상화대상)': compoundFix })
  if (worst.length) console.log('S' + s + ' 중복 예: ' + worst.join(' / '))
}
console.table(rows)
