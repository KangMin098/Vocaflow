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

function writeAll(list: DictationSession[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CACHED)))
  } catch {
    /* quota 초과 등 — 진행 상태 캐시 실패는 학습을 막지 않는다 */
  }
}

export function getSession(id: string): DictationSession | undefined {
  return readAll().find((s) => s.id === id)
}

export function saveSession(session: DictationSession): void {
  const list = readAll().filter((s) => s.id !== session.id)
  list.unshift(session)
  writeAll(list)
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id))
}

/** 완주하지 않은 가장 최근 세션 — 허브 "이어하기". */
export function getResumableSession(): DictationSession | undefined {
  return readAll().find((s) => !s.completedAt && s.items.length > 0)
}
