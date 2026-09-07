// apps/web/src/lib/topic-corpus/ted-sitemap.ts
//
// TED 전체 강연 목록 열거 — **사이트맵**으로. 메타데이터(URL)만 다룬다.
//
// ── 왜 사이트맵인가 (2026-08-16) ──
// 주제 페이지(`/topics/<slug>`)는 16편만 노출하고 나머지는 클라이언트가 따로 불러온다.
// 그 "따로 불러오는" 경로는 `/api/`·`/graphql`·`/_next/data/` 인데, robots.txt 가
// `Claude-User` 에 대해 **그 셋을 명시적으로 금지**한다. 그러니 거기로 가면 안 된다.
//
// 반면 robots.txt 마지막 줄은 `Sitemap: https://www.ted.com/sitemap.xml` 이다 —
// 사이트맵은 **사이트가 크롤러에게 전체 목록을 알려주려고 직접 발행하는 파일**이라,
// 전량 열거의 정공법이 정확히 이것이다. 금지 경로를 건드리지 않고 같은 목적을 달성한다.
//
// ── 실측 (2026-08-16) ──
// 인덱스에 연도별 `talks-YYYY.xml.gz` 19개 → 고유 slug **97,020**.
// TED 본편만이 아니라 TEDx·TED-Ed 를 포함한 수치다. 순차 수확 시 편당 1.2초 예의를 지키면
// 32시간 규모이므로, 호출자는 **반드시 배치로 나눠 돌리고 중단·재개를 전제**해야 한다.

import { spawn } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

import { CLAUDE_USER_AGENT, HttpFetchError } from './http-fetch'

const SITEMAP_INDEX = 'https://www.ted.com/sitemap.xml'

/** 바이너리 응답을 받는다 — `.xml.gz` 를 텍스트로 받으면 깨진다. */
function curlBuffer(url: string): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      'curl',
      ['-sS', '-L', '--max-time', '90', '-A', CLAUDE_USER_AGENT, url],
      { windowsHide: true },
    )
    const chunks: Buffer[] = []
    let err = ''
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c) => (err += c))
    child.on('error', (e) => reject(new HttpFetchError(`curl 실행 실패: ${e.message}`, null)))
    child.on('close', (code) => {
      if (code !== 0) reject(new HttpFetchError(`curl exit ${code}: ${err.trim()}`, null))
      else resolvePromise(Buffer.concat(chunks))
    })
  })
}

function decode(buf: Buffer, url: string): string {
  // `.gz` 는 물론이고, 서버가 확장자와 다르게 주는 경우도 있어 매직 넘버로 판정한다.
  const gz = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b
  try {
    return (gz ? gunzipSync(buf) : buf).toString('utf8')
  } catch (e) {
    throw new HttpFetchError(
      `사이트맵 해제 실패 (${url}): ${e instanceof Error ? e.message : String(e)}`,
      null,
    )
  }
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.trim())
}

/** 인덱스에서 연도별 강연 사이트맵 URL 만 골라낸다. */
export async function fetchTedTalkSitemaps(): Promise<string[]> {
  const xml = decode(await curlBuffer(SITEMAP_INDEX), SITEMAP_INDEX)
  return locs(xml).filter((u) => /\/sitemaps\/talks-\d{4}\.xml(\.gz)?$/.test(u))
}

/** 강연 slug 추출. `/transcript` 등 하위 경로는 제외하고 정본 slug 만 남긴다. */
export function talkSlugsFromSitemapXml(xml: string): string[] {
  const out = new Set<string>()
  for (const loc of locs(xml)) {
    const m = /^https:\/\/www\.ted\.com\/talks\/([^/?#]+)\/?$/.exec(loc)
    if (m) out.add(m[1]!)
  }
  return [...out]
}

/**
 * 전체 강연 slug. 사이트맵 19개를 순회하므로 수십 초 걸린다.
 * `onProgress` 로 진행을 흘려보내 조용히 멈춘 것처럼 보이지 않게 한다.
 */
export async function fetchAllTedTalkSlugs(
  onProgress?: (done: number, total: number, slugs: number) => void,
): Promise<string[]> {
  const byYear = await fetchTedTalkSlugsByYear(onProgress)
  const all = new Set<string>()
  for (const slugs of byYear.values()) for (const s of slugs) all.add(s)
  return [...all]
}

/**
 * 연도별 slug. 사이트맵 파일명이 `talks-YYYY` 라 연도가 그대로 드러난다.
 *
 * 왜 연도가 필요한가: 전량(97,020편) 실측 수율이 **4.1%** 였고 건너뜀은 전부 "영어 자막 없음"
 * 이었다. 즉 96%가 헛돈다. 자막 보유가 연도에 따라 다르다면 도는 순서만 바꿔도 같은 시간에
 * 훨씬 많이 건진다 — 그 가정을 **감으로 믿지 않고 연도별 표본으로 재기 위한** 분해다.
 * 앞선 순서(사이트맵 나열 순)는 우연히 자막 없는 구간을 먼저 훑고 있었다.
 */
export async function fetchTedTalkSlugsByYear(
  onProgress?: (done: number, total: number, slugs: number) => void,
): Promise<Map<number, string[]>> {
  const maps = await fetchTedTalkSitemaps()
  const out = new Map<number, string[]>()
  let count = 0
  for (let i = 0; i < maps.length; i += 1) {
    const url = maps[i]!
    const year = Number(/talks-(\d{4})/.exec(url)?.[1] ?? 0)
    const xml = decode(await curlBuffer(url), url)
    const slugs = talkSlugsFromSitemapXml(xml)
    out.set(year, slugs)
    count += slugs.length
    onProgress?.(i + 1, maps.length, count)
  }
  return out
}
