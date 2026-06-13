// apps/web/src/lib/text/surface-match.ts
//
// 예문 문장 안에서 표제어(lemma)에 해당하는 실제 표면형(굴절 포함)을 찾는다.
// 단어장 예문이 원문 문장(굴절형 포함)으로 바뀌면서(v06.35), lemma whole-word 매칭만으론
// running / studies / baked 같은 굴절형을 놓친다 → 하이라이트 누락 · 플래시카드 빈칸 미삽입(=정답 노출).
//
// 규칙 기반 영어 굴절(규칙형 위주): 단순 접미(-s/-es/-ed/-ing/-d) + y→ies/ied + e-탈락 + 자음중복.
// 불규칙(go→went, run→ran)은 미매칭 → 호출부가 lemma 폴백/미표시로 graceful degrade.

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface SurfaceMatch {
  /** 문장에서 실제로 매칭된 표면형 (원문 casing 보존) */
  surface: string
  index: number
  length: number
}

/** lemma 의 굴절 후보 정규식 조각들 — 우선순위 순 (exact 우선). */
function inflectionPatterns(lemma: string): string[] {
  const w = lemma.trim()
  const e = esc(w)
  const pats: string[] = [e, `${e}(?:s|es|ed|ing|d)`]
  if (/[^aeiou]y$/i.test(w)) pats.push(`${esc(w.slice(0, -1))}(?:ies|ied|ying)`) // study→studies/studied
  if (/e$/i.test(w)) pats.push(`${esc(w.slice(0, -1))}(?:ing|ed|es)`) // make→making · bake→baked
  if (/[^aeiou][aeiou][^aeiouwxy]$/i.test(w)) pats.push(`${e}${esc(w.slice(-1))}(?:ed|ing)`) // run→running · stop→stopped
  return pats
}

/**
 * 문장에서 lemma 에 해당하는 표면형 첫 출현. exact 우선, 없으면 규칙형 굴절.
 * 못 찾으면 null (불규칙·부재).
 */
export function matchSurface(sentence: string, lemma: string): SurfaceMatch | null {
  const w = lemma.trim()
  if (!sentence || w.length < 2) return null
  for (const p of inflectionPatterns(w)) {
    const m = new RegExp(`\\b${p}\\b`, 'i').exec(sentence)
    if (m) return { surface: m[0], index: m.index, length: m[0].length }
  }
  return null
}

/**
 * 문장에서 학습 단어 표면형을 ___ 로 치환 (첫 1회). 굴절형까지 인식.
 * 표면형을 못 찾으면 원문 그대로 반환 (정답 노출은 피하되 깨지지 않음).
 */
export function blankSurface(sentence: string, lemma: string, blank = '___'): string {
  const m = matchSurface(sentence, lemma)
  if (!m) return sentence
  return sentence.slice(0, m.index) + blank + sentence.slice(m.index + m.length)
}
