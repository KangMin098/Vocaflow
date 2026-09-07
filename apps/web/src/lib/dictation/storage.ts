// apps/web/src/lib/dictation/storage.ts
//
// 진행 중 세션의 **런타임 상태**만 로컬에 둔다 (문항 목록·현재 인덱스·입력 중인 답).
//
// v07 이전엔 이 파일이 자료와 기록의 원본이었다 — 시드 3개를 "라이브러리"라 부르고,
// 완주 기록도 여기 쌓였다. 그래서 기기를 바꾸면 학습 이력이 통째로 사라졌다.
// 이제 원본은 DB(dictation_sessions · dictation_attempts)이고, 여기 남는 것은
// **새로고침해도 풀던 자리로 돌아오기 위한 캐시**뿐이다.
//
// 캐시는 세션 uuid 로 키를 잡고 최근 5개만 유지한다 — 오래된 진행 상태를 붙들어봐야
// 어차피 DB 에 문항별로 남아 있다.

import type { DictationSession } from './types'

const KEY = 'vocaflow:dictation:active'
const MAX_CACHED = 5

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function readAll(): DictationSession[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DictationSession[]) : []
  } catch {
    return []
  }
}

function writeAll(list: DictationSession[]): boolean {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CACHED)))
    return true
  } catch {
    // quota 초과 등. **"학습을 막지 않는다" 는 거짓이었다** — 세션 인계가 이 캐시를 지나므로
    // 여기서 실패하면 다음 화면이 세션을 못 찾는다. 그래서 호출부에 실패를 알린다.
    return false
  }
}

/**
 * 캐시에서 세션 하나.
 *
 * ⚠️ 저장된 값을 **검증한다**. 이 키(`vocaflow:dictation:active`)는 v07 이전 구조에서도
 *    쓰였고, 형태가 어긋난 값이 남아 있으면 `session.items[...]` 가 던져 화면이 통째로
 *    빈다 — 학습자에겐 "아무 반응 없음" 으로 보인다. 못 믿을 값은 없는 것으로 취급한다.
 */
export function getSession(id: string): DictationSession | undefined {
  const found = readAll().find((s) => s && s.id === id)
  return isUsable(found) ? found : undefined
}

/** 이 세션으로 화면을 그릴 수 있는가 — 형태와 범위를 함께 본다. */
function isUsable(s: DictationSession | undefined): s is DictationSession {
  if (!s || !Array.isArray(s.items) || s.items.length === 0) return false
  if (typeof s.currentIndex !== 'number' || s.currentIndex < 0) return false
  // 인덱스가 끝을 넘은 세션은 그릴 문항이 없다 — 완주 표시 없이 이 상태면 중단된 것이다
  return s.currentIndex < s.items.length || !!s.completedAt
}

/** @returns 캐시에 실제로 남았는가. false 면 다음 화면이 이 세션을 못 찾는다. */
export function saveSession(session: DictationSession): boolean {
  const list = readAll().filter((s) => s.id !== session.id)
  list.unshift(session)
  return writeAll(list)
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id))
}

/**
 * 완주하지 않은 가장 최근 세션 — 허브 "이어하기".
 *
 * ⚠️ `isUsable` 를 함께 본다. 그리지 못하는 세션을 이어하기로 내놓으면 **허브가 자기 손으로
 *    막다른 화면으로 보내는 링크**를 만든다(인덱스가 끝을 넘었거나 형태가 깨진 캐시).
 */
export function getResumableSession(): DictationSession | undefined {
  return readAll().find((s) => isUsable(s) && !s.completedAt)
}
