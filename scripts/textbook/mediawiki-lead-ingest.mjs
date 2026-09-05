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
const { gradeBand, bandOf, readability, curriculumFit, standaloneFit } = await import(
  '../../packages/library-pipeline/src/index.ts'
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

const sample = await mediawikiRandom(wiki.api, LIMIT)
if (sample.error) {
  console.error(`표집 실패 — ${sample.error}`)
  process.exit(1)
}
console.log(
  `${wiki.label} — 표집 ${sample.items.length}건 / 전체 ${sample.total?.toLocaleString() ?? '?'}` +
    `${targetBand ? ` · 목표 칸 ${targetBand.id}` : ''}${COMMIT ? '' : ' — dry-run (쓰지 않는다)'}\n`,
)

let added = 0
let existed = 0
/** 도입부가 비었거나 너무 짧다 — 넘겨쓰기(redirect)·토막글이다. */
let empty = 0
/** 어수가 지문 창 밖. */
let outOfWindow = 0
/** FK 가 목표 칸 밖. */
let outOfBand = 0
/** 어휘가 그 학년 밖. */
let vocabBlocked = 0
/** 앞을 가리키며 시작하거나 그 한 편만으로는 못 읽는다. */
let notStandalone = 0
let failed = 0

for (const item of sample.items) {
  const lead = await mediawikiLead(wiki.api, item.id)
  if (lead.error) {
    failed++
    console.log(`  ✗ ${String(lead.error).slice(0, 56)}`)
    continue
  }
  const content = (lead.body ?? '').trim()
  if (!content || content.length < 40) {
    empty++
    continue
  }

  const words = content.split(/\s+/).filter(Boolean).length
  // `readability` 는 숫자가 아니라 {fk, sentenceLength, …} 를 준다.
  //   객체를 그대로 `bandOf` 에 넘겼더니 30건 전부 "칸 밖" 으로 나왔다(수율 0%).
  const fk = readability(content)?.fk ?? null
  if (fk == null) { empty++; continue }
  // `bandOf` 는 칸 **이름**을 준다(사다리 밖이면 `초3 미만`·`중3 초과`).
  // 창을 물으려면 이름으로 칸을 다시 찾아야 한다 — 사다리 밖이면 `undefined` 다.
  const bandId = bandOf(fk)
  const band = gradeBand(bandId)

  // ── 창 검사 ────────────────────────────────────────────────────────
  // 어수 창은 모든 칸이 같다(`PASSAGE_WORDS`). 칸을 안 주면 사다리 전체 창으로 본다.
  const win = targetBand ?? band
  if (!win) {
    outOfBand++
    continue
  }
  if (words < win.wordsMin || words > win.wordsMax) {
    outOfWindow++
    continue
  }
  if (targetBand && bandId !== targetBand.id) {
    outOfBand++
    continue
  }

  const source_id = `${item.id}#lead`
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
  const school = win.id.startsWith('초') ? 'elementary' : 'middle'
  const vf = curriculumFit(content, school)
  if (!vf.pass) {
    vocabBlocked++
    console.log(`  ⊘ ${vf.reason} — ${item.title.slice(0, 42)}`)
    continue
  }
  const sf = standaloneFit(content)
  if (!sf.pass) {
    notStandalone++
    console.log(`  ⊘ ${sf.reason} — ${item.title.slice(0, 42)}`)
    continue
  }

  if (COMMIT) {
    const { error } = await db.from('library_articles').insert({
      source: wiki.source,
      source_id,
      // CC BY-SA 는 "indicate if changes were made" 를 요구한다. 도입부만 쓰는 것은 변경이다.
      title: `${item.title} (도입부)`,
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
  console.log(
    `  ${COMMIT ? '✓' : '·'} ${String(words).padStart(4)}어  FK ${String(fk).padStart(5)}  ` +
      `${(bandId ?? '-').padEnd(7)} ${item.title.slice(0, 46)}`,
  )
}

console.log(
  `\n추가 ${added} · 이미 있음 ${existed} · 도입부 없음 ${empty} · 어수 밖 ${outOfWindow} · ` +
    `칸 밖 ${outOfBand} · 어휘 밖 ${vocabBlocked} · 자립성 미달 ${notStandalone} · 실패 ${failed}`,
)
const seen = sample.items.length
if (seen) console.log(`수율 ${((added / seen) * 100).toFixed(1)}% (${added}/${seen})`)
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
