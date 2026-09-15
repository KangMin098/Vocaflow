// apps/web/src/lib/csat/report-markup.ts
//
// **유형 리포트의 산문을 «읽을 수 있는 것» 으로 쪼갠다.**
//
// ── 무엇이 문제였나 (실측 2026-09-15) ─────────────────────────────────
// `/csat/[typeId]` 는 `answer_locus_pattern` 을 `whitespace-pre-line` 한 `<p>` **하나**로
// 쏟는다. 그 값은 평균 1,763자 · **최대 5,931자**다. 이 저장소가 `/admin/db` 에서 고친
// 「가장 긴 덩어리 440 → 48자」의 **13배**다. 화면 전체는 렌더 평균 4,190자 · 최대 8,671자.
//
// 그런데 그 글은 **이미 읽을 수 있게 쓰여 있었다.** 화면이 버리고 있었을 뿐이다:
//   · 문단 — 26유형 중 **23**이 `\n\n` 로 나뉘어 있는데 한 덩어리로 붙어 나온다
//   · 굵게 — 26유형 중 **22**가 `**…**` 를 쓰는데 학습자에게는 **별표가 그대로 보인다**
//   · 문항 인용 — `2014B#32` `M1809#35` 같은 참조가 리포트 전체에 **1,182개**
//     (근거 위치 474 · 함정 230 · 미끄러짐 472 · 절차 6). **전부 링크가 아니다.**
//     그 문항들은 이제 지문 지도를 갖고 있는데, 유형 화면에서 거기로 가는 길이 없다.
//
// 이 파일은 그 셋을 **데이터에 이미 있는 구조 그대로** 살린다. 지어내는 것이 없다.
//
// ── 링크는 실재하는 문항에만 ──────────────────────────────────────────
// 인용 474개 중 **467(98.5%)이 그 유형 자신의 문항**이고, 2개는 다른 유형, 5개는 없는 문항이다.
// 그래서 **부르는 쪽이 아는 id 집합**을 넘기고, 그 안에 있는 것만 링크가 된다 —
// 없는 문항으로 가는 링크는 막다른 화면이다(D4). 화면은 이미 그 유형의 문항 목록을
// 불러오므로 **추가 조회가 없다.**
//
// `server-only` 를 들이지 않는다 — 화면이 값으로 부른다.

/** 문단 안의 한 조각. */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  /** 실재하는 문항 참조 — 화면이 링크로 만든다. */
  | { kind: 'item'; text: string; itemId: string }

export interface Block {
  segments: Segment[]
}

/** `2014A#33` · `M1809#35` — 회차는 4자리 연도(+A/B) 또는 M+4자리. */
const ITEM_REF = /((?:\d{4}[AB]?|M\d{4})#\d+)/g
const STRONG = /\*\*([^*]+)\*\*/g

/** 텍스트 한 토막에서 문항 참조를 갈라낸다. 모르는 id 는 평문으로 남는다. */
function splitItems(text: string, known: Set<string>, out: Segment[], strong: boolean): void {
  if (!text) return
  let at = 0
  ITEM_REF.lastIndex = 0
  for (let m = ITEM_REF.exec(text); m; m = ITEM_REF.exec(text)) {
    const id = m[1]
    if (!known.has(id)) continue
    if (m.index > at) push(out, text.slice(at, m.index), strong)
    out.push({ kind: 'item', text: id, itemId: id })
    at = m.index + id.length
  }
  if (at < text.length) push(out, text.slice(at), strong)
}

function push(out: Segment[], text: string, strong: boolean): void {
  if (!text) return
  const last = out[out.length - 1]
  // 이어진 같은 종류는 합친다 — 조각이 잘게 쪼개지면 화면에서 자간이 어긋난다.
  if (last && last.kind === (strong ? 'strong' : 'text')) {
    last.text += text
    return
  }
  out.push(strong ? { kind: 'strong', text } : { kind: 'text', text })
}

/**
 * 리포트 산문 → 문단 배열.
 *
 * `known` 에 있는 문항 참조만 `item` 조각이 된다. 빈 문단은 버린다.
 * **원문 글자를 잃지 않는다** — `**` 표시만 벗기고 나머지는 그대로다(회귀가 확인한다).
 */
export function parseReportText(text: string | null | undefined, known: Set<string> = new Set()): Block[] {
  if (!text) return []
  const blocks: Block[] = []

  for (const raw of text.split(/\n{2,}/)) {
    const para = raw.trim()
    if (!para) continue
    const segments: Segment[] = []
    let at = 0
    STRONG.lastIndex = 0
    for (let m = STRONG.exec(para); m; m = STRONG.exec(para)) {
      if (m.index > at) splitItems(para.slice(at, m.index), known, segments, false)
      splitItems(m[1], known, segments, true)
      at = m.index + m[0].length
    }
    if (at < para.length) splitItems(para.slice(at), known, segments, false)
    if (segments.length) blocks.push({ segments })
  }

  return blocks
}

/** 이 글이 실제로 가리키는 문항들 — 화면이 「이 유형을 보여 주는 문항 N개」를 셀 때 쓴다. */
export function citedItems(text: string | null | undefined, known: Set<string> = new Set()): string[] {
  if (!text) return []
  const out: string[] = []
  ITEM_REF.lastIndex = 0
  for (let m = ITEM_REF.exec(text); m; m = ITEM_REF.exec(text)) {
    if (known.has(m[1]) && !out.includes(m[1])) out.push(m[1])
  }
  return out
}
