// apps/web/src/lib/comic/prescribe.ts
//
// 포맷 처방 — "같은 책, 어느 입구로 들어갈까"를 학습자 상태로 판정.
// 설계: docs/CCP_LIBRARY_INTEGRATION.md §5.3 · D5(선택지 나열이 아니라 권장 1개 + 동등 노출).
//
// 왜 처방인가:
//   · Cognitive Load — 3형식을 동급으로 나열하면 선택 자체가 과제가 된다.
//   · SDT 자율성    — 그렇다고 강제 이동시키면 주체성이 깎인다. → 권장은 1개, 나머지도 그대로 고를 수 있게.
// 왜 만화가 기본 권장이 아닌가:
//   · seductive details(§2.4) — 그림은 본문 읽기 시간을 밀어낸다. 만화는 스캐폴드이지 대체재가 아니므로
//     "어려울 때 / 복습할 때"만 권장하고, 적정 난이도에선 원문을 권장한다.

import type { IPlusOneTier } from '@/lib/library/i-plus-one'

export type FormatKey = 'comic' | 'text' | 'audio'

export interface PrescribeInput {
  /** 진단 완료 여부 (V레벨 ≥1) */
  diagnosed: boolean
  /** judgeIPlusOne 결과 tier (미진단/커버리지 부재면 null) */
  fit: IPlusOneTier | null
  /** 만화 진행률 0~100 (comic_read_progress) */
  comicProgressPct: number
  /** 만화 완독 여부 */
  comicCompleted: boolean
  /** 이 도서의 챕터를 하나라도 본문으로 완료했는지 */
  readAnyChapter: boolean
  /** LibriVox 낭독 보유 */
  hasAudio: boolean
}

export interface Prescription {
  /** 권장 포맷 — 카드 1개에만 "지금 추천" 표시 */
  pick: FormatKey
  /** 권장 이유 — Empathetic Feedback(비난·압박 없이 맥락 제시) */
  reason: string
}

/**
 * 규칙은 위에서부터 먼저 맞는 것 하나만 적용된다(순서가 의미를 가짐).
 * 진행 중 > 복습 > 난이도 > 미진단 순 — 이미 시작한 행동을 잇는 것이 가장 마찰이 적다.
 */
export function prescribeFormat(input: PrescribeInput): Prescription {
  const { diagnosed, fit, comicProgressPct, comicCompleted, readAnyChapter, hasAudio } = input

  // ① 만화를 보던 중 — 이어보기가 언제나 1순위
  if (comicProgressPct > 0 && !comicCompleted) {
    return { pick: 'comic', reason: '보던 곳부터 이어서 볼 수 있어요' }
  }

  // ② 본문을 읽은 적 있음 — 만화는 '복습(회상 강화)'으로 프레이밍
  if (readAnyChapter) {
    return { pick: 'comic', reason: '읽은 이야기를 그림으로 되짚으면 기억이 오래 가요' }
  }

  // ③ 만화를 이미 다 봤다면 다음 단계는 본문
  if (comicCompleted) {
    return { pick: 'text', reason: '이야기를 이미 알고 있으니 본문이 훨씬 잘 읽혀요' }
  }

  // ④ 난이도 처방
  if (diagnosed && fit) {
    if (fit === 'hard') {
      return {
        pick: 'comic',
        reason: '지금은 조금 어려운 책이에요. 그림으로 줄거리를 먼저 잡으면 본문이 수월해져요',
      }
    }
    if (fit === 'challenge') {
      return { pick: 'comic', reason: '모르는 단어가 조금 많아요. 그림이 맥락을 받쳐줘요' }
    }
    if (fit === 'easy' && hasAudio) {
      return { pick: 'audio', reason: '수월한 편이에요. 들으며 읽으면 속도가 붙어요' }
    }
    // ideal (또는 audio 없는 easy)
    return { pick: 'text', reason: '지금 딱 맞는 난이도예요. 본문으로 바로 시작해볼까요?' }
  }

  // ⑤ 미진단 — 부담 없는 입구부터
  return { pick: 'comic', reason: '레벨 진단 전이라면, 그림으로 가볍게 시작해도 좋아요' }
}
