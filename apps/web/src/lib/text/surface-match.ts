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
 * 문장에서 lemma 에 해당하는 표면형 첫(leftmost) 출현.
 *   knownForms (사전 DB `inflected_forms`) 가 주어지면 그 집합 ∪ {lemma} ∪ 규칙형 을 모두 후보로 →
 *   불규칙(was/were/been, went, saw…)까지 정확. knownForms 가 없으면 규칙형만(현행).
 * 못 찾으면 null (데이터·규칙 모두 미스 = 불규칙 미수록 등 → 호출부 graceful).
 */
export function matchSurface(
  sentence: string,
  lemma: string,
  knownForms?: string[] | null,
): SurfaceMatch | null {
  const w = lemma.trim()
  if (!sentence || w.length < 2) return null
  // 데이터 기반 literal 후보 (lemma + knownForms) — 긴 것 우선(부분매칭 방지)
  const literals = [...new Set(
    [w, ...(knownForms ?? [])].map((f) => f.trim().toLowerCase()).filter((f) => f.length >= 2),
  )].sort((a, b) => b.length - a.length)
  // 규칙형 패턴과 합쳐 단일 alternation → 문장 내 leftmost 출현을 잡는다
  const alts = [...literals.map(esc), ...inflectionPatterns(w)]
  const m = new RegExp(`\\b(?:${alts.join('|')})\\b`, 'i').exec(sentence)
  return m ? { surface: m[0], index: m.index, length: m[0].length } : null
}

/**
 * 문장에서 학습 단어 표면형을 ___ 로 치환 (첫 1회). 굴절형(knownForms 포함) 인식.
 * 표면형을 못 찾으면 원문 그대로 반환 (정답 노출은 피하되 깨지지 않음).
 */
export function blankSurface(
  sentence: string,
  lemma: string,
  knownForms?: string[] | null,
  blank = '___',
): string {
  const m = matchSurface(sentence, lemma, knownForms)
  if (!m) return sentence
  return sentence.slice(0, m.index) + blank + sentence.slice(m.index + m.length)
}
