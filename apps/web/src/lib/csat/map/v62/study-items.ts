// apps/web/src/lib/csat/map/v62/study-items.ts
//
// v6.2 P-M3b — TASK 의 「기출 해부로 공부할 문항」을 학습자 노출 규칙에 맞게 고른다(순수 함수 · 판정 아님).
//   열어도 되는 것: ① 이 TASK 의 확인 문항 중 **이미 풀어 본** 것(확인 근거는 이미 남았다 — 해설을 봐도 독립성을 해치지 않는다)
//                  ② 연구 v1.4 에서 두 AI 가 같은 판정(직접 · 간접)을 낸 문항 중 **확인 · 전이 묶음 밖**인 것(사람 검수 전 사례로 표시)
//   열면 안 되는 것: 아직 안 푼 확인 문항 · 전이(다른 글에 적용) 문항 — 해설을 먼저 보면 독립 확인 · 전이로 쓸 수 없다(링크를 만들지 않는다).
// 공유 지문 · 정규화 같은 본문의 노출은 원장이 없어 판정하지 않는다 — 그 사실을 `sharedPassageUnchecked` 로 함께 돌려준다.
// 문항 화면 자체의 Reveal/Embargo · 권리 게이트는 그대로 적용된다(여기서 우회하지 않는다).

import type { AsIsTask } from '../v4/as-is'
import type { TaskId } from '../v4/definition'
import type { ConfirmLink } from '../v4/to-be'

import RESEARCH from './research-v14.data.json'

export interface StudyItem {
  /** 문항 id(<시험>#<번호>) */
  item: string
  /** 왜 열어도 되는가 */
  basis: 'attempted_check_item' | 'research_case'
  /** 연구 사례면 두 AI 판정(같은 값) */
  research: 'direct' | 'indirect' | null
}

export interface StudyItems {
  items: StudyItem[]
  /** 지금은 열지 않는 이 TASK 의 문항 수 — 아직 안 푼 확인 · 전이(독립성 보호) */
  withheld: number
  sharedPassageUnchecked: true
}

const norm = (id: string) => id.replace('-', '#')

export function studyItemsFor(task: TaskId, check: AsIsTask['check'], confirm: readonly ConfirmLink[], transfer: readonly ConfirmLink[]): StudyItems {
  const confirmIds = new Set(confirm.map((l) => norm(l.target)))
  const transferIds = new Set(transfer.map((l) => norm(l.target)))
  const unseen = new Set((check?.unseen ?? []).map(norm))
  // 확인 묶음 중 안 본 것이 아닌 것 = 확인 과제로 풀었거나 시험지로 이미 본 것
  const attempted = [...confirmIds].filter((id) => !unseen.has(id))
  const out: StudyItem[] = attempted.map((item) => ({ item, basis: 'attempted_check_item' as const, research: null }))
  for (const l of RESEARCH.links) {
    if (l.task !== task || !l.agree || (l.first !== 'direct' && l.first !== 'indirect')) continue
    if (confirmIds.has(l.item) || transferIds.has(l.item) || out.some((x) => x.item === l.item)) continue
    out.push({ item: l.item, basis: 'research_case', research: l.first })
  }
  const withheld = [...confirmIds].filter((id) => unseen.has(id)).length + transferIds.size
  return { items: out, withheld, sharedPassageUnchecked: true }
}

