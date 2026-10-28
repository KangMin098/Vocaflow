// apps/web/src/components/library/story/story-return-anchor.ts
//
// U03 — 단어장에서 Story 로 돌아왔을 때 「담은 낱말이 있던 문장」을 다시 보여 주는 같은 탭 보조 기억(LCP_D5_INTEGRATION.md §5 72행).
// - 진도 계약은 그대로 단위다. 이것은 문장 북마크 · 정밀 위치 보장이 아니다 — 같은 탭(sessionStorage)에서 명시적으로 단어장에 간 경우에만 한 번 쓴다.
// - 주소 · 서버 · DB 에 아무것도 싣지 않는다. 기억하는 값은 발행 키 · 단위 번호 · 낱말 번호 · 주인 표지(확인된 viewer id 의 짧은 해시 —
//   원문 id 아님)뿐이다. 주인 표지가 지금 확인된 viewer 와 다르거나 없는(옛 형식) 표식은 쓰지 않고 지운다.
// - 흐름: 유효 저장 → remember(아직 떠나지 않음) · 단어장 링크 클릭 → markLeft · 같은 발행본 · 단위 화면 → take(한 번 쓰고 지운다).
//   다른 발행본 · 단위로 오거나, 떠나지 않았거나, 형식이 틀리면 null — 화면은 기존처럼 단위 첫머리다.
// - 저장소를 못 쓰는 환경(사생활 모드 · 차단)은 조용히 null — 기존 동작 그대로.

import type { StoryTextPiece } from './story-view'

export const RETURN_ANCHOR_KEY = 'vf:story-return-anchor'

export interface StoryReturnAnchor {
  /** ownerTag(viewerId) — 같은 탭의 다른 계정 표식을 지금 계정 것으로 쓰지 않는다. */
  owner: string
  releaseKey: string
  unitIndex: number
  wordIndex: number
  left: boolean
}

type AnchorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): AnchorStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

const OWNER_RE = /^[0-9a-f]{8}$/

/** 확인된 viewer id → 짧은 주인 표지(FNV-1a 32비트 · 16진 8자). 보안 비밀이 아니라 같은 탭 계정 구분용이다. */
export function ownerTag(viewerId: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < viewerId.length; i += 1) {
    h ^= viewerId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function read(storage: AnchorStorage): StoryReturnAnchor | null {
  const raw = storage.getItem(RETURN_ANCHOR_KEY)
  if (!raw) return null
  const v = JSON.parse(raw) as Partial<StoryReturnAnchor> | null
  if (!v || typeof v.owner !== 'string' || !OWNER_RE.test(v.owner) || typeof v.releaseKey !== 'string' || !isIndex(v.unitIndex) || !isIndex(v.wordIndex) || typeof v.left !== 'boolean') return null
  return { owner: v.owner, releaseKey: v.releaseKey, unitIndex: v.unitIndex, wordIndex: v.wordIndex, left: v.left }
}

/** 유효 저장 하나 — 마지막 저장만 기억한다(아직 단어장으로 떠나지 않은 상태). */
export function rememberSaveAnchor(
  anchor: { owner: string; releaseKey: string; unitIndex: number; wordIndex: number },
  storage: AnchorStorage | null = defaultStorage(),
): void {
  if (!storage || !OWNER_RE.test(anchor.owner) || !isIndex(anchor.unitIndex) || !isIndex(anchor.wordIndex)) return
  try {
    storage.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ ...anchor, left: false }))
  } catch {
    // 저장소를 못 쓰면 보조 기억 없이 기존 동작(단위 첫머리).
  }
}

/** 단어장 링크를 눌렀다 — 다음에 같은 단위로 돌아오면 그 문장을 보여 준다. 지금 주인의 표식만 표시한다. */
export function markAnchorLeft(owner: string, storage: AnchorStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    const cur = read(storage)
    if (cur && cur.owner === owner) storage.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ ...cur, left: true }))
  } catch {
    // 무시 — 기존 동작.
  }
}

/**
 * 같은 주인 · 발행본 · 단위로 돌아왔으면 낱말 번호를 돌려주고 지운다(한 번만). 같은 주인이 아직 떠나지 않았으면 건드리지 않는다.
 * 다른 주인 · 주인 없는 옛 형식 · 형식 오류는 null 이고 지운다.
 */
export function takeReturnAnchor(
  owner: string,
  releaseKey: string,
  unitIndex: number,
  storage: AnchorStorage | null = defaultStorage(),
): number | null {
  if (!storage) return null
  try {
    const cur = read(storage)
    if (!cur) {
      storage.removeItem(RETURN_ANCHOR_KEY)
      return null
    }
    if (cur.owner !== owner) {
      storage.removeItem(RETURN_ANCHOR_KEY)
      return null
    }
    if (!cur.left) return null
    storage.removeItem(RETURN_ANCHOR_KEY)
    return cur.releaseKey === releaseKey && cur.unitIndex === unitIndex ? cur.wordIndex : null
  } catch {
    try {
      storage.removeItem(RETURN_ANCHOR_KEY)
    } catch {
      // 무시
    }
    return null
  }
}

const SENTENCE_END = /[.!?]["'’”)\]]*(\s|$)/

/**
 * 한 문단 조각들에서 낱말 번호가 든 문장의 조각 범위 [start, end) — 없으면 null.
 * 문장 끝 = 마침표 · 물음표 · 느낌표(뒤 따옴표 · 괄호)를 담은 글 조각. 앞 문장의 끝 조각은 빼고, 이 문장의 끝 조각은 넣는다.
 */
export function sentenceRange(pieces: readonly StoryTextPiece[], wordIndex: number): { start: number; end: number } | null {
  const at = pieces.findIndex((p) => p.type === 'word' && p.index === wordIndex)
  if (at < 0) return null
  let start = 0
  for (let i = at - 1; i >= 0; i -= 1) {
    const p = pieces[i]
    if (p.type === 'text' && SENTENCE_END.test(p.text)) {
      start = i + 1
      break
    }
  }
  let end = pieces.length
  for (let i = at + 1; i < pieces.length; i += 1) {
    const p = pieces[i]
    if (p.type === 'text' && SENTENCE_END.test(p.text)) {
      end = i + 1
      break
    }
  }
  return { start, end }
}

/**
 * 복귀 문장으로 옮길 차례인가 — 번호가 있고 · 문장 표지가 붙었고 · 그 번호로 아직 옮기지 않았을 때만.
 * 부모가 번호를 늦게 줘도(null → n) 한 번 옮기고, 같은 번호의 재렌더에서는 다시 옮기지 않는다.
 */
export function shouldMoveToReturn(movedFor: number | null, returnWordIndex: number | null, mounted: boolean): boolean {
  return returnWordIndex !== null && mounted && movedFor !== returnWordIndex
}
