// scripts/textbook/factory-production-local.mts
//
// 단계 1B — 로컬 소량 제작 CLI. 판단 로직은 apps/web/src/lib/csat/map/v62/factory-bridge/local-production.ts 에 있고,
// 여기는 파일 읽기 · 쓰기 · 시계 · 실행 영수증만 맡는다. 공유 DB · 네트워크 · 패키지 설치 없음.
//
//   tsx --tsconfig apps/web/tsconfig.json scripts/textbook/factory-production-local.mts <command> ...
//
//   prepare-synthetic --out <file>
//       1A 정상 fixture(합성 수요 · 합성 정책 hash)로 **실제** prepareFactoryOrderDraft 를 돌려 draft_prepared 를 저장한다.
//       결과는 synthetic_demand=true 로 감싼다 — 실제 주문 · 등록이 아니다. --quantity 로 guided 줄 수량(기본 3).
//   export --prepared <file> --source <file> --request <file> --out <dir>
//       검증 후 <dir>/chunk-01.json(작업 패킷). 같은 입력이면 같은 task_id — 이미 같은 패킷이 있으면 재사용, 다르면 거절.
//   import --prepared <file> --source <file> --request <file> --packet <file> --output <file> --out <new-dir>
//       입력에서 패킷을 다시 만들어 파일과 대조 → 출력 검증 → <new-dir> 에 sheet.html · materials.json · manifest.json · receipt.json.
//       <new-dir> 이 이미 있으면 거절(덮어쓰지 않음). 중간 실패 시 이번 실행이 만든 파일만 지운다.
//   admission-plan --packet <file> --output <file> --review <file> --current-source <file> --out <new-file>
//       1C DCP 후보 등록 계획(dry-run · 파일만). DB 를 읽지도 쓰지도 않는다 — 원천 현재 행은 파일로 받는다.
//
// 종료 코드: 0 성공 · 1 검증 거절 · 2 인자 오류.

import { mkdirSync, readFileSync, rmdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { NewFileError, newFileSet, writeNewFile } from './factory-order-draft.mjs'

import {
  LocalProductionError,
  buildManifestRecord,
  buildMaterials,
  buildPacket,
  canonicalDigest,
  checkPacketIntegrity,
  renderSheet,
  sha256Hex,
  validateOutput,
  type ProductionOutput,
} from '../../apps/web/src/lib/csat/map/v62/factory-bridge/local-production'
import { planAdmission } from '../../apps/web/src/lib/csat/map/v62/factory-bridge/dcp-admission'

function args(argv: string[]) {
  const [command, ...rest] = argv
  const opts: Record<string, string> = {}
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i]
    const v = rest[i + 1]
    if (!k?.startsWith('--') || v === undefined || v.startsWith('--')) usage(`bad argument: ${k ?? ''}`)
    opts[k.slice(2)] = v
  }
  return { command, opts }
}
function usage(msg: string): never {
  console.error(`${msg}\nusage: factory-production-local.mts prepare-synthetic|export|import|admission-plan --flag value ...`)
  process.exit(2)
}
const need = (opts: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (!opts[k]) usage(`missing --${k}`)
  return keys.map((k) => resolve(opts[k]!))
}
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const fileSha = (path: string) => sha256Hex(readFileSync(path))
const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`

function rejected(error: unknown): never {
  if (error instanceof LocalProductionError) console.error(`REJECTED ${error.message}`)
  else console.error(`FAILED ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

async function prepareSynthetic(opts: Record<string, string>) {
  const [out] = need(opts, 'out')
  const n = Number(opts.quantity ?? '3')
  const fx = await import('../../apps/web/src/lib/admin/__tests__/factory-order-draft.fixture')
  const { prepareFactoryOrderDraft } = await import('../../apps/web/src/lib/admin/factory-order-draft')
  const lines = JSON.parse(fx.canonicalBody()).lines as Array<Record<string, unknown>>
  lines[2] = { ...lines[2], n }
  const canonical = fx.canonicalBody({ lines })
  const state = fx.fixtureState()
  state.line = { ...state.line!, quantity: n }
  state.demand = { ...state.demand!, canonical, signature: fx.sha(canonical) }
  const { reader, calls } = fx.stubReader(state)
  const result = await prepareFactoryOrderDraft(reader, { demand_line_id: fx.LINE, expected_signature: state.demand.signature, draft: fx.draftInput() as never }, fx.NOW)
  if (!result.ok) rejected(new LocalProductionError(`prepare_${result.code}`, result.detail ? [result.detail] : []))
  mkdirSync(dirname(out), { recursive: true })
  writeNewFile(out, pretty({
    synthetic_demand: true,
    note: '1A 정상 fixture(합성 수요 · 합성 정책 hash)로 실제 prepareFactoryOrderDraft 를 실행한 smoke. 실제 주문 · 등록 · 정책 승인 아님.',
    reader_calls: calls,
    prepared: result,
  }))
  console.log(`OK prepared ${out} order_hash=${result.factory.order_hash} quantity=${n} synthetic_demand=true`)
}

function packetFrom(opts: Record<string, string>, runId: string, now: string) {
  const [prepared, source, request] = need(opts, 'prepared', 'source', 'request')
  return {
    packet: buildPacket({ prepared: readJson(prepared) as never, snapshot: readJson(source), request: readJson(request) }, { runId, now }),
    inputs: { prepared: fileSha(prepared), source: fileSha(source), request: fileSha(request) },
  }
}

function exportCmd(opts: Record<string, string>) {
  const [outDir] = need(opts, 'out')
  const { packet } = packetFrom(opts, randomUUID(), new Date().toISOString())
  const path = join(outDir, 'chunk-01.json')
  if (existsSync(path)) {
    const prev = checkPacketIntegrity(readJson(path))
    if (prev.packet_hash !== packet.packet_hash) rejected(new LocalProductionError('packet_exists_with_different_inputs', [prev.task_id, packet.task_id]))
    console.log(`REUSED ${path} task_id=${prev.task_id} (same inputs → same task id; file not rewritten)`)
    return
  }
  mkdirSync(outDir, { recursive: true })
  writeNewFile(path, pretty(packet))
  console.log(`OK packet ${path} task_id=${packet.task_id} packet_hash=${packet.packet_hash} source=${packet.body.source.eligibility.status}`)
  console.log(`limits: ${packet.body.limits.join(' · ')}`)
}

function importCmd(opts: Record<string, string>, argv: string[]) {
  const [packetPath, outputPath, outDir] = need(opts, 'packet', 'output', 'out')
  const startedAt = new Date().toISOString()
  const runId = randomUUID()
  const { packet: rebuilt, inputs } = packetFrom(opts, runId, startedAt)
  const packet = checkPacketIntegrity(readJson(packetPath))
  if (packet.packet_hash !== rebuilt.packet_hash) throw new LocalProductionError('packet_stale_against_inputs', [packet.task_id, rebuilt.task_id])
  const output = readJson(outputPath)
  const errors = validateOutput(packet, output)
  if (errors.length) throw new LocalProductionError('output_invalid', errors)
  const o = output as ProductionOutput

  const enc = new TextEncoder()
  const sheet = enc.encode(renderSheet(packet, o))
  const materials = enc.encode(pretty(buildMaterials(packet, o)))
  const execution = { runId, startedAt, command: ['factory-production-local.mts', ...argv], node: process.version }
  const record = buildManifestRecord(packet, o, [{ name: 'sheet.html', bytes: sheet }, { name: 'materials.json', bytes: materials }], execution)
  const manifestBytes = enc.encode(pretty(record))

  // 새 경로에만 — 디렉터리가 있으면 EEXIST 로 거절된다(덮어쓰지 않는다)
  mkdirSync(dirname(outDir), { recursive: true })
  try {
    mkdirSync(outDir)
  } catch {
    throw new LocalProductionError('output_dir_exists', [outDir])
  }
  const files = newFileSet()
  try {
    for (const [name, bytes] of [['sheet.html', sheet], ['materials.json', materials], ['manifest.json', manifestBytes]] as const) {
      const p = join(outDir, name)
      files.write(p, bytes)
      if (sha256Hex(readFileSync(p)) !== sha256Hex(bytes)) throw new Error(`readback_mismatch:${name}`)
    }
    const receipt = {
      schema: 'vf.local-production-receipt/1',
      kind: 'local_cli_execution',
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      command: execution.command,
      node: process.version,
      platform: process.platform,
      task_id: packet.task_id,
      packet_hash: packet.packet_hash,
      inputs: { ...inputs, packet: fileSha(packetPath), output: fileSha(outputPath), output_canonical: canonicalDigest(output) },
      outputs: [...record.files, { name: 'manifest.json', bytes: manifestBytes.byteLength, sha256: sha256Hex(manifestBytes) }],
      validate_manifest_errors: [],
      output_validation_errors: [],
      not: ['db_run_ledger', 'registration', 'publication', 'delivery', 'policy_approval', 'rights_grant'],
    }
    const rp = join(outDir, 'receipt.json')
    files.write(rp, pretty(receipt))
    console.log(`OK ${outDir} task_id=${packet.task_id} run_id=${runId} items=${o.items.length} mode=${record.manifest.mode} status=${record.manifest.status}`)
    for (const f of receipt.outputs) console.log(`  ${f.name} ${f.bytes}B sha256=${f.sha256}`)
  } catch (error) {
    // 실패한 파일 자체는 writeNewFile 이 지운다(못 지우면 cleanup_failed 로 온다). 여기서는 앞서 성공한 파일 · 이번에 만든 디렉터리만.
    const left = files.rollback()
    if (error instanceof NewFileError && error.cleanup_failed) left.push(...error.paths)
    try {
      rmdirSync(outDir)
    } catch (e) {
      left.push(`${outDir} (${(e as NodeJS.ErrnoException).code ?? 'unknown'})`)
    }
    const cause = error instanceof Error ? error.message : String(error)
    if (left.length) throw new LocalProductionError('partial_write_cleanup_failed', [cause, ...left.map((p) => `left:${p}`)])
    throw new LocalProductionError('partial_write_rolled_back', [cause])
  }
}

/**
 * 1C 등록 계획(읽기 · 파일만, DB 쓰기 없음). 원천은 --current-source(지금 DB 에서 읽은 행 snapshot)로 다시 판정한다.
 * 계획은 등록 · 자격 · 출시 · 납품이 아니다. 실제 등록은 관리자 세션 서비스(dcp-supply.admitCandidates)와 승인된 SQL 적용 뒤에만.
 */
function admissionPlanCmd(opts: Record<string, string>) {
  const [packetPath, outputPath, reviewPath, sourcePath, out] = need(opts, 'packet', 'output', 'review', 'current-source', 'out')
  const plan = planAdmission({
    packet: readJson(packetPath),
    output: readJson(outputPath),
    outputSha256: fileSha(outputPath),
    review: readJson(reviewPath),
    currentSource: readJson(sourcePath),
    rights: null, // AI · CLI 는 권리 근거를 발급하지 않는다 — 등록된 권리 기록이 생기면 서비스 경계에서 넘긴다
  })
  mkdirSync(dirname(out), { recursive: true })
  writeNewFile(out, pretty({ ...plan, dry_run: true, inputs: { packet: fileSha(packetPath), output: fileSha(outputPath), review: fileSha(reviewPath), current_source: fileSha(sourcePath) } }))
  console.log(`OK plan ${out} items=${plan.items.length} real_admissible=${plan.real_admissible} qualification_ready=${plan.items.filter((i) => i.qualification_ready).length}`)
  if (plan.blockers.length) console.log(`blockers: ${plan.blockers.join(' · ')}`)
  for (const i of plan.items) console.log(`  ${i.item_id} ${i.row.type} key=${i.request_key} held=${i.held.join(',') || '-'}`)
}

const argv = process.argv.slice(2)
const { command, opts } = args(argv)
try {
  if (command === 'prepare-synthetic') await prepareSynthetic(opts)
  else if (command === 'export') exportCmd(opts)
  else if (command === 'import') importCmd(opts, argv)
  else if (command === 'admission-plan') admissionPlanCmd(opts)
  else usage(`unknown command: ${command ?? ''}`)
} catch (error) {
  rejected(error)
}
