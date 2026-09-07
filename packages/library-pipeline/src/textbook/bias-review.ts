// packages/library-pipeline/src/textbook/bias-review.ts
//
// **편향·차별 표현 검사 — 검정 교과서가 거치는 심사의 자리.**
//
// ── 이 검사가 하지 않는 것부터 ───────────────────────────────────────
// **판정하지 않는다.** 어떤 글이 편향적인지는 사람이 판단할 일이다 — 노예제·전쟁·장애를
// 다루는 지문은 그 낱말이 나온다는 이유로 걸러지면 안 되고, 반대로 낱말이 깨끗해도
// 서술이 편향될 수 있다. 기계가 할 수 있는 일은 **사람의 눈이 갈 자리를 좁히는 것**뿐이다.
//
// 그래서 산출물은 `pass/fail` 이 아니라 **검토 표시(`review`)** 다. 아무것도 지우지 않는다.
// 조용히 빼는 것이 걸러 내는 것보다 나쁘다 — 무엇이 왜 빠졌는지 아무도 모르게 된다.
//
// ── 검정 심사가 보는 축 (국내) ───────────────────────────────────────
// 교과서 편찬상의 유의점은 **양성평등 · 장애인 인식 · 다문화 · 지역·직업 편견**을 본다.
// 그중 기계로 **셀 수 있는** 것만 여기서 다룬다:
//
//   ① 비하·낡은 호칭   목록 대조 — 목록은 **주입받는다**(편집 판단이라 한곳에서 관리)
//   ② 성별 표시 직업어  chairman·stewardess 같은 것. 중립 대안이 문서화돼 있다
//   ③ 성별 대명사 균형  he/she 분포. **한 지문이 아니라 권 단위**로 본다 —
//                      한 사람을 다룬 글이 한쪽으로 기우는 것은 편향이 아니다
//
// 다문화·지역 편견은 낱말로 못 센다. 못 세는 것을 세는 척하지 않는다.

import { assessAnswerBias } from './item-health'

/** 검사 종류. */
export type BiasKind =
  /** 비하·낡은 호칭 — 주입된 목록과 대조. */
  | 'derogatory'
  /** 성별을 표시하는 직업어 — 중립 대안이 있다. */
  | 'gendered_occupation'
  /** 성별 대명사 쏠림 — 권 단위로만 뜻이 있다. */
  | 'pronoun_imbalance'

export interface BiasFinding {
  kind: BiasKind
  /** 지문에 실제로 있는 문자열. 없는 것을 인용하지 않는다. */
  cue: string
  /** 왜 사람이 봐야 하는가. */
  why: string
  /** 중립 대안이 있으면. 없으면 null — 대안이 없는 것도 사실이다. */
  alternative: string | null
}

/**
 * 성별을 표시하는 직업어와 중립 대안.
 *
 * **짐작한 목록이 아니라 문체 지침의 관례다** — AP·APA·UN 문서가 같은 짝을 권한다.
 * 다만 `actress` 처럼 **논쟁적인 것은 넣지 않았다**(당사자 선호가 갈린다).
 * 여기 있는 것도 "틀렸다" 가 아니라 "사람이 한 번 볼 자리" 라는 뜻이다.
 */
export const GENDERED_OCCUPATIONS: Readonly<Record<string, string>> = {
  chairman: 'chairperson · chair',
  chairwoman: 'chairperson · chair',
  policeman: 'police officer',
  policewoman: 'police officer',
  fireman: 'firefighter',
  firemen: 'firefighters',
  stewardess: 'flight attendant',
  mailman: 'mail carrier',
  postman: 'postal worker',
  salesman: 'salesperson',
  saleswoman: 'salesperson',
  spokesman: 'spokesperson',
  spokeswoman: 'spokesperson',
  businessman: 'businessperson',
  businessmen: 'businesspeople',
  congressman: 'member of congress',
  cameraman: 'camera operator',
  watchman: 'guard',
  foreman: 'supervisor',
  workmen: 'workers',
  housewife: 'homemaker',
  waitress: 'server',
  mankind: 'humankind · people',
  manpower: 'workforce · staff',
  'man-made': 'artificial · synthetic',
  freshman: 'first-year student',
}

/** 남성·여성 대명사. 균형을 보는 데만 쓴다. */
const MALE_PRONOUNS = ['he', 'him', 'his', 'himself'] as const
const FEMALE_PRONOUNS = ['she', 'her', 'hers', 'herself'] as const

/** 글을 낱말로 — 하이픈 낱말(`man-made`)을 살려야 해서 따로 쓴다. */
function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
}

/**
 * 지문 하나를 훑어 **사람이 볼 자리**를 찾는다.
 *
 * @param text 지문.
 * @param derogatory 비하·낡은 호칭 목록 — 낱말 → 사유. **주입받는다.**
 *   목록을 코드에 박지 않는 이유는 그것이 편집 판단이고, 한곳(사전 큐레이션)에서
 *   관리돼야 근거와 함께 갱신되기 때문이다.
 */
export function reviewPassage(
  text: string,
  derogatory: ReadonlyMap<string, string> = new Map(),
): BiasFinding[] {
  const out: BiasFinding[] = []
  const seen = new Set<string>()
  for (const w of tokens(text)) {
    if (seen.has(w)) continue
    seen.add(w)

    const reason = derogatory.get(w)
    if (reason) {
      out.push({ kind: 'derogatory', cue: w, why: reason, alternative: null })
      continue
    }
    const neutral = GENDERED_OCCUPATIONS[w]
    if (neutral) {
      out.push({
        kind: 'gendered_occupation',
        cue: w,
        why: '성별을 표시하는 직업어다. 중립 대안이 문체 지침에 있다.',
        alternative: neutral,
      })
    }
  }
  return out
}

export interface PronounBalance {
  male: number
  female: number
  /** 균등(50:50)과 유의하게 다른가. 자유도 1, 유의수준 0.05(χ² 임계 3.841). */
  imbalanced: boolean
  chi2: number
}

/**
 * 성별 대명사 균형 — **권 단위로만 본다.**
 *
 * ⚠️ 지문 하나가 한쪽으로 기우는 것은 편향이 아니다. 한 사람을 다룬 글은 당연히 그렇다.
 *   편향은 **여러 글을 모아 놓고 봤을 때** 드러난다 — 그래서 이 함수는 지문 여럿을 받는다.
 *
 * 임계값은 `item-health` 의 카이제곱 표를 그대로 쓴다 — 정답 번호 쏠림과 같은 도구다.
 * 비중이 아니라 카이제곱으로 보는 이유도 같다: 표본이 작으면 같은 비중도 뜻이 다르다.
 */
export function measurePronounBalance(passages: readonly string[]): PronounBalance {
  let male = 0
  let female = 0
  for (const p of passages) {
    for (const w of tokens(p)) {
      if ((MALE_PRONOUNS as readonly string[]).includes(w)) male++
      else if ((FEMALE_PRONOUNS as readonly string[]).includes(w)) female++
    }
  }
  const bias = assessAnswerBias([male, female])
  return { male, female, imbalanced: bias.biased, chi2: bias.chi2 }
}

export interface BiasReport {
  /** 검사한 지문 수. */
  passages: number
  /** 검토 표시가 붙은 지문 수. **전체가 아니라 이만큼만 사람이 보면 된다.** */
  flagged: number
  byKind: Record<BiasKind, number>
  pronouns: PronounBalance
  /** 가장 자주 걸린 표현 — 어디부터 손볼지. */
  topCues: { cue: string; kind: BiasKind; count: number }[]
}

/** 재고 전체를 훑는다. 아무것도 지우지 않고 **셀 뿐이다.** */
export function reviewStock(
  passages: readonly string[],
  derogatory: ReadonlyMap<string, string> = new Map(),
): BiasReport {
  const byKind: Record<BiasKind, number> = {
    derogatory: 0,
    gendered_occupation: 0,
    pronoun_imbalance: 0,
  }
  const cueCount = new Map<string, { kind: BiasKind; count: number }>()
  let flagged = 0

  for (const p of passages) {
    const findings = reviewPassage(p, derogatory)
    if (findings.length) flagged++
    for (const f of findings) {
      byKind[f.kind]++
      const prev = cueCount.get(f.cue)
      cueCount.set(f.cue, { kind: f.kind, count: (prev?.count ?? 0) + 1 })
    }
  }

  const pronouns = measurePronounBalance(passages)
  if (pronouns.imbalanced) byKind.pronoun_imbalance = 1

  return {
    passages: passages.length,
    flagged,
    byKind,
    pronouns,
    topCues: [...cueCount.entries()]
      .map(([cue, v]) => ({ cue, ...v }))
      .sort((a, b) => b.count - a.count || (a.cue < b.cue ? -1 : 1))
      .slice(0, 20),
  }
}
