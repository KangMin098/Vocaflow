// packages/library-pipeline/src/vocab/typeset.ts
//
// **단어장 조판 — 「데이터가 있다」와 「지면이 있다」 사이를 메우는 곳.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-06) ───────────────────────────
// 단어장은 시중 대비 내용 지수 **1.635** · 선택 지수 1.288 로 이기고 있었는데, **지면 지수는
// 0.102** 였다(`scripts/vocab/design-benchmark.mts`). 시중 단어장이 매 쪽에 싣는 장치 17종 중
// 학습자에게 닿는 것이 1.5개뿐이었다 — 세트를 열면 낱말과 뜻만 나온다.
//
// 그런데 **재료는 이미 다 있다.** `shared_dictionary` 한 행이 뜻 갈래(`meanings_ko[]` — 품사·
// 예문·예문 한국어역까지) · 발음 · 유의/반의 · 연어 · 한국어 학습자 노트 · 굴절/파생형
// (`inflections.forms`) · 소속 리스트를 들고 있다. 없던 것은 **그것들을 지면으로 앉히는 규칙**이다.
//
// 그 규칙이 화면 컴포넌트 안에 있으면 안 되는 이유가 둘이다:
//   ① **파이프라인이 만들어야 한다** — 세트는 컴포저가 발행하고, 발행물이 곧 지면이어야
//      "게시된 것을 새 파이프라인으로 다시 낸다" 가 성립한다. JSX 안에 있으면 재생성이 안 된다.
//   ② **브라우저 없이 잴 수 있어야 한다** — 지면 지수는 렌더된 DOM 에서 재지만, 조판이
//      옳은지는 그 전에 단위 테스트로 잠가야 한다. 개발 서버가 흔들려도 이 층은 흔들리지 않는다.
//
// ── 무엇을 만들지 않는가 ────────────────────────────────────────────
// **없는 값을 지어내지 않는다.** 예문이 없으면 예문 칸을 비우고, 노트가 없으면 노트를 뺀다.
// 시중 지면과의 비교에서 우리가 이기려는 것은 "칸이 있다" 가 아니라 "칸이 채워져 있다" 이고,
// 빈 칸을 채워 넣으면 그 순간 비교가 거짓이 된다(판권면이 같은 이유로 "정보 없음" 을 안 적는다).

// ── 입력 ────────────────────────────────────────────────────────────

/** 사전 한 행 — `shared_dictionary` 에서 지면에 쓰는 것만. */
export interface TypesetWord {
  word: string
  /** 뜻 갈래. 비어 있으면 `meaningKo` 한 줄로 떨어진다. */
  meaningsKo?: Array<{
    pos?: string | null
    meaning?: string | null
    example?: string | null
    example_ko?: string | null
  }> | null
  meaningKo?: string | null
  ipa?: string | null
  partOfSpeech?: string | null
  synonyms?: string[] | null
  antonyms?: string[] | null
  collocations?: string[] | null
  koreanLearnerNote?: string | null
  /** `shared_dictionary.inflections.forms` — 굴절형과 파생어가 섞여 있다. */
  inflectionForms?: string[] | null
  /** 이 낱말이 속한 묶음(챕터·어근·주제). 없으면 한 묶음으로 본다. */
  groupKey?: string | null
  groupLabel?: string | null
}

export interface TypesetInput {
  title: string
  /** 하루치 표제어 수. 사다리 계단이 정한다(`series.ts`). 0 이면 묶음을 그대로 하루로 본다. */
  wordsPerDay: number
  /** 이 세트가 무엇을 원리로 묶였나 — 묶음 머리에 적힌다. */
  principle?: string | null
  /** 누적 복습 주기(일). 능률VOCA 는 5일마다 묶는다 — 0 이면 누적 복습을 만들지 않는다. */
  reviewEveryDays?: number
  words: TypesetWord[]
}

// ── 출력 ────────────────────────────────────────────────────────────

export interface TypesetSense {
  /** 뜻 번호. 갈래가 하나면 `null` — 번호가 하나뿐인 목록은 번호가 아니다. */
  n: number | null
  /** 품사 약물 — 시중 지면과 같은 한 글자. */
  pos: string | null
  meaning: string
  exampleEn: string | null
  exampleKo: string | null
}

export interface TypesetEntry {
  /** 권을 관통하는 통번호. 시중은 네 자리로 찍는다. */
  no: string
  word: string
  ipa: string | null
  senses: TypesetSense[]
  /** 갈라져 나온 말 — 표제어와 어간이 다른 것. */
  derived: string[]
  /** 활용형 — 표제어에 굴절 어미만 붙은 것. */
  inflections: string[]
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  /** 어법·문해력 칸. 없으면 `null` — 지어내지 않는다. */
  note: string | null
  /** 이 권 안의 다른 표제어로 잇는 자리. */
  crossRefs: Array<{ word: string; day: number }>
  day: number
}

export interface TypesetTest {
  /** 뜻 쓰기 — 표제어를 주고 뜻을 묻는다. */
  meaning: Array<{ n: number; word: string }>
  /** 빈칸 — 예문에서 표제어를 지운다. 예문이 있는 것만. */
  cloze: Array<{ n: number; sentence: string; answer: string }>
}

export interface TypesetDay {
  n: number
  label: string
  entries: TypesetEntry[]
  test: TypesetTest
  /** 회독 칸 수 — 시중 지면의 체크박스와 같은 자리. */
  passes: number
}

export interface TypesetPart {
  label: string
  /** 이 묶음이 무엇을 원리로 갈렸나. */
  principle: string | null
  days: TypesetDay[]
}

export interface TypesetReview {
  label: string
  coversDays: number[]
  items: Array<{ n: number; word: string }>
}

export interface VocabSpread {
  title: string
  studyPlan: { days: number; perDay: number; dayLabels: string[] }
  parts: TypesetPart[]
  reviews: TypesetReview[]
  /** 낱말로 되찾는 자리 — 알파벳순 + 몇째 날에 나오는지. */
  index: Array<{ word: string; day: number }>
  /** 이 지면이 실제로 채운 장치. 리포트가 "무엇을 준다고 말할 수 있나" 를 여기서 읽는다. */
  apparatus: string[]
}

// ── 규칙 ────────────────────────────────────────────────────────────

/** 영어 품사 이름 → 시중 지면이 쓰는 한 글자. 모르는 것은 그대로 두지 않고 뺀다. */
const POS_KO: Record<string, string> = {
  noun: '명',
  verb: '동',
  adjective: '형',
  adverb: '부',
  preposition: '전',
  conjunction: '접',
  pronoun: '대',
  interjection: '감',
  determiner: '한',
}

export function posLabel(pos: string | null | undefined): string | null {
  if (!pos) return null
  return POS_KO[pos.toLowerCase()] ?? null
}

/**
 * 굴절형인가 파생어인가.
 *
 * 시중 지면은 이 둘을 **다른 칸**에 싣는다 — 활용형은 표제어 옆 괄호에(quit–quit),
 * 파생어는 아래 들여쓴 줄에(regularly 부). 한 칸에 몰아넣으면 둘 다 아닌 것이 된다.
 *
 * 형태소 분석기를 들이지 않고 규칙으로 가른다: 표제어에 **굴절 어미만** 붙은 것이 굴절형이다.
 * (자음 중복·e 탈락·y→i 같은 흔한 철자 변화까지 본다. 불규칙 동사는 잡지 못하는데,
 *  그건 사전이 `inflections.forms` 에 실어 주므로 파생어 쪽으로 떨어져도 지면에서 사라지진 않는다.)
 */
const INFLECTION_SUFFIXES = ['s', 'es', 'ed', 'ing', 'ies', 'ied']

/**
 * `-er`·`-est` 는 **형용사·부사에서만** 굴절이다(비교급·최상급).
 *
 * 동사에 붙으면 행위자 명사를 만드는 **파생**이다 — `follow` → `follower` 는 활용형이 아니라
 * 갈라져 나온 낱말이다. 처음엔 품사를 안 보고 잘랐다가 지면 콜아웃에서 `(followed–follower)`
 * 가 활용형 괄호에 앉은 것을 보고 알았다(2026-09-07). 코드는 아무 오류도 내지 않았고,
 * 회귀도 형용사(`regular`)로만 짜여 있어 통과했다.
 */
const COMPARATIVE_SUFFIXES = ['er', 'est']
const COMPARABLE_POS = /^(adjective|adverb|adj|adv)$/i

/**
 * 굴절형으로 세기에 너무 짧거나 낱말이 아닌 것.
 *
 * 사전의 `inflections.forms` 에는 `ff` 같은 조각이 섞여 있다(빈도 집계의 부산물).
 * 그대로 두면 지면의 파생어 줄에 `파생 ff · followers` 처럼 찍힌다.
 */
export function isUsableForm(form: string): boolean {
  return /^[a-z][a-z'-]{1,}$/i.test(form) && form.length >= 3
}

export function isInflection(headword: string, form: string, pos?: string | null): boolean {
  const h = headword.toLowerCase()
  const f = form.toLowerCase()
  if (f === h) return true
  const suffixes = COMPARABLE_POS.test(pos ?? '')
    ? [...INFLECTION_SUFFIXES, ...COMPARATIVE_SUFFIXES]
    : INFLECTION_SUFFIXES
  for (const suf of suffixes) {
    if (!f.endsWith(suf)) continue
    const stem = f.slice(0, f.length - suf.length)
    if (stem === h) return true
    // e 탈락: make → making
    if (`${stem}e` === h) return true
    // 자음 중복: stop → stopped
    if (stem.length > 1 && stem.slice(0, -1) === h && stem.at(-1) === h.at(-1)) return true
    // y → i: carry → carried
    if (stem.endsWith('i') && `${stem.slice(0, -1)}y` === h) return true
  }
  return false
}

/** 예문에서 표제어를 지운다. 굴절형까지 지우려 하지 않는다 — 지우지 못하면 그 문항을 안 만든다. */
export function clozeOf(sentence: string, headword: string): string | null {
  const re = new RegExp(`\\b${headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (!re.test(sentence)) return null
  return sentence.replace(re, '_______')
}

const pad4 = (n: number): string => String(n).padStart(4, '0')

// ── 조판 ────────────────────────────────────────────────────────────

export function typesetVocabSet(input: TypesetInput): VocabSpread {
  const words = input.words
  const perDay = input.wordsPerDay > 0 ? input.wordsPerDay : Math.max(1, words.length)

  /*
    묶음(PART)은 낱말이 이미 들고 있는 `groupKey` 를 그대로 쓴다. 여기서 새로 나누지 않는다 —
    묶음 원리는 컴포저가 정하는 것이고(`compose/organize.ts`), 조판기가 다시 나누면
    "목차가 왜 이렇게 갈렸나" 의 답이 두 곳으로 갈린다.
  */
  const groupOrder: string[] = []
  const byGroup = new Map<string, TypesetWord[]>()
  for (const w of words) {
    const key = w.groupKey ?? '__all__'
    if (!byGroup.has(key)) {
      byGroup.set(key, [])
      groupOrder.push(key)
    }
    byGroup.get(key)!.push(w)
  }

  // 먼저 날짜를 배정한다 — 상호참조가 "그 낱말은 며칠째" 를 적으려면 전체 배치가 먼저 있어야 한다.
  const dayOf = new Map<string, number>()
  {
    let dayNo = 0
    let filled = perDay
    for (const key of groupOrder) {
      for (const w of byGroup.get(key)!) {
        if (filled >= perDay) {
          dayNo += 1
          filled = 0
        }
        if (!dayOf.has(w.word)) dayOf.set(w.word, dayNo)
        filled += 1
      }
    }
  }

  const inVolume = new Set(words.map((w) => w.word.toLowerCase()))

  const entryOf = (w: TypesetWord, no: number): TypesetEntry => {
    const raw = (w.meaningsKo ?? []).filter((m) => (m.meaning ?? '').trim().length > 0)
    const senses: TypesetSense[] = raw.length > 0
      ? raw.map((m, i) => ({
          n: raw.length > 1 ? i + 1 : null,
          pos: posLabel(m.pos ?? w.partOfSpeech),
          meaning: (m.meaning ?? '').trim(),
          exampleEn: m.example?.trim() || null,
          exampleKo: m.example_ko?.trim() || null,
        }))
      : (w.meaningKo ?? '').trim()
        ? [{
            n: null,
            pos: posLabel(w.partOfSpeech),
            meaning: (w.meaningKo ?? '').trim(),
            exampleEn: null,
            exampleKo: null,
          }]
        : []

    /*
      사전의 굴절 목록에는 조각(`ff` 등)이 섞여 있다 — 낱말이 아닌 것을 먼저 버린다.
      품사를 함께 넘기는 이유는 `-er`/`-est` 가 형용사에서만 굴절이기 때문이다.
    */
    const pos = raw[0]?.pos ?? w.partOfSpeech ?? null
    const forms = (w.inflectionForms ?? []).filter(
      (f) => f && f.toLowerCase() !== w.word.toLowerCase() && isUsableForm(f),
    )
    const inflections = forms.filter((f) => isInflection(w.word, f, pos))
    const derived = forms.filter((f) => !isInflection(w.word, f, pos))

    /*
      상호참조는 **이 권 안에 실제로 있는 낱말**만 잇는다. 밖의 낱말을 가리키면 학습자가
      따라갈 곳이 없어 지면이 거짓말을 하게 된다(시중 지면의 `(p.208)` 은 늘 그 책 안이다).
    */
    const crossRefs = [...(w.synonyms ?? []), ...(w.antonyms ?? [])]
      .filter((s) => inVolume.has(s.toLowerCase()) && s.toLowerCase() !== w.word.toLowerCase())
      .map((s) => ({ word: s, day: dayOf.get(s) ?? dayOf.get(s.toLowerCase()) ?? 0 }))
      .filter((r) => r.day > 0)

    return {
      no: pad4(no),
      word: w.word,
      ipa: w.ipa?.trim() || null,
      senses,
      derived,
      inflections,
      synonyms: w.synonyms ?? [],
      antonyms: w.antonyms ?? [],
      collocations: w.collocations ?? [],
      note: w.koreanLearnerNote?.trim() || null,
      crossRefs,
      day: dayOf.get(w.word) ?? 1,
    }
  }

  const testOf = (entries: TypesetEntry[]): TypesetTest => ({
    meaning: entries.map((e, i) => ({ n: i + 1, word: e.word })),
    cloze: entries
      .map((e) => {
        const ex = e.senses.find((s) => s.exampleEn)?.exampleEn
        if (!ex) return null
        const masked = clozeOf(ex, e.word)
        return masked ? { sentence: masked, answer: e.word } : null
      })
      .filter((x): x is { sentence: string; answer: string } => x !== null)
      .map((x, i) => ({ n: i + 1, ...x })),
  })

  // 이제 실제로 앉힌다.
  const parts: TypesetPart[] = []
  let running = 0
  const dayBuckets = new Map<number, TypesetEntry[]>()

  for (const key of groupOrder) {
    const groupWords = byGroup.get(key)!
    const label = groupWords[0]?.groupLabel ?? (key === '__all__' ? input.title : key)
    const days: TypesetDay[] = []
    const seenDays = new Set<number>()

    for (const w of groupWords) {
      running += 1
      const entry = entryOf(w, running)
      if (!dayBuckets.has(entry.day)) dayBuckets.set(entry.day, [])
      dayBuckets.get(entry.day)!.push(entry)
      seenDays.add(entry.day)
    }

    for (const n of [...seenDays].sort((a, b) => a - b)) {
      const entries = dayBuckets.get(n)!
      days.push({
        n,
        label: `DAY ${String(n).padStart(2, '0')}`,
        entries,
        test: testOf(entries),
        // 회독 3칸 — 시중 지면의 체크박스와 같은 수(능률VOCA 4권 실측).
        passes: 3,
      })
    }
    parts.push({ label, principle: input.principle ?? null, days })
  }

  const totalDays = dayBuckets.size
  const reviewEvery = input.reviewEveryDays ?? 5
  const reviews: TypesetReview[] = []
  if (reviewEvery > 0) {
    for (let from = 1; from <= totalDays; from += reviewEvery) {
      const to = Math.min(from + reviewEvery - 1, totalDays)
      // 마지막 조각이 한 날짜뿐이면 묶음이 아니다 — 앞 묶음이 이미 그 자리를 한다.
      if (to <= from) break
      const covers: number[] = []
      for (let d = from; d <= to; d += 1) covers.push(d)
      const items = covers
        .flatMap((d) => dayBuckets.get(d) ?? [])
        .map((e, i) => ({ n: i + 1, word: e.word }))
      reviews.push({
        label: `DAY ${String(from).padStart(2, '0')}–${String(to).padStart(2, '0')} 누적 복습`,
        coversDays: covers,
        items,
      })
    }
  }

  const index = [...dayBuckets.values()]
    .flat()
    .map((e) => ({ word: e.word, day: e.day }))
    .sort((a, b) => a.word.localeCompare(b.word))

  const allEntries = [...dayBuckets.values()].flat()
  /*
    **이 지면이 실제로 채운 장치만 적는다.** 「칸을 만들었다」가 아니라 「값이 들어갔다」가
    기준이다 — 빈 칸을 세면 지면 지수가 스스로를 속인다.
  */
  const apparatus: string[] = []
  const push = (id: string, ok: boolean): void => { if (ok) apparatus.push(id) }
  push('entryNumber', allEntries.length >= 3)
  push('runningHead', totalDays >= 1)
  push('posLabel', allEntries.some((e) => e.senses.some((s) => s.pos)))
  push('senseNumber', allEntries.some((e) => e.senses.length > 1))
  push('derivedRow', allEntries.some((e) => e.derived.length > 0))
  push('exampleEn', allEntries.some((e) => e.senses.some((s) => s.exampleEn)))
  push('exampleKo', allEntries.some((e) => e.senses.some((s) => s.exampleEn && s.exampleKo)))
  push('usageNote', allEntries.some((e) => e.note))
  push('dailyTest', parts.some((p) => p.days.some((d) => d.test.meaning.length > 0)))
  push('cumulativeReview', reviews.length > 0)
  push('partDivider', totalDays >= 2)
  push('studyPlanGrid', totalDays >= 1)
  push('index', index.length > 0)
  push('crossRef', allEntries.some((e) => e.crossRefs.length > 0))
  push('inflection', allEntries.some((e) => e.inflections.length > 0))
  push('rootHeader', Boolean(input.principle))
  push('checkbox', parts.some((p) => p.days.some((d) => d.passes > 0)))

  return {
    title: input.title,
    studyPlan: {
      days: totalDays,
      perDay,
      dayLabels: Array.from({ length: totalDays }, (_, i) => `DAY ${String(i + 1).padStart(2, '0')}`),
    },
    parts,
    reviews,
    index,
    apparatus,
  }
}
