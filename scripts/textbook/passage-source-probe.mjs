// scripts/textbook/passage-source-probe.mjs
//
// **교재 지문 후보 소스 전수를 한 번 두드린다 — 그리고 라이선스 근거를 같이 받아 온다.**
//
// ── 왜 또 만드나 (`scripts/acp/candidate-probe.mjs` 가 있는데) ────────
// 그 프로브는 ACP 기사 수집의 **구멍 메우기**가 목적이라 후보가 33개이고, 축이
// 「살아 있나 · 몇 건인가 · 라이선스 근거가 있나」 셋이다. 이 프로브가 더하는 것은 두 가지:
//
//   ① **후보 전수**(사용자 채택추정 표 86행 → 100 항목). 묶음 항목을 쪼개 개별로 잰다 —
//      "Cambridge/Oxford/Springer" 를 한 줄로 두면 셋 중 어느 것이 죽었는지 알 수 없다.
//   ② **대량 열거 수단**을 잰다. OAI-PMH(`oai`) 를 추가했다 — OA 단행본(#2·#4·#5·#11~17)은
//      RSS 가 없고 OAI 로만 전수 열거된다. RSS 만 보면 상위 5곳 중 4곳이 "죽음"으로 나온다.
//
// ── 라이선스는 자동 판정하지 않는다 ─────────────────────────────────
// 여기서 뽑는 것은 **근거 문자열**이지 판정이 아니다. 이 저장소는 Aeon 을 'cc' 로 적었다가
// 틀린 적이 있다(2026-08-19 — 실제로는 협약 후 재게시). **눈으로 확인하기 전엔 가장 보수적인 값.**
//
// ⚠️ UA 위장 금지 — 403/429 는 `blocked` 로 기록하고 목록에서 뺀다. 우회하지 않는다.
// ⚠️ 총량은 **소스가 스스로 말한 수**다. 교재에 쓸 수 있는 수가 아니다 —
//    감쇠(어수 규격 · license_class · display_only)는 `source-eligibility-scan.mjs` 소관.
//
// 재실행 안전: **읽기만 한다.** DB 를 건드리지 않고 외부에는 GET 만 한다. 몇 번 돌려도 같다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/passage-source-probe.mjs
//   pnpm dlx tsx scripts/textbook/passage-source-probe.mjs --id doab,mdpi
//   pnpm dlx tsx scripts/textbook/passage-source-probe.mjs --kind oai
//   pnpm dlx tsx scripts/textbook/passage-source-probe.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'

const REG_PATH = path.resolve('scripts/textbook/passage-source-candidates.json')
const OUT_DEFAULT = path.resolve('scripts/textbook/passage-source-probe.json')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const onlyIds = (arg('id') ?? '').split(',').filter(Boolean)
const onlyKind = arg('kind')
// ⚠️ **부분 실행으로 전체 스냅샷을 덮지 않는다.** `--id`/`--kind` 는 확인용이므로 `--out` 을
//   명시한 경우에만 파일을 쓴다. 실측 2026-09-13: `--id` 4항목 실행이 121항목 스냅샷을 덮어써
//   그 사이에 리포트가 '후보 4개' 를 근거로 쓸 수 있는 상태가 됐다 —
//   `source-eligibility-scan.mjs` 가 `--band` 에서 같은 함정을 이미 기록해 뒀다.
const PARTIAL = onlyIds.length > 0 || !!onlyKind
const outPath = arg('out') ?? (PARTIAL ? null : OUT_DEFAULT)
const CONCURRENCY = Number(arg('concurrency') ?? 6)

const { parseRssFeed } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)
const { parseFeedLinks } = await import('../../packages/library-pipeline/src/compose/feed-discovery.ts')
const { fetchWithTimeout } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

const registry = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'))
let targets = registry.candidates
if (onlyIds.length) targets = targets.filter((c) => onlyIds.includes(c.id))
if (onlyKind) targets = targets.filter((c) => c.kind === onlyKind)

// ── 라이선스 근거 — **판정이 아니라 단서**다 ────────────────────────
const LICENSE_MARKS = [
  [/creativecommons\.org\/publicdomain\/zero/i, 'CC0'],
  [/creativecommons\.org\/licenses\/by-nc-nd\/[\d.]+/i, 'CC BY-NC-ND'],
  [/creativecommons\.org\/licenses\/by-nc-sa\/[\d.]+/i, 'CC BY-NC-SA'],
  [/creativecommons\.org\/licenses\/by-nd\/[\d.]+/i, 'CC BY-ND'],
  [/creativecommons\.org\/licenses\/by-nc\/[\d.]+/i, 'CC BY-NC'],
  [/creativecommons\.org\/licenses\/by-sa\/[\d.]+/i, 'CC BY-SA'],
  [/creativecommons\.org\/licenses\/by\/[\d.]+/i, 'CC BY'],
  [/\bpublic domain\b/i, '"public domain" 문구'],
  [/\bnot (?:protected by )?copyright(?:ed)?\b/i, '"not copyrighted" 문구'],
  [/all rights reserved/i, '"All rights reserved"'],
]
function licenseEvidence(text) {
  const hits = []
  for (const [re, name] of LICENSE_MARKS) if (re.test(text)) hits.push(name)
  return hits
}

/** `"a.b[].c"` 꼴 경로로 값을 꺼낸다. 없으면 null — **0 으로 접지 않는다**(0건과 미지원은 다르다). */
function pick(obj, dotted) {
  if (!dotted) return null
  let cur = obj
  for (const seg of dotted.split('.')) {
    if (cur == null) return null
    const m = seg.match(/^([^[]*)\[(\d*)\]$/)
    if (m) {
      if (m[1]) cur = cur[m[1]]
      if (!Array.isArray(cur)) return null
      cur = m[2] === '' ? cur : cur[Number(m[2])]
    } else {
      cur = cur[seg]
    }
  }
  return cur ?? null
}

function asCount(v) {
  if (v == null) return null
  if (Array.isArray(v)) return v.length
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * **node fetch 가 죽어도 소스가 죽은 것이 아니다.** 이 머신은 일부 호스트에서 node 만
 * ECONNRESET 을 받고 curl 은 200 을 받는다(TLS/ALPN — memory `reference-node-tls-alpn-blocked`).
 * 실측 2026-09-13: gutenberg.org 가 그랬다. 여기서 물러서지 않으면 **배선돼 ready 11,363편이
 * 쌓여 있는 소스를 "죽음" 으로 적는다** — 리포트가 거짓이 된다. 그래서 curl 로 한 번 더 묻고
 * `via` 에 어느 경로로 받았는지 남긴다.
 */
async function getViaCurl(url, accept) {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const run = promisify(execFile)
  const args = ['-sL', '--max-time', '25', '-w', '\n__HTTP__%{http_code}\n__CT__%{content_type}', url]
  if (accept) args.push('-H', `Accept: ${accept}`)
  // curl 이 0 이 아닌 코드로 끝나도 **받은 몸통은 쓴다** — exit 코드를 note 로 남긴다.
  //   여기서 던지면 node 도 curl 도 실패한 소스가 '주소 오류' 와 구분되지 않는다.
  let stdout = ''
  let curlExit = 0
  try {
    stdout = (await run('curl', args, { maxBuffer: 40 * 1024 * 1024 })).stdout
  } catch (err) {
    stdout = err?.stdout ?? ''
    curlExit = err?.code ?? -1
  }
  const status = Number(stdout.match(/__HTTP__(\d+)/)?.[1] ?? 0)
  const ctype = stdout.match(/__CT__(.*)$/m)?.[1]?.trim() ?? null
  const body = stdout.replace(/\n__HTTP__\d+\n__CT__.*$/s, '')
  return { status, body, bytes: body.length, ctype, via: `curl${curlExit ? `(exit ${curlExit})` : ''}` }
}

async function get(url, accept) {
  let res
  try {
    res = await fetchWithTimeout(url, { accept, timeoutMs: 25_000 })
  } catch (e) {
    const msg = e instanceof Error ? `${e.message} ${e.cause?.code ?? ''}`.trim() : String(e)
    const out = await getViaCurl(url, accept)
    return { ...out, nodeError: msg }
  }
  const body = await res.text()
  // **응답의 몸집과 타입을 같이 기록한다.** 이것이 없으면 "항목 0건" 이 두 가지를 뜻해
  //   진단이 안 된다 — 피드가 실제로 비었는가, 아니면 HTML(차단·안내 페이지)을 받았는가.
  //   실측 2026-09-13: census·brookings·bmc 의 `.xml`·`/feed/` 주소가 전부 HTML 을 돌려줬다.
  return { status: res.status, body, bytes: body.length, ctype: res.headers.get('content-type') }
}

/** HTML 목록형 소스 — 피드가 없는 것이 정상이다. 같은 호스트 링크가 잡히면 열거가 된다. */
function countSameHostLinks(html, base) {
  let host
  try {
    host = new URL(base).host
  } catch {
    return 0
  }
  const urls = new Set()
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#?]{4,300})"/gi)) {
    const href = m[1]
    if (href.startsWith('/')) urls.add(href)
    else if (!/^(?:https?:|mailto:|javascript:|tel:|data:)/i.test(href)) urls.add(href) // 상대경로
    else if (href.startsWith('http')) {
      try {
        if (new URL(href).host === host) urls.add(new URL(href).pathname)
      } catch {
        /* 깨진 href — 세지 않는다 */
      }
    }
  }
  return urls.size
}

/** OAI-PMH — `Identify` 는 생존 확인, `ListRecords` 의 `completeListSize` 가 총량이다. */
async function probeOai(c) {
  const { status, body } = await get(c.url, 'text/xml')
  if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
  if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
  if (/<error\b/i.test(body)) {
    const code = body.match(/<error[^>]*code="([^"]+)"/i)?.[1] ?? '?'
    return { verdict: 'dead', note: `OAI error ${code}` }
  }
  if (!/<Identify>|<OAI-PMH/i.test(body)) return { verdict: 'dead', note: 'OAI-PMH 응답 아님' }
  const repo = body.match(/<repositoryName>([^<]+)</i)?.[1] ?? null
  const out = { verdict: 'oai', repo, sample: [], licenseHits: licenseEvidence(body) }
  if (!c.oaiList) return out
  try {
    const r = await get(c.oaiList, 'text/xml')
    if (r.status >= 400) return { ...out, note: `ListRecords HTTP ${r.status}` }
    if (/<error\b/i.test(r.body)) {
      const code = r.body.match(/<error[^>]*code="([^"]+)"/i)?.[1] ?? '?'
      return { ...out, note: `ListRecords error ${code}` }
    }
    const complete = r.body.match(/completeListSize="(\d+)"/i)?.[1]
    const records = (r.body.match(/<record\b/gi) ?? []).length
    return {
      ...out,
      total: complete ? Number(complete) : null,
      items: records,
      sample: [...r.body.matchAll(/<dc:title>([^<]{3,200})</gi)].slice(0, 3).map((m) => m[1]),
      licenseHits: [...new Set([...out.licenseHits, ...licenseEvidence(r.body)])],
      note: complete ? null : 'completeListSize 없음 — 총량 미공개',
    }
  } catch (e) {
    return { ...out, note: `ListRecords 실패: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function probe(c) {
  if (c.kind === 'excluded') return { verdict: 'excluded', note: c.note ?? '제외' }
  if (!c.url) return { verdict: 'dead', note: '주소 없음' }
  try {
    if (c.kind === 'oai') return await probeOai(c)

    if (c.kind === 'api' || c.kind === 'index') {
      const { status, body, via, nodeError } = await get(c.url, c.accept ?? 'application/json')
      if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
      if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
      let j
      let payload = body
      let gotVia = via
      try {
        j = JSON.parse(payload)
      } catch {
        // HTML 이 돌아왔다 — 대개 앞단 방어(Cloudflare)다. **한 번은 curl 로 다시 묻는다**:
        //   실측 2026-09-13 osf_preprints 가 같은 주소에서 회차마다 JSON/HTML 을 번갈아 냈고,
        //   여기서 포기하면 201,302건 상류가 '죽음' 으로 기록된다(같은 실행 안에서 재현 실패).
        if (gotVia === 'curl') return { verdict: 'dead', note: 'JSON 아님 (curl 재시도도 실패)' }
        const again = await getViaCurl(c.url, c.accept ?? 'application/json')
        payload = again.body
        gotVia = again.via
        try {
          j = JSON.parse(payload)
        } catch {
          return { verdict: 'dead', note: 'JSON 아님', via: gotVia }
        }
      }
      const sampleRaw = c.samplePath ? pick(j, c.samplePath) : null
      return {
        verdict: c.kind === 'index' ? 'index' : 'api',
        total: asCount(pick(j, c.totalPath)),
        sample: Array.isArray(sampleRaw) ? sampleRaw.slice(0, 3).map(String) : [],
        licenseHits: licenseEvidence(payload.slice(0, 200_000)),
        via: gotVia, nodeError,
      }
    }

    if (c.kind === 'feed') {
      const { status, body, bytes, ctype, via, nodeError } = await get(c.url)
      if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
      if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
      const items = parseRssFeed(body)
      const html = /text\/html/i.test(ctype ?? '') || /^\s*<!doctype html/i.test(body)
      return {
        verdict: items.length ? 'rss' : 'dead',
        items: items.length,
        bytes,
        ctype,
        note: items.length ? null : html ? '피드 주소가 HTML 을 돌려준다 — 주소가 틀렸다' : '항목 0건',
        sample: items.slice(0, 3).map((i) => i.title),
        licenseHits: licenseEvidence(body),
        via, nodeError,
      }
    }

    if (c.kind === 'list') {
      const { status, body, bytes, ctype, via, nodeError } = await get(c.url, 'text/html')
      if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
      if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
      const links = countSameHostLinks(body, c.url)
      return {
        verdict: links >= 10 ? 'list' : 'dead',
        items: links,
        bytes,
        ctype,
        note: links >= 10 ? null : `같은 호스트 링크 ${links}개 — 목록으로 보기 어렵다`,
        licenseHits: licenseEvidence(body),
        via, nodeError,
      }
    }

    // discover — 주소를 짐작하지 않는다. 발행사가 스스로 알린 것만 쓴다.
    const { status, body } = await get(c.url, 'text/html')
    if (status === 403 || status === 429)
      return { verdict: 'blocked', note: `HTTP ${status} — UA 위장 대신 뺀다` }
    if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
    const licenseHits = licenseEvidence(body)
    for (const cand of parseFeedLinks(body, c.url).slice(0, 4)) {
      try {
        const r = await get(cand.url)
        if (r.status >= 400) continue
        const items = parseRssFeed(r.body)
        if (items.length > 0)
          return {
            verdict: 'rss',
            items: items.length,
            found: cand.url,
            sample: items.slice(0, 3).map((i) => i.title),
            licenseHits: [...new Set([...licenseHits, ...licenseEvidence(r.body)])],
          }
      } catch {
        // 발행사가 낡은 주소를 알리는 일이 흔하다 — 다음 후보를 본다.
      }
    }
    return { verdict: 'html', note: '피드 알림 없음 — 페이지는 살아 있다', licenseHits }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { verdict: 'dead', note: /timeout|abort/i.test(msg) ? '타임아웃' : msg }
  }
}

// ── 라이선스 근거 페이지 — 본문 피드에 안 실리는 경우가 많다 ────────
async function licensePage(c) {
  if (!c.licenseUrl) return null
  try {
    const { status, body } = await get(c.licenseUrl, 'text/html')
    if (status >= 400) return { status, hits: [] }
    return { status, hits: licenseEvidence(body) }
  } catch {
    return { status: null, hits: [] }
  }
}

// ── 실행 — 동시 6 (소스별 rate limit 을 자극하지 않는 선) ───────────
const results = []
let cursor = 0
async function worker() {
  while (cursor < targets.length) {
    const c = targets[cursor++]
    const r = await probe(c)
    const lp = await licensePage(c)
    results.push({
      rank: c.rank,
      id: c.id,
      label: c.label,
      est: c.est,
      kind: c.kind,
      url: c.url,
      wired: c.wired ?? null,
      licenseClaim: c.licenseClaim,
      derivClaim: c.derivClaim,
      band: c.band,
      register: c.register,
      note: c.note ?? '',
      ...r,
      licensePage: lp,
    })
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))
results.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))

const MARK = {
  rss: '✓', api: '✓', oai: '✓', list: '✓', index: '◇', html: '◐', blocked: '⛔', dead: '✗', excluded: '—',
}
for (const r of results) {
  const size =
    r.total != null ? `${r.total.toLocaleString()}건` : r.items != null ? `${r.items}항목` : ''
  console.log(
    `${MARK[r.verdict] ?? '?'} ${String(r.rank).padStart(3)} ${r.id}`.padEnd(34) +
      size.padEnd(14) +
      (r.note ? String(r.note).slice(0, 60) : '') +
      (r.licenseHits?.length ? `  [근거 ${r.licenseHits.join('·')}]` : '') +
      (r.licensePage?.hits?.length ? `  [약관 ${r.licensePage.hits.join('·')}]` : ''),
  )
}

const tally = {}
for (const r of results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1
console.log(`\n판정 집계: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`)

if (!outPath) {
  console.log(`
(부분 실행 — 스냅샷을 쓰지 않았다. 파일로 남기려면 --out <경로>)`)
} else
fs.writeFileSync(
  outPath,
  JSON.stringify(
    { measured_at: new Date().toISOString(), spec_version: registry.spec_version, tally, results },
    null,
    2,
  ),
)
if (outPath) console.log(`→ ${path.relative(process.cwd(), outPath)}  (${results.length}항목)`)
