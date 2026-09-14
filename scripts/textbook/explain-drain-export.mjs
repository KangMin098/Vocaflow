// scripts/textbook/explain-drain-export.mjs
//
// **해설 드레인 ①/② — Claude Code 가 쓸 몫을 청크로 뽑는다.**
//
// ── 왜 배치인가 ──────────────────────────────────────────────────────
// 결정론 해설(`explain.ts`)은 **6.9%** 에서 멈춘다. 지문 표면의 단서만으로는 결속을 다
// 못 읽고, 두 번의 개선 실험(희소도 문턱 · 근거 다중화)이 실측으로 실패했다.
// 나머지 93%는 **글을 읽어야** 쓸 수 있다 — 그게 Claude Code 가 할 일이다.
//
// ⚠️ **이미 결정론으로 쓴 해설은 뽑지 않는다.** 그것은 근거가 지문에서 확정된 것이라
//   덮어쓸 이유가 없고, 덮어쓰면 "왜 이 답인지" 의 근거 종류가 섞인다.
//
// ── 저장 자리 ────────────────────────────────────────────────────────
// `csat_dcp_items.answer_key` 는 jsonb 다. 해설은 `answer_key.explanation_ko` 에 넣는다 —
// **마이그레이션이 필요 없다.** 채점 RPC(`grade_dcp_item`)는 `position`·`source_order` 만
// 읽으므로 키가 하나 늘어도 영향이 없다.
//
// 재실행 안전: 읽기만 한다. 청크 파일은 덮어쓴다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/explain-drain-export.mjs --band 5 --size 10
//   → scripts/textbook/explain-drain/chunk-00.json …

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const SIZE = Number(arg('size') ?? 10)
/**
 * 한 권에 실릴 문항만 뽑는다.
 *
 * **재고 전체(337)를 쓰는 것보다 한 권(80)을 먼저 완성하는 편이 값이 크다** — 해설까지
 * 완비된 책이 하나 있어야 시중 교재와 정면으로 비교되고, 평가 요소 중 사람이 봐야 하는
 * 셋(오답 매력도·레벨 신뢰·소재 적합성)도 그때 판정된다.
 */
const VOLUME_UNITS = arg('volume') ? Number(arg('volume')) : null
/**
 * 청크를 둘 자리.
 *
 * **밴드를 여럿 동시에 드레인하려면 자리를 갈라야 한다** — 한 디렉터리를 쓰면 나중 export 가
 * 앞 밴드의 청크를 지우고(151행), import 는 그 안의 `.out.json` 을 **전부** 읽어 밴드가 섞인다.
 * 기본값은 밴드별 폴더다.
 */
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/explain-drain/v${BAND}`)

const { createClient } = await import('@supabase/supabase-js')
const { toCsatOrder, toCsatInsert, explainOrder, explainInsert } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 대상 문항 ───────────────────────────────────────────────────────
//
// ⚠️ **한 권을 겨냥할 때 풀을 다시 만들지 않는다.** `render-volume.mjs` 와 같은 `loadVolume`
//   을 부른다. 예전에는 이 자리에서 따로 만들었고 셋이 어긋났다 — 밴드를 문항 `v_level` 로
//   걸렀고(조판은 원글 `article_v_level`), `composeUnits` 에 빈 어휘 맵을 넘겼고(조판은 단원
//   어휘를 넘긴다), `display_only` 원글을 안 걸렀다. 그래서 겨냥한 80 과 실린 80 이 2문항
//   달랐고, 뽑은 몫을 전부 채웠는데도 책은 78/80 으로 나왔다.
//   **작게 어긋나는 드리프트는 티가 안 난다.**
const rows = []
if (VOLUME_UNITS) {
  // 조판(`render-volume.mjs`)과 **같은 기본값**을 써야 한다 — 어긋나면 겨냥한 책과
  // 실린 책이 달라진다(위 드리프트 경고 그대로다). 2026-08-30 부터 둘 다 기본 켬이고
  // `--no-market-mix` 로만 끈다.
  const { pool, itemIds } = await loadVolume(db, {
    band: BAND,
    unitCount: VOLUME_UNITS,
    marketMix: !process.argv.includes('--no-market-mix'),
  })
  rows.push(...pool.filter((p) => itemIds.has(p.id)))
} else {
  // 재고 전체를 볼 때는 문항 자신의 밴드로 거른다.
  //
  // ⚠️ **이 조회도 자라서 못 쓰게 됐다가 고쳤다** (실측 2026-09-01, `explain-discriminate.mjs`
  //   와 같은 계통). 밴드 전량을 `payload` 까지 `.range()` 로 offset 페이징하면
  //   statement timeout 이 난다 — `csat_dcp_items` 가 427,592행이다.
  //   두 가지를 고쳤다:
  //     ① **해설 있는 것을 서버에서 거른다.** 아래 루프가 어차피 `already` 로 버릴 것을
  //        payload 까지 받아 오고 있었다. 실측 band 6: 받을 것이 **46건**인데 수만 건을
  //        끌어오던 셈이다.
  //     ② **keyset 페이징** — offset 은 뒤로 갈수록 앞을 다시 훑는다.
  let cursor = null
  for (;;) {
    let q = db
      .from('csat_dcp_items')
      .select('id, type, ref_id, payload, answer_key, v_level')
      .eq('kind', 'article')
      .eq('v_level', BAND)
      .in('type', ['order', 'insert'])
      // 해설이 없는 것 **또는** 이음매 해설이 깔린 것 — 뒤엣것은 배치가 올려칠 몫이다
      // (위 `upgradeable` 주석 참조). 배치가 쓴 것은 `explanation_writer` 가 없어 안 걸린다.
      .or(
        'answer_key->>explanation_ko.is.null,' +
          'answer_key->>explanation_writer.eq.order_seam,' +
          'answer_key->>explanation_writer.eq.insert_seam',
      )
      .order('id')
      .limit(500)
    if (cursor) q = q.gt('id', cursor)
    const { data, error } = await q
    if (error) throw new Error('문항 조회 실패: ' + error.message)
    if (!data?.length) break
    rows.push(...data)
    cursor = data[data.length - 1].id
    if (data.length < 500) break
  }
}

const CIRCLED = ['①', '②', '③', '④', '⑤']
const tasks = []
let already = 0
let unprintable = 0

for (const r of rows) {
  // 이미 배치가 쓴 것은 건너뛴다 — 재실행 안전.
  //
  // ⚠️ **이음매 해설은 예외다** (실측 2026-09-13). 이 파일 머리말과 `explain-seam.ts`
  //   머리말이 둘 다 「나중에 배치 해설이 오면 그쪽이 이긴다」고 적어 두었는데,
  //   **코드는 해설이 있으면 무조건 건너뛰고 있었다.** 그래서 이음매 해설이 깔린 뒤로는
  //   배치 몫이 영원히 0 이 된다.
  //
  //   이음매 해설은 「왜 그렇게 이어지는가」를 말하지 않는다 — 그 파일이 스스로 그렇게
  //   적었고, 3인 검수 1·2회차가 순서 유형 **전량**에 같은 지적을 했다. 규칙이 지문에서
  //   근거를 읽어 낸 것은 **5.7%** 뿐이다(실측 273/4,795). 나머지는 배치가 써야 한다.
  //
  //   ⚠️ **배치가 쓴 것은 여전히 안 건드린다** — 적재가 `explanation_writer: 'batch'` 를 적는다
  //     (2026-09-14. 그전에는 안 적어서 같은 문항이 영원히 다시 뽑혔다).
  //
  // ── 밑줄 두 유형도 연다 (2026-09-14) ────────────────────────────────
  //
  // ⚠️ **근거는 표본이 아니라 템플릿의 성질이다.** `explainVocabChoice` 와
  //   `explainUnderlinedGrammar` 의 오답 절은 위치만 낸다 —
  //   「나머지 ① "religious"(1문장) · ② "story"(7문장) … 의 자리는 각각 그 문장에서
  //   확인할 수 있다」. 즉 **오답별 이유가 구조상 0개**이고, 이것은 100% 참이다.
  //   시중 해설 규격은 오답 배제 언급률 **53.6%** 다(`market-spec.json`).
  //
  //   해설을 고친 뒤 내려진 3인 검수 8건이 그 한계를 그대로 지목했다(tutor 5 · setter 1 ·
  //   analyst 1). 그중 하나는 「확인할 수 있다」가 **검증되지 않은 주장**임을 실례로 보였다 —
  //   "① 의 경우 그 1문장 안에 확인할 단서가 없다". 문구를 세 번 바꿨지만
  //   (「어긋나지 않는다」 → 「지문 그대로다」 → 「확인할 수 있다」) 그때마다 같은 지적이 왔다.
  //   **말을 고쳐서 될 일이 아니라 쓰는 주체를 바꿀 일**이다 — 순서·삽입과 같은 결론이다.
  //
  //   ⚠️ order·insert 는 판별력 5.7% 라는 **비율**이 근거였고 여기는 **구조**가 근거다.
  //     되돌리려면 이 두 값을 빼면 된다. 그때 근거로 쓸 수 있는 반증은 하나다 —
  //     결정론 해설이 오답별 이유를 실제로 담게 되는 것.
  const writer = r.answer_key?.explanation_writer ?? null
  const upgradeable =
    writer === 'order_seam' ||
    writer === 'insert_seam' ||
    writer === 'vocab_choice' ||
    writer === 'underlined_grammar'
  if (r.answer_key?.explanation_ko && !upgradeable) {
    already++
    continue
  }
  // ── 밑줄 유형은 변환이 필요 없다 — payload 가 곧 지면이다 ──────────
  //
  // ⚠️ 이 갈래가 없던 동안 `upgradeable` 을 열어도 **아무 일도 안 일어났다**(실측
  //   2026-09-14: 「이미 해설 있음」이 24 → 19 로 줄었는데 「배치가 쓸 몫」은 0 그대로였다).
  //   아래 `toCsatOrder`/`toCsatInsert` 가 밑줄 유형을 못 만들어 전부 `unprintable` 로
  //   떨어졌기 때문이다. **문을 열었으면 길도 놓아야 한다.**
  if (r.type === 'vocab_choice' || r.type === 'grammar_choice' || r.type === 'unit_grammar') {
    const sentences = Array.isArray(r.payload?.sentences) ? r.payload.sentences.map(String) : []
    const underlines = Array.isArray(r.payload?.underlines) ? r.payload.underlines : []
    const pos = Number(r.answer_key?.position ?? r.answer_key?.answer)
    // 자리표·원래 낱말이 없으면 검수자가 정답을 확인할 수 없다 — 지어내게 하지 않는다.
    if (!sentences.length || underlines.length < 2 || !Number.isInteger(pos) || !r.answer_key?.original) {
      unprintable++
      continue
    }
    tasks.push({
      id: r.id,
      type: r.type,
      answer: `${CIRCLED[pos - 1] ?? pos} "${String(underlines[pos - 1]?.word ?? '')}"`,
      original: String(r.answer_key.original),
      sentences,
      underlines: underlines.map((u, i) => ({
        label: String(u?.label ?? CIRCLED[i] ?? i + 1),
        word: String(u?.word ?? ''),
        sentence: Number.isInteger(Number(u?.sentenceIdx)) ? Number(u.sentenceIdx) + 1 : null,
      })),
      explanation_ko: '',
    })
    continue
  }

  const isOrder = r.type === 'order'
  const item = isOrder
    ? toCsatOrder(r.payload?.presented ?? [], r.answer_key?.source_order ?? [])
    : toCsatInsert(r.payload?.remaining ?? [], r.payload?.insert_sentence ?? '', r.answer_key?.position)
  if (!item) {
    unprintable++
    continue
  }
  // 결정론으로 이미 쓴 것은 뽑지 않는다.
  const det = isOrder ? explainOrder(item) : explainInsert(item)
  if (det.body) {
    already++
    continue
  }

  tasks.push(
    isOrder
      ? {
          id: r.id,
          type: 'order',
          answer: `${CIRCLED[item.answer - 1]} ${item.choices[item.answer - 1].map((l) => `(${l})`).join('-')}`,
          intro: item.intro,
          blocks: item.blocks.map((b) => ({ label: b.label, text: b.sentences.join(' ') })),
          explanation_ko: '',
        }
      : {
          id: r.id,
          type: 'insert',
          answer: `${CIRCLED[item.answer - 1]} (${item.slots[item.answer - 1]}번째 문장 뒤)`,
          given: item.sentence,
          body: item.body.map((s, i) => {
            const slot = item.slots.indexOf(i + 1)
            return slot >= 0 ? `${s} ${CIRCLED[slot]}` : s
          }),
          explanation_ko: '',
        },
  )
}

fs.mkdirSync(DIR, { recursive: true })
// 이전 청크를 남겨 두면 다음 드레인이 낡은 것을 다시 읽는다.
// ── 앞 회차를 **한 벌로** 치운다 ────────────────────────────────────
//
// ⚠️ 여기가 `chunk-NN.json` 만 지우고 `chunk-NN.out.json` 을 남겼다. 새 export 는 **같은 번호에
//   다른 문항**을 담으므로, 남은 out 이 이번 적재에 섞여 들어간다. 실측 2026-09-14: 6문항을
//   뽑아 채웠는데 적재기가 「청크 3개 · 해설 25건」을 봤다 — 어제(09-13) 청크 둘이 그대로
//   있었다. 그대로 --commit 했으면 **어제 판의 해설 19건이 오늘 문항 위에 덮였을 것**이다.
//   검수 드레인이 같은 자국을 갖고 있었고 같은 규칙으로 고쳤다(item-review-drain-export).
//
// ⚠️ **지우지 않고 옮긴다.** 이 드레인에는 적재 표식이 없어서 남은 out 이 이미 적재된 것인지
//   아직 안 넣은 몫인지 구별할 수 없다. 지우면 안 넣은 몫이 조용히 사라진다 —
//   `_stale-<날짜>/` 로 옮기고 **수를 찍는다.**
let movedStale = 0
{
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const attic = path.join(DIR, `_stale-${stamp}`)
  for (const f of fs.readdirSync(DIR)) {
    if (/^chunk-\d+\.json$/.test(f)) {
      fs.unlinkSync(path.join(DIR, f))
    } else if (/^chunk-\d+\.out\.json$/.test(f)) {
      fs.mkdirSync(attic, { recursive: true })
      fs.renameSync(path.join(DIR, f), path.join(attic, f))
      movedStale += 1
    }
  }
}

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  const file = path.join(DIR, `chunk-${n}.json`)
  fs.writeFileSync(file, JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(file)
}

console.log(`V${BAND} — 문항 ${rows.length}`)
if (movedStale) {
  console.log(
    `  앞 회차 .out.json 옮김           ${movedStale}개  ← _stale-*/ 로 치웠다. 안 넣은 몫이면 거기서 꺼내 쓴다`,
  )
}
console.log(`  이미 해설 있음(결정론 또는 배치)  ${already}`)
console.log(`  수능 형식 변환 실패              ${unprintable}`)
console.log(`  **배치가 쓸 몫                  ${tasks.length}**  → 청크 ${chunks.length}개 (${SIZE}개씩)`)
console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
console.log(`  각 항목의 explanation_ko 를 채운 뒤 같은 이름 + .out.json 으로 저장하면`)
console.log(`  explain-drain-import.mjs 가 DB 에 넣는다.`)
