// scripts/textbook/fast-worksheet.mts
//
// 단계 3 FAST 빠른 학습지 CLI. 판단은 apps/web/src/lib/csat/map/v62/factory-bridge/fast-worksheet.ts,
// 여기는 파일 읽기 · 새 파일 쓰기 · 시계 · 실행 영수증만. 공유 DB · 네트워크 없음(원천 현재 행은 파일로 받는다).

import { mkdirSync, readFileSync, rmdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { NewFileError, newFileSet, writeNewFile } from './factory-order-draft.mjs'

import { FAST_BUNDLE_SCHEMA, evaluateFast, fastFiles, fastView } from '../../apps/web/src/lib/csat/map/v62/factory-bridge/fast-worksheet'
import { LocalProductionError, sha256Hex } from '../../apps/web/src/lib/csat/map/v62/factory-bridge/local-production'

const HELP = `usage: tsx --tsconfig apps/web/tsconfig.json scripts/textbook/fast-worksheet.mts <command> [--flag value ...]

commands
  bundle  --packet <chunk-01.json> --output <chunk-01.out.json> --source-snapshot <file>
          [--edit <edit.json>] [--review <review.json>] --out <new-file>
      기존 1B 패킷 · 출력 · 원 snapshot 으로 vf.fast-worksheet-bundle/1 을 만든다. --out 이 이미 있으면 거절(덮어쓰지 않음).
      edit.json = { order: [문항 id 전부], items: { <id>: { stem?, choices?[5] } }, editor: { kind: ai|human, agent, session|null, note } }
  verify  --bundle <file> --current-source <snapshot>
      묶음을 지금 원천 snapshot 에 대어 판정만 한다(파일 쓰기 없음). 검수 상태 · 원천 차이 · 출력 sha256 을 출력.
  export  --bundle <file> --current-source <snapshot> --out <new-dir>
      <new-dir>(없어야 함)에 파일을 쓴다. 검수 전: edited-output.json · review-request.json.
      검수 통과 뒤: + student.html · teacher.html · review-binding.json · manifest.json · receipt.json.
      중간 실패 시 이번 실행이 만든 파일 · 디렉터리만 지운다.

exit codes: 0 성공 · 1 검증 거절/쓰기 실패 · 2 인자 오류
not performed: DB 쓰기 · 등록 · 발행 · 출시 · 권리 부여 · FQ 자격`

function args(argv: string[]) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h' || rest.includes('--help')) {
    console.log(HELP)
    process.exit(0)
  }
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
  console.error(`${msg}\n\n${HELP}`)
  process.exit(2)
}
const need = (opts: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (!opts[k]) usage(`missing --${k}`)
  return keys.map((k) => resolve(opts[k]!))
}
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`

function bundleCmd(opts: Record<string, string>) {
  const [packet, output, snapshot, out] = need(opts, 'packet', 'output', 'source-snapshot', 'out')
  const bundle = {
    schema: FAST_BUNDLE_SCHEMA,
    packet: readJson(packet),
    base_output: readJson(output),
    source_snapshot: readJson(snapshot),
    edit: opts.edit ? readJson(resolve(opts.edit)) : null,
    review: opts.review ? readJson(resolve(opts.review)) : null,
  }
  // 묶음 자체가 판정 가능한지 원 snapshot 기준으로 먼저 확인 — 깨진 묶음 파일을 남기지 않는다
  const s = evaluateFast(bundle, bundle.source_snapshot)
  mkdirSync(dirname(out), { recursive: true })
  writeNewFile(out, pretty(bundle))
  console.log(`OK bundle ${out} task_id=${s.packet.task_id} output_sha256=${s.output_sha256} review=${s.review.status} edits=${s.diff.fields.length} reordered=${s.diff.reordered}`)
}

function verifyCmd(opts: Record<string, string>) {
  const [bundle, current] = need(opts, 'bundle', 'current-source')
  const s = evaluateFast(readJson(bundle), readJson(current))
  const v = fastView(s)
  console.log(pretty({ task_id: v.task_id, scope: v.scope, source: { drift: s.source.drift, original: s.source.original_digest, current: s.source.current_digest, observations: s.source.observations }, output_sha256: s.output_sha256, base_output_sha256: s.base_output_sha256, diff: s.diff, review: v.review }))
}

function exportCmd(opts: Record<string, string>, argv: string[]) {
  const [bundlePath, current, outDir] = need(opts, 'bundle', 'current-source', 'out')
  const startedAt = new Date().toISOString()
  const runId = randomUUID()
  const s = evaluateFast(readJson(bundlePath), readJson(current))
  const execution = { runId, startedAt, command: ['fast-worksheet.mts', ...argv], node: process.version }
  const files = fastFiles(s, execution)
  mkdirSync(dirname(outDir), { recursive: true })
  try {
    mkdirSync(outDir)
  } catch {
    throw new LocalProductionError('output_dir_exists', [outDir])
  }
  const set = newFileSet()
  try {
    const written: { name: string; bytes: number; sha256: string }[] = []
    for (const f of files) {
      const p = join(outDir, f.name)
      const bytes = new TextEncoder().encode(f.content)
      set.write(p, bytes)
      if (sha256Hex(readFileSync(p)) !== sha256Hex(bytes)) throw new Error(`readback_mismatch:${f.name}`)
      written.push({ name: f.name, bytes: bytes.byteLength, sha256: sha256Hex(bytes) })
    }
    const receipt = {
      schema: 'vf.fast-worksheet-receipt/1',
      kind: 'local_cli_execution',
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      command: execution.command,
      node: process.version,
      inputs: { bundle: sha256Hex(readFileSync(bundlePath)), current_source: sha256Hex(readFileSync(current)) },
      review: s.review.status,
      outputs: written,
      not: ['db_write', 'registration', 'publication', 'release', 'rights_grant', 'fq_qualification'],
    }
    set.write(join(outDir, 'receipt.json'), pretty(receipt))
    console.log(`OK ${outDir} review=${s.review.status} output_sha256=${s.output_sha256} source_drift=${s.source.drift}`)
    for (const f of written) console.log(`  ${f.name} ${f.bytes}B sha256=${f.sha256}`)
  } catch (error) {
    const left = set.rollback()
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

const argv = process.argv.slice(2)
const { command, opts } = args(argv)
try {
  if (command === 'bundle') bundleCmd(opts)
  else if (command === 'verify') verifyCmd(opts)
  else if (command === 'export') exportCmd(opts, argv)
  else usage(`unknown command: ${command}`)
} catch (error) {
  if (error instanceof LocalProductionError) console.error(`REJECTED ${error.message}`)
  else console.error(`FAILED ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
