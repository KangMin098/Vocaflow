// apps/web/src/lib/csat/type-locus.ts
//
// **유형별 「정답 근거가 지문의 어디에 있나」 — 커밋된 골격에서 센다.**
//
// DB 를 치지 않는다. 골격 JSON 이 `type_id` 를 함께 들고 있으므로(2026-09-15부터) 이 집계는
// 파일만으로 끝난다 — 그전에는 `item → type` 매핑이 DB 에만 있어 **망이 끊긴 사이클마다
// 미뤄졌다**(실측 3회).
//
// 29개 파일(426KB)을 한 번만 읽어 모듈 스코프에 접어 둔다. 유형 화면마다 다시 읽으면
// 요청마다 디스크를 치는 셈이 된다.
//
// ⚠️ `server-only` 를 들이지 않는다 — `fs` 를 쓰므로 서버에서만 도는 것이 사실이지만,
//    타입을 화면이 읽는다. 값 import 하나가 클라이언트 그래프에 server-only 를 끌고 들어가
//    빌드를 죽인 사고가 이 저장소에 **세 번** 있었다(CONVENTIONS.md §server-only).

import fs from 'node:fs'
import path from 'node:path'

import { summarizeLocus, type LocusSummary } from './locus-model'

const DATA_DIR = path.join(process.cwd(), 'src/lib/csat/skeleton-data')

let cache: Map<string, LocusSummary | null> | null = null

/** 골격 전체를 한 번 훑어 유형별 위치를 모은다. */
function build(): Map<string, LocusSummary | null> {
  const byType = new Map<string, number[]>()
  try {
    const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8')) as {
      exams: { exam_id: string }[]
    }
    for (const e of index.exams) {
      const file = path.join(DATA_DIR, `${e.exam_id}.json`)
      const items = (JSON.parse(fs.readFileSync(file, 'utf8')) as {
        items: {
          type_id: string | null
          sentences: unknown[]
          anchors: { id: string; sentences: number[] }[]
        }[]
      }).items
      for (const it of items) {
        if (!it.type_id) continue
        const a = it.anchors.find((x) => x.id === 'answer')
        if (!a || !a.sentences.length) continue
        // 문장이 하나뿐이면 상대 위치의 분모가 0 이다 — 안내문 유형에 실제로 있다.
        if (it.sentences.length < 2) continue
        const mid = a.sentences.reduce((s, x) => s + x, 0) / a.sentences.length
        const rel = mid / (it.sentences.length - 1)
        const arr = byType.get(it.type_id) ?? []
        arr.push(rel)
        byType.set(it.type_id, arr)
      }
    }
  } catch {
    // 골격을 못 읽으면 **빈 지도**를 남긴다 — 화면은 이 절을 안 그린다.
    // 0 으로 채운 분포를 그리면 «근거가 앞머리에 몰려 있다» 는 거짓을 말하게 된다.
    return new Map()
  }

  const out = new Map<string, LocusSummary | null>()
  for (const [t, xs] of byType) out.set(t, summarizeLocus(xs))
  return out
}

/**
 * 한 유형의 요약. 표본이 적거나(8문항 미만) 골격을 못 읽으면 **`null`** —
 * 화면은 그때 이 절을 그리지 않는다.
 */
export function typeLocus(typeId: string | null | undefined): LocusSummary | null {
  if (!typeId) return null
  if (!cache) cache = build()
  return cache.get(typeId) ?? null
}

/** 수치를 낸 유형 수 — 회귀가 «집계가 통째로 죽지 않았는가» 를 볼 때 쓴다. */
export function typeLocusCoverage(): { types: number; withSummary: number } {
  if (!cache) cache = build()
  let withSummary = 0
  for (const v of cache.values()) if (v) withSummary += 1
  return { types: cache.size, withSummary }
}
