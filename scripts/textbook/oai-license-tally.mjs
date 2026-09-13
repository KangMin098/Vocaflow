// scripts/textbook/oai-license-tally.mjs
//
// **OAI 저장소 안에서 "문항으로 바꿀 수 있는 것" 이 몇 %인가 — 표본으로 잰다.**
//
// ── 왜 필요한가 (실측 2026-09-13) ────────────────────────────────────
// 재검증 프로브가 DOAB 를 `127,788건 · 라이선스 혼재` 로 냈다. 그 숫자로는 아무 결정도 못 한다 —
// 전부 ND 면 붙여도 **문항 0**이고(the_conversation 이 그랬다), 절반이 CC BY 면 지금 재고
// (변형 가능 논증문 1,485편)의 **수십 배**다. 둘 사이 어디인지를 재지 않으면 우선순위가 짐작이 된다.
//
// ── 표본을 앞에서만 뜨지 않는다 ──────────────────────────────────────
// OAI `ListRecords` 를 그냥 따라가면 **저장소가 정한 순서의 앞쪽 600건**을 보게 된다. 그 순서는
// 대개 내부 id·등록일이라 오래된 것·특정 출판사에 쏠린다. DOAB 의 resumptionToken 은
// `oai_dc////<offset>` 꼴이라 **임의 지점으로 건너뛸 수 있다** — 그래서 전체 구간에 고르게
// 흩어 뜬다. 건너뛸 수 없는 저장소는 앞에서부터 뜨고 `sampling: 'prefix'` 로 기록한다.
// **표본 방식을 결과에 같이 적는다** — 안 적으면 다음 사람이 모집단 비율로 읽는다.
//
// ── 여러 라이선스가 붙은 레코드는 가장 제한적인 것을 택한다 ──────────
// 느슨한 쪽을 고르면 그 판단이 그대로 위법이 된다. 표기가 없으면 `(표기 없음)` 이고
// **변형 가능으로 세지 않는다** — 모르는 것을 가능으로 접으면 ND 가 조용히 섞인다.
//
// 재실행 안전: 읽기만 한다. DB 를 건드리지 않고 외부에는 GET 만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/oai-license-tally.mjs --source doab
//   pnpm dlx tsx scripts/textbook/oai-license-tally.mjs --source doab --pages 20
//   pnpm dlx tsx scripts/textbook/oai-license-tally.mjs --source worldbank --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}

/**
 * 저장소별 접근 방법. `jump` 가 있으면 임의 지점 표본이 가능하다.
 * `licenseFrom` — 라이선스가 어디에 적히는가. **저장소마다 다르다**:
 *   DOAB 는 `<oaire:licenseCondition uri="…">` 의 **속성**이라 본문 정규식으로는 안 잡힌다
 *   (실측 2026-09-13: `<dc:rights>` 로 찾다가 600건 전부 "표기 없음" 이 나왔다).
 */
const SOURCES = {
  doab: {
    base: 'https://directory.doabooks.org/oai/request',
    prefix: 'oai_dc',
    jump: (offset) => `oai_dc////${offset}`,
    pageSize: 100,
  },
  worldbank: {
    base: 'https://openknowledge.worldbank.org/server/oai/request',
    prefix: 'oai_dc',
    jump: null,
    pageSize: 100,
  },
  mdpi: {
    base: 'https://oai.mdpi.com/oai/oai2.php',
    prefix: 'oai_dc',
    jump: null,
    pageSize: 100,
  },
  philarchive: {
    base: 'https://philarchive.org/oai.pl',
    prefix: 'oai_dc',
    jump: null,
    pageSize: 100,
  },
}

const sourceId = arg('source') ?? 'doab'
const spec = SOURCES[sourceId]
if (!spec) throw new Error(`모르는 저장소: ${sourceId}. 쓸 수 있는 것: ${Object.keys(SOURCES).join(' · ')}`)
const PAGES = Number(arg('pages') ?? 12)
const outPath = arg('out')

/** curl 로 받는다 — 이 머신은 일부 호스트에서 node fetch 만 ECONNRESET 을 낸다. */
async function get(url) {
  const { stdout } = await run('curl', ['-sL', '--max-time', '45', url], {
    maxBuffer: 64 * 1024 * 1024,
  })
  return stdout
}

/** **가장 제한적인 것**을 택한다 — 배열 순서가 곧 제한 강도다(강한 것이 앞). */
const CLASSES = [
  [/by-nc-nd/i, 'CC BY-NC-ND', false],
  [/by-nc-sa/i, 'CC BY-NC-SA', false],
  [/by-nd/i, 'CC BY-ND', false],
  [/by-nc/i, 'CC BY-NC', false],
  [/by-sa/i, 'CC BY-SA', true],
  [/licenses\/by[-/]/i, 'CC BY', true],
  [/publicdomain|zero\/1\.0|\/cc0\//i, 'CC0/PD', true],
]

function classify(uris) {
  if (!uris.length) return { label: '(표기 없음)', open: false }
  let best = null
  for (const [re, label, open] of CLASSES) {
    if (uris.some((u) => re.test(u))) {
      best = { label, open }
      break // 배열 앞쪽 = 더 제한적 → 먼저 맞은 것이 판정이다
    }
  }
  return best ?? { label: `기타(${uris[0].slice(0, 60)})`, open: false }
}

const url = (token, first) =>
  first
    ? `${spec.base}?verb=ListRecords&metadataPrefix=${spec.prefix}`
    : `${spec.base}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`

// ── 1) 총량과 페이지 크기를 먼저 받는다 ──────────────────────────────
const head = await get(url(null, true))
const completeListSize = Number(head.match(/completeListSize="(\d+)"/)?.[1] ?? 0) || null
const sampling = spec.jump && completeListSize ? 'spread' : 'prefix'

const bodies = [head]
if (sampling === 'spread') {
  // 전체 구간에 고르게 — 첫 페이지는 이미 받았으므로 나머지를 흩어 뜬다.
  const step = Math.max(spec.pageSize, Math.floor(completeListSize / PAGES))
  for (let i = 1; i < PAGES; i++) {
    const offset = Math.min(i * step, completeListSize - spec.pageSize)
    bodies.push(await get(url(spec.jump(offset), false)))
  }
} else {
  let token = head.match(/<resumptionToken[^>]*>([^<]*)</)?.[1] ?? ''
  for (let i = 1; i < PAGES && token; i++) {
    const body = await get(url(token, false))
    bodies.push(body)
    token = body.match(/<resumptionToken[^>]*>([^<]*)</)?.[1] ?? ''
  }
}

// ── 2) 레코드별 판정 ────────────────────────────────────────────────
const tally = {}
let open = 0
let closed = 0
let none = 0
let total = 0
for (const body of bodies) {
  for (const rec of body.split('<record').slice(1)) {
    const uris = [
      ...rec.matchAll(/licenseCondition[^>]*uri="([^"]+)"/g),
      ...rec.matchAll(/<dc:rights[^>]*>([^<]+)</g),
      ...rec.matchAll(/<dcterms:license[^>]*>([^<]+)</g),
    ].map((m) => m[1])
    const { label, open: isOpen } = classify(uris)
    tally[label] = (tally[label] ?? 0) + 1
    total++
    if (isOpen) open++
    else if (label === '(표기 없음)') none++
    else closed++
  }
}

const pct = (n) => `${((100 * n) / total).toFixed(1)}%`
console.log(
  `${sourceId} — 표본 ${total.toLocaleString()}건 / 전체 ${completeListSize?.toLocaleString() ?? '?'}건 ` +
    `(표본 방식 ${sampling === 'spread' ? '전 구간 균등' : '앞쪽 연속 — 쏠림 가능'})`,
)
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(`${String(v).padStart(5)} ${pct(v).padStart(6)}  ${k}`)
console.log('─'.repeat(56))
console.log(`변형 가능 (BY · BY-SA · CC0)  ${String(open).padStart(5)}  ${pct(open)}`)
console.log(`변형 불가 (ND · NC · 기타)    ${String(closed).padStart(5)}  ${pct(closed)}`)
console.log(`표기 없음 (가능으로 세지 않음) ${String(none).padStart(5)}  ${pct(none)}`)
if (completeListSize)
  console.log(
    `\n→ 전체 환산 변형 가능 약 ${Math.round((completeListSize * open) / total).toLocaleString()}건 ` +
      `(표본 비율 적용 — 모집단 실측이 아니다)`,
  )

if (outPath) {
  fs.writeFileSync(
    path.resolve(outPath),
    JSON.stringify(
      {
        source: sourceId,
        measured_at: new Date().toISOString(),
        sampling,
        sample_size: total,
        complete_list_size: completeListSize,
        tally,
        open,
        closed,
        none,
        projected_open: completeListSize ? Math.round((completeListSize * open) / total) : null,
      },
      null,
      2,
    ),
  )
  console.log(`→ ${outPath}`)
}
