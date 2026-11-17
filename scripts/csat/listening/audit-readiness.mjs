// scripts/csat/listening/audit-readiness.mjs
//
// CSAT 듣기 18유형 자료 준비도 감사(I1 교차 대조 · I2 출처/해시/권리 · I9 유형별 준비도).
// 로컬 파일만 읽는다. DB 는 읽지도 쓰지도 않는다 — DB 관측값은 아래 DB_OBSERVATION 에 기록된
// 읽기 전용 질의 결과(관측일 명시)를 그대로 싣는다. 시각은 --at 인자로만 받는다(로직에서 시계를 읽지 않는다).
//
//   node scripts/csat/listening/audit-readiness.mjs --at 2026-10-24T00:00:00Z [--out docs/csat-listening/readiness.json] [--check]
//
// --check: 파일을 쓰지 않고 현재 산출물과 다르면 exit 1.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const P = {
  classified: 'scripts/csat/data/classified.json',
  transcriptsDir: 'scripts/csat/data/listening',
  transcriptsAll: 'scripts/csat/data/listening-all.json',
  measure: 'scripts/csat/data/listening-measure.json',
  answers: 'scripts/csat/data/answers.json',
  answersManual: 'scripts/csat/data/answers-manual.json',
  approved: 'scripts/csat/map/source/listening-approved.json',
}

// 읽기 전용 질의(Supabase MCP execute_sql, 2026-10-24) 결과. 다시 재면 이 상수를 고친다.
export const DB_OBSERVATION = {
  observedAt: '2026-10-24',
  project: 'vocaflow-dev',
  queries: [
    'csat_items JOIN csat_exams WHERE no <= listening_end → 0',
    "csat_items WHERE section='듣기' → 0 (존재 section: 독해,장문 · min(no)=18)",
    "csat_types WHERE section='듣기' → 0",
  ],
  listeningItemRows: 0,
  listeningTypeRows: 0,
  csatItemsColumns: 'id,exam_id,no,section,in_scope,type_id,stem,passage,choices,answer,answers,points,high_score,body_ok,raw_block,created_at,official_error_rate,ebs_linked',
}

// 승인 정본(14종 한글) → 분류 코드. 1:1 이 아닌 것은 null(대조 불가로 기록).
export const APPROVED_TO_CODE = {
  목적: 'L-PURPOSE', 의견: 'L-OPINION', 요지: 'L-MAIN', '그림 내용 불일치': 'L-PICTURE', '할 일': 'L-TODO',
  '지불 금액': 'L-MONEY', 이유: 'L-REASON', '언급되지 않은 내용': 'L-NOTMENTION', '담화 내용 불일치': 'L-ANNOUNCE',
  '도표 선택': 'L-TABLE', '대화 응답': 'L-RESPONSE', '상황에 적절한 말': 'L-SITUATION', '세트 주제': 'L-SET-TOPIC',
  '세트 언급되지 않은 내용': 'L-SET-NOT',
}

const READY_MIN = 3 // 유형당 전사+정답 문항이 이만큼 있어야 READY_TRANSCRIPT

const pad = (n) => String(n).padStart(2, '0')
export const itemId = (exam, no) => `${exam}-L${pad(no)}`
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const norm = (s) => String(s ?? '').replace(/\s+/g, '').replace(/[“”"'’‘]/g, '')

function readJson(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel))
  return { buf, json: JSON.parse(buf.toString('utf8')) }
}

/** 순수 함수 — 입력 객체만으로 감사 결과를 만든다(테스트가 이것을 부른다). */
export function buildAudit(src, at) {
  const { classified, transcripts, answers, answersManual, approved, measure, fileHashes } = src
  const items = new Map()
  const get = (exam, no) => {
    const id = itemId(exam, no)
    if (!items.has(id)) items.set(id, { id, exam, no, sources: [] })
    return items.get(id)
  }
  const types = (classified.types ?? []).map((t) => t.id).filter((t) => t.startsWith("L-"))

  for (const r of classified.rows.filter((r) => String(r.type).startsWith('L-'))) {
    const it = get(r.exam, r.no)
    it.sources.push('classified')
    it.classifiedType = r.type
    it.classifiedSection = r.section
    it.stem = r.stem
    it.stemTruncated = !!r.stem_truncated
  }
  for (const t of transcripts) {
    const it = get(t.exam, t.no)
    it.sources.push('transcript')
    it.typeGuess = t.typeGuess
    it.transcriptStem = t.stem
    const turnsBuf = Buffer.from(JSON.stringify(t.turns))
    it.transcript = {
      present: true,
      source: `${P.transcriptsDir}/${t.exam}.json`,
      turns: t.turns.length,
      words: t.words ?? null,
      speakers: t.speakers ?? null,
      unknownSpeakerTurns: t.turns.filter((x) => x.who === '?').length,
      sha256: sha(turnsBuf),
      review: 'NOT_VERIFIED', // PDF 추출, 사람 대조 기록 없음
    }
  }
  const ansMap = new Map()
  const formOf = Object.fromEntries(answers.report.map((r) => [r.exam, r.form_used]))
  for (const a of answers.answers) ansMap.set(`${a.exam}#${a.no}`, { value: a.answer, values: a.answers, points: a.points, form: formOf[a.exam] ?? null, source: P.answers })
  for (const e of answersManual.entries) for (const [no, ans, pts] of e.rows) {
    const k = `${e.exam}#${no}`
    const prev = ansMap.get(k)
    if (prev && prev.value !== ans) (src._answerConflicts ??= []).push({ id: itemId(e.exam, no), auto: prev.value, manual: ans })
    if (!prev) ansMap.set(k, { value: ans, values: [ans], points: pts, form: e.form, source: P.answersManual })
  }
  const approvedMap = new Map()
  for (const e of approved.exams) for (const i of e.items) {
    approvedMap.set(itemId(e.examId, i.no), i.verifiedType)
    const it = get(e.examId, i.no)
    it.sources.push('approved')
    it.approvedType = i.verifiedType
  }

  const mismatches = []
  const out = []
  for (const it of [...items.values()].sort((a, b) => (a.exam < b.exam ? -1 : a.exam > b.exam ? 1 : a.no - b.no))) {
    const ans = ansMap.get(`${it.exam}#${it.no}`) ?? null
    const approvedCode = it.approvedType ? APPROVED_TO_CODE[it.approvedType] ?? null : null
    const type = it.classifiedType ?? approvedCode ?? it.typeGuess ?? null
    const typeSource = it.classifiedType ? 'classified' : approvedCode ? 'approved' : it.typeGuess ? 'typeGuess' : null
    if (it.classifiedType && it.typeGuess && it.classifiedType !== it.typeGuess)
      mismatches.push({ id: it.id, kind: 'TYPE_CLASSIFIED_VS_TYPEGUESS', a: it.classifiedType, b: it.typeGuess })
    if (it.classifiedType && approvedCode && it.classifiedType !== approvedCode)
      mismatches.push({ id: it.id, kind: 'TYPE_CLASSIFIED_VS_APPROVED', a: it.classifiedType, b: `${it.approvedType}(${approvedCode})` })
    if (it.stem && it.transcriptStem) {
      const a = norm(it.stem), b = norm(it.transcriptStem)
      if (!(a.startsWith(b) || b.startsWith(a))) mismatches.push({ id: it.id, kind: 'STEM_CLASSIFIED_VS_TRANSCRIPT', a: it.stem, b: it.transcriptStem })
    }
    if (it.classifiedSection && it.classifiedSection !== '듣기')
      mismatches.push({ id: it.id, kind: 'SECTION_LABEL', a: it.classifiedSection, b: '듣기(listening_end)' })
    if (it.transcript?.unknownSpeakerTurns) {
      const first = transcripts.find((t) => t.exam === it.exam && t.no === it.no).turns.find((x) => x.who === '?')
      if (/고르시오|가장 적절한/.test(first.text)) mismatches.push({ id: it.id, kind: 'STEM_SPILL_INTO_TURNS', a: first.text, b: 'who:"?" 첫 턴에 발문 조각' })
    }
    const mp = measure.perNo?.[it.no]
    if (it.typeGuess && mp && mp.type !== it.typeGuess)
      mismatches.push({ id: it.id, kind: 'MEASURE_PERNO_TYPE', a: mp.type, b: it.typeGuess })
    const rec = {
      id: it.id,
      exam: it.exam,
      no: it.no,
      type,
      typeSource,
      types: { classified: it.classifiedType ?? null, typeGuess: it.typeGuess ?? null, approved: it.approvedType ?? null },
      stem: it.stem ?? it.transcriptStem ?? null,
      sources: [...new Set(it.sources)].sort(),
      transcript: it.transcript ?? { present: false, review: 'DATA_GAP' },
      answer: ans ? { present: true, value: ans.value, values: ans.values, points: ans.points, form: ans.form, source: ans.source, formBinding: 'UNVERIFIED' } : { present: false },
      choices: { present: false, status: 'DATA_GAP' },
      audio: { present: false, source: null, sha256: null, rights: 'unverified', status: 'DATA_GAP' },
      dbLoaded: false,
    }
    rec.readyForUi = rec.transcript.present && rec.answer.present && rec.choices.present
    rec.dbLoadCandidate = rec.transcript.present && rec.answer.present
    out.push(rec)
  }

  const typeList = [...new Set([...types, ...out.map((r) => r.type).filter(Boolean)])].sort()
  const perType = typeList.map((t) => {
    const rs = out.filter((r) => r.type === t)
    const withT = rs.filter((r) => r.transcript.present).length
    const withTA = rs.filter((r) => r.transcript.present && r.answer.present).length
    const status = withT === 0 ? 'BLOCKED_EVIDENCE' : withTA >= READY_MIN ? 'READY_TRANSCRIPT' : 'PARTIAL'
    return {
      type: t,
      inClassified18: types.includes(t),
      items: rs.length,
      withTranscript: withT,
      withAnswer: rs.filter((r) => r.answer.present).length,
      withTranscriptAndAnswer: withTA,
      withChoices: rs.filter((r) => r.choices.present).length,
      withAudio: rs.filter((r) => r.audio.present).length,
      dbLoaded: rs.filter((r) => r.dbLoaded).length,
      status,
      readyIds: rs.filter((r) => r.transcript.present && r.answer.present).map((r) => r.id),
    }
  })

  return {
    schema: 'csat-listening-readiness/v1',
    generatedAt: at,
    rule: `READY_TRANSCRIPT = 전사+공식정답 ≥ ${READY_MIN} (선택지·음원은 전 유형 DATA_GAP 이라 조건에서 뺐다) · PARTIAL = 전사 있음, 그 미만 · BLOCKED_EVIDENCE = 전사 0`,
    inputs: fileHashes,
    db: DB_OBSERVATION,
    totals: {
      items: out.length,
      classified: out.filter((r) => r.sources.includes('classified')).length,
      transcripts: out.filter((r) => r.transcript.present).length,
      classifiedAndTranscript: out.filter((r) => r.sources.includes('classified') && r.transcript.present).length,
      approved: out.filter((r) => r.sources.includes('approved')).length,
      withAnswer: out.filter((r) => r.answer.present).length,
      withTranscriptAndAnswer: out.filter((r) => r.dbLoadCandidate).length,
      withChoices: 0,
      withAudio: 0,
      dbLoaded: 0,
    },
    answerConflicts: src._answerConflicts ?? [],
    mismatchCounts: mismatches.reduce((m, x) => ((m[x.kind] = (m[x.kind] ?? 0) + 1), m), {}),
    mismatches,
    perType,
    dbLoadCandidates: { applied: false, note: 'DB 적재는 별도 사용자 승인 필요. 선택지 미확보라 choices 는 NULL 로만 가능.', ids: out.filter((r) => r.dbLoadCandidate).map((r) => r.id) },
    items: out,
  }
}

export function loadSources() {
  const fileHashes = {}
  const rd = (rel) => { const { buf, json } = readJson(rel); fileHashes[rel] = sha(buf); return json }
  const transcripts = []
  for (const f of fs.readdirSync(path.join(ROOT, P.transcriptsDir)).filter((f) => f.endsWith('.json')).sort())
    transcripts.push(...rd(`${P.transcriptsDir}/${f}`))
  rd(P.transcriptsAll)
  return {
    classified: rd(P.classified),
    transcripts,
    measure: rd(P.measure),
    answers: rd(P.answers),
    answersManual: rd(P.answersManual),
    approved: rd(P.approved),
    fileHashes,
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null }
  const at = arg('--at')
  if (!at) { console.error('--at <ISO 시각> 필요(로직에서 시계를 읽지 않는다)'); process.exit(1) }
  const outRel = arg('--out') ?? 'docs/csat-listening/readiness.json'
  const audit = buildAudit(loadSources(), at)
  const text = JSON.stringify(audit, null, 2) + '\n'
  const outPath = path.join(ROOT, outRel)
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null
    const same = cur && JSON.stringify({ ...cur, generatedAt: at }) === JSON.stringify(audit)
    console.log(same ? 'readiness.json 최신' : 'readiness.json 낡음'); process.exit(same ? 0 : 1)
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, text)
  console.log(JSON.stringify(audit.totals), audit.mismatchCounts)
  for (const t of audit.perType) console.log(t.type.padEnd(14), t.items, t.withTranscript, t.withTranscriptAndAnswer, t.status)
}
