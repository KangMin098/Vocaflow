// scripts/vcb/fetch-covers.mts
// 단어장 표지 수집 — Openverse 에서 유형별 퍼블릭도메인 도판을 찾아 붙인다.
//
// 실행 (레포 루트에서):
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/fetch-covers.mts            # 드라이런
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/fetch-covers.mts --commit
//   ... --only unlock,recycle      # 특정 유형만 (마음에 안 드는 표지 재추첨)
//   ... --skip-existing            # 이미 표지가 있는 세트는 건너뛴다
//
// 기본은 드라이런이다 — `--commit` 없이는 아무것도 쓰지 않고 무엇을 고를지만 보여 준다.
//
// 왜 스크립트인가: 표지는 한 번 붙이고 끝이 아니다. 유형이 늘고, 검색 결과가 바뀌고,
// "이 그림은 아니다" 가 반드시 생긴다. 그때 손으로 URL 을 넣기 시작하면 출처 기록이
// 끊긴다 — 재실행 가능한 자리를 만들어 둔다.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  COVER_QUERY,
  COVER_QUERY_BY_SLUG,
  FAMILY_GRAIN,
  isUsableLicense,
  type CoverFamily,
  type CoverMeta,
} from '@/lib/vcb/covers/design'
import { getBlueprint } from '@/lib/vcb/compose/blueprints'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 부재 (apps/web/.env.local)')
  process.exit(1)
}
const client = createClient(url, key, { auth: { persistSession: false } })

const API = 'https://api.openverse.org/v1/images/'
const UA = 'Vocaflow/1.0 (wordbook covers; contact via repo)'

interface OpenverseImage {
  id: string
  title: string | null
  url: string
  creator: string | null
  creator_url: string | null
  license: string
  license_url: string | null
  provider: string | null
  foreign_landing_url: string | null
  width: number | null
  height: number | null
}

/**
 * **결을 잡는 실제 장치** — 소장 기관 가중치.
 *
 * 처음에는 `category=illustration,digitized_artwork` 로 도판만 거르려 했는데 실측하니
 * 전 검색어에서 **0건**이 나왔다(Openverse 에서 이 조합은 사실상 비어 있다). 그래서
 * 카테고리 대신 **어디가 소장한 스캔인가**로 거른다 — 아래 기관들은 소장품을 판화·도판
 * 스캔으로 공개하는 곳이라, 여기서 나온 그림은 자동으로 같은 시대·같은 질감을 갖는다.
 * (실측: 짧은 검색어 20종에서 flickr(Commons)·wikimedia·rawpixel·rijksmuseum·
 *  clevelandmuseum·museumsvictoria 가 나왔다.)
 */
/** 소장품을 도판 스캔으로 공개하는 기관 — 여기서 나온 그림은 시대·질감이 이미 맞는다. */
const MUSEUM_PROVIDERS = new Set([
  'rijksmuseum',
  'clevelandmuseum',
  'museumsvictoria',
  'smithsonian',
  'rawpixel',
  'wikimedia',
])

/**
 * Flickr 는 절반만 준다. Commons(도서관·기록관 PD 스캔)와 현대 사진이 **같은 provider 이름**
 * 으로 들어오기 때문이다 — 실측에서 여기로 NASA 위성사진·콘크리트 텍스처·전쟁기념비 사진이
 * 섞여 들어와 판화 카탈로그의 결을 깼다.
 */
const HALF_PROVIDERS = new Set(['flickr'])

/**
 * 현대 사진 배제 — 제목에 이 말이 있으면 판화가 아니다.
 * 완벽하진 않지만 실측에서 걸러야 했던 것들을 정확히 집는다.
 */
const MODERN_HINT = /\b(nasa|satellite|photo|photograph|texture|modern|concrete|hubble|20\d\d)\b/i

/**
 * 후보 하나를 점수화한다 — **표지로 쓸 수 있는가**.
 *
 * 검색 1등이 표지 1등은 아니다. 세로로 긴 그림은 3:4 표지에서 잘리고, 너무 작은 원본은
 * 확대하면 뭉갠다. 그래서 순위가 아니라 이 점수로 고른다.
 */
function score(img: OpenverseImage, rank: number, query: string): number {
  const w = img.width ?? 0
  const h = img.height ?? 0
  if (w < 600 || h < 600) return -1 // 표지로 쓰기엔 작다
  const title = img.title ?? ''
  if (MODERN_HINT.test(title)) return -1
  // 정리번호만 있는 스캔(`426013` · `n194_w1150`)은 무엇이 그려졌는지 확인할 길이 없다 —
  // 표지로 쓰면 "이 그림이 왜 여기 있나" 에 아무도 답할 수 없게 된다.
  const bare = title.trim()
  if (bare.length < 4) return -1
  if (!/[a-z]{4,}/i.test(bare)) return -1
  // `page294` · `minerals1851` — 낱말 하나에 숫자만 붙은 제목은 스캔 파일명이지 그림 설명이
  // 아니다. 띄어쓰기가 없고 숫자가 붙어 있으면 무엇이 그려졌는지 알 수 없다.
  if (!/\s/.test(bare) && /\d/.test(bare)) return -1

  const ratio = w / h
  // 3:4(0.75) 근처가 최고. 가로로 넓은 것은 가운데를 잘라 쓸 수 있어 세로보다 낫다.
  const ratioScore = ratio >= 0.7 && ratio <= 1.6 ? 1 : ratio > 1.6 ? 0.6 : 0.2
  const sizeScore = Math.min(1, Math.min(w, h) / 1600)
  // PD 를 CC-BY 보다 선호한다 — 표기 부담이 없고 재가공이 자유롭다.
  const licenseScore = img.license.toLowerCase() === 'pdm' || img.license.toLowerCase() === 'cc0' ? 1 : 0.8
  const p = (img.provider ?? '').toLowerCase()
  const providerScore = MUSEUM_PROVIDERS.has(p) ? 1 : HALF_PROVIDERS.has(p) ? 0.5 : 0

  // **관련성** — 앞서 이것이 빠져 있어서 'tree roots' 에 새 도판(Numenius)이, 'tuning fork' 에
  // 은하(Mrk 820)가 뽑혔다. 크고 예쁜 판화를 고르느라 무엇이 그려졌는지를 안 본 것이다.
  //   · 검색 순위: Openverse 가 매긴 관련성. 뒤로 갈수록 급격히 깎는다
  //   · 제목 일치: 검색어 낱말이 제목에 실제로 있는가 (엉뚱한 소재를 가장 확실히 거른다)
  const rankScore = Math.max(0, 1 - rank / 8)
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
  const hit = terms.filter((t) => title.toLowerCase().includes(t)).length
  const titleScore = terms.length === 0 ? 0 : hit / terms.length

  return (
    titleScore * 0.3 +
    providerScore * 0.25 +
    rankScore * 0.2 +
    ratioScore * 0.15 +
    sizeScore * 0.05 +
    licenseScore * 0.05
  )
}

async function search(query: string): Promise<OpenverseImage[]> {
  const qs = new URLSearchParams({
    q: query,
    license: 'pdm,cc0,by',
    page_size: '20',
    mature: 'false',
  })
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Openverse ${res.status} ${res.statusText} — ${query}`)
  const json = (await res.json()) as { results?: OpenverseImage[] }
  return json.results ?? []
}

interface SetRow {
  id: string
  slug: string
  title: string
  curation_query: { blueprint?: string } | null
  cover_image_url: string | null
}

const only = arg('only')?.split(',').map((s) => s.trim())

const { data, error } = await client
  .from('shared_word_sets')
  .select('id, slug, title, curation_query, cover_image_url')
  .eq('is_published', true)
  .not('curation_query->blueprint', 'is', null)
  .order('slug')
if (error) throw new Error(`세트 조회 실패: ${error.message}`)

const sets = (data ?? []) as unknown as SetRow[]
/** 이번 실행에서 이미 쓴 이미지 — 세트끼리 표지가 겹치지 않게 한다. */
const usedImages = new Set<string>()
let picked = 0
let missed = 0

for (const s of sets) {
  const blueprint = s.curation_query?.blueprint
  if (!blueprint) continue
  if (only && !only.includes(blueprint)) continue
  if (flag('skip-existing') && s.cover_image_url) continue

  const bp = getBlueprint(blueprint)
  const family = (bp?.family ?? 'list') as CoverFamily
  const grain = FAMILY_GRAIN[family]
  // 권별 검색어가 있으면 그것이 이긴다 — 한 유형에 여러 권이면 유형 검색어 하나로는
  // 첫 권만 도판을 받고 나머지가 그라디언트로 떨어진다(design.ts 주석).
  const base = COVER_QUERY_BY_SLUG[s.slug] ?? COVER_QUERY[blueprint]
  if (!base) {
    console.warn(`  ! ${s.slug} — ${blueprint} 검색어 미정의 (design.ts 에 추가 필요)`)
    missed += 1
    continue
  }

  // 유형 검색어 → 없으면 계열 공통 소재로 한 번 더. 계열 결은 유지된다.
  let results: OpenverseImage[] = []
  const tried: string[] = []
  for (const q of [base, grain.material]) {
    tried.push(q)
    try {
      results = (await search(q)).filter((r) => isUsableLicense(r.license))
    } catch (e) {
      console.warn(`  ! ${s.slug} — 검색 실패(${q}): ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    if (results.length > 0) break
  }

  // 이미 다른 세트가 쓴 그림은 제외한다. 실측에서 4개 세트가 **같은 성좌도**를 받았다 —
  // 표지가 겹치면 "그 책이 뭐였지" 를 되살리는 손잡이가 오히려 서로를 지운다.
  const usedQuery = tried[tried.length - 1]!
  const scored = results
    .map((r, i) => ({ r, sc: score(r, i, usedQuery) }))
    .filter((x) => x.sc > 0 && !usedImages.has(x.r.id))

  // **하한** — 검색 결과가 나빠도 점수기는 늘 "그중 최선" 을 고른다. 그래서 `academic-awl` 에
  // 자화상이, `rhyme-phonics` 에 지리 교과서가 붙었다(실측). 어떤 주제는 Openverse 에 맞는
  // 도판이 그냥 없고, 그때는 **아무거나 붙이는 것보다 비우는 편이 낫다** — 그라디언트 표지가
  // 이미 자리를 메우고 있어 공백이 생기지 않는다.
  // 0.55 = 제목 일치가 하나라도 있고(0.3×0.5) 기관 소장이며(0.25) 상위권(0.2×0.5) 인 수준.
  const MIN_SCORE = 0.55
  const best = scored.sort((a, b) => b.sc - a.sc).filter((x) => x.sc >= MIN_SCORE)[0]

  if (!best) {
    // 못 찾으면 **비워 둔다** — 아무 그림이나 넣으면 결이 깨지고, 빈 자리는 그라디언트
    // 표지가 이미 메운다(폴백이 있으니 공백이 아니다).
    console.warn(`  · ${s.slug} (${blueprint}) — 기준 미달. 그라디언트 표지 유지`)
    missed += 1
    continue
  }

  const meta: CoverMeta = {
    source: 'openverse',
    provider: best.r.provider,
    license: best.r.license,
    license_url: best.r.license_url,
    creator: best.r.creator,
    creator_url: best.r.creator_url,
    page_url: best.r.foreign_landing_url,
    query: usedQuery,
    family,
  }

  console.info(
    `✓ ${s.slug.padEnd(24)} ${blueprint.padEnd(18)} ${family.padEnd(10)} ` +
      `${best.r.license.padEnd(4)} ${best.r.width}x${best.r.height}  ${best.r.title ?? ''}`.slice(0, 160),
  )
  usedImages.add(best.r.id)
  picked += 1

  if (flag('commit')) {
    const { error: uErr } = await client
      .from('shared_word_sets')
      .update({ cover_image_url: best.r.url, cover_image_meta: meta })
      .eq('id', s.id)
    if (uErr) console.error(`  ! ${s.slug} 저장 실패: ${uErr.message}`)
  }
}

console.info(`\n표지 ${picked}건 · 미확보 ${missed}건${flag('commit') ? ' — 저장 완료' : ' (드라이런)'}`)
