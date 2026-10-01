// scripts/knowledge/claims-import.mjs
// 검토가 끝난 **주장 단위** 파일(jsonl) → 학습 원리 등록부 「추출됨」 공부법 항목 + 근거. 기본은 미리보기.
// 계약·검증: ./claims-lib.mjs · 형식 설명: docs/methodology/claim-extraction.md
//
// 받는 줄: verdict 'import' + 검증 통과. 그 밖의 줄(hold·exclude·검증 실패)은 사유와 함께 세기만 한다.
// 재실행 안전: slug = 'yt-' + sha1(claimId) 앞 12자. 이미 있는 항목은 **건너뛴다** — 사람이 바꾼 판정·문장을 덮지 않고,
//   근거도 그 항목을 새로 만든 실행에서만 붙인다.
// 귀속: 주장 종류로 정한다(권고 stated · 관찰 observed · 추론 inferred). DB 가 observed 를 아직 받지 않으면
//   관찰 주장은 적재하지 않고 보고한다(권고로 바꿔 넣지 않는다).
// 사용: node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/claims-import.mjs <claims.jsonl> <출력 폴더> [--commit] [--observed-ok]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../lib/supabase-client.mjs'
import { KIND_ATTRIBUTION, UNSPECIFIED, composeStatement, formatSegment, validateClaim } from './claims-lib.mjs'

const [file, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')
if (!file || !outDir) {
  console.error('사용: node --env-file=<.env.local> scripts/knowledge/claims-import.mjs <claims.jsonl> <출력 폴더> [--commit]')
  process.exit(2)
}

const ACTOR = 'drain:yt-claims'
const NL = String.fromCharCode(10)
const db = createScriptClient()

// 분류 축 — 최신 가져오기 스냅샷(methodology_taxonomy). 못 읽으면 검증할 수 없으니 멈춘다.
const { data: batch, error: e1 } = await db.from('methodology_batches').select('id').order('created_at', { ascending: false }).limit(1)
if (e1 || !batch?.length) throw new Error('분류 축을 읽지 못했다 — 검증 없이 적재하지 않는다')
const { data: taxRows, error: e2 } = await db.from('methodology_taxonomy').select('id,dimension').eq('batch_id', batch[0].id)
if (e2 || !taxRows?.length) throw new Error('분류 축이 비었다')
const taxonomy = new Map(taxRows.map((t) => [t.id, t.dimension]))

// DB 가 observed 귀속을 받는가 — REST 로는 CHECK 제약을 못 읽는다. 마이그레이션 적용을 확인한 사람이
// --observed-ok 로 켠다. 꺼져 있으면 관찰 주장은 적재하지 않고 보고만 한다(권고로 바꿔 넣지 않는다).
const observedSupported = process.argv.includes('--observed-ok')

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const rows = lines.map((line, i) => {
  let raw
  try {
    raw = JSON.parse(line)
  } catch {
    return { line: i + 1, outcome: '검증 실패', errors: ['JSON 이 아니다'] }
  }
  const v = validateClaim(raw, taxonomy)
  if (!v.ok) return { line: i + 1, claimId: raw.claimId, outcome: '검증 실패', errors: v.errors }
  if (raw.verdict !== 'import') return { line: i + 1, claimId: raw.claimId, outcome: raw.verdict === 'hold' ? '보류' : '제외', reason: raw.reason }
  const attribution = KIND_ATTRIBUTION[raw.kind]
  if (attribution === 'observed' && !observedSupported) {
    return { line: i + 1, claimId: raw.claimId, outcome: '보류', reason: 'DB 가 수업 진행 관찰(observed) 귀속을 아직 받지 않는다 — 마이그레이션 후 재실행' }
  }
  const axis = (x) => (x === UNSPECIFIED ? [] : x)
  const t = raw.segment ? `&t=${Math.floor(raw.segment.startSec)}s` : ''
  return {
    line: i + 1,
    claimId: raw.claimId,
    outcome: '적재 후보',
    item: {
      layer: 'practice',
      slug: 'yt-' + crypto.createHash('sha1').update(raw.claimId).digest('hex').slice(0, 12),
      title: raw.method.trim().slice(0, 120),
      // 자르지 않는다 — 길이는 검증(claims-lib)이 이미 막았다. 잘린 문장이 들어가면 재실행으로 못 고친다
      statement: composeStatement(raw),
      skill_ids: axis(raw.skill),
      condition_ids: [...axis(raw.audience), ...axis(raw.conditions)],
      status: 'extracted',
      created_by: ACTOR,
      updated_by: ACTOR,
    },
    evidence: {
      grade: raw.grade,
      attribution,
      source_type: 'external',
      external_url: `https://www.youtube.com/watch?v=${raw.videoId}${t}`,
      external_title: `YouTube ${raw.videoId} · ${raw.claimId}`,
      locator: raw.segment ? formatSegment(raw.segment) : null,
      note: [
        raw.segment ? `구간 재서술: ${raw.segment.paraphrase.trim()}` : '위치 미대조',
        `검토 범위: ${raw.reviewScope === 'full' ? '전체 열람' : '발췌 검토'}`,
        `검토자: ${raw.reviewer}`,
      ].join(' · ').slice(0, 1000),
      created_by: ACTOR,
    },
  }
})

const tally = rows.reduce((m, r) => ((m[r.outcome] = (m[r.outcome] ?? 0) + 1), m), {})
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'claims-import-preview.json'), JSON.stringify({ file, rows }, null, 2))
console.log(`주장 ${rows.length}줄 — ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(' · ')}`)
for (const r of rows.filter((x) => x.outcome === '검증 실패').slice(0, 10)) console.log(`  ${r.line}행 ${r.claimId ?? ''}: ${r.errors.join(' / ')}`)

if (!COMMIT) {
  console.log('미리보기 끝 — 검토 후 --commit')
  process.exit(0)
}

let created = 0
let skipped = 0
for (const r of rows.filter((x) => x.outcome === '적재 후보')) {
  // 항목과 근거를 한 트랜잭션으로(knowledge_import_claim, 20261001130000). 근거가 실패하면 항목도 되돌려져
  // 「근거 없는 항목이 남고 재실행이 그걸 건너뛰어 영영 복구 안 되는」 상태가 생기지 않는다(Codex P1).
  const { data: outcome, error } = await db.rpc('knowledge_import_claim', { p_item: r.item, p_evidence: r.evidence })
  if (error) throw new Error(`적재 실패 ${r.claimId}: ${error.message} — 이 주장은 항목·근거 모두 들어가지 않았다(재실행 안전)`)
  if (outcome === 'exists') skipped += 1 // 사람이 이미 판정·수정했을 수 있다 — 덮지 않는다
  else if (outcome === 'created') created += 1
  else throw new Error(`알 수 없는 적재 결과 ${r.claimId}: ${String(outcome)}`)
}
console.log(`적재 — 새 항목 ${created} · 이미 있어 건너뜀 ${skipped}${NL}`)
