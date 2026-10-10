// apps/web/src/lib/csat/next-item.ts
//
// **한 문항을 다 본 학습자를 다음 기출로 잇는다.**
//
// ── 왜 필요한가 (실측 2026-09-15) ─────────────────────────────────────
// 문항 해설 화면의 **나가는 문이 둘뿐**이었다 — 「← 유형 목록」과 「평가원 원본과 함께 보기」.
// 지도 안에서는 칩을 눌러 가며 근거를 옮겨 볼 수 있지만, **문항을 다 보고 나면 앞이 없다.**
// 유형 목록으로 되돌아가 다시 고르는 두 걸음을 거쳐야 다음 지도에 닿는다.
//
// 그런데 이 화면의 값어치는 **연달아 볼 때** 생긴다. 한 문항만 보면 일화이고, 같은 유형을
// 서넛 연달아 보면 「이 유형은 여기를 본다」가 **규칙으로** 잡힌다(학습과학 원칙 5
// Context-Dependent — 패턴을 그 맥락에서 되풀이해 인출한다).
//
// ── 무엇을 다음으로 고르는가 ──────────────────────────────────────────
//   ① **해설이 있는 것** — 없으면 눌러도 「아직 쓰는 중이에요」가 뜬다. 그건 앞길이 아니다.
//   ② **지도가 있는 것을 먼저** — 지도가 없으면 산문 화면으로 떨어져 방금 익힌 조작이 사라진다.
//      (802문항 중 골격이 있는 것은 589 = 73%. 아무거나 고르면 넷 중 하나가 산문이다.)
//   ③ **최신 회차부터** — 현행 설계에 가까운 것이 시험에 가깝다(유형 화면의 정렬과 같은 판단).
//   ③-1 **이 기기에서 본 문항은 뒤로**(F14 · 2026-10-10) — 최신순만 쓰면 최신 A 에서 B 로, B 에서 다시 A 로
//      왕복했다. 본 것을 빼고 고르고, 이 유형을 다 봤으면 현재 문항의 **다음 순번**을 「다시 보기」로 준다
//      (revisit: true — 화면이 새 문항인 척하지 않는다).
//   ④ 그래도 없으면 **null** — 없는 길을 있는 척하지 않는다. 화면이 그때는 문을 안 그린다.
//
// 순수 함수다. 목록과 «골격이 있는가» 를 받아 고르기만 한다 — 조회는 부르는 쪽의 몫이다.
import { examIdOf, parseExamId } from './exam-id'

/** 이 자가 고를 수 있는 최소한의 문항 정보. `CsatItemBrief` 가 그대로 들어맞는다. */
export interface NextCandidate {
  id: string
  slug: string
  exam_label: string
  no: number
  /** 정답 근거 서술이 있는가. 없으면 고르지 않는다. */
  explained: boolean
}

export interface NextPick {
  item: NextCandidate
  /** 그 문항이 지도를 갖는가 — 화면이 「지도로 이어집니다」를 말할 수 있다. */
  hasMap: boolean
  /** 이 유형에서 아직 안 본 것이 몇 개나 남았는가(현재 문항 제외 · seen 을 안 주면 후보 수). */
  remaining: number
  /** 후보를 다 봐서 이미 본 문항을 다시 주는가 — 의도적인 재방문으로 표시한다 */
  revisit: boolean
}

/**
 * 회차 label 에서 정렬 키를 만든다. 최신이 크다.
 *
 * id 는 `2026#31` · `M2309#42` 꼴이다 — 수능은 4자리 연도, 모평은 `M` + `YYMM`.
 * **label 을 파싱하지 않는다** — 사람이 읽는 문자열이라 언제든 바뀐다.
 */
export function examRank(itemId: string): number {
  // ⚠️ 빈 id·문법 밖 id 는 0 — `0.99` 같은 값을 받으면 없는 회차가 실재하는 것처럼
  //    정렬에 끼어든다(검사가 잡았다). 판정은 `exam-id.ts` 한곳이 한다.
  const p = parseExamId(examIdOf(itemId))
  if (!p) return 0
  // 수능은 그해 11월 시행이라 같은 학년도 모의고사보다 뒤다. 같은 달 학평은 학년 순.
  if (p.kind === 'suneung') return p.schoolYear + 0.99
  return p.schoolYear + p.month / 100 + (p.kind === 'hakpyeong' ? p.grade / 1000 : 0)
}

/**
 * 다음에 볼 기출 하나. 없으면 `null`.
 *
 * `hasMap` 은 «그 문항에 골격이 있는가» 를 답하는 자다. 부르는 쪽이 커밋된 골격을 읽어 넘긴다.
 */
export function pickNextItem(
  items: NextCandidate[],
  currentId: string,
  hasMap: (id: string) => boolean,
  seen: ReadonlySet<string> = new Set(),
): NextPick | null {
  const rank = (i: NextCandidate) => examRank(i.id)
  const order = (a: NextCandidate, b: NextCandidate) => rank(b) - rank(a) || a.no - b.no
  const pool = items.filter((i) => i.id !== currentId && i.explained)
  if (!pool.length) return null
  const fresh = pool.filter((i) => !seen.has(i.id)).sort(order)

  if (fresh.length) {
    // 지도가 있는 것을 먼저. 없으면 해설만 있는 것이라도 준다 — 앞길이 아예 없는 것보다 낫다.
    const item = fresh.find((i) => hasMap(i.id)) ?? fresh[0]
    return { item, hasMap: hasMap(item.id), remaining: fresh.length, revisit: false }
  }
  // 다 봤다 — 현재 문항 다음 순번(끝이면 처음)으로 돈다. 최신 문항으로 되돌아가 둘 사이를 왕복하지 않는다.
  const ring = [...items.filter((i) => i.explained || i.id === currentId)].sort(order)
  const at = ring.findIndex((i) => i.id === currentId)
  const item = (at < 0 ? pool.sort(order) : [...ring.slice(at + 1), ...ring.slice(0, at)]).find((i) => i.id !== currentId) ?? null
  return item ? { item, hasMap: hasMap(item.id), remaining: 0, revisit: true } : null
}
