// apps/web/src/lib/game/use-session-recorder.ts
//
// 게임 세션 집계 → scores 적재 + 아케이드 리텐션 메타(스트릭·XP) 적립.
//
// ── 왜 언마운트에서도 flush 하는가 (v07.4 결함 수정) ──────────────
//   기존에는 **게임 내부 종료 버튼**이 호출하는 onExit 에서만 적재했다.
//   그런데 학습자가 실제로 가장 많이 누르는 종료는 세션 셸 상단의 X 와 Esc 다
//   (SessionFrame 이 <Link>/router.push 로 처리 → 게임 onExit 미호출).
//   그 경로로 나가면 단어별 learning_records 는 남는데 **세션 scores 는 통째로 유실**되고
//   스트릭·XP 도 적립되지 않았다(실측: learning_records 6행 / scores 0행).
//   → 페이지 언마운트(=클라이언트 라우팅으로 세션을 떠나는 모든 경로) 시점에 flush 한다.
//
//   중복 방지는 scoredRef 1회 가드. 한 판도 안 했으면(captured 0) 적재하지 않는다.

'use client'

import { useEffect, useRef } from 'react'

import { awardArcadeXp } from '@/lib/game/arcade-meta'
import { contentRefFromScope } from '@/lib/content/content-ref'
import { recordGameScore, type ScoreModule } from '@/lib/scores/record-score'
import type { WordScope } from '@/lib/game/use-word-scope'

export interface SessionRecorder {
  /** 정답 1건 집계 */
  countCorrect: () => void
  /** 오답 1건 집계 */
  countWrong: () => void
  /** 즉시 적재(1회 가드). 게임 자체 종료 버튼에서 호출 — 언마운트에서도 자동 호출된다. */
  flush: () => void
}

export function useGameSessionRecorder({
  module,
  scope,
  computeScore,
}: {
  module: ScoreModule
  scope: WordScope
  /** 대표 점수 산식 — 게임마다 다름(기본: 정답×100) */
  computeScore?: (correct: number, wrong: number) => number
}): SessionRecorder {
  const correctRef = useRef(0)
  const wrongRef = useRef(0)
  const startRef = useRef(0)
  const scoredRef = useRef(false)

  useEffect(() => {
    startRef.current = Date.now()
  }, [])

  // 최신 값을 보는 flush — 언마운트 cleanup 이 stale closure 를 잡지 않도록 ref 로 유지.
  const flushRef = useRef<() => void>(() => {})
  flushRef.current = () => {
    const correct = correctRef.current
    const wrong = wrongRef.current
    const captured = correct + wrong
    if (scoredRef.current || captured === 0) return
    scoredRef.current = true
    const accuracy = Math.round((correct / captured) * 100)
    void recordGameScore({
      module,
      score: computeScore ? computeScore(correct, wrong) : correct * 100,
      totalQuestions: captured,
      correctCount: correct,
      accuracy,
      durationSeconds: startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : undefined,
      ...(scope.text ? { textId: scope.text } : {}),
      // 아케이드 19종이 이 한 줄로 콘텐츠 귀속을 얻는다 — 스코프는 이미 여기 있었고
      // 적재만 그것을 버리고 있었다(scope.set 은 어디에도 안 남았다).
      // 맛보기 폴백(demo)은 내 단어도 자료도 아니므로 귀속시키지 않는다.
      ...(scope.demo ? {} : { content: contentRefFromScope({ set: scope.set, text: scope.text, chapter: scope.chapter }) }),
      metadata: { captured, wrong, scope: scope.kind, demo: scope.demo },
    })
    awardArcadeXp(accuracy)
  }

  // 세션을 떠나는 모든 경로(셸 X · Esc · 브라우저 뒤로 · 게임 내부 종료)를 덮는다.
  useEffect(() => () => flushRef.current(), [])

  return {
    countCorrect: () => {
      correctRef.current += 1
    },
    countWrong: () => {
      wrongRef.current += 1
    },
    flush: () => flushRef.current(),
  }
}
