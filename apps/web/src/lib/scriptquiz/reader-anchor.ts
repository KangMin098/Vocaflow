// apps/web/src/lib/scriptquiz/reader-anchor.ts
//
// T-0209 — ScriptQuiz 오답 복기의 「글에서 이 문장 보기」: 같은 탭 보조 기억으로 Reader 에서 그 근거 문장을 한 번 보여 준다.
// - 복기 쪽: 퀴즈 페이지가 본인 글 · 같은 도서/장 · 본문을 확인한 경우에만 문맥(textId)이 온다. 근거가 본문의 **한 문장에만**
//   유일하게 맞을 때(locateSingleEvidence)만 표식을 남긴다 — 비슷한 문장을 고르지 않는다.
// - 저장: sessionStorage 에 textId · 본문 해시 · 문장 번호(splitSentences 기준)뿐. 본문 · 문장 · 정답 · 사용자 id 없음, URL 에도 없음.
// - Reader 쪽: 같은 textId · 같은 본문 해시일 때만 한 번 꺼내 지운다. 그 번호의 문장을 Reader 문장 목록에서 다시 찾아
//   **하나에만** 맞으면 그 문장, 아니면 null(지금처럼 첫머리). 기록 · 채점 · 숙달 산입 없음.
// 순수 함수 + 저장소 주입 — 네트워크 · 시계 없음.

import { locateSingleEvidence, normalizeForMatch, splitSentences } from './evidence'

export const EVIDENCE_ANCHOR_KEY = 'vf:scriptquiz-evidence-anchor'

type AnchorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): AnchorStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** 본문 해시(FNV-1a 32비트 · 16진 8자) — 같은 본문인지 보는 표지일 뿐 보안 값이 아니다. 서버 · 브라우저 같은 값. */
export function contentHash(content: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < content.length; i += 1) {
    h ^= content.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const HASH_RE = /^[0-9a-f]{8}$/

function isIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
}

export interface EvidenceAnchor {
  textId: string
  hash: string
  sentenceIndex: number
}

/** 복기에서 버튼을 눌렀다 — 마지막 것만 기억한다. 형식이 틀리면 남기지 않는다. */
export function rememberEvidenceAnchor(anchor: EvidenceAnchor, storage: AnchorStorage | null = defaultStorage()): void {
  if (!storage || !anchor.textId || !HASH_RE.test(anchor.hash) || !isIndex(anchor.sentenceIndex)) return
  try {
    storage.setItem(EVIDENCE_ANCHOR_KEY, JSON.stringify(anchor))
  } catch {
    // 저장소를 못 쓰면 보조 기억 없이 첫머리
  }
}

/** Reader — 같은 글 · 같은 본문일 때만 번호를 돌려주고 지운다(한 번만). 다른 글 · 다른 본문 · 형식 오류는 null 이고 지운다. */
export function takeEvidenceAnchor(textId: string, hash: string, storage: AnchorStorage | null = defaultStorage()): number | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(EVIDENCE_ANCHOR_KEY)
    if (!raw) return null
    storage.removeItem(EVIDENCE_ANCHOR_KEY)
    const v = JSON.parse(raw) as Partial<EvidenceAnchor> | null
    if (!v || v.textId !== textId || v.hash !== hash || !isIndex(v.sentenceIndex)) return null
    return v.sentenceIndex
  } catch {
    try {
      storage.removeItem(EVIDENCE_ANCHOR_KEY)
    } catch {
      // 무시
    }
    return null
  }
}

/**
 * 본문 기준 문장 번호 → Reader 문장 id. 그 문장(splitSentences)을 Reader 문장들(같은 본문을 Reader 파서로 나눈 것)에서
 * 정규화 비교로 찾아 **하나에만** 맞을 때만 id, 아니면 null. 맞음 = 같거나, Reader 문장이 그 문장을 낱말 경계째 품음.
 */
export function readerSentenceFor(
  content: string,
  sentenceIndex: number,
  readerSentences: ReadonlyArray<{ id: number; text: string }>,
): number | null {
  const target = splitSentences(content)[sentenceIndex]
  if (!target) return null
  const t = normalizeForMatch(target)
  if (t.length === 0) return null
  // T-0214 — 전체가 같은 Reader 문장이 정확히 하나면 그것을 먼저(짧은 문장이 다른 문장 안에 들어 있어도). 같은 문장이 여럿이면 null.
  //   전체 일치가 없을 때만 기존 규칙(낱말 경계째 품은 문장이 하나뿐).
  const exact = readerSentences.filter((s) => normalizeForMatch(s.text) === t)
  if (exact.length === 1) return exact[0]!.id
  if (exact.length > 1) return null
  const hits = readerSentences.filter((s) => ` ${normalizeForMatch(s.text)} `.includes(` ${t} `))
  return hits.length === 1 ? hits[0]!.id : null
}

/** 복기 쪽 — 근거가 본문의 한 문장에만 유일하게 맞을 때 그 번호, 아니면 null(버튼 없음 · 기존 첫머리 복귀만). */
export function evidenceSentenceIndex(passage: string | undefined, snippet: string): number | null {
  if (!passage || !passage.trim() || !snippet.trim()) return null
  return locateSingleEvidence(splitSentences(passage), snippet)
}

/**
 * Reader 서버(layout)용 — 본문 문장 번호(splitSentences) → Reader 문장 id 표. 하나에만 맞지 않으면 -1.
 * 본문을 브라우저에 한 번 더 보내지 않고 번호 표만 보낸다. 정규화는 문장마다 한 번.
 */
export function buildEvidenceSentenceMap(content: string, readerSentences: ReadonlyArray<{ id: number; text: string }>): number[] {
  const readerNorm = readerSentences.map((s) => ({ id: s.id, n: ` ${normalizeForMatch(s.text)} ` }))
  return splitSentences(content).map((sentence) => {
    const t = normalizeForMatch(sentence)
    if (!t) return -1
    // T-0214 — readerSentenceFor 와 같은 판정: 전체 일치가 하나면 그것, 여럿이면 -1, 없을 때만 「품은 문장이 하나뿐」
    const whole = ` ${t} `
    let exact = -1
    let exactCount = 0
    for (const r of readerNorm) if (r.n === whole) { exact = r.id; exactCount += 1 }
    if (exactCount === 1) return exact
    if (exactCount > 1) return -1
    let found = -1
    for (const r of readerNorm) {
      if (r.n.includes(whole)) {
        if (found !== -1) return -1
        found = r.id
      }
    }
    return found
  })
}

// ── Reader 페이지 앵커 상태(순수) — 글 · 본문 해시에 묶는다(T-0209 Codex P2 3차) ─────────────────────────────

/** 앵커 상태 — 꺼낸 문맥(글 id · 본문 해시)과 문장 id · 이미 옮겼는지. 문맥이 바뀌면 쓰지 않는다. */
export interface ReaderAnchorState {
  key: string
  id: number
  moved: boolean
}

export function anchorKey(textId: string, hash: string | null | undefined): string | null {
  return textId && hash ? `${textId}|${hash}` : null
}

/**
 * 문맥에 맞춰 표식을 하나 꺼낸 결과. 같은 글 · 같은 해시 표식이고 번호 표에서 하나에 맞으면(id ≥ 0) 새 상태(옮기기 전),
 * 꺼낼 게 없으면 — 지금 문맥의 기존 상태는 유지, 다른 문맥의 상태는 버린다(새 판본에 옛 문장 id 를 쓰지 않는다).
 */
export function anchorAfterTake(
  prev: ReaderAnchorState | null,
  key: string | null,
  taken: number | null,
  map: readonly number[] | null | undefined,
): ReaderAnchorState | null {
  if (key === null) return null
  const id = taken != null && map ? map[taken] : undefined
  if (id != null && Number.isInteger(id) && id >= 0) return { key, id, moved: false }
  return prev && prev.key === key ? prev : null
}

/** 옮긴 직후 — 같은 문맥일 때만 「옮김」 으로. */
export function anchorAfterMoved(prev: ReaderAnchorState | null, key: string | null): ReaderAnchorState | null {
  return prev && key !== null && prev.key === key ? { ...prev, moved: true } : prev
}

/** 지금 화면에 쓸 값 — 문맥이 다르면 강조도 이동도 없다. */
export function visibleReaderAnchor(state: ReaderAnchorState | null, key: string | null): { anchorSentenceId: number | null; anchorAutoMove: boolean } {
  if (!state || key === null || state.key !== key) return { anchorSentenceId: null, anchorAutoMove: false }
  return { anchorSentenceId: state.id, anchorAutoMove: !state.moved }
}
