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
//   덤프: node scripts/csat/source-get/wikinews-fetch.mjs --dump --out <dir> [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { countWords } from './_common.mjs'

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

// ── --dump 모드 ────────────────────────────────────────────────────────────
// robots.txt 가 /w/ 를 막으므로 대량 수집은 공개 덤프로 한다. 덤프는 <out> 에 한 번 받아 재사용한다.
// 압축 해제는 스트리밍: bzip2 -dc (PATH 또는 Git for Windows 동봉본). id 는 API 모드와 같은 `wikinews:<pageid>`.
const DUMP_URL = 'https://dumps.wikimedia.org/enwikinews/latest/enwikinews-latest-pages-articles.xml.bz2'
const SPORTS = /^(Sports?|Football|Soccer|Cricket|Rugby|Tennis|Olympics|.*Olympic|Paralympic|Formula One|Motorsport|Motor racing|Baseball|Basketball|Golf|Cycling|Ice hockey|American football|Australian rules football|Boxing|Athletics|Swimming|Wrestling|Horse racing|NFL|NBA|FIFA|Association football|Snooker|Darts|Skiing|Figure skating|Handball|Volleyball|Chess)\b/i

function findBzip2() {
  const cands = ['bzip2', 'C:\\Program Files\\Git\\mingw64\\bin\\bzip2.exe', 'C:\\Program Files\\Git\\usr\\bin\\bzip2.exe']
  for (const c of cands) {
    const r = spawnSync(c, ['--help'], { stdio: 'ignore' })
    if (!r.error) return c
  }
  throw new Error('bzip2 not found (install Git for Windows or put bzip2 on PATH)')
}

async function ensureDump(file) {
  const head = await fetch(DUMP_URL, { method: 'HEAD', headers: { 'User-Agent': UA } })
  const size = Number(head.headers.get('content-length'))
  console.log(`dump size: ${size} bytes (${(size / 1048576).toFixed(1)} MiB) · last-modified ${head.headers.get('last-modified')}`)
  if (fs.existsSync(file) && fs.statSync(file).size === size) {
    console.log(`reuse ${file}`)
    return
  }
  const res = await fetch(DUMP_URL, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${DUMP_URL}`)
  const tmp = `${file}.part`
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp))
  fs.renameSync(tmp, file)
  console.log(`downloaded ${file}`)
}

const decodeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(euro|pound|yen|times|deg|minus|lt|gt|hellip|rsquo|lsquo|rdquo|ldquo|cent|frac12|plusmn|middot|eacute|aacute|oacute|iacute|uacute|ntilde|ouml|uuml|auml|ccedil);/g, (_, n) => ({ euro: '€', pound: '£', yen: '¥', times: '×', deg: '°', minus: '−', lt: '<', gt: '>', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', cent: '¢', frac12: '½', plusmn: '±', middot: '·', eacute: 'é', aacute: 'á', oacute: 'ó', iacute: 'í', uacute: 'ú', ntilde: 'ñ', ouml: 'ö', uuml: 'ü', auml: 'ä', ccedil: 'ç' })[n])

// 중첩 {{…}} 제거 — 안쪽부터 반복.
function stripTemplates(t) {
  let prev
  do {
    prev = t
    // 본문 낱말을 싣는 인라인 템플릿은 표시 텍스트를 남긴다: {{w|문서|표시}} · {{wikt|…}} · {{nowrap|…}} · {{lang|xx|…}}
    t = t.replace(/\{\{\s*(?:w|wikipedia|wikt|wiktionary|nowrap|lang)\s*\|([^{}]*)\}\}/gi, (_, a) => {
      const parts = a.split('|').filter((p) => !/^\s*[a-z_]+\s*=/i.test(p))
      return (parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '').trim()
    })
    // 숫자를 싣는 템플릿 — 통째로 지우면 「within of」「It flew for before」처럼 숫자가 빠진다
    //   (회차 8 판정자가 여러 편에서 짚었다 · 덤프 실측 formatnum 154 · money 58 · convert 6 · currency 4).
    //   {{formatnum:1234}} → 1234 · {{convert|5|km|mi}} → 5 km · {{money|12|USD}} / {{currency|12|USD}} → 12 USD
    // Wikinews 자체 단위 템플릿 {{km to mi|1000}} · {{M to ft|260}} · {{F to C|90}} — 덤프 실측 ~165곳.
    //   이게 주된 원인이었다(「It flew for {{km to mi|1000}} before」 → 「It flew for before」). 첫 단위로 숫자를 살린다.
    t = t.replace(/\{\{\s*(km|mi|m|ft|feet|f|c|in|cm)\s+to\s+(?:km|mi|m|ft|feet|f|c|in|cm)\s*\|\s*([^{}|]+)(?:\|[^{}]*)?\}\}/gi, (_, u, n) => {
      const unit = { km: 'km', mi: 'miles', m: 'm', ft: 'ft', feet: 'feet', f: '°F', c: '°C', in: 'in', cm: 'cm' }[u.toLowerCase()]
      return /°/.test(unit) ? `${n.trim()}${unit}` : `${n.trim()} ${unit}`
    })
    t = t.replace(/\{\{\s*formatnum\s*:\s*([^{}|]*)(?:\|[^{}]*)?\}\}/gi, (_, n) => n.trim())
    t = t.replace(/\{\{\s*(?:convert|cvt)\s*\|\s*([^{}|]+)\|\s*([^{}|]+?)(?:\|[^{}]*)?\}\}/gi, (_, n, u) => `${n.trim()} ${u.trim()}`)
    t = t.replace(/\{\{\s*(?:money|currency)\s*\|\s*([^{}|]+)(?:\|\s*([^{}|=]+))?(?:\|[^{}]*)?\}\}/gi, (_, n, c) => (c ? `${n.trim()} ${c.trim()}` : n.trim()))
    t = t.replace(/\{\{[^{}]*\}\}/g, '')
  } while (t !== prev)
  return t
}

// 중첩 [[File:…[[a|b]]…]] 제거 — 괄호 깊이로 훑는다.
function stripFileLinks(t) {
  const re = /\[\[\s*(File|Image|Media)\s*:/i
  let m
  while ((m = re.exec(t))) {
    let i = m.index + 2
    let depth = 1
    while (i < t.length && depth > 0) {
      if (t.startsWith('[[', i)) {
        depth++
        i += 2
      } else if (t.startsWith(']]', i)) {
        depth--
        i += 2
      } else i++
    }
    t = t.slice(0, m.index) + t.slice(i)
  }
  return t
}

const STOP_WIKI = /^==+\s*(Sources?|Related (news|articles|stories)|External links?|Sister links|See also|References|Notes)\s*==+\s*$/im

function wikiToText(wt) {
  let t = wt.replace(/\r/g, '')
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.split(STOP_WIKI)[0]
  t = t.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  t = t.replace(/<(gallery|table|math|timeline|imagemap|score|syntaxhighlight|source|references)[^>]*>[\s\S]*?<\/\1>/gi, '')
  t = stripTemplates(t)
  t = t.replace(/\{\|[\s\S]*?\n\|\}/g, '')
  t = stripFileLinks(t)
  t = t.replace(/\[\[\s*:?\s*Category\s*:[^\]]*\]\]/gi, '')
  t = t.replace(/\[\[\s*[a-z]{2,3}(-[a-z]+)?\s*:[^\]]*\]\]/g, '') // interwiki
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]*\]/g, '')
  t = t.replace(/\[?\(?\s*https?:\/\/[^\s\])]+\s*\)?\]?/g, '') // 맨 URL · 닫히지 않은 외부 링크
  t = t.replace(/\s==+[^=\n]{1,60}==+(?=\s)/g, '\n') // 줄 중간에 붙은 소제목
  t = t.replace(/'''''|'''|''/g, '')
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  t = decodeEntities(t)
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^=+.*=+$/.test(l) && !/^(__[A-Z]+__|[|!{}]|\*\s*$|-{4,})/.test(l))
    .map((l) => l.replace(/^[*#:;]+\s*/, ''))
    .filter(Boolean)
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s*\)/g, '')
}

function dumpDate(wt) {
  // {{date|…}} · {{Byline|date=…}} · 본문 첫 줄 dateline("November 18 2004, Nairobi.") 순.
  const m =
    wt.match(/\{\{\s*date\s*\|\s*([^}|]+)/i) ??
    wt.match(/\{\{\s*Byline\s*\|[^}]*?\bdate\s*=\s*([^}|]+)/i) ??
    wikiToText(wt).match(/^(?:[A-Z][a-z]+day,?\s*)?([A-Z][a-z]+\.? \d{1,2},? \d{4})/)
  if (!m) return null
  const d = new Date(`${m[1].trim().replace(/(\d)(\s+\d{4})/, '$1,$2')} UTC`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

async function mainDump() {
  fs.mkdirSync(OUT, { recursive: true })
  const bz = path.join(OUT, 'enwikinews-latest-pages-articles.xml.bz2')
  await ensureDump(bz)
  const bin = findBzip2()
  const child = spawn(bin, ['-dc', bz], { stdio: ['ignore', 'pipe', 'inherit'] })
  const limit = process.argv.includes('--limit') ? LIMIT : Infinity
  const skip = { redirect: 0, notPublished: 0, sports: 0, crossword: 0, short: 0, noDate: 0 }
  let published = 0
  const out = []
  let buf = ''
  child.stdout.setEncoding('utf8')
  for await (const chunk of child.stdout) {
    buf += chunk
    let end
    while ((end = buf.indexOf('</page>')) >= 0) {
      const page = buf.slice(0, end)
      buf = buf.slice(end + 7)
      if (!/<ns>0<\/ns>/.test(page)) continue
      if (/<redirect\b/.test(page)) {
        skip.redirect++
        continue
      }
      const wt = decodeXml(page.match(/<text[^>]*>([\s\S]*?)<\/text>/)?.[1] ?? '')
      const cats = [...wt.matchAll(/\[\[\s*Category\s*:\s*([^\]|]+)/gi)].map((m) => m[1].trim())
      // 대부분은 {{publish}} 템플릿이 카테고리를 단다 — 명시 [[Category:Published]] 는 ~850편뿐.
      const pub = cats.some((c) => /^Published$/i.test(c)) || /\{\{\s*publish(ed)?\s*(\||\}\})/i.test(wt)
      if (!pub) {
        skip.notPublished++
        continue
      }
      published++
      if (out.length >= limit) continue
      if (cats.some((c) => SPORTS.test(c))) {
        skip.sports++
        continue
      }
      if (/crossword/i.test(page.match(/<title>([^<]*)<\/title>/)?.[1] ?? '')) {
        skip.crossword++
        continue
      }
      const body = wikiToText(wt)
      const words = countWords(body)
      if (words < 40) {
        skip.short++
        continue
      }
      const iso = dumpDate(wt)
      if (!iso) skip.noDate++
      const title = decodeXml(page.match(/<title>([^<]*)<\/title>/)[1])
      const pageid = page.match(/<id>(\d+)<\/id>/)[1]
      out.push({
        id: `wikinews:${pageid}`,
        title,
        url: `https://en.wikinews.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        license: iso && iso < '2005-09-25' ? 'Public Domain (Wikinews before 2005-09-25)' : 'CC BY 2.5',
        license_evidence: 'collection-default',
        published_at: iso,
        author: null,
        body_text: body,
        words,
      })
    }
  }
  const file = path.join(OUT, 'ft-wikinews-samples.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  const ws = out.map((r) => r.words).sort((a, b) => a - b)
  console.log(`published pages ${published} · kept ${out.length} · skipped ${JSON.stringify(skip)} (noDate is counted within kept)`)
  console.log(`median words ${ws[Math.floor(ws.length / 2)] ?? 0} → ${file}`)
}

;(process.argv.includes('--dump') ? mainDump() : main()).catch((e) => {
  console.error(e)
  process.exit(1)
})
