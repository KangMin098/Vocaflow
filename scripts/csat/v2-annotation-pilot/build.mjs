// scripts/csat/v2-annotation-pilot/build.mjs
// V2(문맥 의미 선택) 주석 파일럿 — 표본 12문항의 원문 · 정답 · 골격 · 밑줄 위치를 읽기 전용으로 다시 검증하고,
// Claude 초안을 ContextualSenseAnnotation 모양(DRAFT)으로 굽고, 맹검 입력을 초안과 분리해 만든다.
//
// 입력(커밋 안 함): private/claude-drafts.json — 정답 키 · 뜻 선택지 · 배제 이유 · 근거 문장
// 출력(커밋 안 함): private/annotations/*.draft.json · private/blind/stage1-*.json · private/blind/stage2-*.json
// 출력(커밋):       LEDGER.json — 문항 · revision · 골격 서명 · 밑줄 문장 번호 · 검증 결과(불리언) · 파일 해시. 원문 · 정답 · 뜻은 없다.
//
// DB 는 읽기만 한다(csat_items select). 레지스트리 · import 목록 · 출시 원장은 건드리지 않는다. 재실행 안전.
// 실행: node --tls-max-v1.2 scripts/csat/v2-annotation-pilot/build.mjs [--env <path to .env.local>]
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const PRIV = path.join(HERE, 'private')
const envArg = process.argv.indexOf('--env')
const ENV_PATH = envArg > 0 ? process.argv[envArg + 1] : path.join(ROOT, 'apps/web/.env.local')

// 사전 등록 표본(선정 규칙은 README §1) — 바꾸면 LEDGER 가 달라진다
export const SAMPLE = {
  'R-VOCAB': ['2026#30', '2025#30', '2024#30', 'M2706#30', 'M2609#30', 'M2606#30'],
  'X-VOCAB': ['2026#42', '2025#42', '2024#42', 'M2706#42', 'M2609#42', 'M2606#42'],
}
const MARKS = { 'R-VOCAB': ['①', '②', '③', '④', '⑤'], 'X-VOCAB': ['(a)', '(b)', '(c)', '(d)', '(e)'] }
const VOCAB_STEM = /문맥상\s*낱말의\s*쓰임이\s*적절하지\s*않은/

const sha = (s) => createHash('sha256').update(s).digest('hex')
const slug = (id) => id.replace('#', '-').toLowerCase()
const readEnv = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))

/** 문항별 고정 시드 섞기 — 정답 뜻이 늘 첫 칸에 오지 않게 한다(초안은 0번에 썼다) */
function shuffleOrder(n, seed) {
  const order = [...Array(n).keys()]
  // 단계마다 해시를 새로 뽑는다 — 선형 합동 생성기의 낮은 비트는 시드와 무관하게 같은 순열을 낸다(전 문항 정답이 3번 칸에 몰렸다)
  for (let i = n - 1; i > 0; i--) { const j = parseInt(sha(`${seed}|${i}`).slice(0, 8), 16) % (i + 1); [order[i], order[j]] = [order[j], order[i]] }
  return order
}

function skeletonOf(id) {
  const exam = id.split('#')[0]
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data', `${exam}.json`), 'utf8'))
  const arr = Array.isArray(raw) ? raw : raw.items ? Object.values(raw.items) : Object.values(raw)
  return arr.find((x) => x.id === id) ?? null
}

/** 골격 문장 길이로 원문을 자른다 — 남는 글자(tail)가 0 이어야 골격과 원문이 맞물린 것이다 */
function splitBySkeleton(passage, lens) {
  let pos = 0
  const ranges = []
  for (const L of lens) { while (passage[pos] === ' ') pos++; ranges.push([pos, pos + L]); pos += L }
  return { ranges, tail: passage.length - pos }
}

const env = readEnv(ENV_PATH)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ids = [...SAMPLE['R-VOCAB'], ...SAMPLE['X-VOCAB']]
const { data: rows, error } = await sb.from('csat_items').select('id, type_id, answer, passage, stem, body_ok').in('id', ids)
if (error) throw new Error(`csat_items 조회 실패: ${error.message}`)
if (rows.length !== ids.length) throw new Error(`표본 ${ids.length}개 중 ${rows.length}개만 조회됨`)

const drafts = JSON.parse(fs.readFileSync(path.join(PRIV, 'claude-drafts.json'), 'utf8'))
fs.mkdirSync(path.join(PRIV, 'annotations'), { recursive: true })
fs.mkdirSync(path.join(PRIV, 'blind'), { recursive: true })

const ledger = []
let failures = 0
for (const id of ids) {
  const it = rows.find((r) => r.id === id)
  const d = drafts.items[id]
  const sk = skeletonOf(id)
  const lens = sk ? sk.sentences.map((s) => s.chars) : []
  const { ranges, tail } = splitBySkeleton(it.passage, lens)
  const marks = MARKS[it.type_id] ?? []
  const at = marks.map((m) => it.passage.indexOf(m))
  const targets = at.map((p) => ranges.findIndex(([a, b]) => p >= a && p < b))
  const n = lens.length
  const inRange = (s) => Number.isInteger(s) && s >= 0 && s < n

  const checks = {
    typeMatchesSample: SAMPLE[it.type_id]?.includes(id) === true,
    stemIsVocab: VOCAB_STEM.test(it.stem ?? ''),
    bodyOk: it.body_ok === true,
    officialAnswerValid: Number.isInteger(it.answer) && it.answer >= 1 && it.answer <= 5,
    skeletonFound: !!sk && sk.type_id === it.type_id,
    skeletonCoversPassage: !!sk && tail === 0,
    fiveMarkersOnceInOrder: marks.every((m) => it.passage.split(m).length === 2) && at.every((p, i) => i === 0 || p > at[i - 1]),
    targetsInSkeleton: targets.every(inRange),
    draftPresent: !!d,
    draftMisfitMatchesOfficial: !!d && d.misfit + 1 === it.answer,
    draftCueInRange: !!d && [...d.cue.sentences, ...d.cue.accepted].every(inRange),
    draftRejectWhyComplete: !!d && d.sense.options.every((_, i) => i === d.sense.correct || (d.sense.rejectWhy[String(i)] ?? '').trim().length > 0),
    draftOptionsDistinct: !!d && new Set(d.sense.options.map((o) => o.trim())).size === d.sense.options.length && d.sense.options.length >= 2 && d.sense.options.length <= 5,
  }
  const ok = Object.values(checks).every(Boolean)
  if (!ok) failures++

  const sourceRevision = sha(it.passage)
  const skeletonSig = sha(JSON.stringify(lens))
  let annotationHash = null
  let stage1Hash = null
  let stage2Hash = null
  if (d) {
    // 섞은 순서로 ContextualSenseAnnotation(DRAFT) 굽기 — rejectWhy 키도 새 번호로 옮긴다
    const order = shuffleOrder(d.sense.options.length, `${id}|${sourceRevision}`)
    const options = order.map((k) => d.sense.options[k])
    const correct = order.indexOf(d.sense.correct)
    const rejectWhy = Object.fromEntries(order.map((k, i) => [i, k]).filter(([, k]) => k !== d.sense.correct).map(([i, k]) => [String(i), d.sense.rejectWhy[String(k)]]))
    const ann = {
      version: 'contextual-sense.v1-draft',
      itemId: id,
      skeletonSig,
      sentenceCount: n,
      sourceRevision,
      officialAnswer: it.answer,
      targets,
      misfit: d.misfit,
      sense: { options, correct, rejectWhy },
      cue: { sentences: [...d.cue.sentences], accepted: [...d.cue.accepted], reviewed: false },
      review: { status: 'draft', annotator: drafts.annotator, independentReviewer: null, reviewerBlind: false, agreement: null, reviewedAt: null },
    }
    const annText = JSON.stringify(ann, null, 2) + '\n'
    fs.writeFileSync(path.join(PRIV, 'annotations', `contextual-sense-${slug(id)}.draft.json`), annText)
    annotationHash = sha(annText)

    // 맹검 1단계: 검수자는 원문을 DB 에서 직접 읽고 스스로 판별 · 뜻 · 근거를 쓴다. Claude 판정 · 선택지 · 정답 키 없음
    const stage1 = { itemId: id, typeId: it.type_id, sourceRevision, skeletonSig, sentenceCount: n, targets,
      sentenceRanges: ranges, task: 'stage1' }
    const s1 = JSON.stringify(stage1, null, 2) + '\n'
    fs.writeFileSync(path.join(PRIV, 'blind', `stage1-${slug(id)}.json`), s1)
    stage1Hash = sha(s1)
    // 맹검 2단계(1단계 제출 해시가 원장에 남은 뒤에만 연다): 섞인 뜻 선택지 — 정답 · 배제 이유 · Claude 근거 없음
    const stage2 = { itemId: id, sourceRevision, senseOptions: options, task: 'stage2' }
    const s2 = JSON.stringify(stage2, null, 2) + '\n'
    fs.writeFileSync(path.join(PRIV, 'blind', `stage2-${slug(id)}.json`), s2)
    stage2Hash = sha(s2)
  }

  ledger.push({ itemId: id, typeId: it.type_id, sourceRevision, skeletonSig, sentenceCount: n, targets,
    status: 'DRAFT', releasable: false, checks, allChecksPass: ok,
    files: { annotationDraftSha256: annotationHash, blindStage1Sha256: stage1Hash, blindStage2Sha256: stage2Hash } })
}

const out = {
  generatedBy: 'scripts/csat/v2-annotation-pilot/build.mjs',
  draftsSha256: sha(fs.readFileSync(path.join(PRIV, 'claude-drafts.json'))),
  sampleRule: 'README §1',
  counts: { selected: ledger.length, allChecksPass: ledger.length - failures, accepted: 0, releasable: 0, learnerAvailable: 0 },
  items: ledger,
}
fs.writeFileSync(path.join(HERE, 'LEDGER.json'), JSON.stringify(out, null, 2) + '\n')
for (const l of ledger) console.log(l.itemId.padEnd(9), l.allChecksPass ? 'PASS' : 'FAIL', Object.entries(l.checks).filter(([, v]) => !v).map(([k]) => k).join(','))
console.log(`검증 ${ledger.length - failures}/${ledger.length} · accepted 0 · releasable 0`)
if (failures) process.exit(1)
