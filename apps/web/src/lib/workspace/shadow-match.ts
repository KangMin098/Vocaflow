// apps/web/src/lib/workspace/shadow-match.ts
//
// 따라읽기(shadow) — 학습자 발화(음성 인식 transcript)와 목표 문장의 "느슨한" 일치 계산.
//
// 정책 (CLAUDE.md Calm UI · Empathetic Feedback):
//   - 채점이 아니라 "대략 따라왔는지" 만 판단. 정답률·감점 개념 없음.
//   - 구두점·대소문자·축약형 무시. 단어 집합 교집합 비율로 ratio 산출.
//   - matchedKeys 는 라이브 하이라이트용 (말하는 동안 맞춘 단어를 부드럽게 표시).
//
// 외부 의존 0 · 순수 함수 (단위 테스트 가능).

export interface ShadowMatch {
  /** 0..1 — 목표 단어 중 발화에서 인식된 비율 */
  ratio: number
  /** 매칭된 목표 단어의 정규화 키 집합 (하이라이트용) */
  matchedKeys: Set<string>
}

// 글자·숫자·공백·아포스트로피만 남기고 제거 (유니코드 안전)
const NON_WORD_RE = /[^\p{L}\p{N}\s']/gu

/** 단일 토큰 정규화 — 소문자 + 구두점 제거 + 양끝 아포스트로피 제거. */
export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(NON_WORD_RE, '')
    .replace(/^'+|'+$/g, '')
    .trim()
}

/** 문장 → 정규화된 단어 배열 (빈 토큰 제외). */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(NON_WORD_RE, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 0)
}

/**
 * 목표 문장과 발화 transcript 의 느슨한 일치.
 * ratio = (발화에 등장한 목표 단어 수) / (목표 단어 수).
 */
export function computeShadowMatch(target: string, transcript: string): ShadowMatch {
  const targetWords = tokenizeWords(target)
  if (targetWords.length === 0) return { ratio: 0, matchedKeys: new Set() }

  const heard = new Set(tokenizeWords(transcript))
  const matchedKeys = new Set<string>()
  let hit = 0
  for (const word of targetWords) {
    if (heard.has(word)) {
      matchedKeys.add(word)
      hit += 1
    }
  }
  return { ratio: hit / targetWords.length, matchedKeys }
}

export type ShadowTone = 'great' | 'good' | 'gentle'

/**
 * ratio → 격려 톤. 비난 없음 — 낮아도 "gentle" (다음으로 자연스럽게).
 *   great ≥ 0.7 · good ≥ 0.35 · 그 외 gentle.
 */
export function toneForRatio(ratio: number): ShadowTone {
  if (ratio >= 0.7) return 'great'
  if (ratio >= 0.35) return 'good'
  return 'gentle'
}
