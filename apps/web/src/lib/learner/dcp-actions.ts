// apps/web/src/lib/learner/dcp-actions.ts
//
// CTP DCP(구문 연습) 서버 액션 — Phase 2.
//   fetchDcpPracticeItems : 오늘 처방(prescribe_today) practice 블록 문항(payload 포함) 조회. S3+ 에서만 active.
//   gradeDcpItem          : grade_dcp_item RPC(서버 answer_key 채점) → {correct, attemptId, answerKey}. attempt 기록.
//   recordDcpErrorCause   : 오답 attempt 에 error_cause 부착(RLS owner + CHECK 5원인).

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type { DcpErrorCause, DcpGradeResult, DcpItem } from './dcp'
import { remainingAfterAttempts, utcDayStartIso } from './dcp'
import { SERIES_SPINE, cleanItemPayload, isTooShortForPractice, itemHygieneReject, itemWordSpec } from '@vocaflow/library-pipeline'

import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'

import { isChoiceDcpType, isPlayableDcpType } from './dcp-types'

const ALLOWED_CAUSES: readonly DcpErrorCause[] = ['vocab', 'parsing', 'structure', 'inference', 'timing']

/**
 * prescribe_today practice 블록의 raw 문항 하나를 DcpItem 으로 검증·정규화. 부적격이면 null.
 *
 * ⚠️ `csat_dcp_items` 에는 **교재(인쇄물)에만 쓰는 유형도 함께 저장된다**
 *   (`irrelevant`·`word_order`·`vocab_choice`). 처방이 그것을 뽑아 오면 여기서 `null` 이
 *   되어 학습자가 조용히 문항을 잃는다 — 2026-08-21 에 실제로 그랬다(발행 카탈로그 안
 *   42.5%). 막는 쪽은 `prescribe_today` 의 허용 목록이고, 여기서는 **어느 갈래인지 먼저
 *   확인해** 의도를 코드에 남긴다.
 */
function parseItem(raw: unknown): DcpItem | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r.id !== 'string') return null
  const type = r.type
  // 교재용 유형은 화면이 그리지 못한다 — 여기서 걸러 낸 것이 곧 처방이 새고 있다는 뜻이다.
  if (!isPlayableDcpType(type)) return null
  const payload = r.payload as Record<string, unknown> | null
  if (!payload) return null

  if (type === 'order') {
    const presented = (payload as { presented?: unknown }).presented
    if (!Array.isArray(presented) || presented.length < 2) return null
    return {
      id: r.id,
      type: 'order',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: { presented: presented.map((s) => String(s)) },
    }
  }
  if (type === 'insert') {
    const remaining = (payload as { remaining?: unknown }).remaining
    const insertSentence = (payload as { insert_sentence?: unknown }).insert_sentence
    const gapCount = (payload as { gap_count?: unknown }).gap_count
    if (!Array.isArray(remaining) || typeof insertSentence !== 'string') return null
    return {
      id: r.id,
      type: 'insert',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: {
        remaining: remaining.map((s) => String(s)),
        insert_sentence: insertSentence,
        gap_count: typeof gapCount === 'number' ? gapCount : remaining.length + 1,
      },
    }
  }

  // ── 선택지 9종 ────────────────────────────────────────────────
  // 아홉이 한 갈래인 이유는 **모양이 같아서**다(payload·answer_key 실측 동일).
  // 유형마다 분기를 두면 아홉 벌이 조금씩 어긋난 채 남는다.
  if (isChoiceDcpType(type)) {
    const passage = (payload as { passage?: unknown }).passage
    const choices = (payload as { choices?: unknown }).choices
    const stemKo = (payload as { stem_ko?: unknown }).stem_ko
    // 선택지가 5개가 아니면 문항이 성립하지 않는다 — 그리면 학습자가 못 푸는 화면이 된다.
    if (typeof passage !== 'string' || !passage.trim()) return null
    if (!Array.isArray(choices) || choices.length !== 5) return null
    if (typeof stemKo !== 'string' || !stemKo.trim()) return null
    const underline = (payload as { underline?: unknown }).underline
    const summarySentence = (payload as { summary_sentence?: unknown }).summary_sentence
    return {
      id: r.id,
      type,
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: {
        passage,
        choices: choices.map((c) => String(c)),
        stemKo,
        underline: typeof underline === 'string' && underline.trim() ? underline : null,
        summarySentence: typeof summarySentence === 'string' && summarySentence.trim() ? summarySentence : null,
      },
    }
  }
  return null
}

/**
 * 담은 교재가 덮는 V-Level 목록.
 *
 * ⚠️ **사다리는 여기서 푼다.** `prescribe_today` 는 레벨만 알고 step 을 모른다 —
 *    step → V-Level 매핑의 정본은 `SERIES_SPINE` 이고, SQL 에 복사하면 눈금이 둘이 되어
 *    반드시 갈린다(`user_textbook_selections` 가 step 번호만 저장한 이유와 같다).
 *
 * 못 읽으면 빈 배열 — 그러면 처방은 예전과 똑같이 동작한다(담기가 오늘 할 것을 줄이지 않는다).
 */
async function pickedVLevels(): Promise<number[]> {
  const mine = await fetchMyTextbooks()
  if (!mine.available || mine.steps.length === 0) return []
  const levels = new Set<number>()
  for (const rung of SERIES_SPINE) {
    if (mine.steps.includes(rung.step)) for (const lv of rung.vLevels) levels.add(lv)
  }
  return [...levels].sort((a, b) => a - b)
}

/**
 * 오늘 이미 시도한 문항을 뺀다. 판정 규칙 자체는 `dcp.ts` 에 있다(순수 · 테스트가 잠근다).
 *
 * ⚠️ **조회가 실패하면 거르지 않는다.** 못 읽은 것을 "다 풀었다" 로 뭉개면 오늘 몫이
 *   통째로 사라진다 — 다시 푸는 낭비보다 못 푸는 손실이 크다. 그래서 `checked` 를 함께
 *   돌려주고, 화면이 「다 했어요」라고 말하는 것은 그 값이 참일 때뿐이다.
 */
async function excludeAttemptedToday(
  client: SupabaseClient,
  userId: string,
  items: DcpItem[],
): Promise<{ items: DcpItem[]; checked: boolean }> {
  if (items.length === 0) return { items, checked: true }
  const { data, error } = await client
    .from('csat_item_attempts')
    .select('dcp_item_id')
    .eq('user_id', userId)
    .in(
      'dcp_item_id',
      items.map((i) => i.id),
    )
    .gte('responded_at', utcDayStartIso())
  if (error || !data) return { items, checked: false }
  const attempted = (data as { dcp_item_id: string | null }[]).map((r) => r.dcp_item_id)
  return { items: remainingAfterAttempts(items, attempted), checked: true }
}

/**
 * 오늘 처방의 구문 연습(DCP) 문항. S3 미만이거나 문항 없으면 active=false.
 *
 * `steered` = 이 문항들이 **담은 교재에서** 나왔는가. 화면이 그 사실을 말할 수 있어야
 * "담기가 무엇을 바꿨는지" 를 학습자가 안다 — 안 그러면 또 보이지 않는 약속이 된다.
 *
 * `doneToday` = 처방은 있었는데 **오늘 몫을 이미 다 풀어서** 남은 것이 없다.
 * `active:false` 하나로 뭉개면 화면이 "학습 단계가 무르익으면 열려요"(잠김 안내)를
 * 띄운다 — 방금 다 푼 학습자에게 아직 못 연다고 말하는 셈이다.
 */
export async function fetchDcpPracticeItems(): Promise<{
  active: boolean
  items: DcpItem[]
  steered: boolean
  doneToday: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { active: false, items: [], steered: false, doneToday: false }

  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('prescribe_today', {
    p_user_id: user.id,
    p_v_levels: await pickedVLevels(),
  })
  if (error || !data) return { active: false, items: [], steered: false, doneToday: false }

  const blocks = (data as { blocks?: unknown }).blocks
  const practice = Array.isArray(blocks)
    ? (blocks.find((b) => (b as { kind?: string } | null)?.kind === 'practice') as Record<string, unknown> | undefined)
    : undefined
  if (!practice || practice.active !== true) {
    return { active: false, items: [], steered: false, doneToday: false }
  }

  const raw = practice.items
  const prescribed = Array.isArray(raw) ? raw.map(parseItem).filter((x): x is DcpItem => x !== null) : []
  const { items, checked } = await excludeAttemptedToday(loose, user.id, prescribed)

  return {
    active: items.length > 0,
    items,
    steered: practice.steered === true,
    // 처방은 있었는데 남은 것이 0 — 그 판정은 **실제 조회에 근거할 때만** 내린다.
    doneToday: checked && prescribed.length > 0 && items.length === 0,
  }
}

/**
 * 교재 계단(V-Level)의 연습 문항을 가져온다 — **오늘 처방과 다른 경로다.**
 *
 * ── 왜 따로 있나 ────────────────────────────────────────────────────
 * `fetchDcpPracticeItems` 는 오늘 처방을 읽으므로 S3 이상에서만 열린다. 그런데 교재 서가
 * (`/library/textbooks`)는 학령 사다리를 보여 주면서 **풀 자리가 없었다** — 재고만 보고
 * `/hub` 로 돌아가는 화면이었다. 그래서 `csat_item_attempts` 가 0행이고,
 * **난이도(P)·변별도(D)를 못 낸다**(평가 요소 중 열위 하나).
 *
 * ⚠️ 문항 테이블은 학습자가 못 읽는다(admin 정책 하나뿐). **열어서도 안 된다** —
 *   같은 행에 `answer_key` 가 있어서 정책을 열면 브라우저에서 정답이 보인다.
 *   그래서 `textbook_practice_items` RPC 가 정답을 뺀 열만 내준다.
 *
 * ⚠️ **어떤 유형이 나오는지는 RPC 가 정한다.** 다만 2026-09-01 부터 **품질 게이트는 여기서
 *   건다** — RPC 가 조판의 게이트를 하나도 쓰지 않아 연습 후보에 철회 논문 168문항과
 *   소재 부적합 1,187문항이 남아 있었다. 거르되 **`limit` 의 몇 배를 받아** 거른 뒤 정확히
 *   `limit` 을 내므로, 이 주석이 원래 경고하던 "8문항 달라고 했는데 3개만 뜨는" 조용한
 *   손실은 생기지 않는다. 판정·정제는 `item-hygiene.ts` 한 벌이고 조판이 쓰는 것과 같다.
 */
export async function fetchTextbookPracticeItems(
  vLevel: number,
  limit = 10,
): Promise<{ items: DcpItem[]; unavailable: boolean; signedOut: boolean }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  // ⚠️ 로그인 안 함과 조회 실패를 **한 상태로 뭉개지 않는다.**
  //
  //    둘 다 `unavailable` 로 넘기던 동안 화면은 익명 방문자에게
  //    "문항을 불러오지 못했어요 — 잠시 뒤 다시 열어 볼까요?" 라고 말했다(실측 2026-09-01).
  //    **다시 열어도 영원히 안 된다.** 로그인 링크도 없어 막다른 길이었고,
  //    서가는 비로그인에 열려 있는 공개 표면이라 이 길로 오는 사람이 실제로 있다.
  //
  //    이 저장소가 "못 잼 ≠ 없음" 을 못 박은 것과 같은 규칙이다 —
  //    **되돌릴 수 있는 상태(로그인)와 기다려야 하는 상태(오류)를 같게 적으면 안 된다.**
  //
  //    ⚠️ 채점(`grade_dcp_item`)이 `auth.uid()` 가 없으면 `Forbidden` 을 던진다(실측) —
  //       attempt 를 user_id 에 묶어 기록하기 때문이다. 그래서 문항 조회 RPC 자체는
  //       anon 에도 열려 있지만(실측: 8문항·정답 계열 키 유출 없음) 로그인 없이 연습을
  //       시작시키면 **채점 순간에 막힌다.** 지금은 들어오기 전에 말해 주는 편을 택한다.
  if (!user) return { items: [], unavailable: true, signedOut: true }

  const loose = client as unknown as SupabaseClient
  // ⚠️ **넉넉히 받아서 거른다.** RPC 는 유형 화이트리스트와 `v_level`·발행 상태만 본다 —
  //   조판이 세운 게이트(철회 논문 · 소재 · 기사 껍데기 · 인용 잔해 · 잘린 조각)를 하나도
  //   쓰지 않는다. 그래서 **조판물은 깨끗한데 학습자가 받는 것은 아니었다.**
  //   실측 2026-09-01, 연습 후보 안에 남아 있던 것:
  //     철회 논문 **168문항**(V6 91 · V7 77) · 소재 부적합 **1,187문항**(V6 1,037 · V5 98 · V7 51)
  //
  //   판정은 TypeScript 체인(`itemHygieneReject`)이라 RPC 안으로 넣을 수 없다. 대신
  //   **`limit` 의 몇 배를 받아 거른 뒤 정확히 `limit` 만 낸다** — 이 파일 머리말이 경고한
  //   "8문항 달라고 했는데 3개만 뜨는 조용한 손실" 을 만들지 않기 위해서다.
  //   RPC 상한이 50 이므로 그 안에서 넉넉히 잡는다(실측 반려율 약 8%).
  const overFetch = Math.min(50, Math.max(limit * 3, limit + 10))
  const { data, error } = await loose.rpc('textbook_practice_items', {
    p_v_level: vLevel,
    p_limit: overFetch,
  })
  // 조회 실패를 빈 목록으로 뭉개지 않는다 — 화면이 "아직 문항이 없어요" 로 거짓말하게 된다.
  if (error) return { items: [], unavailable: true, signedOut: false }

  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
  const clean = rows.filter(
    (r) =>
      itemHygieneReject({
        payload: r.payload as Record<string, unknown> | null,
        refTitle: typeof r.ref_title === 'string' ? r.ref_title : null,
      }) === null &&
      // ⚠️ **찍기가 되는 문항은 내보내지 않는다** — 유형 창의 **하한만** 본다.
      //   `CSAT_ITEM_WORDS` 가 적어 둔 그대로: "하한 90 은 64어짜리를 걸러내기 위한 것이다 —
      //   4문장 미만으로 읽히면 순서를 맞출 단서가 부족해 찍기가 된다."
      //   상한과 학년 창은 **걸지 않는다** — 그 둘의 근거는 지면 제약과 시장 적합 주장이고
      //   연습 화면에는 둘 다 없다. 조판과 자가 다른 것이 아니라 **근거가 있는 쪽만** 쓴다.
      //   실측 2026-09-01 반려율: 하한만 33.0% · 상하한+학년창 40.5% · 학년창만 8.6%.
      !isTooShortForPractice(itemWordSpec(String(r.type ?? ''), null).min, r.payload as Record<string, unknown> | null),
  )
  // ⚠️ **정제도 여기서 건다.** 조판은 절 이름·반복 꼬리·구두점·따옴표를 다듬은 사본을
  //   인쇄하는데, 연습은 저장된 payload 를 그대로 내보내고 있었다 — 같은 문항인데
  //   책에서는 깨끗하고 화면에서는 "Abstract The coexistence…" 로 보인다.
  const items = clean
    .map((r) => parseItem({ ...r, payload: cleanItemPayload((r.payload ?? {}) as Record<string, unknown>) }))
    .filter((x): x is DcpItem => x !== null)
    .slice(0, limit)
  return { items, unavailable: false, signedOut: false }
}

/**
 * 서버 answer_key 로 채점(grade_dcp_item). attempt 를 기록하고 attempt_id 반환.
 *
 * ⚠️ **실패는 오답이 아니다.** 반환 타입이 두 갈래(`ok:true` / `ok:false`)인 이유가 그것이다 —
 *   자세한 근거는 `dcp.ts` 의 `DcpGradeFailed` 주석. 여기서 던지지 않고 값으로 돌려주는 것은
 *   server action 이 reject 하면 클라이언트가 받는 것이 "요청 실패" 한 줄뿐이기 때문이다.
 */
export async function gradeDcpItem(
  itemId: string,
  answer: Record<string, unknown>,
): Promise<DcpGradeResult> {
  const client = await createClient()
  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('grade_dcp_item', { p_item_id: itemId, p_answer: answer })
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '채점 결과가 비어 있어요.' }
  const d = data as { correct?: boolean; attempt_id?: string; answer_key?: Record<string, unknown> | null }
  // `correct` 자체가 없으면 채점이 안 된 것이다 — `false` 로 읽으면 또 오답 판정이 된다.
  if (typeof d.correct !== 'boolean') return { ok: false, error: '채점 결과를 읽지 못했어요.' }
  return {
    ok: true,
    correct: d.correct,
    attemptId: d.attempt_id ?? null,
    answerKey: d.answer_key ?? null,
  }
}

/** 오답 attempt 에 error_cause 를 부착(자기보고 1-tap). RLS owner + DB CHECK(5원인) 이중 방어. */
export async function recordDcpErrorCause(attemptId: string, cause: DcpErrorCause): Promise<{ ok: boolean }> {
  if (!attemptId || !ALLOWED_CAUSES.includes(cause)) return { ok: false }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false }

  const loose = client as unknown as SupabaseClient
  const { error } = await loose
    .from('csat_item_attempts')
    .update({ error_cause: cause })
    .eq('id', attemptId)
    .eq('user_id', user.id)
  return { ok: !error }
}
