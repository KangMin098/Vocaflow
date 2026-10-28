// apps/web/src/lib/textfit/reading-trial.ts
//
// `/fit` 고정 예시 읽기 체험 — **한 문항, 고정 원문, 로컬 채점**.
//   원문 = 랜딩 히어로 `HERO_PASSAGE`(자체 작성 · 인용 아님)의 첫 두 문장. 발췌 sha256 은 테스트가 지킨다.
//   문항 · 해설 = usgs-qualification/R0_PUBLIC_TRIAL_ITEM_DRAFT.md(Codex 의미 검토 CONTENT_ACCEPTED_FOR_LOCAL_PROTOTYPE).
//   붙여 넣은 글은 절대 채점하지 않는다 — grade 는 이 문항 id 만 받는다. 서버 채점 · 기록 · 익명 식별 · 저장 없음.
//
// ⚠️ 기본 꺼짐 — 공개 활성화는 사용자 결정 전이다. `NEXT_PUBLIC_FIT_READING_TRIAL=1` 일 때만 보인다
//   (빌드 시 인라인되는 공개 env 라 배포 환경에서 명시적으로 켜지 않으면 프로덕션에 나가지 않는다).
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'

export const READING_TRIAL_ENABLED = process.env.NEXT_PUBLIC_FIT_READING_TRIAL === '1'

export const TRIAL_EXCERPT =
  'Every reader encounters the same page differently. A familiar word slips past almost unnoticed, while an unfamiliar one interrupts the sentence and demands to be decoded.'

/** 발췌 sha256 — 원문이 바뀌면 문항도 다시 검토해야 한다 */
export const TRIAL_EXCERPT_SHA256 = '0263921ebed4f09cadd442362fbfe8c2864bbf06e2aa0a9c33922128fbe62b71'

export const TRIAL_ITEM_ID = 'fit-trial-hero-topic'

export const TRIAL_ITEM: DcpItem = {
  id: TRIAL_ITEM_ID,
  type: 'topic',
  paragraphIdx: 0,
  payload: {
    passage: TRIAL_EXCERPT,
    stemKo: '다음 글의 주제로 가장 적절한 것은?',
    choices: [
      'how familiar and unfamiliar words affect reading differently',
      'why some readers skip whole pages of a book',
      'a quick method for decoding difficult sentences',
      'the reasons readers forget words they once knew',
      'the difference between reading aloud and reading silently',
    ],
    underline: null,
    summarySentence: null,
  },
}

export const TRIAL_KEY = 1

export const TRIAL_EXPLANATION =
  '첫 문장은 같은 쪽도 독자마다 다르게 읽힌다고 말하고, 둘째 문장이 그 차이의 한 양상을 낱말의 대조로 보여 준다 — 익숙한 낱말은 거의 눈치채지 못한 채 지나가고, 낯선 낱말은 문장을 끊고 풀어 읽기를 요구한다. 그래서 ①이 두 문장을 함께 묶는다. ②는 「slips past」의 주어가 낱말이지 독자가 쪽을 건너뛰는 것이 아니다. ③은 「demands to be decoded」라고만 할 뿐 해독 방법을 말하지 않는다. ④ 잊는다는 말 · ⑤ 소리 내어 읽기는 글에 없다.'

/** 선택적 낱말 도움 — 문항 풀이와 구분해 보여 준다 */
export const TRIAL_WORD_HELP: readonly { word: string; ko: string }[] = [
  { word: 'encounter', ko: '마주하다' },
  { word: 'slip past', ko: '슬쩍 지나가다' },
  { word: 'unnoticed', ko: '눈에 띄지 않은' },
  { word: 'interrupt', ko: '끊다' },
  { word: 'decode', ko: '해독하다' },
]

/** 로컬 채점 — 이 고정 문항만. 서버 채점과 같은 모양(맞히면 해설만, 틀리면 정답 키) · attemptId null */
export async function gradeTrial(itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> {
  if (itemId !== TRIAL_ITEM_ID) return { ok: false, error: '이 체험은 예시 문항만 채점해요.' }
  const correct = Number(answer.choice) === TRIAL_KEY
  return {
    ok: true,
    correct,
    attemptId: null,
    answerKey: correct ? { explanation_ko: TRIAL_EXPLANATION } : { answer: TRIAL_KEY, explanation_ko: TRIAL_EXPLANATION },
  }
}

/** 오답 원인 칩 — 기록하지 않는다(attemptId 가 null 이라 DcpPlayer 도 부르지 않지만, 혹시 불려도 무동작) */
export async function inertCause(): Promise<{ ok: true }> {
  return { ok: true }
}

export function trialDoneCopy(): { title: string; body: string } {
  return { title: '예시 안내 연습을 마쳤어요', body: '고른 답과 본문 문장 · 해설을 견주어 봤어요. 학습 기록에는 남지 않아요.' }
}
