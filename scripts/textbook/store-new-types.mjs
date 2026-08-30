// scripts/textbook/store-new-types.mjs
//
// **교재용 문항을 `csat_dcp_items` 에 넣는다.**
//
// 수능 축 4종(흐름 무관 · 어휘 · 어법 · 영작 배열) + **중등 내신 4종**(빈칸에 낱말 쓰기 ·
// 어법 틀린 것 고쳐 쓰기 · 본문 어휘 뜻 · 단원 문법, 2026-08-22 추가).
//
// ⚠️ **듣고 고르기(`listen_choose`)는 여기 없다** — 지문이 아니라 사전에서 나와 `ref_id` 가 없다.
//   초등 3종(파닉스·기본어휘 뜻·철자 완성)과 같이 순수 함수로 남는다.
//
// ── 유일키가 문단당 하나를 강제한다 ──────────────────────────────────
// 유일키는 `(kind, ref_id, type, paragraph_idx)` 다. 순서·삽입은 원래 문단당 하나라
// 문제가 없었는데, **영작 배열은 문단 안 여러 문장이 후보가 된다.** 그래서 문단마다
// 하나만 고른다 — 고르는 기준은 **낱말 수가 그 문단 후보들의 중앙값에 가장 가까운 것**이다
// (가장 대표적인 문장). 동점이면 문장 순서가 앞선 것. 결정론이라 몇 번 돌려도 같다.
//
// 교재에서도 한 지문에 서술형 하나가 맞으므로 이 제한이 손해만은 아니다. 다만 **얼마나
// 버려지는지 숫자로 남긴다** — 나중에 유일키를 넓힐지 판단할 근거가 된다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// 유일키가 중복을 막는다. 이미 있는 조합은 건너뛴다. 기존 문항의 id 를 바꾸지 않으므로
// 학습 기록이 끊기지 않는다. `--commit` 없이는 아무것도 쓰지 않는다.
//
// ── 규칙이 엄해지면 먼저 넣은 것이 낡는다 ────────────────────────────
// 인쇄 가능 판정(`isPrintablePassage`)이 나중에 엄해지면 **그 전에 넣은 문항은 새 규칙을
// 못 받는다.** 그래서 매 실행이 기존 문항도 다시 재고, 지금 규칙으로 못 실을 것을 센다.
// **세는 것과 지우는 것은 다른 스위치다** — 지우기는 `--prune` 을 줬을 때만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs            # 몇 개 늘고 몇 개 낡았는지만 본다
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs --commit   # 새 문항 적재
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs --prune    # 낡은 문항 삭제 (되돌릴 수 없다)

import fs from 'node:fs'
import path from 'node:path'

import { fetchAllIn, fetchAllPaged, withRetry } from './volume-pool.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
/**
 * 한 밴드만 처리한다 — **드레인 한 바퀴를 돌리려고 몇 시간을 기다리지 않기 위해서다.**
 *
 * 이 스크립트는 글 5,900편과 문항 13만 건을 매번 다시 잰다(규칙이 엄해지면 먼저 넣은 것이
 * 낡기 때문이다 — 위 머리말 참조). 그 전수 검사는 옳지만, 새로 쓴 글 40편의 문항을 보려고
 * 그것을 다 기다릴 이유는 없다. 실측 2026-08-30: 전수 실행 셋이 CPU 200분씩 물고 동시에
 * 돌고 있었고, 그중 둘은 세 시간 넘게 안 끝났다.
 *
 * ⚠️ **밴드를 좁히면 "낡은 문항" 집계도 그 밴드만이다.** 전체 정리는 인자 없이 돌린다.
 */
const BAND = arg('band') == null ? null : Number(arg('band'))
const commit = process.argv.includes('--commit')
// 지우기는 별도 플래그다 — 되돌릴 수 없는 동작을 적재와 같은 스위치에 묶지 않는다.
const prune = process.argv.includes('--prune')

const { createClient } = await import('@supabase/supabase-js')
const {
  buildIrrelevant,
  buildWordOrder,
  buildVocabChoice,
  buildGrammarChoice,
  buildBlankWord,
  buildGrammarFix,
  buildUnitVocab,
  buildUnitGrammar,
  isPrintablePassage,
  CSAT_ITEM_WORDS,
  MIDDLE_CHOICES,
  MIDDLE_ITEM_WORDS,
  GRAMMAR_UNDERLINES,
  VOCAB_UNDERLINES,
} = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ **여기에 페이징이 없었다 — 같은 함정에 네 번째다.**
//   PostgREST 는 요청 크기와 무관하게 1000행에서 자른다. 이 파일 아래쪽(`existing`)에는
//   그 경고가 적혀 있는데 정작 **원글 조회 자신**이 안 걸려 있었다. 실측 2026-08-30:
//   쓸 수 있는 글이 **3,356편**인데 스크립트는 **981편(29%)** 만 보고 있었다.
//   그래서 낡음 판정이 나머지 71%를 아예 안 봤고, 4지선다 2,886건이 "낡음 0건" 으로 보고됐다.
//   `range()` 로 실제로 다 받는다.
/**
 * 한 번에 받는 기사 수 — **`content` 때문에 1,000 은 너무 크다.**
 *
 * ⚠️ 실측 2026-08-30: V7(원글 1,829편)에서 이 조회가
 *   `canceling statement due to statement timeout` 으로 죽었다. 다른 조회는 id 나 키만
 *   가져오지만 여기는 **본문 전체**를 싣는다 — 한 편이 수천 자라 1,000편이면 수 MB 다.
 *   행 수가 아니라 **바이트가 상한**이라, 같은 1,000이라도 이 조회만 걸린다.
 *   200 으로 줄이면 왕복이 다섯 배가 되지만 각 요청이 가벼워 실제로는 더 빨리 끝난다.
 */
const ARTICLE_PAGE = 200
const arts = []
for (let from = 0; ; from += ARTICLE_PAGE) {
  let q = db
    .from('library_articles')
    .select('id, article_v_level, display_only, content')
    .in('status', ['ready', 'published'])
    .not('content', 'is', null)
  // --band 을 주면 그 밴드만 본다. 전수는 몇 시간이 걸린다(위 BAND 주석 참조).
  if (BAND != null) q = q.eq('article_v_level', BAND)
  // ⚠️ 여기서 끊기면 몇 천 편을 다 읽고 나서 통째로 잃는다 — 실측 2026-08-30 에
  //   V5(3,408편)를 다 읽은 뒤 Cloudflare 525 로 죽었다. 일시적 실패는 다시 시도한다.
  const data = await withRetry('기사', () => q.order('id').range(from, from + ARTICLE_PAGE - 1))
  if (!data?.length) break
  arts.push(...data)
  if (data.length < ARTICLE_PAGE) break
}
const usable = arts.filter((a) => !a.display_only)

// ⚠️ 아래 낡음 판정이 이 목록으로 문항을 좁힌다. 위 `existing` 조회가 `fetchAllPaged` 로
//   바뀌면서 이 줄이 함께 지워졌는데 **두 번째 사용처가 남아 있어** 실행이 매번
//   `ReferenceError: ids is not defined` 로 죽었다(2026-08-30). 지우려면 두 곳을 함께 본다.
const ids = usable.map((a) => a.id)

const paras = (c) =>
  String(c)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const sents = (p) =>
  p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

// ── 사전 ────────────────────────────────────────────────────────────
/** 뜻의 첫 갈래 — `elementary.ts` 의 `firstSense` 와 같은 규칙. */
const firstSense = (t) => String(t).split(/[;,·/]|\s\d[.)]/)[0].trim()

const vLevelOf = new Map()
const meaningOf = new Map()
const antOf = new Map()
const posOf = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, v_level, antonyms, primary_pos, meaning_ko')
    .order('word')
    .range(from, from + 999)
  if (e) throw new Error('사전 조회 실패: ' + e.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word).toLowerCase()
    vLevelOf.set(w, r.v_level)
    if (Array.isArray(r.antonyms) && r.antonyms.length) antOf.set(w, r.antonyms.map(String))
    if (r.primary_pos) posOf.set(w, String(r.primary_pos))
    // 빈칸 단서와 본문 어휘 보기는 우리말 뜻을 탄다. 뜻이 없으면 그 낱말은 못 쓴다.
    if (r.meaning_ko) meaningOf.set(w, firstSense(String(r.meaning_ko)))
  }
  if (data.length < 1000) break
}
const MAX_V = Math.max(...[...vLevelOf.values()].filter((v) => v != null))
const isCommon = (w) => vLevelOf.has(w.toLowerCase())
const rarity = (w) => vLevelOf.get(w.toLowerCase()) ?? MAX_V
const lex = {
  antonymsOf: (w) => antOf.get(w.toLowerCase()) ?? [],
  posOf: (w) => posOf.get(w.toLowerCase()) ?? null,
}

// ── 빈칸 단서의 유일성 ──────────────────────────────────────────────
// 첫 글자 + 첫 뜻이 같은 낱말이 사전에 둘 이상이면 단서가 답을 확정하지 못한다.
// **이 검사가 없으면 생성분의 9.88% 가 채점이 갈린다**(실측 2026-08-22:
// `exploration` 의 "e… (탐험)" · `about` 의 "a… (~에 관하여)").
// `elementary.ts` 의 철자 완성이 `c_t`(cat·cot·cut)를 사전으로 세어 거르는 것과 같은 규칙이다.
const hintIdx = new Map()
for (const [w, m] of meaningOf) {
  const k = `${w[0]}|${m}`
  hintIdx.set(k, (hintIdx.get(k) ?? 0) + 1)
}
const meaningLookup = (w) => meaningOf.get(w.toLowerCase()) ?? null
const hintUnique = (w, m) => (hintIdx.get(`${w[0]}|${m}`) ?? 0) <= 1

/** 본문 어휘 뜻의 보기 풀 — 사전 전체에서 뜻이 있는 낱말. */
const meaningPool = [...meaningOf].map(([word, meaningKo]) => ({ word, meaningKo, rhymeKey: null }))
const entryOf = (w) => {
  const m = meaningOf.get(w.toLowerCase())
  return m ? { word: w.toLowerCase(), meaningKo: m, rhymeKey: null } : null
}

// ── 이미 있는 조합 ──────────────────────────────────────────────────
// ⚠️ **기사를 20편씩 끊는 것만으로는 모자랐다.** `.limit(20000)` 은 PostgREST 의 1000행
//   상한을 못 넘는다 — 아무리 크게 적어도 서버가 1000에서 자른다. 실측(2026-08-22):
//   20편 조각 31개 중 **2개가 1022행**이라 그만큼의 기존 키가 이 Set 에서 빠졌고,
//   그래서 INSERT 가 `csat_dcp_items_kind_ref_id_type_paragraph_idx_key` 중복으로 죽었다.
//   (같은 함정에 이 저장소가 세 번째다. 그래서 회귀가 이제 이 폴더 전체를 본다.)
//   `.range()` 로 실제로 넘겨 받는다 — 정렬을 고정해야 페이지가 겹치거나 새지 않는다.
// ⚠️ **`.in()` 으로 원글을 끊어 묻지 않는다.** `fetchAllIn` 은 20편씩 나눠 묻는데,
//   원글이 1.2만 편이면 그것만으로 **600회 넘는 왕복**이다 — 원글이 늘수록 느려진다
//   (실측 2026-08-30: 원글이 하루 만에 6천 → 1.2만 편이 되자 이 조회에서 한 시간을 넘겨도
//    끝나지 않았고, 출력이 끝에 한 번뿐이라 멈춘 것처럼 보였다).
//
//   기사별로 물을 이유가 없다 — 필요한 것은 `kind='article'` 인 키 전부다.
//   1,000행씩 곧장 넘겨 받으면 13.6만 문항이 **137회**로 끝난다.
//   정렬을 고정해야 페이지가 겹치거나 새지 않는다(이 저장소가 세 번 밟은 함정).
// ⚠️ **밴드를 좁혀도 이 조회는 안 좁혀졌다 — 그게 배치가 느린 진짜 이유였다.**
//   실측 2026-08-30: `--band 7`(원글 1,829편)이 9분 20초에도 안 끝났다. 기사 조회는
//   10회면 되는데 이 전수 조회가 **140회**를 물고 있었기 때문이다. 밴드가 1,829편이든
//   8,725편이든 이 비용은 똑같이 든다.
//
//   ⚠️ **`v_level` 로는 못 좁힌다.** 문항의 `v_level` 은 만들 때 박히는데 원글 레벨이
//     나중에 바뀌면 어긋난다 — 실측 140,405건 중 **236건(0.17%)** 이 그렇다.
//     그만큼 키를 놓치면 INSERT 가 유일키 중복으로 죽는다(이 파일이 이미 한 번 겪었다).
//     그래서 `ref_id` 로 정확히 좁히되 **묶음을 100 으로 키워** 왕복을 줄인다
//     (`fetchAllIn` 의 20 은 UUID 기준으로 지나치게 보수적이다 — 100개면 URL 3.8KB).
//   ⚠️ **이 갈래의 효과는 검증되지 않았다.** 전수 스캔이 밴드와 무관하게 140회라는 산술은
//     맞지만, 바꾸기 **전** V4 의 깨끗한 소요 시간을 재 두지 않아 실제로 빨라졌는지 말할 수
//     없다. 바꾼 뒤 V4 재실행은 8분 10초였고 그 시간이 어디로 가는지도 안 쟀다
//     (후보: 사전 4.9만 낱말 적재 · 생성 CPU · "낡은 문항" 재검사).
//     **다음 사람은 고치기 전에 그것부터 재라** — 계측 없이 고치면 나아졌는지 알 수 없다.
const KEY_CHUNK = 100
const existing = new Set()
const addKey = (r) => existing.add(`${r.ref_id}|${r.type}|${r.paragraph_idx}`)
if (BAND == null) {
  // 전수 실행에서는 밴드로 나눌 것이 없다 — 1,000행씩 곧장 받는 편이 싸다.
  for (const r of await fetchAllPaged(db, (q) =>
    q.from('csat_dcp_items').select('ref_id, type, paragraph_idx').eq('kind', 'article').order('id'))) {
    addKey(r)
  }
} else {
  for (let i = 0; i < ids.length; i += KEY_CHUNK) {
    const slice = ids.slice(i, i + KEY_CHUNK)
    for (const r of await fetchAllPaged(db, (q) =>
      q
        .from('csat_dcp_items')
        .select('ref_id, type, paragraph_idx')
        .eq('kind', 'article')
        .in('ref_id', slice)
        .order('id'))) {
      addKey(r)
    }
  }
}

/**
 * 후보 문장의 낱말 수 창 — **밴드마다 다르다.**
 *
 * ⚠️ **2026-08-30 정정 — 하한 8 이 모든 밴드에 걸려 있었다.** 그 값은 수능 산문에
 *   맞춘 것인데, 초등 규격(`GRADE_BANDS.elementary`)은 **평균 문장 9어**라 절반 이상이
 *   그 아래로 떨어진다. 실측(2단 각색본 17편 · 253문장):
 *
 *     하한 8   117문장 (46.2%)   ← 초등 교재를 규격대로 잘 쓸수록 문항이 덜 나온다
 *     하한 6   214문장 (84.6%)
 *     하한 5   241문장 (95.3%)
 *     하한 4   251문장 (99.2%)   ← `Rain falls.` 같은 두 낱말 조각까지 들어온다
 *
 *   초등 하한을 **6** 으로 둔다 — 목표 평균 9어의 3분의 2이고, 그 아래는 조각이라
 *   문항이 못 된다. **다른 밴드는 건드리지 않는다**(이미 만들어진 권이 달라지면 안 된다).
 *
 *   이 저장소는 다른 자리에서 이미 밴드·유형별로 자를 갈라 댄다
 *   (`MIDDLE_ITEM_WORDS` 40~152 · `compose-unit.itemWordSpec`). 이 창만 몰랐다.
 */
const SENTENCE_WORDS = (band) => (band >= 1 && band <= 2 ? { min: 6, max: 20 } : { min: 8, max: 20 })

// ── 후보 풀 (같은 밴드 안에서만 빌려 온다) ──────────────────────────
const poolByBand = new Map()
for (const a of usable) {
  const band = a.article_v_level ?? -1
  const win = SENTENCE_WORDS(band)
  for (const p of paras(a.content)) {
    for (const s of sents(p)) {
      const n = s.split(/\s+/).length
      if (n < win.min || n > win.max) continue
      const arr = poolByBand.get(band) ?? []
      arr.push({ text: s, ref: a.id })
      poolByBand.set(band, arr)
    }
  }
}

// ── 생성 ────────────────────────────────────────────────────────────
const rows = []
let skipped = 0
let woCandidates = 0
let woParagraphs = 0
// 중등 단답 두 종도 문단 안 여러 문장이 후보다 — `word_order` 와 같은 이유로 문단당 하나만 넣고,
// **버린 수를 남긴다**(나중에 유일키를 넓힐지 판단할 근거).
const midDrop = { blank_word: { made: 0, kept: 0 }, grammar_fix: { made: 0, kept: 0 } }

for (const a of usable) {
  const band = a.article_v_level ?? -1
  const pool = poolByBand.get(band) ?? []
  const ps = paras(a.content)

  for (let pi = 0; pi < ps.length; pi++) {
    const ss = sents(ps[pi])

    // ① 흐름 무관 — 문단당 하나
    if (ss.length >= 5) {
      const item = buildIrrelevant(ss, pool, a.id, rarity)
      if (item) {
        const key = `${a.id}|irrelevant|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'irrelevant',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { intro: item.intro, sentences: item.sentences },
            answer_key: {
              position: item.answer,
              foreign_ref: item.foreign.ref,
              overlap_gap: item.overlapGap,
            },
          })
      }
    }

    // ② 어휘 — 문단당 하나
    if (ss.length >= VOCAB_UNDERLINES) {
      const item = buildVocabChoice(ss, lex)
      if (item) {
        const key = `${a.id}|vocab_choice|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'vocab_choice',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { sentences: item.sentences, underlines: item.underlines },
            answer_key: { position: item.answer, original: item.original },
          })
      }
    }

    // ③ 어법 — 문단당 하나
    if (ss.length >= GRAMMAR_UNDERLINES) {
      const item = buildGrammarChoice(ss)
      if (item) {
        const key = `${a.id}|grammar_choice|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'grammar_choice',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { sentences: item.sentences, underlines: item.underlines },
            answer_key: { position: item.answer, original: item.original, rule: item.rule },
          })
      }
    }

    // ④ 영작 배열 — 문단 안 후보 중 하나만 (유일키 제약)
    const cands = []
    for (let si = 0; si < ss.length; si++) {
      const item = buildWordOrder(ss[si], si > 0 ? ss[si - 1] : null, isCommon)
      if (item) cands.push({ item, si })
    }
    woCandidates += cands.length
    if (cands.length) {
      woParagraphs++
      // 가장 대표적인 문장 = 낱말 수가 후보 중앙값에 가장 가까운 것. 동점이면 앞선 문장.
      const lens = cands.map((c) => c.item.bank.length).sort((x, y) => x - y)
      const mid = lens[Math.floor(lens.length / 2)]
      cands.sort(
        (x, y) => Math.abs(x.item.bank.length - mid) - Math.abs(y.item.bank.length - mid) || x.si - y.si,
      )
      const { item, si } = cands[0]
      const key = `${a.id}|word_order|${pi}`
      if (existing.has(key)) skipped++
      else
        rows.push({
          kind: 'article',
          ref_id: a.id,
          type: 'word_order',
          item_role: 'practice',
          paragraph_idx: pi,
          v_level: a.article_v_level,
          payload: { bank: item.bank, context: item.context, sentence_idx: si },
          answer_key: { sentence: item.answer },
        })
    }

    // ⑤ 중등 단답 2종 — 문단 안 후보 중 하나만 (유일키 제약, `word_order` 와 같다).
    //   고르는 기준도 같다: **가장 이른 문장**. 단답은 문맥이 앞 문장이라 앞쪽이 안전하다
    //   (뒤쪽 문장을 고르면 앞 문단을 안 읽어도 되는 문항이 섞인다).
    for (const [type, build] of [
      ['blank_word', (t, c) => buildBlankWord(t, c, meaningLookup, hintUnique)],
      ['grammar_fix', (t, c) => buildGrammarFix(t, c)],
    ]) {
      let picked = null
      let pickedIdx = -1
      for (let si = 0; si < ss.length; si++) {
        const item = build(ss[si], si > 0 ? ss[si - 1] : null)
        if (!item) continue
        midDrop[type].made++
        if (!picked) {
          picked = item
          pickedIdx = si
        }
      }
      if (!picked) continue
      midDrop[type].kept++
      const key = `${a.id}|${type}|${pi}`
      if (existing.has(key)) {
        skipped++
        continue
      }
      rows.push({
        kind: 'article',
        ref_id: a.id,
        type,
        item_role: 'practice',
        paragraph_idx: pi,
        v_level: a.article_v_level,
        payload: {
          stem: picked.stem,
          hint: picked.hint,
          context: picked.context,
          prompt_ko: picked.promptKo,
          sentence_idx: pickedIdx,
        },
        answer_key: { text: picked.answerText, ...(picked.rule ? { rule: picked.rule } : {}) },
      })
    }

    // ⑥ 중등 객관식 2종 — 원래 문단당 하나라 유일키와 다투지 않는다.
    for (const [type, item] of [
      ['unit_vocab', buildUnitVocab(ss, entryOf, meaningPool)],
      ['unit_grammar', buildUnitGrammar(ss)],
    ]) {
      if (!item) continue
      const key = `${a.id}|${type}|${pi}`
      if (existing.has(key)) {
        skipped++
        continue
      }
      rows.push({
        kind: 'article',
        ref_id: a.id,
        type,
        item_role: 'practice',
        paragraph_idx: pi,
        v_level: a.article_v_level,
        payload: {
          sentences: item.sentences,
          choices: item.choices,
          prompt_ko: item.promptKo,
          ...(item.target ? { target: item.target } : {}),
          ...(item.underlines ? { underlines: item.underlines } : {}),
        },
        answer_key: { answer: item.answer, ...(item.original ? { original: item.original } : {}) },
      })
    }
  }
}

const byType = {}
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1

console.log('─'.repeat(72))
console.log(
  `글 ${usable.length}편 (ND 제외)` +
    (BAND == null ? ' · **전 밴드**' : ` · **V${BAND} 만** — 낡음 집계도 이 밴드뿐이다`) +
    '\n',
)
console.log(`  새로 넣을 문항  ${rows.length}`)
for (const [t, n] of Object.entries(byType)) console.log(`    ${t.padEnd(14)} ${n}`)
for (const [t, d] of Object.entries(midDrop)) {
  if (!d.made) continue
  const drop = d.made - d.kept
  console.log(
    `    ${t.padEnd(14)} 유일키로 버림 ${drop} / 생성 ${d.made} (${((100 * drop) / d.made).toFixed(1)}%)`,
  )
}
console.log(`  이미 있어 건너뜀 ${skipped}`)
console.log(
  `\n  영작 배열 — 후보 ${woCandidates}개가 문단 ${woParagraphs}개에 흩어져 있다.` +
    `\n    유일키가 문단당 하나만 받으므로 **${woCandidates - woParagraphs}개를 못 넣는다**` +
    ` (${((100 * (woCandidates - woParagraphs)) / (woCandidates || 1)).toFixed(1)}%).` +
    `\n    한 지문에 서술형 하나는 교재로서 자연스럽다. 더 필요해지면 유일키를 넓혀야 한다.`,
)

// ── 이미 넣은 것 중 지금 규칙으로는 실을 수 없는 것 ─────────────────
//
// 규칙이 나중에 엄해지면 **먼저 넣은 것이 그 규칙을 못 받는다.** 2026-08-21 에
// 용어풀이 필터(`isPrintablePassage`)를 넣었는데, 그 전에 적재한 어휘 문항 중 일부가
// VOA 기사 끝 용어풀이를 지문에 달고 있었다. 교재에 그대로 인쇄되면 안 된다.
//
// 여기서는 **세기만** 한다. 지우는 것은 `--prune` 을 줬을 때뿐이다.
//
// 낡음의 정의는 **"지금 규칙으로 다시 만들면 다른 것이 나온다"** 이다. 인쇄 가능 여부만
// 보던 첫 판은 좁았다 — 2026-08-21 에 지문을 규격 구간으로 잘라 쓰도록 바꾸자
// **저장본의 지문 자체가 달라졌는데** 그 판정으로는 하나도 안 걸렸을 것이다.
/** 중등 규격(40~152어)을 쓰는 유형 — 수능 창으로 재면 전량 규격 밖이 된다. */
const MIDDLE_TYPES = new Set(['unit_vocab', 'unit_grammar', 'blank_word', 'grammar_fix'])
/** 보기 수 규격(`MIDDLE_CHOICES`)을 지켜야 하는 유형 — 저장된 값만으로 판정된다. */
const MIDDLE_CHOICE_TYPES = new Set(['unit_vocab', 'unit_grammar'])

const rebuilders = {
  vocab_choice: (ss) => {
    const it = buildVocabChoice(ss, lex)
    return it && { payload: { sentences: it.sentences, underlines: it.underlines }, answer: it.answer }
  },
  grammar_choice: (ss) => {
    const it = buildGrammarChoice(ss)
    return it && { payload: { sentences: it.sentences, underlines: it.underlines }, answer: it.answer }
  },
  // ⚠️ 2026-08-30 추가 — 아래 넷은 2026-08-22 에 유형이 생긴 뒤 **한 번도 재검된 적이 없었다.**
  //   낡음 판정이 수능 3종만 보고 있었고, 그래서 `MIDDLE_CHOICES` 를 4→5 로 고쳤을 때
  //   기존 4,135문항이 "낡음 0건" 으로 나왔다. 유형을 늘리면 여기도 늘려야 한다.
  unit_vocab: (ss) => {
    const it = buildUnitVocab(ss, entryOf, meaningPool)
    return it && {
      payload: { sentences: it.sentences, target: it.target, choices: it.choices },
      answer: it.answer,
    }
  },
  unit_grammar: (ss) => {
    const it = buildUnitGrammar(ss)
    return it && {
      payload: { sentences: it.sentences, underlines: it.underlines },
      answer: it.answer,
    }
  },
}

/**
 * 유형마다 "달라졌다" 의 뜻이 다르다.
 *
 * 문장만 대조하면 **보기 수가 바뀐 것을 못 잡는다** — 실제로 그랬다.
 * 그래서 유형별로 무엇을 비교할지 여기 적는다.
 */
const staleSignature = {
  vocab_choice: (now, row) => JSON.stringify(now.payload.sentences) !== JSON.stringify(row.payload?.sentences)
    || now.answer !== row.answer_key?.position,
  grammar_choice: (now, row) => JSON.stringify(now.payload.sentences) !== JSON.stringify(row.payload?.sentences)
    || now.answer !== row.answer_key?.position,
  unit_vocab: (now, row) => (now.payload.choices?.length ?? 0) !== (row.payload?.choices?.length ?? 0)
    || now.payload.target !== row.payload?.target
    || JSON.stringify(now.payload.sentences) !== JSON.stringify(row.payload?.sentences),
  unit_grammar: (now, row) => (now.payload.underlines?.length ?? 0) !== (row.payload?.underlines?.length ?? 0)
    || JSON.stringify(now.payload.sentences) !== JSON.stringify(row.payload?.sentences),
}

// (글, 문단) → 문장들. 재생성 대조에 쓴다.
const paragraphOf = new Map()
for (const a of usable) {
  const ps = paras(a.content)
  for (let pi = 0; pi < ps.length; pi++) paragraphOf.set(`${a.id}|${pi}`, sents(ps[pi]))
}

const stale = []
/** 원본 문단을 못 찾아 재생성 대조를 못 한 문항 — 유형별. 조용히 넘기지 않고 보고한다. */
const uncomparable = {}
{
  const rows = await fetchAllIn(
    db,
    'csat_dcp_items',
    'id, type, ref_id, paragraph_idx, payload, answer_key',
    'ref_id',
    ids,
    ['id'],
    (q) => q.eq('kind', 'article').in('type', ['irrelevant', 'vocab_choice', 'grammar_choice', 'unit_vocab', 'unit_grammar']),
  )
  for (const r of rows) {
    const text = [r.payload?.intro, ...(r.payload?.sentences ?? [])].filter(Boolean).join(' ')
    if (text && !isPrintablePassage(text)) {
      stale.push({ id: r.id, type: r.type, why: '인쇄 불가' })
      continue
    }
    // 지문 규격은 **유형마다 자가 다르다** — 중등 유형에 수능 창(90~200어)을 대면
    // 멀쩡한 문항이 전량 "규격 밖" 으로 잡힌다.
    // `irrelevant` 는 재생성 대조를 못 한다(후보 풀이 그때그때 다르다) — 규격으로만 본다.
    const spec = MIDDLE_TYPES.has(r.type) ? MIDDLE_ITEM_WORDS : CSAT_ITEM_WORDS
    const n = text ? text.split(/\s+/).filter(Boolean).length : 0
    if (n && (n < spec.min || n > spec.max)) {
      stale.push({ id: r.id, type: r.type, why: `지문 규격 밖 (${n}어)` })
      continue
    }
    // ── 규격 검사는 **원본 문단 없이도** 된다 ──────────────────────
    // 재생성 대조는 원본 문단이 있어야 하는데, 문단을 못 찾으면 예전에는 그냥
    // `continue` 했다. 그래서 보기 수가 규격 밖인 문항 2,886건이 "낡음 0건" 으로
    // 보고됐다. **조용한 건너뛰기는 구멍을 영영 남긴다** — 저장된 값만 보고
    // 판정할 수 있는 것은 여기서 먼저 본다.
    if (MIDDLE_CHOICE_TYPES.has(r.type)) {
      const n = r.payload?.choices?.length ?? 0
      if (n && n !== MIDDLE_CHOICES) {
        stale.push({ id: r.id, type: r.type, why: `보기 수 규격 밖 (${n}지)` })
        continue
      }
    }
    const rebuild = rebuilders[r.type]
    if (!rebuild) continue
    const ss = paragraphOf.get(`${r.ref_id}|${r.paragraph_idx}`)
    // 문단을 못 찾으면 대조를 못 한다 — **세어서 보고한다.** 조용히 넘기지 않는다.
    if (!ss) { uncomparable[r.type] = (uncomparable[r.type] ?? 0) + 1; continue }
    const now = rebuild(ss)
    // 지금 규칙으로는 아예 안 만들어지거나, 만들어도 내용이 다르면 낡은 것이다.
    if (!now) {
      stale.push({ id: r.id, type: r.type, why: '지금 규칙으로는 안 만들어짐' })
    } else if ((staleSignature[r.type] ?? (() => false))(now, r)) {
      stale.push({ id: r.id, type: r.type, why: '다시 만들면 달라짐' })
    }
  }
}
if (Object.keys(uncomparable).length) {
  const total = Object.values(uncomparable).reduce((a, n) => a + n, 0)
  console.log(`\n  대조 불가 ${total}건 — 원본 문단을 못 찾았다(글이 바뀌었거나 ND 로 빠졌다).`)
  for (const [t, n] of Object.entries(uncomparable).sort((a, b) => b[1] - a[1])) {
    console.log(`       ${t.padEnd(16)} ${n}`)
  }
  console.log(`     규격으로 판정되는 것(보기 수 등)은 위에서 이미 걸렀다.`)
}
if (stale.length) {
  const byStaleType = {}
  for (const s of stale) {
    const k = `${s.type} — ${s.why}`
    byStaleType[k] = (byStaleType[k] ?? 0) + 1
  }
  console.log(`\n  ⚠️ 지금 규칙으로 낡은 기존 문항 ${stale.length}건`)
  for (const [k, n] of Object.entries(byStaleType).sort((a, b) => b[1] - a[1])) {
    console.log(`       ${k.padEnd(40)} ${n}`)
  }
  console.log('     --prune 으로 지운 뒤 --commit 으로 다시 넣는다 (지우기는 되돌릴 수 없다).')
}

if (!commit && !prune) {
  console.log('\n  --commit 없이 실행했다. 아무것도 쓰지 않았다.')
  process.exit(0)
}

if (prune && stale.length) {
  for (let i = 0; i < stale.length; i += 200) {
    const chunk = stale.slice(i, i + 200).map((s) => s.id)
    const { error: e } = await db.from('csat_dcp_items').delete().in('id', chunk)
    if (e) throw new Error(`삭제 실패: ${e.message}`)
  }
  console.log(`\n  삭제 완료 ${stale.length}건`)
}

if (!commit) process.exit(0)

// ⚠️ **`insert` 가 아니라 `upsert` 다.** 머리말은 "재실행 안전 — 유일키가 중복을 막는다"
//   라고 적어 두었는데, 실제로는 자기 스냅샷에 있는 중복만 걸렀다. 스냅샷을 뜬 뒤에
//   **다른 실행이 같은 행을 넣으면 유일키 충돌로 통째로 죽는다** — 이 워크스페이스는
//   여러 세션이 붙어 있어서 실제로 이 스크립트가 넷이 동시에 돌고 있었다(2026-08-30 실측).
//   `ignoreDuplicates` 로 이미 있는 조합을 건너뛴다. 기존 행은 건드리지 않으므로
//   학습 기록이 끊기지 않는다(덮어쓰면 id 가 바뀔 수 있다).
let inserted = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const { error: e } = await db
    .from('csat_dcp_items')
    .upsert(chunk, { onConflict: 'kind,ref_id,type,paragraph_idx', ignoreDuplicates: true })
  // 조용히 삼키지 않는다 — 실패를 못 보면 "넣었다" 고 착각한다.
  if (e) throw new Error(`적재 실패 (${i}~${i + chunk.length}): ${e.message}`)
  inserted += chunk.length
}
console.log(`\n  적재 완료 ${inserted}건`)
