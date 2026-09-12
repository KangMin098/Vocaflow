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
/**
 * `--prune` — **지문 자체가 죽은 청크를 `_stale/` 로 옮긴다.**
 *
 * ⚠️ 왜 필요한가 (실측 2026-09-08): 청크는 게이트보다 오래 산다. `topic-v7` 을 재 보니
 *   **8/30 수출분은 지문 통과율 7%(10/140)** 이고 **9/7 수출분은 100%(24/24)** 였다.
 *   그 8/30 청크들은 집필자가 아무리 잘해도 한 문항도 못 낸다 — 그런데 계수기에는
 *   「지금 시작 가능한 몫」으로 잡히고, 감사에는 「막힌 것」으로 영영 남는다.
 *   고쳐진 문제가 화면에 영영 남으면 **화면 전체를 아무도 안 믿게 된다.**
 *
 * **지우지 않고 옮긴다** — 되돌릴 수 있어야 한다. 그리고 옮기는 조건은
 * **집필로는 절대 못 고치는 사유**뿐이다(껍데기·논문 서식·민감 소재·어수 규격 밖).
 * 해설이나 선택지로 고칠 수 있는 것은 건드리지 않는다.
 */
const PRUNE = process.argv.includes('--prune')

const { checkDrainItem } = await import('@vocaflow/library-pipeline')

/** 해설이 걸린 사유인가 — 첫 판정이 여기서 멈췄다는 뜻일 뿐이다. */
const RATIONALE_REASON = /근거에 지문의 영어를 인용|근거가 왜 나머지가 아닌지|근거가 비었거나/

/**
 * **해설만 고치면 정말 살아나는가 — 고쳐 보고 다시 잰다.**
 *
 * ⚠️ 처음에는 「사유가 해설이면 해설만 고치면 된다」고 셌다. **틀렸다.**
 *   `checkDrainItem` 은 검사를 **순서대로 하고 첫 실패에서 반환**하므로, 해설 사유는
 *   「해설이 첫 관문이었다」는 뜻이지 「해설이 유일한 관문」이라는 뜻이 아니다.
 *
 *   실측 2026-09-08: 그 셈을 믿고 회수 배치 둘을 돌렸더니 한쪽은 46칸 중 39칸이 살았지만
 *   다른 쪽은 **44칸 중 16칸만** 살았다 — 나머지 28칸은 해설을 고치자 그 뒤에 있던
 *   **지문 어수 위반**이 드러났다(169~200어, 규격 90~154). 계기가 회수 비용을 두 배 넘게
 *   낮춰 말하고 있었던 것이다.
 *
 *   그래서 사유를 보고 짐작하지 않고 **합격하는 해설을 만들어 끼운 뒤 다시 판정한다.**
 *   그래도 걸리면 해설이 문제가 아니다.
 */
function wouldPassWithGoodRationale(row, type, band) {
  const passage = String(row.passage_edited ?? row.passage ?? '')
  // 게이트가 요구하는 「4자 이상 영단어 둘이 거의 붙은 자리」를 지문에서 실제로 찾는다.
  const quote = passage.match(/[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/)
  // 인용할 자리가 지문에 아예 없으면 해설로는 못 고친다 — 그것도 사실이다.
  if (!quote) return false
  const probe = `글은 "${quote[0]}" 라고 말한다. 나머지 넷은 그 방향이 아니다.`
  return checkDrainItem({ ...row, rationale_ko: probe }, type, band).ok
}

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
      // 사유가 해설이어도 **고쳐 보고 통과할 때만** 싼 회수로 센다.
      if (RATIONALE_REASON.test(v.reason) && wouldPassWithGoodRationale(r, type, band)) {
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

if (PRUNE) {
  const { hasArticleChrome, hasAcademicApparatus, hasSensitiveTopic, itemWordSpec } = await import(
    '@vocaflow/library-pipeline'
  )
  /** 집필로는 절대 못 고치는 지문인가. 고칠 수 있는 사유는 여기 넣지 않는다. */
  const deadPassage = (row, type, band) => {
    const t = String(row?.passage ?? '')
    if (!t.trim()) return true
    if (hasArticleChrome(t) || hasAcademicApparatus(t) || hasSensitiveTopic(t)) return true
    const spec = itemWordSpec(type, band)
    const words = t.split(/\s+/).filter(Boolean).length
    if (spec.max <= 0) return false
    // ⚠️ 빈칸 유형만 예외 — 구절을 `____` 로 바꾸며 몇 어가 줄어든다. 실측상 3~8어라
    //   여유를 10어 준다. 그 밖의 유형은 지문을 못 고치므로 창 밖이면 그대로 죽은 것이다.
    const slack = type === 'blank' ? 10 : 0
    return words < spec.min || words > spec.max + slack
  }
  let movedChunks = 0
  let movedItems = 0
  for (const d of fs.readdirSync(BASE)) {
    const p = path.join(BASE, d)
    if (!fs.statSync(p).isDirectory()) continue
    const m = /^(.+)-v(\d+)$/.exec(d)
    if (!m) continue
    const [, type, bandStr] = m
    const band = Number(bandStr)
    for (const f of fs.readdirSync(p).filter((x) => /^chunk-\d+\.json$/.test(x))) {
      let rows
      try {
        rows = JSON.parse(fs.readFileSync(path.join(p, f), 'utf8'))
      } catch {
        continue
      }
      if (!Array.isArray(rows) || !rows.length) continue
      if (!rows.every((r) => deadPassage(r, type, band))) continue
      const stale = path.join(p, '_stale')
      fs.mkdirSync(stale, { recursive: true })
      for (const name of [f, f.replace('.json', '.out.json')]) {
        const from = path.join(p, name)
        if (fs.existsSync(from)) fs.renameSync(from, path.join(stale, name))
      }
      movedChunks += 1
      movedItems += rows.length
      console.log(`    옮김  ${d}/${f}  (${rows.length}편 전부 지문이 죽었다)`)
    }
  }
  console.log(
    `\n  **죽은 청크 ${movedChunks}개 · 문항칸 ${movedItems}개를 \`_stale/\` 로 옮겼다.**\n` +
      '  지운 것이 아니다 — 되돌리려면 파일을 상위 폴더로 옮기면 된다.\n' +
      '  같은 원글은 다음 export 에서 지금 규격의 지문으로 다시 나온다(중복 판정은 DB 를 본다).',
  )
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
