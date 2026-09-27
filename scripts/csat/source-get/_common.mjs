// scripts/csat/source-get/_common.mjs
//
// 원천 표본 fetcher 공용 도구 — 인자 · 예의 있는 fetch(≥1초 간격 · UA) · robots.txt 기록 · 낱말 수.
// 각 <key>-fetch.mjs 가 import 한다. DB 에 쓰지 않는다(파일만 만든다).

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const UA = 'VocaflowSourceGet/1.0 (killerapp51@empal.com)'
let GAP_MS = 1100
/** 요청 간격(ms)을 늘린다 — 기본 1.1초보다 짧게는 못 줄인다. */
export function setGap(ms) { GAP_MS = Math.max(1100, ms) }
let last = 0

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { out: '.', limit: 20 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i]
    else if (argv[i] === '--limit') out.limit = Number(argv[++i])
  }
  if (!Number.isFinite(out.limit) || out.limit < 1) throw new Error('--limit 은 1 이상의 수')
  return out
}

/** 요청 사이 ≥1초를 지키는 fetch. 실패 상태는 오류로 던진다. */
export async function politeFetch(url, { as = 'text', allow404 = false } = {}) {
  const wait = last + GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (allow404 && res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  if (as === 'json') return res.json()
  if (as === 'buffer') return Buffer.from(await res.arrayBuffer())
  return res.text()
}

/** robots.txt 를 읽어 원문 앞부분과 상태를 돌려준다(HTML 이 오면 "없음" 으로 기록). */
export async function readRobots(origin) {
  const url = `${origin}/robots.txt`
  try {
    const wait = last + GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const body = await res.text()
    const isHtml = /^\s*<(!doctype|html)/i.test(body)
    return { url, status: res.status, present: res.ok && !isHtml, excerpt: isHtml ? '(HTML 응답 — robots.txt 없음)' : body.slice(0, 1500) }
  } catch (e) {
    return { url, status: 0, present: false, excerpt: String(e.message ?? e) }
  }
}

export function countWords(text) {
  return (text.match(/[A-Za-z0-9’']+/g) ?? []).length
}

export function writeSamples(dir, key, samples, robots) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `ft-${key}-samples.json`)
  writeFileSync(file, JSON.stringify(samples, null, 2))
  writeFileSync(join(dir, `ft-${key}-robots.json`), JSON.stringify(robots, null, 2))
  const w = samples.map((s) => s.words).sort((a, b) => a - b)
  const median = w.length ? w[Math.floor((w.length - 1) / 2)] : 0
  console.log(`${key}: ${samples.length}편 → ${file} · 중앙 ${median}어`)
  return { file, median }
}
