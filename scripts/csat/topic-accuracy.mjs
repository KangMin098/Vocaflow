// scripts/csat/topic-accuracy.mjs
//
// **분류기의 정확도를 실제로 잰다 — 「얼마나 틀리는가」를 손판독 표본으로.**
//
// ── 왜 필요한가 (2026-09-07) ─────────────────────────────────────────
// `lib-topic.mjs` 는 머리말에 "약하다" 고만 적어 두고 **얼마나 약한지는 한 번도 재지
// 않았다.** 그 사이 `backfill-topic.mjs` 가 그 라벨을 69,541행에 적었고, `topic-gap.mjs`
// 가 그 라벨로 「부족 0」을 냈고, 그 「부족 0」이 원문 확보 우선순위가 됐다.
// **자를 재지 않은 채 그 자로 잰 값이 계획이 된 것이다.**
//
// 이 파일은 두 단계로 나뉜다 — 뽑는 것과 채점하는 것.
//
//   1) `--sample`  소스별로 고르게 표본을 뽑아 `topic-sample.json` 에 적는다.
//                  (제목 + 본문 앞부분 + 현재 라벨. **읽기만 한다.**)
//   2) 사람(또는 Claude Code)이 `topic-sample.labels.json` 에 정답을 적는다.
//   3) `--score`   정답과 현재 분류기를 대조해 오분류율·혼동표를 낸다.
//
// ⚠️ 채점은 **저장된 라벨(DB)** 이 아니라 **지금 코드가 내는 라벨**과 대조한다.
//    그래야 코드를 고친 뒤 같은 표본으로 전후를 견줄 수 있다(백필 없이).
//
// 재실행 안전: 읽기만 한다. DB 에 쓰지 않는다.
//
// 실행:
//   node scripts/csat/topic-accuracy.mjs --sample --n 130
//   node scripts/csat/topic-accuracy.mjs --score

import fs from 'node:fs'
import path from 'node:path'

import { classify, TOPIC_KEYS } from './lib-topic.mjs'

const DIR = path.resolve('scripts/csat/data')
const SAMPLE_FILE = path.join(DIR, 'topic-sample.json')
const LABEL_FILE = path.join(DIR, 'topic-sample.labels.json')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}

/** 소스별 표본 몫 — 편수 비례가 아니라 **고르게**. 소스마다 오분류 방식이 다르기 때문이다. */
const QUOTA = {
  plos: 30, gutenberg: 30, futurity: 15, original: 10, usgs: 8, elife: 8, voa: 8,
  nasa: 5, wikipedia: 5, noaa: 5, the_conversation: 5, simple_wikipedia: 4, owid: 4,
  wikivoyage: 4, factbook: 3,
}

async function sample() {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const out = []
  for (const [src, k] of Object.entries(QUOTA)) {
    const { count, error: cErr } = await db
      .from('library_articles')
      .select('id', { count: 'exact', head: true })
      .gt('csat_fit->>pass', '0')
      .eq('source', src)
    if (cErr) throw new Error(`${src} 편수 조회 실패: ${cErr.message}`)
    const n = count ?? 0
    if (!n) continue
    // 고정 간격 — 무작위 시드를 쓰면 재실행할 때마다 표본이 바뀌어 전후 비교가 깨진다.
    const take = Math.min(k, n)
    for (let i = 0; i < take; i += 1) {
      const off = Math.floor((i * n) / take)
      const { data, error } = await db
        .from('library_articles')
        .select('id, source, title, content, csat_fit')
        .gt('csat_fit->>pass', '0')
        .eq('source', src)
        .order('id')
        .range(off, off)
      if (error) throw new Error(`${src}@${off} 조회 실패: ${error.message}`)
      const a = data?.[0]
      if (!a) continue
      out.push({
        id: a.id,
        source: a.source,
        title: a.title ?? '',
        storedTopic: a.csat_fit?.topic ?? null,
        head: String(a.content ?? '').slice(0, 700).replace(/\s+/g, ' '),
        // 분류 입력은 `topic-gap.mjs`·`backfill-topic.mjs` 와 같아야 한다 — 앞 6,000자.
        text: String(a.content ?? '').slice(0, 6000),
      })
    }
    process.stderr.write(`\r  ${src} ${out.length}편…`)
  }
  process.stderr.write('\r' + ' '.repeat(40) + '\r')
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(SAMPLE_FILE, JSON.stringify(out, null, 1))
  console.log(`표본 ${out.length}편 → ${SAMPLE_FILE}`)
  console.log(`정답을 ${LABEL_FILE} 에 { "<id>": "<소재>" } 로 적은 뒤 --score.`)
}

/**
 * 정답은 **문자열 하나 또는 배열**이다.
 *
 * 배열은 "둘 다 맞다" 는 뜻이다 — 「학교 급식과 소아비만」처럼 교육·언어와 사회·경제 어느
 * 칸에 넣어도 사람이 반박하지 못하는 글이 실제로 있다. 그런 글을 억지로 한 칸에 못 박으면
 * **분류기가 아니라 판독자의 자의를 재게 된다.** 첫 원소가 대표값(정답 분포·재현율용)이다.
 */
const truthList = (v) => (Array.isArray(v) ? v : [v])

function score() {
  const rows = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'))
  const truth = JSON.parse(fs.readFileSync(LABEL_FILE, 'utf8'))
  const judged = rows.filter((r) => truth[r.id])
  if (!judged.length) throw new Error('정답이 하나도 없다')

  let ok = 0
  const confusion = new Map()
  const wrong = []
  for (const r of judged) {
    const got = classify(r.text, { title: r.title }).topic
    const acc = truthList(truth[r.id])
    if (acc.includes(got)) ok += 1
    else {
      wrong.push({ id: r.id, source: r.source, title: r.title, truth: acc.join(' | '), got })
      confusion.set(`${acc[0]} → ${got}`, (confusion.get(`${acc[0]} → ${got}`) ?? 0) + 1)
    }
  }
  const rate = (100 * (judged.length - ok)) / judged.length
  console.log(`소재 분류 정확도 — 손판독 ${judged.length}편\n${'='.repeat(70)}`)
  console.log(`  맞음 ${ok} · 틀림 ${judged.length - ok} · **오분류율 ${rate.toFixed(1)}%**\n`)

  console.log('  ① 오분류 방향 (정답 → 잘못 간 칸)')
  console.log('  ' + '-'.repeat(66))
  for (const [k, v] of [...confusion].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(4)}  ${k}`)
  }
  console.log()

  console.log('  ② 칸별 — 그 칸으로 간 것 중 맞은 비율(정밀도) / 그 칸이어야 할 것 중 잡힌 비율(재현율)')
  console.log('  ' + '-'.repeat(66))
  console.log(`    ${'소재'.padEnd(11)}${'정답수'.padStart(7)}${'예측수'.padStart(7)}${'정밀도'.padStart(8)}${'재현율'.padStart(8)}`)
  for (const k of TOPIC_KEYS) {
    // 정답수는 **대표값**(배열 첫 원소) 기준, 정밀도는 **허용 목록 전체** 기준이다.
    // 재현율도 허용 목록으로 세면 분모보다 분자가 커져 100%를 넘는다(대표값이 아닌 칸으로
    // 맞춘 글이 분자에 들어오기 때문) — 재현율만 대표값으로 센다.
    const t = judged.filter((r) => truthList(truth[r.id])[0] === k)
    const p = judged.filter((r) => classify(r.text, { title: r.title }).topic === k)
    const tp = p.filter((r) => truthList(truth[r.id]).includes(k)).length
    const tpRep = t.filter((r) => classify(r.text, { title: r.title }).topic === k).length
    if (!t.length && !p.length) continue
    console.log(
      `    ${k.padEnd(11)}${String(t.length).padStart(7)}${String(p.length).padStart(7)}` +
        `${(p.length ? `${Math.round((100 * tp) / p.length)}%` : '-').padStart(8)}` +
        `${(t.length ? `${Math.round((100 * tpRep) / t.length)}%` : '-').padStart(8)}`,
    )
  }
  console.log()
  console.log('  ③ 틀린 것 전부')
  console.log('  ' + '-'.repeat(66))
  for (const w of wrong) {
    console.log(`    [${w.source}] ${String(w.title).slice(0, 58)}`)
    console.log(`        정답 ${w.truth} · 분류기 ${w.got}`)
  }
  return rate
}

if (process.argv.includes('--sample')) {
  if (arg('n')) {
    const scale = Number(arg('n')) / Object.values(QUOTA).reduce((a, b) => a + b, 0)
    for (const k of Object.keys(QUOTA)) QUOTA[k] = Math.max(1, Math.round(QUOTA[k] * scale))
  }
  await sample()
} else {
  score()
}
