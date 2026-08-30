// scripts/textbook/media-probe.mjs
//
// **초등 미디어 두 유형이 성립하는지 — 그림·음원이 실제로 있는지 먼저 잰다.**
//
// ── 왜 재는가 ────────────────────────────────────────────────────────
// `school-types.ts` 는 그림-낱말 연결과 듣고 고르기를 `generation: 'external'` 로 두고
// "저작권 없는 세트가 없으면 성립하지 않는다" 고만 적어 뒀다. **그 존재를 잰 적이 없다.**
// 없으면 유형을 접는 것이고, 있으면 커버리지가 2 오른다 — 어느 쪽이든 짐작으로 둘 일이 아니다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
// 대상은 2022 개정 교육과정 **초등 기본어휘 808개**(`list_tags @> {kcurr2022_1}`).
//
//   음원  Wikimedia Commons 의 발음 파일. 이름 규약이 문서화돼 있다 —
//         `File:En-us-<word>.ogg` · `File:En-uk-<word>.ogg` · `LL-Q1860 (eng)-…`.
//         **주소를 짐작하는 것이 아니라 규약을 조회**한다(존재 여부는 API 가 답한다).
//   그림  Openverse — CC 라이선스 이미지를 모아 라이선스 메타데이터와 함께 준다.
//         낱말로 검색해 **CC0·PD 만** 세어 본다(BY/BY-SA 는 출처 표기 부담이 있어 따로 센다).
//
// ⚠️ 라이선스는 API 가 주는 필드를 그대로 기록한다. 판정은 사람이 한다.
// ⚠️ UA 위장 금지 — 403/429 면 그 소스를 쓰지 않는다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/media-probe.mjs            # 표본 120개
//   pnpm dlx tsx scripts/textbook/media-probe.mjs --n 808    # 전수 (느리다)

import fs from 'node:fs'
import { fetchAllPaged } from './volume-pool.mjs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SAMPLE = Number(arg('n') ?? 120)

const { createClient } = await import('@supabase/supabase-js')
const { fetchWithTimeout } = await import(
  '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
)

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// ⚠️ 지금은 808낱말이라 안 잘리지만 상한(1,000)에 가깝다. 잘리면 아래 "고르게 훑기" 가
//   알파벳 앞쪽만 보게 되어 **표본이 조용히 편향된다.** 미리 페이징해 둔다.
const rows = await fetchAllPaged(db, (q) =>
  q
    .from('shared_dictionary')
    .select('word, meaning_ko')
    .contains('list_tags', ['kcurr2022_1'])
    .order('word'))

// 표본은 **앞에서 자르지 않고 고르게 훑는다** — 알파벳 앞쪽만 보면 편향된다.
const all = (rows ?? []).filter((r) => /^[a-z]+$/i.test(r.word ?? ''))
const step = Math.max(1, Math.floor(all.length / SAMPLE))
const words = all.filter((_, i) => i % step === 0).slice(0, SAMPLE)
console.log(`초등 교육과정 어휘 ${all.length}개 중 ${words.length}개 표본 (등간격)\n`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Commons 발음 파일 — 이름 규약을 한 번에 조회한다.
 * `titles` 는 최대 50개까지 묶을 수 있어 낱말당 요청 하나가 아니라 묶음으로 간다.
 */
async function commonsAudio(batch) {
  const titles = []
  for (const w of batch) {
    titles.push(`File:En-us-${w}.ogg`, `File:En-uk-${w}.ogg`)
  }
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
    '&iiprop=url|extmetadata&titles=' +
    titles.map(encodeURIComponent).join('|')
  const res = await fetchWithTimeout(url, { accept: 'application/json' })
  if (res.status === 403 || res.status === 429) throw new Error(`blocked HTTP ${res.status}`)
  const pages = JSON.parse(await res.text())?.query?.pages ?? {}
  const found = new Map()
  for (const p of Object.values(pages)) {
    if (p.missing !== undefined || !p.imageinfo?.[0]) continue
    const m = String(p.title).match(/^File:En-(?:us|uk)-(.+)\.ogg$/i)
    if (!m) continue
    const lic = p.imageinfo[0].extmetadata?.LicenseShortName?.value ?? '?'
    if (!found.has(m[1].toLowerCase())) found.set(m[1].toLowerCase(), lic)
  }
  return found
}

/**
 * Openverse — 낱말로 CC 이미지를 찾고 **라이선스별로** 센다.
 *
 * ⚠️ 낱말 하나가 타임아웃 났다고 프로브 전체가 죽으면 안 된다(처음에 그렇게 만들어
 *   ①의 결과까지 잃을 뻔했다). 실패는 그 낱말만 `error` 로 남기고 넘어간다.
 */
async function openverseImage(word) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(word)}&page_size=5`
  let res
  try {
    res = await fetchWithTimeout(url, { accept: 'application/json', timeoutMs: 30_000 })
  } catch (e) {
    return { error: e instanceof Error ? e.name : String(e) }
  }
  if (res.status === 403 || res.status === 429) return { blocked: res.status }
  if (!res.ok) return { error: res.status }
  const j = JSON.parse(await res.text())
  const licenses = (j.results ?? []).map((r) => String(r.license ?? '?').toLowerCase())
  return {
    total: j.result_count ?? 0,
    free: licenses.filter((l) => l === 'cc0' || l === 'pdm').length,
    attrib: licenses.filter((l) => l === 'by' || l === 'by-sa').length,
    sample: j.results?.[0] ? { title: j.results[0].title, license: j.results[0].license } : null,
  }
}

// ── ① 음원 ──────────────────────────────────────────────────────────
console.log('① Wikimedia Commons 발음 파일 (이름 규약 조회)')
const audio = new Map()
let audioBlocked = null
for (let i = 0; i < words.length; i += 20) {
  const batch = words.slice(i, i + 20).map((w) => w.word.toLowerCase())
  try {
    for (const [k, v] of await commonsAudio(batch)) audio.set(k, v)
  } catch (e) {
    audioBlocked = e instanceof Error ? e.message : String(e)
    break
  }
  await sleep(400)
}
const audioLicenses = new Map()
for (const lic of audio.values()) audioLicenses.set(lic, (audioLicenses.get(lic) ?? 0) + 1)
if (audioBlocked) {
  console.log(`  ⛔ ${audioBlocked} — UA 위장 대신 이 소스를 쓰지 않는다`)
} else {
  console.log(
    `  ${audio.size}/${words.length} = ${((100 * audio.size) / words.length).toFixed(1)}% 에 발음 파일이 있다`,
  )
  for (const [lic, n] of [...audioLicenses].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(lic).padEnd(28)} ${n}`)
  }
}

// ── ② 그림 ──────────────────────────────────────────────────────────
console.log('\n② Openverse CC 이미지 (라이선스별)')
let withFree = 0
let withAttrib = 0
let imgBlocked = null
let failed = 0
const imgSamples = []
const probed = words.slice(0, Math.min(words.length, 60)) // 외부 API 부담을 줄인다
for (const w of probed) {
  const r = await openverseImage(w.word)
  if (r.blocked) {
    imgBlocked = `HTTP ${r.blocked}`
    break
  }
  if (r.error) { failed++; continue }
  if (r.free > 0) withFree++
  else if (r.attrib > 0) withAttrib++
  if (imgSamples.length < 6 && r.sample) imgSamples.push({ word: w.word, ...r.sample })
  await sleep(350)
}
if (imgBlocked) {
  console.log(`  ⛔ ${imgBlocked} — UA 위장 대신 이 소스를 쓰지 않는다`)
} else {
  const n = probed.length
  console.log(`  표본 ${n}개 중`)
  console.log(`     CC0·PD 이미지 있음        ${withFree} (${((100 * withFree) / n).toFixed(1)}%)`)
  console.log(`     BY·BY-SA 만 있음         ${withAttrib} (${((100 * withAttrib) / n).toFixed(1)}%)`)
  console.log(`     없음                    ${n - withFree - withAttrib - failed}`)
  if (failed) console.log(`     조회 실패(타임아웃 등)      ${failed} — 이만큼은 모른다`)
  for (const s of imgSamples) console.log(`       · ${s.word} → ${s.license} · ${String(s.title).slice(0, 54)}`)
}

fs.writeFileSync(
  'scripts/textbook/media-probe.json',
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      vocabulary: all.length,
      sample: words.length,
      audio: { found: audio.size, blocked: audioBlocked, licenses: [...audioLicenses] },
      image: { probed: probed.length, free: withFree, attrib: withAttrib, failed, blocked: imgBlocked },
    },
    null,
    2,
  ),
)
console.log('\n→ scripts/textbook/media-probe.json')
