import fs from 'node:fs'; import path from 'node:path'
const DIR = 'scripts/dict/sc-v5_6'
const out = []
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8')) } catch { continue }
  if (!Array.isArray(arr)) continue
  for (const e of arr) if (e && Array.isArray(e.meanings_ko) && e.meanings_ko.length===1) out.push({word:e.word, pos:e.meanings_ko[0].pos, meaning:e.meanings_ko[0].meaning})
}
console.log('single-POS (length-1) corrections in current outputs:', out.length)
for (const e of out) console.log(' ', e.word, '→', e.pos, '|', e.meaning)
