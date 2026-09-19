// apps/web/scripts/csat-learner/gate1-reflow.mts
//
// **Gate 1 · reflow 파이프라인 — 학습자 PDF 에서 문항을 얼마나 제대로 뽑는가.**
//
// 브라우저가 쓸 함수(`lib/csat/reflow`)를 그대로 부르고, 결과를 **DB 의 지문·선지**(코퍼스 정본)와
// 구워 둔 골격(`skeleton-data` — 문장 길이·인용 자리)에 대조한다.
//
//   경계 인식   — 시작 줄을 찾았고 발문·지문이 비지 않았다
//   텍스트 정확 — 낱말 LCS / max(길이) (소문자·구두점 무시)
//   선지 정확   — 선지 블록 유형에서 5개 모두 낱말 LCS ≥ 0.9
//   문장 앵커   — 골격의 k번째 문장이 reflow 의 k번째 문장과 길이가 맞는가(±max(4, 8%))
//   인용 자리   — 골격이 드러낸 인용(reveal)이 reflow 지문에서 찾히는가
//
// PASS(지시문 Gate 1): 경계 ≥ 95% · 문장 앵커 ≥ 95%. 표본 2회차 + 전 회차를 함께 잰다.
//
//   npx tsx scripts/csat-learner/gate1-reflow.mts [--exams 2026,M2706] [--all] [--detail <번호>]
//
// ⚠️ 리포트에는 **수치와 문항 번호만** 쓴다. `--detail` 은 원문을 화면에 찍는다(저장하지 않는다).

import fs from 'node:fs'
import path from 'node:path'

import { findQuote } from '../../src/lib/csat/quote-match'
import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { anchorMatchRate } from '../../src/lib/csat/reflow/align'
import { detectAnchors, examIdFromText } from '../../src/lib/csat/reflow/detect'
import { reflowExam } from '../../src/lib/csat/reflow/reflow'
import type { ReflowAnchors, ReflowItem } from '../../src/lib/csat/reflow/types'
import { REPORTS, arg, flag, localPapers, pdfPages, serviceDb, writeJson } from './env.mts'

const SAMPLE = (arg('exams') ?? '2026,M2706').split(',')
const detail = arg('detail')

/**
 * 낱말 열. **한글은 음절 하나가 한 토큰이다** — DB 쪽 추출은 `Zurich 에서` · `체 육 지 도 자` 처럼
 * 한글 사이·앞에 공백이 끼어 있어(pdftotext 산물) 띄어쓰기 단위로 세면 reflow 가 맞게 뽑은 선지를
 * 틀렸다고 센다(1차 실행에서 선지 정확도 64% 의 대부분이 이것이었다).
 */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/([가-힣])/g, ' $1 ')
    .replace(/[^a-z0-9가-힣①-⑤()]+/g, ' ')
    .split(' ')
    .filter(Boolean)

/** 낱말 LCS / max(길이) */
export function wordSim(a: string, b: string): number {
  const x = words(a)
  const y = words(b)
  if (!x.length && !y.length) return 1
  if (!x.length || !y.length) return 0
  let prev = new Uint16Array(y.length + 1)
  let cur = new Uint16Array(y.length + 1)
  for (let i = 1; i <= x.length; i += 1) {
    for (let j = 1; j <= y.length; j += 1) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[y.length] / Math.max(x.length, y.length)
}

interface SkelItem {
  id: string
  no: number
  sentences: { chars: number; reveals: { anchorId: string; text: string }[] }[]
}

const db = await serviceDb()
const papers = localPapers()
const index = JSON.parse(fs.readFileSync(path.resolve('src/lib/csat/anchor-data/index.json'), 'utf8')) as {
  exams: { exam_id: string; sha256: string }[]
}
const exams = flag('all') ? index.exams.map((e) => e.exam_id) : SAMPLE

type Row = {
  no: number
  type: string | null
  boundary: boolean
  reason: string | null
  text: number
  choices: number | null
  choiceBlame: 'db-noise' | 'reflow' | null
  sentences: { total: number; matched: number }
  quotes: { total: number; found: number }
}

const perExam: Record<string, unknown>[] = []
const allRows: (Row & { exam: string })[] = []

for (const exam of exams) {
  const anchors = JSON.parse(
    fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8'),
  ) as ReflowAnchors & { sha256: string }
  const file = papers.get(anchors.sha256)
  if (!file) {
    perExam.push({ exam, error: '원본 없음' })
    continue
  }
  const { data, error } = await db
    .from('csat_items')
    .select('id, no, type_id, passage, choices, in_scope, body_ok')
    .eq('exam_id', exam)
    .eq('in_scope', true)
  if (error) throw error
  const dbItems = (data ?? []) as {
    id: string
    no: number
    type_id: string | null
    passage: string | null
    choices: string[] | null
    body_ok: boolean
  }[]
  const skel = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/skeleton-data/${exam}.json`), 'utf8')) as {
    items: SkelItem[]
  }
  const skelOf = new Map(skel.items.map((s) => [s.no, s]))
  const typeOf = new Map(dbItems.map((d) => [d.no, d.type_id]))

  const pages = await pdfPages(file)
  const t0 = performance.now()
  const got = reflowExam(pages, anchors, (no) => typeOf.get(no) ?? null, dbItems.map((d) => d.no))
  const ms = performance.now() - t0

  // 해시가 모르는 파일의 길 — 색인 없이 그 자리에서 번호를 찾아도 같은 경계가 나오는가
  const detected = detectAnchors(pages)
  const viaDetect = detected
    ? reflowExam(pages, detected, (no) => typeOf.get(no) ?? null, dbItems.map((d) => d.no))
    : new Map<number, ReflowItem>()
  const detectBoundary =
    dbItems.filter((d) => {
      const a = got.get(d.no)
      const b = viaDetect.get(d.no)
      return a && b && b.stem && b.passage && wordSim(a.passage, b.passage) >= 0.99
    }).length / Math.max(1, dbItems.length)
  const firstText = pages[0].frags.map((f) => f.str).join(' ')
  const idGuess = examIdFromText(firstText)

  const rows: Row[] = []
  for (const d of dbItems.sort((a, b) => a.no - b.no)) {
    const r = got.get(d.no) as ReflowItem | undefined
    const boundary = Boolean(r && r.reason !== 'no-start-line' && r.stem && r.passage)
    const passage = r?.passage ?? ''
    const text = d.passage ? wordSim(passage, d.passage) : 0

    let choices: number | null = null
    let choiceBlame: 'db-noise' | 'reflow' | null = null
    if (r && !r.inline && Array.isArray(d.choices) && d.choices.length === 5) {
      choices = r.choices.length === 5 ? Math.min(...r.choices.map((c, k) => wordSim(c, d.choices![k]))) : 0
      if (choices < 0.9) {
        // **누가 틀렸나.** DB 선지는 pdftotext 산물이라 쪽 번호(` 8 `)·깨진 글리프·다음 쪽 머리글이
        // 꼬리에 붙은 것이 있다. DB 쪽에서 그 잡음을 걷어 낸 뒤 맞으면 reflow 잘못이 아니다.
        const clean = (s: string) =>
          s
            .replace(/[^\x20-\x7E가-힣①-⑤’‘“”–—－…·∙]/g, ' ')
            .replace(/\s\d{1,2}(\s|$)[\s\S]*$/, '')
        const cleaned =
          r.choices.length === 5 ? Math.min(...r.choices.map((c, k) => wordSim(c, clean(d.choices![k])))) : 0
        choiceBlame = cleaned >= 0.9 ? 'db-noise' : 'reflow'
      }
    }

    const sk = skelOf.get(d.no)
    const mine = splitSentences(passage).map((b) => b.end - b.start)
    const { matched } = anchorMatchRate(
      (sk?.sentences ?? []).map((s) => s.chars),
      mine,
    )
    let qTotal = 0
    let qFound = 0
    for (const s of sk?.sentences ?? []) {
      for (const rv of s.reveals) {
        qTotal += 1
        if (findQuote(passage, rv.text)) qFound += 1
      }
    }

    rows.push({
      no: d.no,
      type: d.type_id,
      boundary,
      reason: r ? r.reason : 'no-anchor',
      text: Number(text.toFixed(3)),
      choices: choices === null ? null : Number(choices.toFixed(3)),
      choiceBlame,
      sentences: { total: sk?.sentences.length ?? 0, matched },
      quotes: { total: qTotal, found: qFound },
    })

    if (detail && Number(detail) === d.no && SAMPLE.includes(exam)) {
      console.log(`\n── ${exam}#${d.no} (${d.type_id}) ──`)
      console.log('STEM:', r?.stem)
      console.log('REFLOW:', passage)
      console.log('DB    :', d.passage)
      console.log('CHOICES:', r?.choices, '\nDB     :', d.choices)
      console.log('SENT mine:', mine.join(','), '\nSENT skel:', sk?.sentences.map((s) => s.chars).join(','))
      console.log('NOTES:', r?.notes, 'REASON:', r?.reason)
    }
  }

  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0)
  const withChoices = rows.filter((r) => r.choices !== null)
  const summary = {
    exam,
    items: rows.length,
    ms: Math.round(ms),
    detect_boundary: detectBoundary,
    detect_form_pages_match: detected?.form_pages === anchors.form_pages,
    exam_id_from_text: idGuess,
    exam_id_ok: idGuess === exam,
    boundary: sum((r) => (r.boundary ? 1 : 0)) / rows.length,
    text_mean: sum((r) => r.text) / rows.length,
    text_ge_95: rows.filter((r) => r.text >= 0.95).length / rows.length,
    choices_ok: withChoices.length
      ? withChoices.filter((r) => (r.choices ?? 0) >= 0.9).length / withChoices.length
      : null,
    sentence_anchor: sum((r) => r.sentences.matched) / Math.max(1, sum((r) => r.sentences.total)),
    quote_found: sum((r) => r.quotes.found) / Math.max(1, sum((r) => r.quotes.total)),
    weak: rows
      .filter((r) => !r.boundary || r.text < 0.95 || r.sentences.matched < r.sentences.total || (r.choices ?? 1) < 0.9)
      .map((r) => ({
        no: r.no,
        type: r.type,
        reason: r.reason,
        text: r.text,
        choices: r.choices,
        blame: r.choiceBlame,
        sent: `${r.sentences.matched}/${r.sentences.total}`,
        quotes: `${r.quotes.found}/${r.quotes.total}`,
      })),
  }
  perExam.push(summary)
  allRows.push(...rows.map((r) => ({ ...r, exam })))
  console.log(
    `${exam.padEnd(6)} 문항 ${String(rows.length).padStart(2)} · 경계 ${(summary.boundary * 100).toFixed(1)}% · ` +
      `텍스트 평균 ${(summary.text_mean * 100).toFixed(1)}% (≥95%: ${(summary.text_ge_95 * 100).toFixed(0)}%) · ` +
      `선지 ${summary.choices_ok === null ? '-' : (summary.choices_ok * 100).toFixed(1) + '%'} · ` +
      `문장 앵커 ${(summary.sentence_anchor * 100).toFixed(1)}% · 인용 ${(summary.quote_found * 100).toFixed(1)}% · ${summary.ms}ms`,
  )
}

const pick = (xs: typeof allRows) => {
  const n = xs.length || 1
  const st = xs.reduce((a, r) => a + r.sentences.total, 0) || 1
  const qt = xs.reduce((a, r) => a + r.quotes.total, 0) || 1
  const wc = xs.filter((r) => r.choices !== null)
  return {
    items: xs.length,
    boundary: xs.filter((r) => r.boundary).length / n,
    text_mean: xs.reduce((a, r) => a + r.text, 0) / n,
    choices_ok: wc.length ? wc.filter((r) => (r.choices ?? 0) >= 0.9).length / wc.length : null,
    /** 어긋난 선지 중 DB 잡음을 걷으면 맞는 것을 뺀 — reflow 자체의 선지 정확도 */
    choices_ok_reflow: wc.length ? wc.filter((r) => r.choiceBlame !== 'reflow').length / wc.length : null,
    choice_mismatch: {
      db_noise: wc.filter((r) => r.choiceBlame === 'db-noise').length,
      reflow: wc.filter((r) => r.choiceBlame === 'reflow').map((r) => `${r.exam}#${r.no}`),
    },
    sentence_anchor: xs.reduce((a, r) => a + r.sentences.matched, 0) / st,
    quote_found: xs.reduce((a, r) => a + r.quotes.found, 0) / qt,
  }
}
const sample = pick(allRows.filter((r) => SAMPLE.includes(r.exam)))
const examRows = perExam as { exam: string; detect_boundary?: number; exam_id_ok?: boolean; exam_id_from_text?: string | null }[]
const unknownFile = {
  /** 색인 없이 검출한 경계로 뽑은 지문이 색인 경로와 같은(≥0.99) 문항 비율 */
  detect_boundary: examRows.reduce((a, e) => a + (e.detect_boundary ?? 0), 0) / Math.max(1, examRows.length),
  exam_id_ok: examRows.filter((e) => e.exam_id_ok).length,
  exam_id_total: examRows.length,
  exam_id_misses: examRows.filter((e) => !e.exam_id_ok).map((e) => `${e.exam}→${e.exam_id_from_text}`),
}
const pass = sample.boundary >= 0.95 && sample.sentence_anchor >= 0.95
const report = {
  gate: 1,
  at: new Date().toISOString(),
  sample_exams: SAMPLE,
  pass,
  criteria: { boundary: '≥ 0.95', sentence_anchor: '≥ 0.95' },
  sample,
  all: flag('all') ? pick(allRows) : undefined,
  unknown_file: unknownFile,
  exams: perExam,
}
if (!detail) writeJson(path.join(REPORTS, flag('all') ? 'gate1-report.json' : 'gate1-sample.json'), report)
console.log(`\n표본 ${SAMPLE.join('·')} — 경계 ${(sample.boundary * 100).toFixed(1)}% · 문장 앵커 ${(sample.sentence_anchor * 100).toFixed(1)}% → ${pass ? 'PASS' : 'FAIL'}`)
if (report.all) console.log(`전 회차 — ${JSON.stringify(report.all)}`)
