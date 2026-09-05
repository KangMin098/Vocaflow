// scripts/textbook/mediawiki-lead-ingest.mjs
//
// **MediaWiki 도입부 적재 — 사다리 아래 세 단(V1·V2·V3)이 비어 있는 자리를 메운다.**
//
// ── 왜 도입부인가 ────────────────────────────────────────────────────
// `simple_wikipedia` 는 이미 배선돼 있다. 그런데 **글 전체**로 들어와서 평균 2,526어다 —
// 교재 지문 창(44~173어) 밖이라 한 편도 못 쓴다. 프로브 실측(2026-09-02, n=40·n=100 두 차례):
//
//   simple_wikipedia_lead  풀 284,760  초 50% · 중 58%   (도입부만 보면 36~187어)
//   vikidia_en             풀   6,099  초 35% · 중 42%
//
// **같은 소스라도 어느 단위를 가져오느냐가 다른 소스를 만든다.** 그래서 이 스크립트는
// 도입부(`exintro`)만 가져오고 `source_id` 에 `#lead` 를 남긴다 — 통짜 글과 다른 행이 되고,
// 나중에 "이게 전문인가 도입부인가" 를 물을 수 있다.
//
// ── 왜 프로브의 함수를 그대로 부르는가 ───────────────────────────────
// 표집·추출을 여기 다시 쓰면 **프로브가 잰 것과 적재기가 넣는 것이 갈린다.**
// "50% 가 초등 창에 든다" 고 재 놓고 다른 방법으로 가져오면 그 수치는 근거가 아니다.
// 그래서 `_mediawiki.mjs` 한 벌을 양쪽이 부른다.
//
// ── 라이선스 ─────────────────────────────────────────────────────────
// 둘 다 CC BY-SA (Wikipedia 계열). `trg_acp_license_gate` 가 INSERT 때
// `acp_apply_license_gate` 로 `license_class` 를 스스로 정한다 — 여기서는 손대지 않는다.
// **CC BY-SA 는 변경을 밝히라고 한다.** 도입부만 쓰는 것은 변경이므로 제목에 적는다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// `(source, source_id)` 로 먼저 조회해 이미 있으면 건너뛴다. 몇 번 돌려도 결과가 수렴한다.
// 무작위 표집이라 **매번 다른 항목**이 오지만, 이미 넣은 것은 다시 안 넣는다.
// 건너뛴 수를 항목별로 출력한다 — 조용히 건너뛰면 수율을 모른다.
//
// ⚠️ 기본은 dry-run 이다. `--commit` 없이는 DB 에 쓰지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/mediawiki-lead-ingest.mjs --limit 40
//   ... --wiki vikidia --limit 40 --commit
//   ... --limit 100 --band 초3~4 --commit --process

import fs from 'node:fs'
import path from 'node:path'

import { mediawikiRandom, mediawikiLead } from './_mediawiki.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const PROCESS = process.argv.includes('--process')
const LIMIT = Number(arg('limit') ?? 20)
const BAND = arg('band')
const WIKI = arg('wiki') ?? 'simple'
const DEV_BASE = arg('base') ?? 'http://localhost:3000'
/** `--no-trim` — 자르기를 끈다. **자르기가 수율에 얼마나 기여했는지 재려면** 이걸로 대조한다. */
const TRIM = !process.argv.includes('--no-trim')
/**
 * 동시 요청 수. **429 는 250ms 간격 16연속에서 나왔다**(프로브 실측) — 4 는 그 아래다.
 * 올리기 전에 재라. 막히면 수율이 아니라 실패 수가 는다.
 */
const CONCURRENCY = Number(arg('concurrency') ?? 4)

/**
 * 두 위키. 라이선스 문자열은 **DB 에 이미 있는 값과 같은 표기**를 쓴다 —
 * `wikipedia`·`simple_wikipedia`·`wikivoyage` 132행이 전부 `CC-BY-SA-4.0` 이다.
 * 표기가 갈리면 게이트 함수가 같은 라이선스를 다르게 분류한다.
 */
const WIKIS = {
  simple: {
    source: 'simple_wikipedia',
    api: 'https://simple.wikipedia.org/w/api.php',
    site: 'https://simple.wikipedia.org/wiki/',
    label: 'Simple English Wikipedia',
    license: 'CC-BY-SA-4.0',
  },
  vikidia: {
    source: 'vikidia',
    api: 'https://en.vikidia.org/w/api.php',
    site: 'https://en.vikidia.org/wiki/',
    label: 'Vikidia (English) — 8~13세 백과',
    license: 'CC-BY-SA-3.0',
  },
}

const wiki = WIKIS[WIKI]
if (!wiki) {
  console.error(`알 수 없는 위키: ${WIKI} (simple | vikidia)`)
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { gradeBand, bandOf, readability, curriculumFit, standaloneFit, PASSAGE_WORDS } =
  await import('../../packages/library-pipeline/src/index.ts')

const targetBand = BAND ? gradeBand(BAND) : null
if (BAND && !targetBand) {
  console.error(`알 수 없는 학년 칸: ${BAND}`)
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const countWords = (s) => s.split(/\s+/).filter(Boolean).length

/**
 * 긴 도입부를 **앞에서 문장 단위로** 끊어 창에 넣는다.
 *
 * 백과 도입부는 첫 문장이 정의라 앞을 남기는 편이 자립적이다(`standaloneFit` 이 그것을 본다).
 * 창에 못 들면 `null` — 억지로 넣지 않는다. 한 문장이 이미 창을 넘으면 그 글은 이 창의 글이 아니다.
 */
function trimToWindow(text, min, max) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  let out = ''
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s
    if (countWords(next) > max) break
    out = next
    // 최소치를 넘겼으면 거기서 멈춘다 — 길수록 좋은 것이 아니라 창 안이면 된다.
    if (countWords(out) >= min) return out
  }
  return null
}

const sample = await mediawikiRandom(wiki.api, LIMIT)
if (sample.error) {
  console.error(`표집 실패 — ${sample.error}`)
  process.exit(1)
}
console.log(
  `${wiki.label} — 표집 ${sample.items.length}건 / 전체 ${sample.total?.toLocaleString() ?? '?'}` +
    `${targetBand ? ` · 목표 칸 ${targetBand.id}` : ''}${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}\n`,
)

// ── 1단계: 도입부를 동시에 받는다 ────────────────────────────────────
// 순차로 받으면 100건에 3분이 걸렸다(2026-09-05 실측). 판정·적재는 순서대로 해야
// 출력이 읽히므로 **받기만** 병렬로 한다.
const t0 = Date.now()
const leads = new Array(sample.items.length)
let cursor = 0
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, sample.items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= sample.items.length) return
      // 본문 전체를 받는다 — **도입부만으로는 창을 못 채운다**(n=100 에서 65건이 100어 미만).
      // 여기서 받은 글의 **앞에서부터** 창만큼 떼어 쓴다. 도입부는 그 앞부분이다.
      leads[i] = await mediawikiLead(wiki.api, sample.items[i].id, { intro: false })
    }
  }),
)
const fetchMs = Date.now() - t0
console.log(`도입부 ${leads.length}건 수신 ${(fetchMs / 1000).toFixed(1)}초\n`)

let added = 0
let existed = 0
/** 도입부가 비었거나 읽기 지표가 안 나온다 — 넘겨쓰기(redirect)·토막글이다. */
let empty = 0
/** 창보다 짧다. **자를 수 없다** — 없는 문장을 만들 수는 없다. */
let tooShort = 0
/** 창보다 길다. `--no-trim` 일 때만 여기서 떨어진다. */
let tooLong = 0
/** 잘라도 창에 못 들었다 — 한 문장이 이미 창을 넘는다. */
let trimFailed = 0
/** FK 가 사다리 밖이거나 목표 칸 밖. */
let outOfBand = 0
/** 어휘가 그 학년 밖. */
let vocabBlocked = 0
/** 앞을 가리키며 시작하거나 그 한 편만으로는 못 읽는다. */
let notStandalone = 0
let failed = 0
/** 자르기가 살려 낸 수 — 자르기의 기여분을 수치로 남긴다. */
let trimmed = 0

for (let i = 0; i < sample.items.length; i++) {
  const item = sample.items[i]
  const lead = leads[i]
  if (!lead || lead.error) {
    failed++
    console.log(`  ✗ ${String(lead?.error ?? '응답 없음').slice(0, 56)}`)
    continue
  }
  const raw = (lead.body ?? '').trim()
  if (!raw || raw.length < 40) {
    empty++
    continue
  }

  // ── 창 맞추기 ──────────────────────────────────────────────────────
  // **어수 창은 다섯 칸이 모두 같다**(`PASSAGE_WORDS` 100~200) — 그래서 창을 고르는 데
  // 난이도가 필요 없다. 예전엔 자르기 **전** 글의 FK 로 칸을 골라 창을 물었는데,
  // 전체 글이 어려우면 앞부분이 쉬워도 사다리 밖으로 버려졌다. 칸은 **자른 뒤** 잰다.
  const win = targetBand ?? { wordsMin: PASSAGE_WORDS.min, wordsMax: PASSAGE_WORDS.max }
  const words0 = countWords(raw)
  let content = raw
  let wasTrimmed = false
  if (words0 < win.wordsMin) {
    tooShort++
    continue
  }
  if (words0 > win.wordsMax) {
    if (!TRIM) {
      tooLong++
      continue
    }
    const cut = trimToWindow(raw, win.wordsMin, win.wordsMax)
    if (!cut) {
      trimFailed++
      continue
    }
    content = cut
    wasTrimmed = true
  }

  // 자르면 난이도가 바뀐다 — **자른 뒤 다시 잰다.** 자르기 전 값으로 칸을 정하면
  // 넣은 글과 적힌 칸이 어긋난다.
  const fk = readability(content)?.fk ?? null
  const bandId = bandOf(fk)
  if (targetBand ? bandId !== targetBand.id : !gradeBand(bandId)) {
    outOfBand++
    continue
  }
  const words = countWords(content)

  const source_id = wasTrimmed ? `${item.id}#lead-trim` : `${item.id}#lead`
  const { data: dup } = await db
    .from('library_articles')
    .select('id')
    .eq('source', wiki.source)
    .eq('source_id', source_id)
    .maybeSingle()
  if (dup) {
    existed++
    continue
  }

  // ── 어휘·자립성 게이트 ─────────────────────────────────────────────
  // 세 축(FK·어수·칸)을 통과하고도 지문이 아닌 글이 PD 발췌 실측에서 69% 였다.
  // **같은 자를 대지 않으면 같은 구멍이 생긴다.**
  const school = (targetBand?.id ?? bandId).startsWith('초') ? 'elementary' : 'middle'
  const vf = curriculumFit(content, school)
  if (!vf.pass) {
    vocabBlocked++
    continue
  }
  const sf = standaloneFit(content)
  if (!sf.pass) {
    notStandalone++
    continue
  }

  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: wiki.source,
      source_id,
      // CC BY-SA 는 "indicate if changes were made" 를 요구한다.
      //   도입부만 쓰는 것도, 거기서 다시 자르는 것도 변경이다.
      title: `${item.title} (도입부${wasTrimmed ? ' 발췌' : ''})`,
      author: null,
      source_url: `${wiki.site}${encodeURIComponent(item.id.replace(/ /g, '_'))}`,
      published_at: null,
      license: wiki.license,
      content,
      status: 'queued',
    })
    if (error) {
      failed++
      console.log(`  ✗ INSERT 실패: ${error.message.slice(0, 60)}`)
      continue
    }
  }
  added++
  if (wasTrimmed) trimmed++
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(words).padStart(4)}어  FK ${String(fk).padStart(5)}  ` +
      `${(bandId ?? '-').padEnd(7)} ${wasTrimmed ? '✂ ' : '  '}${item.title.slice(0, 44)}`,
  )
}

console.log(
  `\n추가 ${added}(자르기로 살린 것 ${trimmed}) · 이미 있음 ${existed} · 도입부 없음 ${empty} · ` +
    `짧음 ${tooShort} · 김 ${tooLong} · 잘라도 안 됨 ${trimFailed} · 칸 밖 ${outOfBand} · ` +
    `어휘 밖 ${vocabBlocked} · 자립성 미달 ${notStandalone} · 실패 ${failed}`,
)
const seen = sample.items.length
if (seen) {
  const perHour = fetchMs > 0 ? Math.round(added / (fetchMs / 3_600_000)) : 0
  console.log(
    `수율 ${((added / seen) * 100).toFixed(1)}% (${added}/${seen}) · ` +
      `수신 ${(fetchMs / 1000).toFixed(1)}초 · 시간당 적재 추정 ${perHour}편`,
  )
}
if (!COMMIT) console.log('\ndry-run 이었다. 실제로 쓰려면 --commit.')

if (PROCESS) {
  // ⚠️ `queued` 로 두면 이 글들은 **어디에도 안 보인다** — 지문 재고 질의가
  //   `status in ('ready','published')` 로 센다. 넣기만 하고 끝내면 "넣었는데 0" 이 된다.
  const { data: queued } = await db
    .from('library_articles')
    .select('id, title')
    .eq('source', wiki.source)
    .eq('status', 'queued')
  console.log(`\n처리 대상 ${queued?.length ?? 0}건 → ${DEV_BASE}/api/acp/dev-process`)

  let done = 0
  let procFailed = 0
  for (const a of queued ?? []) {
    let res
    try {
      res = await fetch(`${DEV_BASE}/api/acp/dev-process`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ article_id: a.id }),
      })
    } catch (e) {
      procFailed++
      if (procFailed <= 2)
        console.log(`  ✗ 연결 실패 — dev 서버가 떠 있나? ${String(e.message).slice(0, 50)}`)
      continue
    }
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.ok) {
      done++
      if (done <= 3) console.log(`  ✓ ${j.cefr_level ?? '-'}  ${a.title.slice(0, 42)}`)
    } else {
      procFailed++
      if (procFailed <= 3) console.log(`  ✗ ${res.status} ${JSON.stringify(j).slice(0, 100)}`)
    }
  }
  console.log(`\n처리 ${done} · 실패 ${procFailed}`)
}
