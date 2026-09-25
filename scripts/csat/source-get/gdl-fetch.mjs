// scripts/csat/source-get/gdl-fetch.mjs
//
// Global Digital Library (digitallibrary.io) 영어 이야기책 표본.
// ⚠️ 예전 `api.digitallibrary.io/book-api/v1` 은 DNS 가 없다(2026-09-25 실측) — 사이트가 WordPress 로 옮겨졌다.
// 지금 경로:
//   1) 목록  content.digitallibrary.io/wp-json/wp/v2/book?language=1523(en)&topic=1910(library-books)
//            책마다 `license`(택소노미 id) · `topic`(level-1..6 id) · slug 가 있다.
//   2) 본문  digitallibrary.io/book/<slug>/ 페이지의 `epubUrl`
//            (= content.digitallibrary.io/wp-json/epub-generator/v1/book/<h5p id>) → EPUB 의 쪽 xhtml.
//   첫 쪽(제목·지은이)과 끝의 판권·출판사 소개 쪽은 버린다.
//
// 사용: node scripts/csat/source-get/gdl-fetch.mjs --out <dir> --limit 20

import { inflateRawSync } from 'node:zlib'
import { parseArgs, politeFetch, readRobots, countWords, writeSamples } from './_common.mjs'

const WP = 'https://content.digitallibrary.io/wp-json/wp/v2'
const LANG_EN = 1523
const TOPIC_LIBRARY_BOOKS = 1910
const LEVEL_TOPICS = { 1911: 'level-1', 1912: 'level-2', 1913: 'level-3', 1914: 'level-4', 1915: 'level-5', 1916: 'level-6', 1943: 'emergent-readers' }
const BOILER = /(rights reserved|licen[sc]ed|creativecommons|Pratham Books|StoryWeaver|Room to Read|Pum Anh Lao|Let.?s ?Read|letsreadasia|not-for-profit|non-?profit|This is a Level \d book|Story Attribution|Illustration Attribution|Disclaimer|Global Digital Library|USAID|received assistance|\(English\)|wordless book|www\.|https?:\/\/)/i

/** 의존성 없는 최소 ZIP 읽기(중앙 디렉터리 기준). */
function unzip(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('ZIP 아님')
  const n = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let k = 0; k < n; k++) {
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen
    if (!/\.(xhtml|opf)$/.test(name)) continue
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + csize)
    files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'))
  }
  return files
}

function decode(s) {
  return s
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

function epubPages(buf) {
  const files = unzip(buf)
  const opf = [...files.entries()].find(([k]) => k.endsWith('.opf'))?.[1] ?? ''
  const hrefs = new Map([...opf.matchAll(/<item id="([^"]+)" href="([^"]+\.xhtml)"/g)].map((m) => [m[1], m[2]]))
  const order = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => hrefs.get(m[1])).filter(Boolean)
  return order.map((h) => {
    const x = [...files.entries()].find(([k]) => k.endsWith('/' + h) || k === h)?.[1] ?? ''
    const body = x.replace(/[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*/i, '')
    return decode(body.replace(/<img[\s\S]*?\/>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/­/g, '').replace(/\s+/g, ' ').trim()
  })
}

/** 쪽 안에서 판권·출판사 소개가 시작되는 문장부터 잘라 낸다. */
function cutBoiler(page) {
  const sents = page.split(/(?<=[.!?”"])\s+/)
  const i = sents.findIndex((s) => BOILER.test(s))
  return (i < 0 ? sents : sents.slice(0, i)).join(' ').trim()
}

/** 첫 쪽(제목)과 `Author:` 쪽을 버리고, 판권 쪽은 앞뒤 어디든 빼고, 끝 두 쪽은 문장 단위로 자른다. */
function storyText(pages) {
  let author = null
  const ps = []
  pages.forEach((p, i) => {
    const a = p.match(/Author:\s*(.+?)(?:\s+Illustrator:|\s+Translator:|$)/)
    if (a) { author ??= a[1].replace(/\s+/g, ' ').trim(); return }
    if (i === 0 || !p || BOILER.test(p) && cutBoiler(p).length < 20) return
    ps.push(p)
  })
  for (let k = Math.max(0, ps.length - 2); k < ps.length; k++) ps[k] = cutBoiler(ps[k])
  return { text: ps.filter(Boolean).join('\n\n'), author }
}

async function main() {
  const { out, limit } = parseArgs()
  const robots = [await readRobots('https://content.digitallibrary.io'), await readRobots('https://digitallibrary.io')]
  const licTerms = await politeFetch(`${WP}/license?per_page=100&_fields=id,slug,name`, { as: 'json' })
  const licName = new Map(licTerms.map((t) => [t.id, t.slug]))
  const samples = []
  for (let page = 1; samples.length < limit && page <= 20; page++) {
    const books = await politeFetch(
      `${WP}/book?language=${LANG_EN}&topic=${TOPIC_LIBRARY_BOOKS}&per_page=20&page=${page}&_fields=id,slug,link,title,license,topic,customMeta`,
      { as: 'json' },
    )
    if (!books.length) break
    for (const b of books) {
      if (samples.length >= limit) break
      const pageUrl = `https://digitallibrary.io/book/${b.slug}/`
      let html
      try { html = await politeFetch(pageUrl) } catch (e) { console.warn('페이지 실패', b.slug, e.message); continue }
      const epub = html.match(/epub-generator\/v1\/book\/(\d+)/)?.[1]
      if (!epub) { console.warn('epub 없음', b.slug); continue }
      let text, author
      try {
        ;({ text, author } = storyText(epubPages(await politeFetch(`https://content.digitallibrary.io/wp-json/epub-generator/v1/book/${epub}`, { as: 'buffer' }))))
      } catch (e) { console.warn('epub 실패', b.slug, e.message); continue }
      if (countWords(text ?? '') < 15) { console.warn('본문 15어 미만(글 없는 그림책 등) 건너뜀', b.slug); continue }
      const lic = (b.license ?? []).map((id) => licName.get(id)).filter(Boolean)
      const level = (b.topic ?? []).map((id) => LEVEL_TOPICS[id]).filter(Boolean)
      samples.push({
        id: `gdl:${b.id}`,
        title: decode(b.title?.rendered ?? '') || null,
        url: pageUrl,
        license: lic.length ? lic.join(',') : null,
        license_evidence: lic.length ? 'api' : 'collection-default',
        level: level.length ? level.join(',') : null,
        author,
        body_text: text,
        words: countWords(text),
      })
    }
  }
  writeSamples(out, 'gdl', samples, { robots })
}

main().catch((e) => { console.error(e); process.exit(1) })
