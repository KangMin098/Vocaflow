// packages/library-pipeline/src/textbook/review-digest.ts
//
// **검수 판(版) — 그 판정이 「어느 문항」을 보고 내려진 것인가.**
//
// ── 왜 필요한가 (실측 2026-09-13~14) ─────────────────────────────────
// 세 회차의 3인 검수 통과율이 5/60 · 0/55 · 4/57 로 제자리였다. 재고 품질 탓인 줄 알았는데
// 아니었다. 차단 사유 1위가 「해설」(17.0% · 117문항)이었고, 그 해설은 **같은 날 고쳐져
// 38,522문항이 다시 쓰였다.** 그런데 그때 내려진 `fail` 은 그대로 남았고, 조판기는 그 판정으로
// 문항을 영구히 뺀다. 실측 — 후보에서 빠진 163문항 중 **123(75%)이 판정 시점과 해설이 다르다.**
//
// 즉 **생성기를 고쳐도 옛 판정이 안 풀린다.** 후보 풀은 품질이 오르는 동안 단조롭게 줄고,
// 회차마다 새 문항을 태우기만 하니 통과율이 구조적으로 회복될 수 없었다.
//
// ── 규칙은 하나다 ────────────────────────────────────────────────────
// 검수 행에 **그때 읽은 문항의 지문(digest)** 을 적는다. 게이트는 **지금 문항의 지문과 같은
// 판정만 센다.** 다르면 pass 도 fail 도 아니고 **「못 쟀다」**이며, 그 문항은 검수 큐로 돌아간다.
//
// ⚠️ **판정을 지우지 않는다.** 사람(페르소나)이 실제로 읽고 내린 기록이다. 무효가 되는 것이
//   아니라 **다른 판에 대한 기록**이 될 뿐이다. 지우면 「왜 그때 막혔나」를 다시 물을 수 없다.
//
// ⚠️ **해설을 지문에 넣는다.** 넣지 않으면 해설만 고쳤을 때 옛 판정이 살아남는데, 검수자
//   셋 중 `tutor` 는 「해설이 왜 나머지가 아닌지를 짚나」를 **판정 근거로 쓴다**. 해설이 바뀌면
//   그 사람이 본 것이 바뀐 것이다. 그래서 해설 재생성은 검수를 되돌린다 — 그것이 비용이지만
//   **숨은 비용이 아니라 보이는 비용**이라 옳다.
//
// 순수 함수다 — DB 도 파일도 안 읽는다.

import { createHash } from 'node:crypto'

/**
 * 키 순서에 흔들리지 않는 직렬화.
 *
 * ⚠️⚠️ **`JSON.stringify` 를 그냥 쓰면 안 된다 — jsonb 가 키 순서를 바꿔 저장한다.**
 *   Postgres 는 객체 키를 (길이 → 바이트) 순으로 정렬해 보관하므로, 파일에서 읽은 객체와
 *   DB 에서 읽어 온 객체는 **내용이 같아도 문자열이 다르다.** 이 저장소는 그 함정에 실제로
 *   빠졌다(2026-09-13: 「내용이 같으면 새 버전을 안 만든다」가 한 번도 안 지켜져 전량 적재
 *   한 번이 802행을 더했다). 여기서 같은 일이 나면 **모든 검수가 매번 낡은 것으로 보인다.**
 *
 * ⚠️ **배열 순서는 건드리지 않는다** — 선지 ①~⑤ 와 밑줄 자리는 순서가 곧 내용이다.
 *
 * ⚠️ 같은 규칙이 `scripts/csat/gate-make.mjs` 와 `scripts/csat/analysis-drain-import.mjs` 에도
 *   따로 적혀 있다. 셋이 갈리면 판정이 갈리므로, 그 둘을 고칠 일이 생기면 여기로 모은다.
 */
export function canonicalJson(value: unknown): string {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = canon((v as Record<string, unknown>)[k])
      }
      return out
    }
    return v
  }
  return JSON.stringify(canon(value))
}

/** 검수 판의 길이 — sha256 hex. 열 제약이 이 값을 쓴다. */
export const REVIEW_DIGEST_LENGTH = 64

/**
 * 그 문항의 **지금 판**. 검수 행에 적고, 게이트가 같은 값인지 본다.
 *
 * @param payload    `csat_dcp_items.payload` — 지문·선지·밑줄. 검수자가 읽은 문제 그 자체.
 * @param answerKey  `csat_dcp_items.answer_key` — 정답과 **해설**. 위 머리말 참조.
 */
export function reviewDigest(payload: unknown, answerKey: unknown): string {
  return createHash('sha256')
    .update(canonicalJson({ answer_key: answerKey ?? null, payload: payload ?? null }))
    .digest('hex')
}

/** 검수 한 행 — 판을 가릴 때 필요한 것만. */
export interface DigestedReviewRow {
  item_id: string
  persona: string
  verdict?: string | null
  /** 그때 읽은 판. **옛 행은 `null`** — 「같다」가 아니라 「모른다」다. */
  reviewed_digest?: string | null
}

/** 그 문항의 지금 판. 게이트가 대조 상대로 넘긴다. */
export type CurrentDigests = ReadonlyMap<string, string>

export type ReviewFreshness =
  /** 지금 판을 보고 내려진 판정. */
  | 'current'
  /** 다른 판을 보고 내려졌다 — 다시 봐야 한다. */
  | 'stale'
  /** 어느 판인지 기록이 없다(판 열이 생기기 전 행). **통과로도 차단으로도 세지 않는다.** */
  | 'unknown'

export function freshnessOf(row: DigestedReviewRow, current: CurrentDigests): ReviewFreshness {
  const d = row.reviewed_digest
  if (!d) return 'unknown'
  const now = current.get(row.item_id)
  if (!now) return 'unknown'
  return d === now ? 'current' : 'stale'
}

export interface FreshReviewTally {
  /** 지금 판으로 서로 다른 3인이 pass 한 문항 수 — **이것만 조판을 통과시킨다.** */
  passed: number
  /** 지금 판으로 3인이 보기는 한 문항 수(판정 무관). */
  settled: number
  /** 다른 판의 판정이 붙어 있어 다시 봐야 하는 문항 수. */
  stale: number
  /** 어느 판인지 모르는 판정이 붙은 문항 수. */
  unknown: number
}

/**
 * **지금 판 기준으로만 센다.**
 *
 * ⚠️ 낡은 판정을 「통과」로도 「차단」으로도 세지 않는다. 통과로 세면 안 읽은 것을 읽었다고
 *   하는 것이고, 차단으로 세면 **고쳐도 영원히 안 풀린다** — 후자가 실제로 일어난 일이다.
 */
export function tallyFreshReviews(
  rows: readonly DigestedReviewRow[],
  current: CurrentDigests,
  quorum = 3,
): FreshReviewTally {
  const seen = new Map<string, Set<string>>()
  const passers = new Map<string, Set<string>>()
  const staleItems = new Set<string>()
  const unknownItems = new Set<string>()

  for (const r of rows) {
    if (!r?.item_id || !r?.persona) continue
    const f = freshnessOf(r, current)
    if (f === 'stale') { staleItems.add(r.item_id); continue }
    if (f === 'unknown') { unknownItems.add(r.item_id); continue }
    if (!seen.has(r.item_id)) seen.set(r.item_id, new Set())
    seen.get(r.item_id)!.add(r.persona)
    if (r.verdict !== 'pass') continue
    if (!passers.has(r.item_id)) passers.set(r.item_id, new Set())
    passers.get(r.item_id)!.add(r.persona)
  }

  const atQuorum = (m: Map<string, Set<string>>) =>
    [...m.values()].filter((s) => s.size >= quorum).length

  // 지금 판 판정이 하나라도 있는 문항은 낡음·모름 목록에서 뺀다 — 한 문항에 두 판이 섞일 수 있다.
  for (const id of seen.keys()) { staleItems.delete(id); unknownItems.delete(id) }

  return {
    passed: atQuorum(passers),
    settled: atQuorum(seen),
    stale: staleItems.size,
    unknown: unknownItems.size,
  }
}
