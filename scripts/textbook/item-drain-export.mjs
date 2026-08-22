// scripts/textbook/item-drain-export.mjs
//
// **문항 제작 드레인 ①/③ — 생성형 유형의 선택지를 Claude Code 가 쓸 몫으로 뽑는다.**
//
// ── 왜 드레인인가 ────────────────────────────────────────────────────
// 결정론으로 되는 다섯 유형(순서·삽입·흐름무관·어휘·어법)은 다 만들었다. 남은 열한 유형은
// **글을 읽어야** 만들 수 있다 — 요지가 무엇인지, 어떤 오답이 그럴듯한지는 규칙으로 안 나온다.
// 그게 Claude Code 의 몫이다(CLAUDE.md §🤖).
//
// ── 새 지문은 필요 없다 ──────────────────────────────────────────────
// 규격(185~200어·12문장)에 맞는 창작 지문이 이미 315편 있다. 이 드레인은 **그 지문에 대해
// 선택지를 쓰는 일**이라, 집필 드레인과 달리 재고를 늘리지 않고 재고의 쓰임을 늘린다.
//
// ── 유형이 열이어도 모양은 하나다 ────────────────────────────────────
//   payload      { passage, choices[5], stem_ko }
//   answer_key   { answer: 1..5, rationale_ko }
// 그래서 렌더러·드레인·검사기를 공용으로 쓴다. 유형마다 스크립트를 늘리지 않는다.
//
// 재실행 안전: 읽기만 한다. **이미 그 유형이 붙은 지문은 건너뛴다.**
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-drain-export.mjs --type topic --band 3 --size 8
//   pnpm dlx tsx scripts/textbook/item-drain-export.mjs --type blank --band 5 --need 40

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const TYPE = arg('type') ?? 'topic'
const BAND = Number(arg('band') ?? 3)
const SIZE = Number(arg('size') ?? 8)
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/item-drain/${TYPE}-v${BAND}`)

/**
 * 유형별 지시문 — **집필하는 쪽이 읽는 유일한 규격**이라 여기가 정본이다.
 *
 * `stem` 은 시험지에 인쇄되는 발문이고, `guide` 는 선택지를 어떻게 만들어야 하는지다.
 * 오답을 어떻게 만드느냐가 유형의 전부다 — "그럴듯하되 틀린" 이 안 되면 찍어서 맞는다.
 */
const TYPES = {
  purpose: {
    number: '18',
    label: '글의 목적',
    stem: '다음 글의 목적으로 가장 적절한 것은?',
    choiceLang: 'ko',
    guide:
      '선택지는 한국어 한 문장(“~하려고”)이다. 정답은 글 전체가 향하는 하나의 목적이어야 하고, ' +
      '오답은 **글에 실제로 나오는 소재를 쓰되 목적이 아닌 것**으로 만든다(배경 설명·부수 효과·반대 방향).',
  },
  mood: {
    number: '19',
    label: '심경·분위기',
    stem: '다음 글에 드러난 인물의 심경 변화로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '선택지는 `A → B` 꼴의 형용사 짝이다. 정답은 글의 전반부와 후반부 정서가 실제로 바뀐 방향이어야 한다. ' +
      '오답은 **방향을 뒤집거나 한쪽만 맞게** 만든다. 글에 정서 단서가 약하면 이 유형을 만들지 말고 건너뛴다.',
  },
  claim: {
    number: '20',
    label: '필자의 주장',
    stem: '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
    choiceLang: 'ko',
    guide:
      '선택지는 한국어 한 문장(“~해야 한다”)이다. 정답은 글이 독자에게 요구하는 것이고, ' +
      '오답은 **글이 사실로 서술한 것을 당위로 바꾼 것**이나 범위를 넓히거나 좁힌 것으로 만든다.',
  },
  implication: {
    number: '21',
    label: '밑줄 함의 추론',
    stem: '밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '`payload.underline` 에 밑줄 칠 구절을 **지문에 있는 그대로** 적는다(글자 한 개도 바꾸지 말 것). ' +
      '정답은 그 구절이 이 글 안에서 갖는 뜻이고, 오답은 **구절의 사전적 뜻**이나 다른 문맥에서의 뜻으로 만든다.',
  },
  main_point: {
    number: '22',
    label: '요지',
    stem: '다음 글의 요지로 가장 적절한 것은?',
    choiceLang: 'ko',
    guide:
      '선택지는 한국어 한 문장이다. 정답은 글 전체를 덮어야 하고 한 문단에만 해당하면 안 된다. ' +
      '오답은 **한쪽 문단만 맞는 것** · 글보다 넓은 일반론 · 글이 부정한 통념으로 만든다.',
  },
  topic: {
    number: '23',
    label: '주제',
    stem: '다음 글의 주제로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '선택지는 영어 명사구다(문장이 아니다). 정답은 글이 다루는 대상 + 그것에 대해 말하는 각도를 함께 담는다. ' +
      '오답은 **대상은 맞는데 각도가 틀린 것** · 글에 한 번 나온 세부를 주제인 척한 것으로 만든다.',
  },
  title: {
    number: '24',
    label: '제목',
    stem: '다음 글의 제목으로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '선택지는 영어 제목이다(짧게, 관사는 자연스러운 만큼). 정답은 요지를 제목의 어투로 담는다. ' +
      '오답은 **글의 소재를 쓰되 결론이 다른 것**으로 만든다. 지나치게 시적이거나 모호한 제목은 쓰지 않는다.',
  },
  blank: {
    number: '31~34',
    label: '빈칸 추론',
    stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '`payload.passage` 안에 빈칸을 `____` 로 표시한다. **빈칸은 글의 요지가 걸리는 자리**에 뚫는다 — ' +
      '세부 사실 자리에 뚫으면 앞뒤만 보고 풀린다. 선택지는 영어 구/절이고, 오답은 ' +
      '**앞 문장과만 어울리는 것** · 글의 반대 방향 · 글에 없는 비약으로 만든다.',
  },
  summary: {
    number: '40',
    label: '요약문 완성',
    stem: '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?',
    choiceLang: 'en',
    guide:
      '`payload.summary_sentence` 에 `(A)` 와 `(B)` 를 포함한 영어 요약문 한 문장을 적는다. ' +
      '선택지는 `단어A … 단어B` 짝 다섯이다. 오답은 **한쪽만 맞는 짝**을 반드시 섞는다 — 그래야 둘 다 읽는다.',
  },
  content_match: {
    number: '26',
    label: '내용 일치',
    stem: '다음 글의 내용과 일치하지 않는 것은?',
    choiceLang: 'ko',
    guide:
      '선택지는 한국어 한 문장씩이다. **정답이 “일치하지 않는 것”** 이므로 나머지 넷은 지문에서 확인되는 사실이어야 한다. ' +
      '정답은 지문의 사실을 **한 군데만 바꾼 것**으로 만든다(수·방향·주체). 지문에 없는 내용을 지어내지 않는다.',
  },

  // ── 장문 ② 서사문 43~45 — **한 지문에서 셋이 함께 나온다** ──────────────
  // 지문을 자르지 않고 통째로 준다(300~340어). 짧은 지문의 창을 대면 이야기가 잘려
  // 순서·지칭·일치 어느 것도 성립하지 않는다.
  long_order: {
    number: '43',
    label: '장문 순서',
    stem: '주어진 글 (A)에 이어질 내용을 순서에 맞게 배열한 것으로 가장 적절한 것은?',
    choiceLang: 'en',
    long: true,
    guide:
      '지문은 (A)(B)(C)(D) 네 문단이다. 선택지는 `(B) - (D) - (C)` 꼴 **다섯 가지 배열**이고, ' +
      '정답은 시간·인과가 실제로 이어지는 하나뿐이어야 한다. ' +
      '⚠️ 오답 넷도 **형식이 같아야** 한다(전부 세 토막). 정답만 모양이 다르면 읽지 않고 고른다. ' +
      '순서를 정하는 근거(시간 표지·지시어·대명사가 가리키는 대상)를 `rationale_ko` 에 인용한다. ' +
      '순서가 둘 이상 성립하면 이 문항을 만들지 말고 건너뛴다.',
  },
  long_reference: {
    number: '44',
    label: '장문 지칭',
    stem: '밑줄 친 (a)~(e) 중에서 가리키는 대상이 나머지 넷과 다른 것은?',
    choiceLang: 'en',
    long: true,
    guide:
      '지문에서 **대명사 다섯 개**를 골라 선택지로 삼는다. 넷은 같은 인물을, 하나는 다른 인물을 가리켜야 한다. ' +
      '선택지 문자열은 그 대명사가 든 **짧은 구절을 지문에서 그대로 따온 것**으로 쓴다(예: `he set the box down`). ' +
      '⚠️ 지문에 그대로 없는 구절을 지어내면 학습자가 찾을 수 없다 — 반드시 원문에서 복사한다. ' +
      '인물이 하나뿐이거나 대명사가 다섯 개가 안 되면 건너뛴다.',
  },
  // ── 장문 ① 설명문 41~42 — **한 지문에서 둘이 함께 나온다** ──────────────
  long_title: {
    number: '41',
    label: '장문 제목',
    stem: '다음 글의 제목으로 가장 적절한 것은?',
    choiceLang: 'en',
    long: true,
    guide:
      '선택지는 영어 제목이다. 정답은 **글 전체를 관통하는 논지**를 담아야 하고, 한 문단의 소재로 좁으면 안 된다. ' +
      '오답은 ① 한 문단만 요약한 것 ② 글이 부정한 통념을 그대로 제목으로 올린 것 ' +
      '③ 소재는 맞는데 방향이 반대인 것으로 만든다. 지문에 없는 소재는 쓰지 않는다. ' +
      '⚠️ 다섯 제목의 **어수를 고르게** 맞춘다 — 제목 유형은 정답만 길어지기 쉽다(실측 37.5%).',
  },
  long_vocab: {
    number: '42',
    label: '장문 어휘',
    stem: '밑줄 친 (a)~(e) 중에서 문맥상 낱말의 쓰임이 적절하지 않은 것은?',
    choiceLang: 'en',
    long: true,
    guide:
      '지문에서 **낱말 다섯 개**를 골라 선택지로 삼되, 그중 하나는 **문맥과 어긋나는 낱말로 바꿔 놓는다**. ' +
      '선택지 문자열은 그 낱말이 든 **짧은 구절을 지문에서 그대로 따온 것**으로 쓴다 — ' +
      '적재기가 `passage.includes(선택지)` 로 검사하므로 바꾼 낱말이 **지문에도 바뀐 채로** 들어 있어야 한다. ' +
      '⚠️ 그래서 이 유형은 `passage` 를 고쳐 내보낸다: `passage_edited` 에 낱말 하나를 바꾼 지문을 쓰고, ' +
      '`swapped` 에 `{원래낱말, 바꾼낱말}` 을 적는다. ' +
      '**한 문장만 봐도 어색한 낱말은 쓰지 않는다** — 앞뒤 문장이 강제하는 자리라야 문항이 선다. ' +
      '다섯 구절을 여러 문단에 흩고 길이를 고르게 맞춘다.',
  },
  long_match: {
    number: '45',
    label: '장문 일치',
    stem: '윗글에 관한 내용으로 적절하지 않은 것은?',
    choiceLang: 'ko',
    long: true,
    guide:
      '선택지는 한국어 한 문장씩이다. **정답이 “적절하지 않은 것”** 이므로 나머지 넷은 지문에서 확인되는 사실이어야 한다. ' +
      '⚠️ 근거를 **네 문단에 고루 흩는다** — 한 문단에 몰리면 그 문단만 읽고 풀린다. ' +
      '정답은 지문의 사실을 한 군데만 바꾼 것으로 만든다(수·방향·주체·시점).',
  },
}

const spec = TYPES[TYPE]
if (!spec) {
  console.error(`모르는 유형: ${TYPE}. 가능한 것: ${Object.keys(TYPES).join(' · ')}`)
  process.exit(2)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 재료 ────────────────────────────────────────────────────────────
// 이 유형은 **글 하나를 통째로** 쓰므로 문단이 아니라 원글이 단위다.
const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, content, article_v_level, display_only, status, word_count, compose_batch_id')
  .in('status', ['ready', 'published'])
  .eq('article_v_level', BAND)
  .order('id')
if (error) throw new Error('기사 조회 실패: ' + error.message)
// ⚠️ **지문이 창(90~200어) 안이어야 한다.** 조합기가 문항 지문을 그 창으로 거르므로,
//   창 밖 글로 문항을 만들면 **적재는 되는데 책에는 영영 안 실린다.**
//   실측(2026-08-21): V5 에 생성형 30문항을 만들었는데 26개가 이 이유로 걸려 4개만 실렸다.
//   V5 원글은 외부 장문 기사라 중앙값이 952어였다(최대 14,420어).
//   여기서 미리 거르지 않으면 배치가 헛일을 한다 — 못 쓸 것을 만들게 두지 않는다.
// ⚠️ **긴 글은 통째로 주지 않는다 — 창에 맞는 구간을 잘라 준다.**
//   조합기가 문항 지문을 90~200어로 거르므로, 글 전체를 지문으로 삼으면 긴 글은
//   **적재는 되는데 책에는 영영 안 실린다.** 실측(2026-08-21): V5 에 생성형 30문항을
//   만들었는데 26개가 이 이유로 걸려 4개만 실렸다(지문 중앙값 952어 · 최대 14,420어).
//
//   순서·삽입은 처음부터 **문단**을 지문으로 쓴다. 생성형만 글 전체를 쓰고 있었던 것이
//   문제였다 — 같은 자를 대야 한다. `selectPassageWindow` 가 그 자다(이미 어법 생성기가 쓴다).
const { CSAT_ITEM_WORDS, selectPassageWindow, isPrintablePassage } = await import('@vocaflow/library-pipeline')
/** 이 유형이 성립하려면 지문에 문장이 최소 몇 개 있어야 하는가. */
const MIN_PASSAGE_SENTENCES = 5

/**
 * 집필 배치로 지문 풀을 좁힌다 — **유형이 글의 갈래를 가리는 경우가 있다.**
 *
 * 심경·분위기(`mood`)는 재고가 전부 설명문이던 동안 **0/16** 이 나왔다. 설명문에는
 * 물어볼 정서 변화가 없으니 배치가 아무리 잘해도 만들 수 없다. 그래서 서사문을 따로 쓰고
 * (`write-drain-export --mode narrative`), 여기서 그 배치만 골라 준다.
 * 좁히지 않으면 24슬롯이 설명문으로 채워져 같은 0 이 다시 나온다.
 *
 * 여러 배치를 쉼표로 잇는다: `--batch <uuid>,<uuid>`
 */
const BATCH_FILTER = (arg('batch') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const withBody = (arts ?? [])
  .filter((a) => !a.display_only && String(a.content ?? '').trim())
  .filter((a) => !BATCH_FILTER.length || BATCH_FILTER.includes(String(a.compose_batch_id)))

/** 이 유형이 장문 묶음(43~45)인가 — 지문을 자르지 않고 통째로 쓴다. */
const IS_LONG = spec.long === true
/** 장문 지문 규격. `compose-unit.CSAT_LONG_ITEM_WORDS` 와 같은 값이어야 한다. */
const LONG_WORDS = { min: 260, max: 400 }
/** 장문은 (A)(B)(C)(D) 네 문단이어야 43번(순서)이 성립한다. */
const LONG_PARAGRAPHS = 4

/** 글을 문단으로 가른다(빈 줄 기준). */
const parasOf = (content) =>
  String(content)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/**
 * 글 → 이 유형이 쓸 지문. 못 만들면 null 이고, 그런 글은 이 유형에서 빠진다.
 *
 * ⚠️ **장문은 자르지 않는다.** 짧은 지문의 창(90~200어)을 대면 이야기가 중간에서 끊겨
 *   순서·지칭·일치 어느 것도 성립하지 않는다. 대신 조건을 따로 건다 —
 *   문단이 정확히 넷이고 전체가 260~400어여야 한다.
 */
function passageOf(a) {
  if (IS_LONG) {
    const ps = parasOf(a.content)
    if (ps.length !== LONG_PARAGRAPHS) return null
    const text = ps.join('\n\n')
    const n = text.split(/\s+/).filter(Boolean).length
    if (n < LONG_WORDS.min || n > LONG_WORDS.max) return null
    return isPrintablePassage(text) ? text : null
  }
  const sentences = String(a.content)
    .replace(/\n\s*\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 1)
  const win = selectPassageWindow(sentences, CSAT_ITEM_WORDS, MIN_PASSAGE_SENTENCES)
  if (!win) return null
  const text = win.join(' ')
  // 인쇄할 수 없는 자국(각주 잔해·용어풀이 등)이 섞인 지문은 교재에 못 낸다.
  return isPrintablePassage(text) ? text : null
}
const passages = new Map()
for (const a of withBody) {
  const p = passageOf(a)
  if (p) passages.set(a.id, p)
}

// ── 순서 문항(43번)은 **뒤섞어 제시해야** 문항이 된다 ────────────────────
//
// ⚠️ 처음에는 문단을 원래 순서대로 (A)(B)(C)(D) 로 붙여 내보냈다. 그러면 정답이
//   **언제나 `(B)-(C)-(D)`** 다 — 배치 네 개가 실제로 그 답만 만들어 왔고, 학습자도
//   지문을 읽지 않고 그 하나를 고르면 맞는다. 문항이 아니라 **모양만 문항**이었다.
//   적재 전에 발견해 그 산출물은 쓰지 않았다.
//
// 그래서 여기서 (B)(C)(D) 를 섞어 붙이고, **정답은 원래 순서를 되찾는 배열**이 된다.
// 섞는 방식은 글 id 로 정해지므로 **몇 번 뽑아도 같은 문제가 나온다**(재실행 안전).
//
// ⚠️ 지칭(44)·일치(45)는 섞지 않는다 — 순서와 무관한 문항이고, 셋을 한 단원에 묶는
//   조합은 아직 없다(`compose-unit.LONG_ITEM_TYPES` 주석). 묶게 되면 셋이 **같은
//   제시본**을 봐야 하므로 그때 여기를 함께 고쳐야 한다.
const LABELS = ['(B)', '(C)', '(D)']
/** 글 id 로 정해지는 작은 해시 — 같은 글이면 항상 같은 섞기가 나온다. */
const seedOf = (id) => {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
/** [1,2,3] 의 순열 6가지. 첫 번째(항등)는 정답이 "그대로" 가 되므로 제시에 쓰지 않는다. */
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]
const shuffleCache = new Map()
function shuffledOf(a) {
  const hit = shuffleCache.get(a.id)
  if (hit) return hit
  const ps = parasOf(passages.get(a.id))
  const seed = seedOf(a.id)
  // 항등 순열(0)을 빼고 고른다 — 섞지 않으면 문항이 성립하지 않는다.
  const perm = PERMS[1 + (seed % (PERMS.length - 1))]
  // perm[k] = 제시 k번째 자리에 놓을 **원래 문단 번호**(1~3 중 perm[k]+1)
  const shown = perm.map((origIdx, k) => ({
    label: LABELS[k],
    origIndex: origIdx + 1,
    text: ps[origIdx + 1],
  }))
  // 원래 순서(1→2→3)를 되찾으려면 어느 라벨을 차례로 읽어야 하는가.
  const correct = [1, 2, 3].map((orig) => shown.find((s) => s.origIndex === orig).label)
  const passage = [ps[0], ...shown.map((s) => `${s.label}\n${s.text}`)].join('\n\n')
  const out = { passage, shown, correctOrder: correct.join(' - ') }
  shuffleCache.set(a.id, out)
  return out
}

/** 장문 과제에 실어 보낼 여분 필드. 순서 문항만 섞인 제시본과 정답 배열을 함께 준다. */
function longFields(a) {
  if (TYPE !== 'long_order') {
    return { parts: parasOf(passages.get(a.id)).map((text, i) => ({ label: `(${String.fromCharCode(65 + i)})`, text })) }
  }
  const s = shuffledOf(a)
  return {
    parts: [{ label: '(A)', text: parasOf(passages.get(a.id))[0] }, ...s.shown.map((x) => ({ label: x.label, text: x.text }))],
    // **정답은 여기서 정해진다.** 배치가 짐작하지 않는다 — 짐작하면 원문 순서를 그대로
    // 답으로 쓰게 되고, 그건 섞기 전의 그 결함이다.
    correct_order: s.correctOrder,
  }
}
const outOfWindow = withBody.filter((a) => !passages.has(a.id))
const usable = withBody.filter((a) => passages.has(a.id))

// 이미 이 유형이 붙은 글은 건너뛴다 — 재실행 안전.
const existing = new Set(
  (
    await fetchAllIn(db, 'csat_dcp_items', 'ref_id, type, kind', 'ref_id', usable.map((a) => a.id), ['ref_id'])
  )
    .filter((r) => r.kind === 'article' && r.type === TYPE)
    .map((r) => r.ref_id),
)
const todo = usable.filter((a) => !existing.has(a.id))
const need = arg('need') ? Math.min(Number(arg('need')), todo.length) : todo.length

const tasks = todo.slice(0, need).map((a) => ({
  article_id: a.id,
  type: TYPE,
  csat_number: spec.number,
  type_label: spec.label,
  stem_ko: spec.stem,
  choice_language: spec.choiceLang,
  guide: spec.guide,
  source_title: a.title,
  // 짧은 유형은 **창(90~200어)에 맞게 자른 구간**, 장문은 **글 전체**다 — 위 `passageOf` 주석 참조.
  passage: TYPE === 'long_order' ? shuffledOf(a).passage : passages.get(a.id),
  // 장문은 문단이 곧 (A)(B)(C)(D) 다. 배치가 문단 경계를 짐작하지 않도록 갈라서 준다.
  ...(IS_LONG ? longFields(a) : {}),
  // ↓ 여기를 채운다
  choices: [],
  answer: 0,
  rationale_ko: '',
}))

fs.mkdirSync(DIR, { recursive: true })
for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.unlinkSync(path.join(DIR, f))

const chunks = []
for (let i = 0; i < tasks.length; i += SIZE) {
  const n = String(chunks.length).padStart(2, '0')
  fs.writeFileSync(path.join(DIR, `chunk-${n}.json`), JSON.stringify(tasks.slice(i, i + SIZE), null, 1), 'utf8')
  chunks.push(n)
}

console.log(`${spec.label}(${spec.number}번) · V${BAND}`)
console.log(`  본문 있는 원글 ${withBody.length}편`)
console.log(
  IS_LONG
    ? `  그중 장문 규격(문단 ${LONG_PARAGRAPHS}개 · ${LONG_WORDS.min}~${LONG_WORDS.max}어)에 드는 것 ${usable.length}편 · ` +
        `**규격 밖 ${outOfWindow.length}편**  ← 문단 수가 다르거나 길이가 안 맞는 글`
    : `  그중 창(${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어)으로 자를 수 있는 것 ${usable.length}편 · ` +
        `**못 자름 ${outOfWindow.length}편**  ← 문장이 모자라거나 인쇄 불가 자국이 있는 글`,
)
console.log(`  이미 이 유형이 붙은 것 ${existing.size}편`)
console.log(`  **배치가 쓸 몫 ${tasks.length}편**  → 청크 ${chunks.length}개 (${SIZE}편씩)`)
console.log(`\n  ${path.relative(process.cwd(), DIR)}/chunk-NN.json`)
console.log(`  각 항목의 choices(5개)·answer(1~5)·rationale_ko 를 채운 뒤 같은 이름 + .out.json 으로 저장하면`)
console.log(`  item-drain-import.mjs 가 DB 에 넣는다.`)
