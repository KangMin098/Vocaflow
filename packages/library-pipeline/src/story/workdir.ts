// packages/library-pipeline/src/story/workdir.ts
//
// LCP Story 로컬 제작 작업 폴더 — export → (에이전트가 채움) → validate → plan.
// 계약: docs/LCP_STORY.md §19 · §20. DB · 네트워크를 쓰지 않는다. import/publish 는 없다.
//
// 파일 규칙:
//   · 쓰기는 `<root>/<work>/` 안에서만, CLI 가 정한 이름으로만 한다. 절대 경로 · `..` · 심볼릭 링크
//     (Windows junction 포함)를 거부한다.
//   · 같은 경로에 같은 내용이면 아무것도 하지 않고(no-op), 다른 내용이면 덮지 않고 실패한다.
//     원천 · 기준이 바뀌면 새 `--work` 이름(= 새 revision)으로 내보낸다. 옛 폴더는 그대로 남는다.
//   · 쓰기는 임시 파일 → hard link(이미 있으면 실패하는 원자적 생성)다. 중단돼 남은 임시 파일은
//     지우지 않고 보고한다(다른 실행이 살아 있을 수 있다).
//   · 에이전트 결과(`*.out.json`)를 CLI 가 쓰거나 지우는 일은 없다. 에이전트는 작업을 시작할 때
//     `<결과파일>.inprogress` 를 만들고, 다 쓰면 결과 파일 이름으로 바꾼다.

import { randomBytes } from 'node:crypto'
import {
  constants,
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

import { canonicalPrettyJson, sha256Hex } from './canonical'
import { countReleases, decideEdition, type EditionDecision, type ReleaseCount, type ReviewEvidence } from './plan'
import { ExportManifestSchema, SLUG_RE, type ExportManifest, type ProductionItem } from './schema'
import { TEXT_NORMALIZATION } from './text'
import {
  ALLOWED_CHANGE_TYPES,
  parseSchema,
  policyCore,
  requiredChecks,
  reviewBindingFor,
  reviewBindingSha256,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
  type EditionResult,
  type Issue,
  type PolicyContext,
  type SourceContext,
} from './validate'

export const WORK_FILES = {
  manifest: 'export.json',
  snapshot: 'source.snapshot.json',
  policy: 'policy.json',
  editionTask: (key: string): string => `${key}.task.json`,
  editionOut: (key: string): string => `${key}.edition.out.json`,
  reviewTask: (key: string, h12: string): string => `${key}.review-${h12}.task.json`,
  reviewOut: (key: string, h12: string): string => `${key}.review-${h12}.out.json`,
} as const

export const RESERVATION_SUFFIX = '.inprogress'
const TEMP_RE = /^\..+\.tmp-\d+-[0-9a-f]{8}$/
/** plan --out 은 이 형태의 맨 파일 이름만 받는다 — 경로 · 예약 이름과 겹칠 수 없다. */
export const PLAN_OUT_RE = /^plan(-[a-z0-9]+)*\.json$/

export class WorkdirError extends Error {
  readonly code: string
  readonly path: string

  constructor(code: string, path: string, message: string) {
    super(message)
    this.name = 'WorkdirError'
    this.code = code
    this.path = path
  }
}

export interface WorkPaths {
  root: string
  dir: string
}

function lstatOrNull(p: string): Stats | null {
  try {
    return lstatSync(p)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

function normPath(p: string): string {
  const r = resolve(p)
  return process.platform === 'win32' ? r.toLowerCase() : r
}

/** 같은 파일인가 — 경로 · 실경로 · (있으면) 파일 식별자까지 본다. hard link 도 같은 파일이다. */
export function samePath(a: string, b: string): boolean {
  if (normPath(a) === normPath(b)) return true
  try {
    if (normPath(realpathSync.native(a)) === normPath(realpathSync.native(b))) return true
    const sa = statSync(a, { bigint: true })
    const sb = statSync(b, { bigint: true })
    return sa.ino !== 0n && sa.ino === sb.ino && sa.dev === sb.dev
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw e
  }
}

/** 작업 root 와 work 폴더를 연다. 링크 · 탈출을 거부한다. */
export function openWorkDir(rootArg: string, work: string, create: boolean): WorkPaths {
  if (!SLUG_RE.test(work)) {
    throw new WorkdirError('work_name_invalid', work, '--work 는 a-z0-9- 로 된 이름이어야 한다(경로를 받지 않는다)')
  }
  const rootAbs = resolve(rootArg)
  if (create) mkdirSync(rootAbs, { recursive: true })
  const rootStat = lstatOrNull(rootAbs)
  if (!rootStat) throw new WorkdirError('root_missing', rootAbs, '작업 root 가 없다')
  if (rootStat.isSymbolicLink()) throw new WorkdirError('root_symlink', rootAbs, '작업 root 가 링크다 — 실제 폴더를 지정한다')
  if (!rootStat.isDirectory()) throw new WorkdirError('root_not_directory', rootAbs, '작업 root 가 폴더가 아니다')
  const root = realpathSync.native(rootAbs)
  const dir = join(root, work)
  const st = lstatOrNull(dir)
  if (!st) {
    if (!create) throw new WorkdirError('work_missing', dir, '작업 폴더가 없다 — export 를 먼저 실행한다')
    mkdirSync(dir)
  } else if (st.isSymbolicLink()) {
    throw new WorkdirError('work_symlink', dir, '작업 폴더가 링크다 — root 밖으로 쓸 수 있으므로 거부한다')
  } else if (!st.isDirectory()) {
    throw new WorkdirError('work_not_directory', dir, '작업 폴더 자리에 파일이 있다')
  }
  if (normPath(realpathSync.native(dir)) !== normPath(dir)) {
    throw new WorkdirError('path_escape', dir, '작업 폴더의 실경로가 root 아래가 아니다')
  }
  return { root, dir }
}

function fileTarget(paths: WorkPaths, name: string): string {
  if (name !== basename(name) || name === '.' || name === '..' || /[\\/:]/.test(name)) {
    throw new WorkdirError('file_name_invalid', name, '파일 이름에 경로를 넣을 수 없다')
  }
  const target = join(paths.dir, name)
  const rel = relative(paths.root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new WorkdirError('path_escape', target, '작업 root 밖이다')
  }
  return target
}

const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** 엄격한 UTF-8 해독 — 잘못된 바이트를 U+FFFD 로 바꾸지 않고 거부한다(바꾸면 다른 바이트가 같은 본문이 된다). */
function decodeUtf8(bytes: Uint8Array, path: string): string {
  try {
    return UTF8.decode(bytes)
  } catch {
    throw new WorkdirError('file_invalid_utf8', path, 'UTF-8 이 아닌 바이트가 있다 — 치환하지 않고 거부한다')
  }
}

/** 일반 파일이면 내용, 없으면 null. 링크 · 폴더는 거부한다(밖을 읽거나 쓰지 않는다). */
function readRegular(target: string): string | null {
  const st = lstatOrNull(target)
  if (!st) return null
  if (st.isSymbolicLink()) throw new WorkdirError('symlink_refused', target, '링크 파일은 읽지도 쓰지도 않는다')
  if (!st.isFile()) throw new WorkdirError('not_a_file', target, '파일 자리에 다른 것이 있다')
  return decodeUtf8(readFileSync(target), target)
}

export type WriteOutcome = 'written' | 'unchanged'

/** 원자적 생성 — 같은 내용이면 no-op, 다른 내용이면 덮지 않고 실패한다. */
export function writeNoClobber(paths: WorkPaths, name: string, content: string): WriteOutcome {
  const target = fileTarget(paths, name)
  const refuse = (): WorkdirError =>
    new WorkdirError(
      'overwrite_refused',
      target,
      '같은 경로에 다른 내용이 이미 있다 — 덮어쓰지 않는다. 원천 · 기준이 바뀌었다면 새 --work 이름으로 내보낸다',
    )
  const existing = readRegular(target)
  if (existing !== null) {
    if (existing === content) return 'unchanged'
    throw refuse()
  }
  const tmp = join(paths.dir, `.${name}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`)
  writeFileSync(tmp, content, { flag: 'wx' })
  try {
    try {
      linkSync(tmp, target)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'EEXIST') {
        if (readRegular(target) === content) return 'unchanged'
        throw refuse()
      }
      if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'ENOSYS' && code !== 'EXDEV') throw e
      // hard link 를 못 쓰는 파일시스템 — 배타적 복사로 생성(있으면 실패). 읽는 쪽은 JSON 해석 실패를 incomplete 로 본다.
      copyFileSync(tmp, target, constants.COPYFILE_EXCL)
    }
    return 'written'
  } finally {
    try {
      unlinkSync(tmp)
    } catch (e) {
      // 지우지 못한 임시 파일은 다음 실행의 leftover_temp_files 로 보고된다.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') process.emitWarning(`임시 파일을 지우지 못했다: ${tmp}`)
    }
  }
}

export type ResultFileState =
  | { state: 'missing' }
  | { state: 'in_progress' }
  | { state: 'conflict' }
  | { state: 'incomplete'; code: 'result_incomplete' | 'result_invalid_utf8'; message: string }
  | { state: 'present'; value: unknown }

/** 에이전트 결과 파일 상태. 예약(.inprogress)과 완성본을 구분하고, 해석 못 하는 파일은 incomplete. */
export function readResultFile(paths: WorkPaths, name: string): ResultFileState {
  const target = fileTarget(paths, name)
  const reserved = lstatOrNull(fileTarget(paths, `${name}${RESERVATION_SUFFIX}`)) !== null
  let raw: string | null
  try {
    raw = readRegular(target)
  } catch (e) {
    if (e instanceof WorkdirError && e.code === 'file_invalid_utf8') {
      return { state: 'incomplete', code: 'result_invalid_utf8', message: e.message }
    }
    throw e
  }
  if (raw === null) return reserved ? { state: 'in_progress' } : { state: 'missing' }
  if (reserved) return { state: 'conflict' }
  if (raw.trim().length === 0) return { state: 'incomplete', code: 'result_incomplete', message: '빈 파일이다' }
  try {
    return { state: 'present', value: JSON.parse(raw) as unknown }
  } catch (e) {
    return { state: 'incomplete', code: 'result_incomplete', message: `JSON 해석 실패 — 쓰다 멈춘 파일일 수 있다: ${(e as Error).message}` }
  }
}

function readInputJson(path: string, label: string, errors: Issue[]): unknown {
  let text: string
  try {
    text = decodeUtf8(readFileSync(path), path)
  } catch (e) {
    if (e instanceof WorkdirError) {
      errors.push({ code: 'input_invalid_utf8', path: label, message: `${path}: ${e.message}` })
    } else {
      errors.push({ code: 'input_unreadable', path: label, message: `${path}: ${(e as Error).message}` })
    }
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch (e) {
    errors.push({ code: 'input_unreadable', path: label, message: `${path}: ${(e as Error).message}` })
    return null
  }
}

export function listLeftoverTemps(paths: WorkPaths): string[] {
  return readdirSync(paths.dir)
    .filter((n) => TEMP_RE.test(n))
    .sort()
}

// ── 과제 파일 ──────────────────────────────────────────────────────────────

const EDITION_INSTRUCTIONS = [
  '이 과제의 source.paragraphs 만 근거로 쓴다. 다른 판본 · 기억 · 외부 본문을 섞지 않는다.',
  '작업을 시작하면 output.reservation 파일을 먼저 만들고, output.template 을 채운 뒤 그 파일을 output.file 이름으로 바꾼다.',
  'schema · task_id · binding · edition_key · kind 는 템플릿 값 그대로 둔다.',
  '단위(units)는 원문 순서대로 둔다. 초기 제작은 원작 순서를 바꾸지 않고 재서사(renarration)를 하지 않는다.',
  '앵커는 문단 하나 안의 [start, end) UTF-16 구간이며 quote 는 원문 그 구간과 정확히 같아야 한다.',
  '제작 범위의 모든 문단은 단위 앵커가 가리키거나 omit 변경 기록으로 남긴다. 말없이 빠뜨리지 않는다.',
  'required_in 에 이 판본 종류가 있는 보존 요소는 그 원문 구간과 겹치는 단위의 preserves 에 적는다.',
  '민감 표현은 편집 기준의 handling 대로 처리하고 learner_note 에 학습자 설명을 남긴다. 은폐하지도 무비판 재생산하지도 않는다.',
  '활동은 production.activities 에 있는 종류만 판단 구조(choose_evidence · order_events · original_bridge)로 만든다. 사실 정답(factual)과 허용 가능한 해석(interpretive)을 구분하고 자유서술 채점 · 해설 덤프를 만들지 않는다.',
  '원본 오디오 · 삽화 · 퀴즈를 자동으로 가져오지 않는다. 자산을 쓰면 assets 에 권리 · 본문 정합 상태를 사실대로 적는다.',
  'produced_by 에 실제 에이전트와 세션을 적는다. 이 판본의 검수는 다른 세션이 한다.',
]

const REVIEW_INSTRUCTIONS = [
  '판본을 만든 세션은 이 검수를 하지 않는다(reviewer.session_id 는 producer.session_id 와 달라야 한다).',
  'edition 과 source.paragraphs 를 대조해 required_checks 를 모두 pass · fail · hold · not_checked 로 판정한다. 구조 검증 통과는 의미 보존 인증이 아니다.',
  '핵심 사건 · 인물 동기 · 인과 · 복선 · 어조의 훼손, 사실 오류는 critical 또는 major 문제로 적는다.',
  'binding 은 그대로 둔다. 판본 · 활동 · 기준 · 원문이 바뀌면 이 검수는 옛 판 기록이 되고 새 검수 과제가 나온다.',
  'AI 모델 검수는 provenance=ai_review, 사람 검수만 human_review 다. 교사 · 전문가 검수라고 적지 않는다.',
  '작업을 시작하면 output.reservation 을 먼저 만들고, 다 쓴 뒤 output.file 로 이름을 바꾼다. 두 번째 검수자는 output.alternate_file_pattern 의 slot 이름을 쓴다.',
]

function editionTaskDoc(work: string, source: SourceContext, policy: PolicyContext, item: ProductionItem, targetSha: string): object {
  const taskId = `${work}:${item.edition_key}`
  const binding = {
    source_sha256: source.sha256,
    source_identity_sha256: source.identity_sha256,
    policy_sha256: policy.policy_sha256,
    target_sha256: targetSha,
  }
  const outFile = WORK_FILES.editionOut(item.edition_key)
  return {
    schema: 'lcp-story/edition-task@1',
    task_id: taskId,
    edition_key: item.edition_key,
    kind: item.kind,
    binding,
    instructions: EDITION_INSTRUCTIONS,
    rules: {
      normalization: TEXT_NORMALIZATION,
      offsets: 'utf16-code-units half-open [start,end) within one paragraph; quote === text.slice(start,end)',
      allowed_change_types: ALLOWED_CHANGE_TYPES[item.kind],
      note_operations: 'gloss · context_note 는 type=editorial_note 로 기록한다',
      unit_order: 'source order — no reordering',
      coverage: 'every in-scope paragraph is referenced by a unit anchor or an omit change',
    },
    source: {
      snapshot_id: source.snapshot.snapshot_id,
      work: source.snapshot.work,
      edition: source.snapshot.edition,
      coverage: source.snapshot.coverage,
      text_sha256: source.sha256,
      identity_sha256: source.identity_sha256,
      paragraphs: source.paragraphs.map((p) => ({ index: p.index, start: p.start, end: p.end, text: source.text.slice(p.start, p.end) })),
    },
    policy: policyCore(policy.policy),
    production: item,
    output: {
      file: outFile,
      reservation: `${outFile}${RESERVATION_SUFFIX}`,
      template: {
        schema: 'lcp-story/edition@1',
        task_id: taskId,
        binding,
        edition_key: item.edition_key,
        kind: item.kind,
        produced_by: { agent: '', session_id: '', provenance: 'ai_generated' },
        title: '',
        hook: { text: '', source_anchors: [], spoiler_free: true },
        units: [],
        change_log: [],
        activities: [],
        assets: [],
      },
    },
  }
}

// ── export(판본 과제) ──────────────────────────────────────────────────────

export interface FileOutcome {
  file: string
  outcome: WriteOutcome
}

export interface CommandReport {
  command: string
  work: string
  ok: boolean
  exit_code: 0 | 1 | 2
  errors: Issue[]
  files: FileOutcome[]
  leftover_temp_files: string[]
}

function issueOf(e: unknown): Issue {
  if (e instanceof WorkdirError) return { code: e.code, path: e.path, message: e.message }
  throw e
}

export interface ExportOptions {
  root: string
  work: string
  sourcePath: string
  policyPath: string
  now: Date
}

export function exportEditionTasks(opts: ExportOptions): CommandReport & { stage: 'edition'; editions: string[] } {
  const report = {
    command: 'export',
    stage: 'edition' as const,
    work: opts.work,
    ok: false,
    exit_code: 1 as 0 | 1 | 2,
    errors: [] as Issue[],
    files: [] as FileOutcome[],
    leftover_temp_files: [] as string[],
    editions: [] as string[],
  }
  const snapRaw = readInputJson(opts.sourcePath, '--source', report.errors)
  const policyRaw = readInputJson(opts.policyPath, '--policy', report.errors)
  if (report.errors.length > 0) return report
  const src = validateSnapshot(snapRaw, opts.now)
  report.errors.push(...src.errors)
  if (!src.value) return report
  const pol = validatePolicy(policyRaw, src.value)
  report.errors.push(...pol.errors)
  if (!pol.value) return report
  const source = src.value
  const policy = pol.value

  let paths: WorkPaths
  try {
    paths = openWorkDir(opts.root, opts.work, true)
  } catch (e) {
    report.errors.push(issueOf(e))
    return report
  }

  const outputs: Array<{ name: string; content: string }> = []
  const snapshotFile = canonicalPrettyJson(source.snapshot)
  const policyFile = canonicalPrettyJson(policy.policy)
  outputs.push({ name: WORK_FILES.snapshot, content: snapshotFile })
  outputs.push({ name: WORK_FILES.policy, content: policyFile })
  const manifestEditions: ExportManifest['editions'] = []
  for (const item of policy.policy.production) {
    const slot = policy.items.get(item.edition_key)!
    const content = canonicalPrettyJson(editionTaskDoc(opts.work, source, policy, item, slot.target_sha256))
    const name = WORK_FILES.editionTask(item.edition_key)
    outputs.push({ name, content })
    manifestEditions.push({
      edition_key: item.edition_key,
      kind: item.kind,
      task_id: `${opts.work}:${item.edition_key}`,
      target_sha256: slot.target_sha256,
      task_file: name,
      task_file_sha256: sha256Hex(content),
    })
  }
  const manifest: ExportManifest = {
    schema: 'lcp-story/export@1',
    work: opts.work,
    source_sha256: source.sha256,
    source_identity_sha256: source.identity_sha256,
    snapshot_file_sha256: sha256Hex(snapshotFile),
    policy_sha256: policy.policy_sha256,
    policy_file_sha256: sha256Hex(policyFile),
    editions: manifestEditions,
  }
  // 원장(export.json)을 마지막에 쓴다 — 원장이 있으면 내보내기가 끝난 것이다.
  outputs.push({ name: WORK_FILES.manifest, content: canonicalPrettyJson(manifest) })

  try {
    for (const o of outputs) {
      const target = fileTarget(paths, o.name)
      for (const [flag, input] of [['--source', opts.sourcePath], ['--policy', opts.policyPath]] as const) {
        if (samePath(input, target)) {
          throw new WorkdirError('input_is_output', input, `${flag} 가 출력 파일 ${o.name} 와 같은 파일이다`)
        }
      }
    }
    for (const o of outputs) report.files.push({ file: o.name, outcome: writeNoClobber(paths, o.name, o.content) })
  } catch (e) {
    report.errors.push(issueOf(e))
    report.leftover_temp_files = listLeftoverTemps(paths)
    return report
  }
  report.leftover_temp_files = listLeftoverTemps(paths)
  report.editions = manifestEditions.map((m) => m.edition_key)
  report.ok = true
  report.exit_code = 0
  return report
}

// ── 작업 폴더 검사(validate · plan · export review 공용) ─────────────────────

export type EditionResultStatus = 'missing' | 'in_progress' | 'conflict' | 'incomplete' | 'invalid' | 'valid'
export type ReviewFileStatus = 'in_progress' | 'conflict' | 'incomplete' | 'invalid' | 'current' | 'stale'

export interface ReviewFileReport {
  file: string
  status: ReviewFileStatus
  review_id: string | null
  verdict: string | null
  mismatched_fields: string[]
  errors: Issue[]
}

export interface EditionReport {
  edition_key: string
  task_id: string
  result: { file: string; status: EditionResultStatus; errors: Issue[]; edition_sha256: string | null; activities_sha256: string | null }
  review_binding_sha256: string | null
  review_task: { file: string; exported: boolean } | null
  reviews: ReviewFileReport[]
}

interface Inspection {
  paths: WorkPaths
  integrity: Issue[]
  source: SourceContext | null
  policy: PolicyContext | null
  manifest: ExportManifest | null
  editions: Array<{ report: EditionReport; result: EditionResult | null; evidence: ReviewEvidence[] }>
  leftovers: string[]
}

function loadIntegrity(paths: WorkPaths, work: string, now: Date): Pick<Inspection, 'integrity' | 'source' | 'policy' | 'manifest'> {
  const integrity: Issue[] = []
  const none = { integrity, source: null, policy: null, manifest: null }
  const readLedger = (name: string): string | null => {
    const raw = readRegular(fileTarget(paths, name))
    if (raw === null) integrity.push({ code: 'workdir_file_missing', path: name, message: '내보내기 원장 파일이 없다 — export 를 다시 실행한다' })
    return raw
  }
  const manifestRaw = readLedger(WORK_FILES.manifest)
  if (manifestRaw === null) return none
  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(manifestRaw)
  } catch (e) {
    integrity.push({ code: 'workdir_file_incomplete', path: WORK_FILES.manifest, message: (e as Error).message })
    return none
  }
  const { value: manifest, errors: mErrors } = parseSchema(ExportManifestSchema, manifestJson, 'export')
  integrity.push(...mErrors)
  if (!manifest) return none
  if (manifest.work !== work) integrity.push({ code: 'workdir_name_mismatch', path: WORK_FILES.manifest, message: '원장의 work 이름이 폴더와 다르다' })

  const snapRaw = readLedger(WORK_FILES.snapshot)
  const policyRaw = readLedger(WORK_FILES.policy)
  if (snapRaw === null || policyRaw === null) return { ...none, manifest }
  if (sha256Hex(snapRaw) !== manifest.snapshot_file_sha256) {
    integrity.push({ code: 'workdir_tampered', path: WORK_FILES.snapshot, message: '내보낸 뒤 원천 사본이 바뀌었다' })
  }
  if (sha256Hex(policyRaw) !== manifest.policy_file_sha256) {
    integrity.push({ code: 'workdir_tampered', path: WORK_FILES.policy, message: '내보낸 뒤 편집 기준 사본이 바뀌었다' })
  }
  const parsed: unknown[] = []
  for (const [name, raw] of [[WORK_FILES.snapshot, snapRaw], [WORK_FILES.policy, policyRaw]] as const) {
    try {
      parsed.push(JSON.parse(raw))
    } catch (e) {
      integrity.push({ code: 'workdir_file_incomplete', path: name, message: (e as Error).message })
      return { ...none, manifest }
    }
  }
  const src = validateSnapshot(parsed[0], now)
  integrity.push(...src.errors)
  const pol = src.value ? validatePolicy(parsed[1], src.value) : null
  if (pol) integrity.push(...pol.errors)
  const source = src.value
  const policy = pol?.value ?? null
  if (!source || !policy) return { ...none, manifest }
  if (
    source.sha256 !== manifest.source_sha256 ||
    source.identity_sha256 !== manifest.source_identity_sha256 ||
    policy.policy_sha256 !== manifest.policy_sha256
  ) {
    integrity.push({ code: 'workdir_tampered', path: WORK_FILES.manifest, message: '원장 해시가 사본에서 계산한 해시와 다르다' })
  }
  const manifestKeys = manifest.editions.map((e) => e.edition_key).sort()
  const policyKeys = [...policy.items.keys()].sort()
  if (manifestKeys.join('|') !== policyKeys.join('|')) {
    integrity.push({ code: 'workdir_tampered', path: WORK_FILES.manifest, message: '원장의 판본 목록이 편집 기준의 제작 범위와 다르다' })
  }
  for (const m of manifest.editions) {
    const slot = policy.items.get(m.edition_key)
    if (!slot || slot.target_sha256 !== m.target_sha256 || m.task_file !== WORK_FILES.editionTask(m.edition_key) || m.task_id !== `${work}:${m.edition_key}`) {
      integrity.push({ code: 'workdir_tampered', path: m.task_file, message: '원장의 과제 기록이 편집 기준과 맞지 않는다' })
      continue
    }
    const taskRaw = readLedger(m.task_file)
    if (taskRaw !== null && sha256Hex(taskRaw) !== m.task_file_sha256) {
      integrity.push({ code: 'workdir_tampered', path: m.task_file, message: '내보낸 뒤 과제 파일이 바뀌었다' })
    }
  }
  return { integrity, source, policy, manifest }
}

function reviewFilesFor(paths: WorkPaths, key: string): Array<{ name: string; h12: string }> {
  const re = new RegExp(`^${key}\\.review-([0-9a-f]{12})(\\.[a-z0-9-]+)?\\.out\\.json(${RESERVATION_SUFFIX.replace('.', '\\.')})?$`)
  const names = new Map<string, string>()
  for (const n of readdirSync(paths.dir)) {
    const m = re.exec(n)
    if (!m) continue
    const base = m[3] ? n.slice(0, -RESERVATION_SUFFIX.length) : n
    names.set(base, m[1]!)
  }
  return [...names.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, h12]) => ({ name, h12 }))
}

function inspect(paths: WorkPaths, work: string, now: Date): Inspection {
  const base = loadIntegrity(paths, work, now)
  const out: Inspection = { paths, ...base, editions: [], leftovers: listLeftoverTemps(paths) }
  if (base.integrity.length > 0 || !base.source || !base.policy || !base.manifest) return out
  const source = base.source
  const policy = base.policy
  for (const m of base.manifest.editions) {
    const ctx = { source, policy, edition_key: m.edition_key, task_id: m.task_id }
    const outFile = WORK_FILES.editionOut(m.edition_key)
    const report: EditionReport = {
      edition_key: m.edition_key,
      task_id: m.task_id,
      result: { file: outFile, status: 'missing', errors: [], edition_sha256: null, activities_sha256: null },
      review_binding_sha256: null,
      review_task: null,
      reviews: [],
    }
    let result: EditionResult | null = null
    const state = readResultFile(paths, outFile)
    if (state.state === 'present') {
      const checked = validateEdition(state.value, ctx)
      report.result.status = checked.ok ? 'valid' : 'invalid'
      report.result.errors = checked.errors
      result = checked.value
    } else {
      report.result.status = state.state
      if (state.state === 'incomplete') report.result.errors = [{ code: state.code, path: outFile, message: state.message }]
      if (state.state === 'conflict') {
        report.result.errors = [{ code: 'result_conflict', path: outFile, message: '완성본과 예약(.inprogress)이 함께 있다 — 어느 쪽이 최신인지 확인한다' }]
      }
    }
    const binding = result ? reviewBindingFor(ctx, result) : null
    if (result && binding) {
      report.result.edition_sha256 = result.edition_sha256
      report.result.activities_sha256 = result.activities_sha256
      const bindingSha = reviewBindingSha256(binding)
      report.review_binding_sha256 = bindingSha
      const taskName = WORK_FILES.reviewTask(m.edition_key, bindingSha.slice(0, 12))
      report.review_task = { file: taskName, exported: readRegular(fileTarget(paths, taskName)) !== null }
    }
    const evidence: ReviewEvidence[] = []
    for (const { name, h12 } of reviewFilesFor(paths, m.edition_key)) {
      const rs = readResultFile(paths, name)
      const r: ReviewFileReport = { file: name, status: 'invalid', review_id: null, verdict: null, mismatched_fields: [], errors: [] }
      if (rs.state === 'missing') continue
      if (rs.state !== 'present') {
        r.status = rs.state
        if (rs.state === 'incomplete') r.errors = [{ code: rs.code, path: name, message: rs.message }]
        if (rs.state === 'conflict') r.errors = [{ code: 'result_conflict', path: name, message: '완성본과 예약(.inprogress)이 함께 있다' }]
        report.reviews.push(r)
        continue
      }
      const checked = validateReview(rs.value, { edition_key: m.edition_key, current_binding: binding, now })
      r.errors = checked.errors
      if (checked.value && checked.value.binding_sha256.slice(0, 12) !== h12) {
        r.errors = [{ code: 'review_slot_mismatch', path: name, message: '파일 이름의 결속 해시와 검수 내용의 결속이 다르다 — 다른 자리의 검수를 옮겨 놓았다' }]
      }
      if (r.errors.length === 0 && checked.value) {
        r.status = checked.value.current ? 'current' : 'stale'
        r.review_id = checked.value.review.review_id
        r.verdict = checked.value.review.verdict
        r.mismatched_fields = checked.value.mismatched_fields
        evidence.push({ file: name, review: checked.value.review, review_sha256: checked.value.review_sha256, current: checked.value.current })
      }
      report.reviews.push(r)
    }
    out.editions.push({ report, result, evidence })
  }
  return out
}

function hasErrors(ins: Inspection): boolean {
  return (
    ins.integrity.length > 0 ||
    ins.editions.some(
      (e) =>
        ['invalid', 'incomplete', 'conflict'].includes(e.report.result.status) ||
        e.report.reviews.some((r) => ['invalid', 'incomplete', 'conflict'].includes(r.status)),
    )
  )
}

function hasPending(ins: Inspection): boolean {
  return ins.editions.some(
    (e) => e.report.result.status === 'missing' || e.report.result.status === 'in_progress' || e.report.reviews.some((r) => r.status === 'in_progress'),
  )
}

export interface WorkOptions {
  root: string
  work: string
  now: Date
}

export interface ValidateReport extends CommandReport {
  editions: EditionReport[]
  summary: { valid: number; pending: number; invalid: number; current_reviews: number; stale_reviews: number }
}

/** 실제 에이전트 결과를 검증한다. 0 = 전부 유효 · 2 = 대기/작업 중만 있음 · 1 = 오류. */
export function validateWork(opts: WorkOptions): ValidateReport {
  const report: ValidateReport = {
    command: 'validate',
    work: opts.work,
    ok: false,
    exit_code: 1,
    errors: [],
    files: [],
    leftover_temp_files: [],
    editions: [],
    summary: { valid: 0, pending: 0, invalid: 0, current_reviews: 0, stale_reviews: 0 },
  }
  let ins: Inspection
  try {
    ins = inspect(openWorkDir(opts.root, opts.work, false), opts.work, opts.now)
  } catch (e) {
    report.errors.push(issueOf(e))
    return report
  }
  report.errors.push(...ins.integrity)
  report.leftover_temp_files = ins.leftovers
  report.editions = ins.editions.map((e) => e.report)
  for (const e of report.editions) {
    if (e.result.status === 'valid') report.summary.valid += 1
    else if (e.result.status === 'missing' || e.result.status === 'in_progress') report.summary.pending += 1
    else report.summary.invalid += 1
    report.summary.current_reviews += e.reviews.filter((r) => r.status === 'current').length
    report.summary.stale_reviews += e.reviews.filter((r) => r.status === 'stale').length
  }
  report.exit_code = hasErrors(ins) || report.editions.length === 0 ? 1 : hasPending(ins) ? 2 : 0
  report.ok = report.exit_code === 0
  return report
}

// ── export(검수 과제) ──────────────────────────────────────────────────────

export function exportReviewTasks(opts: WorkOptions): CommandReport & { stage: 'review'; not_ready: string[] } {
  const report = {
    command: 'export',
    stage: 'review' as const,
    work: opts.work,
    ok: false,
    exit_code: 1 as 0 | 1 | 2,
    errors: [] as Issue[],
    files: [] as FileOutcome[],
    leftover_temp_files: [] as string[],
    not_ready: [] as string[],
  }
  let ins: Inspection
  try {
    ins = inspect(openWorkDir(opts.root, opts.work, false), opts.work, opts.now)
  } catch (e) {
    report.errors.push(issueOf(e))
    return report
  }
  report.errors.push(...ins.integrity)
  if (ins.integrity.length > 0 || !ins.source || !ins.policy) return report
  const source = ins.source
  const policy = ins.policy
  try {
    for (const e of ins.editions) {
      report.errors.push(...e.report.result.errors)
      if (!e.result || !e.report.review_binding_sha256 || !e.report.review_task) {
        report.not_ready.push(e.report.edition_key)
        continue
      }
      const ctx = { source, policy, edition_key: e.report.edition_key, task_id: e.report.task_id }
      const binding = reviewBindingFor(ctx, e.result)
      const h12 = e.report.review_binding_sha256.slice(0, 12)
      const outFile = WORK_FILES.reviewOut(e.report.edition_key, h12)
      const slot = policy.items.get(e.report.edition_key)!
      const doc = {
        schema: 'lcp-story/review-task@1',
        task_id: e.report.task_id,
        edition_key: e.report.edition_key,
        binding,
        binding_sha256: e.report.review_binding_sha256,
        required_checks: requiredChecks(e.result.edition),
        instructions: REVIEW_INSTRUCTIONS,
        producer: e.result.edition.produced_by,
        source: {
          snapshot_id: source.snapshot.snapshot_id,
          edition: source.snapshot.edition,
          rights: source.snapshot.rights,
          text_sha256: source.sha256,
          identity_sha256: source.identity_sha256,
          paragraphs: source.paragraphs.map((p) => ({ index: p.index, start: p.start, end: p.end, text: source.text.slice(p.start, p.end) })),
        },
        policy: policyCore(policy.policy),
        production: slot.item,
        edition: e.result.edition,
        output: {
          file: outFile,
          reservation: `${outFile}${RESERVATION_SUFFIX}`,
          alternate_file_pattern: `${e.report.edition_key}.review-${h12}.<slot>.out.json`,
          template: {
            schema: 'lcp-story/review@1',
            review_id: '',
            binding,
            reviewer: { kind: 'ai_model', agent: '', session_id: '', role: '' },
            provenance: 'ai_review',
            checks: [],
            issues: [],
            verdict: 'hold',
            reviewed_at: '',
          },
        },
      }
      report.files.push({ file: e.report.review_task.file, outcome: writeNoClobber(ins.paths, e.report.review_task.file, canonicalPrettyJson(doc)) })
    }
  } catch (err) {
    report.errors.push(issueOf(err))
  }
  report.leftover_temp_files = listLeftoverTemps(ins.paths)
  report.exit_code = report.errors.length > 0 ? 1 : report.files.length === 0 ? 2 : 0
  report.ok = report.exit_code === 0
  return report
}

// ── plan ───────────────────────────────────────────────────────────────────

export interface PlanReport extends CommandReport {
  schema: 'lcp-story/plan@1'
  db_write: false
  publish_permission: 'none_local_preview'
  decisions: EditionDecision[]
  totals: { candidate: number; fixture_only: number; hold: number; pending: number }
  candidate_count: ReleaseCount
  validation: { errors: number; editions: EditionReport[] }
}

/** 발행 후보/보류 사유 미리보기. 0 = 후보 1건 이상 · 2 = 후보 없음 · 1 = 검증 오류. DB 를 쓰지 않는다. */
export function planWork(opts: WorkOptions & { out: string | null }): PlanReport {
  const report: PlanReport = {
    command: 'plan',
    schema: 'lcp-story/plan@1',
    work: opts.work,
    ok: false,
    exit_code: 1,
    errors: [],
    files: [],
    leftover_temp_files: [],
    db_write: false,
    publish_permission: 'none_local_preview',
    decisions: [],
    totals: { candidate: 0, fixture_only: 0, hold: 0, pending: 0 },
    candidate_count: { releases: 0, distinct_works: 0 },
    validation: { errors: 0, editions: [] },
  }
  if (opts.out !== null && !PLAN_OUT_RE.test(opts.out)) {
    report.errors.push({ code: 'out_name_invalid', path: opts.out, message: '--out 은 plan.json · plan-<이름>.json 형태의 파일 이름만 받는다(경로 불가)' })
    return report
  }
  let ins: Inspection
  try {
    ins = inspect(openWorkDir(opts.root, opts.work, false), opts.work, opts.now)
  } catch (e) {
    report.errors.push(issueOf(e))
    return report
  }
  report.errors.push(...ins.integrity)
  report.leftover_temp_files = ins.leftovers
  report.validation.editions = ins.editions.map((e) => e.report)
  if (ins.integrity.length > 0 || !ins.source || !ins.policy) return report
  const source = ins.source
  const policy = ins.policy

  for (const e of ins.editions) {
    const status = e.report.result.status
    const editionState = status === 'valid' ? 'valid' : status === 'missing' || status === 'in_progress' ? status : 'invalid'
    report.decisions.push(
      decideEdition({ source, policy, edition_key: e.report.edition_key, edition_state: editionState, edition: e.result, reviews: e.evidence }),
    )
  }
  for (const d of report.decisions) report.totals[d.status] += 1
  report.candidate_count = countReleases(
    report.decisions.flatMap((d) => (d.status === 'candidate' && d.release ? [d.release] : [])),
  )
  const errorful = hasErrors(ins)
  report.validation.errors = report.validation.editions.reduce(
    (n, e) => n + e.result.errors.length + e.reviews.reduce((m, r) => m + r.errors.length, 0),
    0,
  )
  report.exit_code = errorful ? 1 : report.totals.candidate > 0 ? 0 : 2
  report.ok = report.exit_code === 0

  if (opts.out !== null && errorful) {
    // 검증 오류가 있는 계획은 파일로 남기지 않는다 — 남기면 「계산된 계획」으로 읽힌다.
    report.errors.push({ code: 'plan_out_skipped', path: opts.out, message: '검증 오류가 있어 계획 파일을 쓰지 않았다 — 오류를 고친 뒤 다시 실행한다' })
  } else if (opts.out !== null) {
    try {
      // 파일에는 실행마다 달라질 수 있는 목록(임시 파일 · 쓰기 결과)을 넣지 않는다 — 같은 상태의 재실행은 no-op.
      const { files: _files, leftover_temp_files: _temps, ...body } = report
      report.files.push({ file: opts.out, outcome: writeNoClobber(ins.paths, opts.out, canonicalPrettyJson(body)) })
    } catch (e) {
      report.errors.push(issueOf(e))
      report.exit_code = 1
      report.ok = false
    }
  }
  return report
}
