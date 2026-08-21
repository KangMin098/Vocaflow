// scripts/textbook/render-volume.mjs
//
// **교재 한 권을 실제로 조판한다 — 펼쳐 볼 수 있는 물건으로.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 생성기·검사기·리포트·콘솔은 다 있는데 **책이 없었다.** `build-volume.mjs` 는 조합 결과를
// 콘솔에 찍을 뿐이라, "우리 교재가 시중 교재만 한가" 를 사람이 눈으로 볼 방법이 없었다.
// 평가 요소 중 셋(오답 매력도 · 레벨 표기 신뢰 · 소재 적합성)은 **사람이 봐야만** 판정되는데,
// 볼 물건이 없으면 그 셋은 영원히 미판정으로 남는다.
//
// 조합 규칙은 `compose-unit.ts` 에 있고 인쇄 형식은 `csat-format.ts` 에 있다.
// 여기서는 **둘을 붙여 HTML 로 낼 뿐** 새 규칙을 만들지 않는다.
//
// 재실행 안전: DB 는 읽기만. 결과는 지정한 파일에 쓴다(덮어쓴다).
//
// 실행:
//   pnpm dlx tsx scripts/textbook/render-volume.mjs --band 5 --units 20 --out volume-v5.html

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const UNITS = Number(arg('units') ?? 20)
const OUT = arg('out') ?? `volume-v${BAND}.html`

const { createClient } = await import('@supabase/supabase-js')
const {
  composeUnits,
  toCsatOrder,
  toCsatInsert,
  scoreVolume,
  explainOrder,
  explainInsert,
  SERIES_SPINE,
} = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재료 ────────────────────────────────────────────────────────────
const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, source, article_v_level, display_only')
  .in('status', ['ready', 'published'])
  .eq('article_v_level', BAND)
  .order('id')
if (error) throw new Error('기사 조회 실패: ' + error.message)
const usable = (arts ?? []).filter((a) => !a.display_only)
const byId = new Map(usable.map((a) => [a.id, a]))
const ids = [...byId.keys()]

const pool = []
for (let i = 0; i < ids.length; i += 20) {
  const { data } = await db
    .from('csat_dcp_items')
    .select('id, type, ref_id, payload, answer_key, v_level')
    .eq('kind', 'article')
    .in('type', ['order', 'insert'])
    .in('ref_id', ids.slice(i, i + 20))
    .order('id')
    .limit(20000)
  for (const r of data ?? []) {
    const a = byId.get(r.ref_id)
    if (!a) continue
    const p = r.payload ?? {}
    const sentences = r.type === 'order' ? (p.presented ?? []) : (p.remaining ?? [])
    const text = [...sentences, p.insert_sentence].filter(Boolean).join(' ')
    pool.push({
      id: r.id,
      type: r.type,
      ref_id: r.ref_id,
      ref_title: a.title,
      v_level: r.v_level,
      passage_text: text,
      passage_words: text.split(/\s+/).filter(Boolean).length,
      body_sentences: sentences.length,
      payload: p,
      answer_key: r.answer_key ?? {},
    })
  }
}

// ── 어휘 ────────────────────────────────────────────────────────────
const vocabRows = []
for (let i = 0; i < ids.length; i += 5) {
  const { data } = await db
    .from('library_article_vocabularies')
    .select('library_article_id, word, first_sentence, frequency_in_article')
    .in('library_article_id', ids.slice(i, i + 5))
    .limit(20000)
  vocabRows.push(...(data ?? []))
}
const words = [...new Set(vocabRows.map((v) => v.word))]
const dict = new Map()
for (let i = 0; i < words.length; i += 500) {
  const { data } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, v_level')
    .in('word', words.slice(i, i + 500))
  for (const r of data ?? []) dict.set(r.word, r)
}
vocabRows.sort(
  (a, b) =>
    a.library_article_id.localeCompare(b.library_article_id) ||
    (b.frequency_in_article ?? 0) - (a.frequency_in_article ?? 0) ||
    a.word.localeCompare(b.word),
)
const vocabByRef = new Map()
for (const v of vocabRows) {
  const d = dict.get(v.word)
  if (!vocabByRef.has(v.library_article_id)) vocabByRef.set(v.library_article_id, [])
  vocabByRef.get(v.library_article_id).push({
    word: v.word,
    meaning_ko: d?.meaning_ko ?? null,
    v_level: d?.v_level ?? null,
    first_sentence: v.first_sentence ?? null,
    frequency_in_article: v.frequency_in_article ?? 0,
  })
}

const { units, stoppedBecause } = composeUnits(pool, vocabByRef, { band: BAND, unitCount: UNITS })
const card = scoreVolume(units, BAND)
const rung = SERIES_SPINE.find((r) => r.vLevels.includes(BAND))

// ── 조판 ────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const CIRCLED = ['①', '②', '③', '④', '⑤']

/** 문항 하나를 수능 인쇄 형식으로. 못 바꾸면 null. */
function renderItem(item, no) {
  if (item.type === 'order') {
    const q = toCsatOrder(item.payload.presented ?? [], item.answer_key.source_order ?? [])
    if (!q) return null
    const ex = explainOrder(q)
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?</p>
  <div class="passage intro">${esc(q.intro)}</div>
  ${q.blocks
    .map((b) => `<div class="passage block"><span class="lbl">(${b.label})</span> ${esc(b.sentences.join(' '))}</div>`)
    .join('')}
  <ol class="choices">${q.choices
    .map((c) => `<li>${c.map((l) => `(${l})`).join(' - ')}</li>`)
    .join('')}</ol>
</div>`,
      answer: q.answer,
      explanation: ex.body,
      source: item.ref_title,
    }
  }
  const q = toCsatInsert(item.payload.remaining ?? [], item.payload.insert_sentence ?? '', item.answer_key.position)
  if (!q) return null
  const ex = explainInsert(q)
  const body = q.body
    .map((s, i) => {
      const slot = q.slots.indexOf(i + 1)
      return `${esc(s)}${slot >= 0 ? ` <span class="slot">${CIRCLED[slot]}</span>` : ''}`
    })
    .join(' ')
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?</p>
  <div class="given">${esc(q.sentence)}</div>
  <div class="passage">${body}</div>
</div>`,
    answer: q.answer,
    explanation: ex.body,
    source: item.ref_title,
  }
}

let qNo = 0
const unitHtml = []
const answerRows = []

for (const u of units) {
  const rendered = u.items.map((it) => renderItem(it, ++qNo)).filter(Boolean)
  if (!rendered.length) {
    qNo -= u.items.length
    continue
  }
  for (const r of rendered) {
    answerRows.push({
      no: qNo - rendered.length + rendered.indexOf(r) + 1,
      unit: u.no,
      answer: r.answer,
      explanation: r.explanation,
      source: r.source,
    })
  }
  const vocab = u.vocabulary
    .slice(0, 12)
    .map((v) => `<tr><td>${esc(v.word)}</td><td>${esc(v.meaning_ko ?? '—')}</td></tr>`)
    .join('')
  unitHtml.push(`
<section class="unit">
  <h2><span class="unum">UNIT ${String(u.no).padStart(2, '0')}</span> <span class="umin">${u.estimated_minutes}분</span></h2>
  ${rendered.map((r) => r.html).join('')}
  <div class="vocab">
    <h3>Words</h3>
    <table>${vocab}</table>
  </div>
  <p class="src">출처 · ${esc(u.sources.join(' / '))}</p>
</section>`)
}

const passed = card.auto.filter((c) => c.pass).length
const html = `<title>${esc(rung?.volumeTitle ?? `Vocaflow Reading V${BAND}`)}</title>
<style>
:root{--ink:#1a1a1a;--sub:#5a5a5a;--line:#d8d4cd;--bg:#fbfaf7;--accent:#7a3b2e;--slot:#b8542f}
:root:not([data-theme="light"]){}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#eae7e1;--sub:#a8a29a;--line:#3a3733;--bg:#1c1b19;--accent:#d99a86;--slot:#e0a184}}
:root[data-theme="dark"]{--ink:#eae7e1;--sub:#a8a29a;--line:#3a3733;--bg:#1c1b19;--accent:#d99a86;--slot:#e0a184}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;line-height:1.72}
.wrap{max-width:46rem;margin:0 auto;padding:3rem 1.25rem 5rem}
.cover{border-bottom:3px double var(--line);padding-bottom:2rem;margin-bottom:2.5rem}
.brand{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:2.1rem;margin:.6rem 0 .3rem;letter-spacing:-.01em;text-wrap:balance}
.meta{color:var(--sub);font-size:.9rem}
.scorebar{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:1.2rem}
.chip{border:1px solid var(--line);border-radius:2px;padding:.2rem .5rem;font-size:.74rem;color:var(--sub)}
.chip.ok{border-color:var(--accent);color:var(--accent)}
.unit{margin:0 0 3rem;padding-top:1.5rem;border-top:1px solid var(--line)}
.unit h2{display:flex;align-items:baseline;justify-content:space-between;font-size:.86rem;letter-spacing:.14em;color:var(--accent);margin:0 0 1.2rem;font-weight:700}
.umin{color:var(--sub);font-weight:400;letter-spacing:0}
.q{margin:0 0 2rem}
.stem{font-size:.95rem;margin:0 0 .8rem}
.passage{margin:0 0 .7rem;text-align:justify;hyphens:auto}
.intro{padding-left:.9rem;border-left:3px solid var(--line)}
.block .lbl{font-weight:700;color:var(--accent)}
.given{border:1px solid var(--line);padding:.7rem .9rem;margin:0 0 .9rem;background:transparent}
.slot{color:var(--slot);font-weight:700}
.choices{margin:.9rem 0 0;padding-left:1.4rem}
.choices li{margin:.15rem 0;font-variant-numeric:tabular-nums}
.vocab{margin-top:1.4rem;border-top:1px dotted var(--line);padding-top:.8rem}
.vocab h3{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--sub);margin:0 0 .4rem}
.vocab table{width:100%;border-collapse:collapse;font-size:.86rem}
.vocab td{padding:.16rem .5rem .16rem 0;vertical-align:top}
.vocab td:first-child{width:11rem;color:var(--accent)}
.src{margin:.9rem 0 0;font-size:.76rem;color:var(--sub)}
.answers{margin-top:4rem;border-top:3px double var(--line);padding-top:2rem}
.answers h2{font-size:1.3rem;margin:0 0 1.2rem}
.arow{border-bottom:1px dotted var(--line);padding:.7rem 0}
.ano{font-weight:700;color:var(--accent)}
.expl{margin:.35rem 0 0;font-size:.86rem;color:var(--sub);white-space:pre-wrap}
.noexpl{font-size:.82rem;color:var(--sub);font-style:italic}
.tablewrap{overflow-x:auto}
@media print{body{background:#fff}.wrap{max-width:none}}
</style>
<div class="wrap">
<header class="cover">
  <p class="brand">${esc(rung ? `${rung.step}단 · ${rung.schoolBand}` : `V${BAND}`)}</p>
  <h1>${esc(rung?.volumeTitle ?? `Vocaflow Reading V${BAND}`)}</h1>
  <p class="meta">${units.length}단원 · ${qNo}문항 · 총 ${units.reduce((s, u) => s + u.estimated_minutes, 0)}분 · 레벨 V${BAND}</p>
  <div class="scorebar">
    <span class="chip ok">자동 검수 ${passed}/${card.auto.length} 통과</span>
    <span class="chip">지문 90~200어</span>
    <span class="chip">정답 번호 균등 검정</span>
    <span class="chip">출처 표기</span>
  </div>
</header>
${unitHtml.join('')}
<section class="answers">
  <h2>정답 및 해설</h2>
  ${answerRows
    .map(
      (a) => `<div class="arow">
    <span class="ano">${a.no}.</span> ${CIRCLED[a.answer - 1] ?? a.answer}
    ${
      a.explanation
        ? `<div class="expl">${esc(a.explanation.split('\n').slice(2).join('\n'))}</div>`
        : '<div class="noexpl">근거를 지문에서 확정하지 못해 해설을 싣지 않았다.</div>'
    }
  </div>`,
    )
    .join('')}
</section>
</div>`

fs.writeFileSync(path.resolve(OUT), html, 'utf8')

console.log(`V${BAND} — 원글 ${ids.length}편 · 문항 풀 ${pool.length}`)
console.log(`조합 ${units.length}단원 · 인쇄 ${qNo}문항${stoppedBecause ? ` (${stoppedBecause})` : ''}`)
console.log(`자동 검수 ${passed}/${card.auto.length} 통과`)
const withExpl = answerRows.filter((a) => a.explanation).length
console.log(`해설 ${withExpl}/${answerRows.length} — 나머지는 근거를 못 찾아 싣지 않았다`)
console.log(`\n→ ${path.resolve(OUT)}`)
