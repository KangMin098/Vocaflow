// apps/web/src/lib/knowledge/practice.ts
// 「주장과 근거 관계」 학습 과제(모듈 키 csat_claim_evidence)의 순수 규칙. 정본 docs/methodology/VNEXT.md §6.
//
// ⚠️ 저작권 경계: 학습자에게 가는 것은 **문장 길이 막대와 번호**뿐이다. 지문 글자는 학습자가 자기 문제지에서 읽는다.
//    정답 근거 문장 번호(keySentences)는 학습자가 답을 낸 뒤에만 서버가 돌려준다 — 이 파일의 `toLearnerTask` 가 그 경계다.
// ⚠️ 문장 번호는 골격이 센 번호다(`passage-skeleton.ts` splitSentences). 문제지의 문장과 어긋날 수 있어서 막대 길이를 함께 보인다.

/** 골격 파일의 문항 한 개 — 여기서 쓰는 칸만. */
export interface SkeletonItemLike {
  id: string
  no: number
  type_id?: string
  sentences: { chars: number }[]
  anchors: { id: string; sentences: number[]; from?: string }[]
}

export interface ClaimTask {
  itemId: string
  no: number
  typeId: string | null
  /** 문장마다 글자 수 — 막대 폭 */
  bars: number[]
  /** 정답 근거 문장(0-기반) — 서버 전용 */
  keySentences: number[]
  /** 끌리는 오답이 기대는 문장(0-기반) — 서버 전용 */
  trapSentences: number[]
}

/** 정답 근거 문장이 없는 문항은 과제가 되지 않는다(판정할 수 없다). */
export function buildClaimTask(it: SkeletonItemLike): ClaimTask | null {
  const answer = it.anchors.find((a) => a.id === 'answer' || a.from === 'answer')
  const keys = [...new Set(answer?.sentences ?? [])].filter((i) => i >= 0 && i < it.sentences.length).sort((a, b) => a - b)
  if (keys.length === 0 || it.sentences.length < 2) return null
  const traps = [
    ...new Set(
      it.anchors
        .filter((a) => a.id !== 'answer' && (a.from === 'tempt' || a.id.startsWith('reject:') || a.from === 'reject'))
        .flatMap((a) => a.sentences),
    ),
  ]
    .filter((i) => i >= 0 && i < it.sentences.length && !keys.includes(i))
    .sort((a, b) => a - b)
  return {
    itemId: it.id,
    no: it.no,
    typeId: it.type_id ?? null,
    bars: it.sentences.map((s) => s.chars),
    keySentences: keys,
    trapSentences: traps,
  }
}

/** 학습자에게 보내는 모양 — 정답 근거·함정 문장 번호를 뺀다. */
export interface LearnerTask {
  itemId: string
  no: number
  typeId: string | null
  bars: number[]
}

export function toLearnerTask(t: ClaimTask): LearnerTask {
  return { itemId: t.itemId, no: t.no, typeId: t.typeId, bars: t.bars }
}

export interface ClaimResponse {
  /** 학습자가 고른 주장 문장(0-기반) */
  claimSentence: number
  /** 학습자가 고른 근거 문장들(0-기반, 0~3개) */
  evidenceSentences: number[]
  /** 고른 선지 1~5, 모르면 null */
  option: number | null
  /** 확신 1~3 */
  confidence: 1 | 2 | 3
  sec: number
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** 요청 본문 검사 — 숫자만 받는다(글자 응답 없음). */
export function parseClaimResponse(v: unknown, sentenceCount: number): ParseResult<ClaimResponse> {
  if (!v || typeof v !== 'object') return { ok: false, error: '응답이 비었다' }
  const o = v as Record<string, unknown>
  const idx = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < sentenceCount
  if (!idx(o.claimSentence)) return { ok: false, error: '주장 문장 번호가 범위를 벗어났다' }
  const ev = Array.isArray(o.evidenceSentences) ? o.evidenceSentences : []
  if (ev.length > 3 || !ev.every(idx)) return { ok: false, error: '근거 문장은 0~3개, 범위 안의 번호만' }
  const option = o.option === null || o.option === undefined ? null : o.option
  if (option !== null && !(typeof option === 'number' && Number.isInteger(option) && option >= 1 && option <= 5)) {
    return { ok: false, error: '선지는 1~5' }
  }
  const confidence = o.confidence
  if (confidence !== 1 && confidence !== 2 && confidence !== 3) return { ok: false, error: '확신은 1~3' }
  const sec = typeof o.sec === 'number' && Number.isFinite(o.sec) ? Math.max(0, Math.min(7200, Math.round(o.sec))) : 0
  return {
    ok: true,
    value: {
      claimSentence: o.claimSentence as number,
      evidenceSentences: [...new Set(ev as number[])].filter((i) => i !== o.claimSentence).sort((a, b) => a - b),
      option: option as number | null,
      confidence,
      sec,
    },
  }
}

export interface ClaimFeedback {
  claimHit: boolean
  /** 고른 문장이 끌리는 오답이 기대는 문장이었다 */
  claimOnTrap: boolean
  optionCorrect: boolean | null
  keySentences: number[]
  trapSentences: number[]
  /** 학습자에게 보이는 다음 행동 한 문장 */
  next: string
}

export function scoreClaim(t: ClaimTask, r: ClaimResponse, answer: number | null): ClaimFeedback {
  const claimHit = t.keySentences.includes(r.claimSentence)
  const claimOnTrap = !claimHit && t.trapSentences.includes(r.claimSentence)
  const optionCorrect = r.option === null || answer === null ? null : r.option === answer
  let next: string
  if (claimHit && optionCorrect !== false) next = '주장 문장을 먼저 잡았어요. 다음 문항도 같은 순서로 가요.'
  else if (claimHit) next = '주장 문장은 맞았어요. 선지가 그 문장과 어디서 어긋나는지 한 줄로 적어 봐요.'
  else if (claimOnTrap) next = '고른 문장은 오답 선지가 기대는 문장이에요. 그 문장이 주장인지 근거·예시인지 다시 나눠 봐요.'
  else next = '표시된 문장을 문제지에서 다시 읽고, 왜 그 문장이 글 전체를 묶는지 한 줄로 적어 봐요.'
  return { claimHit, claimOnTrap, optionCorrect, keySentences: t.keySentences, trapSentences: t.trapSentences, next }
}

/**
 * 다음 문항 고르기 — 자유 이동이 기본이고 이건 추천일 뿐이다.
 * 훈련 유형 중 아직 안 한 문항 → 사전+사후 기본량을 채웠으면 전이 유형 하나를 섞는다.
 */
export function pickNext(
  pool: { train: readonly string[]; transfer: readonly string[] },
  doneItemIds: ReadonlySet<string>,
  trainDone: number,
  transferEvery = 5,
): { itemId: string; phase: 'train' | 'transfer' } | null {
  const freshTrain = pool.train.filter((id) => !doneItemIds.has(id))
  const freshTransfer = pool.transfer.filter((id) => !doneItemIds.has(id))
  const wantTransfer = trainDone > 0 && trainDone % transferEvery === 0 && freshTransfer.length > 0
  if (wantTransfer) return { itemId: freshTransfer[0], phase: 'transfer' }
  if (freshTrain.length > 0) return { itemId: freshTrain[0], phase: 'train' }
  if (freshTransfer.length > 0) return { itemId: freshTransfer[0], phase: 'transfer' }
  return null
}
