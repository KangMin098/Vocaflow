// scripts/csat/source-discovery-probe.mts
//
// **새 원천 후보를 두 관문으로 재고 표본을 뽑는다 — 읽기 전용 · DB 를 건드리지 않는다.**
//
// `scripts/textbook/graded-source-probe.mjs` 가 세운 규율을 그대로 잇는다:
//
//     robots.txt 는 라이선스가 아니다.
//
// Breaking News English 는 robots 가 전면 허용인데 저작권 고지는 판매·부분복사·LMS 게재를
// 전부 금지했다. 그래서 후보마다 **① robots ② 라이선스 고지 ③ 대량 취득 경로** 를 따로 재고,
// 셋을 다 통과한 것만 본문을 표본한다. `ai-train=no` · GPTBot 차단을 선언한 곳은 **재지 않는다** —
// 뜻이 분명한 신호를 넓게 읽는 것은 우리가 할 일이 아니다.
//
// ── 무엇을 재고 무엇을 안 재는가 ─────────────────────────────────────
// 재는 것: HTTP 상태 · 라이선스 문자열 · 목록 가능 편수 · 표본의 어수·FK·문장길이.
// **안 재는 것: 본문.** 저장하지 않고 DB 에 넣지 않는다(저작권 경계 · A1).
//
// 재실행 안전: GET 만 한다. UA 를 밝히고 요청 사이를 띄운다. 같은 out 파일이 있으면 건너뛴다.
//
// 실행: pnpm exec tsx scripts/csat/source-discovery-probe.mts --out <file.json> [--sample 8] [--only key1,key2]

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const req = createRequire(resolve('packages/library-pipeline/package.json'))
const readabilityModule = req('text-readability')
const readability = readabilityModule.default ?? readabilityModule

const UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'

const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const OUT = resolve(argOf('out', 'docs/reports/source-discovery-probe.json'))
const SAMPLE = Number(argOf('sample', '8'))
const ONLY = argOf('only', '').split(',').filter(Boolean)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Fetched = { ok: boolean; status: number; body: string; error?: string; finalUrl?: string }
async function get(url: string, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'): Promise<Fetched> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow' })
    const body = res.ok ? await res.text() : ''
    return { ok: res.ok, status: res.status, body, finalUrl: res.url }
  } catch (e) {
    return { ok: false, status: 0, body: '', error: String((e as Error).message) }
  }
}

/** 라이선스 지문 — 문서에 실제로 박혀 있는 문자열만 본다(추정하지 않는다). */
const LICENSE_SIGNS: [string, RegExp][] = [
  ['CC0', /creativecommons\.org\/publicdomain\/zero|CC0\s*1\.0|public domain dedication/i],
  ['CC-BY-NC-ND', /by-nc-nd|attribution[- ]noncommercial[- ]no ?deriv/i],
  ['CC-BY-NC-SA', /by-nc-sa|attribution[- ]noncommercial[- ]sharealike/i],
  ['CC-BY-NC', /by-nc(?![-a-z])|attribution[- ]noncommercial(?![- ](?:no|share))/i],
  ['CC-BY-ND', /by-nd(?![-a-z])|attribution[- ]no ?deriv/i],
  ['CC-BY-SA', /by-sa(?![-a-z])|attribution[- ]sharealike/i],
  ['CC-BY', /creativecommons\.org\/licenses\/by\/|attribution 4\.0|attribution[- ]only|\bCC[ -]BY\b/i],
  ['PD-Government', /work of the (?:u\.?s\.?|united states) government|not (?:subject to|protected by) copyright|public domain.{0,60}(?:u\.?s\.?|federal) government/i],
  ['ARR', /all rights reserved|may not be reproduced|permission is not granted/i],
]
function licenseSigns(body: string): string[] {
  const text = body.replace(/\s+/g, ' ')
  return LICENSE_SIGNS.filter(([, re]) => re.test(text)).map(([k]) => k)
}

/** robots — 우리 경로를 막는가, AI 이용을 거부하는가. */
function robotsVerdict(body: string, path: string) {
  const aiRefusal = /ai-?train\s*[:=]\s*no|user-?agent:\s*(?:GPTBot|CCBot|anthropic-ai|ClaudeBot|Google-Extended)/i.test(body)
  // `User-agent: *` 블록만 본다 — 다른 봇에 대한 규칙은 우리 것이 아니다.
  const star = body.split(/user-?agent:/i).find((b) => /^\s*\*/.test(b)) ?? ''
  const disallows = [...star.matchAll(/disallow:\s*(\S*)/gi)].map((m) => m[1] ?? '')
  const blocksAll = disallows.includes('/')
  const blocksPath = disallows.some((d) => d && d !== '/' && path.startsWith(d))
  return { aiRefusal, blocksAll, blocksPath, disallowCount: disallows.length }
}

/** 문단만 모은다 — 사이트 크롬을 세면 어수와 FK 가 함께 부푼다(prior probe 와 같은 규칙). */
function paragraphs(html: string): string[] {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      (m[1] ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((t) => t.split(/\s+/).length >= 8)
}

/** 목록 응답에서 기사 URL 을 뽑는다 — RSS/Atom `<link>` · sitemap `<loc>` · JSON 안의 http 문자열. */
function extractUrls(body: string, pattern: RegExp): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) if (m[1]) out.add(m[1])
  for (const m of body.matchAll(/<link[^>]*href="([^"]+)"/gi)) if (m[1]) out.add(m[1])
  for (const m of body.matchAll(/<link>\s*([^<\s]+)\s*<\/link>/gi)) if (m[1]) out.add(m[1])
  for (const m of body.matchAll(/"(https?:\/\/[^"\s]+)"/g)) if (m[1]) out.add(m[1])
  return [...out].filter((u) => pattern.test(u))
}

interface Candidate {
  key: string
  label: string
  /** 기출 소재 8분류 중 이 후보가 메우려는 칸. */
  gap: string[]
  homepage: string
  licenseUrl: string
  /** 우리가 실제로 GET 할 경로(robots 판정의 대상). */
  contentPath: string
  /** 대량 취득 경로. `mode` 가 `none` 이면 후보에서 뺀다. */
  access: { mode: 'api' | 'dump' | 'feed' | 'sitemap' | 'none'; url: string; note?: string }
  /** 목록에서 기사 URL 을 고르는 정규식. */
  articlePattern?: RegExp
  /** 이미 저장소가 판정한 것 — 다시 재지 않는다. */
  priorVerdict?: string
}

const CANDIDATES: Candidate[] = [
  // ── (b) 기관 매체 · 학생 대상 설명문 ─────────────────────────────
  {
    key: 'medlineplus',
    label: 'MedlinePlus (NLM)',
    gap: ['과학·자연', '심리·인지'],
    homepage: 'https://medlineplus.gov',
    licenseUrl: 'https://medlineplus.gov/about/using/usingcontent/',
    contentPath: '/ency/',
    access: { mode: 'sitemap', url: 'https://medlineplus.gov/sitemap.xml', note: 'XML 덤프는 일자 파일명이라 목록부터 읽는다' },
    articlePattern: /medlineplus\.gov\/[a-z0-9-]+\.html$/i,
  },
  {
    key: 'nps',
    label: 'National Park Service',
    gap: ['역사·인류', '과학·자연'],
    homepage: 'https://www.nps.gov',
    licenseUrl: 'https://www.nps.gov/aboutus/disclaimer.htm',
    contentPath: '/articles/',
    access: { mode: 'sitemap', url: 'https://www.nps.gov/sitemap.xml' },
    articlePattern: /nps\.gov\/articles\//i,
    priorVerdict: '2026-09-07 us-gov-agencies §2 — 채택 · 19,634 URL · 표본 채택률 2/4',
  },
  {
    key: 'shareamerica',
    label: 'ShareAmerica (US State Dept)',
    gap: ['사회·경제', '역사·인류'],
    homepage: 'https://share.america.gov',
    licenseUrl: 'https://share.america.gov/about/',
    contentPath: '/',
    access: { mode: 'feed', url: 'https://share.america.gov/feed/' },
    articlePattern: /share\.america\.gov\/[a-z0-9-]{8,}\/?$/i,
  },
  {
    key: 'cdc',
    label: 'CDC',
    gap: ['과학·자연'],
    homepage: 'https://www.cdc.gov',
    licenseUrl: 'https://www.cdc.gov/other/agencymaterials.html',
    contentPath: '/',
    access: { mode: 'api', url: 'https://tools.cdc.gov/api/v2/resources/media?max=10' },
    priorVerdict: '2026-09-07 us-gov-agencies §5 — 보류 · 3,889편 · JSON API',
  },
  // ── (c) 학술 해설 · plain-language ───────────────────────────────
  {
    key: 'peerj',
    label: 'PeerJ',
    gap: ['과학·자연', '심리·인지'],
    homepage: 'https://peerj.com',
    licenseUrl: 'https://peerj.com/about/policies-and-procedures/',
    contentPath: '/articles/',
    access: { mode: 'api', url: 'https://peerj.com/articles/index.json?limit=10' },
    articlePattern: /peerj\.com\/articles\/\d+/i,
  },
  {
    key: 'bmc',
    label: 'BMC (BioMed Central)',
    gap: ['과학·자연'],
    homepage: 'https://www.biomedcentral.com',
    licenseUrl: 'https://www.biomedcentral.com/getpublished/copyright-and-license',
    contentPath: '/articles/',
    access: { mode: 'api', url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PUBLISHER%3A%22BMC%22%20AND%20LICENSE%3A%22cc%20by%22&format=json&pageSize=10', note: 'Europe PMC 경유(이미 배선된 경로)' },
  },
  {
    key: 'nature_comms',
    label: 'Nature Communications / Scientific Reports',
    gap: ['과학·자연'],
    homepage: 'https://www.nature.com/ncomms/',
    licenseUrl: 'https://www.nature.com/nature-portfolio/open-access',
    contentPath: '/articles/',
    access: { mode: 'api', url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=JOURNAL%3A%22Nat%20Commun%22%20AND%20LICENSE%3A%22cc%20by%22&format=json&pageSize=10', note: 'Europe PMC 경유' },
  },
  {
    key: 'knowable',
    label: 'Knowable Magazine',
    gap: ['과학·자연', '사회·경제'],
    homepage: 'https://knowablemagazine.org',
    licenseUrl: 'https://knowablemagazine.org/content/about/reprints',
    contentPath: '/article/',
    access: { mode: 'feed', url: 'https://knowablemagazine.org/rss/all' },
  },
  {
    key: 'undark',
    label: 'Undark Magazine',
    gap: ['과학·자연', '사회·경제'],
    homepage: 'https://undark.org',
    licenseUrl: 'https://undark.org/republish-our-articles/',
    contentPath: '/',
    access: { mode: 'feed', url: 'https://undark.org/feed/' },
  },
  // ── (d) 에세이·논설 (수능 요지·주제 유형 소재) ──────────────────
  {
    key: 'global_voices',
    label: 'Global Voices',
    gap: ['사회·경제', '예술·문화'],
    homepage: 'https://globalvoices.org',
    licenseUrl: 'https://globalvoices.org/about/global-voices-attribution-policy/',
    contentPath: '/',
    access: { mode: 'feed', url: 'https://globalvoices.org/feed/' },
    articlePattern: /globalvoices\.org\/\d{4}\/\d{2}\/\d{2}\//i,
  },
  {
    key: 'wikinews',
    label: 'Wikinews (영문)',
    gap: ['사회·경제'],
    homepage: 'https://en.wikinews.org',
    licenseUrl: 'https://en.wikinews.org/wiki/Wikinews:Copyright',
    contentPath: '/wiki/',
    access: { mode: 'api', url: 'https://en.wikinews.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Published&cmlimit=10&format=json' },
    priorVerdict: 'SOURCE_SPECS 에 이미 있으나 library_articles 0행 — 배선만 없다',
  },
  {
    key: 'aeon',
    label: 'Aeon',
    gap: ['철학·윤리', '심리·인지'],
    homepage: 'https://aeon.co',
    licenseUrl: 'https://aeon.co/republish',
    contentPath: '/essays/',
    access: { mode: 'feed', url: 'https://aeon.co/feed.rss' },
  },
  {
    key: 'sciencedaily',
    label: 'ScienceDaily',
    gap: ['과학·자연'],
    homepage: 'https://www.sciencedaily.com',
    licenseUrl: 'https://www.sciencedaily.com/terms.htm',
    contentPath: '/releases/',
    access: { mode: 'feed', url: 'https://www.sciencedaily.com/rss/all.xml' },
  },
  // ── (a) 교재·공개 교과서 ────────────────────────────────────────
  {
    key: 'openstax',
    label: 'OpenStax',
    gap: ['사회·경제', '철학·윤리', '심리·인지'],
    homepage: 'https://openstax.org',
    licenseUrl: 'https://openstax.org/license',
    contentPath: '/books/',
    access: { mode: 'dump', url: 'https://api.github.com/orgs/openstax/repos?per_page=100&type=public', note: 'osbooks-* CNXML repo' },
    priorVerdict: 'ACP_OPENSTAX_DESIGN §2 — 55 repo 중 영어 CC-BY 원서 2종(Physics·Statistics), 41종 CC-BY-NC-SA',
  },
  {
    key: 'libretexts',
    label: 'LibreTexts',
    gap: ['과학·자연', '사회·경제', '심리·인지'],
    homepage: 'https://libretexts.org',
    licenseUrl: 'https://commons.libretexts.org/',
    contentPath: '/Bookshelves/',
    access: { mode: 'api', url: 'https://chem.libretexts.org/@api/deki/site/search?q=type%3Awiki&limit=10&dream.out.format=json' },
  },
  {
    key: 'noba',
    label: 'Noba Project',
    gap: ['심리·인지'],
    homepage: 'https://nobaproject.com',
    licenseUrl: 'https://nobaproject.com',
    contentPath: '/modules/',
    access: { mode: 'crawl', url: 'https://nobaproject.com/browse-content' } as Candidate['access'],
  },
  {
    key: 'open_textbook_library',
    label: 'Open Textbook Library',
    gap: ['사회·경제', '교육·언어'],
    homepage: 'https://open.umn.edu/opentextbooks',
    licenseUrl: 'https://open.umn.edu/opentextbooks/faq',
    contentPath: '/textbooks/',
    access: { mode: 'api', url: 'https://open.umn.edu/opentextbooks/textbooks.json?per_page=10' },
  },
  {
    key: 'core_econ',
    label: 'CORE Econ',
    gap: ['사회·경제'],
    homepage: 'https://www.core-econ.org',
    licenseUrl: 'https://www.core-econ.org/terms-conditions/',
    contentPath: '/the-economy/',
    access: { mode: 'crawl', url: 'https://www.core-econ.org/the-economy/' } as Candidate['access'],
  },
  {
    key: 'wikibooks',
    label: 'Wikibooks / Wikiversity (영문)',
    gap: ['교육·언어', '과학·자연'],
    homepage: 'https://en.wikibooks.org',
    licenseUrl: 'https://en.wikibooks.org/wiki/Wikibooks:Copyrights',
    contentPath: '/wiki/',
    access: { mode: 'api', url: 'https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=incategory:Book&srlimit=10&format=json' },
  },
  // ── (e) 서사 산문 PD (심경·지칭 유형용) ─────────────────────────
  {
    key: 'standard_ebooks',
    label: 'Standard Ebooks',
    gap: ['예술·문화', '역사·인류'],
    homepage: 'https://standardebooks.org',
    licenseUrl: 'https://standardebooks.org/about',
    contentPath: '/ebooks/',
    access: { mode: 'feed', url: 'https://standardebooks.org/feeds/atom/new-releases' },
    articlePattern: /standardebooks\.org\/ebooks\//i,
  },
  {
    key: 'african_storybook_web',
    label: 'African Storybook',
    gap: ['예술·문화'],
    homepage: 'https://www.africanstorybook.org',
    licenseUrl: 'https://www.africanstorybook.org/about.php',
    contentPath: '/',
    access: { mode: 'dump', url: 'https://api.github.com/repos/global-asp/asp-source/contents', note: 'commit 고정 corpus' },
    priorVerdict: 'registry profile — 파일럿 50편 중 적격 4편(8%) · 자동 수집 금지',
  },
  // ── 기타 확인 대상 ──────────────────────────────────────────────
  {
    key: 'smithsonian',
    label: 'Smithsonian Open Access',
    gap: ['예술·문화', '역사·인류'],
    homepage: 'https://www.si.edu/openaccess',
    licenseUrl: 'https://www.si.edu/termsofuse',
    contentPath: '/object/',
    access: { mode: 'api', url: 'https://api.si.edu/openaccess/api/v1.0/search?q=online_media_type:%22Images%22&rows=1', note: 'API 키 필요' },
  },
  {
    key: 'eol',
    label: 'Encyclopedia of Life',
    gap: ['과학·자연'],
    homepage: 'https://eol.org',
    licenseUrl: 'https://eol.org/docs/what-is-eol/licensing-and-attribution',
    contentPath: '/pages/',
    access: { mode: 'api', url: 'https://eol.org/api/pages/1.0/328598.json?details=true' },
  },
  {
    key: 'worldbank_okr',
    label: 'World Bank Open Knowledge Repository',
    gap: ['사회·경제'],
    homepage: 'https://openknowledge.worldbank.org',
    licenseUrl: 'https://openknowledge.worldbank.org/collections/8b167a40-9e47-4b7a-b23a-31f8ac7e7a1b',
    contentPath: '/entities/',
    access: { mode: 'api', url: 'https://openknowledge.worldbank.org/oai/request?verb=ListRecords&metadataPrefix=oai_dc' },
    priorVerdict: 'source-key.ts 의 GovernedSource 이고 harvest-worldbank.mjs 가 있으나 library_articles 0행',
  },
  {
    key: 'nsf',
    label: 'NSF',
    gap: ['과학·자연', '기술·매체'],
    homepage: 'https://www.nsf.gov',
    licenseUrl: 'https://www.nsf.gov/policies/',
    contentPath: '/news/',
    access: { mode: 'sitemap', url: 'https://www.nsf.gov/sitemap.xml' },
    priorVerdict: '2026-09-07 us-gov-agencies §4 — 보류 · 1,399편',
  },
]

const picked = ONLY.length ? CANDIDATES.filter((c) => ONLY.includes(c.key)) : CANDIDATES

if (existsSync(OUT) && !process.argv.includes('--force')) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8')) as { candidates?: { key: string }[] }
  const done = new Set((prev.candidates ?? []).map((c) => c.key))
  if (picked.every((c) => done.has(c.key))) {
    console.log(`${OUT} 에 이미 전부 있다 — 건너뜀 (재실행 안전). 다시 재려면 --force`)
    process.exit(0)
  }
}

const results: Record<string, unknown>[] = []

for (const c of picked) {
  console.log(`\n── ${c.label}`)
  const origin = new URL(c.homepage).origin

  // ① robots
  const robots = await get(`${origin}/robots.txt`, 'text/plain')
  const rv = robots.ok ? robotsVerdict(robots.body, c.contentPath) : null
  await sleep(600)

  // ② 라이선스 고지
  const lic = await get(c.licenseUrl)
  const signs = lic.ok ? licenseSigns(lic.body) : []
  await sleep(600)

  // ③ 대량 취득 경로
  const acc = c.access.mode === 'none' ? null : await get(c.access.url, 'application/json,application/xml,text/xml,*/*')
  await sleep(600)

  // ④ 표본 — 위 셋을 통과했고 기사 URL 을 뽑을 수 있을 때만.
  const gateOk =
    !!rv && !rv.aiRefusal && !rv.blocksAll && !rv.blocksPath && !signs.includes('ARR') && !!acc?.ok
  let sample: Record<string, unknown> | null = null
  if (gateOk && c.articlePattern && acc) {
    const urls = extractUrls(acc.body, c.articlePattern).slice(0, SAMPLE)
    const words: number[] = []
    const fk: number[] = []
    const sents: number[] = []
    let fetched = 0
    let paraless = 0
    for (const u of urls) {
      const page = await get(u)
      await sleep(900)
      if (!page.ok) continue
      fetched++
      const ps = paragraphs(page.body)
      if (!ps.length) {
        paraless++
        continue
      }
      const text = ps.join(' ')
      const w = text.split(/\s+/).filter(Boolean).length
      if (w < 60) continue
      words.push(w)
      fk.push(+(readability.fleschKincaidGrade(text) as number).toFixed(2))
      sents.push(+(w / Math.max(1, (text.match(/[.!?]["')\]]?\s/g) ?? []).length + 1)).toFixed(1))
    }
    const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]! : null)
    sample = {
      listed: extractUrls(acc.body, c.articlePattern).length,
      attempted: urls.length,
      fetched,
      measured: words.length,
      paragraphless: paraless,
      wordsMedian: med(words),
      wordsMin: words.length ? Math.min(...words) : null,
      wordsMax: words.length ? Math.max(...words) : null,
      fkMedian: med(fk),
      sentenceWordsMedian: med(sents),
      inSpec100to200: words.filter((w) => w >= 100 && w <= 200).length,
    }
  }

  results.push({
    key: c.key,
    label: c.label,
    gap: c.gap,
    homepage: c.homepage,
    priorVerdict: c.priorVerdict ?? null,
    robots: robots.ok
      ? { status: robots.status, ...rv }
      : { status: robots.status, error: robots.error ?? '읽지 못했다' },
    license: {
      url: c.licenseUrl,
      status: lic.status,
      signs,
      note: lic.ok ? null : 'FETCH FAIL — 고지를 못 읽었으면 후보가 아니다',
    },
    access: { ...c.access, status: acc?.status ?? null, bytes: acc?.body.length ?? 0 },
    gateOk,
    sample,
  })
  console.log(
    `   robots ${robots.status}${rv?.aiRefusal ? ' (AI 거부)' : ''} · 라이선스 ${lic.status} [${signs.join(',') || '—'}] · 취득 ${acc?.status ?? '—'} · gate ${gateOk ? 'OK' : 'NO'}${sample ? ` · 표본 ${sample['measured']}편` : ''}`,
  )
}

writeFileSync(
  OUT,
  JSON.stringify(
    { readOnly: true, probedAt: new Date().toISOString(), userAgent: UA, sampleTarget: SAMPLE, candidates: results },
    null,
    2,
  ),
)
console.log(`\n후보 ${results.length}곳 → ${OUT}`)
