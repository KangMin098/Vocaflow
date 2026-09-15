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
//   ④ 그래도 없으면 **null** — 없는 길을 있는 척하지 않는다. 화면이 그때는 문을 안 그린다.
//
// 순수 함수다. 목록과 «골격이 있는가» 를 받아 고르기만 한다 — 조회는 부르는 쪽의 몫이다.

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
  /** 이 유형에서 아직 안 본 것이 몇 개나 남았는가(이 문항 포함). */
  remaining: number
}

/**
 * 회차 label 에서 정렬 키를 만든다. 최신이 크다.
 *
 * id 는 `2026#31` · `M2309#42` 꼴이다 — 수능은 4자리 연도, 모평은 `M` + `YYMM`.
 * **label 을 파싱하지 않는다** — 사람이 읽는 문자열이라 언제든 바뀐다.
 */
export function examRank(itemId: string): number {
  const exam = itemId.split('#')[0] ?? ''
  if (exam.startsWith('M')) {
    const yy = Number(exam.slice(1, 3))
    const mm = Number(exam.slice(3, 5))
    if (Number.isFinite(yy) && Number.isFinite(mm)) return 2000 + yy + mm / 100
  }
  // ⚠️ `Number('')` 은 0 이고 **유한하다**. 빈 id 를 그냥 통과시키면 `0.99` 를 받아
  //    정렬에서 없는 회차가 실재하는 것처럼 끼어든다(검사가 잡았다). 네 자리 숫자만 받는다.
  const head = exam.slice(0, 4)
  if (!/^\d{4}$/.test(head)) return 0
  // 수능은 그해 11월 시행이라 같은 해 모평보다 뒤다.
  return Number(head) + 0.99
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
): NextPick | null {
  const pool = items.filter((i) => i.id !== currentId && i.explained)
  if (!pool.length) return null

  const rank = (i: NextCandidate) => examRank(i.id)
  const sorted = [...pool].sort((a, b) => rank(b) - rank(a) || a.no - b.no)

  // 지도가 있는 것을 먼저. 없으면 해설만 있는 것이라도 준다 — 앞길이 아예 없는 것보다 낫다.
  const withMap = sorted.find((i) => hasMap(i.id))
  const item = withMap ?? sorted[0]
  return { item, hasMap: hasMap(item.id), remaining: pool.length }
}
