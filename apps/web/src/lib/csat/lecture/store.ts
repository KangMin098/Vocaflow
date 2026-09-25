// apps/web/src/lib/csat/lecture/store.ts
//
// **강의 대본 읽기 — 커밋된 회차 JSON 에서.** DB 를 치지 않는다.
//
// 화면(서버 컴포넌트)은 `lectureMeta` 로 **숫자만** 받는다(몇 초 · 큐 몇 개). 대본 문자열은
// 재생을 누른 뒤 `/api/csat/lecture` 가 `loadLecture` 로 돌려준다 — 서버 렌더 HTML 에
// 대본이 한 글자도 남지 않게(지시문 A1 · F2).
//
// ⚠️ `server-only` 를 들이지 않는다(`skeleton.ts` 와 같은 이유 — 타입을 화면이 읽는다).

import fs from 'node:fs'
import path from 'node:path'

import type { Lecture, LectureExamFile, LectureIndex, LectureStep } from './types'

const DATA_DIR = path.join(process.cwd(), 'src/lib/csat/lecture-data')

let indexCache: LectureIndex | null = null
const examCache = new Map<string, LectureExamFile | null>()

function index(): LectureIndex {
  if (!indexCache) {
    try {
      indexCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8')) as LectureIndex
    } catch {
      indexCache = { built: '', items: {} }
    }
  }
  return indexCache
}

/** 이 문항에 강의가 있는가 — 있으면 길이만(대본은 주지 않는다) */
export function lectureMeta(itemId: string): { sec: number; cues: number } | null {
  const e = index().items[itemId]
  return e ? { sec: e.sec, cues: e.cues } : null
}

export function loadLecture(itemId: string): Lecture | null {
  if (!index().items[itemId]) return null
  const exam = itemId.split('#')[0]
  // 회차 id 는 파일 이름이 된다 — 색인에 있는 문항의 것만 쓰고, 모양도 한 번 더 좁힌다
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(exam)) return null
  if (!examCache.has(exam)) {
    try {
      examCache.set(exam, JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${exam}.json`), 'utf8')) as LectureExamFile)
    } catch {
      examCache.set(exam, null)
    }
  }
  return examCache.get(exam)?.lectures[itemId] ?? null
}

/**
 * **강의의 «순서»만 — 대본 글자는 한 자도 없다.**
 *
 * 해설 극장의 왼쪽 레일은 재생을 누르기 전에도 「무엇을 어떤 차례로 보게 되는지」를 보여야 한다.
 * 그런데 `LectureStage` 의 큐 목록은 `/api/csat/lecture` 를 부른 뒤에야 생긴다 — 그때까지
 * 레일이 비어 있으면 화면이 「눌러 보기 전에는 아무것도 아닌 것」이 된다.
 *
 * 그래서 서버가 **역할 · 가리킬 곳 · 길이 · 말한 문장 번호**만 미리 준다. 이 넷은 대본이 아니다
 * (A1 이 막는 것은 `segments` 다). 재생이 시작되면 같은 순서의 큐가 그 자리에 들어온다.
 */
export function lectureOutline(itemId: string): LectureStep[] {
  const lecture = loadLecture(itemId)
  if (!lecture) return []
  return lecture.cues.map((c) => ({
    id: c.id,
    order: c.order,
    role: c.role,
    target: c.target,
    est_sec: c.est_sec,
    ...(c.focus?.length ? { focus: c.focus } : {}),
  }))
}
