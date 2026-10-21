// scripts/textbook/factory-dcp-reuse.mts
//
// 04 기존 DCP 재사용 — 오프라인 준비 · 미리보기 CLI. 판단 로직은 apps/web/src/lib/csat/map/v62/factory-bridge/dcp-reuse.ts.
// 공유 DB · 네트워크 없음. 파일만 읽고 새 파일만 쓴다(덮어쓰지 않음 · 중간 실패 시 이번 실행이 만든 파일만 지운다).
//
//   tsx --tsconfig apps/web/tsconfig.scripts.json scripts/textbook/factory-dcp-reuse.mts <command> ...
//
//   prepare-observed-case --packet <file> --output <file> --legacy <file> --slots <file> --source <file> --out <new-dir>
//       읽기 전용 관측 파일(기존 행 payload/answer_key + 자리)로 원래 출력의 같은 유형 문항을 기존 행에 맞춘 출력을 만든다.
//       <new-dir>: adapted-output.json · reuse-mapping.json · existing-rows.observed.json · review-request.json.
//       review-request 는 검수 target(existing_rows 포함)과 기존 행 원문 · 원래 출력 · 맞춘 출력을 함께 담는다. 검수 결론은 만들지 않는다.
//   preview --packet <file> --output <file> --review <file> --source <file> --legacy <file> --slots <file> --mapping <file> [--rights <file>]
//       오프라인 미리보기(파일 행 기준 — 서버 SELECT 가 아니다). 실제 미리보기 · 입고는 관리자 API preview_reuse/admit_reuse.
//
// 종료 코드: 0 성공 · 1 검증 거절 · 2 인자 오류.

import { mkdirSync, readFileSync, existsSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

import { NewFileError, newFileSet } from './factory-order-draft.mjs'

import { LocalProductionError, checkPacketIntegrity, itemDigest, sha256Hex, validateOutput, type ProductionOutput } from '../../apps/web/src/lib/csat/map/v62/factory-bridge/local-production'
import {
  adaptOutputToExisting, parseReuseMapping, planExistingDcpReuse, projectExistingRow, reuseReviewTarget, type ExistingDcpRow, type ReuseMapping,
} from '../../apps/web/src/lib/csat/map/v62/factory-bridge/dcp-reuse'

const args = process.argv.slice(2)
const cmd = args[0]
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i > 0 ? args[i + 1] : undefined }
const need = (k: string) => { const v = opt(k); if (!v) { console.error(`--${k} 필요`); process.exit(2) } return v }
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as unknown
const fileBytes = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`

/** 관측 파일 두 개를 기존 행 모양으로 — 자리(paragraph_idx · item_role)는 slots 파일에서만 가져온다(추정하지 않는다) */
function observedRows(legacyPath: string, slotsPath: string): ExistingDcpRow[] {
  const legacy = readJson(legacyPath) as { source_id: string; rows: { id: string; type: string; payload: Record<string, unknown>; answer_key: Record<string, unknown> }[] }
  const slots = readJson(slotsPath) as { source_id: string; rows: { id: string; type: string; paragraph_idx: number; item_role: string }[] }
  if (legacy.source_id !== slots.source_id) throw new LocalProductionError('observed_source_mismatch')
  return legacy.rows.map((r) => {
    const s = slots.rows.find((x) => x.id === r.id)
    if (!s || s.type !== r.type) throw new LocalProductionError('observed_slot_missing', [r.id])
    return { id: r.id, kind: 'article', ref_id: legacy.source_id, type: r.type, paragraph_idx: s.paragraph_idx, item_role: s.item_role, payload: r.payload, answer_key: r.answer_key }
  })
}

function prepare() {
  const packet = checkPacketIntegrity(readJson(need('packet')))
  const original = readJson(need('output')) as ProductionOutput
  const origErr = validateOutput(packet, original)
  if (origErr.length) throw new LocalProductionError('output_invalid', origErr)
  const rows = observedRows(need('legacy'), need('slots'))
  const source = readJson(need('source'))
  const outDir = need('out')
  if (existsSync(outDir)) { console.error(`이미 있음: ${outDir}`); process.exit(2) }
  // 같은 유형의 문항 ↔ 기존 행(유형당 하나일 때만 — 모호하면 거절)
  const mapping: ReuseMapping[] = rows.map((r) => {
    const its = original.items.filter((i) => i.type === r.type)
    if (its.length !== 1) throw new LocalProductionError('reuse_mapping_ambiguous', [r.type])
    return { item_id: its[0]!.id, dcp_item_id: r.id }
  })
  parseReuseMapping(mapping)
  const adapted = adaptOutputToExisting(original, mapping, rows, packet.body.source.content)
  const advErr = validateOutput(packet, adapted)
  if (advErr.length) throw new LocalProductionError('adapted_output_invalid', advErr)
  const adaptedBytes = fileBytes(adapted)
  const b = packet.body
  const target = reuseReviewTarget({
    source_digest: b.source.source_digest, output_sha256: sha256Hex(adaptedBytes), order_hash: b.order.order_hash, packet_hash: packet.packet_hash,
    role: b.request.role, task: b.request.task, items: adapted.items.map((it) => ({ item_id: it.id, item_sha256: itemDigest(it) })),
  }, mapping, rows)
  const request = {
    schema: 'vf.dcp-reuse-review-request/1',
    lineage: packet.body.synthetic_demand ? 'synthetic_lineage_candidate_not_live_admissible' : 'registered_order_candidate',
    instructions: [
      '독립 AI 검수 — vf.dcp-ai-review/1 형식으로 쓰고 target 은 아래 review_target 을 그대로 옮긴다(existing_rows 포함).',
      '기존 행(existing_rows_actual)의 payload · answer_key 는 재사용되면 학습자에게 그대로 간다 — 저장된 해설(rationale_ko)의 충분성을 맞춘 출력의 해설과 따로 판단한다.',
      'title 행 passage 는 원문 앞부분 발췌다(passage_scope 참고). 발췌만으로 제목 · 정답이 성립하는지 본다.',
      'F(권리)는 pass 로 쓰지 않는다. 판단하지 못한 축은 unknown. 결론 · 축 판단은 검수자만 쓴다 — 이 요청은 결론을 포함하지 않는다.',
    ],
    review_target: target,
    existing_rows_actual: rows.map((r) => ({ ...projectExistingRow(r), passage_scope: r.payload.passage && b.source.content.replace(/\s+/g, ' ').trim() === String(r.payload.passage).replace(/\s+/g, ' ').trim() ? 'full' : 'excerpt' })),
    original_output_items: original.items,
    adapted_output_items: adapted.items,
    source: { id: b.source.id, content_sha256: b.source.content_sha256, source_digest: b.source.source_digest, content: b.source.content },
    source_snapshot_sha256: sha256Hex(fileBytes(source)),
    observed_from_files: true,
    claims: { reviewed: false, admitted: false, database_writes: 0 },
  }
  mkdirSync(outDir)
  const files = newFileSet()
  try {
    files.write(join(outDir, 'adapted-output.json'), adaptedBytes)
    files.write(join(outDir, 'reuse-mapping.json'), fileBytes(mapping))
    files.write(join(outDir, 'existing-rows.observed.json'), fileBytes(rows))
    files.write(join(outDir, 'review-request.json'), fileBytes(request))
  } catch (e) {
    files.rollback()
    try { rmdirSync(outDir) } catch { /* 비어 있지 않으면 남긴다 */ }
    throw e
  }
  console.log(JSON.stringify({ ok: true, out: outDir, adapted_output_sha256: target.output_sha256, existing_rows: target.existing_rows }, null, 2))
}

function preview() {
  const outPath = need('output')
  const outputBytes = readFileSync(outPath, 'utf8')
  const plan = planExistingDcpReuse({
    packet: readJson(need('packet')), output: JSON.parse(outputBytes), outputSha256: sha256Hex(outputBytes), review: readJson(need('review')),
    currentSource: readJson(need('source')), rights: opt('rights') ? (readJson(opt('rights')!) as { record_id: string; basis: string }) : null,
    reuse: parseReuseMapping(readJson(need('mapping'))), existingRows: observedRows(need('legacy'), need('slots')),
  })
  console.log(JSON.stringify({ basis: 'offline_file_rows_not_server_select', writes: 'not_performed', plan }, null, 2))
}

try {
  if (cmd === 'prepare-observed-case') prepare()
  else if (cmd === 'preview') preview()
  else { console.error('명령: prepare-observed-case | preview'); process.exit(2) }
} catch (e) {
  if (e instanceof LocalProductionError || e instanceof NewFileError) {
    console.error(JSON.stringify({ ok: false, code: (e as { code: string }).code, detail: (e as { detail?: string[] }).detail ?? [] }))
    process.exit(1)
  }
  throw e
}
