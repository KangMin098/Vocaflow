// scripts/lcp/story/pilot/build.ts
//
// LCP Story S7 파일럿 원천 준비 도구 — 원천 XHTML → 원천 스냅숏, 편집 기준 초안 → 앵커를 계산한 편집 기준.
// 계약: docs/LCP_STORY.md §7(정규화 story-text-v1 · 앵커) · 기록: docs/lcp-story/S7_PILOT.md
// DB · 네트워크 · LLM API 를 쓰지 않는다. 원문 전문이 든 출력은 gitignore 된 work/lcp-story-pilot/ 에만 쓴다.
//
// 사용(저장소 루트):
//   pnpm exec tsx scripts/lcp/story/pilot/build.ts snapshot --work <name> [--now <ISO>]
//   pnpm exec tsx scripts/lcp/story/pilot/build.ts policy   --work <name> --in <draft.json> [--out <policy.json>] [--now <ISO>]
//   pnpm exec tsx scripts/lcp/story/pilot/build.ts check    --work <name> [--now <ISO>]
//
// snapshot: sources.json 에 적힌 원천 파일 sha256 을 먼저 확인하고, <article> 안의 <p> 문단만 뽑아
//           normalizeSourceText 로 정규화한다. 본문 해시는 sourceTextSha256, 원천 판본 정체 해시는 validateSnapshot 이 계산한다
//           (해시 · 오프셋을 손으로 적지 않는다). 같은 경로에 다른 내용의 스냅숏이 있으면 덮지 않는다 — 새 snapshot_id · revision 으로.
// policy:   초안의 앵커는 {paragraph, quote} 만 적는다. quote 는 그 문단 안에서 정확히 한 번 나와야 하고,
//           start · end · source_sha256 은 여기서 계산한다. scope.last_paragraph 의 "last" 는 마지막 문단 번호로 바꾼다.
//           validatePolicy 를 통과한 결과만 쓴다.
// check:    저장된 스냅숏과 편집 기준을 다시 검증하고 해시를 보고한다.
// 종료 코드: 0 성공 · 1 오류.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  TEXT_NORMALIZATION,
  normalizeSourceText,
  sourceTextSha256,
  surfaceMetrics,
  validatePolicy,
  validateSnapshot,
  type Issue,
  type SourceContext,
} from '../../../../packages/library-pipeline/src/story/index'

const SOURCES_FILE = 'scripts/lcp/story/pilot/sources.json'
const POLICY_DIR = 'scripts/lcp/story/pilot'
const OUT_DIR = 'work/lcp-story-pilot/snapshots'
const EXTRACTION_PROFILE = 'se-web-xhtml-v1'

class BuildError extends Error {}

// ── 원천 메타데이터 ─────────────────────────────────────────────────────────

interface RawFile {
  file: string
  sha256: string
  bytes: number
  url: string
  http_date: string
  http_last_modified: string
  etag: string
}

interface SourceEntry {
  name: string
  article_id: string
  raw: RawFile
  snapshot: {
    snapshot_id: string
    work: { work_key: string; title: string; author: string | null; original_language: string }
    edition: Record<string, unknown>
    captured_at: string
    coverage: string
    coverage_note: string
    rights: unknown[]
  }
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new BuildError(`파일이 없다: ${path}`)
  const bytes = readFileSync(path)
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

function loadEntry(name: string): SourceEntry {
  const sources = readJson(SOURCES_FILE) as { extraction_profile?: string; works?: SourceEntry[] }
  if (sources.extraction_profile !== EXTRACTION_PROFILE) {
    throw new BuildError(`${SOURCES_FILE} 의 extraction_profile 이 ${EXTRACTION_PROFILE} 가 아니다`)
  }
  const found = (sources.works ?? []).filter((w) => w.name === name)
  if (found.length !== 1) throw new BuildError(`${SOURCES_FILE} 에 작업 ${name} 이 정확히 하나 있어야 한다(찾은 수 ${found.length})`)
  return found[0]!
}

// ── XHTML → 문단 (se-web-xhtml-v1) ──────────────────────────────────────────

/** 본문 문단을 담는 요소와 인라인 요소만 받는다. 이 밖의 요소(각주 링크 · 줄바꿈 · 그림 등)는 조용히 버리지 않고 오류로 멈춘다. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'article', 'section', 'h2', 'h3', 'p', 'blockquote', 'header', 'footer', 'abbr', 'i', 'em', 'b', 'strong', 'span',
])
/** 작품 제목(h2)과 장 번호(h3)는 본문 문단이 아니다 — 제목은 work.title 과 대조하고, 장 시작 문단은 coverage_note 에 기록한다. */
const HEADING_TAGS: ReadonlySet<string> = new Set(['h2', 'h3'])

/** 조판용 보이지 않는 문자. 낱말 · 문장부호는 바꾸지 않는다. */
const FLATTEN: ReadonlyArray<{ char: string; to: string; name: string }> = [
  { char: '⁠', to: '', name: 'U+2060 WORD JOINER → 삭제' },
  { char: ' ', to: '', name: 'U+200A HAIR SPACE → 삭제' },
  { char: ' ', to: ' ', name: 'U+00A0 NO-BREAK SPACE → U+0020' },
]

const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10))
    const named = NAMED_ENTITIES[body]
    if (named === undefined) throw new BuildError(`알 수 없는 문자 참조 ${whole}`)
    return named
  })
}

interface Extracted {
  title: string
  paragraphs: Array<{ text: string; in_blockquote: boolean }>
  sections: Array<{ label: string; first_paragraph: number }>
  flattened: Record<string, number>
}

function extractArticle(xhtml: string, articleId: string): string {
  const open = `<article id="${articleId}"`
  const start = xhtml.indexOf(open)
  if (start < 0 || xhtml.indexOf(open, start + 1) >= 0) throw new BuildError(`${open} 가 정확히 하나 있어야 한다`)
  const end = xhtml.indexOf('</article>', start)
  if (end < 0) throw new BuildError('</article> 가 없다 — 파일이 잘렸을 수 있다')
  const body = xhtml.slice(start, end + '</article>'.length)
  if (body.indexOf('<article', open.length) >= 0) throw new BuildError('중첩된 <article> 은 이 추출 규칙이 다루지 않는다')
  return body
}

function extractParagraphs(article: string): Extracted {
  const flattened: Record<string, number> = Object.fromEntries(FLATTEN.map((f) => [f.name, 0]))
  const flatten = (s: string): string => {
    let out = s
    for (const f of FLATTEN) {
      const n = out.split(f.char).length - 1
      if (n > 0) {
        flattened[f.name] = (flattened[f.name] ?? 0) + n
        out = out.split(f.char).join(f.to)
      }
    }
    return out
  }
  const collapse = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ').trim()

  const stack: string[] = []
  const paragraphs: Extracted['paragraphs'] = []
  const sections: Extracted['sections'] = []
  let title = ''
  let heading: string[] | null = null
  let para: string[] | null = null
  let pendingSection: string | null = null

  const tokenRe = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)([^<>]*?)(\/?)>|([^<]+)/g
  let cursor = 0
  for (let m = tokenRe.exec(article); m !== null; m = tokenRe.exec(article)) {
    if (m.index !== cursor) throw new BuildError(`해석할 수 없는 표기(주석 · CDATA 등) 위치 ${cursor}: ${JSON.stringify(article.slice(cursor, cursor + 40))}`)
    cursor = tokenRe.lastIndex
    const [, closing, rawName, , selfClosing, text] = m
    if (text !== undefined) {
      const decoded = decodeEntities(text)
      if (heading !== null) heading.push(decoded)
      else if (para !== null) para.push(decoded)
      else if (decoded.trim() !== '') throw new BuildError(`문단 밖의 글자: ${JSON.stringify(decoded.trim().slice(0, 60))}`)
      continue
    }
    const name = rawName!.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) throw new BuildError(`이 추출 규칙이 받지 않는 요소 <${name}> — 규칙을 넓히기 전에 원천을 확인한다`)
    if (selfClosing === '/') throw new BuildError(`빈 요소 <${name}/> 는 이 추출 규칙이 다루지 않는다`)
    if (closing === '/') {
      const top = stack.pop()
      if (top !== name) throw new BuildError(`닫는 요소 </${name}> 가 열린 <${top ?? '(없음)'}> 와 맞지 않는다`)
      if (HEADING_TAGS.has(name)) {
        const label = collapse(flatten((heading ?? []).join('')))
        heading = null
        if (name === 'h2') title = label
        else pendingSection = label
      } else if (name === 'p') {
        const value = collapse(flatten((para ?? []).join('')))
        para = null
        if (value === '') throw new BuildError(`빈 문단(${paragraphs.length})`)
        paragraphs.push({ text: value, in_blockquote: stack.includes('blockquote') })
        if (pendingSection !== null) {
          sections.push({ label: pendingSection, first_paragraph: paragraphs.length - 1 })
          pendingSection = null
        }
      }
      continue
    }
    stack.push(name)
    if (HEADING_TAGS.has(name)) {
      if (heading !== null || para !== null) throw new BuildError(`<${name}> 가 다른 제목 · 문단 안에 있다`)
      heading = []
    } else if (name === 'p') {
      if (para !== null || heading !== null) throw new BuildError('문단 안에 문단이 있다')
      para = []
    }
  }
  if (cursor !== article.length) throw new BuildError(`끝까지 해석하지 못했다(위치 ${cursor})`)
  if (stack.length !== 0) throw new BuildError(`닫히지 않은 요소: ${stack.join(' > ')}`)
  if (pendingSection !== null) throw new BuildError(`장 제목 ${pendingSection} 뒤에 문단이 없다`)
  return { title, paragraphs, sections, flattened }
}

function ranges(indices: readonly number[]): string {
  const out: string[] = []
  let i = 0
  while (i < indices.length) {
    let j = i
    while (j + 1 < indices.length && indices[j + 1] === indices[j]! + 1) j++
    out.push(i === j ? `${indices[i]}` : `${indices[i]}–${indices[j]}`)
    i = j + 1
  }
  return out.join(' · ')
}

/** 추출 결과의 구조를 사람이 읽을 문장으로 — 코드가 계산한 문단 번호만 쓴다. */
function structureNote(ex: Extracted): string {
  const parts: string[] = [`추출 규칙 ${EXTRACTION_PROFILE}: 문단 ${ex.paragraphs.length}개(0부터 셈).`]
  if (ex.sections.length > 0) {
    parts.push(`원문 장 번호 제목(${ex.sections.map((s) => s.label).join(' · ')})은 본문에서 뺐고, 각 장의 첫 문단은 ${ex.sections.map((s) => s.first_paragraph).join(' · ')} 이다.`)
  }
  const quoted = ex.paragraphs.flatMap((p, i) => (p.in_blockquote ? [i] : []))
  if (quoted.length > 0) parts.push(`원문에서 인용 블록(blockquote)이던 문단: ${ranges(quoted)}.`)
  return parts.join(' ')
}

// ── 쓰기 ───────────────────────────────────────────────────────────────────

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** 원문 스냅숏은 덮지 않는다 — 같으면 그대로, 다르면 거부. */
function writeOnce(path: string, content: string): 'written' | 'unchanged' {
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') === content) return 'unchanged'
    throw new BuildError(`overwrite_refused: ${path} 에 다른 내용이 있다 — sources.json 의 snapshot_id · revision 을 새로 정해 다시 만든다`)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  return 'written'
}

/** 다시 계산되는 파생 파일(문단 목록 · 보고 · 편집 기준 결과)은 갱신한다. */
function writeDerived(path: string, content: string): 'written' | 'unchanged' {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return 'unchanged'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  return 'written'
}

function fail(stage: string, errors: Issue[]): never {
  throw new BuildError(`${stage} 검증 실패:\n${errors.map((e) => `  ${e.code} ${e.path} — ${e.message}`).join('\n')}`)
}

// ── 명령 ───────────────────────────────────────────────────────────────────

function snapshotPath(name: string): string {
  return join(OUT_DIR, `${name}.snapshot.json`)
}

function buildSnapshot(name: string, now: Date): Record<string, unknown> {
  const entry = loadEntry(name)
  const bytes = readFileSync(entry.raw.file)
  const rawSha = createHash('sha256').update(bytes).digest('hex')
  if (rawSha !== entry.raw.sha256 || bytes.length !== entry.raw.bytes) {
    throw new BuildError(`원천 파일이 기록과 다르다: ${entry.raw.file} sha256 ${rawSha} · ${bytes.length}B (기록 ${entry.raw.sha256} · ${entry.raw.bytes}B)`)
  }
  const xhtml = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const ex = extractParagraphs(extractArticle(xhtml, entry.article_id))
  if (ex.title !== entry.snapshot.work.title) {
    throw new BuildError(`원천 제목 ${JSON.stringify(ex.title)} 이 work.title ${JSON.stringify(entry.snapshot.work.title)} 과 다르다`)
  }
  const joined = ex.paragraphs.map((p) => p.text).join('\n\n')
  const text = normalizeSourceText(joined)
  const snapshot = {
    schema: 'lcp-story/source-snapshot@1',
    snapshot_id: entry.snapshot.snapshot_id,
    synthetic: false,
    work: entry.snapshot.work,
    edition: entry.snapshot.edition,
    captured_at: entry.snapshot.captured_at,
    normalization: TEXT_NORMALIZATION,
    coverage: entry.snapshot.coverage,
    coverage_note: `${entry.snapshot.coverage_note} ${structureNote(ex)}`,
    text,
    text_sha256: sourceTextSha256(text),
    rights: entry.snapshot.rights,
  }
  const checked = validateSnapshot(snapshot, now)
  if (!checked.ok || !checked.value) fail('스냅숏', checked.errors)
  const ctx = checked.value

  const snapshotStatus = writeOnce(snapshotPath(name), pretty(snapshot))
  const listing = ctx.paragraphs
    .map((p) => `[${p.index}] ${p.start}-${p.end}${ex.paragraphs[p.index]?.in_blockquote ? ' (blockquote)' : ''}\n${text.slice(p.start, p.end)}\n`)
    .join('\n')
  writeDerived(join(OUT_DIR, `${name}.paragraphs.txt`), listing)
  const report = {
    work: name,
    extraction_profile: EXTRACTION_PROFILE,
    raw: { ...entry.raw, verified_sha256: rawSha },
    title: ex.title,
    text_sha256: ctx.sha256,
    identity_sha256: ctx.identity_sha256,
    paragraphs: ctx.paragraphs.length,
    surface_metrics: surfaceMetrics([text]),
    sections: ex.sections,
    blockquote_paragraphs: ex.paragraphs.flatMap((p, i) => (p.in_blockquote ? [i] : [])),
    flattened_characters: ex.flattened,
    normalize_changed_text: text !== joined,
    snapshot_file: snapshotPath(name),
    snapshot_file_status: snapshotStatus,
  }
  writeDerived(join(OUT_DIR, `${name}.build.json`), pretty(report))
  return report
}

function loadSnapshotContext(name: string, now: Date): SourceContext {
  const checked = validateSnapshot(readJson(snapshotPath(name)), now)
  if (!checked.ok || !checked.value) fail('스냅숏', checked.errors)
  return checked.value
}

interface DraftAnchor {
  paragraph: number
  quote: string
}

function resolveAnchor(raw: unknown, path: string, ctx: SourceContext): Record<string, unknown> {
  const a = raw as Partial<DraftAnchor>
  if (typeof a?.paragraph !== 'number' || !Number.isInteger(a.paragraph) || typeof a.quote !== 'string' || a.quote.length === 0) {
    throw new BuildError(`${path}: 앵커 초안은 정수 paragraph 와 비지 않은 quote 를 가져야 한다`)
  }
  const span = ctx.paragraphs[a.paragraph]
  if (!span) throw new BuildError(`${path}: 문단 ${a.paragraph} 이 없다(0..${ctx.paragraphs.length - 1})`)
  const paraText = ctx.text.slice(span.start, span.end)
  const first = paraText.indexOf(a.quote)
  if (first < 0) throw new BuildError(`${path}: 문단 ${a.paragraph} 에 인용 ${JSON.stringify(a.quote)} 이 없다`)
  if (paraText.indexOf(a.quote, first + 1) >= 0) throw new BuildError(`${path}: 문단 ${a.paragraph} 에 인용이 둘 이상 있다 — 인용을 늘려 하나로 좁힌다`)
  const start = span.start + first
  return { source_sha256: ctx.sha256, paragraph: a.paragraph, start, end: start + a.quote.length, quote: a.quote }
}

type Json = Record<string, unknown>

function resolveItems(items: unknown, path: string, ctx: SourceContext): Json[] {
  if (!Array.isArray(items)) throw new BuildError(`${path} 는 배열이어야 한다`)
  return items.map((item: Json, i) => {
    const anchors = item.anchors
    if (!Array.isArray(anchors)) throw new BuildError(`${path}[${i}].anchors 는 배열이어야 한다`)
    return { ...item, anchors: anchors.map((a, j) => resolveAnchor(a, `${path}[${i}].anchors[${j}]`, ctx)) }
  })
}

function buildPolicy(name: string, inPath: string, outPath: string, now: Date): Record<string, unknown> {
  const ctx = loadSnapshotContext(name, now)
  const draft = readJson(inPath) as Json
  const preserve = draft.preserve as Json
  const groups = ['events', 'motivations', 'causality', 'foreshadowing', 'tone_devices'] as const
  const entry = draft.entry_scene as Json
  const lastParagraph = ctx.paragraphs.length - 1
  const production = (draft.production as Json[]).map((item) => {
    const scope = item.scope as Json
    return {
      ...item,
      scope: {
        first_paragraph: scope.first_paragraph,
        last_paragraph: scope.last_paragraph === 'last' ? lastParagraph : scope.last_paragraph,
      },
    }
  })
  const policy = {
    schema: draft.schema,
    policy_id: draft.policy_id,
    policy_version: draft.policy_version,
    work_key: draft.work_key,
    source_sha256: ctx.sha256,
    reason_to_read: draft.reason_to_read,
    preserve: Object.fromEntries(groups.map((g) => [g, resolveItems(preserve[g], `preserve.${g}`, ctx)])),
    changeable: draft.changeable,
    sensitive_content: resolveItems(draft.sensitive_content, 'sensitive_content', ctx),
    entry_scene: {
      anchors: (entry.anchors as unknown[]).map((a, j) => resolveAnchor(a, `entry_scene.anchors[${j}]`, ctx)),
      spoiler_free: entry.spoiler_free,
      rationale: entry.rationale,
    },
    review_concerns: draft.review_concerns,
    production,
  }
  const checked = validatePolicy(policy, ctx)
  if (!checked.ok || !checked.value) fail('편집 기준', checked.errors)
  const status = writeDerived(outPath, pretty(policy))
  return {
    work: name,
    policy_file: outPath,
    policy_file_status: status,
    text_sha256: ctx.sha256,
    identity_sha256: ctx.identity_sha256,
    policy_sha256: checked.value.policy_sha256,
    targets: Object.fromEntries([...checked.value.items].map(([key, v]) => [key, v.target_sha256])),
  }
}

function checkWork(name: string, now: Date): Record<string, unknown> {
  const ctx = loadSnapshotContext(name, now)
  const policyPath = join(POLICY_DIR, `${name}.policy.json`)
  const checked = validatePolicy(readJson(policyPath), ctx)
  if (!checked.ok || !checked.value) fail('편집 기준', checked.errors)
  return {
    work: name,
    paragraphs: ctx.paragraphs.length,
    surface_metrics: surfaceMetrics([ctx.text]),
    text_sha256: ctx.sha256,
    identity_sha256: ctx.identity_sha256,
    policy_file: policyPath,
    policy_sha256: checked.value.policy_sha256,
    targets: Object.fromEntries([...checked.value.items].map(([key, v]) => [key, v.target_sha256])),
  }
}

// ── 진입 ───────────────────────────────────────────────────────────────────

const OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  snapshot: new Set(['work', 'now']),
  policy: new Set(['work', 'in', 'out', 'now']),
  check: new Set(['work', 'now']),
}

function parseArgs(argv: readonly string[]): { command: string; values: Map<string, string> } {
  const [command, ...rest] = argv
  const allowed = command !== undefined && Object.hasOwn(OPTIONS, command) ? OPTIONS[command] : undefined
  if (!command || !allowed) throw new BuildError(`알 수 없는 명령: ${command ?? '(없음)'} — snapshot · policy · check`)
  const values = new Map<string, string>()
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i]!
    const value = rest[i + 1]
    const key = flag.startsWith('--') ? flag.slice(2) : ''
    if (!allowed.has(key)) throw new BuildError(`${command} 에 쓸 수 없는 인자: ${flag}`)
    if (value === undefined || value.startsWith('--')) throw new BuildError(`${flag} 의 값이 없다`)
    if (values.has(key)) throw new BuildError(`${flag} 가 두 번 있다`)
    values.set(key, value)
  }
  const work = values.get('work')
  if (!work || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(work)) throw new BuildError('--work <a-z0-9- 이름> 이 필요하다')
  return { command, values }
}

function main(argv: readonly string[], clock: Date): number {
  try {
    if (!existsSync(SOURCES_FILE)) throw new BuildError(`저장소 루트에서 실행한다(${SOURCES_FILE} 가 보이지 않는다)`)
    const { command, values } = parseArgs(argv)
    const nowArg = values.get('now')
    const now = nowArg === undefined ? clock : new Date(nowArg)
    if (Number.isNaN(now.getTime())) throw new BuildError(`--now 가 시각이 아니다: ${nowArg}`)
    const work = values.get('work')!
    let result: Record<string, unknown>
    if (command === 'snapshot') {
      result = buildSnapshot(work, now)
    } else if (command === 'policy') {
      const inPath = values.get('in')
      if (!inPath) throw new BuildError('policy 는 --in <draft.json> 이 필요하다')
      result = buildPolicy(work, inPath, values.get('out') ?? join(POLICY_DIR, `${work}.policy.json`), now)
    } else {
      result = checkWork(work, now)
    }
    process.stdout.write(pretty({ ok: true, command, ...result }))
    return 0
  } catch (e) {
    if (e instanceof BuildError || e instanceof SyntaxError) {
      process.stderr.write(`${pretty({ ok: false, error: e.message })}`)
      return 1
    }
    throw e
  }
}

process.exitCode = main(process.argv.slice(2), new Date())
