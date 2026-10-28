// apps/web/src/components/library/story/story-return-anchor.ts
//
// U03 — 단어장에서 Story 로 돌아왔을 때 「담은 낱말이 있던 문장」을 다시 보여 주는 같은 탭 보조 기억(LCP_D5_INTEGRATION.md §5 72행).
// - 진도 계약은 그대로 단위다. 이것은 문장 북마크 · 정밀 위치 보장이 아니다 — 같은 탭(sessionStorage)에서 명시적으로 단어장에 간 경우에만 한 번 쓴다.
// - 주소 · 서버 · DB 에 아무것도 싣지 않는다. 기억하는 값은 발행 키 · 단위 번호 · 낱말 번호뿐(본문 · 뜻 · 사용자 id 없음).
// - 흐름: 유효 저장 → remember(아직 떠나지 않음) · 단어장 링크 클릭 → markLeft · 같은 발행본 · 단위 화면 → take(한 번 쓰고 지운다).
//   다른 발행본 · 단위로 오거나, 떠나지 않았거나, 형식이 틀리면 null — 화면은 기존처럼 단위 첫머리다.
// - 저장소를 못 쓰는 환경(사생활 모드 · 차단)은 조용히 null — 기존 동작 그대로.

import type { StoryTextPiece } from './story-view'

export const RETURN_ANCHOR_KEY = 'vf:story-return-anchor'

export interface StoryReturnAnchor {
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

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function read(storage: AnchorStorage): StoryReturnAnchor | null {
  const raw = storage.getItem(RETURN_ANCHOR_KEY)
  if (!raw) return null
  const v = JSON.parse(raw) as Partial<StoryReturnAnchor> | null
  if (!v || typeof v.releaseKey !== 'string' || !isIndex(v.unitIndex) || !isIndex(v.wordIndex) || typeof v.left !== 'boolean') return null
  return { releaseKey: v.releaseKey, unitIndex: v.unitIndex, wordIndex: v.wordIndex, left: v.left }
}

/** 유효 저장 하나 — 마지막 저장만 기억한다(아직 단어장으로 떠나지 않은 상태). */
export function rememberSaveAnchor(
  anchor: { releaseKey: string; unitIndex: number; wordIndex: number },
  storage: AnchorStorage | null = defaultStorage(),
): void {
  if (!storage || !isIndex(anchor.unitIndex) || !isIndex(anchor.wordIndex)) return
  try {
    storage.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ ...anchor, left: false }))
  } catch {
    // 저장소를 못 쓰면 보조 기억 없이 기존 동작(단위 첫머리).
  }
}

/** 단어장 링크를 눌렀다 — 다음에 같은 단위로 돌아오면 그 문장을 보여 준다. */
export function markAnchorLeft(storage: AnchorStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    const cur = read(storage)
    if (cur) storage.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ ...cur, left: true }))
  } catch {
    // 무시 — 기존 동작.
  }
}

/** 같은 발행본 · 단위로 돌아왔으면 낱말 번호를 돌려주고 지운다(한 번만). 떠난 적이 없으면 건드리지 않는다. */
export function takeReturnAnchor(
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
