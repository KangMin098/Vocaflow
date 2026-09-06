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

// `countWords`·`trimToWindow` 도 여기서 가져온다 — **개행 규약과 같은 파일에 둔다.**
// 수확기가 문단 경계(빈 줄)를 살려 주는데 자르기가 `' '` 로 다시 이으면 그 자리가 도로
// 뭉개진다. 규약을 만든 쪽과 읽는 쪽이 갈려 있으면 한쪽만 고쳐도 조용히 어긋난다.
import {
  mediawikiRandom,
  mediawikiAllpages,
  mediawikiLead,
  countWords,
  trimToWindow,
} from './_mediawiki.mjs'

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
 * 동시 요청 수.
 *
 * 처음엔 4로 뒀다(프로브에서 429 가 250ms 간격 16연속에서 나왔으므로 안전해 보였다).
 * 그런데 **도입부가 아니라 전문(全文)을 받게 바꾸자 응답이 훨씬 무거워져** 300건에서
 * 429 가 8건 났다(2026-09-05 실측). 같은 동시성이라도 **무엇을 받느냐가 부하를 바꾼다.**
 * 3으로 낮추고 요청마다 짧은 간격을 둔다 — 막히면 수율이 아니라 실패 수가 는다.
 */
const CONCURRENCY = Number(arg('concurrency') ?? 3)
/** 요청 간 간격(ms). 0 이면 쉬지 않는다. */
const GAP_MS = Number(arg('gap') ?? 120)
/**
 * `--no-curriculum` — 어휘 게이트를 **판정에서만** 뺀다(세기는 계속한다).
 * V-Level 게이트와 역할이 겹치는지 대조하려는 것이다: 둘 다 "이 학년이 읽을 수 있는가" 를
 * 다른 방식으로 묻는다. 겹친다면 멀쩡한 글을 이중으로 버리고 있는 것이다.
 */
const CURRICULUM = !process.argv.includes('--no-curriculum')
/**
 * `--keep-proper-nouns` — 고유명사를 난이도로 세던 예전 동작으로 되돌린다(대조용).
 * 기본은 빼는 쪽이다: 이 소스에서는 그것이 옳다는 것을 쟀다.
 */
const PROPER_NOUNS_OUT = !process.argv.includes('--keep-proper-nouns')
/**
 * 표집 방법. `allpages`(기본)는 **바이트 하한을 서버에 걸어** 토막글을 안 받는다.
 * `random` 은 대조용으로 남긴다 — 걸러서 좋아진 것인지 우연인지 대 봐야 하기 때문이다.
 */
const PICK = arg('pick') ?? 'allpages'
/** 바이트 하한. 올리면 짧음이 줄고 어휘 밖이 는다(긴 글일수록 전문어가 많다) — 재서 정한다. */
const MIN_SIZE = Number(arg('minsize') ?? 2000)
/**
 * `--v 1-3` — **채점자와 같은 자로 조준한다.**
 *
 * FK 칸으로 조준했더니 36편 중 목표 V1~V3 에 든 것은 11편뿐이었다(2026-09-05 실측).
 * `article_v_level` 은 FK 가 아니라 **낱말 V-Level 의 75분위**이므로, 적재 전에 그 값을
 * 추정해 범위 밖이면 버린다. 추정기는 정답 36편에 100% 일치했다(`_vlevel.mjs` 참조).
 * 주지 않으면 칸을 안 보고 넣는다 — 예전 동작 그대로다.
 */
const V_RANGE = (() => {
  const v = arg('v')
  if (!v) return null
  const m = String(v).match(/^(\d+)(?:-(\d+))?$/)
  if (!m) {
    console.error(`--v 형식: 1-3 또는 2`)
    process.exit(1)
  }
  return { min: Number(m[1]), max: Number(m[2] ?? m[1]) }
})()

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
const { estimateArticleVLevel, loadVLevelMap, warmUpRest } = await import('./_vlevel.mjs')
const { extractBookLemmas } = await import(
  '../../packages/library-pipeline/src/analyze/extract-lemmas.ts'
)

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

// 사전은 **한 번만** 읽는다 — 글마다 물으면 fetch 가 터진다(2026-09-05 실측).
const warm = V_RANGE ? await warmUpRest(db) : null
if (warm) console.log(`REST 예열 ${warm.ok ? `${warm.ms}ms (${warm.attempts}회째)` : "실패 — 그래도 진행한다"}`)
const vMap = V_RANGE ? await loadVLevelMap(db) : null
if (vMap) console.log(`사전 ${vMap.size.toLocaleString()}낱말 적재`)

// `countWords` · `trimToWindow` 는 `_mediawiki.mjs` 에 있다(위 import 주석 참조).

const sample =
  PICK === 'random'
    ? await mediawikiRandom(wiki.api, LIMIT)
    : await mediawikiAllpages(wiki.api, LIMIT, { minSize: MIN_SIZE })
if (sample.error) {
  console.error(`표집 실패 — ${sample.error}`)
  process.exit(1)
}
console.log(
  `${wiki.label} — 표집 ${sample.items.length}건 / 전체 ${sample.total?.toLocaleString() ?? '?'}` +
    ` · ${PICK}${PICK === 'allpages' ? `(≥${MIN_SIZE}B)` : ''} · 동시 ${CONCURRENCY}` +
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
      if (GAP_MS) await new Promise((z) => setTimeout(z, GAP_MS))
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
/** 추정 V-Level 이 목표 범위 밖. **처리 전에** 버리므로 LLM 비용이 안 든다. */
let vLevelMiss = 0
/** 어휘 게이트가 막았지만 `--no-curriculum` 이라 통과시킨 수 — 겹침의 크기다. */
let vocabBypassed = 0
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
  // 고유명사를 뺀다 — **백과 도입부는 이름 덩어리**라 안 빼면 이름이 난이도로 셈해진다.
  //   실측(n=54): 통과 2 → 20 · 교육과정 밖 평균 10.3%p 하락.
  const vf = curriculumFit(content, school, { excludeProperNouns: PROPER_NOUNS_OUT })
  if (!vf.pass) {
    vocabBlocked++
    // `--no-curriculum` — **끄지 않고 세기만 한다.** V-Level 게이트와 역할이 겹치는지
    //   재려면 "어휘 게이트가 막았지만 V 칸에는 드는 글" 이 몇이고 어떤 것인지 봐야 한다.
    //   끄고 돌린 결과와 켜고 돌린 결과의 차이가 곧 그 게이트의 값이다.
    if (CURRICULUM) continue
    vocabBypassed++
  }
  const sf = standaloneFit(content)
  if (!sf.pass) {
    notStandalone++
    continue
  }

  // ── V-Level 게이트 — **채점자와 같은 자** ──────────────────────────
  // 여기까지 온 것만 추정한다. 사전 조회가 붙으므로 앞의 싼 게이트를 먼저 통과시킨 뒤
  // 재는 것이 싸다. 처리(LLM) 뒤에 버리는 것보다 훨씬 싸기도 하다.
  let estV = null
  if (V_RANGE) {
    const est = estimateArticleVLevel(vMap, extractBookLemmas, content)
    estV = est.vLevel
    if (estV == null || estV < V_RANGE.min || estV > V_RANGE.max) {
      vLevelMiss++
      continue
    }
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
      `${(bandId ?? '-').padEnd(7)} ${estV == null ? "" : `V${estV} `}${wasTrimmed ? '✂ ' : '  '}${item.title.slice(0, 42)}`,
  )
}

console.log(
  `\n추가 ${added}(자르기로 살린 것 ${trimmed}) · 이미 있음 ${existed} · 도입부 없음 ${empty} · ` +
    `짧음 ${tooShort} · 김 ${tooLong} · 잘라도 안 됨 ${trimFailed} · 칸 밖 ${outOfBand} · ` +
    `어휘 밖 ${vocabBlocked}${CURRICULUM ? "" : `(그중 통과 ${vocabBypassed})`} · 자립성 미달 ${notStandalone} · V칸 밖 ${vLevelMiss} · 실패 ${failed}`,
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
