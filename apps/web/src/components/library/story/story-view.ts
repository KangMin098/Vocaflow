// apps/web/src/components/library/story/story-view.ts
//
// LCP Story S5 학습자 화면의 순수 보조 함수(렌더 · 네트워크 없음). 계약: docs/LCP_STORY.md §2 · §12 · §13.
// - 작품은 workKey 로만 묶는다(제목으로 합치지 않는다). 같은 작품의 여러 판본은 작품 하나다.
// - 수는 받은 행에서 센다(지어낸 수 없음 · AGENTS I5).
// - 완료 문구는 「모든 단위를 명시적으로 표시」했을 때만 완료를 말한다. 각색 완독 ≠ 원문 완독 · 숙달 · FSRS.

import type { PublicEvent } from '@/lib/analytics/events'
import type {
  StoryCatalogPageState,
  StoryCatalogRelease,
  StoryCompletionLabel,
  StoryCoverage,
  StoryKind,
  StoryProgressRow,
  StoryReaderSource,
  StorySourceCoverage,
} from '@/lib/library/story/learner-types'

// ── 이름 · 범위 문구 ───────────────────────────────────────────────────────

/** 판본 종류 이름(영어 — 콘텐츠 종류 이름 · docs/LCP_STORY.md §2) + 한 줄 뜻. */
export const KIND_LABEL: Record<StoryKind, { name: string; gist: string }> = {
  story_edition: { name: 'Story Edition', gist: '서사를 그대로 두고 현대 영어로 다듬은 판본' },
  easy_reader: { name: 'Easy Reader', gist: '핵심 사건은 지키고 언어 부담을 낮춘 판본' },
}

/** 판본 범위 — 발행본 기준. 원문 전문을 읽는다는 뜻이 아니다. */
export const COVERAGE_LABEL: Record<StoryCoverage, string> = {
  complete_work: '작품 전체 각색',
  episode: '에피소드',
  excerpt: '발췌',
}

/** 원천 스냅숏 범위. */
export const SOURCE_COVERAGE_LABEL: Record<StorySourceCoverage, string> = {
  complete_work: '원천 작품 전체',
  excerpt: '원천 발췌',
}

/** 편집 목표 CEFR — 판본을 만들 때 겨냥한 난이도일 뿐 실측 진단이 아니다. */
export function editorialTargetLabel(targetCefr: string | null): string {
  return targetCefr ? `편집 목표 난이도 ${targetCefr}` : '편집 목표 없음'
}

export function unitLabel(unitIndex: number, unitTitle: string | null): string {
  const n = `${unitIndex + 1}번째 단위`
  return unitTitle ? `${n} · ${unitTitle}` : n
}

/** ISO 639 코드 → 한국어 언어 이름(모르면 코드 그대로). */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames(['ko'], { type: 'language' }).of(code)
    return name && name !== code ? name : code
  } catch {
    return code
  }
}

/** 원천 사실 줄 — 원작 언어 · 본문 언어 · (번역본이면) 번역자 · 원천 판본. 시작 전에 보인다. */
export function sourceLine(source: StoryReaderSource): string {
  const parts = [`원작 언어 ${languageName(source.originalLanguage)}`, `본문 언어 ${languageName(source.textLanguage)}`]
  if (source.originalLanguage !== source.textLanguage) parts.push(`번역 ${source.translator ?? '번역자 정보 없음'}`)
  parts.push(`원천 판본 ${source.editionLabel}`)
  return parts.join(' · ')
}

// ── 서가 묶기 · 세기 ───────────────────────────────────────────────────────

export interface CatalogEditionEntry {
  release: StoryCatalogRelease
  /** 이 학습자의 진도(로그인 · 조회 성공 · 그 발행본 기록이 있을 때만). */
  progress: StoryProgressRow | null
}

/** 편집 목표(판본 종류 + 목표 CEFR)별 묶음. */
export interface CatalogEditionGroup {
  kind: StoryKind
  targetCefr: string | null
  entries: CatalogEditionEntry[]
}

export interface CatalogWorkGroup {
  workKey: string
  /** 묶음 첫 발행본의 제목(판본마다 제목이 다르면 각 판본 줄이 자기 제목을 보인다). */
  title: string
  /** 첫 발행본의 진입 장면(HOOK). */
  hookText: string
  editions: CatalogEditionGroup[]
  /** 이 작품의 지금 열 수 없는 판본 기록(본문 · 링크 없음). */
  history: StoryProgressRow[]
}

export interface CatalogGrouping {
  works: CatalogWorkGroup[]
  /** 서가에 같은 작품이 없는 열 수 없는 기록. */
  orphanHistory: StoryProgressRow[]
}

const KIND_ORDER: Record<StoryKind, number> = { story_edition: 0, easy_reader: 1 }

/** 발행본을 작품(workKey)별로, 그 안에서 편집 목표별로 묶는다. 처음 나온 순서를 지킨다. */
export function groupCatalogByWork(
  releases: readonly StoryCatalogRelease[],
  progress: readonly StoryProgressRow[] | null,
): CatalogGrouping {
  const seenRelease = new Set<string>()
  const byWork = new Map<string, CatalogWorkGroup>()
  const progressByRelease = new Map<string, StoryProgressRow>()
  for (const row of progress ?? []) progressByRelease.set(row.releaseKey, row)

  for (const release of releases) {
    if (seenRelease.has(release.releaseKey)) continue
    seenRelease.add(release.releaseKey)
    let work = byWork.get(release.workKey)
    if (!work) {
      work = { workKey: release.workKey, title: release.title, hookText: release.hookText, editions: [], history: [] }
      byWork.set(release.workKey, work)
    }
    let group = work.editions.find((g) => g.kind === release.kind && g.targetCefr === release.targetCefr)
    if (!group) {
      group = { kind: release.kind, targetCefr: release.targetCefr, entries: [] }
      work.editions.push(group)
    }
    const row = progressByRelease.get(release.releaseKey)
    group.entries.push({ release, progress: row && row.releaseAvailable ? row : null })
  }

  for (const work of byWork.values()) {
    work.editions.sort(
      (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.targetCefr ?? '~').localeCompare(b.targetCefr ?? '~'),
    )
    // 작품 머리(제목 · HOOK)는 맨 앞에 보이는 판본(Story Edition 이 있으면 그것 — 원작 서사에 가장 가까운 판본)에서 가져온다.
    // 서가 행 순서(edition_key)의 첫 행을 쓰면 Easy Reader 제목 · HOOK 이 Story Edition 위에 작품 이름처럼 붙는다(2026-10-25 하네스 캡처).
    const lead = work.editions[0]?.entries[0]?.release
    if (lead) {
      work.title = lead.title
      work.hookText = lead.hookText
    }
  }

  // 열 수 없는 기록: 철회 · 권리 보류(releaseAvailable=false) 또는 지금 서가에 없는 발행본.
  const orphanHistory: StoryProgressRow[] = []
  for (const row of progress ?? []) {
    if (row.releaseAvailable && seenRelease.has(row.releaseKey)) continue
    const work = byWork.get(row.workKey)
    if (work) work.history.push(row)
    else orphanHistory.push(row)
  }
  return { works: [...byWork.values()], orphanHistory }
}

/** 작품 = 서로 다른 workKey 수 · 판본 = 서로 다른 발행본 수. */
export function countWorksAndEditions(releases: readonly StoryCatalogRelease[]): { works: number; editions: number } {
  return {
    works: new Set(releases.map((r) => r.workKey)).size,
    editions: new Set(releases.map((r) => r.releaseKey)).size,
  }
}

/** 서가 진입 이벤트 — 서가 데이터를 실제로 받은(ready) 때만. 조회 실패는 「0편」으로 세지 않는다(null). */
export function catalogViewedEvent(state: StoryCatalogPageState): PublicEvent | null {
  if (state.status !== 'ready') return null
  const { works, editions } = countWorksAndEditions(state.releases)
  return { name: 'story_catalog_viewed', props: { works, editions, signed_in: state.signedIn } }
}

// ── 진도 문구 ──────────────────────────────────────────────────────────────

export interface ProgressCounts {
  completedUnitCount: number
  unitCount: number
  completed: boolean
}

/** 서가 진도 행 → 수(완료 = DB 가 completed_at 을 남겼다 — 전 단위 표시 뒤 한 번만 생긴다). */
export function rowCounts(row: StoryProgressRow): ProgressCounts {
  return { completedUnitCount: row.completedUnitCount, unitCount: row.unitCount, completed: row.completedAt !== null }
}

/** 모든 단위에 명시적 완료 표시가 있을 때만 참(플래그만으로 믿지 않는다). */
export function isFullyMarked(progress: ProgressCounts | null): boolean {
  return !!progress && progress.completed && progress.unitCount > 0 && progress.completedUnitCount >= progress.unitCount
}

/**
 * 완료 문구. 완료가 아니면 「완료 표시 K/M」. 완료면 각색 전권(adapted_full_work · 작품 전체 각색)만 「각색 완독」이고
 * 나머지는 「이 부분 읽기 완료」다. 라벨과 범위가 어긋나면(전권 라벨 + 부분 범위) 더 좁은 쪽으로 말한다.
 * 원문 완독 · 숙달 · 기억 성공을 말하지 않는다.
 */
export function completionWording(
  progress: ProgressCounts | null,
  completionLabel: StoryCompletionLabel,
  coverage: StoryCoverage,
): { done: boolean; text: string } | null {
  if (!progress) return null
  if (isFullyMarked(progress)) {
    const full = completionLabel === 'adapted_full_work' && coverage === 'complete_work'
    return { done: true, text: full ? '각색 완독' : '이 부분 읽기 완료' }
  }
  return { done: false, text: `완료 표시 ${Math.min(progress.completedUnitCount, progress.unitCount)}/${progress.unitCount}` }
}

/** 마지막 위치 — 이동 기록일 뿐 완료가 아니다. */
export function positionWording(lastUnitIndex: number, unitCount: number): string {
  const n = Math.min(Math.max(lastUnitIndex, 0) + 1, unitCount)
  return `${n}/${unitCount} 단위 위치`
}

// ── 원문 링크 · 본문 ───────────────────────────────────────────────────────

/** http · https 절대 주소만 링크로 만든다. 그 밖(javascript: · data: · ftp: · 상대 경로 · 깨진 값)은 null. */
export function safeSourceHref(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || url === '') return null
  // 공백 · 제어 문자가 하나라도 있으면(앞뒤 포함) 링크로 만들지 않는다 — URL 파서가 조용히 지우는 값을 고쳐 쓰지 않는다.
  if (/[\s\u0000-\u001F\u007F-\u009F]/.test(url)) return null
  try {
    const parsed = new URL(url)
    // 판정만 파서로 하고, 링크에는 저장된 값을 글자 그대로 쓴다(href 정규화 · 대소문자 · 끝 슬래시 · 퍼센트 인코딩을 바꾸지 않는다).
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** 단위 본문 → 문단(빈 줄 기준). 화면은 텍스트 노드로만 그린다. */
export function splitUnitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

// ── 요청형 단어 뜻 ─────────────────────────────────────────────────────────

export type StoryTextPiece = { type: 'word'; text: string; index: number } | { type: 'text'; text: string }

/**
 * 낱말 = 글자(\p{L}) 뒤에 글자 · 결합 부호(\p{M})가 이어진 것. 낱말 안의 아포스트로피 · 하이픈 뒤에 글자가 이어지면 한 낱말이다
 * (don't · it's · well-known 은 통째로). NFC 「café」와 NFD 「cafe + 결합 악센트」 모두 통째로 잡힌다 — 조각 낱말을 조회에 내놓지 않는다.
 * 구두점 · 숫자 · 낱말 끝의 아포스트로피/하이픈은 낱말에 들어가지 않는다.
 */
const WORD = /\p{L}[\p{L}\p{M}]*(?:['’\-‐]\p{L}[\p{L}\p{M}]*)*/gu

/** 문단 → 영어 낱말 · 나머지 조각. index 는 단위 전체에서 이어지는 낱말 번호(start 부터). 원문 글자는 그대로 이어 붙는다. */
export function tokenizeWords(paragraph: string, start = 0): { pieces: StoryTextPiece[]; next: number } {
  const pieces: StoryTextPiece[] = []
  let last = 0
  let index = start
  for (const match of paragraph.matchAll(WORD)) {
    const at = match.index ?? 0
    if (at > last) pieces.push({ type: 'text', text: paragraph.slice(last, at) })
    pieces.push({ type: 'word', text: match[0], index })
    index += 1
    last = at + match[0].length
  }
  if (last < paragraph.length) pieces.push({ type: 'text', text: paragraph.slice(last) })
  return { pieces, next: index }
}

/** 낱말 사이 키보드 이동(로빙 초점) — 해당 키가 아니면 null. */
export function nextWordIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return Math.min(current + 1, count - 1)
  if (key === 'ArrowLeft' || key === 'ArrowUp') return Math.max(current - 1, 0)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

// ── 다음 행동 하나 ─────────────────────────────────────────────────────────

export type StoryNextAction =
  | { type: 'start'; unitIndex: 0 }
  | { type: 'resume'; unitIndex: number }
  | { type: 'complete'; unitIndex: number }
  | { type: 'navigate'; unitIndex: number }
  | { type: 'done' }

export interface NextActionInput {
  /** 지금 읽는 단위(작품 입구면 null). */
  unitIndex: number | null
  unitCount: number
  /** 명시적으로 완료 표시한 단위들. */
  completedUnits: ReadonlySet<number>
  /** 저장된 마지막 위치(기록이 없으면 null). */
  lastUnitIndex: number | null
}

/**
 * 화면이 앞에 세울 행동 하나.
 * - 입구: 기록 없으면 처음부터(start 0), 있으면 마지막 위치에서 이어 읽기(resume).
 * - 읽는 중: 이 단위가 표시 전이면 「읽음 표시」, 표시했으면 다음 미표시 단위(뒤쪽 먼저, 없으면 앞쪽)로,
 *   모든 단위가 표시됐으면 done. 마지막 단위에 도착했다는 것만으로 done 이 되지 않는다.
 */
export function nextActionFor(input: NextActionInput): StoryNextAction {
  const { unitIndex, unitCount, completedUnits, lastUnitIndex } = input
  if (unitIndex === null) {
    if (lastUnitIndex === null || unitCount <= 0) return { type: 'start', unitIndex: 0 }
    return { type: 'resume', unitIndex: Math.min(Math.max(lastUnitIndex, 0), unitCount - 1) }
  }
  if (!completedUnits.has(unitIndex)) return { type: 'complete', unitIndex }
  for (let i = unitIndex + 1; i < unitCount; i += 1) if (!completedUnits.has(i)) return { type: 'navigate', unitIndex: i }
  for (let i = 0; i < unitIndex; i += 1) if (!completedUnits.has(i)) return { type: 'navigate', unitIndex: i }
  return { type: 'done' }
}

/** 단위 이동 뒤에만 제목으로 초점을 옮긴다(첫 진입 · 같은 단위 재렌더 · 입구로 갈 때는 옮기지 않는다). */
export function shouldFocusUnitHeading(previous: number | null | undefined, next: number | null): boolean {
  return previous !== undefined && next !== null && previous !== next
}

export function readerHref(releaseKey: string, unitIndex: number | null): string {
  const base = `/library/stories/${encodeURIComponent(releaseKey)}`
  return unitIndex === null ? base : `${base}?unit=${unitIndex}`
}
