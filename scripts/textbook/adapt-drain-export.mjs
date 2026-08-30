// scripts/textbook/adapt-drain-export.mjs
//
// **레벨 적응 드레인 ①/③ — 쉬운 판으로 다시 쓸 몫을 뽑는다.**
//
// ── 왜 필요한가 (2026-08-30 실측) ───────────────────────────────────
// 사다리 일곱 단 중 **아래 세 단이 비어 있다.** 겹치지 않는 20단원 책을 몇 권 만들 수
// 있는지 세면 이렇다:
//
//   1단 초등 저학년  원글 1편    → **0권**
//   2단 초등 고학년  원글 145편  → **1권**
//   3단 중1-2       원글 171편  → **2권**
//   5단 고1         원글 988편  → 18권
//   6단 고2         원글 994편  → 23권
//
// 수집 피드(arXiv · NASA · NIH · VOA · PLOS · Futurity)가 성인 대상 글이라 아래 단이
// 애초에 안 들어온다. **분류를 아무리 돌려도 없는 글이 생기지는 않는다** — 실제로 다른
// 세션이 미분류 1,808편을 310편까지 분류했지만 1단은 여전히 1편이었다.
//
// ── 왜 각색인가 ─────────────────────────────────────────────────────
// 재고의 원본이 **전부 각색 허용 라이선스**다 (cc_by 4,455 · public_domain 1,453 · cc0 457).
// `compose/adaptation.ts` 가 이미 그에 맞는 게이트를 갖고 있다 — 라이선스가 사용을 허락했으므로
// 출처 독립성·표현 독립성 같은 재저작 검사는 성립하지 않고, **서가 중복(I17)만 critical** 이다.
//
// 게이트는 지어져 있는데 **그것을 쓰는 파이프라인이 없었다** — 6,627편 중 각색본은 3편뿐이다.
// 이 스크립트가 그 빈자리다.
//
// ── 무엇이 Claude Code 몫인가 ───────────────────────────────────────
// 같은 내용을 목표 학령의 문장으로 다시 쓰는 일이다. 규칙으로 안 된다 — 무엇을 버리고
// 무엇을 남길지가 판단이기 때문이다(CLAUDE.md §🤖).
//
// 재실행 안전: 읽기만 한다. **이미 각색본이 있는 원본은 건너뛴다.**
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --band elementary --size 6
//   ... --band middle --size 6 --dir <경로>

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = arg('band') ?? 'elementary'
const SIZE = Number(arg('size') ?? 6)
const LIMIT = Number(arg('limit') ?? 60)
// 목표 단수가 지정되면 폴더도 갈라 둔다 — 1단 몫과 2단 몫이 한 폴더에 섞이면
// import 가 어느 단으로 넣을지 청크마다 달라진다.
const DIR = path.resolve(
  arg('dir') ?? `scripts/textbook/adapt-drain/${BAND}${arg('v-level') ? `-v${arg('v-level')}` : ''}`,
)

const { createClient } = await import('@supabase/supabase-js')
const { GRADE_BANDS } = await import('@vocaflow/library-pipeline')

const spec = GRADE_BANDS[BAND]
if (!spec) {
  console.error(`모르는 밴드: ${BAND}. 가능한 것: ${Object.keys(GRADE_BANDS).join(' · ')}`)
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * 각색해도 되는 라이선스만 고른다.
 *
 * `cc_by_sa` 는 뺀다 — 파생물도 같은 조건으로 공유해야 하는데 우리 서가의 이용 약관이
 * 그것을 감당하는지 확인되지 않았다. **모르는 채로 쓰는 것보다 빼는 편이 싸다.**
 */
const ADAPTABLE = ['cc_by', 'cc0', 'public_domain']

/**
 * **우리가 쓴 글(`source='original'`)은 각색 대상이 아니다.**
 *
 * 이미 우리 것이면 쉬운 판을 "각색" 할 이유가 없다 — 그 레벨로 **직접 쓰는** 것이 맞다.
 * DB 도 그렇게 말한다: `chk_original_needs_batch` 가 `source='original'` 행에
 * `compose_batch_id`·`composed_spec` 을 요구한다. 각색본에 원본의 배치 정보를 베껴 넣으면
 * **그 spec 은 원본을 설명하지 각색본을 설명하지 않는다** — 거짓 계보가 된다.
 * (2026-08-30 첫 적재가 이 제약에 걸려서 알았다.)
 */
const NOT_ADAPTABLE_SOURCES = ['original']

/**
 * 밴드가 **소재로** 받지 못하는 글의 성격.
 *
 * 초등 지시문은 "제도·정책·추상명사는 쓰지 않는다 · 사건사고·분쟁·죽음은 쓰지 않는다" 다.
 * 그런데 export 가 라이선스·레벨·길이만 보고 뽑던 동안 **표본 18편 중 7편(39%)이
 * 소재부터 부적합**이었다 — COP28 정책 · 육류 감축 논쟁 · 네덜란드 전쟁사 · 사망 원인 등.
 * 쓸 수 없는 것을 뽑아 놓고 채우라고 하면 그만큼이 그냥 버려진다.
 *
 * `register` 가 이미 그것을 구분해 둔다(실측 각색 가능 재고):
 *   expository 4,389 · **argumentative 1,546** · narrative 14 · reference 7 · news 3
 *
 * 초등에서 `argumentative` 를 뺀다 — 주장하는 글은 제도·쟁점을 다루기 때문이다.
 * (`narrative` 가 14편뿐이라는 것도 함께 드러났다 — 초등이 가장 원하는 결의 글이 거의 없다.)
 *
 * ⚠️ **이 필터로 부적합률이 줄지 않았다.** 걸러 낸 뒤 다시 18편을 뽑아 눈으로 보니
 *   COP28 정책 · 육류 감축 · 네덜란드 전쟁사 · 정치 용어 · 벌 입틀 광학이 그대로 있었다 —
 *   **전부 `expository` 다.** 부적합 39% → 약 44% 로, 측정상 나아지지 않았다.
 *   `register` 는 "주장하는가" 를 가르지 이 밴드가 필요한 **"눈에 보이는가"** 를 가르지 않는다.
 *
 *   그래도 남겨 둔다 — `argumentative` 1,546편은 **정의상** 이 밴드의 소재가 아니고,
 *   빼는 것이 맞다. 다만 **이것으로 문제가 풀렸다고 읽으면 안 된다.**
 *
 *   실제 대책은 뽑는 쪽이 아니라 **채우는 쪽의 판단**이다(소재 적합성은 규칙으로 안 갈린다).
 *   그래서 **필요한 편수의 두 배쯤 뽑아 두고** 부적합한 것은 비워 둔다 —
 *   import 가 "제목 또는 본문이 비었다" 로 세므로 조용히 사라지지 않는다.
 */
const REGISTER_EXCLUDE = {
  elementary: ['argumentative'],
  middle: [],
  high: [],
}

/**
 * 각색본이 설 밴드. 기본은 그 학령대의 **맨 아래 단**이다.
 *
 * ⚠️ **기본값만 쓰면 초등 각색이 전부 1단으로 간다. 그런데 1단은 원글이 필요 없는
 *    유일한 단이다** — 운율·낱말 뜻·철자는 사전(교육과정 별표 808낱말)에서 나온다
 *    (`volume-pool.loadElementaryPool`). 실제로 원글이 모자란 곳은 **2단**이다
 *    (실측 2026-08-30: 원글 145편 → 겹치지 않는 책 **2권**. 3단 위는 5~108권).
 *
 *    그래서 1단에 22편을 써 넣고도 **어느 책에도 한 줄이 안 들어갔다.**
 *    필요한 단을 `--v-level` 로 지정한다.
 */
const TARGET_V = Number(arg('v-level') ?? spec.vRange.min)
if (!(TARGET_V >= spec.vRange.min && TARGET_V <= spec.vRange.max)) {
  console.error(
    `--v-level ${TARGET_V} 는 ${spec.label} 밴드(V${spec.vRange.min}~V${spec.vRange.max}) 밖이다.`,
  )
  process.exit(1)
}

/** 원본은 목표보다 위에 있어야 한다 — 같은 레벨을 '쉬운 판' 이라 부를 수 없다. */
const SOURCE_MIN_LEVEL = spec.vRange.max + 1

async function fetchAll(table, columns, filter) {
  const rows = []
  for (let from = 0; ; from += 500) {
    // 정렬 없이 페이지를 넘기면 행이 중복되고 그만큼 빠진다 — 같은 버그를 이 저장소가
    // 두 번 밟았다(IA 수집 · market-benchmark).
    let q = db.from(table).select(columns).order('id').range(from, from + 499)
    q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < 500) break
  }
  return rows
}

// 이미 각색본이 달린 원본 — 건너뛴다.
const already = new Set(
  (await fetchAll('library_articles', 'id, adapted_from_id', (q) => q.not('adapted_from_id', 'is', null)))
    .map((r) => r.adapted_from_id)
    .filter(Boolean),
)

const excludeRegisters = REGISTER_EXCLUDE[BAND] ?? []
const sources = await fetchAll(
  'library_articles',
  'id, title, content, source, feed_label, license, license_class, article_v_level, word_count, source_url, register',
  (q) => {
    let x = q
      .in('license_class', ADAPTABLE)
      .not('source', 'in', `(${NOT_ADAPTABLE_SOURCES.join(',')})`)
      .gte('article_v_level', SOURCE_MIN_LEVEL)
      .eq('display_only', false)
    // `register` 가 비어 있는 글은 막지 않는다 — 판정된 적이 없는 것과 부적합한 것은 다르다.
    if (excludeRegisters.length) x = x.or(`register.is.null,register.not.in.(${excludeRegisters.join(',')})`)
    return x
  },
)

const usable = sources.filter(
  (r) => !already.has(r.id) && typeof r.content === 'string' && r.content.trim().split(/\s+/).length >= 120,
)

// 한 피드에 쏠리면 서가가 한 색이 된다 — 피드를 돌아가며 뽑는다.
const byFeed = new Map()
for (const r of usable) {
  const k = r.feed_label ?? r.source ?? '기타'
  if (!byFeed.has(k)) byFeed.set(k, [])
  byFeed.get(k).push(r)
}
const feeds = [...byFeed.keys()].sort()

/**
 * 피드마다 **몇 번째부터** 뽑을지. 기본 0.
 *
 * ⚠️ **없으면 같은 후보가 영원히 다시 올라온다.** 이 뽑기는 결정론이라 피드별 앞머리를
 *   늘 같은 순서로 준다. 제외되는 것은 "이미 각색된 원본" 뿐인데, 소재가 안 맞아 **비워 둔**
 *   것은 각색된 적이 없으므로 제외되지 않는다.
 *
 *   실측 2026-08-30: 초등 소재 적합률이 39% → 44% → 74% 부적합으로 계속 나빠졌는데,
 *   그중 상당 부분이 **같은 부적합 후보를 반복해서 본** 탓이었다(COP28 · 네덜란드 ·
 *   벌 입틀이 세 번 연속 나왔다). 다음 몫을 보려면 `--offset` 을 올린다.
 */
const OFFSET = Number(arg('offset') ?? 0)
const picked = []
for (let i = OFFSET; picked.length < LIMIT; i++) {
  let tookAny = false
  for (const f of feeds) {
    const list = byFeed.get(f)
    if (i < list.length) { picked.push(list[i]); tookAny = true }
    if (picked.length >= LIMIT) break
  }
  if (!tookAny) break
}

fs.mkdirSync(DIR, { recursive: true })
const chunks = []
for (let i = 0; i < picked.length; i += SIZE) chunks.push(picked.slice(i, i + SIZE))

for (const [n, chunk] of chunks.entries()) {
  const rows = chunk.map((r) => ({
    adapted_from_id: r.id,
    target_band: spec.key,
    target_label: spec.label,
    target_v_level: TARGET_V,
    target_cefr: spec.cefrj,
    words: spec.words,
    avg_sentence_words: spec.avgSentenceWords,
    directives: spec.directives,
    note: spec.note,
    source_title: r.title,
    // ⚠️ 각색본은 원본의 `source` 를 **그대로 이어받는다.** `library_articles_source_check` 가
    //    실제 피드만 허용하기도 하고, 각색해도 저작권 귀속은 원 발행처이기 때문이다.
    //    각색이라는 사실은 `adapted_from_id` 와 `feed_id='adapted'` 가 표시한다.
    source_feed: r.source,
    source_license: r.license_class,
    source_v_level: r.article_v_level,
    source_url: r.source_url,
    source_text: r.content,
    // ↓ Claude Code 가 채운다
    title: '',
    text: '',
  }))
  fs.writeFileSync(path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`), `${JSON.stringify(rows, null, 2)}\n`)
}

console.log(
  `\n레벨 적응 — ${spec.label} **V${TARGET_V}** ` +
    `(밴드 V${spec.vRange.min}~${spec.vRange.max} · ${spec.cefrj.join('/')})`,
)
console.log(`  규격  ${spec.words.min}~${spec.words.max}어 · 평균 문장 ${spec.avgSentenceWords}어`)
console.log(`  각색 가능 라이선스 원본  ${sources.length}편 (V${SOURCE_MIN_LEVEL} 이상 · ${ADAPTABLE.join('/')})`)
if (excludeRegisters.length) {
  console.log(`  소재로 안 맞는 성격 제외  ${excludeRegisters.join('/')} — 이 밴드의 지시문이 제도·쟁점을 금한다`)
}
console.log(`  그중 본문이 충분한 것  ${usable.length}편 · 이미 각색된 원본 ${already.size}편은 뺐다`)
console.log(`  피드 ${feeds.length}종에서 돌아가며 뽑음 → **${picked.length}편** · 청크 ${chunks.length}개 (${SIZE}편씩)\n`)
console.log(`  ${DIR}/chunk-NN.json`)
console.log('  각 항목의 title·text 를 목표 학령으로 다시 써서 chunk-NN.out.json 으로 저장하면')
console.log('  adapt-drain-import.mjs 가 게이트를 돌려 서가에 넣는다.\n')
