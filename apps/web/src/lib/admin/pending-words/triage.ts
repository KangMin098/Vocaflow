// apps/web/src/lib/admin/pending-words/triage.ts
//
// pending_words 백로그 분류 — "이 항목에 무슨 조치를 해야 하는가".
//
// v06.35 에서 이 큐의 시맨틱이 바뀌었다. 예전엔 "추출 결과에 없는 단어" 를 전부 받아
// 92.5% 가 오탐이었지만, 지금은 `resolve_dict_headword` 5계층이 **해석에 실패한 것만** 받는다.
// 신호는 깨끗해졌는데, 그 안에 **성격이 다른 항목이 섞여** 있어 평평한 목록으로는
// 관리자가 조치를 판단할 수 없다:
//
//   · sorbents      → 진짜로 사전에 없다. 등재하면 된다.
//   · unglamorous   → 어기(glamorous)는 있다. 뜻이 뒤집혀 **일부러** 해석하지 않는 것 —
//                     등재하려면 파생형 자체를 표제어로 넣어야 한다.
//   · optimize      → 영국식(optimise)이 있는데 해석 못 했다면 **철자 변이 매핑의 구멍**이다.
//                     사전 등재가 아니라 resolve_dict_headword 를 고쳐야 한다.
//   · machine-learning → 부분이 이미 해석된다. 사전에 넣을 이유가 없는 노이즈.
//
// 분류가 없으면 셋을 같은 방식으로 처리하게 되고, 그건 사전을 오염시킨다.
//
// 순수 함수로 분리한 이유: 사전 조회는 호출부가 배치로 하고(N+1 회피), 판정 규칙만
// 여기서 테스트 가능하게 고정한다.

export type PendingBucket =
  /** 부분이 이미 해석되는 하이픈 전체형 — 등재 불필요 */
  | 'hyphen_compound'
  /** 영/미 철자 변이가 사전에 있음 — 해석기(resolve_dict_headword) 쪽 구멍 */
  | 'spelling_variant'
  /** 어기는 사전에 있는 파생형 — 뜻 반전 때문에 의도적으로 미해석. 등재하려면 표제어 추가 */
  | 'derived_form'
  /** 위 어디에도 안 걸림 — 진짜 사전 갭. 등재 1순위 */
  | 'genuine_gap'

export const BUCKET_META: Record<
  PendingBucket,
  { label: string; action: string; priority: number }
> = {
  genuine_gap: {
    label: '진성 갭',
    action: '사전에 등재 — 이 큐의 본래 목적',
    priority: 0,
  },
  derived_form: {
    label: '파생형',
    action: '어기는 있음. 뜻이 뒤집혀 일부러 해석 안 함 — 표제어로 넣을지 판단',
    priority: 1,
  },
  spelling_variant: {
    label: '철자 변이',
    action: '해석기 구멍 — 사전 등재가 아니라 resolve_dict_headword 를 고칠 것',
    priority: 2,
  },
  hyphen_compound: {
    label: '하이픈 노이즈',
    action: '부분이 이미 해석됨 — 등재 불필요',
    priority: 3,
  },
}

/** 극성을 뒤집는 접두사 — resolve_dict_headword 가 의도적으로 해석하지 않는 것들 */
const NEGATING_PREFIXES = ['un', 'mis', 'non', 'dis', 'ir', 'im', 'il', 'anti']

/** 미국식 → 영국식 철자 (resolve_dict_headword L5 와 같은 매핑) */
function spellingVariants(w: string): string[] {
  const out: string[] = []
  const push = (re: RegExp, rep: string) => {
    if (re.test(w)) out.push(w.replace(re, rep))
  }
  push(/izations$/, 'isations')
  push(/ization$/, 'isation')
  push(/izing$/, 'ising')
  push(/ized$/, 'ised')
  push(/izes$/, 'ises')
  push(/ize$/, 'ise')
  push(/yzing$/, 'ysing')
  push(/yzed$/, 'ysed')
  push(/yze$/, 'yse')
  push(/ors$/, 'ours')
  push(/or$/, 'our')
  push(/logs$/, 'logues')
  push(/log$/, 'logue')
  push(/ense$/, 'ence')
  push(/ters$/, 'tres')
  push(/ter$/, 'tre')
  return out.filter((c) => c.length >= 4)
}

/** 극성 반전 파생의 어기 후보 (-less · 부정 접두사) */
function derivedBases(w: string): string[] {
  const out: string[] = []
  if (/iless$/.test(w)) out.push(w.replace(/iless$/, 'y'))
  if (/less$/.test(w)) out.push(w.replace(/less$/, ''))
  for (const p of NEGATING_PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 4) out.push(w.slice(p.length))
  }
  return out.filter((c) => c.length >= 3)
}

/** 하이픈 전체형의 부분들 */
function hyphenParts(w: string): string[] {
  if (!w.includes('-')) return []
  return w.split('-').filter((p) => p.length >= 2)
}

/**
 * 이 lemma 를 분류하려면 사전에 물어봐야 할 단어들.
 * 호출부가 전체 행의 후보를 모아 **한 번의 배치 질의**로 조회한다.
 *
 * ⚠️ 조회는 `shared_dictionary` 직접 존재가 아니라 **`unresolved_dict_words` 로
 * 해석 가능성**을 물어야 한다. 표제어 직접 존재로 검사하면 굴절형이 전부 미스난다 —
 * 실측: "kilowatt-hours" 의 `hours`, "mislabeled" 의 `labeled` 가 표제어가 아니라
 * 각각 하이픈 노이즈·파생형이 진성 갭으로 오분류됐다.
 */
export function triageCandidates(lemma: string): string[] {
  const w = lemma.trim().toLowerCase()
  if (!w) return []
  return [...new Set([...hyphenParts(w), ...spellingVariants(w), ...derivedBases(w)])]
}

/**
 * 최종 분류. `resolvable` 은 triageCandidates 로 모은 후보 중
 * **`resolve_dict_headword` 가 해석해 내는** 것들 (표제어 직접 존재가 아니다).
 *
 * 우선순위: 하이픈 노이즈 → 철자 변이(해석기 버그) → 파생형 → 진성 갭.
 * 하이픈을 먼저 보는 이유는, 하이픈 전체형이 다른 규칙에도 걸릴 수 있기 때문이다
 * (예: "self-organize" 는 철자 변이 규칙에도 걸린다 — 그래도 본질은 하이픈 노이즈다).
 */
export function classifyPending(lemma: string, resolvable: Set<string>): PendingBucket {
  const w = lemma.trim().toLowerCase()

  const parts = hyphenParts(w)
  if (parts.length >= 2 && parts.every((p) => resolvable.has(p))) return 'hyphen_compound'

  if (spellingVariants(w).some((c) => resolvable.has(c))) return 'spelling_variant'
  if (derivedBases(w).some((c) => resolvable.has(c))) return 'derived_form'

  return 'genuine_gap'
}
