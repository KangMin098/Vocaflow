// scripts/lcp/story/s5-reader-fixtures.ts
//
// T-0176 LCP Story S5 — 학습자 독서 격리 하네스의 **합성** 가짜 DB 시작 상태를 만든다(SYNTHETIC — 실제 도서 · 실제 권리 · 실제 발행 아님).
// 본문 · 앵커 · 원천 메타는 packages/library-pipeline/src/story/fixtures/gull-rock.* (직접 쓴 합성 이야기) 에서만 가져온다.
// 발행본은 S3 story.releases / release_units 가 가질 값의 모양을 흉내 낸다(발행 키 = lsr_ + 32 hex, 합성 라벨에서 결정적으로 만든다).
//
//   R_B1 — 작품 synthetic-gull-rock · story-b1 · story_edition · complete_work · adapted_full_work · 8 단위 · source_url = 정규화되면 달라지는 https(쿼리 · 프래그먼트)
//   R_A2 — 같은 작품 · easy-a2 · easy_reader · complete_work · adapted_full_work · 6 단위 · source_url = javascript:(링크 금지)
//   R_EP — 작품 synthetic-gull-rock-storm · storm-episode · story_edition · episode · adapted_partial · 3 단위(제목 있음) · source_url = data:(링크 금지)
//   R_WD — 철회된 발행본(서가 · 리더 · 기록 모두 닫힘) · 학습자 A 의 옛 진도 기록이 있다(이력 · release_available=false)
//   R_RH — 권리 보류(원천 권리 미확인) 발행본(서가 · 리더 · 기록 모두 닫힘)
// 학습자: A(활성 프로필) · B(프로필 행 없음 — 막지 않음) · S(정지).
// 출력: work/lcp-story-s5/reader-fixtures/{db.json,manifest.json} (gitignored · 매 실행 다시 만든다 · 결정적)
//
//   pnpm exec tsx scripts/lcp/story/s5-reader-fixtures.ts     (저장소 루트)

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const REPO = path.resolve(__dirname, '../../..')
const SRC = path.join(REPO, 'packages/library-pipeline/src/story/fixtures')
const OUT = path.resolve(process.env.LCP_STORY_READER_FIXTURES ?? path.join(REPO, 'work/lcp-story-s5/reader-fixtures'))
export const SYNTHETIC = 'SYNTHETIC — lcp-story S5 reader harness (gull-rock authored test story, not a real book)'

const read = (name: string): Json => JSON.parse(fs.readFileSync(path.join(SRC, `gull-rock.${name}.json`), 'utf8')) as Json
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const key = (label: string) => `lsr_${sha(`s5-reader-harness:${label}`).slice(0, 32)}`

export const USERS = {
  A: '00000000-0000-4000-8000-0000000000aa',
  B: '00000000-0000-4000-8000-0000000000bb',
  S: '00000000-0000-4000-8000-0000000000ee',
} as const

export const RELEASE_KEYS = { B1: key('b1'), A2: key('a2'), EP: key('ep'), WD: key('wd'), RH: key('rh') } as const

export interface ReaderSource {
  identity_sha256: string
  text_sha256: string
  title: string
  author: string | null
  original_language: string
  text_language: string
  translator: string | null
  edition_label: string
  coverage: string
  source_url: string | null
}
export interface ReaderUnit {
  unit_index: number
  unit_id: string
  unit_title: string | null
  body: string
  anchors: { source_sha256: string; paragraph: number; start: number; end: number; quote: string }[]
}
export interface ReaderRelease {
  release_key: string
  label: string
  work_key: string
  edition_key: string
  kind: string
  coverage: string
  completion_label: string
  counts_as_work_completion: boolean
  title: string
  hook_text: string
  target_cefr: string | null
  published_at: string
  withdrawn_at: string | null
  rights_ok: boolean
  unit_count: number
  units: ReaderUnit[]
  source: ReaderSource
}
export interface ReaderProgress {
  user_id: string
  release_key: string
  last_unit_index: number
  furthest_unit_index: number
  completed_units: number[]
  completed_at: string | null
  updated_seq: number
}
export interface ReaderDbState {
  synthetic: string
  seq: number
  reader_context_missing: boolean
  catalog_hide: string[]
  releases: ReaderRelease[]
  profiles: Record<string, { status: string }>
  progress: ReaderProgress[]
  faults: Record<string, { kind: 'network' | 'error'; message?: string; times: number }>
  rpc_log: Json[]
}

type ReleaseInput = Omit<ReaderRelease, 'release_key' | 'label' | 'published_at' | 'counts_as_work_completion' | 'completion_label' | 'unit_count' | 'withdrawn_at' | 'rights_ok'> &
  Partial<Pick<ReaderRelease, 'withdrawn_at' | 'rights_ok'>>

function build(): ReaderDbState {
  const snapshot = read('snapshot')
  const b1 = read('story-b1.edition.out')
  const a2 = read('easy-a2.edition.out')
  const sourceBase = (url: string | null): ReaderSource => ({
    identity_sha256: sha(`identity:${url ?? 'null'}`),
    text_sha256: snapshot.text_sha256 as string,
    title: snapshot.work.title as string,
    author: snapshot.work.author as string | null,
    original_language: snapshot.work.original_language as string,
    text_language: snapshot.edition.text_language as string,
    translator: snapshot.edition.translator as string | null,
    edition_label: snapshot.edition.edition_label as string,
    coverage: snapshot.coverage as string,
    source_url: url,
  })
  const units = (art: Json, from = 0, to: number = art.units.length, titles: (string | null)[] = []): ReaderUnit[] =>
    (art.units as Json[]).slice(from, to).map((u, i) => ({
      unit_index: i,
      unit_id: u.unit_id,
      unit_title: titles[i] ?? u.title ?? null,
      body: u.text,
      anchors: (u.source_anchors as Json[]).map((a) => ({ source_sha256: a.source_sha256, paragraph: a.paragraph, start: a.start, end: a.end, quote: a.quote })),
    }))
  const release = (k: keyof typeof RELEASE_KEYS, o: ReleaseInput): ReaderRelease => ({
    release_key: RELEASE_KEYS[k],
    label: k,
    withdrawn_at: null,
    rights_ok: true,
    published_at: '2026-10-25T03:00:00.000Z',
    counts_as_work_completion: o.coverage === 'complete_work',
    completion_label: o.coverage === 'complete_work' ? 'adapted_full_work' : 'adapted_partial',
    ...o,
    unit_count: o.units.length,
  })
  const releases = [
    release('B1', {
      work_key: 'synthetic-gull-rock', edition_key: 'story-b1', kind: 'story_edition', coverage: 'complete_work',
      title: `${b1.title} (synthetic)`, hook_text: b1.hook.text, target_cefr: 'B1', units: units(b1),
      // URL.href 라면 바뀌었을 값(대문자 스킴 · 호스트 · 퍼센트 인코딩 · 쿼리 · 프래그먼트) — 화면은 저장값 그대로 링크해야 한다
      source: sourceBase('HTTPS://Example.ORG/harness/Gull%2DRock?edition=r1&lang=en&q=a%20b#para-3'),
    }),
    release('A2', {
      work_key: 'synthetic-gull-rock', edition_key: 'easy-a2', kind: 'easy_reader', coverage: 'complete_work',
      title: `${a2.title} (synthetic easy)`, hook_text: a2.hook.text, target_cefr: 'A2', units: units(a2),
      source: sourceBase('javascript:alert(document.domain)'),
    }),
    release('EP', {
      work_key: 'synthetic-gull-rock-storm', edition_key: 'storm-episode', kind: 'story_edition', coverage: 'episode',
      title: 'The Storm Night (synthetic episode)', hook_text: 'The lamp is dark, and a ship is coming toward the rocks. (synthetic)', target_cefr: null,
      units: units(b1, 4, 7, ['Storm', 'The fall', 'The brig']),
      source: sourceBase('data:text/html,<b>synthetic</b>'),
    }),
    release('WD', {
      work_key: 'synthetic-gull-rock-withdrawn', edition_key: 'withdrawn-b1', kind: 'story_edition', coverage: 'complete_work',
      title: 'Withdrawn Synthetic Edition', hook_text: 'Withdrawn hook (synthetic).', target_cefr: 'B1', units: units(b1, 0, 3),
      source: sourceBase(null), withdrawn_at: '2026-10-25T04:00:00.000Z',
    }),
    release('RH', {
      work_key: 'synthetic-gull-rock-held', edition_key: 'held-b1', kind: 'story_edition', coverage: 'complete_work',
      title: 'Rights-Held Synthetic Edition', hook_text: 'Rights-held hook (synthetic).', target_cefr: 'B1', units: units(b1, 0, 2),
      source: sourceBase(null), rights_ok: false,
    }),
  ]
  return {
    synthetic: SYNTHETIC,
    seq: 10,
    reader_context_missing: false,
    /** 하네스 전용 경합 흉내 — 이 발행 키는 story_catalog 에서만 빠진다(다른 RPC 는 그대로). */
    catalog_hide: [] as string[],
    releases,
    profiles: { [USERS.A]: { status: 'active' }, [USERS.S]: { status: 'suspended' } } as Record<string, { status: string }>,
    // 학습자 A 의 옛 기록 — 철회된 발행본(이력으로만 남는다)
    progress: [{ user_id: USERS.A, release_key: RELEASE_KEYS.WD, last_unit_index: 1, furthest_unit_index: 1, completed_units: [] as number[], completed_at: null as string | null, updated_seq: 1 }],
    faults: {} as Record<string, { kind: 'network' | 'error'; message?: string; times: number }>,
    rpc_log: [] as Json[],
  }
}


if (process.argv[1] && /s5-reader-fixtures\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  fs.mkdirSync(OUT, { recursive: true })
  const db = build()
  const text = `${JSON.stringify(db, null, 2)}\n`
  fs.writeFileSync(path.join(OUT, 'db.json'), text)
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    `${JSON.stringify({ label: SYNTHETIC, derived_from: 'packages/library-pipeline/src/story/fixtures/gull-rock.*', db_sha256: sha(text), users: USERS, release_keys: RELEASE_KEYS }, null, 2)}\n`,
  )
  console.log(`wrote ${path.relative(REPO, OUT)}/db.json (${db.releases.length} releases · sha256 ${sha(text).slice(0, 12)})`)
}

export { build as buildReaderDb }
