// packages/library-pipeline/src/textbook/item-hygiene.ts
//
// **문항 하나를 학습자에게 내보내도 되는가 — 판정과 정제를 한 벌로 둔다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-01) ────────────────────────────
// 게이트 다섯(길이·기사 껍데기·인용 잔해·잘린 조각·소재)과 정제 체인(절 이름·반복 꼬리·
// 구두점·따옴표·눌어붙은 제목)을 여러 사이클에 걸쳐 세웠는데, **전부 조판 경로에만
// 걸려 있었다.** 학습자가 실제로 문제를 푸는 `/library/textbooks/[step]/practice` 는
// `textbook_practice_items` RPC 로 창고에서 곧장 가져오고, 그 RPC 는 유형 화이트리스트와
// `v_level` · 발행 상태만 본다. 그래서 연습 후보 안에 이만큼이 남아 있었다:
//
//   철회 논문      **168문항**  (V6 91 · V7 77)
//   소재 부적합   **1,187문항**  (V6 1,037 · V5 98 · V7 51 · V4 1)
//   절 이름 잔존      56문항
//
// ⚠️ 소재 수치는 **학습자가 실제로 읽는 글**(제목 + payload)로 센 값이다. 원글 본문까지
//   훑으면 14,738문항이 걸리는데, 그건 출처 논문이 그 소재를 어딘가에서 언급한다는 뜻이지
//   보이는 지문이 그렇다는 뜻이 아니다 — **조판도 같은 예측어를 쓴다.** 둘을 섞어 적으면
//   고친 효과를 부풀리게 된다(처음에 그렇게 적었다가 바로잡았다).
//
// 조판물은 깨끗한데 학습자가 받는 것은 아니었다 — 이 저장소가 되풀이해 온
// **"만든 것과 실리는 것은 다르다"** 의 가장 비싼 판이다.
//
// ⚠️ 정제는 **TypeScript 에서만** 할 수 있다(정규식 체인이다). RPC 안으로 넣을 수 없으므로
//   판정 일부를 DB 로 옮기더라도 이 파일은 남는다. 두 경로가 같은 함수를 부르게 하는 것이
//   목적이지, 어디서 거르느냐가 목적이 아니다.
import {
  countPassageWords,
  dropDuplicatedLeadWord,
  dropRepeatedTail,
  hasArticleChrome,
  hasSensitiveTopic,
  hasUnbalancedParens,
  isPrintablePassage,
  normalizeQuotes,
  pairStraightQuotes,
  stripSectionLabels,
  stripSpaceBeforePunct,
} from './csat-format'
import { isPrintableUnderlineWord } from './vocab-choice'

/**
 * 철회·취하된 논문인가 — **제목으로만 알 수 있다.**
 *
 * 재고에 `RETRACTED:` 로 시작하는 원글이 16편 있고 그중 10편에 문항 268개가 붙어 있었다
 * (한 편은 120개, 실측 2026-08-31). 철회된 연구를 지문으로 실으면 교재의 신뢰가 통째로
 * 깎이는데, **지문 자체는 멀쩡히 읽히므로 자동 검수로는 안 걸린다.**
 *
 * 철회를 **다룬** 글("Retraction studies in ethics")은 통과해야 한다 — 그래서 앞머리를 본다.
 */
export function isRetractedTitle(title: string | null | undefined): boolean {
  const t = String(title ?? '').trim()
  return /^(retracted|withdrawn)/i.test(t) || t.toLowerCase().includes('[retracted')
}

/**
 * 인쇄·출제에 쓰는 사본으로 다듬는다.
 *
 * ⚠️ **순서는 안에서 밖으로 읽는다.** 절 이름 → 반복 꼬리 → 눌어붙은 제목 →
 *   구두점 앞 공백 → 아포스트로피 → 큰따옴표. 제목 제거를 꼬리 절단보다 뒤에 두는 이유는,
 *   꼬리 대조가 **글머리와 글자 그대로** 같은지를 보기 때문이다 — 글머리를 먼저 손대면
 *   대조가 깨져 중복이 그대로 남는다.
 */
export function cleanPassageText(value: string): string {
  return pairStraightQuotes(
    normalizeQuotes(
      stripSpaceBeforePunct(dropDuplicatedLeadWord(dropRepeatedTail(stripSectionLabels(value)))),
    ),
  )
}

/** 지문이 담기는 payload 키. `presented` 를 빠뜨리면 순서 문항이 통째로 새어 나간다. */
export const PASSAGE_KEYS = [
  'passage',
  'intro',
  'stem',
  'context',
  'insert_sentence',
  'summary_sentence',
] as const

/** 문장 배열로 담기는 키. */
export const PASSAGE_ARRAY_KEYS = ['sentences', 'presented', 'remaining', 'choices'] as const

/**
 * **문장 분할 자국을 볼 수 있는 배열 키** — `choices` 가 빠진다.
 *
 * ── 왜 빼는가 (실측 2026-09-13) ─────────────────────────────────────
 * `hasBadSentenceSplit` 의 ①번 자국은 「조각이 소문자로 열린다」인데, **선지는 원래
 * 소문자로 여는 것이 정상인 유형이 있다.** 빈칸·요지·주제·제목·심경·함의·요약의 선지는
 * 문장을 완성하는 **구(句)** 다:
 *
 *     "have refused to share their own maps with outsiders"
 *     "the number of cars in each order"
 *
 * 이 자를 선지에 대는 순간 그 유형이 **통째로** 떨어진다. 실제로 그랬다 —
 * V5 조판에서 `blank` 78 · `topic` 23 · `mood` 25 · `summary` 22 · `implication` 14 ·
 * `long_vocab` 16 이 **전량** `badSplit` 으로 빠져 지면 유형이 6종 줄었다.
 * 드레인이 손으로 만든 가장 비싼 재고가 그 6종이었다.
 *
 * ⚠️ **자가 틀렸지 재고가 틀린 것이 아니었다.** 이 판정자가 잡으려는 것은 「마침표 하나만
 *   보는 정규식이 문장을 잘못 자른 자국」인데, **선지는 애초에 문장 분할로 만들어지지
 *   않는다.** 사람이(드레인이) 쓴 것이다. 그러니 여기서 볼 것이 없다.
 *
 * 선지 자체의 결함은 다른 자들이 본다 — `hasChoiceCollision`(선지 충돌) ·
 * `hasBlockLengthLeak`(길이 누설) · 정답 쏠림 검정.
 */
export const SPLIT_CHECK_ARRAY_KEYS = ['sentences', 'presented', 'remaining'] as const

/**
 * **문항이 스스로 찍은 빈칸 자리.** 잔해가 아니라 문항의 장치다.
 *
 * ── 왜 따로 떼어 내는가 (실측 2026-09-13) ────────────────────────────
 * `isPrintablePassage` 의 `NON_PROSE` 는 밑줄 4개 이상(`_{4,}`)을 비산문으로 본다.
 * 그 규칙이 겨눈 것은 사전 보일러플레이트의 **가로줄**이다:
 *
 *     _____________________________________________________ stimulate – v.
 *
 * 그런데 우리 문항의 빈칸 표시도 밑줄이다 — `blank_word` 는 `_____`(5개),
 * `blank` 은 `____`(4개). 그래서 **가장 큰 재고 유형이 통째로 걸렸다**:
 * V5 조판에서 `blank_word` **19,870문항**이 전량 `residue` 로 빠졌다(전체 224,148).
 *
 * 두 가지를 가르는 것은 **길이**다. 저장소 실측:
 *
 *     문항 payload   4개 505 · 5개 224,148 · 11개 1 · **12~43개 0** · 44~55개 18
 *     원글 본문      4개부터 이어지고 20개 이상이 대부분(진짜 가로줄)
 *
 * 문항 쪽은 12~43 이 **완전히 비어 있다.** 그 빈 구간 안에서 자른다.
 *
 * ⚠️ **원글 쪽은 이어져 있으므로 `NON_PROSE` 자체는 건드리지 않는다.** 원글 본문을 재는
 *   경로(생성기·드레인 뽑기)는 지금 그대로 4개부터 막아야 한다 — 거기서는 밑줄이
 *   문항의 장치가 아니라 남의 서식이다. **문항을 재는 자리에서만** 이 표시를 지운다.
 * ⚠️ 긴 가로줄이 문항 지문에 섞여 들어오면 **여전히 걸린다** — 여기서 지우는 것은
 *   15개까지다. 사전 보일러플레이트의 다른 반쪽(`– v.` 꼴)도 그대로 남는다.
 */
/*
 * ⚠️ **앞뒤 경계를 안 박으면 긴 가로줄도 지워진다.** `_{4,15}` 만 쓰면 48개짜리 줄을
 *   15+15+15+3 으로 **나눠서** 전부 먹는다 — 회귀가 잡았다. 밑줄이 더 이어지지 않는
 *   자리에서만 표시로 인정한다.
 */
export const BLANK_MARKER = /(?<!_)_{4,15}(?!_)/g

/** payload 전체를 정제한 사본으로 바꾼다. 저장은 건드리지 않는다. */
export function cleanItemPayload<T extends Record<string, unknown>>(raw: T): T {
  if (!raw || typeof raw !== 'object') return raw
  const out: Record<string, unknown> = { ...raw }
  for (const k of PASSAGE_KEYS) {
    if (typeof out[k] === 'string') out[k] = cleanPassageText(out[k] as string)
  }
  for (const k of PASSAGE_ARRAY_KEYS) {
    const v = out[k]
    if (Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === 'string' ? cleanPassageText(x) : x))
    }
  }
  return out as T
}

/** 이 문항이 품은 지문을 한 덩이로 모은다 — 판정은 그 위에서 한다. */
export function passageTextOf(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return ''
  let text = ''
  for (const k of PASSAGE_KEYS) {
    const v = payload[k]
    if (typeof v === 'string') text += ` ${v}`
  }
  for (const k of PASSAGE_ARRAY_KEYS) {
    const v = payload[k]
    if (Array.isArray(v)) {
      text += ` ${v.map((x) => (typeof x === 'string' ? x : '')).join(' ')}`
    }
  }
  return text.trim()
}

/**
 * **약어 마침표에서 문장이 잘렸는가.**
 *
 * ── 3인 검수가 드러낸 것 (실측 2026-09-13) ──────────────────────────
 * 문장 분할이 마침표 하나만 보는 정규식이라 약어의 마침표를 문장 끝으로 읽는다.
 * 검수에서 나온 실제 자국:
 *
 *     "From June 12 to July 3, the U.S." / "Geological Survey and…"
 *     "…with information from fossils, Li et al." / "constructed a timeline…"
 *     "At 8 a." / "m., thermometer, 70°…"
 *     "…directly into the genome of V." / "natriegens cells…"
 *
 * 선지가 그 조각 **가운데**에 놓이면 학습자는 고를 수 없는 자리를 받는다.
 * `U.S.` 는 이미 알려진 자국이었는데 **같은 원인이 학명·`et al.`·시각으로 재발했다** —
 * 분할기가 20곳에 복사돼 있어 한 곳을 고쳐도 나머지가 남는다.
 *
 * ⚠️ **여기서 고치지 않고 거른다.** 분할기를 바꾸면 저장된 문항의 지문이 달라지고
 *   (전 밴드 25,672문항) 그건 재생성 결정이지 판정의 일이 아니다. 판정은 「이 문항을
 *   지금 내보내도 되는가」에만 답한다.
 *
 * 자국은 둘이다 — 조각의 **뒤쪽**은 소문자로 시작하고, **앞쪽**은 약어로 끝난다.
 * 둘 다 보는 이유는 지문 첫 문장이 조각의 앞쪽일 수 있기 때문이다.
 *
 * DB 실측(V5): 소문자로 시작하는 문장을 가진 문항 **3,391개**
 *   (unit_vocab 1,520 · vocab_choice 963 · unit_grammar 459 · grammar_choice 376 · irrelevant 73).
 */
export function hasBadSentenceSplit(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false
  // ⚠️ **문자열 칸도 본다.** 처음엔 배열 칸만 봤는데, 삽입 문항의 〈보기〉는
  //   `insert_sentence` 라는 **문자열**이라 검사를 통째로 빠져나갔다 — 2회차 검수가
  //   `…National Jewish Health and the U.S.` 로 잘린 〈보기〉를 찾아내 알려 줬다.
  //   판정자를 새로 걸고도 같은 자국이 남은 이유가 이것이었다.
  const chunks: string[] = []
  for (const k of PASSAGE_KEYS) {
    const v = payload[k]
    if (typeof v === 'string') chunks.push(v)
  }
  // ⚠️ **선지는 안 본다** — `SPLIT_CHECK_ARRAY_KEYS` 주석 참조. 선지는 문장 분할로
  //   만들어지지 않으므로 여기서 볼 자국이 없고, 대면 그 유형이 통째로 떨어진다.
  for (const k of SPLIT_CHECK_ARRAY_KEYS) {
    const v = payload[k]
    if (!Array.isArray(v)) continue
    for (const x of v) if (typeof x === 'string') chunks.push(x)
  }
  {
    for (const raw of chunks) {
      const s = raw.trim()
      if (!s) continue
      // ① 조각의 **뒤쪽** — 문장이 소문자로 열린다. 가장 확실한 자국이다.
      if (/^[a-z]/.test(s)) return true
      // ② 조각의 **앞쪽** — 홀로 선 한 글자 약어로 끝난다(`…genome of V.` · `…fossils, Li V.`).
      //    앞이 공백이거나 여는 괄호여야 한다 — 문장 끝의 평범한 낱말을 막지 않기 위해서다.
      if (/(?:^|[\s(])[A-Z]\.$/.test(s)) return true
      // ③ 점을 여러 개 쓰는 약어로 끝난다(`the U.S.` · `at 8 a.m.`).
      //    ②로는 안 잡힌다 — 마지막 글자 앞이 공백이 아니라 **마침표**이기 때문이다.
      if (/(?:[A-Za-z]\.){2,}$/.test(s)) return true
      // ④ 흔한 축약 — 뒤에 본문이 이어져야 할 자리에서 끊겼다.
      if (/(?:^|\s)(?:et al|vs|etc|Dr|Mr|Mrs|Ms|Prof|Fig|No|Inc|Ltd|St)\.$/i.test(s)) return true
      // ⑤ **반대 방향의 절단** — 문장 경계가 통째로 사라져 두 문장이 한 덩어리로 붙었다.
      //   `…this century.Most deforestation for oilseeds…` (해설 배치 실측 2026-09-13).
      //   삽입 문항에서는 **자리 하나가 선지에서 사라진다** — 고를 수 없는 경계가 생긴다.
      //   V5 실측 91문항. 붙은 것을 떼려면 문장 배열을 다시 만들어야 하므로 **거른다**.
      if (/[a-z]\.[A-Z]/.test(s)) return true
    }
  }
  return false
}

/**
 * **부호 짝이 정답을 흘리는가** — 순서·삽입 문항에만 해당한다.
 *
 * ── 3인 검수가 찾아낸 누설 경로 (실측 2026-09-13, 2회차) ────────────
 * 순서 문항은 덩어리 (A)(B)(C) 를 재배열하게 한다. 그런데 여는 따옴표가 한 덩어리에만,
 * 닫는 따옴표가 다른 덩어리에만 있으면 **부호만 맞춰도 순서가 정해진다.**
 *
 *     (C) `“Dams are supposed to be maintained.`   ← 여는 따옴표만
 *     (A) `…more information.”`                    ← 닫는 따옴표만
 *     → (C) 가 처음, (A) 가 끝 → 선지 다섯 중 하나만 남는다
 *
 * 괄호 판도 나왔다 — 도입문이 `(Wilmot scientists…` 로 열고 (C) 가 `…plan.)` 로 닫는다.
 * 둘 다 **영어를 한 글자도 안 읽고 정답이 나온다.** 문항이 어려운 것이 아니라 없는 것이다.
 *
 * ⚠️ **문장 단위로 본다.** 전체를 이으면 짝이 맞아 버려 안 걸린다(위 두 사례 모두 그렇다).
 * ⚠️ **순서·삽입의 덩어리 배열에만 적용한다.** 평범한 지문(`sentences`)에서는 인용이
 *   여러 문장에 걸치는 것이 정상이라, 같은 자를 대면 멀쩡한 글이 통째로 걸린다.
 */
export function hasPunctuationLeak(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false
  for (const k of ['presented', 'remaining'] as const) {
    const v = payload[k]
    if (!Array.isArray(v)) continue
    for (const raw of v) {
      if (typeof raw !== 'string') continue
      const n = (re: RegExp) => (raw.match(re) ?? []).length
      if (n(/\(/g) !== n(/\)/g)) return true
      if (n(/“/g) !== n(/”/g)) return true
      if (n(/\[/g) !== n(/\]/g)) return true
    }
  }
  return false
}

/**
 * **밑줄이 어디에 그어지는지 확정되는가.**
 *
 * 3인 검수 실측(2026-09-13, 2회차): 밑줄 낱말이 **제 문장 안에 두 번** 나오는 문항이 있었다
 * (`Measurement error in text-based measures In general, …` 의 `Measurement`).
 * 조판기와 화면은 **첫 자리**에 긋는데, 출제 의도가 어느 쪽인지 알 수 없다 —
 * 학습자가 보는 밑줄과 정답이 가리키는 낱말이 다를 수 있다.
 *
 * 앞서 부분문자열 충돌을 낱말 경계로 고쳤지만(`un②necessary`), **같은 낱말이 두 번**
 * 나오는 것은 경계로 풀리지 않는다 — 그건 문항 자체가 모호한 것이다.
 */
export function hasAmbiguousUnderline(payload: Record<string, unknown> | null | undefined): boolean {
  const underlines = (payload as { underlines?: unknown } | null | undefined)?.underlines
  const sentences = (payload as { sentences?: unknown } | null | undefined)?.sentences
  if (!Array.isArray(underlines) || !Array.isArray(sentences)) return false
  for (const u of underlines) {
    const word = String((u as { word?: unknown } | null)?.word ?? '')
    const si = Number((u as { sentenceIdx?: unknown } | null)?.sentenceIdx)
    // ⚠️ **자리를 아는 밑줄은 모호하지 않다.** 어법 밑줄은 `tokenIdx` 를 저장하므로
    //   같은 낱말이 여러 번 나와도 어디에 긋는지 확정된다 — 관사·지시사는 한 문장에
    //   여러 번 나오는 것이 정상이다. 이 갈래가 없던 동안 이 자는 어법 4,330문항 중
    //   **2,180개(50%)** 를 「모호」로 걸었다. 자를 넓게 잡아 멀쩡한 재고를 죽인 것이고,
    //   고칠 곳은 재고가 아니라 **자리를 안 쓰던 조판기**였다(`render-volume.mjs`).
    if (Number.isInteger(Number((u as { tokenIdx?: unknown } | null)?.tokenIdx))) continue
    if (!word || !Number.isInteger(si)) continue
    const sentence = sentences[si]
    if (typeof sentence !== 'string') continue
    // 낱말 경계로 센다 — 부분문자열은 애초에 밑줄 자리가 아니다.
    const re = new RegExp(
      `(?:^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`,
      'g',
    )
    if ((sentence.match(re) ?? []).length > 1) return true
  }
  return false
}

/**
 * **덩어리 길이가 정답의 첫 자리를 알려 주는가.**
 *
 * 순서 문항의 덩어리는 원문을 셋으로 자른 것이고, **정답 배열의 첫 자리는 언제나
 * 첫 조각**이다(라벨은 섞여도 그 사실은 안 바뀐다). 그런데 자를 때 남는 문장을 앞에서부터
 * 얹으면 첫 조각이 늘 가장 길어진다 — **학습자는 문장만 세면 된다.**
 *
 * V5 실측(2026-09-13): 문장 5개 **1,306문항** 완전 누설 · 6개 **973문항** 부분 누설
 * (짧은 덩어리로 시작하는 선지 둘이 자동 탈락) · 4개 2,516문항만 깨끗. **합쳐 48%.**
 *
 * 생성기는 고쳤다(`splitIntoThree` 가 얹는 자리를 돌린다). 그러나 **이미 저장된 문항은
 * 그대로**라, 지면에 오르지 않게 여기서 거른다.
 *
 * ⚠️ 새 규칙으로 만든 문항까지 막지 않으려면 **길이로 재면 안 된다**(문장 5개라고 다
 *   새는 것이 아니다). 실제 덩어리를 재서, **정답의 첫 덩어리가 유일하게 가장 길 때만** 막는다.
 */
export function hasBlockLengthLeak(
  payload: Record<string, unknown> | null | undefined,
  answerKey: Record<string, unknown> | null | undefined,
): boolean {
  const presented = payload?.presented
  const sourceOrder = answerKey?.source_order
  if (!Array.isArray(presented) || !Array.isArray(sourceOrder)) return false
  const n = presented.length
  if (n < 4 || n !== sourceOrder.length) return false
  // 원문 복원 — `toCsatOrder` 와 같은 규칙이다.
  const original: unknown[] = new Array(n)
  for (let k = 0; k < n; k += 1) original[Number(sourceOrder[k])] = presented[k]
  if (original.some((x) => x === undefined)) return false
  const sizes = blockSizesOf(original.length - 1)
  if (!sizes) return false
  const [first, ...others] = sizes
  return others.every((x) => x < first!)
}

/**
 * 저장된 문항의 덩어리 크기 — **옛 규칙**(남는 문장을 앞에서부터)으로 잰다.
 * 지금 저장돼 있는 것이 그 규칙으로 만들어졌기 때문이다.
 */
function blockSizesOf(rest: number): [number, number, number] | null {
  if (rest < 3) return null
  const base = Math.floor(rest / 3)
  const extra = rest % 3
  return [base + (extra > 0 ? 1 : 0), base + (extra > 1 ? 1 : 0), base]
}
/**
 * **다섯 선지가 서로 다른 낱말인가, 그리고 정답이 선지에 인쇄돼 있지 않은가.**
 *
 * ── 3인 검수 3회차 실측 (2026-09-13) ────────────────────────────────
 * 어휘 문항 7개 중 **4개**에서 밑줄 둘이 같은 낱말이었다 — `experienced`×2 ·
 * `robot`/`robots` · `romantic`×2. 5지선다가 **3~4지**가 된다. 학생은 지문을 읽기 전에
 * 선지를 줄인다.
 *
 * 또 한 문항은 정답이 `rarely → often` 인데 **선지 ②가 `Often`** 이었다. 고칠 말이
 * 선지에 박혀 있어, ①을 고른 학생과 ②를 고른 학생의 사고가 구분되지 않는다.
 *
 * DB 실측(V5 `vocab_choice` 10,612): 낱말 중복 **1,265(12%)** ·
 * 정답 낱말이 다른 선지로 인쇄 **1,143(11%)**.
 *
 * ⚠️ 굴절형도 같은 낱말로 본다(`robot`/`robots`) — 학생 눈에는 한 낱말이다.
 */
export function hasChoiceCollision(
  payload: Record<string, unknown> | null | undefined,
  answerKey: Record<string, unknown> | null | undefined,
): boolean {
  const underlines = (payload as { underlines?: unknown } | null | undefined)?.underlines
  if (!Array.isArray(underlines) || underlines.length < 2) return false
  // ⚠️ **어법 문항은 대상이 아니다.** 관사·지시사는 **설계상** 같은 낱말이 여러 선지에 온다
  //   (`a … a … an`). 그것이 이 유형이 묻는 것이라 중복이 결함이 아니다 —
  //   어휘 문항에서만 「선지가 서로 다른 낱말」이 요건이다.
  //   어법 밑줄은 자리(`tokenIdx`)를 저장하므로 그것으로 가른다.
  if (underlines.some((u) => Number.isInteger(Number((u as { tokenIdx?: unknown } | null)?.tokenIdx)))) {
    return false
  }
  const stem = (w: unknown): string => {
    const x = String(w ?? '').toLowerCase().replace(/[^a-z]/g, '')
    if (x.length < 4) return x
    if (x.endsWith('ies')) return `${x.slice(0, -3)}y`
    if (x.endsWith('es')) return x.slice(0, -2)
    if (x.endsWith('s')) return x.slice(0, -1)
    return x
  }
  const words = underlines.map((u) => stem((u as { word?: unknown } | null)?.word)).filter(Boolean)
  if (new Set(words).size < words.length) return true
  // 정답의 **원래 낱말**이 다른 선지로 인쇄돼 있으면 근거가 샌다.
  const original = stem((answerKey as { original?: unknown } | null | undefined)?.original)
  if (original && words.includes(original)) return true
  return false
}
/** 한 문장에 담을 수 있는 낱말 수의 상한 — 넘으면 그 학년이 첫 문장에서 멈춘다. */
export const MAX_SENTENCE_WORDS = 50

/**
 * **한 문장이 학년 밖으로 길지 않은가.**
 *
 * ── 왜 CEFR 로는 못 거르나 (실측 2026-09-13) ────────────────────────
 * 고등 밴드에 CEFR 상한(B2)을 걸었는데도 3인 검수 3회차가 학술 산문을 계속 잡아냈다.
 * 확인해 보니 **그 문항들이 전부 `B2` 로 태그돼 있었다** — PLOS·eLife 논문까지.
 * `cefr_level` 은 Flesch 가독성에서 나오고, 그 자는 **문장·음절 길이**만 본다.
 * 방법론 절은 문장이 짧아 B2 를 받는다. 라벨이 틀린 것이 아니라 **다른 것을 재는 자**다.
 *
 * 검수자들이 실제로 짚은 것은 **초장문**이었다 — 48낱말 도입문(주어와 동사 사이 40낱말),
 * 57낱말·삽입절 3개, 306자 첫 문장. 「고1은 첫 문장에서 멈춘다」가 되풀이된 표현이다.
 *
 * 문턱의 근거:
 *   · 우리 V5 실측 — 문장 중앙값 **20낱말** · p95 **40**
 *   · 시중 실측 — 중3 문장 중앙값 **15.3**낱말 · 중1~중3 **13.1** (`passage-ruler.json`)
 *   · 50낱말은 우리 코퍼스의 95백분위 위이고 시중 중3의 세 배가 넘는다
 *
 * 실측 V5 25,724문항 중 **2,312(9%)** 가 50낱말 넘는 문장을 갖고 있다.
 *
 * ⚠️ 지문 **전체** 길이는 이미 `itemWordSpec` 이 잰다. 여기서 보는 것은 **한 문장**이다 —
 *   90~200어 창 안에 들어도 그 안에 57낱말짜리 한 문장이 있으면 학년이 못 읽는다.
 */
export function hasOverlongSentence(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false
  for (const k of PASSAGE_ARRAY_KEYS) {
    const v = payload[k]
    if (!Array.isArray(v)) continue
    for (const x of v) {
      if (typeof x !== 'string') continue
      if (x.trim().split(/\s+/).length > MAX_SENTENCE_WORDS) return true
    }
  }
  for (const k of ['intro', 'insert_sentence'] as const) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim().split(/\s+/).length > MAX_SENTENCE_WORDS) return true
  }
  return false
}
/** 왜 못 내보내는지 — 세어서 남기려고 이름을 붙인다. 통과면 `null`. */
export type HygieneReject =
  | 'retracted'
  | 'sensitive'
  | 'chrome'
  | 'residue'
  | 'nonProse'
  | 'cutFragment'
  /** 밑줄이 낱말이 아니다 — 부호·마크업째 밑줄이 쳐진다. */
  | 'badUnderline'
  /** 약어 마침표에서 문장이 잘렸다 — 지문이 조각으로 인쇄된다. */
  | 'badSplit'
  /** 부호 짝이 덩어리 순서를 알려 준다 — 영어를 안 읽고 풀린다. */
  | 'punctuationLeak'
  /** 밑줄 낱말이 제 문장에 두 번 나온다 — 어디에 긋는지 확정되지 않는다. */
  | 'ambiguousUnderline'
  /** 덩어리 길이가 정답의 첫 자리를 알려 준다 — 문장만 세면 풀린다. */
  | 'blockLengthLeak'
  /** 선지 둘이 같은 낱말이거나, 정답 낱말이 선지에 인쇄돼 있다. */
  | 'choiceCollision'
  /** 한 문장이 학년 밖으로 길다 — 첫 문장에서 멈춘다. */
  | 'longSentence'

/**
 * **학습자에게 내보내도 되는 문항인가.** 조판의 게이트와 같은 판정을 쓴다.
 *
 * `refTitle` 도 본다 — 지문은 중립적인데 출처가 `…abortion care?` 인 경우가 있고,
 * 출처는 화면에도 인쇄물에도 함께 나가며 원문으로 가는 길이다.
 *
 * ⚠️ **초등 3종은 사전에서 나온다** — 원글이 없어 이 판정의 대상이 아니다.
 *   호출부가 그 유형을 넘기지 않도록 한다(넘겨도 지문이 비어 통과한다).
 */
export function itemHygieneReject(input: {
  payload: Record<string, unknown> | null | undefined
  refTitle?: string | null
  /** 순서 문항의 덩어리 누설을 재려면 필요하다 — 없으면 그 검사만 건너뛴다. */
  answerKey?: Record<string, unknown> | null
}): HygieneReject | null {
  const title = String(input.refTitle ?? '')
  if (isRetractedTitle(title)) return 'retracted'
  if (hasSensitiveTopic(title)) return 'sensitive'

  // ── 밑줄이 낱말인가 ────────────────────────────────────────────────
  // 화면도 인쇄물도 저장된 `word` 를 **글자 그대로** 밑줄친다(`<u>{m.word}</u>`).
  // 그래서 `Happen?` · `worry.` 같은 토큰은 부호까지 밑줄에 들어간다. 생성 규칙은
  // 고쳤지만(2026-09-13) 그 규칙으로 **다시 만들 수 없는** 문항이 V5 에만 509개 남는다 —
  // 고칠 수 없는 것은 **안 내보낸다**. 조판 풀도 같은 자를 쓴다(`volume-pool.mjs`).
  const underlines = (input.payload as { underlines?: unknown } | null | undefined)?.underlines
  if (Array.isArray(underlines)) {
    for (const u of underlines) {
      const w = String((u as { word?: unknown } | null)?.word ?? '')
      if (!isPrintableUnderlineWord(w)) return 'badUnderline'
    }
  }

  if (hasBadSentenceSplit(input.payload)) return 'badSplit'
  if (hasPunctuationLeak(input.payload)) return 'punctuationLeak'
  if (hasBlockLengthLeak(input.payload, input.answerKey)) return 'blockLengthLeak'
  if (hasChoiceCollision(input.payload, input.answerKey)) return 'choiceCollision'
  if (hasOverlongSentence(input.payload)) return 'longSentence'
  if (hasAmbiguousUnderline(input.payload)) return 'ambiguousUnderline'

  // **빈칸 표시를 지우고 잰다** — 문항이 스스로 찍은 자리이지 남의 서식이 아니다
  // (`BLANK_MARKER` 주석: 이것이 없던 동안 `blank_word` 19,870문항이 전량 걸렸다).
  const text = passageTextOf(input.payload).replace(BLANK_MARKER, ' ')
  if (!text) return null
  if (hasSensitiveTopic(text)) return 'sensitive'
  if (hasArticleChrome(text)) return 'chrome'
  if (hasUnbalancedParens(text)) return 'cutFragment'
  // 인용 잔해·비산문은 `isPrintablePassage` 가 한 벌로 판정한다.
  if (!isPrintablePassage(text)) return 'residue'
  return null
}

/**
 * **연습으로 내보내기에 지문이 너무 짧은가** — 찍기 방지 하한만 본다.
 *
 * ── 왜 하한만인가 (실측 2026-09-01) ─────────────────────────────────
 * 조판은 `itemWordSpec` = 교차(유형 창, 학년 창)로 거른다. 두 창의 근거가 다르다:
 *
 *  · **유형 창의 하한** — 교육적이다. `compose-unit.CSAT_ITEM_WORDS` 가 적어 둔 그대로:
 *    "하한 90 은 64어짜리를 걸러내기 위한 것이다 — 4문장 미만으로 읽히면 순서를 맞출
 *    단서가 부족해 **찍기가 된다**."
 *  · **유형 창의 상한과 학년 창** — 지면 제약과 시장 적합 주장에서 나온다.
 *    **연습 화면에는 지면도 시장 주장도 없다.**
 *
 * 그래서 연습에는 하한만 건다. 실측 반려율:
 *   상·하한 모두 + 학년 창  40.5%   ← 근거 없는 것까지 버린다
 *   **하한만**              **33.0%**  (V4 48% · V5 28% · V6 24% · V7 32%)
 *   학년 창만                8.6%
 *
 * 33% 는 적지 않지만 **버리는 쪽이 옳다** — 이 저장소 자신의 기준으로 "찍기가 되는"
 * 문항이고, 학습자가 푸는 것의 3분의 1이 그랬다. `fetchTextbookPracticeItems` 의
 * `overFetch`(limit×3)가 흡수한다(limit=10 이면 30 중 20 생존).
 *
 * ⚠️ **지문이 없는 유형은 대상이 아니다** — 문장 단위·초등 3종은 지문 자체가 한 문장이라
 *   이 자를 대면 전량 걸린다. 호출부가 그 유형을 넘기지 않거나, 여기서 지문이 비어 통과한다.
 */
export function isTooShortForPractice(minWords: number, payload: Record<string, unknown> | null | undefined): boolean {
  if (!Number.isFinite(minWords) || minWords <= 0) return false
  const text = passageTextOf(payload)
  if (!text) return false
  return countPassageWords(text) < minWords
}
