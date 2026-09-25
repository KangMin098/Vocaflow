// scripts/csat/source-get/openstax-fetch.mjs
//
// OpenStax 교재(github.com/openstax/osbooks-*) 파일럿 수집기 — DB 에 쓰지 않는다.
// ① GitHub search API(비인증, 요청 적게)로 osbooks-* 저장소 목록 → ② 각 저장소 LICENSE 를
//    raw.githubusercontent.com 에서 읽어 CC BY / CC BY-NC-SA 분류 → <out>/openstax-licenses.json
// ③ CC BY 저장소만 git trees API 로 modules/*/index.cnxml 을 찾아 raw 로 받아 본문 문단만 남긴다
//    (exercise · equation · figure · table · note · 코드 · 용어집 제거).
// robots.txt: api.github.com / raw.githubusercontent.com 모두 404(robots 없음 = 제한 없음).
// 비인증 core 한도 60/h — 트리 조회는 --repos 개(기본 4)만 한다.
// 재실행 안전: 읽기 전용 GET, 요청 간 ≥1초.
//
// 실행: node scripts/csat/source-get/openstax-fetch.mjs --out <dir> --limit 20 [--repos 4]

import fs from 'node:fs'
import path from 'node:path'

const UA = 'VocaflowSourceGet/1.0 (killerapp51@empal.com)'
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const OUT = arg('out', '.')
const LIMIT = Number(arg('limit', 20))
const REPOS = Number(arg('repos', 4))

let last = 0
async function get(url, ok404 = false) {
  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } })
  if (ok404 && res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

function classify(text) {
  if (!text) return 'unknown'
  if (/NonCommercial[- ]ShareAlike|by-nc-sa/i.test(text)) return 'CC BY-NC-SA'
  if (/NonCommercial|by-nc/i.test(text)) return 'CC BY-NC'
  if (/ShareAlike|by-sa/i.test(text)) return 'CC BY-SA'
  if (/Attribution|licenses\/by\//i.test(text)) return 'CC BY'
  return 'unknown'
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-z]+;/g, ' ')
}

function cnxmlToProse(xml) {
  const title = decode(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim()
  let c = xml.match(/<content>([\s\S]*)<\/content>/)?.[1] ?? ''
  for (const tag of ['exercise', 'equation', 'figure', 'table', 'note', 'code', 'media', 'm:math', 'math', 'glossary', 'list', 'example']) {
    const re = new RegExp(`<${tag}\\b[^>]*?(\\/>|>[\\s\\S]*?<\\/${tag}>)`, 'g')
    let prev
    do {
      prev = c
      c = c.replace(re, ' ')
    } while (c !== prev)
  }
  const paras = []
  for (const m of c.matchAll(/<para\b[^>]*>([\s\S]*?)<\/para>/g)) {
    const t = decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (t.split(' ').length >= 12 && /[.!?]["')\]]?$/.test(t)) paras.push(t)
  }
  return { title, body: paras.join('\n\n') }
}

async function main() {
  for (const host of ['https://api.github.com', 'https://raw.githubusercontent.com']) {
    const r = await fetch(`${host}/robots.txt`, { headers: { 'User-Agent': UA } })
    console.log(`robots ${host}: ${r.status}`)
  }
  const repos = []
  for (let page = 1; page <= 3; page++) {
    const j = await (await get(`https://api.github.com/search/repositories?q=org:openstax+osbooks+in:name&per_page=100&page=${page}`)).json()
    repos.push(...j.items.filter((r) => r.name.startsWith('osbooks-')))
    if (j.items.length < 100) break
  }
  repos.sort((a, b) => a.name.localeCompare(b.name))
  console.log(`osbooks repos: ${repos.length}`)

  const table = []
  for (const r of repos) {
    const lic = await get(`https://raw.githubusercontent.com/openstax/${r.name}/${r.default_branch}/LICENSE`, true)
    const text = lic ? await lic.text() : null
    let cls = classify(text)
    let evidence = text ? 'LICENSE' : null
    if (cls === 'unknown') {
      const rd = await get(`https://raw.githubusercontent.com/openstax/${r.name}/${r.default_branch}/README.md`, true)
      const t = rd ? await rd.text() : ''
      const line = t.split('\n').find((l) => /creative ?commons|licen[cs]e/i.test(l)) ?? null
      cls = classify(line)
      evidence = line ? `README: ${line.trim().slice(0, 200)}` : evidence
    }
    const first = text ? text.split('\n').find((l) => l.trim())?.trim().slice(0, 160) : null
    table.push({ repo: r.name, default_branch: r.default_branch, license: cls, evidence, license_first_line: first, github_spdx: r.license?.spdx_id ?? null })
    console.log(`${r.name}: ${cls}`)
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'openstax-licenses.json'), JSON.stringify(table, null, 2))

  // 영어 본문만 — 스페인어·폴란드어 번역판과 playground(시험용) 저장소 제외.
  const NON_EN = /fisica|fizyka|introduccion|makroekonomia|mikroekonomia|precalculo|psychologia|quimica|playground/
  const ccby = table.filter((t) => t.license === 'CC BY' && !NON_EN.test(t.repo))
  const pick = ccby.filter((_, i) => i % Math.max(1, Math.floor(ccby.length / REPOS)) === 0).slice(0, REPOS)
  const per = Math.ceil(LIMIT / pick.length)
  const out = []
  for (const t of pick) {
    const tree = await (await get(`https://api.github.com/repos/openstax/${t.repo}/git/trees/${t.default_branch}?recursive=1`)).json()
    const mods = tree.tree.filter((e) => /^modules\/[^/]+\/index\.cnxml$/.test(e.path))
    const step = Math.max(1, Math.floor(mods.length / (per * 3)))
    let got = 0
    for (let i = 0; i < mods.length && got < per && out.length < LIMIT; i += step) {
      const raw = `https://raw.githubusercontent.com/openstax/${t.repo}/${t.default_branch}/${mods[i].path}`
      const { title, body } = cnxmlToProse(await (await get(raw)).text())
      const words = body ? body.split(/\s+/).length : 0
      if (words < 150) continue
      out.push({
        id: `openstax:${t.repo}:${mods[i].path.split('/')[1]}`,
        title,
        url: raw,
        license: `CC BY 4.0 (${t.repo} LICENSE)`,
        license_evidence: 'page',
        published_at: null,
        author: 'OpenStax',
        body_text: body,
        words,
      })
      got++
      console.log(`ok ${out.length}/${LIMIT} ${words}w ${t.repo} ${title}`)
    }
  }
  const file = path.join(OUT, 'ft-openstax-samples.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`wrote ${out.length} → ${file}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
