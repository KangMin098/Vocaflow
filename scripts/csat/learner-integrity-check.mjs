#!/usr/bin/env node
// scripts/csat/learner-integrity-check.mjs
//
// **학습자 노출 문항의 버전 정합성 — 읽기 전용 검사.** (G1 · 2026-10-08 · 2차 심사 결함 E)
//
// 학습자 화면은 런타임에 **최신 published 분석**을 읽는데, 지문 지도(골격)와 강의는 빌드 때 굳은
// 파일이다. 둘이 어긋나면 화면이 틀린 근거 위치를 가리키거나 옛 분석을 읽어 준다. 이 스크립트는
// 그 어긋남을 **찾기만** 한다 — DB · 파일 어느 것도 고치지 않는다(SELECT 만).
//
// 검사(문항 = 최신 published 분석이 있는 문항):
//   K1 정답 불일치      — 분석의 정답 선지(verdict=correct) ≠ csat_items.answer
//   K2 번호 체계 어긋남  — 골격 answer 앵커 문장 ⊄ 분석 answer_locus.sentence_index(1-기반 → 0-기반). 화면은 sentence_index 를
//                         쓰지 않으므로 그 자체로는 정보성(분석 데이터 결함) — 줄 단위로 센 안내문 등
//   K2P 해설 속 문장 번호 — K2 이면서 해설 글에 「n번 문장」·「n번째 문장」이 있다 → 지도 번호와 해설 글이 어긋날 **후보**.
//                         해설 글의 번호가 지도와 맞고 sentence_index 칸만 틀린 경우도 있다(2017#31 실측) — 사람이 지문과 대조해야 확정
//   K3 골격 인용 낡음    — 골격 answer 인용이 최신 분석 answer_locus.quote 와 겹치지 않음
//   K4 오답 앵커 무효    — 골격·강의가 가리키는 reject:n 이 최신 분석에서 오답이 아님
//   K5 강의 낡음        — 강의 빌드일 < 최신 분석 생성일(분석이 강의 뒤에 바뀜)
//   K6 강의 문장 범위    — 강의 cue 의 anchor:sentence:k 가 골격 문장 수를 넘음
//   H1 학평 단위 해시    — 발행 분석의 units_hash ≠ 그 문항 최신 단위 목록의 units_hash
//   V  발행 버전 다수    — published 행이 2개 이상(로더는 최신 하나를 고른다 — 정보성)
//
// 실행: node --tls-max-v1.2 scripts/csat/learner-integrity-check.mjs [--env <apps/web/.env.local>] [--out <json>]
// 결과: JSON(문항 id · 버전 · 검사 코드 · 영향 화면) — 원문 · 인용 글자는 싣지 않는다(D15).

import fs from 'node:fs'
import path from 'node:path'

import { isKiceExam } from './lib-exam-id.mjs'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const ROOT = process.cwd()
const SKEL_DIR = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const LECT_DIR = path.join(ROOT, 'apps/web/src/lib/csat/lecture-data')
const OUT = opt('--out') ?? path.join(ROOT, 'scripts/csat/learner-integrity.result.json')

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of [opt('--env'), '.env.local', 'apps/web/.env.local'].filter(Boolean)) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

const { createClient } = await import('@supabase/supabase-js')
const url = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!url || !key) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY 가 필요하다(--env 로 .env.local 경로를 넘긴다)')
const db = createClient(url, key, { auth: { persistSession: false } })

// 키셋 페이징 — OFFSET(.range)은 뒤 페이지가 앞을 다시 훑는다(offset-paging-budget 가드).
// `key` 가 표에서 유일하면 그대로, 아니면(근거 단위: 한 문항 여러 행) 경계 문항을 다음 페이지에서 통째로 다시 읽는다.
const PAGE = 1000
async function all(table, columns, key, { unique = true, filter } = {}) {
  const out = []
  let cursor = null
  for (;;) {
    let q = db.from(table).select(columns).order(key).limit(PAGE)
    if (cursor !== null) q = unique ? q.gt(key, cursor) : q.gte(key, cursor)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (data.length < PAGE) {
      out.push(...data)
      break
    }
    const last = data[data.length - 1][key]
    // 유일하지 않은 키: 경계 키의 행은 이번에 버리고 다음 페이지(gte)에서 통째로 받는다 — 중복도 누락도 없다
    const body = unique ? data : data.filter((r) => r[key] !== last)
    if (!body.length) throw new Error(`${table}: 한 ${key} 에 ${PAGE}행 이상 — 키셋 경계를 못 넘는다`)
    out.push(...body)
    cursor = last
  }
  return out
}

const norm = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
const overlaps = (a, b) => {
  const x = norm(a)
  const y = norm(b)
  return Boolean(x && y && (x.includes(y) || y.includes(x)))
}

// ── 읽기 ────────────────────────────────────────────────────────────────
const analyses = await all('csat_item_analyses', 'id,item_id,version,created_at,choice_analysis,answer_locus,units_hash', 'id', { filter: (q) => q.eq('status', 'published') })
// 문항은 평가원 · 학평 두 집합을 모두 본다 — 집합 판정은 `isKiceExam` 하나로(합산하지 않고 따로 센다)
const items = await all('csat_items', 'id,answer', 'id')
const units = await all('csat_item_units', 'item_id,units_version,units_hash,created_at', 'item_id', { unique: false })

const answerOf = new Map(items.map((i) => [i.id, i.answer]))
const latest = new Map()
const versions = new Map()
for (const a of analyses) {
  versions.set(a.item_id, (versions.get(a.item_id) ?? 0) + 1)
  const prev = latest.get(a.item_id)
  if (!prev || a.version > prev.version) latest.set(a.item_id, a)
}
const currentUnits = new Map()
for (const u of units) {
  const prev = currentUnits.get(u.item_id)
  if (!prev || u.units_version > prev.units_version || (u.units_version === prev.units_version && u.created_at > prev.created_at)) currentUnits.set(u.item_id, u)
}

const skeleton = new Map()
for (const f of fs.readdirSync(SKEL_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const d = JSON.parse(fs.readFileSync(path.join(SKEL_DIR, f), 'utf8'))
  for (const it of d.items ?? []) skeleton.set(it.id, it)
}
const lectures = new Map()
for (const f of fs.readdirSync(LECT_DIR).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(LECT_DIR, f), 'utf8'))
  for (const [id, l] of Object.entries(d.lectures ?? {})) lectures.set(l.item_id ?? id, { ...l, built: d.built })
}

// ── 검사 ────────────────────────────────────────────────────────────────
const findings = []
const add = (item, code, detail, screens) => findings.push({ item, version: latest.get(item)?.version ?? null, code, detail, screens })

for (const [id, a] of latest) {
  const choices = Array.isArray(a.choice_analysis) ? a.choice_analysis : []
  const correct = choices.find((c) => c.verdict === 'correct')?.n ?? null
  const distractors = new Set(choices.filter((c) => c.verdict === 'distractor').map((c) => c.n))
  const key = answerOf.get(id)
  if (correct != null && key != null && correct !== key) add(id, 'K1', `분석 정답 ${correct} ≠ 문항 정답 ${key}`, ['item', 'dissect'])
  if ((versions.get(id) ?? 0) > 1) add(id, 'V', `published ${versions.get(id)}개`, ['info'])

  const sk = skeleton.get(id)
  if (sk) {
    const ansAnchor = (sk.anchors ?? []).find((x) => x.id === 'answer')
    const locus = Array.isArray(a.answer_locus?.sentence_index) ? a.answer_locus.sentence_index.map((n) => n - 1) : []
    if (ansAnchor?.sentences?.length && locus.length && !ansAnchor.sentences.every((s) => locus.includes(s)))
    {
      add(id, 'K2', `골격 근거 문장 [${ansAnchor.sentences.join(',')}] ⊄ 분석 [${locus.join(',')}](0-기반)`, ['info'])
      const prose = [a.answer_locus?.reasoning, ...choices.flatMap((c) => [c.why_correct, c.why_tempting, c.how_to_reject])].filter(Boolean).join(' ')
      if (/\d+\s*번(째)?\s*문장/.test(prose)) add(id, 'K2P', '해설 글이 문장 번호를 말하고 분석 번호 칸이 지도와 다름 — 확인 필요', ['item:analysis', 'item:map', 'item:lecture'])
    }
    const reveal = (sk.sentences ?? []).flatMap((s) => (s.reveals ?? []).filter((r) => r.anchorId === 'answer').map((r) => r.text))
    if (reveal.length && a.answer_locus?.quote && !reveal.some((t) => overlaps(t, a.answer_locus.quote)))
      add(id, 'K3', '골격 정답 인용이 최신 분석 인용과 겹치지 않음', ['item:map'])
    for (const anc of sk.anchors ?? []) {
      const m = /^reject:(\d)$/.exec(anc.id)
      if (m && !distractors.has(Number(m[1]))) add(id, 'K4', `골격 ${anc.id} 가 최신 분석에서 오답이 아님`, ['item:map'])
    }
  }

  const lec = lectures.get(id)
  if (lec) {
    if (lec.built && a.created_at && new Date(a.created_at) > new Date(`${lec.built}T23:59:59Z`))
      add(id, 'K5', `강의 빌드 ${lec.built} < 분석 v${a.version} ${String(a.created_at).slice(0, 10)}`, ['item:lecture'])
    const nSent = sk?.sentences?.length ?? null
    const seen = new Set()
    for (const c of lec.cues ?? []) {
      const t = `${c.target?.kind}:${c.target?.id}`
      const r = /^analysis:reject:(\d)$/.exec(t)
      if (r && !distractors.has(Number(r[1])) && !seen.has(t)) {
        seen.add(t)
        add(id, 'K4', `강의 ${c.target.id} 가 최신 분석에서 오답이 아님`, ['item:lecture'])
      }
      const s = /^anchor:sentence:(\d+)$/.exec(t)
      if (s && nSent != null && Number(s[1]) >= nSent && !seen.has(t)) {
        seen.add(t)
        add(id, 'K6', `강의 문장 ${s[1]} ≥ 골격 문장 수 ${nSent}`, ['item:lecture'])
      }
    }
  }

  if (!isKiceExam(id) && a.units_hash) {
    const u = currentUnits.get(id)
    if (u && u.units_hash !== a.units_hash) add(id, 'H1', `분석 단위 해시 ≠ 최신 단위(v${u.units_version})`, ['item', 'review'])
  }
}

// ── 요약 ────────────────────────────────────────────────────────────────
const byCode = {}
for (const f of findings) byCode[f.code] = (byCode[f.code] ?? 0) + 1
// 확정 결함(K1·K4·H1)과 사람 확인이 필요한 후보(K2P)를 섞어 세지 않는다
const severe = new Set(findings.filter((f) => ['K1', 'K4', 'H1'].includes(f.code)).map((f) => f.item))
const review = new Set(findings.filter((f) => f.code === 'K2P').map((f) => f.item))
const report = {
  checked_at: new Date().toISOString(),
  exposed_items: latest.size,
  kice_items: [...latest.keys()].filter((id) => isKiceExam(id)).length,
  hakpyeong_items: [...latest.keys()].filter((id) => !isKiceExam(id)).length,
  with_skeleton_json: [...latest.keys()].filter((id) => skeleton.has(id)).length,
  with_lecture: [...latest.keys()].filter((id) => lectures.has(id)).length,
  by_code: byCode,
  severe_items: severe.size,
  review_candidates: review.size,
  findings: findings.sort((a, b) => a.code.localeCompare(b.code) || a.item.localeCompare(b.item)),
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
console.log(`노출 문항 ${report.exposed_items}(평가원 ${report.kice_items} · 학평 ${report.hakpyeong_items}) · 골격 JSON ${report.with_skeleton_json} · 강의 ${report.with_lecture}`)
console.log(`검사 결과: ${Object.entries(byCode).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'} · 확정 결함(K1·K4·H1) 문항 ${severe.size} · 확인 필요 후보(K2P) ${review.size}`)
console.log(`→ ${path.relative(ROOT, OUT)}`)
