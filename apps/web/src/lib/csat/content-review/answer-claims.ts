// apps/web/src/lib/csat/content-review/answer-claims.ts
//
// **강의·해설 문장에서 「정답/오답 진술」을 선지 집합으로 읽는다(F6 보조).**
//
// 한국어 정답 진술의 꼴은 끝이 없다(「① 또는 ④」 · 「① 역시」 · 「④가 아니라 ①」 · 「오답이 아닙니다」 …).
// 그래서 이 해석기의 목표는 「모든 문장을 이해한다」가 아니라 **「이해하지 못한 부분이 하나라도 있으면
// 그 문장을 사람 확인으로 돌린다」**이다(T-0158 Codex 5차).
//   - 정답·오답을 말하는 문장 안의 **모든 선지 번호**가 아는 진술 꼴에 소비돼야 한다. 하나라도 남으면 unparsed.
//   - 「아니/아닙/아닌」은 아는 꼴(「답이 아닙니다」) 안에서만 허용한다. 그 밖의 부정은 범위를 모르므로 unparsed.
//   - unparsed 문장의 부분 해석은 버린다 — 반쯤 읽은 결과로 「충돌 없음」이나 엉뚱한 진단을 내지 않는다.
// 해석하지 못했다고 통과시키지 않는다. 옳지만 복잡한 문장도 사람이 확인한다(의도된 한계).

const KO_NUM: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/** 선지 하나: 「④」 또는 「사 번 · 4번」 — 원문자에는 「번」이 없어도 된다 */
const C = '(?:[①-⑤]|[일이삼사오1-5]\\s*번)'
/**
 * 번호 **탐지**용 — 진술 꼴(C)에 없는 「번 없는 숫자」(「정답은 1입니다」)도 번호로 센다(T-0158 Codex 10차 P1).
 * 소비되지 않으면 남은 번호 검사가 사람 확인으로 보낸다. 연도·소수·큰 수 안의 숫자(「2015」·「1.8」)는 제외.
 */
// 소수 판정은 「. 뒤에 숫자」일 때만 — 「정답은 1.」의 문장 끝 마침표를 소수로 보면 번호를 놓친다(11차 P1)
const C_RE = /([①-⑤])|([일이삼사오1-5])\s*번|(?<!\d|\d[.,])([1-5])(?!\d|[.,]\d|\s*번)/g
/** 선지 목록: 「④와 ⑤」 · 「사 번과 오 번」 · 「①, ③」 */
const LIST = `${C}(?:\\s*(?:와|과|,|및)\\s*${C})*`
const NOT = '아[니닙닌]'
/** 번호와 술어 사이: 다른 선지 번호·「정답」·부정을 넘지 않는다 */
/**
 * 번호와 「오답 · 답이 아닙니다」 사이 — **공백·쉼표·「역시」만**. 자유 서술을 허용하면 「①을 배제하면 오답」을
 * 「①은 오답」으로 반대로 읽는다(T-0158 Codex 8차 P1). 사이에 서술이 끼면 이 꼴이 아니고, 남은 번호 검사가 사람 확인으로 보낸다.
 */
const GAP = '(?:\\s|,|역시)*'

/**
 * 「정답은 (오직) ④(와 ⑤)(뿐)(입니다)」 · 「정답은 삼 번.」 · 「정답은 이 번, 해치기입니다.」 · 「정답은 삼 번 자리입니다.」
 * 실제 강의의 표준 꼴이다. 번호 뒤는 문장 끝 · 쉼표 동격 · 서술어만 허용한다 — 「④가 아니라 ①」처럼 조사가 붙으면
 * 이 꼴이 아니다(동격 안에 다른 번호·부정이 있으면 남은 번호·부정 검사가 잡는다).
 */
const ANSWER_HEAD = new RegExp(`정답은\\s*(오직|바로|단|딱)?\\s*(${LIST})\\s*(하나뿐|하나|뿐|만)?(?:\\s*자리)?\\s*(?=[,.。]|$|이에요|예요|입니다|이다|이죠|죠)`, 'g')
/**
 * 「(오직) ④(와 ⑤)(만/도/가) (모두) 정답」 · 「오 번도 정답으로 인정됐어요」.
 * 뒤에 「이 아니」·「에」·「을/를」·(인정이 아닌)「으로」가 오면 이 꼴이 아니다.
 */
/**
 * 진술 바로 뒤에 올 수 있는 것 — 서술어 종결·연결(「이고 · 이며」)·쉼표·문장 끝·「으로 인정」뿐.
 * 「정답이 될 수 없다 · 정답일 리 없다 · 정답이라는 말은 틀렸다 · 정답은커녕」은 여기서 끊겨 이 꼴로 읽히지 않는다(T-0158 Codex 6차 P1).
 */
const CLAIM_END = '(?=\\s*(?:입니다|이에요|예요|이다|이죠|죠|이고|이며|이에요|[,.。]|$|으로\\s*인정))'
const ANSWER_TAIL = new RegExp(`(오직|단|딱)?\\s*(${LIST})\\s*(만이?|도|[이가은는])?\\s*(?:모두\\s*|둘\\s*다\\s*)?정답${CLAIM_END}`, 'g')
/** 「④(와 ⑤)는 오답」 · 「오 번은 … 답이 아닙니다」 · 「⑤는 정답이 아닙니다」 */
const REJECT = new RegExp(`(${LIST})\\s*(?:[은는이가도]|모두)?\\s*${GAP}(오답${CLAIM_END}|정?답이\\s*${NOT}(?:니다|에요|다|고|며))`, 'g')
/** 검사 진입 — 「답」이 들어간 문장은 모두(「①은 답입니다」·「④만이 답」도 — 10차 P1). 아는 꼴이 아니면 사람 확인 */
const TALKS_ANSWER = /답/
const ANY_NOT = new RegExp(NOT, 'g')
/**
 * 소비되지 않은 부분에 남으면 문장 뜻을 뒤집을 수 있는 말 — 남아 있으면 부분 해석을 버린다.
 * (번호·「아니」만 보면 「④가 정답 … 틀렸습니다」의 뒤집기를 놓친다)
 */
const FLIP = /없|틀|커녕|않|못|잘못|거짓|아[니닙닌]|반대|대신|말고|빼고|제외|오답|정답|오류|허위|철회|착각|오해|취소|번복|수정|만\s|지만|으나|는데/g

/**
 * **진술에 소비되지 않은 나머지가 가질 수 있는 것(화이트리스트)** — 이것 말고 한 글자라도 남으면 사람 확인.
 * 블랙리스트(FLIP)는 원리상 완결되지 않는다(「오류 · 허위 · 철회」… — T-0158 Codex 7차 P1).
 *  - 종결·연결 어미와 문장부호 · 「으로 인정됐어요」류
 *  - 위치 설명어: 「여기 다섯 번째 문장 · 비 밑줄 · 자리」
 *  - 담화 표지: 「여러분 · 자 · 그래서 · 따라서 · 즉 · 결국 · 여기서」
 *  - 동격(정답은 N, X): X 가 그 선지 본문과 같을 때만(호출자가 choices 를 줄 때)
 */
const RESIDUE_OK = new RegExp([
  '\\s+', '[,.。!]',
  '입니다', '이에요', '예요', '이다', '이죠', '죠', '이고', '이며', '요',
  '으로\\s*인정(?:됐어요|되었습니다|됐습니다|됩니다|된다|돼요)',
  '여러분', '자', '그래서', '따라서', '즉', '결국', '여기서', '여기',
  '(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\\s*번째', '문장', '비\\s*밑줄', '밑줄', '자리', '씨',
].map((p) => `(?:${p})`).join('|'), 'g')

const norm = (t: string) => t.replace(/^[①-⑤]\s*/, '').replace(/[\s.,。!]+/g, '').replace(/(?:입니다|이에요|예요|이다|이죠|죠)$/, '')

export interface AnswerClaim {
  choices: number[]
  /** 「오직 · 만 · 뿐 · 하나」 — 이 집합만 정답이라는 진술 */
  exclusive: boolean
  /** 「도」 — 다른 정답이 있음을 전제하는 진술 */
  inclusive: boolean
  sentence: string
}

export interface ClaimReading {
  answers: AnswerClaim[]
  rejected: number[]
  /** 정답·오답을 말하는데 전부 해석하지 못한 문장 — 부분 해석은 버렸다 */
  unparsed: string[]
}

interface Span { start: number; end: number }

function refsIn(text: string, offset = 0): { n: number; at: number }[] {
  const out: { n: number; at: number }[] = []
  for (const m of text.matchAll(C_RE)) {
    const g = (m[1] ?? m[2] ?? m[3])!
    const n = KO_NUM[g] ?? Number(g)
    if (n >= 1 && n <= 5) out.push({ n, at: offset + m.index! })
  }
  return out
}
const uniq = (xs: number[]) => [...new Set(xs)]
const inside = (at: number, spans: Span[]) => spans.some((s) => at >= s.start && at < s.end)

/** 문장에서 소비된 구간을 뺀 나머지가 화이트리스트만으로 이뤄졌는가 */
function residueClean(sentence: string, used: Span[], appositionOk: (s: string) => boolean): boolean {
  let rest = ''
  for (let i = 0; i < sentence.length; i++) rest += inside(i, used) ? '\u0000' : sentence[i]
  // 동격 — 「정답은 N 번, X(입니다).」의 X 가 그 선지 본문이면 소비
  rest = rest.replace(/\u0000\s*,\s*([^\u0000]+?)\s*(?:입니다|이에요|예요|이다)?\s*[.。!]?\s*$/, (whole, x: string) => (appositionOk(x) ? '\u0000' : whole))
  const left = rest.split('\u0000').join(' ').replace(RESIDUE_OK, '')
  return left.trim() === ''
}

/**
 * 번호 표기 변형을 ①~⑤ 로 모은다(❶ · ➀ · ➊ · ⓵ · ⑴ · ⒈ · 전각 １ … — T-0158 Codex 12차 P1).
 * 여기 없는 숫자 문자는 아래 `exoticNumber` 가 잡아 사람 확인으로 보낸다(변형 목록을 완결할 필요가 없게).
 */
const NUMBER_VARIANTS: readonly (readonly string[])[] = [
  ['❶', '❷', '❸', '❹', '❺'], ['➀', '➁', '➂', '➃', '➄'], ['➊', '➋', '➌', '➍', '➎'],
  ['⓵', '⓶', '⓷', '⓸', '⓹'], ['⑴', '⑵', '⑶', '⑷', '⑸'], ['⒈', '⒉', '⒊', '⒋', '⒌'], ['１', '２', '３', '４', '５'],
]
const CIRCLED = ['①', '②', '③', '④', '⑤']
function canonicalNumbers(text: string): string {
  let t = text
  for (const set of NUMBER_VARIANTS) set.forEach((ch, i) => { t = t.split(ch).join(CIRCLED[i]!) })
  return t
}
/** 정규화 뒤에도 남은 「①~⑤·ASCII 숫자가 아닌 숫자 문자」 — 해석하지 않고 사람 확인 */
const exoticNumber = (s: string) => /[^①-⑤\d]/u.test(s.replace(/[^\p{N}]/gu, ''))

export function readClaims(rawText: string, ctx: { choices?: readonly string[]; rejectTarget?: number } = {}): ClaimReading {
  const text = canonicalNumbers(rawText)
  const answers: AnswerClaim[] = []
  const rejected: number[] = []
  const unparsed: string[] = []
  // 문장 밖에서 앞 진술을 뒤집는 응답(「④가 정답이죠? 아니요, ①입니다.」) — 문장 단위로는 못 읽는다
  if (/아니요|아뇨|아니에요[,.]?\s*[①-⑤일이삼사오1-5]/.test(text) && refsIn(text).length > 0) {
    return { answers: [], rejected: [], unparsed: [text.trim()] }
  }
  for (const raw of text.split(/(?<=[.。?!])\s*/)) {
    const sentence = raw.trim()
    // 「답」이 들었지만 정답과 무관한 낱말(대답 · 답하다 · 보답 · 응답 · 답장 · 답변)은 진입 판정에서 지운다
    const gateText = sentence.replace(/대답|답하|답해|답했|답한|답할|보답|응답|답장|답변/g, '')
    if (!sentence || !TALKS_ANSWER.test(gateText)) continue
    // 선지 번호가 없는 문장(「…맞는 진술이고, 답이 아닙니다」)의 주어는 cue target(reject:n)이 정한다 — 호출자가 따로 검사한다
    if (exoticNumber(sentence)) { unparsed.push(sentence); continue }
    // 번호처럼 보일 수 있는 것(숫자 문자 · 「일~오 번」)이 하나도 없으면 cue target 이 맡는다.
    // 「선지 번호인가」를 휴리스틱으로 가리지 않는다 — 소수·연도 예외가 「1,2,3」을 통째로 놓쳤다(T-0158 Codex 13차 P1).
    // 단, **긍정형 정답 진술**(「정답」·「답은/답입/답이(아니 제외)/답=:」)은 번호가 안 보여도 넘기지 않는다 —
    // 「정답은 오.」·「마지막 선지가 정답」·「정답은 five」처럼 번호를 말로 쓰면 번호 탐지는 끝이 없다. 아는 꼴로 다 읽히지 않으면 사람 확인.
    // 긍정형을 목록으로 판별하면 끝이 없다(「답 맞습니다」·「답으로」·문장 끝 「답」 — 14차 P1). 그래서 거꾸로:
    // 이 문장의 「답」이 **모두** 번호 없는 부정형(「답이 아닙니다」)이나 UI 이름(「정답 블록」)일 때만 건너뛴다(cue target 이 맡는다).
    // 건너뜀은 **정확한 꼴**만(15차 P1 — 「정답이 아니라는 말은 틀렸습니다」를 부정형으로 건너뛰었다):
    //  (a) UI 이름 「정답 블록」만 든 문장, 또는
    //  (b) 소거 cue(target reject:n) 안에서 「…답이 아닙니다/아니에요/아니다.」로 **끝나고** 「답」이 그 한 번뿐이며,
    //      앞부분에 다른 선지를 가리키는 말이 없는 문장 — 주어는 cue target 이 정한다.
    //      (앞부분 부정어는 결론을 못 뒤집는다 — 이중 부정은 부정이 **뒤에** 와야 하는데 끝 꼴 조건이 그것을 막는다.
    //       「묻지 않으니 맞는 진술이고, 답이 아닙니다」 같은 실제 소거 문장을 막지 않는다)
    const noUi = gateText.replace(/정답\s*블록/g, '')
    const uiOnly = !/답/.test(noUi)
    // 「오답이 아닙니다」(= 정답이라는 뜻)는 이 꼴이 아니다 — 「답이」 앞 글자가 「오」면 제외(16차 P1)
    const negTail = /^(.*?)(?<!오)정?답이\s*아(?:닙니다|니에요|니다|니죠)[.。!]?$/.exec(noUi)
    const targetNegative = ctx.rejectTarget != null && negTail != null && (noUi.match(/답/g) ?? []).length === 1
      && !/선지|보기|번(?!째)/.test(negTail[1]!)
    if (!/\p{N}/u.test(sentence) && refsIn(sentence).length === 0 && (uiOnly || targetNegative)) continue
    const mine: AnswerClaim[] = []
    const mineRejected: number[] = []
    const used: Span[] = [] // 진술 꼴이 소비한 구간(선지 번호·부정 포함)
    for (const m of sentence.matchAll(ANSWER_HEAD)) {
      used.push({ start: m.index!, end: m.index! + m[0].length })
      mine.push({ choices: uniq(refsIn(m[2]!).map((r) => r.n)), exclusive: !!(m[1] || m[3]), inclusive: false, sentence })
    }
    for (const m of sentence.matchAll(ANSWER_TAIL)) {
      if (inside(m.index! + m[0].length - 1, used)) continue
      used.push({ start: m.index!, end: m.index! + m[0].length })
      const particle = m[3] ?? ''
      mine.push({ choices: uniq(refsIn(m[2]!).map((r) => r.n)), exclusive: !!m[1] || particle.startsWith('만'), inclusive: particle === '도', sentence })
    }
    const rejectGaps: string[] = []
    for (const m of sentence.matchAll(REJECT)) {
      used.push({ start: m.index!, end: m.index! + m[0].length })
      mineRejected.push(...refsIn(m[1]!).map((r) => r.n))
      rejectGaps.push(m[0].slice(m[1]!.length, m[0].length - m[2]!.length))
    }
    // 소비되지 않은 선지 번호나 부정이 남았으면 이 문장은 사람이 읽는다
    // 진술에 소비되지 않은 번호 — 「일~오 번」 꼴이든 **어떤 숫자 문자든**(연도·소수·쉼표 나열 구분 없이) 남으면 사람 확인
    const strayRef = refsIn(sentence).some((r) => !inside(r.at, used))
      || [...sentence.matchAll(/\p{N}/gu)].some((m) => !inside(m.index!, used))
    const strayNot = [...sentence.matchAll(ANY_NOT)].some((m) => !inside(m.index!, used))
    // 오답 진술의 사이 구간(「오 번은 맞는 진술이고, 답이 아닙니다」)은 자유 서술이라 뒤집는 말 목록으로 본다
    const gapFlip = rejectGaps.some((g) => { FLIP.lastIndex = 0; return FLIP.test(g) })
    // 나머지는 화이트리스트로 — 동격은 그 진술이 가리킨 선지 본문과 같을 때만
    const claimed = uniq(mine.flatMap((a) => a.choices))
    const appositionOk = (x: string) => {
      const nx = norm(x)
      return nx.length > 0 && claimed.some((n) => {
        const c = ctx.choices?.[n - 1]
        // **정확히 같을 때만** — 포함 관계를 허용하면 선지 본문 뒤에 붙인 「…는 오답입니다」까지 동격으로 소비한다(T-0158 Codex 9차 P1)
        return c != null && norm(c) === nx
      })
    }
    const residueBad = !residueClean(sentence, used, appositionOk)
    // 물음은 단언이 아니다 — 「④가 정답이죠?」를 정답 진술로 세지 않는다
    const question = /[?？]\s*$/.test(sentence)
    if (strayRef || strayNot || gapFlip || residueBad || question || (mine.length === 0 && mineRejected.length === 0)) {
      unparsed.push(sentence)
      continue
    }
    answers.push(...mine)
    for (const n of mineRejected) if (!rejected.includes(n)) rejected.push(n)
  }
  return { answers, rejected, unparsed }
}
