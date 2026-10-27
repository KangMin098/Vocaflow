// apps/web/src/lib/scriptquiz/evidence.ts
// T-0193 — 채점 뒤 「근거 문장 짚기」. 서버가 돌려준 근거(source_snippet)를 본문 문장에서 찾고,
// 학습자가 고를 후보 4개(근거 1 + 같은 본문의 다른 문장 3)를 만든다.
//
// ⚠️ 채점 **뒤에만** 부른다. 근거는 gradeScriptQuizAnswer 가 그 문항 하나에 대해서만 돌려준다 —
//    이 함수가 채점 전에 불리면 근거 위치가 화면에 먼저 드러난다.
// ⚠️ 근거를 본문에서 못 찾으면 null 이다. 억지로 가장 비슷한 문장을 정답으로 세우지 않는다.

export interface EvidenceChoice {
  /** 화면 순서대로의 후보 문장 */
  sentences: string[]
  /** sentences 안에서 근거 문장의 위치 */
  evidenceIndex: number
}

/** 본문 → 문장. 줄바꿈 단락과 문장부호(따옴표가 뒤따르는 경우 포함)에서 자른다. */
export function splitSentences(passage: string): string[] {
  const out: string[] = []
  for (const para of passage.split(/\n+/)) {
    const parts = para.match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g) ?? []
    for (const p of parts) {
      const s = p.trim()
      if (s.length > 0) out.push(s)
    }
  }
  return out
}

/** 비교용 정규화 — 대소문자·따옴표·문장부호·공백 차이를 지운다. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_FRAGMENT = 12

/**
 * 근거 snippet 이 걸치는 본문 문장 인덱스들. snippet 은 `...` 로 일부를 생략하거나
 * 여러 문장에 걸칠 수 있다 — 생략부호로 쪼갠 조각마다 그 조각을 품은 문장을 모은다.
 */
export function locateEvidence(sentences: string[], snippet: string): number[] {
  const normSentences = sentences.map(normalizeForMatch)
  const fragments = snippet
    .split(/\.{3}|…/)
    .map(normalizeForMatch)
    .filter((f) => f.length >= MIN_FRAGMENT)
  const hits = new Set<number>()
  for (const frag of fragments) {
    normSentences.forEach((s, i) => {
      if (s.length === 0) return
      if (s.includes(frag) || (s.length >= MIN_FRAGMENT && frag.includes(s))) hits.add(i)
    })
  }
  return Array.from(hits).sort((a, b) => a - b)
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 후보 4개. 근거가 **본문의 한 문장에만** 걸칠 때만 만든다 — 여러 문장에 걸치거나 같은 문장이 반복되면
 * 「어느 한 문장」을 물을 수 없으므로 null(피커 없이 근거만 보여 준다).
 * ⚠️ 비교는 「등록된 근거 문장과 같은가」까지다. 방해 문장이 답을 뒷받침하지 않는다는 보장은 없다 —
 *    화면은 학습자의 선택을 틀렸다고 판정하지 않는다.
 * 근거는 snippet 이 걸친 문장, 방해 문장은 근거가 아닌 문장 중 길이가 비슷한 것을
 * 문항 id 로 정한 순서로 3개(같은 문항이면 늘 같은 후보 — 새로고침으로 답을 고르는 일을 막는다).
 * 근거를 못 찾거나 다른 문장이 3개 미만이면 null.
 */
export function buildEvidenceChoice(
  passage: string,
  snippet: string,
  questionId: string,
): EvidenceChoice | null {
  if (!passage.trim() || !snippet.trim()) return null
  const sentences = splitSentences(passage)
  const hits = locateEvidence(sentences, snippet)
  if (hits.length !== 1) return null
  const evidence = sentences[hits[0]]
  const hitSet = new Set(hits)
  const evidenceNorm = normalizeForMatch(evidence)
  // 같은 문장이 본문에 두 번 있으면 위치가 하나로 정해지지 않는다
  if (sentences.filter((s) => normalizeForMatch(s) === evidenceNorm).length > 1) return null
  const seen = new Set<string>([evidenceNorm])
  const pool: string[] = []
  sentences.forEach((s, i) => {
    const n = normalizeForMatch(s)
    if (hitSet.has(i) || seen.has(n) || n.split(' ').length < 4) return
    seen.add(n)
    pool.push(s)
  })
  if (pool.length < 3) return null
  const target = evidence.length
  const seed = hash(questionId)
  const ranked = pool
    .map((s) => ({ s, d: Math.abs(s.length - target), k: hash(`${seed}:${s}`) }))
    .sort((a, b) => a.d - b.d || a.k - b.k)
    .slice(0, Math.min(pool.length, 8))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map((x) => x.s)
  const evidenceIndex = seed % 4
  const choice = [...ranked]
  choice.splice(evidenceIndex, 0, evidence)
  return { sentences: choice, evidenceIndex }
}
