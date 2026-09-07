// packages/library-pipeline/src/textbook/proofread.ts
//
// **교정 재교·삼교 — 상업 교재 8단계 중 5번.**
//
// ── 왜 필요한가 (2026-08-30 실측) ───────────────────────────────────
// 5단계 교정은 세 번 훑는 자리인데 **초교만 기계가 보고 있었다**
// (`isPrintablePassage` = 인용 잔해 + 용어풀이). 재교(오탈자·구두점)와
// 삼교(표기 일관성)는 아무도 보지 않았다.
//
// 저장 지문 4,656편을 재니 **166편(3.57%)에 표기 결함**이 있었다 —
// 따옴표 혼용 69 · 구두점 앞 공백 53 · `-ise/-ize` 혼용 7 · 대시 혼용 3.
// 낱낱은 작지만 **한 권 안에서 섞이면 교재가 아니라 출력물로 보인다.**
//
// ── 왜 "표시" 이지 "수정" 이 아닌가 ──────────────────────────────────
// 지문은 원문 개작이라 기계가 고치면 안 된다(§8단계 5번 `storage` 메모).
// 여기서는 자리를 짚어 주기만 하고, 고칠지는 사람이 정한다.
//
// ── 겹치지 않게 ────────────────────────────────────────────────────
// 인용 잔해(`[12]` · `et al.`)와 용어풀이는 **초교**(`csat-format.ts` 의
// `isPrintablePassage`) 몫이다. 여기서 다시 보지 않는다 — 두 곳에서 같은 것을
// 판정하면 규칙이 갈라졌을 때 어느 쪽이 맞는지 알 수 없게 된다.

/** 교정 회차. 초교는 `isPrintablePassage` 가 본다. */
export type ProofStage = '재교' | '삼교'

export interface ProofFinding {
  /** 규칙 id — 리포트에서 유형별로 세는 데 쓴다. */
  rule: string
  stage: ProofStage
  /** 실제로 발견된 자리. 사람이 눈으로 확인할 수 있어야 한다. */
  found: string
  /** 무엇을 어느 쪽으로 맞추나. */
  hint: string
}

/** 앞뒤를 잘라 자리를 보여 준다. 통째로 실으면 리포트가 안 읽힌다. */
function around(text: string, at: number, len: number, pad = 24): string {
  const start = Math.max(0, at - pad)
  const end = Math.min(text.length, at + len + pad)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}

/**
 * `-ise/-ize` 가 **둘 다 쓰이는 어간**만 담는다.
 *
 * `wise`·`precise`·`exercise` 는 -ise 로 끝나지만 변이형이 아니고,
 * `size`·`prize` 도 마찬가지다. 어간 목록 없이 어미만 보면 이것들이 전부 오탐이 된다.
 */
const ISE_IZE_STEMS = [
  'organ', 'real', 'recogn', 'emphas', 'critic', 'minim', 'maxim', 'summar',
  'categor', 'character', 'special', 'util', 'apolog', 'memor', 'prior',
  'author', 'central', 'civil', 'colon', 'special', 'normal', 'social',
  'stabil', 'symbol', 'visual', 'modern', 'legal', 'general', 'formal',
] as const

/** 미국/영국 철자 어느 쪽으로 쓰였는지 센다. */
function spellingConventions(text: string): { ize: string[]; ise: string[] } {
  const ize: string[] = []
  const ise: string[] = []
  for (const stem of ISE_IZE_STEMS) {
    const z = new RegExp(`\\b${stem}(ize|ized|izes|izing|ization)\\b`, 'gi')
    const s = new RegExp(`\\b${stem}(ise|ised|ises|ising|isation)\\b`, 'gi')
    for (const m of text.matchAll(z)) ize.push(m[0])
    for (const m of text.matchAll(s)) ise.push(m[0])
  }
  return { ize, ise }
}

/** 같은 낱말이 붙어 나와도 정상인 것들. 이걸 빼지 않으면 오탐이 난다. */
const DOUBLABLE = new Set(['had', 'that', 'is', 'is,', 'no', 'so'])

/**
 * 재교 — 한 자리만 보면 아는 것(오탈자·구두점).
 * 문장 단위로 보므로 어느 문장인지 그대로 짚을 수 있다.
 */
function secondPass(sentences: readonly string[]): ProofFinding[] {
  const out: ProofFinding[] = []
  for (const s of sentences) {
    for (const m of s.matchAll(/[A-Za-z] +([,.;:!?])/g)) {
      // 말줄임표는 앞에 공백을 두는 것이 정상이다 — `opinions ... it's` 를 결함으로
      // 잡으면 안 된다(2026-08-30 실측 표본에서 오탐으로 드러났다).
      const after = s.slice((m.index ?? 0) + m[0].length)
      if (m[1] === '.' && (after.startsWith('.') || after.startsWith('…'))) continue
      out.push({
        rule: 'space_before_punct',
        stage: '재교',
        found: around(s, m.index ?? 0, m[0].length),
        hint: `구두점 "${m[1]}" 앞의 공백을 지운다.`,
      })
    }
    for (const m of s.matchAll(/\S(  +)\S/g)) {
      out.push({
        rule: 'double_space',
        stage: '재교',
        found: around(s, m.index ?? 0, m[0].length),
        hint: '연속 공백을 하나로 줄인다.',
      })
    }
    for (const m of s.matchAll(/\b(\w+)\s+\1\b/gi)) {
      const word = m[1] ?? ''
      if (DOUBLABLE.has(word.toLowerCase())) continue
      // 대문자로 시작하면 **고유명사가 실제로 겹친 이름**일 수 있다 —
      // 실측에서 `Durand Durand`(Barbarella 악당 이름)가 이렇게 걸렸다.
      // 지우라고 단정하지 않고 사람이 확인하도록 말을 바꾼다.
      const proper = /^[A-Z]/.test(word)
      out.push({
        rule: 'repeated_word',
        stage: '재교',
        found: around(s, m.index ?? 0, m[0].length),
        hint: proper
          ? `"${word}" 가 두 번 붙어 있다 — 겹친 이름인지 중복인지 확인한다.`
          : `"${word}" 가 두 번 붙어 있다 — 하나를 지운다.`,
      })
    }
  }

  // 괄호는 **글 전체로** 센다. 문장마다 세면 `Some bacteria (e.g. Bacillus)` 처럼
  // 문장 분리기가 `e.g.` 에서 끊은 자리가 전부 오탐이 된다(2026-08-30 실측에서
  // `unbalanced_paren` 54건 중 대부분이 이것이었다).
  const body = sentences.join(' ')
  const open = (body.match(/\(/g) ?? []).length
  const close = (body.match(/\)/g) ?? []).length
  if (open !== close) {
    out.push({
      rule: 'unbalanced_paren',
      stage: '재교',
      found: `여는 괄호 ${open}개 · 닫는 괄호 ${close}개`,
      hint: '괄호 짝이 맞지 않는다 — 잘려 나간 자리가 있는지 본다.',
    })
  }
  return out
}

/**
 * 삼교 — **글 전체를 봐야** 아는 것(표기 일관성).
 * 한 문장만 보면 어느 쪽도 틀리지 않았다. 섞였다는 사실이 결함이다.
 */
function thirdPass(sentences: readonly string[]): ProofFinding[] {
  const body = sentences.join(' ')
  const out: ProofFinding[] = []

  // 아포스트로피와 큰따옴표를 **따로** 본다. 한 뭉치로 세면
  // `we’ve` (굽은 아포스트로피) 와 `"quote"` (곧은 큰따옴표)가 같이 있다는 이유로
  // 결함이 되는데, 정작 고쳐야 할 자리는 같은 종류끼리 섞인 곳이다.
  const curlyApos = (body.match(/[‘’]/g) ?? []).length
  const straightApos = (body.match(/'/g) ?? []).length
  if (curlyApos && straightApos) {
    out.push({
      rule: 'apostrophe_style',
      stage: '삼교',
      found: `굽은 ’ ${curlyApos}개 · 곧은 ' ${straightApos}개`,
      hint: '아포스트로피를 한쪽 모양으로 맞춘다.',
    })
  }
  const curlyQuote = (body.match(/[“”]/g) ?? []).length
  const straightQuote = (body.match(/"/g) ?? []).length
  if (curlyQuote && straightQuote) {
    out.push({
      rule: 'quote_style',
      stage: '삼교',
      found: `굽은 “ ” ${curlyQuote}개 · 곧은 " ${straightQuote}개`,
      hint: '큰따옴표를 한쪽 모양으로 맞춘다.',
    })
  }

  const { ize, ise } = spellingConventions(body)
  if (ize.length && ise.length) {
    out.push({
      rule: 'ise_ize',
      stage: '삼교',
      found: `${ize.slice(0, 2).join(' · ')} ↔ ${ise.slice(0, 2).join(' · ')}`,
      hint: '미국식(-ize)과 영국식(-ise)이 섞였다 — 한쪽으로 맞춘다.',
    })
  }

  const em = (body.match(/—/g) ?? []).length
  const hyphenDash = (body.match(/ - /g) ?? []).length
  if (em && hyphenDash) {
    out.push({
      rule: 'dash_style',
      stage: '삼교',
      found: `em 대시 ${em}개 · 하이픈 대시 ${hyphenDash}개`,
      hint: '삽입구 부호를 한쪽으로 맞춘다.',
    })
  }

  return out
}

/**
 * 한 지문을 재교·삼교로 훑는다. 깨끗하면 빈 배열.
 *
 * **고치지 않는다 — 자리만 돌려준다.** 지문 수정은 원문 개작이라 사람이 정한다.
 */
export function proofreadPassage(sentences: readonly string[]): ProofFinding[] {
  const clean = sentences.map((s) => (typeof s === 'string' ? s : '')).filter(Boolean)
  if (!clean.length) return []
  return [...secondPass(clean), ...thirdPass(clean)]
}

/** 리포트용 요약 — 규칙별 건수와 결함 지문 비율. */
export interface ProofSummary {
  passages: number
  defective: number
  defectRate: number
  byRule: Record<string, number>
}

export function summarizeProofread(
  passages: ReadonlyArray<readonly string[]>,
): ProofSummary {
  const byRule: Record<string, number> = {}
  let defective = 0
  for (const p of passages) {
    const found = proofreadPassage(p)
    if (found.length) defective += 1
    for (const f of found) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1
  }
  return {
    passages: passages.length,
    defective,
    defectRate: passages.length ? defective / passages.length : 0,
    byRule,
  }
}
