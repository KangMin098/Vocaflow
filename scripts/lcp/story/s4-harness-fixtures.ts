// scripts/lcp/story/s4-harness-fixtures.ts
//
// T-0174 LCP Story S4 — 관리자 이야기 라인 격리 하네스용 후보 파일을 만든다(브라우저 하네스 전용 · 합성).
// 모든 출력은 synthetic-for-harness 다: 본문은 packages/library-pipeline/src/story/fixtures/gull-rock.* (직접 쓴 합성 이야기)이고,
// 「실제 원천 형태」 변형은 synthetic=false · external_file 로 바꿔 실제 S2 함수(validateSnapshot · validatePolicy · validateEdition ·
// reviewBindingFor · requiredChecks)로 해시 · 결속을 다시 계산했을 뿐이다. 실제 도서 · 실제 권리 확인 · 실제 검수가 아니다.
// 검증되는 객체(.strict 스키마) 안에는 표지를 넣을 자리가 없어 제목 · edition_label 에 "(synthetic-for-harness)" 를 넣고,
// 같은 표지를 manifest.json 에 둔다.
//
// 변형 세 벌(같은 본문 · 같은 work_key · 원천 정체만 다름 — 발행본 유일성 충돌 없이 시나리오를 나눈다):
//   a — source_url 에 쿼리 · 프래그먼트가 있는 http URL(화면이 값을 바꾸지 않고 링크로 보여야 한다)
//   b — source_url null
//   c — source_url 이 http/https 가 아닌 URL(ftp) — 링크가 아니라 글자로만 보여야 한다
// 각 변형: source · edition(v1) · edition-v2(제목만 다른 새 판 — not_latest_version 시나리오) · review(독립 세션 · 승인) · review-self(생산자 세션 = 검수자 세션)
// 출력: work/lcp-story-s4/story-fixtures/(gitignored). 그 밖: source.synthetic.json · edition.synthetic.json(합성 원본 그대로 — fixture_only 거부) · policy.json · broken.json(JSON 아님)
//
//   pnpm exec tsx scripts/lcp/story/s4-harness-fixtures.ts       (저장소 루트, 결정적 — 다시 돌려도 같은 바이트)

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  requiredChecks,
  reviewBindingFor,
  validateEdition,
  validatePolicy,
  validateSnapshot,
} from '../../../packages/library-pipeline/src/story/index'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '../../..')
const SRC = path.join(REPO, 'packages/library-pipeline/src/story/fixtures')
// 커밋하지 않는 작업 폴더(.gitignore /work/) — 변경 파일 수를 늘리지 않고 매 실행 다시 만든다
const OUT = path.resolve(process.env.LCP_STORY_HARNESS_FIXTURES ?? path.join(REPO, 'work/lcp-story-s4/story-fixtures'))
/** 고정 시각 — 시계를 읽지 않는다(스냅숏 captured_at 보다 뒤 · 검수 reviewed_at 보다 뒤). */
const NOW = new Date('2026-10-25T12:00:00+09:00')
const EDITION_KEY = 'story-b1'
const PRODUCER_SESSION = 'harness-producer-session'
const REVIEWER_SESSION = 'harness-reviewer-session'
const LABEL = 'synthetic-for-harness'

const read = (name: string): Json => JSON.parse(fs.readFileSync(path.join(SRC, `gull-rock.${name}.json`), 'utf8')) as Json

const VARIANTS = {
  a: 'http://example.org/harness/gull-rock?edition=r1&lang=en#para-3',
  b: null,
  c: 'ftp://example.org/harness/gull-rock.txt',
} as const

function snapshotFor(key: keyof typeof VARIANTS): Json {
  const s = read('snapshot')
  s.snapshot_id = `harness-gull-rock-${key}`
  s.synthetic = false
  s.work.title = `The Keeper of Gull Rock (${LABEL} ${key})`
  s.edition.source_kind = 'external_file'
  s.edition.source_url = VARIANTS[key]
  s.edition.edition_label = `Harness external-file variant ${key} (${LABEL}) — authored test story, not a real book`
  s.edition.revision = `harness-${key}`
  s.coverage_note = `하네스 전용 변형 ${key} — 합성 본문(gull-rock)을 외부 파일 원천처럼 적었다. 실제 도서 · 실제 권리 확인이 아니다.`
  s.rights = [{ asset: 'source_text', status: 'claimed_by_source', basis: `하네스 전용 주장(${LABEL}) — 실제 권리 심사 아님`, evidence_ref: 'harness-only', checked_by: null, checked_at: null }]
  return s
}

function must<T>(r: { value: T | null; errors: unknown[] }, what: string): T {
  if (!r.value) throw new Error(`${what}: ${JSON.stringify(r.errors)}`)
  return r.value
}

function write(name: string, value: unknown, files: Record<string, string>) {
  const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`
  fs.writeFileSync(path.join(OUT, name), text)
  files[name] = createHash('sha256').update(text).digest('hex')
}

fs.mkdirSync(OUT, { recursive: true })
const files: Record<string, string> = {}
const policy = read('policy')
write('policy.json', policy, files)
write('source.synthetic.json', read('snapshot'), files)
write('edition.synthetic.json', read('story-b1.edition.out'), files)
write('broken.json', '{ "schema": "lcp-story/source-snapshot@1", "text": \n', files)

const variants: Record<string, Json> = {}
for (const key of Object.keys(VARIANTS) as (keyof typeof VARIANTS)[]) {
  const snapshot = snapshotFor(key)
  const source = must(validateSnapshot(snapshot, NOW), `snapshot ${key}`)
  const pol = must(validatePolicy(policy, source), `policy ${key}`)
  const slot = pol.items.get(EDITION_KEY)
  if (!slot) throw new Error('story-b1 not in policy production')

  const edition = (title: string | null): Json => {
    const art = read('story-b1.edition.out')
    art.produced_by = { agent: 'claude-code', session_id: PRODUCER_SESSION, provenance: 'ai_generated' }
    art.binding = { source_sha256: source.sha256, source_identity_sha256: source.identity_sha256, policy_sha256: pol.policy_sha256, target_sha256: slot.target_sha256 }
    if (title) art.title = title
    return art
  }
  const v1 = edition(null)
  const v2 = edition(`The Keeper of Gull Rock — second draft (${LABEL})`)
  const ctx = { source, policy: pol, edition_key: EDITION_KEY, task_id: String(v1.task_id) }
  const r1 = must(validateEdition(v1, ctx), `edition ${key}`)
  must(validateEdition(v2, ctx), `edition v2 ${key}`)
  const review = (session: string, id: string): Json => ({
    schema: 'lcp-story/review@1',
    review_id: id,
    binding: reviewBindingFor(ctx, r1),
    reviewer: { kind: 'ai_model', agent: 'codex', session_id: session, role: `하네스 검수 입력(${LABEL}) — 실제 검토 아님` },
    provenance: 'ai_review',
    checks: requiredChecks(r1.edition).map((check) => ({ check, verdict: 'pass', note: `하네스 입력(${LABEL})` })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T10:00:00+09:00',
  })
  write(`source.${key}.json`, snapshot, files)
  write(`edition.${key}.json`, v1, files)
  write(`edition.${key}.v2.json`, v2, files)
  write(`review.${key}.json`, review(REVIEWER_SESSION, `harness-review-${key}`), files)
  write(`review.${key}.self.json`, review(PRODUCER_SESSION, `harness-review-${key}-self`), files)
  variants[key] = { source_url: VARIANTS[key], identity_sha256: source.identity_sha256, text_sha256: source.sha256, policy_sha256: pol.policy_sha256, target_sha256: slot.target_sha256, edition_sha256: r1.edition_sha256 }
}

write('manifest.json', {
  label: LABEL,
  note: '격리 브라우저 하네스 전용 합성 입력. 실제 도서 · 실제 권리 · 실제 검수가 아니다. scripts/lcp/story/s4-harness-fixtures.ts 가 결정적으로 만든다.',
  derived_from: 'packages/library-pipeline/src/story/fixtures/gull-rock.*',
  now: NOW.toISOString(),
  producer_session: PRODUCER_SESSION,
  reviewer_session: REVIEWER_SESSION,
  edition_key: EDITION_KEY,
  variants,
  files,
}, {})
console.log(`wrote ${Object.keys(files).length} files → ${path.relative(REPO, OUT)}`)
