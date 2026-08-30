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

import { SCHOOL_TYPES, loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 5)
const UNITS = Number(arg('units') ?? 20)
const OUT = arg('out') ?? `volume-v${BAND}.html`

const { createClient } = await import('@supabase/supabase-js')
const {
  toCsatOrder,
  toCsatInsert,
  scoreVolume,
  explainOrder,
  explainInsert,
  SERIES_SPINE,
  rungMix,
  typeMixFit,
  // 브랜딩 — 값은 `@vocaflow/design-tokens` 에서 온다. 여기서 색을 적지 않는다.
  VOLUME_FONTS,
  buildColophon,
  ladderStrip,
  volumeCssVariables,
} = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재료 + 조합 ────────────────────────────────────────────────────
// **규칙은 `volume-pool.mjs` 한 곳에만 있다.** 해설 드레인(`explain-drain-export.mjs`)이
// 같은 함수를 부르므로 "드레인이 겨냥한 책" 과 "조판된 책" 이 어긋날 수 없다.
// 예전에는 양쪽이 각자 풀을 만들었고 셋(밴드 기준·어휘 맵·display_only)이 달라
// 2문항이 조용히 어긋났다 — 해설을 다 채웠는데도 책은 78/80 으로 나왔다.
const MARKET_MIX = process.argv.includes('--market-mix')
const { units, stoppedBecause, articles: byId, pool, mix } = await loadVolume(db, {
  band: BAND,
  unitCount: UNITS,
  marketMix: MARKET_MIX,
})

const card = scoreVolume(units, BAND)

// ── 유형 구성이 시장과 얼마나 맞는가 ────────────────────────────────
// 시중 79종 실측 밀도(`market-spec.json` typeDensity)를 목표로 삼고 총변이거리로 잰다.
// 이 값을 안 찍으면 "중1-2 교재 120문항 중 80문항이 수능 순서·삽입" 같은 상태를
// 아무도 눈치채지 못한다 — 실제로 그랬다.
const actualMix = {}
for (const u of units) for (const it of u.items) actualMix[it.type] = (actualMix[it.type] ?? 0) + 1
const target = rungMix(BAND, new Set(pool.map((it) => it.type))).targetShare
const fit = typeMixFit(actualMix, target)
const rung = SERIES_SPINE.find((r) => r.vLevels.includes(BAND))

// ── 조판 ────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const CIRCLED = ['①', '②', '③', '④', '⑤']

/**
 * 해설을 고른다 — **배치가 쓴 것이 우선**이다.
 *
 * 결정론 해설(`explain.ts`)은 근거가 지문에서 확정될 때만 나오고 실측 6.9% 에서 멈춘다.
 * 나머지는 Claude Code 배치가 `answer_key.explanation_ko` 에 채운다.
 * 둘 다 없으면 **빈 자리에 없다고 적는다** — 지어내지 않는다.
 */
function pickExplanation(item, deterministic) {
  const batch = item.answer_key?.explanation_ko
  if (typeof batch === 'string' && batch.trim()) return { text: batch.trim(), from: 'batch' }
  // 생성형은 해설을 `rationale_ko` 에 담는다 — 같은 것이 두 이름으로 산다.
  // 여기서 안 보면 534문항의 해설이 있는데도 "없음" 으로 인쇄된다.
  const rationale = item.answer_key?.rationale_ko
  if (typeof rationale === 'string' && rationale.trim()) return { text: rationale.trim(), from: 'batch' }
  if (deterministic?.body) {
    // 결정론 해설의 첫 두 줄은 "정답 ③ (B)-(A)-(C)" 와 빈 줄이라 본문에서는 뺀다.
    return { text: deterministic.body.split('\n').slice(2).join('\n'), from: 'rule' }
  }
  return null
}

/** 문항 하나를 수능 인쇄 형식으로. 못 바꾸면 null. */
/** 생성형 유형 — 지문 하나 + 5지선다. 유형이 열이어도 인쇄 모양은 하나다. */
const EXTRA_STEM_FALLBACK = '다음 글에 대한 물음에 답하시오.'

function renderExtra(item, no) {
  const p = item.payload ?? {}
  const choices = Array.isArray(p.choices) ? p.choices : []
  if (choices.length !== 5) return null
  const answer = Number(item.answer_key?.answer)
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) return null
  // 밑줄 유형은 그 구절에 실제로 밑줄을 친다 — 안 치면 발문이 가리키는 곳이 없다.
  let passage = esc(String(p.passage ?? ''))
  if (p.underline) {
    const u = esc(String(p.underline))
    if (passage.includes(u)) passage = passage.replace(u, `<u>${u}</u>`)
  }
  return {
    html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(String(p.stem_ko ?? EXTRA_STEM_FALLBACK))}</p>
  <div class="passage">${passage}</div>
  ${p.summary_sentence ? `<div class="given">${esc(String(p.summary_sentence))}</div>` : ''}
  <ol class="choices">${choices.map((c) => `<li>${esc(String(c))}</li>`).join('')}</ol>
</div>`,
    answer,
    explanation: item.answer_key?.rationale_ko
      ? { text: String(item.answer_key.rationale_ko), from: 'batch' }
      : null,
    source: item.ref_title,
  }
}

/**
 * 학교 시험 축(중등 내신) 조판 — 4지선다 · 밑줄 5지 · 단답 · 배열.
 *
 * `renderExtra` 는 `choices.length === 5` 를 요구한다. 이 유형들은 선택지가 4개이거나
 * 아예 없어서 **전부 null 로 떨어졌다** — 13,351문항이 인쇄되지 않던 이유다.
 */
function renderSchool(item, no) {
  const p = item.payload ?? {}
  const ak = item.answer_key ?? {}
  const sentences = Array.isArray(p.sentences) ? p.sentences.map(String) : []
  const stem = String(p.prompt_ko ?? p.stem_ko ?? '')

  // ── 4지선다: 본문 어휘 뜻 · 단원 문법 ──
  if (Array.isArray(p.choices) && p.choices.length >= 3 && p.choices.length <= 5) {
    const answer = Number(ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > p.choices.length) return null
    const body = sentences.length ? sentences.map((x) => esc(x)).join(' ') : ''
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  ${body ? `<div class="passage">${body}</div>` : ''}
  <ol class="choices">${p.choices
    .map((c) => `<li>${esc(typeof c === 'string' ? c : (c?.text ?? ''))}</li>`)
    .join('')}</ol>
</div>`,
      answer,
      explanation: pickExplanation(item, null),
      source: item.ref_title,
    }
  }

  // ── 밑줄 5지: 문맥상 낱말 쓰임 · 어법 고르기 ──
  if (Array.isArray(p.underlines) && p.underlines.length >= 3) {
    const answer = Number(ak.position ?? ak.answer)
    if (!Number.isInteger(answer) || answer < 1 || answer > p.underlines.length) return null
    // 밑줄 자리에 번호를 붙여 인쇄한다 — 안 붙이면 발문이 가리키는 곳이 없다.
    const marked = sentences.map((sentence, si) => {
      let out = esc(sentence)
      for (const [ui, u] of p.underlines.entries()) {
        if (Number(u?.sentenceIdx) !== si) continue
        const w = esc(String(u?.word ?? ''))
        if (!w || !out.includes(w)) continue
        out = out.replace(w, `<u>${CIRCLED[ui] ?? ''}${w}</u>`)
      }
      return out
    }).join(' ')
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem || '밑줄 친 부분 중 알맞지 않은 것은?')}</p>
  <div class="passage">${marked}</div>
</div>`,
      answer,
      explanation: pickExplanation(item, null),
      source: item.ref_title,
    }
  }

  // ── 단답: 빈칸 낱말 쓰기 · 어법 고쳐 쓰기 ──
  if (typeof p.stem === 'string' && p.stem.trim()) {
    const text = String(ak.text ?? '')
    if (!text) return null
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> ${esc(stem)}</p>
  <div class="passage">${esc(p.stem)}</div>
  ${p.hint ? `<p class="hint">힌트 ${esc(String(p.hint))}</p>` : ''}
  <p class="answer-line">답: ____________</p>
</div>`,
      answer: text,
      explanation: pickExplanation(item, null),
      source: item.ref_title,
    }
  }

  // ── 배열: 영작 ──
  if (Array.isArray(p.bank) && p.bank.length >= 3) {
    const sentence = String(ak.sentence ?? '')
    if (!sentence) return null
    return {
      html: `
<div class="q">
  <p class="stem"><b>${no}.</b> 낱말을 모두 한 번씩 써서 문장을 완성하시오.</p>
  ${p.context ? `<div class="passage">${esc(String(p.context))}</div>` : ''}
  <div class="given">${p.bank.map((w) => esc(String(w))).join(' / ')}</div>
  <p class="answer-line">답: ________________________________________</p>
</div>`,
      answer: sentence,
      explanation: pickExplanation(item, null),
      source: item.ref_title,
    }
  }
  return null
}

function renderItem(item, no) {
  // ⚠️ **생성형을 여기서 안 받으면 조합기가 넣어도 인쇄가 안 된다.** 재료·조합·조판 셋이
  //   다 열려야 학습자에게 닿는다 — 하나만 막혀도 문항은 DB 에만 남는다.
  if (SCHOOL_TYPES.has(item.type)) return renderSchool(item, no)
  if (item.type !== 'order' && item.type !== 'insert') return renderExtra(item, no)
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
      explanation: pickExplanation(item, ex),
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
    explanation: pickExplanation(item, ex),
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
const colophon = buildColophon({
  title: rung?.volumeTitle ?? `Vocaflow Reading V${BAND}`,
  step: rung?.step ?? null,
  schoolBand: rung?.schoolBand ?? null,
  vLevel: BAND,
  autoPassed: passed,
  autoTotal: card.auto.length,
})
const html = `<title>${esc(colophon.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400&display=swap">
<style>
${volumeCssVariables()}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${VOLUME_FONTS.english};line-height:1.72}
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
.efrom{margin:.25rem 0 0;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sub);opacity:.7}
.tablewrap{overflow-x:auto}
/* 한국어 해설·라벨은 본문 서체로 — Lora 는 영문 지문 전용이다. */
.meta,.chip,.expl,.noexpl,.vocab h3,.src{font-family:${VOLUME_FONTS.body}}
.ladder{display:flex;gap:.34rem;margin:.9rem 0 0;font-family:${VOLUME_FONTS.mono};font-size:.74rem;color:var(--sub)}
.ladder span{min-width:1.5rem;text-align:center}
.ladder span.here{color:var(--accent);font-weight:700}
.colophon{margin-top:4rem;border-top:1px solid var(--line);padding-top:1.4rem;font-family:${VOLUME_FONTS.body};font-size:.78rem;color:var(--sub);line-height:1.7}
.colophon dl{display:grid;grid-template-columns:auto 1fr;gap:.3rem 1.2rem;margin:0}
.colophon dt{color:var(--accent);letter-spacing:.1em;text-transform:uppercase;font-size:.68rem;padding-top:.1rem}
.colophon dd{margin:0}
@media print{body{background:#fff}.wrap{max-width:none}}
</style>
<div class="wrap">
<header class="cover">
  <p class="brand">${esc(colophon.ladder)}</p>
  <h1>${esc(colophon.title)}</h1>
  <p class="meta">${units.length}단원 · ${qNo}문항 · 총 ${units.reduce((s, u) => s + u.estimated_minutes, 0)}분 · 레벨 V${BAND}</p>
  <div class="scorebar">
    <span class="chip ok">자동 검수 ${passed}/${card.auto.length} 통과</span>
    <span class="chip">지문 90~200어</span>
    <span class="chip">정답 번호 균등 검정</span>
    <span class="chip">출처 표기</span>
    <span class="chip">교정 3회</span>
  </div>
  <div class="ladder" aria-label="시리즈 일곱 단 중 이 권의 자리">
    ${ladderStrip(rung?.step ?? null)
      .map((s) => `<span class="${s.startsWith('[') ? 'here' : ''}">${esc(s)}</span>`)
      .join('')}
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
        ? `<div class="expl">${esc(a.explanation.text)}</div>` +
          `<p class="efrom">${a.explanation.from === 'batch' ? '해설' : '규칙 근거'}</p>`
        : '<div class="noexpl">근거를 지문에서 확정하지 못해 해설을 싣지 않았다.</div>'
    }
  </div>`,
    )
    .join('')}
</section>
<footer class="colophon">
  <dl>
    <dt>제목</dt><dd>${esc(colophon.title)}</dd>
    <dt>사다리</dt><dd>${esc(colophon.ladder)} — 일곱 단 중 ${rung?.step ?? '—'}단</dd>
    <dt>판차</dt><dd>${esc(colophon.edition)}</dd>
    <dt>발행</dt><dd>${esc(colophon.issued)}</dd>
    <dt>검수</dt><dd>${esc(colophon.review)} · 교정 초교·재교·삼교</dd>
    <dt>출처</dt><dd>${esc(colophon.sourcePolicy)}</dd>
  </dl>
</footer>
</div>`

fs.writeFileSync(path.resolve(OUT), html, 'utf8')

console.log(`V${BAND} — 원글 ${byId.size}편 · 문항 풀 ${pool.length}`)
console.log(`조합 ${units.length}단원 · 인쇄 ${qNo}문항${stoppedBecause ? ` (${stoppedBecause})` : ''}`)
console.log(`자동 검수 ${passed}/${card.auto.length} 통과`)
console.log(
  `유형-학년 적합도 ${(fit * 100).toFixed(1)}% (시중 밀도 대비) — ` +
    Object.entries(actualMix)
      .sort((x, y) => y[1] - x[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(' · '),
)
// **떨어진 항목은 이름을 말한다.** "8/9" 만 찍으면 무엇이 걸렸는지 알 수 없어
// 사람이 HTML 을 열어 눈으로 찾아야 한다 — 그러면 대개 안 찾는다.
for (const c of card.auto.filter((x) => !x.pass)) {
  console.log(`  ❌ ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
}
const byBatch = answerRows.filter((a) => a.explanation?.from === 'batch').length
const byRule = answerRows.filter((a) => a.explanation?.from === 'rule').length
console.log(
  `해설 ${byBatch + byRule}/${answerRows.length} — 배치 ${byBatch} · 규칙 ${byRule} · ` +
    `없음 ${answerRows.length - byBatch - byRule}`,
)
console.log(`\n→ ${path.resolve(OUT)}`)
