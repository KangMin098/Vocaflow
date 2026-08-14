// apps/web/src/lib/vcb/compose/organize.ts
//
// 조직(목차) — 기존 어드민 위저드에 통째로 없던 단.
//
// 지금 위저드는 평면 필터 → 정렬 → 개수 제한뿐이다. 그래서 **목차가 필터로 표현되지 않는 유형**
// (어원 챕터 · 의미장 · 짝 대조 · N일 완성)은 어드민에서 만들 수 없었다. 시중 단어장의 절반이
// 그쪽이므로, 여기서 그 절반이 열린다.
//
// 전부 순수 함수 — DB 없이 테스트된다.

import type {
  CandidateWord,
  ComposedEntry,
  ComposedGroup,
  GroupBy,
  OrganizeSpec,
  OrderWithin,
} from './types'

// ── 분류 실패 판정 ──────────────────────────────────────────────────
//
// '미상 / 짝없음' 그룹은 **분류가 실패한 자리**다. 평가기와 컴포저가 같은 판정을 써야 하므로
// (두 곳에 두면 한 곳만 고쳐지는 날이 온다) 여기서 한 번만 정의한다.

const UNGROUPED_MARKERS = ['none', 'solo:', ':none', 'day:pending']

export function isUngroupedKey(key: string): boolean {
  if (key === 'all') return false
  return UNGROUPED_MARKERS.some((k) => key.startsWith(k) || key.endsWith(k))
}

// ── 그룹 키 도출 ────────────────────────────────────────────────────

interface GroupAssignment {
  key: string
  label: string
  /** 그룹 정렬용 보조값 (root 생산성 · 카테고리 sort_order 등) */
  rank?: number
}

const V_LEVEL_LABEL = (v: number | null): string => (v == null ? '레벨 미정' : `V${v}`)

const POS_LABEL: Record<string, string> = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  idiom: '관용어',
  phrasal_verb: '구동사',
  preposition: '전치사',
  pronoun: '대명사',
  conjunction: '접속사',
  determiner: '한정사',
  interjection: '감탄사',
  number: '수사',
}

/** 편집거리 1 이하인가 — 혼동어 군집의 판정. 길이 차 2 이상이면 즉시 탈락. */
export function isNearSpelling(a: string, b: string): boolean {
  if (a === b) return false
  if (Math.abs(a.length - b.length) > 1) return false

  if (a.length === b.length) {
    let diff = 0
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        diff += 1
        if (diff > 1) return false
      }
    }
    return diff === 1
  }

  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let skipped = false
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1
      j += 1
      continue
    }
    if (skipped) return false
    skipped = true
    j += 1
  }
  return true
}

/**
 * 혼동군 — 동음이의(`homophones`) + 편집거리 1 + 같은 라임을 하나의 군으로 묶는다.
 *
 * 군의 대표는 사전순 첫 단어로 고정한다(안정적인 그룹 키가 필요하므로).
 * 짝이 없는 단어는 `solo:` 키를 받고, 평가기가 그것을 `blueprint_fit` 감점으로 잡는다 —
 * 혼동어 단어장에 짝 없는 단어가 섞이는 것이 그 유형의 가장 흔한 실패다.
 */
export function buildConfusableGroups(candidates: CandidateWord[]): Map<string, GroupAssignment> {
  const words = candidates.map((c) => c.word.toLowerCase())
  const index = new Map<string, number>()
  words.forEach((w, i) => index.set(w, i))

  // union-find
  const parent = words.map((_, i) => i)
  const find = (x: number): number => {
    let r = x
    while (parent[r] !== r) r = parent[r]!
    let cur = x
    while (parent[cur] !== cur) {
      const next = parent[cur]!
      parent[cur] = r
      cur = next
    }
    return r
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  // ① 동음이의 — 사전이 직접 들고 있는 짝
  candidates.forEach((c, i) => {
    for (const h of c.homophones) {
      const j = index.get(h.toLowerCase())
      if (j !== undefined) union(i, j)
    }
  })

  // ② 편집거리 1 — **삭제 이웃(deletion neighborhood)** 으로 버킷을 나눈다.
  //
  // 첫 글자 + 길이로 버킷을 나누면 첫 글자가 바뀌는 짝(affect/effect)이 서로 다른 버킷에 떨어져
  // 영원히 만나지 않는다. 한 글자를 뺀 형태를 키로 쓰면 치환·삽입·삭제 세 경우가 모두
  // 적어도 하나의 키를 공유하므로(affect·effect → 'ffect', dessert → 'desert') 누락이 없고,
  // 비교는 같은 키 안에서만 일어나 O(n²) 도 피한다.
  const buckets = new Map<string, number[]>()
  const addKey = (key: string, i: number): void => {
    const b = buckets.get(key)
    if (b) b.push(i)
    else buckets.set(key, [i])
  }
  words.forEach((w, i) => {
    addKey(w, i)
    for (let p = 0; p < w.length; p += 1) addKey(w.slice(0, p) + w.slice(p + 1), i)
  })
  for (const bucket of buckets.values()) {
    const uniq = [...new Set(bucket)]
    for (let x = 0; x < uniq.length; x += 1) {
      for (let y = x + 1; y < uniq.length; y += 1) {
        if (isNearSpelling(words[uniq[x]!]!, words[uniq[y]!]!)) union(uniq[x]!, uniq[y]!)
      }
    }
  }

  // ③ 같은 라임 — 소리 혼동. 군이 너무 커지지 않게 라임은 편집거리 군을 합치기만 한다
  const byRhyme = new Map<string, number[]>()
  candidates.forEach((c, i) => {
    if (!c.rhyme_key) return
    const b = byRhyme.get(c.rhyme_key)
    if (b) b.push(i)
    else byRhyme.set(c.rhyme_key, [i])
  })
  for (const idxs of byRhyme.values()) {
    if (idxs.length < 2 || idxs.length > 6) continue
    for (let x = 1; x < idxs.length; x += 1) union(idxs[0]!, idxs[x]!)
  }

  const members = new Map<number, number[]>()
  words.forEach((_, i) => {
    const r = find(i)
    const list = members.get(r)
    if (list) list.push(i)
    else members.set(r, [i])
  })

  const out = new Map<string, GroupAssignment>()
  for (const [root, idxs] of members) {
    const groupWords = idxs.map((i) => words[i]!).sort()
    const rep = groupWords[0]!
    const solo = idxs.length < 2
    for (const i of idxs) {
      out.set(words[i]!, {
        key: solo ? `solo:${words[i]}` : `pair:${rep}`,
        label: solo ? `짝 없음 — ${words[i]}` : groupWords.join(' / '),
        rank: idxs.length,
      })
    }
    void root
  }
  return out
}

/** 파생 family — base_word 가 있으면 그것, 없으면 자기 자신이 기본형이다. */
function familyKey(c: CandidateWord): string {
  return (c.base_word ?? c.word).toLowerCase()
}

/**
 * 후보 하나의 그룹 배정. `group_keys`(roots/topics 해석기가 채움)가 있으면 그것을 우선한다 —
 * 어근·주제는 DB 관계이므로 여기서 추측하지 않는다.
 */
function assign(c: CandidateWord, groupBy: GroupBy, confusable: Map<string, GroupAssignment>): GroupAssignment {
  switch (groupBy) {
    case 'none':
      return { key: 'all', label: '전체' }
    case 'root': {
      const g = (c.group_keys ?? []).find((k) => k.key.startsWith('root:'))
      return g ? { key: g.key, label: g.label, rank: g.rank } : { key: 'root:none', label: '어근 미상' }
    }
    case 'topic': {
      const g = (c.group_keys ?? []).find((k) => k.key.startsWith('topic:'))
      return g ? { key: g.key, label: g.label, rank: g.rank } : { key: 'topic:none', label: '주제 미상' }
    }
    case 'source_chapter': {
      const ch = c.corpus_chapter
      return ch == null
        ? { key: 'chapter:none', label: '챕터 미상' }
        : { key: `chapter:${ch}`, label: `${ch}장`, rank: ch }
    }
    case 'family':
      return { key: `family:${familyKey(c)}`, label: familyKey(c) }
    case 'pos': {
      const pos = c.primary_pos ?? c.pos ?? 'unknown'
      return { key: `pos:${pos}`, label: POS_LABEL[pos] ?? pos }
    }
    case 'v_level':
      return {
        key: `v:${c.v_level ?? 'na'}`,
        label: V_LEVEL_LABEL(c.v_level),
        rank: c.v_level ?? 99,
      }
    case 'cefr':
      return { key: `cefr:${c.cefr_level ?? 'na'}`, label: c.cefr_level ?? 'CEFR 미정' }
    case 'freq_band':
      return { key: `freq:${c.frequency_band ?? 'na'}`, label: c.frequency_band ?? '빈도 미정' }
    case 'confusable':
      return confusable.get(c.word.toLowerCase()) ?? { key: `solo:${c.word}`, label: `짝 없음 — ${c.word}` }
    case 'collocation_hub': {
      // 연어의 첫 낱말(주로 동사·명사 축)이 허브다 — "make a decision" 의 make.
      const first = c.collocations[0]?.split(/\s+/)[0]?.toLowerCase()
      return first
        ? { key: `hub:${first}`, label: `${first} 와 어울리는 말` }
        : { key: 'hub:none', label: '연어 미상' }
    }
    case 'synonym_cluster': {
      // 군의 대표는 사전순 최소 — 같은 군이 매번 같은 키를 받아야 한다.
      const family = [c.word.toLowerCase(), ...c.synonyms.map((s) => s.toLowerCase())].sort()
      return { key: `syn:${family[0]}`, label: `${family[0]} 계열` }
    }
    case 'sense':
      return {
        key: `sense:${Math.min(c.sense_count, 5)}`,
        label: c.sense_count >= 5 ? '뜻 5개 이상' : `뜻 ${c.sense_count}개`,
        rank: -Math.min(c.sense_count, 5),
      }
    case 'rhyme':
      return c.rhyme_key
        ? { key: `rhyme:${c.rhyme_key}`, label: `-${c.rhyme_key} 라임` }
        : { key: 'rhyme:none', label: '라임 미상' }
    case 'day':
      // 페이싱은 순서가 정해진 뒤에 잘라야 하므로 여기서는 배정하지 않는다.
      return { key: 'day:pending', label: '' }
    default:
      return { key: 'all', label: '전체' }
  }
}

// ── 정렬 ────────────────────────────────────────────────────────────

function comparator(order: OrderWithin): (a: CandidateWord, b: CandidateWord) => number {
  switch (order) {
    case 'frequency':
      return (a, b) =>
        (a.frequency_rank ?? Number.MAX_SAFE_INTEGER) - (b.frequency_rank ?? Number.MAX_SAFE_INTEGER) ||
        a.word.localeCompare(b.word)
    case 'v_level':
      return (a, b) => (a.v_level ?? 99) - (b.v_level ?? 99) || a.word.localeCompare(b.word)
    case 'alpha':
      return (a, b) => a.word.localeCompare(b.word)
    case 'unlock_yield':
      return (a, b) => (b.corpus_freq ?? 0) - (a.corpus_freq ?? 0) || a.word.localeCompare(b.word)
    case 'recycle_soon':
      return (a, b) => (b.future_encounters ?? 0) - (a.future_encounters ?? 0) || a.word.localeCompare(b.word)
    case 'sense_count':
      return (a, b) => b.sense_count - a.sense_count || a.word.localeCompare(b.word)
    case 'as_selected':
      return () => 0
    default:
      return () => 0
  }
}

// ── 조직 실행 ───────────────────────────────────────────────────────

/**
 * 후보 목록을 목차로 바꾼다.
 *
 * 순서가 중요하다: **그룹 배정 → 그룹 내 정렬 → 그룹 cap → 그룹 정렬 → (페이싱이면 재분할)**.
 * cap 을 정렬 전에 적용하면 "어근당 상위 10개" 가 무작위 10개가 된다 — 기존 스크립트가
 * per_root_cap 을 정렬 후에 적용하고 있어서 같은 순서를 유지한다.
 */
export function organize(
  candidates: CandidateWord[],
  spec: OrganizeSpec,
): { groups: ComposedGroup[]; entries: ComposedEntry[]; dropped: Record<string, number> } {
  const dropped: Record<string, number> = {}
  const cmp = comparator(spec.order_within)

  const usePacing = spec.group_by === 'day' && spec.pacing != null

  // day 페이싱은 전체 순서를 먼저 정한 뒤 잘라야 한다.
  if (usePacing) {
    const pacing = spec.pacing!
    const ordered = [...candidates].sort(cmp)
    const capacity = pacing.days * pacing.per_day
    const kept = ordered.slice(0, capacity)
    if (ordered.length > kept.length) dropped['pacing_overflow'] = ordered.length - kept.length

    const groups: ComposedGroup[] = []
    for (let d = 0; d < pacing.days; d += 1) {
      const slice = kept.slice(d * pacing.per_day, (d + 1) * pacing.per_day)
      if (slice.length === 0) break
      groups.push({
        key: `day:${d + 1}`,
        label: `${d + 1}일차`,
        entries: slice.map((c, i) => ({
          word: c.word,
          sort_order: d * pacing.per_day + i,
          group_key: `day:${d + 1}`,
          group_label: `${d + 1}일차`,
          candidate: c,
        })),
      })
    }
    return { groups, entries: groups.flatMap((g) => g.entries), dropped }
  }

  const confusable =
    spec.group_by === 'confusable' ? buildConfusableGroups(candidates) : new Map<string, GroupAssignment>()

  const byKey = new Map<string, { label: string; rank?: number; items: CandidateWord[] }>()
  for (const c of candidates) {
    const a = assign(c, spec.group_by, confusable)
    const g = byKey.get(a.key)
    if (g) g.items.push(c)
    else byKey.set(a.key, { label: a.label, rank: a.rank, items: [c] })
  }

  // 짝 유형은 짝이 흩어지면 유형 자체가 무너지므로 cap 을 짝 단위로만 적용한다.
  const groupsRaw = [...byKey.entries()].map(([key, g]) => {
    const sorted = [...g.items].sort(cmp)
    const cap = spec.group_cap
    const capped = cap != null && !spec.keep_pairs_together ? sorted.slice(0, cap) : sorted
    if (capped.length < sorted.length) {
      dropped['group_cap'] = (dropped['group_cap'] ?? 0) + (sorted.length - capped.length)
    }
    return { key, label: g.label, rank: g.rank, items: capped }
  })

  const groupCmp = (
    a: { key: string; label: string; rank?: number; items: CandidateWord[] },
    b: { key: string; label: string; rank?: number; items: CandidateWord[] },
  ): number => {
    switch (spec.group_order) {
      case 'size_desc':
        return b.items.length - a.items.length || a.key.localeCompare(b.key)
      case 'alpha':
        return a.label.localeCompare(b.label)
      case 'v_level':
        return (a.rank ?? 99) - (b.rank ?? 99) || a.key.localeCompare(b.key)
      case 'source_order':
        return (a.rank ?? 0) - (b.rank ?? 0) || a.key.localeCompare(b.key)
      default:
        return 0
    }
  }

  groupsRaw.sort(groupCmp)

  // 크기 미달 그룹 버리기 — 짝 유형의 정의를 지킨다.
  const minSize = spec.min_group_size ?? null
  const surviving =
    minSize == null
      ? groupsRaw
      : groupsRaw.filter((g) => {
          const ok = g.items.length >= minSize && !isUngroupedKey(g.key)
          if (!ok) dropped['undersized_group'] = (dropped['undersized_group'] ?? 0) + g.items.length
          return ok
        })

  let order = 0
  const groups: ComposedGroup[] = surviving.map((g) => ({
    key: g.key,
    label: g.label,
    entries: g.items.map((c) => ({
      word: c.word,
      sort_order: order++,
      group_key: g.key,
      group_label: g.label,
      candidate: c,
    })),
  }))

  return { groups, entries: groups.flatMap((g) => g.entries), dropped }
}
