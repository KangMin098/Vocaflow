// scripts/csat/argsme-regen-import.mts
//
// **재생성 결과를 `chunk-NNN.out.json` 에 되돌려 넣는다.**
//
// 짝은 **id + sha256** 으로 맞춘다 — 배열 위치로 맞추지 않는다(경계가 두 번 바뀌었다).
// 빈 값·너무 짧은 값은 **넣지 않고 건너뛴 수를 찍는다**: 빈 값이 들어가면 구멍이 영영 남고,
// 게이트는 통과 항목만 세므로 조용히 사라진다.
//
// 재실행 안전: 같은 입력으로 다시 돌리면 같은 결과가 된다(덮어쓰기, 누적 없음).
//
// 사용:
//   pnpm exec tsx scripts/csat/argsme-regen-import.mts            # dry-run
//   pnpm exec tsx scripts/csat/argsme-regen-import.mts --commit

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'scripts/csat/argsme-drain'
const REGEN = join(DIR, 'regen')
const COMMIT = process.argv.includes('--commit')

let applied = 0
let skippedEmpty = 0
let skippedShort = 0
let unmatched = 0
const perFile: string[] = []

for (const f of readdirSync(REGEN).filter((x) => /^chunk-\d+\.regen\.json$/.test(x)).sort()) {
  const chunk = f.slice(6, 9)
  const outPath = join(DIR, `chunk-${chunk}.out.json`)
  if (!existsSync(outPath)) { console.log(`건너뜀 — ${outPath} 이 없다`); continue }

  const regen = JSON.parse(readFileSync(join(REGEN, f), 'utf8'))
  const out = JSON.parse(readFileSync(outPath, 'utf8'))

  const byId = new Map<string, Record<string, unknown>>()
  for (const it of out.items ?? []) byId.set(String(it.id), it)

  let n = 0, e = 0, s = 0, u = 0
  for (const r of regen.items ?? []) {
    const target = byId.get(String(r.id))
    if (!target || String(target.sha256) !== String(r.sha256)) { u++; continue }

    // 재생성하다 「지문으로 부적절」이라고 판단한 것은 skip 으로 받는다.
    // 이 경우 낡은 지문을 그대로 두면 안 된다 — 게이트가 계속 걸고, 고칠 대상이 아닌데
    // 매번 재생성 목록에 다시 뜬다. 지문을 비우고 사유를 남긴다.
    if (String(r.verdict ?? '') === 'skip') {
      const reason = String(r.skip_reason ?? '').trim()
      if (!reason) { e++; continue }
      target.verdict = 'skip'
      target.skip_reason = reason
      target.passage = ''
      n++
      continue
    }

    const passage = String(r.passage ?? '').trim()
    if (!passage) { e++; continue }
    // 140어 아래는 넣지 않는다 — 기준(140~200) 밖이고, 짧은 값이 들어가면
    // 게이트에서 「길이」로만 걸려 **왜 짧은지**가 사라진다.
    if ((passage.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length < 140) { s++; continue }

    target.passage = passage
    if (String(r.claim ?? '').trim()) target.claim = String(r.claim).trim()
    if (String(r.topic_ko ?? '').trim()) target.topic_ko = String(r.topic_ko).trim()
    target.verdict = 'write'
    delete target.skip_reason
    n++
  }

  applied += n; skippedEmpty += e; skippedShort += s; unmatched += u
  perFile.push(`  ${chunk}  적용 ${String(n).padStart(3)}  빈값 ${e}  짧음 ${s}  짝없음 ${u}`)

  if (COMMIT && n) writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
}

console.log(perFile.join('\n'))
console.log(
  `\n${COMMIT ? '적용' : 'dry-run'} — 반영 ${applied}편 · 건너뜀(빈값 ${skippedEmpty} · 짧음 ${skippedShort} · 짝없음 ${unmatched})`,
)
if (!COMMIT) console.log('실제로 쓰려면 --commit')
else console.log('다음: pnpm exec tsx scripts/csat/argsme-gate.mts')
