// apps/web/src/lib/dictation/return.ts
//
// 받아쓰기 설정 → 세션 → 결과 → 같은 자료 재시도 동안 **들어온 자리(?from=)** 를 잃지 않게 잇는다.
// 읽던 글에서 시작한 받아쓰기(ModePills `/dictate/setup?text=…&from=…`)가 세션 · 결과로 넘어가며 from 을 버려,
// 세션 틀의 닫기/Esc 와 결과 화면에서 읽던 글로 돌아갈 길이 없었다.
//
// ⚠️ from 은 권한 증명이 아니다 — 목적지는 자기 권한 검사를 그대로 한다. 검사는 기존 sanitizeInternalPath(내부 경로만) 하나다.

import { sanitizeInternalPath } from '@/lib/layout/session-return'

/** 안전한 내부 from 만 — 아니면 null(링크 · 쿼리에 쓰지 않는다). */
export function dictationFrom(raw: string | null | undefined): string | null {
  return sanitizeInternalPath(raw)
}

/** href 에 안전한 from 을 덧붙인다. from 이 없거나 불량이면 href 그대로. */
export function withDictationFrom(href: string, from: string | null | undefined): string {
  const safe = sanitizeInternalPath(from)
  if (!safe) return href
  return `${href}${href.includes('?') ? '&' : '?'}from=${encodeURIComponent(safe)}`
}

export interface DictationRetrySource {
  textId?: string | null
  sharedSetId?: string | null
  chapterIdx?: number | null
}

/**
 * 같은 자료로 되돌아가는 링크.
 * 붙여넣은 글(custom)은 저장하지 않으므로 되돌아갈 자료가 없고,
 * 오늘의 받아쓰기(daily)는 내일 다시 조립되는 것이라 허브가 옳은 목적지다 — 그 갈래에는 from 도 붙이지 않는다.
 */
export function dictationRetryHref(s: DictationRetrySource, from?: string | null): string {
  if (s.textId) return withDictationFrom(`/dictate/setup?text=${s.textId}`, from)
  if (s.sharedSetId) {
    const ch = s.chapterIdx ? `&chapter=${s.chapterIdx}` : ''
    return withDictationFrom(`/dictate/setup?set=${s.sharedSetId}${ch}`, from)
  }
  return '/dictate'
}
