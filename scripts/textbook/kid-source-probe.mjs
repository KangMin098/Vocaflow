// scripts/textbook/kid-source-probe.mjs
//
// **초·중 교재 지문이 될 짧은 원문이 어디서 나오는가** — 후보 소스 실측.
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 이 저장소의 글 재고는 19,350편인데 **초·중 창에 드는 것은 141/154편뿐**이고,
// 그중 70%가 NASA 한 곳이다. 게다가 그 NASA 몫은 전부 `image-article`·`image-detail` —
// **사진 설명글**이다. 즉 초·중 지문 재고는 (1) 단일 소스 의존이고 (2) register 가 하나다.
//
//     초·중 창(44~173어) register 실측 — expository 126 · news 62 · reference 2 · **narrative 0**
//
// 시중 초·중 교재는 이야기 지문이 큰 몫을 차지한다. **narrative 0 은 재고 부족이 아니라
// 종류 부재다** — 편수를 늘려도 같은 사진 설명글이 늘 뿐이라 해결되지 않는다.
//
// ── 그래서 무엇을 재는가 ─────────────────────────────────────────────
// "피드가 열린다" 는 이 문제에 답하지 않는다. 답해야 하는 것은 셋이다:
//
//   1. **어수** — 그 소스의 *본래 단위*가 초창(44~121) · 중창(46~173) 에 드는가.
//      드는 비율을 표본으로 실측한다. 발췌해야만 들어오는 소스는 그만큼 비용이 붙는다.
//   2. **라이선스** — 재배포 가능한 라이선스가 **글 안에서** 확인되는가.
//      사이트 약관이 아니라 그 글에 붙은 표시를 본다(같은 사이트에도 다른 라이선스가 섞인다).
//   3. **register** — narrative 인가 expository 인가. 이게 이 조사의 실제 목적이다.
//
// ⚠️ 이 숫자는 "지문 후보" 이지 "교재 문항" 이 아니다. `source-yield-probe.mjs` 가
//   배선된 소스의 수확량을 재는 것과 달리, 이쪽은 **아직 배선되지 않은 후보**를 잰다.
//
// 재실행 안전: 읽기만 한다. DB 에 쓰지 않고 외부에는 GET 만 한다. 몇 번 돌려도 같다.
//   UA 는 밝히고 두드린다 — 위장하지 않는다(저장소 규칙). 403 은 403 으로 적는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/kid-source-probe.mjs
//   pnpm dlx tsx scripts/textbook/kid-source-probe.mjs --source storyweaver
//   pnpm dlx tsx scripts/textbook/kid-source-probe.mjs --sample 30 --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const onlySource = arg('source')
const SAMPLE = Number(arg('sample') ?? 20)
const outPath = arg('out') ?? 'scripts/textbook/kid-source-yield.json'

/** 시중 79종 실측 창(`market-spec.json` p10~p90). 여기서 다시 만들지 않는다 — 정본은 그쪽이다. */
const SPEC = path.resolve('packages/library-pipeline/src/textbook/market-spec.json')
const market = JSON.parse(fs.readFileSync(SPEC, 'utf8')).passageWords
const win = (k) => ({ min: market[k].words.p10, max: market[k].words.p90 })
/** 초등 = 초6 창. 중등 = 중1~중3 을 아우르는 창(가장 넓은 쪽). */
const ELEM = win('초6')
const MID = {
  min: Math.min(win('중1').min, win('중2').min, win('중3').min),
  max: Math.max(win('중1').max, win('중2').max, win('중3').max),
}

const UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'

async function get(url, { json = false, timeout = 30_000, retry = 2 } = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: json ? 'application/json' : '*/*' },
      signal: ac.signal,
    })
    const body = await res.text()
    if (res.status === 429 && retry > 0) {
      // 실측: 250ms 간격으로 두드리니 16번째부터 429 가 왔다. 물러서는 것이 예의이자 정확도다.
      await new Promise((r) => setTimeout(r, 3_000))
      return get(url, { json, timeout, retry: retry - 1 })
    }
    if (!res.ok) return { ok: false, status: res.status, body }
    return { ok: true, status: res.status, body, data: json ? JSON.parse(body) : null }
  } catch (e) {
    // ⚠️ `timeout` 을 180초로 줘도 **연결 자체는 10초에 끊긴다** — Node(undici)의
    //   connectTimeout 기본값이 10초이고 AbortController 는 그걸 못 늘린다.
    //   같은 주소를 curl 로는 받았는데 스크립트만 "HTTP 0" 이라 소스가 죽은 줄 알았다.
    const cause = String(e.cause?.message ?? '')
    if (/Connect Timeout/i.test(cause) && retry > 0) {
      await new Promise((r) => setTimeout(r, 2_000))
      return get(url, { json, timeout, retry: retry - 1 })
    }
    return {
      ok: false,
      status: 0,
      error: `${e.message ?? e}${cause ? ` (${cause})` : ''}`,
      body: '',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * `node:https` 로 직접 받는다 — **`fetch` 로는 못 여는 곳이 있다.**
 *
 * africanstorybook.org 는 이 자리에서 TLS 악수에 10초가 넘게 걸린다. `fetch`(undici)의
 * connectTimeout 기본값이 정확히 10초이고 **AbortController 로는 그 값을 못 늘린다** —
 * `timeout` 을 180초로 줘도 10초에 끊긴다. `undici` 패키지가 있으면 Agent 로 늘리겠지만
 * 이 저장소엔 없다. 같은 주소를 curl 은 받아 오므로 **소스가 죽은 게 아니라 클라이언트가
 * 못 기다린 것**이고, 그래서 기다릴 수 있는 클라이언트로 바꾼다.
 *
 * 이 함수는 느린 곳에만 쓴다. 나머지는 `fetch` 가 더 간단하다.
 */
async function getSlow(url, { timeout = 180_000 } = {}) {
  const https = await import('node:https')
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'user-agent': UA }, timeout }, (res) => {
      if (res.statusCode >= 400) {
        res.resume()
        return resolve({ ok: false, status: res.statusCode, body: '' })
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body }))
    })
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: 0, error: `${timeout}ms 안에 응답 없음`, body: '' })
    })
    req.on('error', (e) => resolve({ ok: false, status: 0, error: String(e.message), body: '' }))
  })
}

/** HTML → 글. `<script>`·`<style>` 를 **먼저** 지운다 — 안 지우면 JS 가 낱말로 세어진다(실측: 231어가 997어로 나왔다). */
const strip = (h) =>
  String(h ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const words = (t) => (t ? t.split(/\s+/).filter(Boolean).length : 0)
/** 그림책 쪽번호("3/10")는 글이 아니다. */
const depaginate = (t) =>
  t
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const CC = /Creative Commons|CC[ -]BY(?:[ -]([A-Z]{2}))?(?:[ -]([\d.]+))?/i
const licenseIn = (text) => {
  const m = text.match(
    /(?:Released under|licen[cs]ed under|under (?:a|the))\s+(CC[ -]BY[A-Z\- ]*\s*[\d.]*)\s*licen/i
  )
  if (m) return m[1].replace(/\s+/g, '-').toUpperCase().replace(/-+/g, '-')
  return CC.test(text) ? 'CC(형태 미확정)' : null
}

// ── 후보 소스 ────────────────────────────────────────────────────────
// 여기 있는 것은 **두드려서 200 을 받은 것만**이다. 짐작한 주소는 넣지 않는다.
// 403/000 을 받은 곳은 아래 `UNREACHABLE` 에 이유와 함께 남긴다 — 다음 사람이 다시 두드리지 않게.

/**
 * African Storybook 목록 — **한 번만 받는다.**
 *
 * 목록 한 장이 5.8 MB 에 전 언어가 섞여 오고 연결에만 10초가 넘게 걸린다. 수준별로 다시
 * 받으면 같은 5.8 MB 를 세 번 받게 되고, 그동안 남의 서버를 그만큼 더 붙잡는다.
 */
let asbCache = null
async function asbCatalog() {
  if (asbCache) return asbCache
  const r = await getSlow('https://www.africanstorybook.org/booklist.php?lang=eng')
  if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
  const items = []
  const re = /parent\.bookItems\.push\((\{[\s\S]*?\})\);/g
  let m
  while ((m = re.exec(r.body))) {
    const raw = m[1]
    const id = raw.match(/id:"(\d+)"/)?.[1]
    if (!id) continue
    items.push({
      id,
      title: strip(raw.match(/title:"([^"]*)"/)?.[1] ?? ''),
      level: raw.match(/level:"(\d+)"/)?.[1],
      lang: raw.match(/lang:"(\d+)"/)?.[1],
    })
  }
  // 영어를 고르는 열쇠가 `lang` 숫자 코드인데 값이 문서화돼 있지 않다 —
  // ASCII 제목이 **가장 많은**(비율이 아니라 개수) 코드를 영어로 본다.
  //
  // ⚠️ 처음엔 비율로 골랐다가 틀렸다. 아프리카 언어 중에도 ASCII 만 쓰는 것이 여럿이라
  //   100% 짜리 소수 언어가 1등으로 올라왔고, 영어 재고가 3,182 인데 **144 로 보였다.**
  //   비율은 "영어다움" 을 재지 않는다 — 크기를 함께 봐야 한다.
  //   실측 2026-09-02: 전체 13,425권 중 lang=1133 이 3,182권 전부 ASCII (영어).
  const byLang = new Map()
  for (const it of items) {
    const s = byLang.get(it.lang) ?? { n: 0, ascii: 0 }
    s.n++
    if (/^[\x20-\x7E]+$/.test(it.title)) s.ascii++
    byLang.set(it.lang, s)
  }
  const eng = [...byLang.entries()].sort((a, b) => b[1].ascii - a[1].ascii)[0]?.[0]
  asbCache = { items: items.filter((i) => i.lang === eng), langGuess: eng, parsed: items.length }
  return asbCache
}

const SOURCES = {
  // ── narrative — 이 조사의 목적 ────────────────────────────────────
  storyweaver: {
    label: 'StoryWeaver (Pratham Books)',
    register: 'narrative',
    licenseDeclared: 'CC BY 4.0 (책마다 다름 — 글 안에서 확인)',
    note: '읽기 수준 1~4 가 메타데이터에 있다. 인도 발행이라 영어가 제2언어인 독자를 상정하고 쓰였다.',
    /**
     * **수준별로 따로 뽑는다.** 섞어 뽑았더니 중앙 193어에 초창 적중 20% 로 나왔는데,
     * 쪼개 보니 수준이 어수를 거의 결정하고 있었다(실측 1차):
     *   Level 1  68·102·111·179·185·193·231     Level 3  552·935     Level 4  1,054
     * 즉 이 소스는 "너무 길다" 가 아니라 **어느 수준을 가져오느냐의 문제**다.
     * 섞어서 한 줄로 적으면 쓸 수 있는 소스를 못 쓴다고 적게 된다.
     */
    levels: ['1', '2', '3'],
    async list(n, level) {
      const per = Math.min(n, 24)
      const lv = level ? `&levels%5B%5D=${level}` : ''
      const r = await get(
        `https://storyweaver.org.in/api/v1/books-search?page=1&per_page=${per}&languages%5B%5D=English${lv}`,
        { json: true }
      )
      if (!r.ok)
        return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
      return {
        total: r.data?.metadata?.hits ?? null,
        items: (r.data?.data ?? []).map((b) => ({ id: b.slug, title: b.title, level: b.level })),
      }
    },
    async text(item) {
      const r = await get(`https://storyweaver.org.in/api/v1/stories/${item.id}/read`, {
        json: true,
      })
      if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}` }
      const pages = r.data?.data?.pages ?? []
      const story = pages.filter((p) => p.pageType === 'StoryPage')
      const body = depaginate(story.map((p) => strip(p.html)).join(' '))
      const back = pages
        .filter((p) => p.pageType !== 'StoryPage')
        .map((p) => strip(p.html))
        .join(' ')
      return { body, license: licenseIn(back), level: r.data?.data?.level ?? item.level }
    },
  },

  african_storybook: {
    label: 'African Storybook (Saide)',
    register: 'narrative',
    licenseDeclared: 'CC BY 4.0 (책마다 다름)',
    note: '읽기 수준 1~5. 목록이 JS 배열(`bookItems.push`)이라 파서가 따로 필요하다. 이용자 투고본이 섞여 길이 분포가 넓다.',
    levels: ['1', '2', '3'],
    async list(n, level) {
      const all = await asbCatalog()
      if (all.error) return { error: all.error, items: [] }
      const pool = level ? all.items.filter((i) => i.level === level) : all.items
      return {
        // **전체는 걸러 낸 뒤의 실제 개수다.** 처음엔 파싱을 `n*6` 에서 끊고 그 수를 total 로
        //   적었다 — 표본 8건일 때 "전체 48" 이 나왔다. 분모가 표본 크기를 따라 움직이면
        //   그건 분모가 아니다. 목록을 끝까지 읽고, 끊는 것은 표집에서만 한다.
        total: pool.length,
        langGuess: all.langGuess,
        items: pool.slice(0, n),
      }
    },
    async text(item) {
      // `reader.php` 는 껍데기고 글은 iframe 안에 있다 — 그래서 0어로 나왔다.
      const r = await getSlow(
        `https://www.africanstorybook.org/newviewer/index.php?id=${item.id}&bt=1&dual=false`
      )
      if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}` }
      const raw = depaginate(strip(r.body.replace(/<head[\s\S]*?<\/head>/i, ' ')))
      // 뷰어가 스스로 얹는 안내문. 글이 아니라 껍데기라 어수에서 뺀다.
      const body = raw
        .replace(/^Document\s*/i, '')
        .replace(/Please view the book in landscape mode\.?\s*/i, '')
        .trim()
      return { body, license: licenseIn(r.body), level: item.level }
    },
  },

  // ── expository — 이미 있는 축이지만 소스가 NASA 하나뿐이라 넓힌다 ──
  vikidia_en: {
    label: 'Vikidia (English) — 8~13세 백과',
    register: 'expository',
    licenseDeclared: 'CC BY-SA 3.0',
    note: '도입부(exintro)가 본래 44~173어 언저리다. MediaWiki API 라 무작위 표집이 공짜다.',
    async list(n) {
      const r = await get(
        `https://en.vikidia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${Math.min(n, 50)}` +
          `&meta=siteinfo&siprop=statistics&format=json`,
        { json: true }
      )
      if (!r.ok)
        return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
      return {
        // 전체 규모를 짐작하지 않는다 — siteinfo 가 스스로 말한다.
        total: r.data?.query?.statistics?.articles ?? null,
        items: (r.data?.query?.random ?? []).map((p) => ({ id: p.title, title: p.title })),
      }
    },
    async text(item) {
      const r = await get(
        `https://en.vikidia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&titles=${encodeURIComponent(item.id)}&format=json`,
        { json: true }
      )
      if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}` }
      const pages = r.data?.query?.pages ?? {}
      const body = Object.values(pages)[0]?.extract ?? ''
      return { body: body.replace(/\s+/g, ' ').trim(), license: 'CC-BY-SA-3.0', level: null }
    },
  },

  frontiers_young_minds: {
    label: 'Frontiers for Young Minds — 8~15세 심사 과학지',
    register: 'expository',
    licenseDeclared: 'CC BY 4.0 (Crossref 메타데이터로 확인)',
    note: 'Crossref(ISSN 2296-6846) 로 목록·라이선스가 나온다. 본문 길이는 재 봐야 안다.',
    async list(n) {
      const r = await get(
        `https://api.crossref.org/journals/2296-6846/works?rows=${Math.min(n, 50)}&sort=published&order=desc&select=DOI,title,license,URL,abstract`,
        { json: true }
      )
      if (!r.ok)
        return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
      const msg = r.data?.message
      return {
        total: msg?.['total-results'] ?? null,
        items: (msg?.items ?? []).map((w) => ({
          id: w.DOI,
          title: (w.title ?? [])[0] ?? '',
          url: w.URL,
          abstract: w.abstract ?? null,
          license:
            (w.license ?? []).map((l) => l.URL).find((u) => /creativecommons/.test(u)) ?? null,
        })),
      }
    },
    async text(item) {
      // 초록이 Crossref 에 있으면 그것이 곧 후보 단위다 — 본문은 초·중 창보다 훨씬 길다.
      if (item.abstract) {
        return { body: strip(item.abstract), license: item.license, level: null, unit: 'abstract' }
      }
      return { error: '초록 없음(Crossref)', license: item.license }
    },
  },
}

/** 두드렸으나 못 쓰는 곳 — 이유와 함께 남긴다. 다음 사람이 같은 곳을 다시 두드리지 않게. */
const UNREACHABLE = [
  {
    id: 'science_journal_for_kids',
    why: 'HTTP 403 (봇 차단). 라이선스는 CC BY 로 명시돼 있어 협의 여지는 있다.',
  },
  { id: 'loc_free_to_use', why: 'HTTP 403 — Cloudflare 관문. UA 를 위장하지 않는다(저장소 규칙).' },
  { id: 'nih_news_in_health', why: 'HTTP 403 — Cloudflare 관문. PD 라 아깝지만 지금은 못 연다.' },
  {
    id: 'global_digital_library',
    why: 'api.digitallibrary.io DNS/연결 실패, content.digitallibrary.io/api 404. API 가 사라진 것으로 보인다.',
  },
  {
    id: 'bloom_library',
    why: 'api.bloomlibrary.org/v1/classes/books 404 — 주소가 바뀐 듯. 다시 찾아야 한다.',
  },
  { id: 'lets_read_asia', why: 'api.letsreadasia.org 연결 실패(000).' },
  { id: 'nasa_space_place', why: 'spaceplace.nasa.gov/rss.xml 연결 실패(000).' },
  { id: 'nps_gov', why: 'www.nps.gov/rss/news.xml 404.' },
  {
    id: 'wikijunior',
    why: 'en.wikibooks.org Category:Wikijunior 가 비어 있다(0건) — 분류명이 다르다.',
  },
]

// ── 실행 ─────────────────────────────────────────────────────────────
const ids = onlySource ? [onlySource] : Object.keys(SOURCES)
const report = {
  measured_at: new Date().toISOString(),
  sample: SAMPLE,
  windows: { elementary: ELEM, middle: MID },
  sources: [],
  unreachable: UNREACHABLE,
}

/**
 * 잴 단위는 소스가 아니라 **(소스 × 수준)** 이다.
 *
 * 수준을 가진 소스를 하나로 뭉쳐 재면 평균이 답을 가린다 — StoryWeaver 를 섞어 쟀을 때
 * "초창 20%" 로 나왔지만, 수준별로 보면 Level 1 은 쓸 만하고 Level 3~4 만 길었다.
 * **평균이 아니라 고를 수 있는 칸을 봐야 한다.**
 */
const runs = []
for (const id of ids) {
  const src = SOURCES[id]
  if (!src) {
    console.error(`알 수 없는 소스: ${id}`)
    process.exit(1)
  }
  if (src.levels) for (const lv of src.levels) runs.push({ id, src, level: lv })
  else runs.push({ id, src, level: null })
}

for (const { id: baseId, src, level } of runs) {
  const id = level ? `${baseId}:L${level}` : baseId
  process.stdout.write(`\n▶ ${id} — ${src.label}${level ? ` · 수준 ${level}` : ''}\n`)
  const t0 = Date.now()
  const listed = await src.list(SAMPLE, level)
  if (listed.error) {
    console.log(`  목록 실패: ${listed.error}`)
    report.sources.push({
      id,
      label: src.label,
      register: src.register,
      ok: false,
      error: listed.error,
    })
    continue
  }
  console.log(
    `  목록 ${listed.items.length}건${listed.total ? ` (전체 ${listed.total.toLocaleString()})` : ''}`
  )

  const measured = []
  for (const item of listed.items) {
    const t = await src.text(item)
    if (t.error) {
      measured.push({ id: item.id, title: item.title, error: t.error })
      continue
    }
    const w = words(t.body)
    measured.push({
      id: item.id,
      title: item.title,
      words: w,
      license: t.license ?? null,
      level: t.level ?? null,
      unit: t.unit ?? 'full',
    })
    await new Promise((r) => setTimeout(r, 1_100)) // 남의 서버다. 250ms 로는 429 가 온다(실측).
  }

  const good = measured.filter((m) => m.words > 0)
  const inElem = good.filter((m) => m.words >= ELEM.min && m.words <= ELEM.max).length
  const inMid = good.filter((m) => m.words >= MID.min && m.words <= MID.max).length
  const ws = good.map((m) => m.words).sort((a, b) => a - b)
  const pct = (p) =>
    ws.length ? ws[Math.min(ws.length - 1, Math.floor((ws.length * p) / 100))] : null
  // ⚠️ 처음에 /CC/i 로만 셸다가 **CC BY 4.0 인 20건을 0건으로** 적을 뻔했다 —
  //   Crossref 는 라이선스를 URL(creativecommons.org/licenses/by/4.0)로 준다.
  const licensed = good.filter((m) => m.license && /CC|creativecommons/i.test(m.license)).length

  const row = {
    id,
    source: baseId,
    level,
    label: src.label,
    register: src.register,
    ok: true,
    licenseDeclared: src.licenseDeclared,
    note: src.note,
    total: listed.total ?? null,
    sampled: measured.length,
    extracted: good.length,
    failed: measured.length - good.length,
    words: {
      min: ws[0] ?? null,
      p25: pct(25),
      median: pct(50),
      p75: pct(75),
      max: ws[ws.length - 1] ?? null,
    },
    inElementary: inElem,
    inMiddle: inMid,
    pctElementary: good.length ? +((inElem / good.length) * 100).toFixed(1) : 0,
    pctMiddle: good.length ? +((inMid / good.length) * 100).toFixed(1) : 0,
    licenseConfirmedInBand: licensed,
    ms: Date.now() - t0,
    items: measured,
  }
  report.sources.push(row)
  console.log(
    `  본문 ${good.length}/${measured.length} · 중앙 ${row.words.median}어 (${row.words.min}~${row.words.max}) · ` +
      `초창 ${row.pctElementary}% · 중창 ${row.pctMiddle}% · 라이선스 글 안 확인 ${licensed}/${good.length}`
  )
}

// ── 표 ───────────────────────────────────────────────────────────────
console.log(`\n초창 ${ELEM.min}~${ELEM.max}어 · 중창 ${MID.min}~${MID.max}어 (시중 79종 p10~p90)\n`)
const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
console.log(
  pad('소스', 22) +
    pad('register', 11) +
    lpad('전체', 8) +
    lpad('표본', 5) +
    lpad('중앙어', 7) +
    lpad('초창%', 7) +
    lpad('중창%', 7) +
    lpad('CC', 6) +
    lpad('초창추정', 9) +
    lpad('중창추정', 9)
)
console.log('─'.repeat(91))
let projElem = 0
let projMid = 0
for (const s of report.sources) {
  if (!s.ok) {
    console.log(pad(s.id, 22) + pad('—', 11) + lpad('실패', 8) + '  ' + s.error)
    continue
  }
  // **추정 = 전체 재고 × 표본 적중률.** 표본이 작으면 오차가 크다 — 그래서 표본 수를 같이 적는다.
  //   전체를 모르는 소스는 추정하지 않는다(빈칸). 짐작한 분모로 곱하면 그 순간 허수가 된다.
  s.projectedElementary = s.total ? Math.round((s.total * s.pctElementary) / 100) : null
  s.projectedMiddle = s.total ? Math.round((s.total * s.pctMiddle) / 100) : null
  projElem += s.projectedElementary ?? 0
  projMid += s.projectedMiddle ?? 0
  console.log(
    pad(s.id, 22) +
      pad(s.register, 11) +
      lpad(s.total?.toLocaleString() ?? '—', 8) +
      lpad(s.extracted, 5) +
      lpad(s.words.median ?? '—', 7) +
      lpad(s.pctElementary, 7) +
      lpad(s.pctMiddle, 7) +
      lpad(`${s.licenseConfirmedInBand}/${s.extracted}`, 6) +
      lpad(s.projectedElementary?.toLocaleString() ?? '—', 9) +
      lpad(s.projectedMiddle?.toLocaleString() ?? '—', 9)
  )
}
console.log('─'.repeat(91))
console.log(
  pad('합계(추정)', 73) + lpad(projElem.toLocaleString(), 9) + lpad(projMid.toLocaleString(), 9)
)
report.projected = { elementary: projElem, middle: projMid }
// 지금 재고는 여기서 다시 세지 않는다 — DB 실측값이고, 이 스크립트는 DB 를 안 읽는다.
console.log(`\n현재 초·중 창 재고는 141 / 154 편이다(DB 실측 2026-09-02). 위 추정과 비교할 것.`)

fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2))
console.log(`\n기록 → ${outPath}`)
console.log(`못 연 곳 ${UNREACHABLE.length} — 이유는 JSON 의 unreachable 에 있다.`)
