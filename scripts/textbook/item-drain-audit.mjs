// scripts/textbook/item-drain-audit.mjs
//
// **이미 써 놓은 문항 중 지금 게이트에 걸려 못 싣는 것.**
//
// ── 왜 이 계기가 필요한가 (실측 2026-09-08) ─────────────────────────
// 게이트는 시간이 지나며 엄해진다 — 밴드별 어수창(8/31) · 기사 껍데기 차단(9/6) ·
// 해설 인용/오답 언급 요구가 차례로 들어왔다. 그런데 **청크와 산출은 게이트보다 오래 산다.**
// 그래서 어느 날 갑자기가 아니라 **조용히**, 예전에 쓴 문항이 적재에서 걸리기 시작한다.
//
// 처음 쟀을 때: 이미 채운 문항 **1,377 중 315(22.9%)** 가 지금 게이트에 걸렸다.
// 그리고 그 315가 한 덩어리가 아니었다 — **비용이 완전히 다른 둘**이 섞여 있었다:
//
//   · 해설만 고치면 되는 것 **142** (인용 없음 91 · 오답 언급 없음 51)
//     → 선택지·정답은 이미 검증됐다. **한국어 한 줄**이면 살아난다. 가장 싼 회수다.
//   · 지문이 문제인 것 **173** (규격 밖 151 · 기사 껍데기 22)
//     → 집필로는 못 고친다. 다시 뽑아야 한다(빈칸 유형만 예외 — 뚫으면서 줄일 수 있다).
//
// 둘을 한 수로 합치면 「315개를 다시 써야 한다」로 읽혀 아무도 손대지 않는다.
// **그래서 갈라 센다.**
//
// ⚠️ 규칙을 여기서 새로 짜지 않는다 — `item-gate.ts` 의 `checkDrainItem` 한 벌을 그대로
//   부른다. 사본을 두면 갈리고, 이 저장소는 그 실수를 이미 했다(없는 규칙으로 멀쩡한
//   요약 문항 넷을 다시 쓰게 했다).
//
// 재실행 안전: **읽기만 한다.** DB 도 안 보고 파일도 안 고친다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-drain-audit.mjs            # 요약
//   pnpm dlx tsx scripts/textbook/item-drain-audit.mjs --fixable  # 해설만 고치면 되는 것의 파일·칸 목록

import fs from 'node:fs'
import path from 'node:path'

const BASE = path.resolve('scripts/textbook/item-drain')
const SHOW_FIXABLE = process.argv.includes('--fixable')

const { checkDrainItem } = await import('@vocaflow/library-pipeline')

/**
 * 이 사유는 **해설만 고치면 살아나는가.**
 *
 * 선택지·정답·지문을 건드리지 않고 `rationale_ko` 한 칸만 다시 쓰면 통과하는 것들이다.
 * 지문 규격·기사 껍데기는 여기 들어가지 않는다 — 집필자가 지문을 못 고치기 때문이다
 * (빈칸 유형만 예외이고, 그건 다시 뽑는 편이 싸다).
 */
const RATIONALE_ONLY = /근거에 지문의 영어를 인용|근거가 왜 나머지가 아닌지|근거가 비었거나/

const reasons = new Map()
let filled = 0
let bad = 0
let fixable = 0
/** @type {{dir:string,file:string,idx:number,title:string,reason:string}[]} */
const fixList = []
/** @type {Map<string,{bad:number,filled:number,fixable:number}>} */
const byDir = new Map()

for (const d of fs.readdirSync(BASE)) {
  const p = path.join(BASE, d)
  if (!fs.statSync(p).isDirectory()) continue
  // ⚠️ **폴더 이름이 정본이다** — `--dir` 만 주고 기본값으로 판정했다가 요지 9문항이
  //   엉뚱한 유형·학년으로 적힌 일이 있다(2026-08-31). 여기서도 같은 규칙을 쓴다.
  const m = /^(.+)-v(\d+)$/.exec(d)
  if (!m) continue
  const [, type, bandStr] = m
  const band = Number(bandStr)
  const stat = { bad: 0, filled: 0, fixable: 0 }
  for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.out.json')).sort()) {
    let rows
    try {
      rows = JSON.parse(fs.readFileSync(path.join(p, f), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(rows)) continue
    rows.forEach((r, idx) => {
      // 빈 칸은 「걸린 것」이 아니라 「안 쓴 것」이다 — `item-fill-plan.mjs` 가 센다.
      if (!Array.isArray(r?.choices) || !r.choices.length) return
      filled += 1
      stat.filled += 1
      const v = checkDrainItem(r, type, band)
      if (v.ok) return
      bad += 1
      stat.bad += 1
      const key = v.reason.replace(/\d+/g, 'N')
      reasons.set(key, (reasons.get(key) ?? 0) + 1)
      if (RATIONALE_ONLY.test(v.reason)) {
        fixable += 1
        stat.fixable += 1
        fixList.push({ dir: d, file: f, idx, title: String(r.source_title ?? r.article_id ?? ''), reason: v.reason })
      }
    })
  }
  if (stat.bad) byDir.set(d, stat)
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0')
console.log(`\n이미 채운 문항 ${filled.toLocaleString()} · **지금 게이트에 걸리는 것 ${bad}** (${pct(bad, filled)}%)\n`)
console.log(`  해설만 고치면 되는 것        **${fixable}**  ← 선택지·정답은 이미 검증됐다`)
console.log(`  지문을 다시 뽑아야 하는 것    ${bad - fixable}`)

console.log('\n  이유별')
for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${k}`)
}

console.log('\n  칸별 (걸린 것 / 채운 것 · 그중 해설만)')
for (const [d, s] of [...byDir].sort((a, b) => b[1].bad - a[1].bad)) {
  console.log(`    ${d.padEnd(20)} ${String(s.bad).padStart(4)} / ${String(s.filled).padStart(4)}  해설만 ${s.fixable}`)
}

if (SHOW_FIXABLE) {
  console.log('\n  해설만 고치면 되는 것 — 파일과 칸 번호')
  const grouped = new Map()
  for (const r of fixList) {
    const key = `${r.dir}/${r.file}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(r.idx)
  }
  for (const [key, idxs] of [...grouped].sort()) {
    console.log(`    ${key}  칸 [${idxs.join(',')}]`)
  }
}

// ⚠️ 화면이 이 수를 읽는다 — **인자 없이도 스냅샷을 갱신한다.** 예전에 `--json` 을 줘야만
//   쓰게 해 뒀다가, 드레인을 돌린 뒤 화면이 조용히 어제 값을 계속 보인 일이 있었다.
//   터미널에만 보려면 `--no-write`.
if (!process.argv.includes('--no-write')) {
  const OUT = path.resolve('apps/web/src/lib/textbook/item-drain-audit-snapshot.json')
  const snapshot = {
    measuredAt: new Date().toISOString(),
    filled,
    blocked: bad,
    /** 해설 한 칸만 고치면 살아나는 몫 — 가장 싼 회수다. */
    rationaleOnly: fixable,
    /** 지문이 문제라 집필로는 못 고치는 몫 — 다시 뽑아야 한다. */
    passageBlocked: bad - fixable,
    reasons: [...reasons].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    byDir: [...byDir]
      .sort((a, b) => b[1].bad - a[1].bad)
      .map(([dir, s]) => ({ dir, blocked: s.bad, filled: s.filled, rationaleOnly: s.fixable })),
  }
  fs.writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`\n  → ${OUT}`)
}

console.log('\n  이 감사는 아무것도 고치지 않는다 — 무엇이 걸려 있는지만 센다.')
