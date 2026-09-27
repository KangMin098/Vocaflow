// scripts/csat/source-get/eia_kids-fetch.mjs
//
// EIA Energy Kids (www.eia.gov/kids/) 설명문 표본 — 미국 연방정부 저작물(Public Domain).
// 근거: https://www.eia.gov/about/copyrights_reuse.php ("public domain ... may be used freely").
// 경로:
//   1) 목록  sitemap.xml 에 /kids/ 가 없어서(2026-09-25 실측) 페이지마다 있는 왼쪽 메뉴(#kidsMenu)를
//            BFS 로 따라간다. /kids/ 밖으로는 나가지 않는다.
//   2) 본문  #primary 안의 #article-intro · #article-body 에서 <p> · <li> 만.
//            그림 캡션(.image) · 출처 각주(.footnote-or-source · .footnotes) · 「back to top」·
//            쪽 안 목차(#article-intro 의 앵커 목록) · 「Ask Energy Ant」 는 버린다.
//   게임·퀴즈·교사용·용어집·연표 표·통계 쪽은 산문이 적어 목록에서 뺀다.
//
// 사용: node scripts/csat/source-get/eia_kids-fetch.mjs --out <dir> --limit 20

import { parseArgs, politeFetch, readRobots, countWords, writeSamples, setGap } from './_common.mjs'

const ORIGIN = 'https://www.eia.gov'
const ROOT = `${ORIGIN}/kids/`
const HARD_CAP = 1000
const MIN_WORDS = 120
// 연표(history-of-energy/timelines/*)는 연도 목록이라 뺀다. 절 첫 쪽(energy-sources/ 등)은 하위 쪽 안내뿐이다.
const SECTION_HUB = /\/kids\/(what-is-energy|energy-sources|using-and-saving-energy|history-of-energy)\/$/
const SKIP = /\/kids\/(history-of-energy\/timelines\/.|games-and-activities|for-teachers|glossary|awards|contact|link_to_us|privacy|index\.php|energy-sources\/statistics\.php|what-is-energy\/periodic-table\.php|styles|static|images)/

function decode(s) {
  return s
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&raquo;|&#187;/g, '»')
    .replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”').replace(/&deg;/g, '°')
    .replace(/&divide;/g, '÷').replace(/&times;/g, '×').replace(/&reg;/g, '®').replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

const clean = (h) => decode(h.replace(/<sup>(\d+)<\/sup>(?!\s*[A-Za-z])/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** 쪽 URL 목록 — 메뉴의 href 를 <base href="/kids/"> 기준으로 푼다. */
function kidsLinks(html) {
  const out = new Set()
  const menu = html.match(/<ul id="kidsMenu"[\s\S]*?<div id="primary">/)?.[0] ?? html
  for (const m of menu.matchAll(/href="([^"#?]+)"/g)) {
    const u = new URL(m[1], ROOT).href
    if (u.startsWith(ROOT) && /(\/|\.php)$/.test(u) && !SKIP.test(u)) out.add(u)
  }
  return out
}

function extract(html) {
  let main = html.match(/<div id="primary">([\s\S]*?)<!--end article content-->/)?.[1] ?? ''
  const title = clean(main.match(/<div id="contentTopper-text">[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '') || null
  main = main
    .replace(/<div id="contentTopper"[\s\S]*?<\/div>\s*<\/div>/g, ' ')
    .replace(/<div class="clearfix divided">[\s\S]*?<!--\/ clearfix container for split lists -->/g, ' ')
    // 그림 상자는 통째로 지우지 않는다 — 캡션 없는 차트 상자에서 비탐욕 매치가 다음 캡션까지 본문을 삼켰다.
    .replace(/<div class="image-title">[\s\S]*?<\/div>/g, ' ')
    .replace(/<div class="image-caption">[\s\S]*?<\/div>/g, ' ')
    .replace(/<div class="footnotes">[\s\S]*?<\/div>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<p class="(footnote-or-source|click-to-enlarge)"[\s\S]*?<\/p>/g, ' ')
    .replace(/<a class="section-end"[\s\S]*?<\/a>/g, ' ')
    .replace(/<table[\s\S]*?<\/table>/g, ' ')
  // 목록은 한 문단으로 — 짧은 항목(「Coal」)이 낱낱이 빠지거나 한 줄 문단이 되지 않게. 안쪽 목록부터.
  for (let guard = 0; /<ul\b/.test(main) && guard < 20; guard++) {
    main = main.replace(/<ul\b[^>]*>((?:(?!<ul\b)[\s\S])*?)<\/ul>/g, (_, inner) => {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)(?=<\/li>|<li\b|$)/g)].map((m) => clean(m[1])).filter(Boolean)
      if (!items.length) return ' '
      const joined = items.every((t) => /[.!?:]$/.test(t)) ? items.join(' ') : items.join('; ') + '.'
      return `</p><p>${joined}</p>`
    })
  }
  const paras = []
  let more = 0
  for (const m of main.matchAll(/<p\b[^>]*>([\s\S]*?)(?=<\/p>|<p\b|<\/div>)/g)) {
    const t = clean(m[1])
    if (!t || /^(Source|Data source|Click to enlarge|back to top)\b/i.test(t)) continue
    if (/^(More|Learn more)\b[^.]*»$/i.test(t)) { more++; continue }
    paras.push(t)
  }
  // 「More about … »」 가 둘 이상이면 하위 쪽으로 가는 허브 쪽이다 — 본문으로 쓰지 않는다.
  return { title, hub: more >= 2, text: paras.filter((p, i) => paras.indexOf(p) === i).join('\n\n') }
}

async function main() {
  const { out, limit } = parseArgs()
  setGap(1500)
  const robots = await readRobots(ORIGIN)
  if (robots.present && /Disallow:\s*\/kids\b/i.test(robots.excerpt)) throw new Error('robots.txt 가 /kids/ 를 막는다')
  const cap = Math.min(limit, HARD_CAP)
  const queue = [ROOT]
  const seen = new Set(queue)
  const samples = []
  while (queue.length && samples.length < cap) {
    const url = queue.shift()
    let html
    try { html = await politeFetch(url) } catch (e) { console.warn('실패', url, e.message); continue }
    for (const u of kidsLinks(html)) if (!seen.has(u)) { seen.add(u); queue.push(u) }
    if (url === ROOT || SECTION_HUB.test(url)) continue
    const { title, text, hub } = extract(html)
    if (hub) { console.warn('허브 쪽 — 건너뜀', url); continue }
    const words = countWords(text)
    if (words < MIN_WORDS) { console.warn(`산문 ${words}어 — 건너뜀`, url); continue }
    const path = url.slice(ROOT.length).replace(/\.php$|\/$/g, '')
    samples.push({
      id: `eia_kids:${path}`,
      title,
      url,
      license: 'Public Domain (U.S. Government work)',
      license_evidence: 'page: https://www.eia.gov/about/copyrights_reuse.php',
      published_at: null,
      author: 'U.S. Energy Information Administration',
      level: 'kids',
      body_text: text,
      words,
    })
  }
  console.log(`메뉴에서 찾은 쪽 ${seen.size - 1}개(건너뛴 범주 제외)`)
  writeSamples(out, 'eia_kids', samples, { robots, discovered: seen.size - 1 })
}

main().catch((e) => { console.error(e); process.exit(1) })
