// scripts/csat/source-get/global_voices-fetch.mjs
//
// Global Voices (globalvoices.org) 영어 기사 파일럿 수집기 — DB 에 쓰지 않는다.
// 경로: WordPress REST `/wp-json/wp/v2/posts` (공개, robots.txt 는 /wp-admin/ /wp-includes/ /site/ 만 막는다).
// 라이선스: 기사 페이지 푸터 `<a rel='license' href='https://creativecommons.org/licenses/by/3.0/'>` 를
//   기사마다 직접 확인한다(license_evidence='page'). 확인 못 하면 그 기사는 건너뛴다.
// 재실행 안전: 읽기 전용 GET, 요청 간 ≥1초.
//
// 실행: node scripts/csat/source-get/global_voices-fetch.mjs --out <dir> --limit 20 [--page 1]

import fs from 'node:fs'
import path from 'node:path'

const UA = 'VocaflowSourceGet/1.0 (killerapp51@empal.com)'
const BASE = 'https://globalvoices.org'
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const OUT = arg('out', '.')
const LIMIT = Number(arg('limit', 20))
const START_PAGE = Number(arg('page', 1))

// 요청 간격 — 기본 2.5초. 2026-09-25 파일럿에서 1.1초·병렬 ~90요청 뒤 사이트가 IP 를 반나절 끊었다.
const GAP_MS = Math.max(1100, Number(arg('gap', 2500)))

let last = 0
async function get(url) {
  const wait = last + GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-z]+;/g, ' ')
}

function htmlToProse(html) {
  const cleaned = html
    .replace(/<(script|style|figure|figcaption|blockquote class="twitter[^"]*"|table)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<div class="[^"]*(wp-caption|embed|related)[^"]*"[\s\S]*?<\/div>/gi, ' ')
  const paras = []
  for (const m of cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (/^(read more|this (story|post) is part of|see also|photo:|image:|screenshot)/i.test(t)) continue
    if (/\b(image|photo|screenshot)\b.{0,80}\b(via|by|from|courtesy)\b.{0,120}(CC BY|used with permission|public domain|fair use)/i.test(t)) continue
    if (t.split(' ').length < 6) continue
    paras.push(t)
  }
  return paras.join('\n\n')
}

async function main() {
  const robots = await (await get(`${BASE}/robots.txt`)).text()
  const blocked = /Disallow:\s*\/wp-json/i.test(robots)
  console.log(`robots.txt: wp-json ${blocked ? 'DISALLOWED' : 'allowed'}`)
  if (blocked) process.exit(1)

  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, 'ft-global_voices-samples.json')
  // 이어받기 — 2026-09-25 에 194편째 502 한 번으로 전량이 날아갔다(끝에서만 저장했다).
  //   이제 20편마다 저장하고, 다시 돌리면 이미 받은 id 는 건너뛴다.
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  const have = new Set(out.map((r) => String(r.id)))
  const save = () => fs.writeFileSync(file, JSON.stringify(out, null, 2))
  let failed = 0
  let page = START_PAGE
  // 페이지 상한은 목표 편수에서 잡는다 — 예전 `+10` 은 200편에서 멈췄다(짧은 글·라이선스 없음 건너뜀 포함 여유 3배).
  const MAX_PAGE = START_PAGE + Math.ceil((LIMIT * 3) / 20)
  while (out.length < LIMIT && page < MAX_PAGE) {
    const url = `${BASE}/wp-json/wp/v2/posts?per_page=20&page=${page}&_embed=author&_fields=id,date,link,title,content,_links,_embedded`
    let posts
    try {
      posts = await (await get(url)).json()
    } catch (e) {
      console.log(`목록 실패 page ${page}: ${e.message} — 30초 뒤 한 번 더`)
      await new Promise((r) => setTimeout(r, 30000))
      try { posts = await (await get(url)).json() } catch { console.log('목록 재시도 실패 — 멈춘다(받은 것은 저장됨)'); break }
    }
    if (!posts.length) break
    for (const p of posts) {
      if (out.length >= LIMIT) break
      if (have.has(String(p.id))) continue
      const body = htmlToProse(p.content?.rendered ?? '')
      const words = body ? body.split(/\s+/).length : 0
      if (words < 150) continue
      let html
      try {
        html = await (await get(p.link)).text()
      } catch (e) {
        // 글 하나의 5xx 는 건너뛴다 — 수집 전체를 멈추지 않는다. 다음 실행이 다시 시도한다.
        failed++
        console.log(`skip (${e.message.split(' ')[0]}): ${p.link}`)
        continue
      }
      const lic = html.match(/rel=['"]license['"][^>]*href=['"](https:\/\/creativecommons\.org\/licenses\/[^'"]+)['"][^>]*title=['"]([^'"]+)['"]/i)
      if (!lic) {
        console.log(`skip (no license on page): ${p.link}`)
        continue
      }
      out.push({
        // 원천 접두어를 붙이지 않는다 — 적재기가 `global_voices:` 를 붙인다(겹치면 `global_voices:global_voices:…`).
        id: String(p.id),
        title: decode(p.title?.rendered ?? '').trim(),
        url: p.link,
        license: `${lic[2]} (${lic[1]})`,
        license_evidence: 'page',
        published_at: p.date ? `${p.date}Z` : null,
        author: p._embedded?.author?.[0]?.name ?? null,
        body_text: body,
        words,
      })
      have.add(String(p.id))
      console.log(`ok ${out.length}/${LIMIT} ${words}w ${p.link}`)
      if (out.length % 20 === 0) save()
    }
    page++
  }
  save()
  console.log(`wrote ${out.length} → ${file} · 글 실패(건너뜀) ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
