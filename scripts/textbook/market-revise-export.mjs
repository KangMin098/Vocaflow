// scripts/textbook/market-revise-export.mjs
//
// **개정 드레인 ①/③ — 이미 넣은 지문 중 시중보다 쉬운 것을 골라 고칠 몫으로 뽑는다.**
//
// ── 왜 새로 쓰지 않고 고치는가 (실측 2026-09-05) ─────────────────────
// 우리가 쓴 지문 368편의 시중 자리 중앙이 **14.7** 이다(50 = 시중 중앙). 외부 소스는
// 대부분 40~79 다. 밴드를 통제해도 같다 — 초6~중1 칸이 우리 글을 빼면 16.5 → 72.6.
//
// 이 368편은 **버릴 것이 아니다**: 문항 4,877개가 붙어 있고, V2·V3 칸은 원글이 모자라
// 단원이 안 만들어지던 자리를 이 글들이 메웠다. 그래서 내리는 대신 **고친다.**
//
// ⚠️ **본문이 바뀌면 붙어 있던 문항이 낡는다.** 실측한 비용:
//
//     store-new-types 가 되만드는 것   3,322  (자동)
//     refresh-dcp-items 가 되만드는 것 1,219  (자동)
//     **LLM 이 쓴 것**                   338  ← 다시 써야 한다
//                                     (blank 86 · topic 56 · title 45 · mood 45 · …)
//
// 그래서 적재 뒤 순서가 있다 — 아래 §이어서 돌릴 것.
//
// ── 무엇을 청크에 싣는가 ─────────────────────────────────────────────
// **비율만 주면 못 고친다.** 앞 사이클에서 집필 명세에 "밖 비율 ~30%" 를 적어 주고
// 직접 겨냥해 썼는데도 5편 중 2편이 하한 아래였다 — 저자는 `warmth`·`equator` 가
// 교육과정 3,000 밖인지 **감으로 알 수 없다.** 그래서 낱말을 싣는다:
//
//   · 지금 밖인 낱말이 무엇인지 (`outside_words`)
//   · 몇 낱말을 바꿔야 겨냥에 닿는지 (`swap_needed`)
//   · V-Level 꼬리가 무엇인지 (`v_tail`) — 어휘를 올리다 밴드가 위로 튀는 것을 막는다
//
// 되먹임은 `passage-ruler-check.mjs` 가 같은 자로 다시 재 준다.
//
// 재실행 안전: 읽기만 한다. 청크 파일은 덮어쓴다.
//   **이미 겨냥에 닿은 글은 뽑지 않는다** — 몇 번 돌려도 남은 몫만 나온다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/market-revise-export.mjs --band 3 --need 10 --size 5
//
// ── 이어서 돌릴 것 (개정 뒤) ─────────────────────────────────────────
//   1. write-drain-import.mjs --band N --dir <이 디렉터리> --update-existing --commit
//   2. acp/reprocess.mjs --missing-vocab --commit        (어휘·CEFR·밴드 다시)
//   3. store-new-types.mjs --prune                        (낡은 문항 삭제 · 되돌릴 수 없다)
//   4. store-new-types.mjs --commit · refresh-dcp-items.mjs --commit  (되만들기)

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllPaged } from './volume-pool.mjs'
loadEnv()

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 3)
/**
 * **한 청크 5편.** 10편으로 키워 봤다가 되돌렸다(실측 2026-09-06 · 같은 레시피):
 *
 *     5편 배치 — 2패스에 중앙 **63.5** · 겨냥 도달 3/5 · 1패스에서 하한 미만 0
 *     10편 배치 — 2패스에 중앙 **30.2** · 겨냥 도달 0/10 · 1패스에서 하한 미만 **7/10**
 *
 * 편수를 늘리면 편당 주의가 흩어져 **치환이 얕아진다.** 처리량은 배치 크기가 아니라
 * 패스 수로 오른다 — 5편·2패스가 10편·3패스보다 낫다.
 */
const SIZE = Number(arg('size') ?? 5)
const NEED = arg('need') ? Number(arg('need')) : null
/** 겨냥하는 시중 자리. 목표 "시중 대비 120%" = 50 × 1.2 = **60**. */
const AIM = Number(arg('aim') ?? 60)
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/market-revise/v${BAND}`)

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const { readability, bandOf, gradeBand, PASSAGE_WORDS } =
  await import('../../packages/library-pipeline/src/textbook/readability.ts')
const { classifyCurriculumWords, curriculumOutsideWords, marketPercentile, CURRICULUM_SPEC } =
  await import('../../packages/library-pipeline/src/textbook/curriculum.ts')
const { extractBookLemmas } = await import('@vocaflow/library-pipeline')

const db = createScriptClient()

/** 시중 자리 → 그 학교급에서 필요한 밖% (`marketPercentile` 의 역함수 · 구간 선형). */
function outsideForPercentile(target, school) {
  const d = CURRICULUM_SPEC.outside[school]
  const P = [5, 25, 50, 75, 90, 95]
  const X = P.map((p) => d[`p${String(p).padStart(2, '0')}`])
  if (target <= P[0]) return +((target / P[0]) * X[0]).toFixed(1)
  for (let i = 1; i < P.length; i++) {
    if (target <= P[i]) {
      const t = (target - P[i - 1]) / (P[i] - P[i - 1])
      return +(X[i - 1] + t * (X[i] - X[i - 1])).toFixed(1)
    }
  }
  return X[X.length - 1]
}

// ── 이 밴드의 우리 지문 ──────────────────────────────────────────────
// 페이지 200 — 400 은 statement timeout(8초) 너머다(실측 2026-09-05: 400 → 57014 / 8.7초,
// 200 → 124ms). 본문을 함께 읽으므로 한 요청이 무거워진다.
const rows = await fetchAllPaged(
  db,
  (d) =>
    d
      .from('library_articles')
      .select('id, source_id, title, content, article_v_level')
      .eq('source', 'original')
      .is('feed_id', null)
      .eq('article_v_level', BAND)
      .gte('word_count', PASSAGE_WORDS.min)
      .lte('word_count', PASSAGE_WORDS.max)
      .order('id'),
  200
)

const scored = []
for (const r of rows) {
  const slot = Number(String(r.source_id ?? '').match(/^original:v\d+-(\d+)$/)?.[1])
  if (!Number.isFinite(slot)) continue // 이 드레인이 만든 것이 아니다 — 손대지 않는다
  const c = String(r.content ?? '')
  const m = readability(c)
  const band = m ? gradeBand(bandOf(m.fk)) : null
  if (!band) continue // FK 가 밴드 밖 — 시중 자리를 못 잰다
  const words = classifyCurriculumWords(c)
  if (!words.length) continue
  const outside = words.filter((w) => w.tier === 'outside').length
  const outsidePct = +((outside / words.length) * 100).toFixed(1)
  const pos = marketPercentile(outsidePct, band.school)
  scored.push({ r, slot, m, band, n: words.length, outside, outsidePct, pos, content: c })
}

const behind = scored.filter((s) => s.pos < AIM).sort((a, b) => a.pos - b.pos)
const med = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null)

console.log(
  `V${BAND} 우리 지문 ${scored.length}편 · 시중 자리 중앙 ${med(scored.map((s) => s.pos))} ` +
    `(겨냥 ${AIM})\n  겨냥 도달 ${scored.length - behind.length} · **고칠 몫 ${behind.length}**`
)
if (!behind.length) {
  console.log('\n이 밴드는 겨냥에 닿았다 — 뽑을 것이 없다.')
  process.exit(0)
}

const take = behind.slice(0, NEED ?? behind.length)
// ⚠️ `--need 0` 은 "재기만 하고 뽑지는 않는다" 는 뜻이다 — 실제로 그렇게 쓰다 크래시했다
//   (`tasks[0]` 이 undefined). **0 은 오류가 아니라 유효한 요청이다.**
if (!take.length) {
  console.log('\n뽑지 않았다(--need 0) — 위 숫자만 보고 끝낸다.')
  process.exit(0)
}

// ── V-Level 꼬리 — 어휘를 올리다 밴드가 위로 튀는 것을 막는다 ────────
const per = take.map((s) => {
  const idx = extractBookLemmas([
    {
      chapter_idx: 1,
      content: s.content,
      word_count: s.m.words,
      paragraph_offsets: [0],
      sentence_offsets: [0],
    },
  ])
  return { s, lemmas: [...idx.bookFrequency.keys()] }
})
const lv = new Map()
{
  const { fetchAllIn } = await import('./volume-pool.mjs')
  const all = [...new Set(per.flatMap((d) => d.lemmas))]
  for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', all, [
    'word',
  ])) {
    if (d.v_level != null && Number(d.v_level) !== 11) lv.set(d.word, Number(d.v_level))
  }
}

const tasks = per.map(({ s, lemmas }) => {
  const need = outsideForPercentile(AIM, s.band.school)
  const swap = Math.max(0, Math.ceil(((need - s.outsidePct) / 100) * s.n))
  const tail = lemmas
    .map((w) => [w, lv.get(w)])
    .filter(([, v]) => Number.isFinite(v) && v > BAND)
    .sort((a, b) => b[1] - a[1])
  return {
    slot: s.slot,
    source_id: s.r.source_id,
    v_level: BAND,
    // 규격 — 원래 길이를 크게 벗어나지 않는다. 문단 수가 바뀌면 문항이 더 크게 낡는다.
    words_now: s.m.words,
    words_min: PASSAGE_WORDS.min,
    words_max: PASSAGE_WORDS.max,
    sentences_min: 12,
    market: {
      now: s.pos,
      aim: AIM,
      school: s.band.school,
      fk: s.m.fk,
      band: s.band.id,
      content_words: s.n,
      outside_now: s.outside,
      outside_pct_now: s.outsidePct,
      outside_pct_needed: need,
      /** 안 낱말 몇 개를 밖 낱말로 바꾸면 겨냥에 닿는가. */
      swap_needed: swap,
    },
    /** 지금 **교육과정 3,000 밖**인 낱말. 되풀이 수를 함께 준다. */
    outside_words: curriculumOutsideWords(s.content).map((x) =>
      x.n > 1 ? `${x.word}×${x.n}` : x.word
    ),
    /** 지금 **V${BAND} 위**인 낱말. 여기를 더 늘리면 밴드가 위 계단으로 튄다. */
    v_tail: tail.map(([w, v]) => `${w}(V${v})`),
    /**
     * **지렛대는 둘뿐이다.** 1회차에서 5편에 네 패스가 걸렸고, 그때 실제로 값을 움직인
     * 것만 남겼다(2026-09-06 실측).
     */
    how: [
      '① **이름을 붙인다.** 우리 글은 고유명사가 사실상 0개다 — 이름을 빼도 자리가 ' +
        '그대로다(차이 0.0). 시중 지문은 이름을 붙인다. "a fox" 를 "an arctic fox" 로, ' +
        '"a tree" 를 "an oak" 로, "one stage of sleep" 을 "REM sleep" 으로 바꾼다. ' +
        '**막연한 지시 대상이 곧 낮은 자리다.**',
      '② **소재 낱말을 되풀이한다.** 밖% 는 종수가 아니라 **토큰 비율**이라 같은 낱말을 ' +
        '여러 번 쓰면 오르고, 되풀이는 서로 다른 낱말을 늘리지 않으므로 V-Level p75 를 ' +
        '밀어 올리지 않는다. 실측: dormancy×5 · acorn×4 · burrow×5 · REM paralysis×3.',
      '⚠️ **하지 말 것 1** — "어려운 낱말을 더 넣기". 종수가 늘어 밴드가 위로 튄다' +
        '(실측: 한 편이 V3→V5).',
      '⚠️ **하지 말 것 2** — 문장을 짧게 자르기. FK 는 내려가지만 밖 낱말 밀도가 ' +
        '함께 떨어져 자리가 오히려 내려간다(실측: 한 편이 40.4 → 25.7).',
      '⚠️ **하지 말 것 3** — 이미 밖인 낱말을 쉬운 말로 바꾸기. 고치다 잃기 쉽다 ' +
        '(실측: jackrabbit → desert hare 로 바꾸며 자리를 잃었다).',
      '③ **짐작으로 다시 쓰지 말고 --annotate 로 보고 고른다.** 이게 가장 크게 듣는다. ' +
        'passage-ruler-check.mjs --annotate 는 본문에 [밖]/·안· 을 찍고 **바꿀 후보**' +
        '(교육과정 안 내용어)를 빈도순으로 준다. 거기서 골라 치환한다 — ' +
        '실측: door×10 을 doorway 로, fault 를 flaw 로 바꾸자 **16.2 → 58.7**(한 패스). ' +
        '세 사이클을 짐작으로 고쳐 쓰며 못 넘던 벽이 이 한 가지로 넘어갔다.',
      '⚠️ **하지 말 것 4** — 치환어가 밖인지 **확인하지 않고 되풀이하기**. ' +
        '2회차에서 desert×6 · textbooks×6 을 되풀이했는데 **둘 다 교육과정 안**이라 ' +
        '값이 거의 안 움직였다(21.0 → 23.2). 되풀이는 [밖]으로 확인된 낱말에만 쓴다 — ' +
        '치환 **뒤에도** --annotate 를 한 번 더 보라. 확실한 밖은 **고유명사**다' +
        '(desert → Mojave 로 바꾸자 23.2 → 39.6).',
      '⑦ **겨냥보다 높게 쏜다 — 밖% 32~34%.** 겨냥 60 에 필요한 밖%는 초등 29.5 · 중등 31.3 인데, ' +
        '딱 그만큼을 노리면 배치 중앙이 55 언저리에서 멈춘다(실측 14~20회차). ' +
        '**밴드 중앙은 배치가 그보다 나은 만큼만 오르므로**, 배치 중앙이 55 면 재고 중앙도 55 에서 멎는다. ' +
        '21회차에 목표를 32~34% 로 올려 잡자 **1패스 2/5 도달 · 3패스 5/5 도달**(중앙 64.7) — ' +
        '처음으로 전편이 겨냥을 넘었다.',
      '⑥ **더하지 말고 바꿔라 — 이게 가장 큰 차이다.** 밖% 는 분자/분모이므로 ' +
        '구절을 **더하면** 밖 낱말과 함께 **안 낱말도 늘어** 비율이 거의 안 오른다. ' +
        '실측(2026-09-06 · 같은 5편): 구절을 더한 패스는 중앙 31.1 → 35.0 에 그쳤고 ' +
        '(내용어가 95 → 106 으로 함께 늘었다), **1:1 순수 치환** 패스는 같은 노력으로 ' +
        '**35.0 → 58.7** 로 뛰었다(분모 그대로). lamp→beacon · town→borough · ' +
        'clock→dial · chest→torso · goods→freight 처럼 **낱말 하나를 낱말 하나로** 바꾼다.',
      '⑤ **짧게 쓰면 문턱이 낮아진다.** 시중 지문의 밖% 는 길이에 따라 다르다' +
        '(실측 2026-09-06 · 초·중 179편): 0~79어 **28.0%** · 80~119어 32.7% · ' +
        '120~159어 32.0% · **160어 이상 36.0%**. 우리 글은 175~200어라 ' +
        '**가장 높은 문턱**을 마주하고 있었다. 어수창은 100~200 이므로 ' +
        '120~150어로 줄여 쓰면 같은 자리가 더 적은 밖 낱말로 난다.',
      '④ **긴 라틴계 낱말 대신 짧은 이름·구체명사.** 밖% 를 geometry·alignment·diameter 로 ' +
        '올리면 60 에 닿아도 **FK 가 9.28 로 튀어 밴드가 중3 이 된다**(실측). ' +
        'York·Leeds·Kate 같은 짧은 이름과 rim·sewer·tin 같은 짧은 구체명사는 ' +
        '밖% 만 올리고 FK 는 안 민다 — 시중 초3~4 지문이 실제로 그렇게 쓴다' +
        '("In New York … George Crum" · 밖 38.6%).',
    ],
    title: String(s.r.title ?? ''),
    /** **원문이다.** 여기를 고쳐 쓴다 — 처음부터 새로 쓰지 않는다. */
    content: s.content,
  }
})

fs.mkdirSync(DIR, { recursive: true })
for (const f of fs.readdirSync(DIR))
  if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))
const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}

console.log(
  `\n  뽑은 것 ${tasks.length}편 → 청크 ${chunks.length}개 (${SIZE}편씩)\n` +
    `  시중 자리 ${tasks[0].market.now} ~ ${tasks[tasks.length - 1].market.now} (낮은 것부터)\n\n` +
    `  ${path.relative(process.cwd(), DIR)}/chunk-NN.json\n` +
    `  각 슬롯의 content 를 고쳐 같은 이름 + .out.json 으로 저장한 뒤:\n` +
    `    pnpm dlx tsx scripts/textbook/passage-ruler-check.mjs --dir ${path.relative(process.cwd(), DIR).replace(/\\/g, '/')} --band ${BAND} --aim ${AIM}\n` +
    `    pnpm dlx tsx scripts/textbook/write-drain-import.mjs --band ${BAND} --dir ${path.relative(process.cwd(), DIR).replace(/\\/g, '/')} --update-existing --commit`
)
