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
  /** 이 문항의 유형. 「같은 유형 다음 기출」이 **DB 없이** 고를 수 있는 근거다. */
  type_id: string | null
  /** 지문 전체 길이. 막대 비율의 분모. */
  chars: number
  sentences: SkeletonSentence[]
  /** 앵커가 어느 문장에 붙었는가. 빈 배열이면 «근거를 못 찾았다». */
  anchors: { id: string; sentences: number[] }[]
}

interface ExamFile {
  exam_id: string
  /** 사람이 읽는 회차 이름. 이것이 없으면 「다음 기출」이 이름 하나 때문에 DB 를 쳐야 한다. */
  exam_label: string
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

/** 「다음 기출」이 고를 수 있는 한 줄 — 조회 0회로 만들어진다. */
export interface SkeletonSibling {
  id: string
  no: number
  exam_label: string
}

/**
 * **같은 유형의 골격 보유 문항 전부.** DB 를 치지 않는다.
 *
 * ── 왜 이것이 필요했나 (실측 2026-09-15) ──────────────────────────────
 * 「다음 기출」은 원래 `loadCsatTypeItems()` 로 골랐다. 그 자는 유형 전체 문항의
 * **모든 버전 분석을 `choice_analysis` jsonb 째로** 받아 온다 — R-BLANK 기준
 * **432행 · 633 kB**. 그걸 다 받아서 하는 일은 문항마다 불리언 하나(«정답 선지에
 * why_correct 가 40자 이상인가»)였다. 문항 화면을 한 번 열 때마다 그 값을 치렀고,
 * 화면 이동이 30초를 넘는 것이 관측됐다(원인은 측정 못 한 채 적혀만 있었다).
 *
 * 골격은 이미 커밋돼 있고 `type_id` 도 들고 있었다 — 인터페이스가 선언을 빠뜨렸을 뿐이다.
 *
 * ⚠️ **후보가 골격 보유분으로 좁아진다.** 그래도 정책이 나빠지지 않는 것을 재고 바꿨다:
 *    골격 589개가 **전부** answer 앵커를 갖고(= 해설이 있고), **25개 유형 모두**
 *    2개 이상을 갖는다. 즉 옛 판정이 「지도 있는 것 우선」으로 고르던 자리를 그대로 고른다.
 *    잃는 것은 «지도가 하나도 없는 유형에서 산문 화면이라도 준다» 는 대체 경로뿐인데,
 *    그런 유형이 하나도 없다.
 */
export function skeletonSiblings(typeId: string): SkeletonSibling[] {
  const out: SkeletonSibling[] = []
  for (const e of skeletonExams()) {
    const file = loadExam(e.exam_id)
    if (!file) continue
    for (const it of file.items) {
      if (it.type_id !== typeId) continue
      out.push({ id: it.id, no: it.no, exam_label: file.exam_label ?? file.exam_id })
    }
  }
  return out
}
