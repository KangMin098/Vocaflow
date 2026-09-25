// scripts/csat/source-get/nih_news_in_health-fetch.mjs
//
// NIH News in Health (newsinhealth.nih.gov) 월간 소식지 기사 표본.
// 라이선스: 사이트 「About」 — "NIH News in Health is not copyrighted"(사진·그림 제외) → 글은 PD.
//
// ⚠️ 원 사이트는 Cloudflare 관리형 챌린지(JS 필요) 뒤에 있다 — 브라우저 UA·Accept 헤더로도
//    robots.txt · sitemap.xml · RSS · 기사 모두 403 `cf-mitigated: challenge`(2026-09-25 실측).
//    챌린지를 우회하지 않고 Internet Archive(Wayback) 사본을 읽는다:
//   1) 목록  web.archive.org/cdx 의 newsinhealth.nih.gov 캡처 중 /YYYY/MM/<slug> 모양만.
//            아포스트로피 표기만 다른 쌍(can-t / cant)은 하이픈을 뺀 키로 하나로 합친다.
//   2) 본문  web.archive.org/web/2026id_/<원 URL>(id_ = 원본 HTML, 가장 가까운 캡처).
//            </h1> 뒤 대표 그림 다음부터 <aside> 앞까지의 <p> + 사이드바 「Wise Choices」 상자(산문·목록).
//            「Find More Information」 · 「References」 · 「Featured Stories」 · 그림 캡션은 버린다.
//   published_at = URL 의 호(issue) 연·월 1일.
//
// 사용: node scripts/csat/source-get/nih_news_in_health-fetch.mjs --out <dir> --limit 20

import { parseArgs, politeFetch, readRobots, countWords, writeSamples, setGap } from './_common.mjs'

const SITE = 'https://newsinhealth.nih.gov'
const HARD_CAP = 1000
const MIN_WORDS = 150
const CDX = 'https://web.archive.org/cdx/search/cdx?url=newsinhealth.nih.gov/&matchType=domain&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&fl=original'

function decode(s) {
  return s
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&hellip;/g, '…').replace(/&reg;/g, '®')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

const clean = (h) => decode(h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** 목록을 한 문단으로(항목이 모두 문장이면 이어 쓰고, 아니면 ; 로). */
function flattenLists(html) {
  let h = html
  for (let guard = 0; /<ul\b/.test(h) && guard < 20; guard++) {
    h = h.replace(/<ul\b[^>]*>((?:(?!<ul\b)[\s\S])*?)<\/ul>/g, (_, inner) => {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)(?=<\/li>|<li\b|$)/g)].map((m) => clean(m[1])).filter(Boolean)
      if (!items.length) return ' '
      const joined = items.every((t) => /[.!?:”"]$/.test(t)) ? items.join(' ') : items.join('; ') + '.'
      return `</p><p>${joined}</p>`
    })
  }
  return h
}

function paragraphs(html) {
  const out = []
  for (const m of flattenLists(html).matchAll(/<p\b[^>]*>([\s\S]*?)(?=<\/p>|<p\b|<\/div>|<h\d)/g)) {
    const t = clean(m[1])
    if (t) out.push(t)
  }
  return out
}

function extract(html) {
  const title = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '') || null
  const afterH1 = html.split(/<\/h1>/)[1] ?? ''
  // 사이드바가 없는 쪽(「Featured Website」)은 <aside> 가 없어 바닥글까지 딸려 왔다 — footer 에서도 끊는다.
  const [mainPart] = afterH1.split(/<aside\b|<footer\b|<h3 class="header-with-rule"/)
  const sidePart = afterH1.split(/<aside\b/)[1]?.split(/<footer\b/)[0] ?? ''
  let main = mainPart
    .replace(/<p class="subtitle">[\s\S]*?<\/p>/, ' ')
    .replace(/<div class="group-page-tools[\s\S]*?<\/div>/, ' ')
    .replace(/<article class="image[\s\S]*?<\/article>/g, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/g, ' ')
    .replace(/<p class="(edition-[^"]*|caption[^"]*)"[\s\S]*?<\/p>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  const body = paragraphs(main)
  const wise = []
  for (const m of sidePart.matchAll(/clearfix wise-choices">([\s\S]*?)(?=<div class="paragraph|<\/aside>)/g)) {
    wise.push(...paragraphs(m[1].replace(/<h3[\s\S]*?<\/h3>|<h4[\s\S]*?<\/h4>/g, ' ')))
  }
  const paras = [...body, ...wise].filter((p, i, a) => a.indexOf(p) === i && !/^(Print this issue|En español|Send us your comments)/i.test(p))
  return { title, text: paras.join('\n\n'), wise: wise.length > 0 }
}

/** Wayback 은 부하가 걸리면 503/429 를 잠깐 낸다 — 15초·30초 쉬고 두 번 더 묻는다. */
async function archiveFetch(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await politeFetch(`https://web.archive.org/web/2026id_/${url}`)
    } catch (e) {
      if (attempt >= 2 || !/^(5\d\d|429) |fetch failed/.test(String(e.message))) throw e
      await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)))
    }
  }
}

async function main() {
  const { out, limit } = parseArgs()
  setGap(1500)
  const robots = {
    site: await readRobots(SITE),
    archive: await readRobots('https://web.archive.org'),
    note: 'newsinhealth.nih.gov 는 Cloudflare 챌린지로 403 — robots.txt 자체를 읽을 수 없다. Wayback 사본을 읽는다.',
  }
  const cdx = await politeFetch(CDX)
  const byKey = new Map()
  for (const line of cdx.split('\n')) {
    const path = line.trim().replace(/^https?:\/\/newsinhealth\.nih\.gov(:80)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '')
    const m = path.match(/^\/(20\d\d)\/(\d\d)\/([a-z0-9-]+)$/)
    if (!m) continue
    const key = `${m[1]}/${m[2]}/${m[3].replace(/-/g, '')}`
    const prev = byKey.get(key)
    if (!prev || m[3].length < prev.slug.length) byKey.set(key, { y: m[1], mo: m[2], slug: m[3] })
  }
  const list = [...byKey.values()].sort((a, b) => `${b.y}${b.mo}`.localeCompare(`${a.y}${a.mo}`) || a.slug.localeCompare(b.slug))
  console.log(`Wayback 기사 URL ${list.length}개(표기 변형 합침)`)
  const cap = Math.min(limit, HARD_CAP)
  const samples = []
  const titles = new Set()
  for (const it of list) {
    if (samples.length >= cap) break
    const url = `${SITE}/${it.y}/${it.mo}/${it.slug}`
    let html
    try { html = await archiveFetch(url) } catch (e) { console.warn('실패', url, e.message); continue }
    const { title, text, wise } = extract(html)
    const words = countWords(text)
    // 「Featured Website」 소개 꼭지는 다른 사이트 안내 두세 문장뿐이다.
    if (/^Visit the website:/m.test(text)) { console.warn('웹사이트 소개 꼭지 — 건너뜀', url); continue }
    if (!title || words < MIN_WORDS) { console.warn(`본문 ${words}어 — 건너뜀`, url); continue }
    if (titles.has(title)) { console.warn('같은 제목 — 건너뜀', url); continue }
    titles.add(title)
    samples.push({
      id: `nih_news_in_health:${it.y}-${it.mo}-${it.slug}`,
      title,
      url,
      license: 'Public Domain (NIH News in Health — not copyrighted)',
      license_evidence: 'page: https://newsinhealth.nih.gov/about ("not copyrighted"; photos excluded) — fetched via web.archive.org',
      published_at: `${it.y}-${it.mo}-01`,
      author: 'NIH News in Health (NIH Office of Communications and Public Liaison)',
      level: null,
      has_wise_choices: wise,
      body_text: text,
      words,
    })
  }
  writeSamples(out, 'nih_news_in_health', samples, { robots, available: list.length })
}

main().catch((e) => { console.error(e); process.exit(1) })
