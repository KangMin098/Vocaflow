// packages/library-pipeline/src/compose/activities.ts
//
// ACP §20 재저작 — 가공(활동 파생).
//
// 벤치마크에서 가장 크게 비어 있던 축이다. Breaking News English 는 기사 1편을
// **문자열 변형만으로** 20여 개 활동으로 증폭한다 — LLM 없이, 비용 0으로.
// Vocaflow 는 그 활동들을 이미 모듈로 갖고 있으므로(SpellForge·Dictation·ScriptQuiz·DCP…),
// 필요한 것은 새 활동이 아니라 **그 모듈들이 먹을 입력을 지문 하나에서 뽑아내는 것**이다.
//
// 그래서 이 파일의 핵심 산출물은 변형 함수가 아니라 **비용 구분 레지스트리**다:
//   어떤 활동이 기계 변환(재생성 무료·멱등)이고 어떤 것이 LLM 호출(유료·비결정)인지가
//   갈리지 않으면, 지문 1편의 단가를 예측할 수 없고 재생성이 무서워진다.
//
// ⚠ 문장 순서/삽입(order·insert)은 여기서 만들지 않는다 — `dcp/generate-items.ts` 가
//   이미 결정론으로 만든다. 중복 구현하면 두 벌이 갈린다.

// ── 활동 레지스트리 ──────────────────────────────────────────────────

/** 재생성 비용. mechanical = 문자열 처리(무료·멱등) · llm = 모델 호출(유료·비결정). */
export type ActivityCost = 'mechanical' | 'llm'

export interface ActivitySpec {
  key: string
  /** 교사·관리자가 보는 이름 */
  label: string
  /** 결과를 소비하는 기존 Vocaflow 모듈 (없으면 신규 표면 필요) */
  module: string | null
  cost: ActivityCost
  /** 이 활동을 만들려면 지문 외에 무엇이 더 필요한가 */
  needs: ReadonlyArray<'text' | 'vocab' | 'audio'>
  note: string
}

/**
 * 재저작 지문 1편에서 파생 가능한 활동.
 *
 * mechanical 이 다수라는 점이 이 파이프라인의 경제성이다 — 지문 1편의 LLM 비용은
 * **작성 1회**에 대부분 몰려 있고, 활동은 얼마든지 다시 만들어도 추가 비용이 0이다.
 */
export const COMPOSE_ACTIVITIES: Record<string, ActivitySpec> = {
  read: {
    key: 'read',
    label: '읽기',
    module: 'TextViewer',
    cost: 'mechanical',
    needs: ['text'],
    note: '본문 그대로. 발주 셀(register×CEFR)이 난이도를 이미 보장한다.',
  },
  word_set: {
    key: 'word_set',
    label: '단어장',
    module: 'WordVault',
    cost: 'mechanical',
    needs: ['text', 'vocab'],
    note: '발행 트리거가 select_article_vocab 로 자동 생성. ND 아니고 noise 낮으면 통과.',
  },
  gapfill: {
    key: 'gapfill',
    label: '빈칸 채우기',
    module: null,
    cost: 'mechanical',
    needs: ['text', 'vocab'],
    note: 'BNE 대표 활동. 목표 어휘를 문맥에서 인출시킨다(Active Recall + Context-Dependent).',
  },
  spelling: {
    key: 'spelling',
    label: '철자 복원',
    module: 'SpellForge',
    cost: 'mechanical',
    needs: ['vocab'],
    note: '모음 제거 등 시각 단서 축소 → 생성 인출. SpellForge 가 소비.',
  },
  order: {
    key: 'order',
    label: '문장 순서',
    module: 'DCP',
    cost: 'mechanical',
    needs: ['text'],
    note: 'dcp/generate-items.ts 가 결정론으로 생성(원문 = 정답 키). 여기서 다시 만들지 않는다.',
  },
  insert: {
    key: 'insert',
    label: '문장 삽입',
    module: 'DCP',
    cost: 'mechanical',
    needs: ['text'],
    note: 'order 와 같은 생성기. CSAT 빈출 유형.',
  },
  dictation: {
    key: 'dictation',
    label: '받아쓰기',
    module: 'Dictation',
    cost: 'mechanical',
    needs: ['text', 'audio'],
    note: '재저작물은 우리 저작이라 TTS 부착이 자유롭다 — 외부 소스로는 못 여는 활동.',
  },
  shadowing: {
    key: 'shadowing',
    label: '듣고 따라 말하기',
    module: 'EchoMatch',
    cost: 'mechanical',
    needs: ['text', 'audio'],
    note: 'TTS 음원 + 원문 정렬. VOA 30편 외에는 오디오가 없어 지금껏 닫혀 있던 자리.',
  },
  comprehension: {
    key: 'comprehension',
    label: '이해 문항',
    module: 'ScriptQuiz',
    cost: 'llm',
    needs: ['text'],
    note: '사실 확인·추론 문항. 의미 판단이 필요해 기계 변환으로 만들 수 없다.',
  },
  discussion: {
    key: 'discussion',
    label: '토론 질문',
    module: null,
    cost: 'llm',
    needs: ['text'],
    note: 'Engoo 3페이지 포맷의 3면. 교사 채널에서 값이 큰 산출물이지만 LLM 필요.',
  },
}

/** 기계 변환만 골라내기 — 재생성 예산을 계산할 때 쓴다. */
export function mechanicalActivities(): ActivitySpec[] {
  return Object.values(COMPOSE_ACTIVITIES).filter((a) => a.cost === 'mechanical')
}

export interface ActivityAvailability {
  spec: ActivitySpec
  available: boolean
  missing: ReadonlyArray<'text' | 'vocab' | 'audio'>
}

/** 지금 이 지문이 가진 자산으로 만들 수 있는 활동 목록. */
export function planActivities(have: {
  text: boolean
  vocab: boolean
  audio: boolean
}): ActivityAvailability[] {
  return Object.values(COMPOSE_ACTIVITIES).map((spec) => {
    const missing = spec.needs.filter((n) => !have[n])
    return { spec, available: missing.length === 0, missing }
  })
}

// ── 갭필 ─────────────────────────────────────────────────────────────

export interface GapBlank {
  /** 빈칸 번호 (1부터) */
  n: number
  /** 정답 — 본문에 있던 표면형 그대로 */
  answer: string
  /** 이 빈칸이 속한 문장 인덱스 (0부터) */
  sentenceIdx: number
}

export interface GapFillItem {
  /** 빈칸이 `____(n)` 으로 치환된 본문 */
  rendered: string
  blanks: GapBlank[]
  /** 목표 어휘 중 본문에서 못 찾아 빈칸이 되지 못한 것 */
  unmatched: string[]
}

export const GAPFILL_DEFAULTS = {
  /** 빈칸 총 상한. 너무 많으면 읽기가 아니라 퍼즐이 된다. */
  maxBlanks: 10,
  /**
   * 한 문장당 빈칸 1개. 두 개 이상이면 남은 문맥이 부족해져
   * 추론이 아니라 **추측**이 된다 (학습원칙 6 Cognitive Load).
   */
  maxPerSentence: 1,
  /**
   * 첫 문장은 비우지 않는다 — 도입부는 글 전체의 맥락을 세우는 자리라
   * 여기서 단어가 빠지면 이후 모든 추론의 근거가 사라진다.
   */
  skipFirstSentence: true,
} as const

/** 종결부호 뒤 공백 기준 문장 분할 (dcp/generate-items 와 같은 규칙). */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 목표 어휘를 빈칸으로 바꾼 본문 + 정답 키.
 *
 * 어휘당 **첫 등장 1회만** 비운다. 같은 단어를 여러 번 비우면 본문이 헐거워져
 * 문맥 단서가 사라지고, 학습자는 같은 답을 반복해 적는다(인출 1회 = 반복 아님).
 *
 * @param text    재저작 지문 본문
 * @param targets 목표 어휘의 **본문 표면형** (select_article_vocab 의 word). 순서 = 우선순위.
 */
export function buildGapFill(
  text: string,
  targets: ReadonlyArray<string>,
  opts: Partial<typeof GAPFILL_DEFAULTS> = {},
): GapFillItem {
  const cfg = { ...GAPFILL_DEFAULTS, ...opts }
  const sentences = splitSentences(text)
  const perSentence = new Map<number, number>()
  const blanks: GapBlank[] = []
  const unmatched: string[] = []
  const usedTargets = new Set<string>()

  for (const target of targets) {
    const key = target.toLowerCase()
    if (usedTargets.has(key)) continue
    if (blanks.length >= cfg.maxBlanks) {
      unmatched.push(target)
      continue
    }

    const re = new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i')
    let placed = false

    for (let si = 0; si < sentences.length; si++) {
      if (cfg.skipFirstSentence && si === 0) continue
      if ((perSentence.get(si) ?? 0) >= cfg.maxPerSentence) continue

      const m = sentences[si]!.match(re)
      if (!m) continue

      const n = blanks.length + 1
      const surface = m[0]!
      sentences[si] = sentences[si]!.replace(re, `____(${n})`)
      perSentence.set(si, (perSentence.get(si) ?? 0) + 1)
      blanks.push({ n, answer: surface, sentenceIdx: si })
      usedTargets.add(key)
      placed = true
      break
    }

    if (!placed) unmatched.push(target)
  }

  return { rendered: sentences.join(' '), blanks, unmatched }
}

// ── 철자 복원 ────────────────────────────────────────────────────────

export interface SpellingItem {
  /** 정답 단어 */
  answer: string
  /** 모음이 제거된 제시형 */
  prompt: string
  /** 제거된 글자 수 — 난이도 표시용 */
  removed: number
}

const VOWELS = /[aeiou]/gi

/**
 * 모음을 제거해 시각 단서를 줄인 철자 문항.
 *
 * 첫 글자와 마지막 글자는 남긴다 — 전부 지우면 재인이 아니라 순수 암기 시험이 되고,
 * 3글자 이하 단어는 남는 단서가 없어 아예 제외한다.
 */
export function buildSpellingItems(words: ReadonlyArray<string>): SpellingItem[] {
  const out: SpellingItem[] = []
  for (const w of words) {
    if (w.length <= 3) continue
    const head = w[0]!
    const tail = w[w.length - 1]!
    const middle = w.slice(1, -1).replace(VOWELS, '_')
    const prompt = head + middle + tail
    const removed = prompt.split('').filter((c) => c === '_').length
    if (removed === 0) continue // 모음이 가운데 없으면 문항이 성립하지 않는다
    out.push({ answer: w, prompt, removed })
  }
  return out
}
