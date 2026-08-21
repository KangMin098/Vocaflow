// scripts/textbook/write-drain-export.mjs
//
// **집필 드레인 ①/③ — Claude Code 가 쓸 지문 몫을 청크로 뽑는다.**
//
// ── 왜 집필인가 ──────────────────────────────────────────────────────
// 사다리 아래쪽이 비어 있는 이유는 **문항이 모자라서가 아니라 원글이 모자라서**다.
// 한 단원 안에서는 원글이 겹칠 수 없으므로(같은 글을 두 번 읽히면 단원이 아니다),
// 조합기는 문항 수보다 **원글 수**에서 먼저 바닥난다. 2026-08-21 실측:
//
//   V2  원글 5편  → 0단원        V3  원글 8편  → 0단원
//   V4  원글 27편 → 8단원        V5·V6 은 20단원(한 권)
//
// 문항을 더 만들어도 소용없다 — 같은 원글에서 나온 문항은 한 단원에 하나만 들어간다.
// **글을 새로 써야 한다.** 그게 Claude Code 의 몫이다(CLAUDE.md §🤖).
//
// ── 길이는 밴드를 못 정한다 ──────────────────────────────────────────
// 처음에는 어수 규격만 주면 될 줄 알았다. **아니었다.** 기존 집필분 6편의 목표 밴드와
// 실제 배정을 대조하니 맞은 것이 2편뿐이었다(2026-08-21 실측):
//
//   170어 목표 V3 → 실제 V2      149어 목표 V8 → 실제 V4      108어 목표 V2 → 실제 V2 ✅
//   183어 목표 V4 → 실제 V4 ✅   179어 목표 V6 → 실제 V4      188어 목표 V6 → 실제 V3
//
// 밴드를 정하는 것은 `compute_article_vrl` 이고, 그 방법은 `p75_type_v11_excluded_article` —
// **글에 쓰인 서로 다른 낱말의 V-Level 75분위**다. 길이는 거기 안 들어간다.
// 그래서 지침은 어휘로 준다: 그 밴드 사전 낱말을 실제로 뽑아 청크에 실어 보낸다.
//
// 어수는 밴드가 아니라 **문항이 나오는지**를 좌우한다 — 조합기가 쓰는 창이 90~200어이므로
// 그 안에 들어야 한다. 그건 규격이지 측정이 아니고, 아래 상수에 근거를 적어 둔다.
//
// ── 저작권 ───────────────────────────────────────────────────────────
// 창작이므로 `source='original'` · `license='CC0-1.0 (Vocaflow Original)'` 이다.
// **시중 교재를 입력으로 쓰지 않는다** — 소재만 정하고 문장은 새로 쓴다.
//
// 재실행 안전: 읽기만 한다. 청크 파일은 덮어쓴다. 이미 있는 제목은 슬롯에서 뺀다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band 3 --need 40 --size 5

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 3)
const SIZE = Number(arg('size') ?? 5)
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

/**
 * 한 권(20단원)에 필요한 원글 수.
 *
 * ⚠️ **처음에 60 으로 잡았다가 틀렸다.** 근거로 삼은 것이 "V6 는 원글 58편으로 20단원" 이었는데,
 *   V6 의 원글은 평균 3,000어짜리 외부 기사라 문단이 많아 **편당 문항이 9개**다(517/58).
 *   반면 우리가 쓰는 교재 지문은 130~190어라 문단이 둘뿐이고 **편당 문항이 4개**를 넘지 못한다
 *   (순서 2 + 삽입 2). 원글 하나가 한 단원에 문항 하나만 낼 수 있으므로, 짧은 지문으로 책을
 *   채우려면 **원글 수 자체가 훨씬 많아야 한다.**
 *
 *   실측(2026-08-21): V3 는 문항 붙은 원글 40편으로 **8단원**에서 멈췄다 — 단원당 약 5편이다.
 *   20단원이면 **80편 이상**이 필요하다. 그래서 85 로 올린다.
 *
 * 이 수를 낮게 잡으면 export 가 "다 썼다" 고 말하는데 책은 안 나온다 — 가장 나쁜 종류의 거짓말이다.
 */
const VOLUME_ARTICLES = 85

/**
 * 소재 축.
 *
 * 시중 독해 교재가 한 권 안에서 소재를 흩는 이유는 **한 분야를 아는 학습자만 유리해지는 것을
 * 막기 위해서**다. 축을 고정해 두고 슬롯을 돌려 배분한다 — 그래야 쏠림이 우연에 안 맡겨진다.
 * (수능 지문의 실제 분포를 모사한 것이 아니라, 분야가 겹치지 않게 나눈 것이다.
 *  "수능과 같은 비율" 이라고 주장하려면 기출을 세어야 하는데 그건 아직 안 했다.)
 */
const TOPIC_AXES = [
  { key: 'life_science', label: '생명·자연', hint: '동식물의 행동·적응, 생태계의 관계, 몸의 작동' },
  { key: 'earth_space', label: '지구·우주', hint: '날씨·지형·바다·행성, 관측으로 알아낸 것' },
  { key: 'technology', label: '기술·공학', hint: '도구와 재료가 문제를 푸는 방식, 설계의 절충' },
  { key: 'society', label: '사회·경제', hint: '사람들이 모여 정하는 규칙, 자원의 배분, 도시' },
  { key: 'history', label: '역사·문화', hint: '옛 사람들의 생활과 그것이 남긴 흔적, 관습의 유래' },
  { key: 'arts', label: '예술·매체', hint: '음악·미술·건축·이야기의 형식과 그 형식이 하는 일' },
  { key: 'mind', label: '심리·학습', hint: '주의·기억·습관·판단이 작동하는 방식' },
  { key: 'health_sport', label: '건강·운동', hint: '몸을 쓰는 일과 회복, 음식과 수면' },
]

/**
 * 글의 짜임.
 *
 * `order`(순서)와 `insert`(삽입) 문항은 **문장 사이의 결속**으로 답이 정해진다. 짜임을
 * 지정하지 않고 쓰면 결속이 약한 나열문이 나오고, 그러면 문항을 만들 수 없거나 답이 둘이 된다.
 */
const SHAPES = [
  {
    key: 'phenomenon_cause',
    label: '현상 → 원인 → 의의',
    hint: '눈에 보이는 일을 먼저 말하고, 왜 그런지 밝히고, 그래서 무엇이 달라지는지로 맺는다.',
  },
  {
    key: 'problem_attempt_result',
    label: '문제 → 시도 → 결과',
    hint: '무엇이 곤란했는지, 어떻게 해 봤는지, 무엇이 남았는지. 시도가 둘이면 순서가 분명해진다.',
  },
  {
    key: 'general_example',
    label: '총론 → 사례 → 되짚기',
    hint: '일반적인 말을 먼저 놓고 구체적인 사례로 받은 뒤, 그 사례가 무엇을 보여 주는지로 닫는다.',
  },
  {
    key: 'before_after',
    label: '이전 → 변화 → 이후',
    hint: '시간 순서가 곧 글의 순서다. 연도나 단계 표시를 문장 안에 넣어 순서를 붙들어 둔다.',
  },
  {
    key: 'claim_counter',
    label: '통념 → 반전 → 수정된 결론',
    hint: '흔히 그렇게 안다고 말한 뒤 However 로 뒤집고, 그래서 어떻게 봐야 하는지로 맺는다.',
  },
]

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재고 실측 ───────────────────────────────────────────────────────
const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, article_v_level, display_only, status, word_count, source')
  .in('status', ['ready', 'published'])
if (error) throw new Error('기사 조회 실패: ' + error.message)
const usable = (arts ?? []).filter((a) => !a.display_only)
const inBand = usable.filter((a) => a.article_v_level === BAND)

/**
 * 어수 규격.
 *
 * **측정값이 아니라 규격이다.** 근거는 둘이다:
 *   · 조합기가 지문으로 쓰는 창이 90~200어(`selectPassageWindow`)라 그 밖이면 문항이 안 나온다.
 *   · 기존 집필분 중 목표 밴드에 실제로 떨어진 두 편이 108어·183어였다.
 * 밴드와는 무관하다 — 밴드는 아래 어휘층이 정한다.
 */
const WORDS_MIN = 130
const WORDS_MAX = 190

/**
 * 어휘 조건 — **꼬리 낱말 수가 곧 계단이다.**
 *
 * 목표 밴드에 떨어뜨리는 법을 세 점으로 실측했다(`article_v_level` 대 목표, 2026-08-21):
 *
 *   | 꼬리(V+1~V+2 낱말) | 편수 | 적중률 | 아래로 | 위로 | 평균 어긋남 |
 *   |---|---|---|---|---|---|
 *   | 0개  (V3 목표) | 10 | 20%   | 6 | 2  | **−0.40** |
 *   | 4~5개 (V2 목표) | 12 | **75%** | 0 | 3  | **+0.33** |
 *   | 7~9개 (V3 목표) | 52 | 13.5% | 1 | 44 | **+1.00** |
 *
 * 평균 어긋남이 꼬리 수에 **단조롭게** 따라간다(−0.40 → +0.33 → +1.00). 낱말 하나당
 * 약 0.17계단이다. 그래서 기본을 4 로 둔다 — 적중 75% 가 실측된 유일한 값이다.
 *
 * ⚠️ **한계**: 가운데 점만 목표가 V2 이고 나머지 둘은 V3 이다. 꼬리 수만 다른 것이 아니므로
 *   기울기는 믿되 최적값 4 는 아직 한 밴드에서만 확인됐다. V3 대량 집필이
 *   같은 조건의 재확인을 겸한다 — 거기서 어긋나면 이 기본값을 다시 잰다.
 */
const TAIL_MIN = Number(arg('tail') ?? 4)
const TAIL_MAX = TAIL_MIN + 1
const AT_MIN = Number(arg('at') ?? 12)
const AT_MAX = AT_MIN + 2

// ── 그 밴드의 어휘층 — 여기가 밴드를 정한다 ─────────────────────────
// `compute_article_vrl` 은 글에 쓰인 **서로 다른 낱말의 V-Level 75분위**로 밴드를 매긴다.
// 그러니 "V3 글을 써라" 는 지시는 "쓰는 낱말의 75%가 V3 이하가 되게 써라" 와 같다.
// 짐작하지 않도록 사전에서 실제 낱말을 뽑아 청크에 실어 보낸다.
//
// ⚠️ **"75% 가 V<밴드> 이하" 는 지침이 못 된다.** 파일럿 10편에서 적중 2편(20%)이었고,
//   떨어진 8편은 전부 **아래로** 떨어졌다(V2 6 · V4 2). 안전하게 쉬운 낱말만 써서
//   p75 가 2 로 주저앉은 것이다.
//
//   재고 실측을 보면 V3 글의 프로필은 이렇다 — p50 **1.5** · p75 **3** · p90 **5.2**.
//   즉 **절반은 아주 쉬운 낱말이고, 상위 10% 는 V5 까지 올라간다.** 그 꼬리가 있어야
//   p75 가 3 이 된다. "이하로 유지" 만 시키면 꼬리가 안 생긴다.
//
//   그래서 아래에서 **셀 수 있는 목표**로 바꾼다 — 몇 낱말을 어느 층에서 쓸지.
const lexicon = { at: [], below: [], avoid: [] }
/** 그 밴드 재고의 실제 프로필. 짐작하지 않는다. */
let profile = null
{
  const { data, error } = await db
    .from('library_articles')
    .select('vrl_components')
    .eq('article_v_level', BAND)
    .in('status', ['ready', 'published'])
    .eq('display_only', false)
    .not('vrl_components', 'is', null)
    .limit(200)
  if (error) throw new Error('프로필 조회 실패: ' + error.message)
  const rows = (data ?? []).filter((r) => r.vrl_components?.p75 != null)
  if (rows.length) {
    const avg = (k) => rows.reduce((s, r) => s + Number(r.vrl_components[k] ?? 0), 0) / rows.length
    profile = {
      samples: rows.length,
      p50: Math.round(avg('p50') * 10) / 10,
      p75: Math.round(avg('p75') * 10) / 10,
      p90: Math.round(avg('p90') * 10) / 10,
    }
  }
}
{
  /**
   * 그 층의 낱말을 **알파벳 전 구간에서 고르게** 뽑는다.
   *
   * ⚠️ 앞에서부터 120개를 받으면 전부 `a…` 로 시작한다 — 실제로 그렇게 나왔다.
   *   그런 목록은 어휘층을 보여 주지 못하고, 그걸 지침이라고 주면 집필이 한쪽으로 쏠린다.
   *   그래서 총수를 먼저 세고 창을 여러 개로 나눠 흩어 뽑는다.
   */
  const pick = async (min, max, limit) => {
    // ⚠️ 카운트 질의는 **따로 만든다.** 이미 `.select('word')` 가 붙은 빌더에 다시
    //   `.select(…, {count})` 를 겹치면 질의가 망가져 count 가 null 로 오고, 그러면
    //   낱말 목록이 조용히 빈 채로 나간다.
    const base = () =>
      db.from('shared_dictionary').select('word').gte('v_level', min).lte('v_level', max).not('meaning_ko', 'is', null)
    const { count, error: ce } = await db
      .from('shared_dictionary')
      .select('word', { count: 'exact', head: true })
      .gte('v_level', min)
      .lte('v_level', max)
      .not('meaning_ko', 'is', null)
    if (ce) throw new Error('사전 조회 실패: ' + ce.message)
    if (!count) return []
    const WINDOWS = 12
    const per = Math.max(1, Math.ceil(limit / WINDOWS))
    const out = []
    for (let w = 0; w < WINDOWS && out.length < limit; w++) {
      const from = Math.min(count - 1, Math.floor((count * w) / WINDOWS))
      const { data, error } = await base().order('word').range(from, from + per - 1)
      if (error) throw new Error('사전 조회 실패: ' + error.message)
      for (const r of data ?? []) if (out.length < limit) out.push(r.word)
    }
    return out
  }
  lexicon.at = await pick(BAND, BAND, 120)
  lexicon.below = await pick(Math.max(0, BAND - 2), Math.max(0, BAND - 1), 120)
  lexicon.avoid = await pick(BAND + 1, BAND + 3, 80)
}

// 문항이 실제로 나오는지 — 원글마다 order/insert 가 몇 개 붙었나.
const items = await fetchAllIn(
  db,
  'csat_dcp_items',
  'id, ref_id, type, kind',
  'ref_id',
  inBand.map((a) => a.id),
  ['id'],
)
const withItems = new Set(
  items.filter((r) => r.kind === 'article' && (r.type === 'order' || r.type === 'insert')).map((r) => r.ref_id),
)

const need = arg('need') ? Number(arg('need')) : Math.max(0, VOLUME_ARTICLES - withItems.size)

// 이미 있는 제목 — 소재가 겹치면 한 권 안에서 같은 이야기를 두 번 읽힌다.
const takenTitles = new Set(usable.map((a) => String(a.title).toLowerCase().trim()))

// ── 슬롯 번호는 **이어 붙인다** ─────────────────────────────────────
//
// ⚠️ 슬롯 번호가 실행마다 1 부터 다시 시작하면 `import` 의 유일키(`original:v<밴드>-<슬롯>`)가
//   지난 실행과 겹친다. 그러면 새로 쓴 글이 "이미 있음" 으로 **조용히 버려진다** —
//   집필은 다 해 놓고 적재만 0 이 되는데, 로그는 정상으로 보인다.
//   그래서 이미 쓰인 번호 다음부터 매긴다.
let slotBase = 0
{
  const { data, error } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'original')
    .like('source_id', `original:v${BAND}-%`)
  if (error) throw new Error('슬롯 조회 실패: ' + error.message)
  for (const r of data ?? []) {
    const n = Number(String(r.source_id).split('-').pop())
    if (Number.isFinite(n) && n > slotBase) slotBase = n
  }
}

// 소재 축과 짜임을 **서로 다른 주기로** 돌린다(8 과 5 는 서로소라 40 슬롯까지 조합이 겹치지 않는다).
const tasks = []
for (let i = 0; i < need; i++) {
  const axis = TOPIC_AXES[i % TOPIC_AXES.length]
  const shape = SHAPES[i % SHAPES.length]
  tasks.push({
    slot: slotBase + i + 1,
    v_level: BAND,
    topic_axis: axis.label,
    topic_hint: axis.hint,
    shape: shape.label,
    shape_hint: shape.hint,
    words_min: WORDS_MIN,
    words_max: WORDS_MAX,
    // 이번 실행의 어휘 조건. **import 가 이 값을 글에 기록해야** 나중에 조건별 적중률을
    // 비교할 수 있다 — 안 남기면 "어떤 지침으로 쓴 글인지" 를 영영 알 수 없다.
    tail_min: TAIL_MIN,
    tail_max: TAIL_MAX,
    at_band_min: AT_MIN,
    at_band_max: AT_MAX,
    title: '',
    content: '',
  })
}

fs.mkdirSync(DIR, { recursive: true })
for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}
// 제목 중복을 막으려면 집필하는 쪽이 기존 제목을 알아야 한다.
fs.writeFileSync(
  path.join(DIR, 'taken-titles.json'),
  JSON.stringify([...takenTitles].sort(), null, 1),
  'utf8',
)
// **밴드를 정하는 것은 이 파일이다** — 어수가 아니라 어휘층.
fs.writeFileSync(
  path.join(DIR, 'lexicon.json'),
  JSON.stringify(
    {
      band: BAND,
      method: 'compute_article_vrl = 사전에 잡힌 서로 다른 낱말들의 V-Level 75분위',
      // 지침을 "이하로 유지" 로 주면 꼬리가 안 생겨 p75 가 주저앉는다 — 파일럿 실측.
      profile_of_real_articles: profile,
      counts: {
        note:
          `130~190어 지문의 서로 다른 낱말은 대략 100개, 그중 사전에 잡히는 것이 대략 75개다. ` +
          `아래는 그 75개를 어느 층에 몇 개 두어야 75분위가 V${BAND} 이 되는지다.`,
        [`V${BAND}`]: `${AT_MIN}~${AT_MAX}개`,
        [`V${BAND + 1}~V${BAND + 2}`]:
          `${TAIL_MIN}~${TAIL_MAX}개  ← **이 수를 지켜라. 적으면 한 계단 아래로, 많으면 위로 떨어진다**`,
        [`V${BAND - 1} 이하`]: '나머지 전부 (절반 이상)',
      },
      rule:
        `서로 다른 낱말 기준으로 V${BAND} 을 ${AT_MIN}~${AT_MAX}개, ` +
        `V${BAND + 1}~V${BAND + 2} 를 **${TAIL_MIN}~${TAIL_MAX}개** 쓰고 나머지는 쉬운 층으로 채운다. ` +
        `쉽게만 쓰면 아래로 떨어지고, 어려운 낱말을 더 넣으면 위로 떠오른다 — **꼬리 수가 곧 계단이다.**`,
      at_band: lexicon.at,
      above_band_tail: lexicon.avoid,
      below_band: lexicon.below,
    },
    null,
    1,
  ),
  'utf8',
)

console.log(`V${BAND} 재고 — 원글 ${inBand.length}편 · 그중 문항이 붙은 것 ${withItems.size}편`)
console.log(`  한 권 실무 하한 ${VOLUME_ARTICLES}편 → **더 써야 할 몫 ${need}편**  → 청크 ${chunks.length}개 (${SIZE}편씩)`)
console.log(`  슬롯 번호 ${slotBase + 1}~${slotBase + need} (지난 실행과 겹치지 않게 이어 붙였다)`)
console.log(`  어수 규격 ${WORDS_MIN}~${WORDS_MAX}어 (조합기 창 90~200어 안 — 밴드와 무관)`)
console.log(`  어휘층 — V${BAND} ${lexicon.at.length}낱말 · 그 아래 ${lexicon.below.length} · 꼬리 ${lexicon.avoid.length}`)
if (profile) console.log(`  V${BAND} 재고 프로필(${profile.samples}편) — p50 ${profile.p50} · p75 ${profile.p75} · p90 ${profile.p90}`)
else console.log(`  ⚠️ V${BAND} 재고가 없어 프로필을 못 냈다 — 집필 목표를 실측으로 못 준다.`)
if (!lexicon.at.length) console.log(`  ⚠️ 사전에 V${BAND} 낱말이 없다 — 어휘 지침이 성립하지 않는다.`)
console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
console.log(`  각 슬롯의 title·content 를 채운 뒤 같은 이름 + .out.json 으로 저장하면`)
console.log(`  write-drain-import.mjs 가 library_articles 에 넣는다.`)
