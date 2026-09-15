// apps/web/src/lib/csat/skeleton.ts
//
// **구워 둔 골격을 읽는다 — 화면이 지문을 «볼» 수 있게.**
//
// 읽는 것은 `scripts/csat/build-skeleton-data.mjs` 가 만들어 커밋한 JSON 이다. DB 를 치지
// 않는다. 그게 요점이다 — 런타임에 `csat_items.passage` 를 만지는 경로가 아예 없어야
// 학습자 쪽으로 지문이 샐 길이 없다(`copyright-boundary.integration.test.ts` 가 지킨다).
//
// ⚠️ **`server-only` 를 들이지 않는다.** `fs` 를 쓰므로 서버에서만 도는 것이 사실이지만,
//    타입은 화면(클라이언트 컴포넌트)이 읽는다. 값 import 하나가 클라이언트 그래프에
//    server-only 를 끌고 들어가 빌드를 죽인 사고가 이 저장소에 두 번 있었다
//    (CONVENTIONS.md §server-only). 그래서 **모양은 `passage-skeleton.ts`(순수)에 두고**
//    여기서는 읽기만 한다.

import fs from 'node:fs'
import path from 'node:path'

import type { SkeletonSentence } from './passage-skeleton'

const DATA_DIR = path.join(process.cwd(), 'src/lib/csat/skeleton-data')

/** 한 문항의 골격 — 커밋된 JSON 의 한 원소. */
export interface ItemSkeleton {
  id: string
  no: number
  /** 지문 전체 길이. 막대 비율의 분모. */
  chars: number
  sentences: SkeletonSentence[]
  /** 앵커가 어느 문장에 붙었는가. 빈 배열이면 «근거를 못 찾았다». */
  anchors: { id: string; sentences: number[] }[]
}

interface ExamFile {
  exam_id: string
  items: ItemSkeleton[]
}

// 회차 파일은 한 번 읽으면 안 바뀐다(빌드 산출물). 요청마다 디스크를 치지 않는다.
const cache = new Map<string, ExamFile | null>()

function loadExam(examId: string): ExamFile | null {
  if (cache.has(examId)) return cache.get(examId) ?? null
  // 회차 id 는 파일 이름이 된다 — 경로 조작을 막는다.
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(examId)) {
    cache.set(examId, null)
    return null
  }
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, `${examId}.json`), 'utf8')
    const parsed = JSON.parse(raw) as ExamFile
    cache.set(examId, parsed)
    return parsed
  } catch {
    // 아직 안 구운 회차다. **빈 골격을 지어내지 않는다** — 화면이 막대 0개를 그리면
    // "지문이 없는 문항" 으로 읽히는데 그건 거짓이다. null 을 받은 화면은 골격을 안 그린다.
    cache.set(examId, null)
    return null
  }
}

/**
 * 문항 id(`M2309#42`)로 골격을 찾는다. 없으면 `null`.
 *
 * 없는 경우가 정상이다 — `body_ok = false`(지문이 잘린 문항) 210건은 **일부러 안 구웠다.**
 * 잘린 지문으로 막대를 그리면 **막대 개수부터 거짓말**이 된다.
 */
export function loadItemSkeleton(itemId: string): ItemSkeleton | null {
  const examId = itemId.split('#')[0]
  if (!examId) return null
  const exam = loadExam(examId)
  if (!exam) return null
  return exam.items.find((i) => i.id === itemId) ?? null
}

/** 구워 둔 회차 목록 — 화면이 "이 회차는 골격이 있다" 를 미리 알 때 쓴다. */
export function skeletonExams(): { exam_id: string; items: number }[] {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8')
    return (JSON.parse(raw) as { exams: { exam_id: string; items: number }[] }).exams
  } catch {
    return []
  }
}
