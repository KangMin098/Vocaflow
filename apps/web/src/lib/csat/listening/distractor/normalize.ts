// apps/web/src/lib/csat/listening/distractor/normalize.ts
//
// 선지·발화 낱말 정규화(결정적 · LLM 없음). 같은 규칙을 양쪽에 적용해 글자 그대로 「들린」 낱말을 찾는다.
// 규칙: 소문자 · 굽은 따옴표 → ' · 소유격 's 제거 · 수 낱말 → 숫자 · 숫자 포함 토큰 → 숫자만(17th → 17, 3일 → 3)
//       · 라틴 낱말 굴절 접미(ing/ed/es/s) 제거 · 한글 토큰 끝 조사 하나 제거 · 기능어는 내용어에서 뺀다.

export interface Token {
  /** 원문 글자 그대로 */
  raw: string
  /** 정규화 결과 — 비교 키 */
  norm: string
  /** 원문 안의 [charStart, charEnd) */
  charStart: number
  charEnd: number
  /** 기능어가 아니면 true — 겹침 판정은 내용어만 센다 */
  content: boolean
}

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', twenty: '20', thirty: '30',
  forty: '40', fifty: '50', hundred: '100', first: '1', second: '2', third: '3', half: '0.5',
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'for', 'in', 'on', 'at',
  'it', 'this', 'that', 'you', 'i', 'we', 'my', 'your', 'our', 'with', 'will', 'do', 'did', 'does', 'so', 'but', 'me',
  'he', 'she', 'they', 'them', 'his', 'her', 'its', 'as', 'by', 'from', 'can', 'could', 'would', "i'm", "it's", "don't",
  'not', 'no', 'yes', 'oh', 'okay', 'well', 'just', 'really', 'have', 'has', 'had', "i'll", "we're", "you're", 'what',
])

const KO_PARTICLE = /(으로|에서|에게|까지|부터|은|는|이|가|을|를|에|의|로|와|과|도)$/

const TOKEN_RE = /[A-Za-z0-9가-힣]+(?:['’][A-Za-z]+)?/g

function stemLatin(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function normalizeWord(raw: string): string {
  let w = raw.toLowerCase().replace(/’/g, "'")
  if (w.endsWith("'s")) w = w.slice(0, -2)
  if (NUMBER_WORDS[w]) return NUMBER_WORDS[w]
  const digits = w.match(/\d+/g)
  if (digits) return digits.join('')
  if (/^[a-z']+$/.test(w)) return STOPWORDS.has(w) ? w : stemLatin(w)
  if (/[가-힣]/.test(w) && w.length >= 2) return w.replace(KO_PARTICLE, '') || w
  return w
}

export function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const raw = m[0]
    const start = m.index ?? 0
    const lower = raw.toLowerCase().replace(/’/g, "'")
    out.push({ raw, norm: normalizeWord(raw), charStart: start, charEnd: start + raw.length, content: !STOPWORDS.has(lower) })
  }
  return out
}

/** 숫자 토큰인가(정규화 뒤) */
export function isNumericNorm(norm: string): boolean {
  return /^\d+(\.\d+)?$/.test(norm)
}
