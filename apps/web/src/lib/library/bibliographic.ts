// apps/web/src/lib/library/bibliographic.ts
//
// 서지정보 정규화 — 제목·저자를 **실제 도서관 카탈로그처럼** 균질하게.
//
// ── 왜 필요한가 (실측 2026-08-15) ─────────────────────────────────
// 서가에 소스별 관행이 그대로 섞여 있었다:
//   Gutenberg   `Austen, Jane` · `Dumas, Alexandre`   ← 도서관 도치형(LOC)
//   Standard Ebooks `Charles Dickens`                  ← 자연형
//   StoryWeaver `Shabnam  Minwalla` · `Mathangi  Subramanian ` ← 이중공백·후행공백
//   Gutenberg   `Twenty years after`                   ← 문장형 대소문자
// 같은 서가에서 저자가 두 형식으로 불리면 정렬도, 검색도, 인상도 무너진다.
//
// ── 원칙: 고치는 것만 고친다 ──────────────────────────────────────
// 무차별 타이틀케이스는 위험하다 — `MacDonald`·`H. P.`·`J.-K.`·`de Profundis` 처럼
// 이미 옳은 표기를 망가뜨린다. 그래서 **전부 소문자인 단어만** 손대고, 대문자가 하나라도
// 섞인 토큰(고유명사·이니셜·머리글자)은 건드리지 않는다.

/** 타이틀케이스에서 소문자로 두는 기능어. 첫 단어·마지막 단어는 예외적으로 대문자. */
const MINOR_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via',
  'from', 'into', 'like', 'near', 'onto', 'over', 'past', 'than', 'with',
  // 유럽어 인명·제목 접사 — `de Profundis`, `van Gogh`, `von Grimmelshausen`
  'de', 'del', 'della', 'der', 'des', 'di', 'du', 'la', 'le', 'van', 'von',
])

/** 저자 도치형을 안 푸는 접미사 — `King, Martin Luther, Jr.` 같은 3부 이름. */
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|phd|md|esq)\.?$/i

/** 연속 공백 → 하나, 앞뒤 공백 제거. 모든 정규화의 공통 1단계. */
export function collapseSpaces(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * 저자 표기 정규화.
 *
 * `Austen, Jane` → `Jane Austen`. 도치는 **쉼표가 정확히 하나**이고 양쪽이 모두
 * 이름처럼 보일 때만 푼다. `King, Martin Luther, Jr.`(쉼표 2개)·`Little, Brown and Company`
 * (뒤가 조직명)처럼 애매하면 **손대지 않는다** — 틀리게 뒤집는 것보다 그대로 두는 편이 낫다.
 */
export function normalizeAuthor(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = collapseSpaces(raw)
  if (!s) return null

  const parts = s.split(',')
  if (parts.length !== 2) return s // 쉼표 0개 또는 2개 이상 → 그대로

  const family = collapseSpaces(parts[0] ?? '')
  const given = collapseSpaces(parts[1] ?? '')
  if (!family || !given) return s
  // `Jr.`·`PhD` 는 given 이 아니라 접미사다 — 뒤집으면 `Jr. King` 이 된다.
  if (NAME_SUFFIX.test(given)) return s
  // 뒤쪽이 여러 단어이고 조직 신호가 있으면 인명이 아니다.
  if (/\b(and|company|press|books|inc|ltd|society|university)\b/i.test(given)) return s

  return `${given} ${family}`
}

/**
 * 제목 타이틀케이스 보정.
 *
 * **전부 소문자인 단어만** 대문자로 올린다. 대문자가 섞인 토큰은 이미 의도된 표기로 보고
 * 그대로 둔다(`MacDonald`·`H. P.`·`CEFR`). 기능어는 소문자로 두되 **첫 단어와 마지막
 * 단어는 올린다**(영문 타이틀케이스 관행).
 */
export function normalizeTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = collapseSpaces(raw)
  if (!s) return null

  const tokens = s.split(' ')

  // ⚠️ **문장형으로 보일 때만 손댄다.**
  // 소문자 실단어가 하나뿐이면 그건 출판사의 표기다 — `Tell Me, What is a Drone?` 의
  // `is` 는 StoryWeaver 가 실제로 쓰는 제목이고, 우리가 `Is` 로 고칠 일이 아니다.
  // 반면 `Twenty years after` 처럼 둘 이상이면 소스가 문장형으로 넣은 것이다.
  const sentenceCaseSignals = tokens.filter((tok, i) => {
    if (i === 0) return false // 첫 단어는 어차피 대문자라 신호가 안 된다
    if (/[A-Z]/.test(tok) || !/[a-z]/.test(tok) || /^\d/.test(tok)) return false
    return !MINOR_WORDS.has(tok.replace(/[^a-z]/g, ''))
  }).length
  if (sentenceCaseSignals < 2) return s
  const out = tokens.map((tok, i) => {
    // 대문자가 하나라도 있으면 의도된 표기 — 건드리지 않는다.
    if (/[A-Z]/.test(tok)) return tok
    // 글자가 없는 토큰(숫자·기호)도 그대로.
    if (!/[a-z]/.test(tok)) return tok
    // 숫자로 시작하면 서수·판차다 — `2nd` 를 `2Nd` 로 만들면 안 된다(회귀로 잡힘).
    if (/^\d/.test(tok)) return tok

    const bare = tok.replace(/[^a-z]/g, '')
    const isEdge = i === 0 || i === tokens.length - 1
    if (!isEdge && MINOR_WORDS.has(bare)) return tok

    // 앞의 기호(따옴표·괄호)를 건너뛰고 첫 글자만 올린다.
    return tok.replace(/^([^a-z]*)([a-z])/, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
  })
  return out.join(' ')
}

/** 정규화가 실제로 바꾸는 것이 있는지 — 백필 대상 판정용. */
export function needsNormalization(book: {
  title?: string | null
  author?: string | null
}): boolean {
  const t = book.title ?? null
  const a = book.author ?? null
  return normalizeTitle(t) !== (t ?? null) || normalizeAuthor(a) !== (a ?? null)
}
