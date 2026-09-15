// scripts/textbook/item-fill-plan.mjs
//
// **권수를 목표까지 올리려면 무엇을 얼마나 더 써야 하는가.**
//
// ── 왜 따로 필요한가 ─────────────────────────────────────────────────
// `type-inventory-scan.mjs` 는 **지금 몇 권인가**를 답한다. 그런데 그걸 보고 나면 바로
// 다음 질문이 온다 — **그래서 무엇부터 하나.** 그 답을 손으로 세면 매번 다르게 센다.
//
// 실측 2026-09-08 이 이 도구를 만들게 했다. 재고표를 눈으로 보고 "빈칸·제목·주제 셋이
// 병목" 이라고 적었는데, 계산해 보니 병목은 **생성형 유형 전부**였다:
//
//   결정론 유형(순서·어법·어휘)  → 이미 **수천 권** 분량
//   생성형 유형(제목·주제·빈칸·   → 밴드마다 **0~2권**
//                내용일치·주장·심경)
//
// 한 권은 가장 얇은 유형이 정하므로, 22만 개 쌓인 `blank_word` 는 권수를 1도 못 올린다.
// **올리는 것은 오직 사람이 글을 읽고 쓰는 유형뿐이다.**
//
// ── 무엇을 세는가 ────────────────────────────────────────────────────
// 밴드 × 유형마다 `목표권수 × 권당필요 - 재고` 를 낸다. 그 유형이
// **드레인 유형(글을 읽어야 만든다)** 이면 청크 수로 환산하고, 결정론 유형이면
// 생성기를 돌리면 된다고 갈라 적는다. 둘은 비용이 100배 다르다 — 섞으면 계획이 아니다.
//
// ⚠️ 목표 비중을 여기서 정하지 않는다 — `rungMix` 한 벌이 정본이다.
// ⚠️ 재고는 스냅샷에서 읽는다 — DB 를 두 번 세지 않는다. 스냅샷이 낡았으면
//   `type-inventory-scan.mjs` 를 먼저 돌리라고 말한다.
//
// 재실행 안전: **읽기만 한다.** DB 도 안 본다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-fill-plan.mjs                # 5권 목표
//   pnpm dlx tsx scripts/textbook/item-fill-plan.mjs --volumes 10
//   pnpm dlx tsx scripts/textbook/item-fill-plan.mjs --export-cmds  # 뽑기 명령까지

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const TARGET = Number(arg('volumes') ?? 5)
const SHOW_CMDS = process.argv.includes('--export-cmds')
const ITEMS_PER_CHUNK = Number(arg('size') ?? 8)

const SNAPSHOT = path.resolve('apps/web/src/lib/textbook/type-inventory-snapshot.json')
const OUT = path.resolve('apps/web/src/lib/textbook/item-fill-plan.json')
const DRAIN_DIR = path.resolve('scripts/textbook/item-drain')

if (!fs.existsSync(SNAPSHOT)) {
  console.error('재고 스냅샷이 없다. 먼저: pnpm dlx tsx scripts/textbook/type-inventory-scan.mjs')
  process.exit(1)
}
const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))

/**
 * 글을 읽어야 만들 수 있는 유형 — **정본은 `item-drain-export.mjs` 의 `TYPES`** 다.
 * 사본을 두면 갈리므로 그 파일에서 읽는다. 거기 없는 유형은 결정론 생성기 소관이다.
 */
function drainTypes() {
  const src = fs.readFileSync(path.resolve('scripts/textbook/item-drain-export.mjs'), 'utf8')
  const keys = [...src.matchAll(/^ {2}([a-z_]+): \{$/gm)].map((m) => m[1])
  if (keys.length < 5) throw new Error('item-drain-export.mjs 에서 유형 목록을 못 읽었다 — 형식이 바뀌었다')
  return new Set(keys)
}
const DRAIN = drainTypes()

/**
 * **유형별 집필 수율** — 뽑아 준 지문 중 실제로 문항이 된 비율.
 *
 * ⚠️ 몫만큼만 뽑으면 **모자란다.** 실측 2026-09-15(채운 청크 기준 · 뽑아 준 지문 1,762):
 *   `claim` **35.7%** · `mood` 51.9% · `purpose` 73.2% · `topic` 78.2% ·
 *   `blank` 92.6% · `content_match` 97.4% · 장문 4종 100%.
 *   즉 주장 5문항이 필요하면 **14편쯤 뽑아야** 한다.
 *
 *   낮은 수율의 원인은 지문 품질이 아니다 — 집필 배치 둘이 독립으로 확인했다.
 *   `claim` 은 지문 16/16 이 게이트를 통과했는데도 11편이 **「당위가 없는 글」**이라 빠졌고,
 *   `mood` 는 24/24 가 통과했는데 14편이 **정서 변화가 없어** 빠졌다. 뽑기에 유형-갈래
 *   판정이 없다는 뜻이다.
 *   ⚠️ **그 판정을 규칙으로 만들지는 않았다.** 사람 판정 라벨(claim 16 · mood 24)로
 *   당위구문·정서어 밀도를 재 봤더니 정확도가 기저(「전부 뺀다」)보다 6~13pp 나을 뿐이었고
 *   문턱도 같은 데이터에서 고른 것이라 과적합이다. **못 가르는 지표로 재고를 버리지 않는다.**
 *   대신 **몇 배 뽑아야 하는지**만 계획에 싣는다 — 이건 관측이라 틀릴 여지가 없다.
 *
 * 표본이 적은 유형은 배수를 믿을 수 없어 1배로 둔다.
 */
const YIELD_MIN_SAMPLE = 20
/** 배수 상한 — 수율이 아주 낮게 관측돼도 한 번에 이만큼만 뽑는다. */
const YIELD_MAX_MULT = 4

function writeYield() {
  const out = new Map()
  for (const d of fs.readdirSync(DRAIN_DIR)) {
    const p = path.join(DRAIN_DIR, d)
    if (!fs.statSync(p).isDirectory()) continue
    const m = /^(.+)-v(\d+)$/.exec(d)
    if (!m) continue
    const type = m[1]
    for (const f of fs.readdirSync(p).filter((x) => /^chunk-\d+\.json$/.test(x))) {
      const outFile = path.join(p, f.replace('.json', '.out.json'))
      // **채운 청크만 센다** — 안 채운 것은 수율이 아니라 밀린 일이다.
      if (!fs.existsSync(outFile)) continue
      let src
      let done
      try {
        src = JSON.parse(fs.readFileSync(path.join(p, f), 'utf8'))
        done = JSON.parse(fs.readFileSync(outFile, 'utf8'))
      } catch {
        continue
      }
      if (!Array.isArray(src) || !Array.isArray(done)) continue
      if (!out.has(type)) out.set(type, { offered: 0, written: 0 })
      const c = out.get(type)
      c.offered += src.length
      c.written += done.filter((r) => Array.isArray(r?.choices) && r.choices.length).length
    }
  }
  return out
}
const YIELD = writeYield()

/** 그 유형의 몫을 채우려면 몇 배를 뽑아야 하는가. 관측이 모자라면 1배. */
function exportMultiplier(type) {
  const c = YIELD.get(type)
  if (!c || c.offered < YIELD_MIN_SAMPLE || c.written === 0) return 1
  return Math.min(YIELD_MAX_MULT, +(c.offered / c.written).toFixed(1))
}

// 규격의 정본은 파이프라인 패키지 한 벌이다 — 사본을 두면 계획과 적재가 다른 자를 쓴다.
const { itemWordSpec, hasArticleChrome } = await import('@vocaflow/library-pipeline')

/**
 * 그 칸에서 **지금 집필할 수 있는 몫**.
 *
 * ⚠️ **`.out.json` 이 있다고 다 채운 것이 아니다.** 실측 2026-09-08: out 파일 225개의
 *   문항칸 1,419 중 **116칸이 빈 채**였고(반쯤 채운 파일 42개), `mood-v3` 는 out.json 이
 *   **16칸 전부 빈 채**로 존재했다. 예전 배치가 청크당 3건만 채우고 멈춘 자국이다.
 *
 *   파일 존재로 세면 그 116칸은 **모든 계수기에 「완료」로 보인다** — export 는 다시 안 뽑고
 *   (그 원글에 문항이 없으니 후보로는 남지만 청크는 이미 있다), import 는 조용히 건너뛰고,
 *   계획은 「할 일 없음」이라 말한다. CLAUDE.md §🤖 가 경고한 그 구멍이 실제로 뚫려 있었다.
 *
 *   그래서 **파일이 아니라 칸을 센다.**
 */
/**
 * 뽑혀 있는 청크가 **지금 규격으로도 쓸 수 있는가.**
 *
 * ⚠️ 청크 파일은 게이트보다 오래 산다. 실측 2026-09-08, 집필 배치 둘이 같은 것을 보고했다:
 *   · `topic-v2` — 32편 중 **10편(31%)이 V2 인쇄 규격(90~121어) 밖**이었다. 그 청크들은
 *     8/31 16:56 에 뽑혔고, 밴드별 어수창(`itemWordSpec`)을 쓰도록 고친 것이 바로 그날이다.
 *     그 전에는 밴드와 무관하게 90~200어로 뽑았다.
 *   · `title-v5` — 40편 중 **8편(20%)에 기사 껍데기**가 남아 있었다(`N min read`·`Credits:`·
 *     PLOS 앞장). `hasArticleChrome` 게이트가 청크보다 나중에 생겼다.
 *
 * 이걸 안 재면 계획이 **없는 일감을 있다고 센다** — 집필자가 다 쓴 뒤 적재에서 버려진다.
 * 그래서 「지금 시작 가능」을 셀 때 **쓸 청크만 실제로 열어 본다**(전량을 열면 1,400개짜리
 * 폴더에서 느려진다 — 집필자가 고르는 순서대로 필요한 만큼만 본다).
 */
function usableItems(dir, chunkFile, type, band) {
  let rows
  try {
    rows = JSON.parse(fs.readFileSync(path.join(dir, chunkFile), 'utf8'))
  } catch {
    return { total: 0, stale: 0 }
  }
  if (!Array.isArray(rows)) return { total: 0, stale: 0 }
  const spec = itemWordSpec(type, band)
  let stale = 0
  for (const r of rows) {
    const passage = String(r?.passage ?? '')
    const words = passage.split(/\s+/).filter(Boolean).length
    if (hasArticleChrome(passage) || (spec.max > 0 && (words < spec.min || words > spec.max))) stale += 1
  }
  return { total: rows.length, stale }
}

/**
 * 청크 하나에서 **죽은 칸이 이 비율을 넘으면 「지금 시작 가능」으로 세지 않는다.**
 *
 * 실측 2026-09-13 이 이 문턱을 정했다 — 안 채운 청크 6,869개 중 죽은 비율별 분포:
 *   50~99% **2,939개** · 25~49% 2,683개 · 1~24% 695개 · 0% **552개**
 * 그리고 집필 배치들이 독립으로 같은 것을 보고했다:
 *   `main_point-v7` 8월분 **12.5%** 생존 · `topic-v7` 8월분 **10%** · 9월분 **100%**
 * 4분의 1까지는 집필 중에 흡수되지만 그 위는 몫을 잘못 잡게 만든다.
 */
const CLEAN_MAX_STALE = 0.25

function freeSlots(type, band, wantChunks) {
  const dir = path.join(DRAIN_DIR, `${type}-v${band}`)
  if (!fs.existsSync(dir))
    return { untouchedChunks: 0, unfinishedItems: 0, unfinishedFiles: 0, staleItems: 0, checkedItems: 0 }
  const files = fs.readdirSync(dir)
  const chunks = files.filter((f) => /^chunk-\d+\.json$/.test(f)).sort()
  let untouchedChunks = 0
  let unfinishedItems = 0
  let unfinishedFiles = 0
  let staleItems = 0
  let checkedItems = 0
  let inspected = 0
  /** 뽑혀 있으나 죽은 칸이 너무 많아 세지 않은 청크 — 다시 뽑아야 하는 몫이다. */
  let dirtyChunks = 0
  for (const f of chunks) {
    const out = path.join(dir, f.replace('.json', '.out.json'))
    if (!fs.existsSync(out)) {
      // ⚠️ **「안 채운 청크」와 「쓸 만한 청크」는 다르다** (실측 2026-09-13).
      //   안 채운 청크 6,869개의 문항칸 57,253 중 **23,200(40.5%)이 이미 죽어 있다** —
      //   청크는 게이트보다 오래 살고, 8/31 수출분은 그 뒤에 넓어진 논문 서식·어수 검사에
      //   걸린다. 깨끗한 청크는 **552개뿐**이다.
      //   그래서 집필자가 아무 청크나 집으면 노력의 40%를 잃는다. 실제로 그렇게 됐다:
      //   V6 집필 배치가 48편 중 22편(45.8%)을 지문 단계에서 버렸고, 사유는 전부 논문 서식이었다.
      //   **살아 있는 칸이 4분의 3 미만인 청크는 「지금 시작 가능」으로 세지 않는다** —
      //   그 몫은 다시 뽑는 편이 싸다(지금 export 는 `isPrintablePassage` 를 걸어 100% 깨끗하다).
      if (inspected < wantChunks) {
        const u = usableItems(dir, f, type, band)
        staleItems += u.stale
        checkedItems += u.total
        inspected += 1
        if (u.total > 0 && u.stale / u.total > CLEAN_MAX_STALE) {
          dirtyChunks += 1
          continue
        }
      }
      untouchedChunks += 1
      continue
    }
    let rows
    try {
      rows = JSON.parse(fs.readFileSync(out, 'utf8'))
    } catch {
      // 깨진 out 은 「안 쓴 것」으로 센다 — 못 읽는 것을 완료로 세면 그 몫이 사라진다.
      untouchedChunks += 1
      continue
    }
    if (!Array.isArray(rows)) {
      untouchedChunks += 1
      continue
    }
    const empty = rows.filter((r) => !Array.isArray(r?.choices) || r.choices.length === 0).length
    if (empty > 0) {
      unfinishedItems += empty
      unfinishedFiles += 1
    }
  }
  return { untouchedChunks, unfinishedItems, unfinishedFiles, staleItems, checkedItems, dirtyChunks }
}

const bands = []
for (const b of snap.bands) {
  const short = b.types
    .filter((t) => t.volumes < TARGET)
    .map((t) => {
      const items = t.needPerVolume * TARGET - t.items
      const drain = DRAIN.has(t.type)
      const chunks = drain ? Math.ceil(items / ITEMS_PER_CHUNK) : 0
      const slots = drain
        ? freeSlots(t.type, b.vLevel, chunks)
        : { untouchedChunks: 0, unfinishedItems: 0, unfinishedFiles: 0, staleItems: 0, checkedItems: 0, dirtyChunks: 0 }
      return {
        ...t,
        shortItems: items,
        drain,
        chunks,
        readyChunks: slots.untouchedChunks,
        /** 이미 뽑혀 있고 out 파일도 있는데 **칸이 빈 채**인 몫 — 아무도 안 세던 일. */
        unfinishedItems: slots.unfinishedItems,
        unfinishedFiles: slots.unfinishedFiles,
        /** 쓸 청크를 실제로 열어 보니 **지금 규격으로는 못 쓰는** 문항. */
        staleItems: slots.staleItems,
        checkedItems: slots.checkedItems,
        /** 뽑혀 있으나 죽은 칸이 4분의 1을 넘어 세지 않은 청크. */
        dirtyChunks: slots.dirtyChunks,
      }
    })
    .sort((a, b2) => b2.shortItems - a.shortItems)
  const d = short.filter((t) => t.drain)
  // ⚠️ **다 채운 밴드는 「채울 몫」이 아니다.** 목표에 닿은 밴드를 빈 줄로 남겨 두면
  //   할 일 목록에 다 끝난 칸이 섞여, 화면을 훑는 사람이 그 줄에서 무엇을 해야 하는지
  //   찾게 된다. 지금 몇 권인지는 위의 재고표가 이미 말한다 — 여기는 **남은 일만** 센다.
  //   (실측 2026-09-13: V3·V4 가 목표 5권에 닿자 회귀가 이 자리를 잡아냈다.)
  if (!short.length) continue
  bands.push({
    vLevel: b.vLevel,
    volumes: b.volumes,
    bindingType: b.bindingType,
    drainItems: d.reduce((n, t) => n + t.shortItems, 0),
    drainChunks: d.reduce((n, t) => n + t.chunks, 0),
    /** 지금 당장 집필을 시작할 수 있는 몫 — 이미 뽑혀 있는 **손 안 댄** 청크. */
    readyChunks: d.reduce((n, t) => n + Math.min(t.chunks, t.readyChunks), 0),
    /**
     * **반쯤 채우고 만 몫.** 파일이 있어 모든 계수기가 완료로 세지만 칸이 비어 있다.
     * 이 수가 0 이 아니면 그만큼의 일이 **이미 뽑혀 있는데 아무도 안 보고 있다.**
     */
    unfinishedItems: d.reduce((n, t) => n + t.unfinishedItems, 0),
    unfinishedFiles: d.reduce((n, t) => n + t.unfinishedFiles, 0),
    /** 쓸 청크를 열어 보니 지금 규격 밖인 문항 — 집필해도 적재에서 버려진다. */
    staleItems: d.reduce((n, t) => n + t.staleItems, 0),
    checkedItems: d.reduce((n, t) => n + t.checkedItems, 0),
    types: short,
  })
}

const pad = (s, w) => String(s).padEnd(w)
console.log(`\n목표 ${TARGET}권 — 무엇을 얼마나 더 써야 하는가 (재고 측정 ${snap.measuredAt.slice(0, 10)})\n`)
for (const b of bands) {
  if (!b.types.length) {
    console.log(`  V${b.vLevel}  이미 ${b.volumes}권 — 더 쓸 것 없다`)
    continue
  }
  console.log(
    `  V${b.vLevel}  ${b.volumes}권 → ${TARGET}권 · 집필 ${b.drainItems}문항(${b.drainChunks}청크) · ` +
      `그중 **지금 시작 가능 ${b.readyChunks}청크**`,
  )
  for (const t of b.types) {
    const mult = t.drain ? exportMultiplier(t.type) : 1
    const how = t.drain
      ? `집필 ${t.chunks}청크 (손 안 댄 청크 ${t.readyChunks}` +
        (t.unfinishedItems ? ` · **반쯤 채운 칸 ${t.unfinishedItems}**` : '') +
        (mult > 1.15 ? ` · 수율 ${(100 / mult).toFixed(0)}% → **${mult}배 뽑아야**` : '') +
        ')'
      : '결정론 생성기'
    console.log(`      ${pad(t.type, 16)} 재고 ${pad(t.items, 7)} +${pad(t.shortItems, 6)} ${how}`)
  }
}

const totalItems = bands.reduce((n, b) => n + b.drainItems, 0)
const totalChunks = bands.reduce((n, b) => n + b.drainChunks, 0)
const ready = bands.reduce((n, b) => n + b.readyChunks, 0)
const unfinished = bands.reduce((n, b) => n + b.unfinishedItems, 0)
const unfinishedFiles = bands.reduce((n, b) => n + b.unfinishedFiles, 0)
const stale = bands.reduce((n, b) => n + b.staleItems, 0)
const checked = bands.reduce((n, b) => n + b.checkedItems, 0)
console.log(`\n  합계 — 집필 ${totalItems}문항 = ${totalChunks}청크 · 그중 ${ready}청크는 이미 뽑혀 있다`)
console.log(`  ${totalChunks - ready}청크는 먼저 뽑아야 한다.`)
if (unfinished) {
  console.log(
    `\n  ⚠ **반쯤 채우고 만 칸 ${unfinished}개** (파일 ${unfinishedFiles}개) — out 파일이 있어 ` +
      `모든 계수기가 완료로 세지만 비어 있다. 이 몫은 뽑을 필요 없이 바로 채울 수 있다.`,
  )
}

if (SHOW_CMDS) {
  console.log('\n  뽑을 것 (모자란 만큼만):')
  for (const b of bands) {
    for (const t of b.types) {
      if (!t.drain) continue
      // ⚠️ **몫만큼 뽑으면 모자란다.** 뽑아 준 지문 중 문항이 되는 비율이 유형마다 다르다 —
      //   실측 `claim` 35.7% · `mood` 51.9% · `blank` 92.6%. 배수는 관측에서 나온다.
      const missing = Math.ceil((t.chunks - t.readyChunks) * exportMultiplier(t.type))
      if (missing <= 0) continue
      console.log(
        `    pnpm dlx tsx scripts/textbook/item-drain-export.mjs --type ${t.type} ` +
          `--band ${b.vLevel} --need ${missing * ITEMS_PER_CHUNK}`,
      )
    }
  }
}

if (stale) {
  console.log(
    `
  ⚠ **쓸 청크를 열어 보니 지금 규격 밖인 문항 ${stale} / ${checked}** (${((stale / checked) * 100).toFixed(1)}%) — ` +
      `청크 파일은 게이트보다 오래 산다. 집필해도 적재에서 버려지므로 그 칸은 다시 뽑는 편이 싸다.`,
  )
}

fs.writeFileSync(
  OUT,
  `${JSON.stringify({ computedAt: new Date().toISOString(), targetVolumes: TARGET, itemsPerChunk: ITEMS_PER_CHUNK, inventoryMeasuredAt: snap.measuredAt, totalItems, totalChunks, readyChunks: ready, unfinishedItems: unfinished, unfinishedFiles, staleItems: stale, checkedItems: checked, bands }, null, 2)}\n`,
)
console.log(`\n  → ${OUT}`)
console.log('\n  이 계획은 문항을 만들지 않는다 — 무엇을 만들어야 하는지만 센다.')
