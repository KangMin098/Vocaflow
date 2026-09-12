// apps/web/src/lib/echo/word-signal.ts
//
// EchoMatch 한 발화 → **어휘 단위 청각 신호(F3 Sound)**.
//
// 왜 필요한가 (docs/VOCAB_FRAMEWORK_PROPOSAL.md §8 빈칸):
//   면 6개 중 **Sound(F3) 만 기록 경로가 비어 있었다.** 청각 게임은 응답이 '뜻'이라 발화를
//   검증하지 않고, EchoMatch 는 `echo_match_attempts` 에 따로 살아 FSRS 밖이었다.
//   → 처방이 "이 단어는 소리가 약해요" 를 **말할 수가 없다.** 설계안이 건 선행 조건이
//   "EchoMatch 를 어휘 단위 신호로 잇기" 이고, 이 파일이 그 변환이다.
//
// ── 근거의 등급: 무엇이 그 단어에 대해 말하는가 ───────────────────────────
//   EchoMatch 는 두 가지를 동시에 잰다. **강도가 다르다.**
//
//   ① 음성인식 전사(`computeShadowMatch().matchedKeys`) — **단어 단위 근거.**
//      그 단어가 실제로 발화에 나왔는지 하나하나 말해 준다. 이것이 있으면 이걸 쓴다.
//   ② 프로소디 점수(`dtw-comparator`) — **문장 단위 근거.** comparator 자신이 밝혀 둔 대로
//      "억양·강세·리듬 모양의 정합이지 음소 정확도가 아니다". 문장 점수를 단어에 나눠 주는
//      것은 추정이므로, ①이 없을 때만(미지원 브라우저·인식 실패) 보조로 쓴다.
//
//   등급을 섞지 않는 이유: 두 근거가 같은 칸에 들어가면 나중에 "이 통과가 무엇으로
//   판정됐나" 를 되물을 수 없다. 그래서 판정 근거를 `evidence` 로 남기고,
//   기록에도 metadata 로 같이 적재한다.
//
// ── 무엇을 주장하지 않는가 ──────────────────────────────────────────
//   **FSRS 복습 간격을 움직이지 않는다.** EchoMatch 는 문장이 화면에 떠 있는 채로
//   따라 말하는 활동이다 — 보고 읽는 것은 **인출이 아니다**(TAP · Barcroft).
//   인출이 아닌 것을 인출로 세면 복습 스케줄이 조용히 늘어나 정작 못 외운 단어가 안 돌아온다.
//   그래서 남기는 것은 `learning_records`(면 이력 + 그날의 활동)뿐이고,
//   `vocabularies` 의 D/S 는 건드리지 않는다. F3 축 정의(`청각 단서 인출 · **발화 모방**`)의
//   '발화 모방' 쪽만 채우는 것이고, 그게 이 활동이 실제로 하는 일이다.
//
// ── 실측이 바꾼 설계 ────────────────────────────────────────────────
//   `echo_match_attempts` 6건을 열어 보니 **4건이 발화 실패였다**:
//     (0,0,0) ×2 — voiced 프레임 4개 미만이면 comparator 가 전 축 0 을 반환한다(무음·마이크 실패)
//     (p0,e0,t90) ×1 — 프로소디 두 축이 바닥인데 길이만 맞은 것. 잡음도 낼 수 있는 우연이다
//   이걸 오답으로 적재하면 **마이크가 고장난 학습자에게 "청각이 약하다" 는 처방**이 간다.
//   측정 실패는 오답이 아니라 **무기록**이다.

import { matchSurface } from '@/lib/text/surface-match'
import { normalizeWord } from '@/lib/workspace/shadow-match'

import type { ComparisonScore } from './dtw-comparator'

/** 프로소디 보조 경로에서 청각 면 성공으로 셀 최소 점수.
 *  `scoreFeedback` 의 '좋아요! 자연스러운 억양' 경계와 같은 값 — 화면이 칭찬하는 지점과
 *  기록이 성공으로 세는 지점이 다르면 학습자가 둘을 대조할 수 없다. */
export const SOUND_HIT_MIN = 70

/** 프로소디 보조 경로에서 한 발화가 한 번에 통과시킬 수 있는 단어 수 상한.
 *  문장 점수는 단어별 근거가 아니므로, 한 문장으로 내 단어 8개를 동시에 통과시키면 면이 부풀려진다.
 *  (인식 경로는 단어마다 근거가 있으므로 상한이 없다.) */
export const MAX_WORDS_PER_UTTERANCE = 3

/** 인식 결과를 신뢰할 최소 문장 일치율.
 *  플레이어가 이미 같은 값에서 "단어가 잘 안 들렸어요" 로 재읽기를 권한다(`WORD_GATE`).
 *  화면이 못 알아들었다고 말한 발화를 기록만 성적으로 읽으면 안 된다. */
export const TRANSCRIPT_TRUST_MIN = 0.4

/** 이 단어의 굴절형까지 아는 형태 — dictation 의 `TargetLemma` 와 같은 모양. */
export interface SoundLemma {
  /** `vocabularies.id` — 기록을 단어에 잇는 키 */
  id: string
  /** 원형(소문자) */
  word: string
  /** 사전 굴절형 (없으면 규칙형만으로 매칭) */
  forms: string[]
}

/** 판정이 무엇에 근거했는가 — 등급을 섞지 않기 위해 남긴다. */
export type SoundEvidence = 'transcript' | 'prosody'

export interface SoundRecord {
  lemma: SoundLemma
  isCorrect: boolean
  evidence: SoundEvidence
}

/**
 * **발화가 있었는가** — 프로소디 점수를 성적으로 읽기 전에 묻는 질문.
 *
 * comparator 는 voiced 프레임이 모자라면 전 축 0 을 돌려준다. 그건 "못했다" 가 아니라
 * "안 들렸다" 다. 프로소디 두 축(pitch·energy)이 **둘 다** 바닥이면 남은 timing 은
 * 발화 길이 비율뿐이라 잡음으로도 맞을 수 있으므로 신호로 쓰지 않는다.
 *
 * ⚠️ 낮은 점수(예: pitch 23)는 걸러지지 않는다 — 그건 실제 수행이고 오답으로 센다.
 *    이 게이트가 막는 것은 **측정 실패**뿐이다.
 */
export function isCredibleUtterance(score: ComparisonScore): boolean {
  return score.pitch > 0 || score.energy > 0
}

/** 문장에 실제로 든 내 단어 (굴절형 포함). */
export function lemmasInSentence(sentence: string, lemmas: SoundLemma[]): SoundLemma[] {
  return lemmas.filter((l) => matchSurface(sentence, l.word, l.forms) !== null)
}

/**
 * 인식이 이 단어를 들었는가.
 *
 * 전사에서 나온 표면형과 대조하므로 **굴절형도 그 단어로 센다** — 'whispering' 을 들었으면
 * 'whisper' 를 말한 것이다. 문장 안 표면형을 기준으로 삼는 이유는, 학습자가 발음한 것은
 * 원형이 아니라 그 문장에 쓰인 형태이기 때문이다.
 */
export function heardLemma(
  sentence: string,
  lemma: SoundLemma,
  matchedKeys: Set<string>,
): boolean {
  const m = matchSurface(sentence, lemma.word, lemma.forms)
  if (!m) return false
  // 문장에 쓰인 표면형이 인식됐는가 (matchedKeys 는 정규화된 토큰 집합)
  const surface = normalizeWord(m.surface)
  if (surface && matchedKeys.has(surface)) return true
  // 표면형이 여러 토큰이면(구 형태) 원형으로도 한 번 본다
  return matchedKeys.has(normalizeWord(lemma.word))
}

/**
 * 한 번의 따라 말하기 → 남길 청각 면 기록들.
 *
 * `transcriptRatio` 가 null 이면 인식이 없었던 것(미지원 브라우저·인식 실패)이고,
 * `TRANSCRIPT_TRUST_MIN` 미만이면 인식 자체가 못 미덥다 —
 * 후자는 **아무것도 남기지 않는다.** 인식이 놓친 것을 학습자가 못한 것으로 세면
 * 조용한 마이크가 청각 처방을 만든다.
 */
export function soundRecords(input: {
  sentence: string
  score: ComparisonScore
  lemmas: SoundLemma[]
  /** `computeShadowMatch().ratio` — 미측정이면 null */
  transcriptRatio: number | null
  /** `computeShadowMatch().matchedKeys` — 미측정이면 null */
  matchedKeys: Set<string> | null
}): SoundRecord[] {
  const present = lemmasInSentence(input.sentence, input.lemmas)
  if (present.length === 0) return []

  // ── ① 단어 단위 근거 ──
  if (input.transcriptRatio != null && input.matchedKeys) {
    if (input.transcriptRatio < TRANSCRIPT_TRUST_MIN) return []
    return present.map((lemma) => ({
      lemma,
      isCorrect: heardLemma(input.sentence, lemma, input.matchedKeys!),
      evidence: 'transcript' as const,
    }))
  }

  // ── ② 문장 단위 보조 근거 ──
  if (!isCredibleUtterance(input.score)) return []
  const isCorrect = input.score.overall >= SOUND_HIT_MIN
  // 상한을 넘을 때는 **긴 단어 먼저**다. 채점되는 것이 문장의 억양·강세 곡선인데
  // 음절이 긴 내용어는 그 곡선의 큰 몫을 차지하고 1음절 기능어는 거의 차지하지 않는다.
  // (문장 앞에서 자르면 문두 관사·전치사가 우선권을 갖는 정반대가 된다.)
  return [...present]
    .sort((a, b) => b.word.length - a.word.length)
    .slice(0, MAX_WORDS_PER_UTTERANCE)
    .map((lemma) => ({ lemma, isCorrect, evidence: 'prosody' as const }))
}
