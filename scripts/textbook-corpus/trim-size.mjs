// scripts/textbook-corpus/trim-size.mjs
//
// **시중 교재의 완성 판형(trim size)을 잰다.**
//
// 왜 필요한가 — `scripts/textbook/render-volume.mjs` 의 `@page` 는 오래도록 188×257mm
// (4×6배판)를 쓰면서 주석에 이렇게 적어 두었다: *"이 값은 업계 표준값이지 우리 코퍼스 실측이
// 아니다. 79종 PDF 는 이 기계에 없다."* 그 판단은 2026-09-01 것이고, **같은 날 원본이
// 옮겨졌다** — `manifest.json` 의 `sources[0].$note` 가 `Documents/시중교재` →
// `Documents/영어/시중교재` 이동을 기록하고 있다. 경로만 바뀐 것이라 지금은 잴 수 있다.
//
// 판형은 **눈에 먼저 보이는 우위**다. 같은 매대에서 우리 책이 29% 작으면 내용을 펴 보기 전에
// 진다. 그런데 벤치마크 7축은 전부 내용 축이라 이 차이를 **한 번도 안 봤다**.
//
// ── 어느 상자를 읽는가 ────────────────────────────────────────────────
// PDF 는 쪽 크기를 여러 상자로 갖는다. 우선순위가 있다:
//   · **TrimBox** — 재단 뒤 **완성 판형**. 있으면 이것이 답이다.
//   · CropBox    — 보이는 영역. TrimBox 가 없을 때 다음으로 가깝다.
//   · MediaBox   — 재단여백(bleed)·재단선을 **포함한** 인쇄용 크기. 완성 판형보다 크다.
// 파일명에 「재단선 X」가 붙은 것이 실제로 있어서 이 구분이 값을 바꾼다.
//
// ⚠️ **못 잰 것을 0 이나 평균으로 채우지 않는다.** 객체 스트림이 압축된 PDF 는 정규식으로
//    상자가 안 잡힌다(실측 27종 중 5종). 그 문서는 분모에서 빼고 `unreadable` 로 센다 —
//    억지로 채우면 최빈값이 조용히 틀어진다.
//
// ── 쓰는 법 ──────────────────────────────────────────────────────────
//   node scripts/textbook-corpus/trim-size.mjs            # 재고 훑고 리포트 출력
//   node scripts/textbook-corpus/trim-size.mjs --write    # docs/reports 에 저장
//
// 재실행 안전 — 읽기만 한다. 원본은 저작권이 존속하는 상업 교재라 **저장소에 아무 본문도
// 남기지 않는다**(쪽 크기와 파일명만 리포트에 들어간다).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')

/** 코퍼스 매니페스트가 원본 뿌리를 알고 있다 — 경로를 여기 하드코딩하면 또 낡는다. */
const STORE = process.env.TEXTBOOK_CORPUS_STORE ?? 'd:/workspace/textbook-corpus'

/**
 * **매니페스트가 대상 목록의 정본이다.** 폴더를 직접 훑으면 두 가지가 틀어진다 —
 * zip 안에 전개된 문서를 못 찾고(실측: 27 vs 74), 수능 기출 시험지가 섞인다.
 * 기출은 **A3(297×420) 시험지**라 교재 판형의 최빈값을 통째로 끌고 간다.
 */
function targetDocs() {
  const mp = join(STORE, 'manifest.json')
  if (!existsSync(mp)) {
    throw new Error(
      `코퍼스 매니페스트가 없다: ${mp}\n` +
        '먼저 scripts/textbook-corpus/scan.mjs 를 돌리거나 TEXTBOOK_CORPUS_STORE 를 지정한다.',
    )
  }
  const m = JSON.parse(readFileSync(mp, 'utf8'))
  const docs = Array.isArray(m.docs) ? m.docs : Object.values(m.docs)
  return {
    manifestAt: m.generatedAt ?? null,
    total: docs.length,
    // 기출은 시험지지 교재가 아니다. PDF 가 아니면 쪽 크기가 없다(txt·html·hwp).
    picked: docs.filter((d) => d.ext === 'pdf' && d.category !== '기출' && d.absPath),
  }
}

const PT_TO_MM = 25.4 / 72
const mm = (pt) => Math.round(pt * PT_TO_MM)

/**
 * 이름 붙은 상자를 전부 긁는다. PDF 파서를 붙이지 않는 이유: 우리가 원하는 것은 쪽 크기
 * **하나**이고, 상자는 압축되지 않은 사전(dictionary)에 평문으로 있는 경우가 대부분이다.
 * 안 잡히는 문서는 세어서 `unreadable` 로 낸다 — 그게 파서를 붙일 근거가 된다.
 */
function boxes(raw, name) {
  const out = []
  const re = new RegExp(
    `/${name}\\s*\\[\\s*(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*\\]`,
    'g',
  )
  let m
  while ((m = re.exec(raw))) {
    const w = Math.abs(Number(m[3]) - Number(m[1]))
    const h = Math.abs(Number(m[4]) - Number(m[2]))
    // 200pt(≈70mm) 미만은 쪽이 아니고(썸네일·스탬프), 2000pt(≈706mm) 초과는 단위가 깨진 파일이다.
    if (w > 200 && h > 200 && w < 2000 && h < 2000) out.push([w, h])
  }
  return out
}

function modalSize(list) {
  const t = new Map()
  for (const [w, h] of list) {
    const k = `${mm(w)}x${mm(h)}`
    t.set(k, (t.get(k) ?? 0) + 1)
  }
  return [...t.entries()].sort((a, b) => b[1] - a[1])[0]
}

const { picked, total, manifestAt } = targetDocs()
if (picked.length === 0) {
  console.error('잴 문서가 없다 — 매니페스트에 교재 PDF 가 0종이다.')
  process.exit(1)
}
const files = picked.map((d) => d.absPath)

const byPath = new Map(picked.map((d) => [d.absPath, d]))
const docs = []
for (const f of files) {
  const meta = byPath.get(f)
  let raw
  try {
    raw = readFileSync(f).toString('latin1')
  } catch (e) {
    docs.push({ file: basename(f), source: null, reason: `읽기 실패: ${e.message}` })
    continue
  }
  let hit = null
  for (const name of ['TrimBox', 'CropBox', 'MediaBox']) {
    const b = boxes(raw, name)
    if (b.length) {
      const [size, n] = modalSize(b)
      hit = {
        file: basename(f),
        category: meta?.category ?? null,
        role: meta?.role ?? null,
        source: name,
        size,
        boxes: b.length,
        modalCount: n,
      }
      break
    }
  }
  docs.push(
    hit ?? {
      file: basename(f),
      category: meta?.category ?? null,
      role: meta?.role ?? null,
      source: null,
      reason: '상자 없음 — 객체 스트림 압축(파서 필요)',
    },
  )
}

const measured = docs.filter((d) => d.size)
const tally = new Map()
for (const d of measured) tally.set(d.size, (tally.get(d.size) ?? 0) + 1)
const dist = [...tally.entries()]
  .map(([size, docs]) => ({ size, docs }))
  .sort((a, b) => b.docs - a.docs || a.size.localeCompare(b.size))

/** 분류별로도 낸다 — 독해 교재의 판형과 어휘·구문 교재의 판형이 다를 수 있다. */
const byCategory = new Map()
for (const d of measured) {
  const k = d.category ?? '미분류'
  if (!byCategory.has(k)) byCategory.set(k, new Map())
  const t = byCategory.get(k)
  t.set(d.size, (t.get(d.size) ?? 0) + 1)
}

/**
 * 현재 조판이 쓰는 값 — **조판기에서 읽는다.** 여기 숫자를 또 적으면 둘이 갈라지고,
 * 갈라진 순간 이 리포트는 "시중과 얼마나 다른가" 를 틀리게 말한다.
 */
function currentPageSize() {
  const rp = join(REPO, 'scripts', 'textbook', 'render-volume.mjs')
  const m = readFileSync(rp, 'utf8').match(/@page\{size:(\d+)mm\s+(\d+)mm/)
  if (!m) throw new Error(`조판기의 @page 를 못 읽었다: ${rp}`)
  return { w: Number(m[1]), h: Number(m[2]), from: rp }
}
const CURRENT = currentPageSize()
const [mw, mh] = (dist[0]?.size ?? '0x0').split('x').map(Number)
const areaRatio = mw && mh ? (mw * mh) / (CURRENT.w * CURRENT.h) : null

const report = {
  $schema: 'textbook-trim-size/1',
  generatedAt: new Date().toISOString(),
  provenance: {
    manifest: join(STORE, 'manifest.json'),
    manifestAt,
    corpusDocuments: total,
    rule: 'TrimBox > CropBox > MediaBox. 문서마다 최빈 쪽 크기 하나만 센다.',
    selection: "ext=pdf 이고 category≠기출 — 기출은 A3 시험지라 교재 판형을 끌고 간다",
    privacy: '원본 본문은 담지 않는다 — 쪽 크기와 파일명·분류만.',
  },
  documentsFound: files.length,
  documentsMeasured: measured.length,
  documentsUnreadable: docs.length - measured.length,
  modal: dist[0] ?? null,
  distribution: dist,
  byCategory: [...byCategory].map(([category, t]) => ({
    category,
    modal: [...t.entries()].sort((a, b) => b[1] - a[1])[0][0],
    distribution: [...t.entries()].map(([size, docs]) => ({ size, docs })).sort((a, b) => b.docs - a.docs),
  })),
  current: CURRENT,
  areaRatioModalOverCurrent: areaRatio == null ? null : Number(areaRatio.toFixed(3)),
  docs,
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n시중 교재 판형 실측 — 코퍼스 ${total}종 중 교재 PDF ${files.length}종, 그중 ${measured.length}종을 쟀다\n`)
for (const d of docs) {
  console.log(` ${pad(d.size ?? '—', 10)} ${pad(d.category ?? '?', 5)} ${pad(d.source ?? d.reason, 32)} ${d.file.slice(0, 44)}`)
}
console.log('\n분류별 최빈:')
for (const [cat, t] of byCategory) {
  const top = [...t.entries()].sort((a, b) => b[1] - a[1])
  console.log(`  ${pad(cat, 6)} ${pad(top[0][0], 10)} ${top[0][1]}/${[...t.values()].reduce((a, b) => a + b, 0)}종`)
}
console.log('\n완성 판형 분포:')
for (const r of dist) console.log(`  ${pad(r.size, 10)} ${r.docs}종`)
console.log(
  `\n최빈 ${report.modal?.size ?? '—'} · 현재 조판 ${CURRENT.w}x${CURRENT.h} (render-volume.mjs 에서 읽음)`,
)
if (areaRatio != null) {
  // 1% 안쪽이면 같은 판형으로 본다 — mm 반올림 때문에 소수점이 남는다.
  const same = Math.abs(areaRatio - 1) < 0.01
  console.log(
    same
      ? '✔ 조판 판형이 시중 최빈과 같다.'
      : areaRatio > 1
        ? `⚠️ 시중이 면적으로 ${((areaRatio - 1) * 100).toFixed(0)}% 크다 — 같은 매대에서 우리 책이 작아 보인다.`
        : `우리 판형이 시중 최빈보다 ${((1 / areaRatio - 1) * 100).toFixed(0)}% 크다.`,
  )
}
if (report.documentsUnreadable > 0) {
  console.log(
    `\n⚠️ ${report.documentsUnreadable}종은 못 쟀다(객체 스트림 압축). **분모에서 뺐다** — ` +
      '0 으로 채우면 최빈값이 조용히 틀어진다. 이 수가 커지면 진짜 PDF 파서를 붙일 때다.',
  )
}

if (process.argv.includes('--write')) {
  const out = join(REPO, 'docs', 'reports', 'textbook-trim-size.json')
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  console.log(`\n→ ${out}`)
}
