// scripts/csat/source-get/wikinews-fetch.mjs
//
// English Wikinews(닫힌 읽기 전용 아카이브) 파일럿 수집기 — DB 에 쓰지 않는다.
// 경로: MediaWiki action API (generator=categorymembers · Category:Published · prop=extracts explaintext)
//   — packages/library-pipeline/src/ingest-article/_mediawiki.ts 와 같은 plain-text extract 방식.
// robots.txt: `User-agent: *` 는 /w/ (api.php 포함) 를 막는다. 이는 크롤러용이며 Wikimedia API 정책은
//   식별 가능한 UA 로 API 를 쓰는 것을 허용한다. 대량 수집은 덤프(https://dumps.wikimedia.org/enwikinews/)로 한다.
// 라이선스: 2005-09-25 이후 CC BY 2.5, 이전은 Public Domain (collection-default).
// 스포츠 카테고리 기사는 건너뛰고 수를 센다.
// 전문 extract 는 요청당 1편(exlimit 강제 1) — 목록 1회 + 기사당 1회.
// 재실행 안전: 읽기 전용 GET, 요청 간 ≥1초.
//
// 실행: node scripts/csat/source-get/wikinews-fetch.mjs --out <dir> --limit 20 [--start M]

import fs from 'node:fs'
import path from 'node:path'

const UA = 'VocaflowSourceGet/1.0 (killerapp51@empal.com)'
const API = 'https://en.wikinews.org/w/api.php'
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const OUT = arg('out', '.')
const LIMIT = Number(arg('limit', 20))
const START = arg('start', 'M')

let last = 0
async function get(url, method = 'GET') {
  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const res = await fetch(url, { method, headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

const STOP = /^==+\s*(Sources?|Related (news|articles)|External links|Sister links|See also|References|Interviews?)\s*==+\s*$/im

function clean(extract) {
  const cut = extract.split(STOP)[0]
  return cut
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !/^==.*==$/.test(l))
    .join('\n\n')
}

const DATE_RE = /^(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s*)?([A-Z][a-z]+ \d{1,2}, \d{4})/

async function main() {
  const robots = await (await get('https://en.wikinews.org/robots.txt')).text()
  const star = robots.split(/User-agent:\s*\*/i)[1] ?? ''
  console.log(`robots.txt (*): /w/ ${/Disallow:\s*\/w\/\s*$/m.test(star) ? 'disallowed for crawlers (API used per Wikimedia API policy)' : 'allowed'}`)
  const dump = await get('https://dumps.wikimedia.org/enwikinews/', 'HEAD')
  console.log(`dump index HEAD: ${dump.status}`)

  const out = []
  let skippedSports = 0
  let skippedShort = 0
  let cont = {}
  let guard = 0
  while (out.length < LIMIT && guard++ < 20) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      generator: 'categorymembers',
      gcmtitle: 'Category:Published',
      gcmnamespace: '0',
      gcmtype: 'page',
      gcmlimit: '20',
      gcmstartsortkeyprefix: START,
      prop: 'categories|info',
      cllimit: 'max',
      clshow: '!hidden',
      inprop: 'url',
      ...cont,
    })
    const j = await (await get(`${API}?${params}`)).json()
    for (const p of j.query?.pages ?? []) {
      if (out.length >= LIMIT) break
      const cats = (p.categories ?? []).map((c) => c.title)
      if (cats.some((c) => /^Category:(Sports?|Football|Cricket|Rugby|Tennis|Olympics|Formula One|Motorsport|Baseball|Basketball|Golf|Cycling|Ice hockey)/i.test(c))) {
        skippedSports++
        continue
      }
      // exlimit 은 전문 추출에서 1 로 낮춰진다 — 기사마다 한 번씩 받는다.
      const ex = await (await get(`${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', pageids: String(p.pageid) })}`)).json()
      p.extract = ex.query?.pages?.[0]?.extract
      if (!p.extract) continue
      const lines = p.extract.split('\n').filter(Boolean)
      const dm = lines[0]?.match(DATE_RE)
      const d = dm ? new Date(`${dm[1]} UTC`) : null
      const iso = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
      const body = clean(dm ? lines.slice(1).join('\n') : p.extract)
      const words = body ? body.split(/\s+/).length : 0
      if (words < 100) {
        skippedShort++
        continue
      }
      const pd = iso && iso < '2005-09-25'
      out.push({
        id: `wikinews:${p.pageid}`,
        title: p.title,
        url: p.fullurl,
        license: pd ? 'Public Domain (Wikinews before 2005-09-25)' : 'CC BY 2.5',
        license_evidence: 'collection-default',
        published_at: iso,
        author: null,
        body_text: body,
        words,
      })
      console.log(`ok ${out.length}/${LIMIT} ${words}w ${p.title}`)
    }
    if (!j.continue) break
    cont = j.continue
  }
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, 'ft-wikinews-samples.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`wrote ${out.length} → ${file} · skipped sports ${skippedSports} · short ${skippedShort}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
