// scripts/csat/source-get/global_storybooks-fetch.mjs
//
// Global Storybooks (global-asp) 영어 원문 표본.
// 원천: GitHub `global-asp/asp-source` 의 `en/NNNN_slug.md` — African Storybook 이야기를 Markdown 으로 뽑은 것.
//   형식: `# 제목` · `##` 줄 = 쪽 나눔 · 끝의 `* License: [CC-BY]` · `* Text: …` 목록이 책마다의 표시.
// 저장소 자체에는 LICENSE 파일이 없다(GitHub spdx = 없음) — 라이선스는 **파일 안의 줄**을 읽는다(evidence 'page').
// 라이선스 줄을 못 읽으면 null 로 둔다(모르는 것을 CC 라고 적지 않는다).
//
// 사용: node scripts/csat/source-get/global_storybooks-fetch.mjs --out <dir> --limit 20

import { parseArgs, politeFetch, readRobots, countWords, writeSamples } from './_common.mjs'

const REPO = 'global-asp/asp-source'
const BRANCH = 'master'

function parseStory(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const title = (lines.find((l) => l.startsWith('# ')) ?? '').slice(2).trim() || null
  const meta = {}
  const bodyLines = []
  for (const l of lines) {
    const m = l.match(/^\*\s*([A-Za-z]+):\s*(.*)$/)
    if (m) { meta[m[1].toLowerCase()] = m[2].trim(); continue }
    if (l.startsWith('# ')) continue
    bodyLines.push(l)
  }
  const pages = bodyLines.join('\n').split(/^##\s*$/m).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const lic = meta.license?.match(/\[([^\]]+)\]/)?.[1] ?? null
  return { title, author: meta.text || null, license: lic, body_text: pages.join('\n\n') }
}

async function main() {
  const { out, limit } = parseArgs()
  const robots = [
    await readRobots('https://github.com'),
    await readRobots('https://raw.githubusercontent.com'),
    await readRobots('https://api.github.com'),
  ]
  const list = await politeFetch(`https://api.github.com/repos/${REPO}/contents/en?ref=${BRANCH}`, { as: 'json' })
  // 이야기 파일만 — `NNNN_slug.md`. README 같은 색인 파일을 이야기로 받았다(회차 8 판정자가 5,300낱말 색인표를 짚었다).
  const files = list.filter((f) => f.type === 'file' && /^\d{4}_.+\.md$/.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))
  const samples = []
  for (const f of files) {
    if (samples.length >= limit) break
    const raw = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/en/${f.name}`
    const s = parseStory(await politeFetch(raw))
    if (!s.body_text) continue
    samples.push({
      id: `global_storybooks:${f.name.replace(/\.md$/, '')}`,
      title: s.title,
      url: `https://github.com/${REPO}/blob/${BRANCH}/en/${f.name}`,
      license: s.license,
      license_evidence: s.license ? 'page' : 'collection-default',
      level: null,
      author: s.author,
      body_text: s.body_text,
      words: countWords(s.body_text),
    })
  }
  writeSamples(out, 'global_storybooks', samples, { repo: REPO, repo_license_spdx: null, robots })
}

main().catch((e) => { console.error(e); process.exit(1) })
