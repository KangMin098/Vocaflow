// scripts/acp/candidate-probe.mjs
//
// **후보 소스를 배선 전에 한 번 두드린다** — 그리고 라이선스 근거를 같이 받아 온다.
//
// ── 왜 또 만드나 (feed-probe.mjs 가 있는데) ─────────────────────────
// `feed-probe.mjs` 는 "이 주소가 살아 있나" 를 본다. 그것만으로는 배선을 결정할 수 없다.
// 2026-08-21 실측이 드러낸 구멍이 **수량이 아니라 라이선스** 였기 때문이다:
//   논증문 신규 46편이 전부 CC-BY-ND(the_conversation) → `display_only` → **문항 0**.
// 즉 ND 소스를 아무리 더 붙여도 논증문 재고는 0 그대로다. 그래서 이 프로브는
// **살아 있는가 · 몇 건인가 · 라이선스 근거가 페이지에 있는가** 셋을 함께 잰다.
//
// ── 라이선스는 자동 판정하지 않는다 ─────────────────────────────────
// 여기서 뽑는 것은 **근거 문자열**이지 판정이 아니다. 판정은 사람이 한다.
// 이 저장소는 Aeon 을 'cc' 로 적었다가 틀린 적이 있다(2026-08-19 — 실제로는
// 협약 후 재게시 · 비평 목적 250단어). **눈으로 확인하기 전엔 가장 보수적인 값.**
//
// ⚠️ UA 위장 금지 — 403/429 는 `blocked` 로 기록하고 목록에서 뺀다. 우회하지 않는다.
//
// 재실행 안전: 읽기만 한다. DB 를 건드리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/candidate-probe.mjs
//   pnpm dlx tsx scripts/acp/candidate-probe.mjs --gap argumentative
//   pnpm dlx tsx scripts/acp/candidate-probe.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const onlyGap = arg('gap')
const outPath = arg('out') ?? 'scripts/acp/candidate-probe.json'

const { parseRssFeed, parseFeedLinks, parseSectionPage } = await import('@vocaflow/library-pipeline')
const { fetchWithTimeout } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

/**
 * 후보. `gap` 은 **이 소스가 메우려는 구멍**이다 — 없으면 배선할 이유도 없다.
 *   argumentative  논증문 교재 가용 0 (ND 아닌 논증문이 필요하다)
 *   lowlevel       초·중등 A1–B1 상류 고갈 (simple_wikipedia 잔량 103편)
 *   dead           죽은 소스 대체 (nih 3피드 · wikinews)
 *   depth          이미 되는 축을 더 깊게 (우선순위 낮음)
 *   verify         사용자 목록의 라이선스 주장을 확인만 한다 (배선 후보 아님)
 *
 * `kind`:
 *   feed     주소를 안다 — 그대로 두드린다
 *   api      JSON API — 응답에서 총량을 뽑는다
 *   discover 주소를 모른다 — 홈에서 피드를 찾아본다 (짐작 금지)
 */
const CANDIDATES = [
  // ── ① 논증문 구멍 — ND 가 아닌 논증문이라야 의미가 있다 ──────────
  {
    gap: 'argumentative', id: 'plos:essay', kind: 'api', license: 'CC BY (PLOS 전 논문)',
    label: 'PLOS Essay·Perspective·Opinion (기배선 소스의 미사용 유형)',
    url: 'https://api.plos.org/search?q=*:*&fq=doc_type:full%20AND%20article_type:(%22Essay%22%20OR%20%22Perspective%22%20OR%20%22Opinion%22%20OR%20%22Unsolved%20Mystery%22)&rows=5&fl=id,title_display,article_type,publication_date&sort=publication_date%20desc&wt=json',
    total: (j) => j?.response?.numFound ?? null,
    sample: (j) => (j?.response?.docs ?? []).map((d) => `${d.article_type}: ${d.title_display}`),
  },
  {
    gap: 'argumentative', id: 'futurity', kind: 'feed', license: 'CC BY 4.0 (사이트 명시 주장 — 확인 필요)',
    label: 'Futurity — 대학 컨소시엄 연구 기사',
    url: 'https://www.futurity.org/feed/',
    licenseUrl: 'https://www.futurity.org/about/',
  },
  {
    gap: 'argumentative', id: 'worldbank-blogs', kind: 'discover', license: 'CC BY 3.0 IGO 주장',
    label: 'World Bank Blogs — 개발·경제 논증',
    url: 'https://blogs.worldbank.org/',
  },
  {
    gap: 'argumentative', id: 'un-news', kind: 'feed', license: 'UN 저작물 — 확인 필요',
    label: 'UN News — 국제 이슈',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
  },
  {
    gap: 'argumentative', id: 'unesco-courier', kind: 'discover', license: 'CC BY-SA 3.0 IGO 주장',
    label: 'UNESCO Courier — 문화·교육 논설',
    url: 'https://courier.unesco.org/en',
  },
  {
    gap: 'argumentative', id: 'escholarship-collabra', kind: 'discover', license: 'CC BY (UC Press OA)',
    label: 'Collabra: Psychology — 심리 (수능 최빈출 소재)',
    url: 'https://online.ucpress.edu/collabra',
  },

  // ── ② 초·중등 저레벨 구멍 ────────────────────────────────────────
  {
    gap: 'lowlevel', id: 'nasa-spaceplace', kind: 'discover', license: 'PD (미 연방정부)',
    label: 'NASA Space Place — 초등 대상 우주 설명',
    url: 'https://spaceplace.nasa.gov/',
  },
  {
    gap: 'lowlevel', id: 'nasa-climatekids', kind: 'discover', license: 'PD (미 연방정부)',
    label: 'NASA Climate Kids — 초등 기후',
    url: 'https://climatekids.nasa.gov/',
  },
  {
    gap: 'lowlevel', id: 'standard-ebooks', kind: 'feed', license: 'PD 본문 + CC0 편집분',
    label: 'Standard Ebooks — 정제된 PD 고전 (서사)',
    url: 'https://standardebooks.org/feeds/atom/new-releases',
  },
  {
    gap: 'lowlevel', id: 'gutenberg-latest', kind: 'feed', license: 'PD (미국 기준)',
    label: 'Project Gutenberg — 최근 등록',
    url: 'https://www.gutenberg.org/cache/epub/feeds/today.rss',
  },
  {
    gap: 'lowlevel', id: 'wikibooks-wikijunior', kind: 'api', license: 'CC BY-SA',
    label: 'Wikijunior (Wikibooks) — 아동용 논픽션',
    url: 'https://en.wikibooks.org/w/api.php?action=query&prop=categoryinfo&titles=Category:Wikijunior&format=json',
    total: (j) => Object.values(j?.query?.pages ?? {})[0]?.categoryinfo?.pages ?? null,
  },
  {
    gap: 'lowlevel', id: 'simple-wp-all', kind: 'api', license: 'CC BY-SA',
    label: 'Simple English Wikipedia — 전체 문서 수 (품질 카테고리 밖 상류)',
    url: 'https://simple.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json',
    total: (j) => j?.query?.statistics?.articles ?? null,
  },
  {
    gap: 'lowlevel', id: 'ck12', kind: 'discover', license: 'CC BY-NC (NC = 상업 불가 주의)',
    label: 'CK-12 — 중고교 과목 교재',
    url: 'https://www.ck12.org/',
  },

  // ── ③ 죽은 소스 대체 ────────────────────────────────────────────
  {
    gap: 'dead', id: 'pmc-oa', kind: 'api', license: 'OA subset 만 CC — 논문별 확인 필요',
    label: 'PubMed Central OA subset — nih 대체',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=open+access[filter]&retmode=json&retmax=3',
    total: (j) => Number(j?.esearchresult?.count ?? 0) || null,
  },
  {
    gap: 'dead', id: 'medlineplus-alt', kind: 'feed', license: 'PD (미 연방정부)',
    label: 'MedlinePlus — 건강 주제 XML (whatsnew 대신)',
    url: 'https://medlineplus.gov/feeds/topics_en.xml',
  },
  {
    gap: 'dead', id: 'cdc', kind: 'discover', license: 'PD (미 연방정부)',
    label: 'CDC — 감염·공중보건',
    url: 'https://www.cdc.gov/',
  },
  {
    gap: 'dead', id: 'nps', kind: 'discover', license: 'PD (미 연방정부)',
    label: 'National Park Service — 자연·역사 서사',
    url: 'https://www.nps.gov/',
  },

  // ── ④ 게이트웨이 — 소재 탐색용 (직접 지문 소스는 아니다) ─────────
  {
    gap: 'depth', id: 'doaj', kind: 'api', license: '논문별 CC 표기',
    label: 'DOAJ — OA 저널 색인',
    url: 'https://doaj.org/api/search/articles/*?pageSize=1',
    total: (j) => j?.total ?? null,
  },
  {
    gap: 'depth', id: 'openalex', kind: 'api', license: '메타데이터 CC0 (본문 아님)',
    label: 'OpenAlex — 학술 인덱스',
    url: 'https://api.openalex.org/works?filter=open_access.is_oa:true&per-page=1',
    total: (j) => j?.meta?.count ?? null,
  },
  {
    gap: 'depth', id: 'doab', kind: 'api', license: 'OA 단행본 — 책별 CC',
    label: 'DOAB — OA 학술 단행본 (수능 A층 대체 후보)',
    url: 'https://directory.doabooks.org/rest/search?query=*&expand=metadata&limit=1',
    total: (j) => (Array.isArray(j) ? j.length : null),
  },
  {
    gap: 'depth', id: 'peerj', kind: 'discover', license: 'CC BY',
    label: 'PeerJ — 생물·의학 OA',
    url: 'https://peerj.com/articles/',
  },
  {
    gap: 'depth', id: 'openstax', kind: 'discover', license: 'CC BY (모듈은 저장소에 이미 있음)',
    label: 'OpenStax — 대학 교재 (ingestFromPressbooks 경로 존재)',
    url: 'https://openstax.org/',
  },

  // ── ⑤ 라이선스 주장 확인만 — 배선 후보 아님 ──────────────────────
  {
    gap: 'verify', id: 'knowable', kind: 'discover', license: 'CC BY-ND 주장 → ND 면 the_conversation 과 같은 운명',
    label: 'Knowable Magazine',
    url: 'https://knowablemagazine.org/',
  },
  {
    gap: 'verify', id: 'quanta', kind: 'feed', license: 'CC BY-NC-ND 주장 → NC+ND 이면 불가',
    label: 'Quanta Magazine',
    url: 'https://api.quantamagazine.org/feed/',
  },
  {
    gap: 'verify', id: 'eurekalert', kind: 'discover', license: '보도자료 — AAAS 이용약관 확인 필요',
    label: 'EurekAlert!',
    url: 'https://www.eurekalert.org/',
  },
  {
    gap: 'verify', id: 'sciencedaily', kind: 'feed', license: '집계 매체 — 대개 ©',
    label: 'ScienceDaily',
    url: 'https://www.sciencedaily.com/rss/all.xml',
  },
  {
    gap: 'verify', id: 'phys-org', kind: 'feed', license: '집계 매체 — 대개 ©',
    label: 'Phys.org',
    url: 'https://phys.org/rss-feed/',
  },
]

const targets = onlyGap ? CANDIDATES.filter((c) => c.gap === onlyGap) : CANDIDATES

/** 페이지에서 라이선스 **근거 문자열**을 찾는다. 판정이 아니라 사람이 읽을 단서다. */
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
function licenseEvidence(html) {
  const hits = []
  for (const [re, name] of LICENSE_MARKS) if (re.test(html)) hits.push(name)
  return hits
}

async function get(url, accept) {
  const res = await fetchWithTimeout(url, { accept, timeoutMs: 25_000 })
  return { status: res.status, body: await res.text() }
}

async function probe(c) {
  try {
    if (c.kind === 'api') {
      const { status, body } = await get(c.url, 'application/json')
      if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
      if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
      let j
      try {
        j = JSON.parse(body)
      } catch {
        return { verdict: 'dead', note: 'JSON 아님' }
      }
      return {
        verdict: 'api',
        total: c.total ? c.total(j) : null,
        sample: c.sample ? c.sample(j).slice(0, 3) : [],
      }
    }

    if (c.kind === 'feed') {
      const { status, body } = await get(c.url)
      if (status === 403 || status === 429) return { verdict: 'blocked', note: `HTTP ${status}` }
      if (status >= 400) return { verdict: 'dead', note: `HTTP ${status}` }
      const items = parseRssFeed(body)
      return {
        verdict: items.length ? 'rss' : 'dead',
        items: items.length,
        note: items.length ? null : '항목 0건',
        sample: items.slice(0, 3).map((i) => i.title),
        licenseHits: licenseEvidence(body),
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
            licenseHits,
          }
      } catch {
        // 발행사가 낡은 주소를 알리는 일이 흔하다 — 다음 후보를 본다.
      }
    }
    const items = parseSectionPage(body, c.url, Date.now())
    if (items.length > 0)
      return {
        verdict: 'section',
        items: items.length,
        found: c.url,
        sample: items.slice(0, 3).map((i) => i.title),
        licenseHits,
      }
    return { verdict: 'dead', note: '피드 알림 없음 · 목록 파싱 0건', licenseHits }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { verdict: 'dead', note: /timeout|abort/i.test(msg) ? '타임아웃' : msg }
  }
}

const MARK = { rss: '✓', api: '✓', section: '◐', blocked: '⛔', dead: '✗' }
const results = []
let gap = null
for (const c of targets) {
  if (c.gap !== gap) {
    gap = c.gap
    console.log(`\n── ${gap} ─────────────────────────────`)
  }
  const r = await probe(c)
  results.push({ ...c, url: c.url, total: undefined, sample: undefined, ...r })
  const size =
    r.total != null ? `${r.total.toLocaleString()}편` : r.items != null ? `${r.items}건` : ''
  console.log(
    `${MARK[r.verdict] ?? '?'} ${c.id}`.padEnd(28) +
      size.padEnd(14) +
      (r.note ?? '') +
      (r.licenseHits?.length ? `  [근거: ${r.licenseHits.join(' · ')}]` : '') +
      (r.found && r.found !== c.url ? `\n    → ${r.found}` : ''),
  )
  if (r.sample?.length) for (const s of r.sample) console.log(`      · ${String(s).slice(0, 96)}`)
}

// ── 라이선스 근거 페이지 별도 확인 (feed 본문에 안 실리는 경우) ─────
for (const c of targets.filter((x) => x.licenseUrl)) {
  try {
    const { status, body } = await get(c.licenseUrl, 'text/html')
    const hits = licenseEvidence(body)
    const row = results.find((r) => r.id === c.id)
    if (row) row.licensePageHits = hits
    console.log(`\n라이선스 페이지 ${c.id} (HTTP ${status}): ${hits.join(' · ') || '근거 없음'}`)
  } catch {
    console.log(`\n라이선스 페이지 ${c.id}: 확인 실패`)
  }
}

fs.writeFileSync(outPath, JSON.stringify({ measured_at: new Date().toISOString(), results }, null, 2))
console.log(`\n→ ${outPath}`)
