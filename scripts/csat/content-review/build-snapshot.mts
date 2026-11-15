// scripts/csat/content-review/build-snapshot.mts
//
// **F1 검수 후보 스냅샷 빌더** — 연구 브랜치 산출물(읽기 전용) + 강의 원본 + DB(SELECT 만)를 묶어
// `apps/web/src/lib/csat/content-review/data/snapshot.json` 하나로 만든다. 재실행 안전(같은 입력 → 같은 출력).
//
// 입력:
//   --c <dir>       대량작업 C 산출물(lecture-audit-c-20261024)
//   --e <dir>       대량작업 E 산출물(csat-learning-eval-20261024)
//   --hashes <file> DB 해시 질의 결과(아래 HASH_SQL 을 SELECT 로 돌린 rows) — md5 는 Postgres jsonb::text 기준이라 JS 로 재현하지 않는다
//   --env <file>    본문 조회용 env 파일(service role). 값은 출력하지 않는다
// 실행: NODE_OPTIONS=--tls-max-v1.2 pnpm exec tsx scripts/csat/content-review/build-snapshot.mts --c … --e … --hashes … --env …
//
// HASH_SQL(대량작업 C 00_BRIEF 와 같은 공식):
//   item = md5(coalesce(stem,'')||coalesce(passage,'')||coalesce(choices::text,''))
//   analysis = md5(choice_analysis::text||coalesce(answer_locus::text,''))  -- 최신 published

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

import { buildRelations, candidateId, dedupeCandidates } from '../../../apps/web/src/lib/csat/content-review/candidates'
import type {
  CandidateSource, DefectKind, ProposedChange, ReviewCandidate, ReviewTrack, RevisionBinding,
} from '../../../apps/web/src/lib/csat/content-review/types'
import { splitSentences } from '../../../apps/web/src/lib/csat/passage-skeleton'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = join(ROOT, 'apps/web/src/lib/csat/content-review/data/snapshot.json')

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || !process.argv[i + 1]) throw new Error(`--${name} 가 필요하다`)
  return process.argv[i + 1]!
}
const C = arg('c')
const E = arg('e')
const HASHES = JSON.parse(readFileSync(arg('hashes'), 'utf8')) as { rows: [string, number[], string, number, string][] }
dotenv.config({ path: arg('env') })

const readLines = (p: string) => readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const jsonl = (p: string) => readLines(p).map((l) => JSON.parse(l) as Record<string, any>)
const cells = (line: string) => line.split('|').slice(1, -1).map((s) => s.trim())
const strip = (s: string) => s.replace(/\*\*/g, '').trim()

function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

// ── 강의 원본 ────────────────────────────────────────────
interface Lecture { item_id: string; version: number; cues: { id: string; role: string; target: { kind: string; id: string }; segments: { text: string }[] }[] }
const LECTURES = new Map<string, Lecture>()
const LDIR = join(ROOT, 'apps/web/src/lib/csat/lecture-data')
for (const f of readdirSync(LDIR).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const d = JSON.parse(readFileSync(join(LDIR, f), 'utf8')) as { lectures: Record<string, Lecture> }
  for (const l of Object.values(d.lectures)) LECTURES.set(l.item_id, l)
}
const lectureHash = (l: Lecture) => createHash('sha256').update(canonicalJson(l), 'utf8').digest('hex').slice(0, 16)

// ── 현재 판본 결속 ───────────────────────────────────────
const DB = new Map(HASHES.rows.map(([id, answers, im, av, am]) => [id, { answers, im, av, am }]))
function bindingOf(itemId: string): RevisionBinding {
  const h = DB.get(itemId)
  if (!h) throw new Error(`해시 없음: ${itemId}`)
  const l = LECTURES.get(itemId)
  return { itemId, itemMd5: h.im, analysisVersion: h.av, analysisMd5: h.am, lectureVersion: l?.version ?? null, lectureHash: l ? lectureHash(l) : null }
}

// ── C 인계표 ─────────────────────────────────────────────
const DEFECT: [RegExp, DefectKind][] = [
  [/사실과 다른 소거/, 'false_elimination'],
  [/사실과 다른 함정/, 'false_trap'],
  [/35번 강조|낭독↔근거/, 'emphasis_binding'],
  [/정리 규칙/, 'overgeneralized_rule'],
  [/추출 오류/, 'extraction_error'],
  [/설명/, 'explanation_error'],
]
const defectOf = (s: string): DefectKind => DEFECT.find(([re]) => re.test(s))?.[1] ?? 'explanation_error'

/** f2/R*.md 의 `| 문항 | cN | …` 행 → 변경. 35번 행은 「현재 target → 제안 target」 */
function draftRows(file: string): Map<string, ProposedChange[]> {
  const out = new Map<string, ProposedChange[]>()
  for (const line of readLines(join(C, file))) {
    if (!line.startsWith('|')) continue
    const c = cells(line)
    const cue = /^(c\d+)(.*)$/.exec(c[1] ?? '')
    if (c.length < 6 || !cue) continue
    // 「c13 (+c3)」 — 함께 고칠 cue 는 현재 문안 앞에 남긴다(검수자가 본다)
    const extra = cue[2]!.trim() ? `[함께 볼 cue ${cue[2]!.trim()}] ` : ''
    const anchorMove = /^sentence:\d+$/.test(c[3]!)
    const ch: ProposedChange = anchorMove
      ? { target: `cue:${cue[1]}`, current: `${extra}target ${c[3]} · ${strip(c[4]!)}`, proposed: `target ${strip(c[5]!)}`, draftRef: `lecture-audit-c-20261024/${file}` }
      : { target: `cue:${cue[1]}`, current: `${extra}${strip(c[3]!)}`, proposed: strip(c[4]!), draftRef: `lecture-audit-c-20261024/${file}` }
    const k = c[0]!
    out.set(k, [...(out.get(k) ?? []), ch])
  }
  return out
}
const DRAFTS = new Map<string, ProposedChange[]>()
for (const f of ['f2/R1.md', 'f2/R2.md', 'f2/R3.md']) for (const [k, v] of draftRows(f)) DRAFTS.set(`${f}|${k}`, v)

function jsonlChanges(file: string, itemId: string): ProposedChange[] {
  const rows = jsonl(join(C, file)).filter((r) => r.item_id === itemId)
  const out: ProposedChange[] = []
  for (const r of rows) {
    for (const is of (r.issues ?? []) as any[]) {
      for (const cue of is.cue_ids ?? []) out.push({ target: `cue:${cue}`, current: String(is.misconception ?? ''), proposed: is.fix_candidate ?? null, draftRef: `lecture-audit-c-20261024/${file}` })
    }
    for (const ce of (r.content_errors ?? []) as any[]) {
      out.push({ target: `cue:${ce.cue_id}`, current: String(ce.said ?? ''), proposed: ce.official ? `공식 원문: ${ce.official}` : null, draftRef: `lecture-audit-c-20261024/${file}` })
    }
  }
  return out
}

const OT = new Map<string, Record<string, any>>()
for (const f of ['g/OT1.jsonl', 'g/OT2.jsonl']) for (const r of jsonl(join(C, f))) OT.set(r.item_id, r)

const mismatches: string[] = []
const raw: ReviewCandidate[] = []
function push(c: Omit<ReviewCandidate, 'id'>) {
  raw.push({ ...c, id: candidateId(c) })
}

for (const line of readLines(join(C, 'g/C_CONTENT_REVIEW_30.md'))) {
  const c = cells(line)
  if (c.length !== 11 || !(/^\d+$/.test(c[0]!) || c[0] === '—')) continue
  const [no, itemId, defectText, aiPath, official, , , md5, anVer, draft] = c as string[]
  const b = bindingOf(itemId!)
  const recMd5 = md5!.replace(/`/g, '')
  if (!b.itemMd5.startsWith(recMd5)) mismatches.push(`${itemId}: item md5 C=${recMd5} 현재=${b.itemMd5.slice(0, 8)}`)
  const recVer = Number(/v(\d+)/.exec(anVer!)?.[1])
  if (recVer !== b.analysisVersion) mismatches.push(`${itemId}: 분석 v C=${recVer} 현재=${b.analysisVersion}`)

  const draftFile = draft!.trim()
  let changes: ProposedChange[] = draftFile.endsWith('.md')
    ? DRAFTS.get(`${draftFile}|${itemId}`) ?? []
    : jsonlChanges(draftFile, itemId!)
  if (!changes.length) changes = [{ target: 'item', current: defectText!, proposed: null, draftRef: `lecture-audit-c-20261024/${draftFile}` }]
  const tracks: ReviewTrack[] = ['lecture_cue']
  if (changes.some((x) => x.target.startsWith('analysis:'))) tracks.push('explanation')
  const ot = OT.get(itemId!)
  push({
    itemId: itemId!,
    source: (no === '—' ? 'C_HOLD' : 'C_HANDOFF_30') as CandidateSource,
    sourceRef: no === '—' ? '보류' : `인계 #${no}`,
    defect: defectOf(defectText!),
    tracks,
    binding: b,
    changes,
    officialText: {
      verdict: official!.startsWith('TEXT_MATCH') ? 'TEXT_MATCH' : official!.startsWith('TEXT_DIFF') ? 'TEXT_DIFF' : 'NOT_CHECKED',
      note: official!.includes('—') ? official!.split('—').slice(1).join('—').trim() : ot?.checker ?? null,
    },
    officialAnswers: DB.get(itemId!)!.answers,
    officialAnswerBasis: 'db_only',
    aiEvidence: [aiPath!],
    note: null,
  })
}

// C 기록 강의 버전과 현재 강의 원본 대조(F1/F3/F5 jsonl 에 lecture_version 이 있다)
for (const f of readdirSync(join(C, 'f3')).filter((f) => f.endsWith('.jsonl'))) {
  for (const r of jsonl(join(C, 'f3', f))) {
    const l = LECTURES.get(r.item_id)
    if (raw.some((x) => x.itemId === r.item_id) && l && r.lecture_version != null && l.version !== r.lecture_version) {
      mismatches.push(`${r.item_id}: 강의 v C(f3/${f})=${r.lecture_version} 현재=${l.version}`)
    }
  }
}

// ── 2015#25 복수정답(drain 후속 F3) ─────────────────────
{
  const itemId = '2015#25'
  const l = LECTURES.get(itemId)
  const cueText = (id: string) => l?.cues.find((c) => c.id === id)?.segments.map((s) => s.text).join(' ') ?? ''
  const changes: ProposedChange[] = ['c1', 'c2', 'c9', 'c11', 'c12'].map((id) => ({
    target: `cue:${id}`, current: cueText(id), proposed: null, draftRef: 'docs/csat-learner/drain-followup-20261024/F3_2015_25_MULTI_ANSWER.md',
  }))
  changes.push({ target: 'analysis:reject:5', current: '⑤ verdict distractor — 공식 판정(⑤도 정답)과 반대', proposed: null, draftRef: 'docs/csat-learner/drain-followup-20261024/F3_2015_25_MULTI_ANSWER.md' })
  push({
    itemId, source: 'DRAIN_MULTI_ANSWER', sourceRef: 'F3 복수정답', defect: 'official_answer_conflict',
    tracks: ['official_answer', 'explanation', 'lecture_cue'], binding: bindingOf(itemId), changes,
    officialText: { verdict: 'NOT_CHECKED', note: '평가원 1차 원문 미확보 — 보도 4곳 일치(2014-11-24)' },
    officialAnswers: [4, 5], officialAnswerBasis: 'press_verified', aiEvidence: ['drain 후속 F3 조사(1인)'],
    note: 'DB answers=[4,5] · 분석 v5·강의 v3 는 단일 정답 ④ 전제 · 제안 문안 없음(작성 필요)',
  })
}

// ── E T-0149 결정 근거 gold 18 ───────────────────────────
{
  const agg = JSON.parse(readFileSync(join(E, 'review/aggregate-AB.json'), 'utf8')) as { rows: any[] }
  for (const r of agg.rows.filter((r) => r.evidence?.agree)) {
    push({
      itemId: r.item_id, source: 'E_T0149_GOLD', sourceRef: `T-0149 ${r.role}`, defect: 'evidence_gold',
      tracks: ['evidence_gold'], binding: bindingOf(r.item_id),
      changes: [{ target: 'gold:decisive', current: `A ${JSON.stringify(r.evidence.a)} · B ${JSON.stringify(r.evidence.b)}`, proposed: `결정 근거 문장 ${JSON.stringify(r.evidence.gold)}`, draftRef: 'csat-learning-eval-20261024/review/aggregate-AB.json' }],
      officialText: { verdict: 'NOT_CHECKED', note: `원문 게이트 A=${r.original?.a} B=${r.original?.b} (미반영 0.65<0.85)` },
      officialAnswers: DB.get(r.item_id)!.answers, officialAnswerBasis: 'db_only',
      aiEvidence: ['Claude A + Codex B 교집합'], note: `Jaccard ${r.evidence.jaccard}`,
    })
  }
}

const { kept, merged } = dedupeCandidates(raw)
const relations = buildRelations(kept)

// ── 비교 화면용 본문 ─────────────────────────────────────
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const ids = [...new Set(kept.map((c) => c.itemId))]
const { data: rows, error } = await db.from('csat_items').select('id, stem, passage, choices, answers').in('id', ids)
if (error) throw new Error(`csat_items 조회 실패: ${error.message}`)
const { data: an, error: e2 } = await db.from('csat_item_analyses').select('item_id, version, choice_analysis, design_intent, status').in('item_id', ids).eq('status', 'published')
if (e2) throw new Error(`csat_item_analyses 조회 실패: ${e2.message}`)

const items: Record<string, unknown> = {}
for (const id of ids.sort()) {
  const r = (rows ?? []).find((x: any) => x.id === id) as any
  if (!r) throw new Error(`문항 없음: ${id}`)
  const latest = (an ?? []).filter((x: any) => x.item_id === id).sort((a: any, b: any) => b.version - a.version)[0] as any
  const passage = String(r.passage ?? '')
  const l = LECTURES.get(id)
  items[id] = {
    stem: r.stem ?? '',
    passageSentences: splitSentences(passage).map((s) => passage.slice(s.start, s.end).trim()),
    choices: (Array.isArray(r.choices) ? r.choices : []).map((c: any) => (typeof c === 'string' ? c : String(c?.text ?? c))),
    officialAnswers: r.answers ?? null,
    analysis: latest
      ? {
          version: latest.version,
          answer: (r.answers ?? [])[0] ?? null,
          choiceVerdicts: (latest.choice_analysis ?? []).map((x: any) => ({ n: x.n, verdict: x.verdict, howToReject: x.how_to_reject ?? x.why ?? '' })),
          intent: latest.design_intent ?? undefined,
        }
      : null,
    cues: (l?.cues ?? []).map((c) => ({ id: c.id, role: c.role, target: `${c.target.kind}:${c.target.id}`, text: c.segments.map((s) => s.text).join(' ') })),
  }
}

const currentBindings = Object.fromEntries(ids.map((id) => [id, bindingOf(id)]))
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()
const snapshot = {
  schema: 'content-review-snapshot/1',
  generatedFrom: {
    worktreeHead: commit,
    cAssets: 'research/csat-lecture-audit-c-20261024 · docs/csat-learner/lecture-audit-c-20261024',
    eAssets: 'research/csat-learning-eval-20261024 · review/aggregate-AB.json',
    multiAnswer: 'docs/csat-learner/drain-followup-20261024/F3_2015_25_MULTI_ANSWER.md',
    dbHashes: 'SELECT 만 — 공식은 이 파일 머리말',
    humanApprovals: 0,
  },
  counts: Object.fromEntries(['C_HANDOFF_30', 'C_HOLD', 'DRAIN_MULTI_ANSWER', 'E_T0149_GOLD'].map((s) => [s, kept.filter((c) => c.source === s).length])),
  merged,
  bindingMismatches: mismatches,
  candidates: kept,
  relations,
  currentBindings,
  items,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 1)}\n`, 'utf8')
console.log(JSON.stringify({ counts: snapshot.counts, merged: merged.length, relations: relations.reduce((m: Record<string, number>, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + 1 }), {}), mismatches }, null, 1))
