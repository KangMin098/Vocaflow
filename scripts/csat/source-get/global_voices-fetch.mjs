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

let last = 0
async function get(url) {
  const wait = last + 1100 - Date.now()
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

  const out = []
  let page = START_PAGE
  while (out.length < LIMIT && page < START_PAGE + 10) {
    const url = `${BASE}/wp-json/wp/v2/posts?per_page=20&page=${page}&_embed=author&_fields=id,date,link,title,content,_links,_embedded`
    const posts = await (await get(url)).json()
    if (!posts.length) break
    for (const p of posts) {
      if (out.length >= LIMIT) break
      const body = htmlToProse(p.content?.rendered ?? '')
      const words = body ? body.split(/\s+/).length : 0
      if (words < 150) continue
      const html = await (await get(p.link)).text()
      const lic = html.match(/rel=['"]license['"][^>]*href=['"](https:\/\/creativecommons\.org\/licenses\/[^'"]+)['"][^>]*title=['"]([^'"]+)['"]/i)
      if (!lic) {
        console.log(`skip (no license on page): ${p.link}`)
        continue
      }
      out.push({
        id: `global_voices:${p.id}`,
        title: decode(p.title?.rendered ?? '').trim(),
        url: p.link,
        license: `${lic[2]} (${lic[1]})`,
        license_evidence: 'page',
        published_at: p.date ? `${p.date}Z` : null,
        author: p._embedded?.author?.[0]?.name ?? null,
        body_text: body,
        words,
      })
      console.log(`ok ${out.length}/${LIMIT} ${words}w ${p.link}`)
    }
    page++
  }
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, 'ft-global_voices-samples.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`wrote ${out.length} → ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
