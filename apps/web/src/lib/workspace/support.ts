// apps/web/src/lib/workspace/support.ts
// 읽기-중 이해 지원(노이즈) 토큰. 학습 자산(Word)과 별개 — SRS·단어장 플로우 진입 금지.
// ADR 0002 (docs/adr/0002-rescue-first-noise-policy.md) 의 noise_blacklist 카테고리를
// 리더 표시용 3종으로 매핑: foreign_word / archaic_grammar / proper_noun.
// (interjection_noise 는 무표시 plain, corrupt 는 전처리에서 제거 — 리더 도달 X)

export type SupportCategory = 'foreign_word' | 'archaic_grammar' | 'proper_noun'

export interface SupportToken {
  /** 원문 표면형 */
  text: string
  category: SupportCategory
  /** 이해 지원 1줄 — foreign: 번역 / archaic: 현대형 환언 / proper: 엔티티 */
  gloss: string
  /** foreign 전용 — 언어 라벨 */
  lang?: string
  /** proper 전용 */
  entityKind?: 'person' | 'place' | 'other'
}

interface SupportEntry extends Omit<SupportToken, 'text'> {
  form: string
  /** 고유명사 등 대소문자 엄격 매칭 */
  caseSensitive?: boolean
}

export interface SupportSpan {
  start: number
  end: number
  support: SupportToken
}

// 향후: noise_blacklist(foreign/archaic) + archaic_candidates(person_noise/geo_noise) 에서
// 도서별 주입. 지금은 mock — 개념 검증용 (Concept → mock → DB).
export const SUPPORT_LEXICON: SupportEntry[] = [
  { form: 'monsieur', category: 'foreign_word', lang: '프랑스어', gloss: '"~씨 / 선생님" — 남성에 대한 프랑스어 경칭.' },
  { form: 'mordieu', category: 'foreign_word', lang: '프랑스어', gloss: '"제기랄" — 옛 프랑스어 감탄/욕설.' },
  { form: 'hadst', category: 'archaic_grammar', gloss: '현대형 "had" — 옛 2인칭 단수 (thou hadst).' },
  { form: 'mayst', category: 'archaic_grammar', gloss: '현대형 "may" — 옛 2인칭 단수 (thou mayst).' },
  { form: 'Gatsby', category: 'proper_noun', entityKind: 'person', gloss: '인물 — 이 작품의 주인공.', caseSensitive: true },
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** plain text 안에서 지원 어휘 위치를 스팬으로 반환 (part 타입 비의존 — 단방향 import 유지). */
export function findSupportSpans(text: string, lexicon: SupportEntry[] = SUPPORT_LEXICON): SupportSpan[] {
  if (lexicon.length === 0) return []
  const byForm = new Map<string, SupportEntry>()
  for (const e of lexicon) byForm.set(e.form.toLowerCase(), e)
  const forms = [...lexicon]
    .sort((a, b) => b.form.length - a.form.length)
    .map((e) => escapeRe(e.form))
  const re = new RegExp(`\\b(${forms.join('|')})\\b`, 'gi')

  const spans: SupportSpan[] = []
  for (const m of text.matchAll(re)) {
    const surface = m[0]
    const entry = byForm.get(surface.toLowerCase())
    if (!entry) continue
    if (entry.caseSensitive && surface !== entry.form) continue
    const start = m.index ?? 0
    spans.push({
      start,
      end: start + surface.length,
      support: {
        text: surface,
        category: entry.category,
        gloss: entry.gloss,
        ...(entry.lang ? { lang: entry.lang } : {}),
        ...(entry.entityKind ? { entityKind: entry.entityKind } : {}),
      },
    })
  }
  return spans
}
