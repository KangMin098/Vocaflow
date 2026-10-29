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
import { readSessionScore, resetSessionScore } from '@/lib/game/session-score'
import type { WordScope } from '@/lib/game/use-word-scope'
import { useStoryAuthGuard, type StoryAuthSource, type StoryAuthStatus } from '@/components/library/story/use-story-auth-guard'
import { recordGameResult, type RecordGameResultInput, type RecordResult } from '@/lib/game/record-result'

export interface SessionRecorder {
  /** 정답 1건 집계 */
  countCorrect: () => void
  /** 오답 1건 집계 */
  countWrong: () => void
  /** 즉시 적재(1회 가드). 게임 자체 종료 버튼에서 호출 — 언마운트에서도 자동 호출된다. */
  flush: () => void
  /**
   * 이 판이 아직 주인(scope.viewerId — 단어를 읽은 사람)의 것인가. 바뀜(다른 계정 · 로그아웃)을 보면 false 로 고정된다(되살리지 않음).
   * false 면 단어별 기록도 보내지 않고, 화면은 게임을 내려야 한다(status).
   */
  active: () => boolean
  /** 화면 경계 — 'same' 일 때만 게임(개인 단어 · 정답 · 입력 · 음성)을 그린다. 주인을 아직 모르면 'checking'. */
  status: StoryAuthStatus
  /** 판의 주인(uid · 로그인 없음 = null · 아직 모름 = undefined). */
  owner: () => string | null | undefined
  /**
   * 단어별 기록(recordGameResult) — 판이 무효면 보내지 않고, 보낼 때는 주인을 expectedUserId 로 싣는다
   * (서버가 지금 사용자와 다르면 쓰지 않는다). 보내지 않은 것은 `identity-changed` 실패로 돌려준다(저장 완료로 치지 않음).
   */
  result: (input: Omit<RecordGameResultInput, 'expectedUserId'>) => Promise<RecordResult>
}

const IDENTITY_CHANGED: RecordResult = { ok: false, error: 'identity-changed' }

export function useGameSessionRecorder({
  module,
  scope,
  computeScore,
  authSource,
  recordScoreImpl,
  recordResultImpl,
}: {
  module: ScoreModule
  scope: WordScope
  /** 대표 점수 산식 — 게임마다 다름(기본: 정답×100) */
  computeScore?: (correct: number, wrong: number) => number
  /** 시험 · 하네스 주입(없으면 StoryAuthSourceContext → 실제 브라우저 세션) */
  authSource?: StoryAuthSource
  /** 시험 · 하네스 주입 — 기록 함수 대역(없으면 실제 recordGameScore · recordGameResult) */
  recordScoreImpl?: typeof recordGameScore
  recordResultImpl?: typeof recordGameResult
}): SessionRecorder {
  const correctRef = useRef(0)
  const wrongRef = useRef(0)
  const startRef = useRef(0)
  const scoredRef = useRef(false)
  // ── 판 주인 결속 ──
  //   적재 함수는 저장 **시점**의 사용자로 쓴다(record-score · record-result). 다른 탭에서 B 가 로그인한 뒤
  //   언마운트 flush · 늦은 입력이 오면 A 의 판이 B 의 scores · 카드로 들어갔다.
  //   주인은 recorder 가 따로 읽지 않는다 — **단어를 실제로 읽은 사람**(scope.viewerId)이다. 나중에 읽은 신원(B)을
  //   주인으로 받으면 A 의 자료를 B 의 판으로 착각한다(Codex 설계 검토 2026-10-27).
  //   바뀜 판정은 Story · WordVault · Flashcard 와 같은 useStoryAuthGuard(구독 → 기준선 · 바뀜 고정 · 토큰 갱신 유지).
  //   언마운트 중 구독이 먼저 풀려도, 적재 함수가 쓰는 시점에 expectedUserId 와 지금 사용자를 다시 비교한다.
  const ownerId = scope.viewerId
  const { guard, status: guardStatus } = useStoryAuthGuard(ownerId ?? null, authSource)
  const voidRef = useRef(false)
  if (ownerId !== undefined && guard.status === 'changed') voidRef.current = true
  const status: StoryAuthStatus = ownerId === undefined ? 'checking' : guardStatus

  useEffect(() => {
    startRef.current = Date.now()
    // 이전 판의 대표 점수가 이번 판에 새지 않게 한다(session-score.ts 는 모듈 싱글턴).
    resetSessionScore()
  }, [])
  useEffect(() => {
    if (ownerId !== undefined && guardStatus === 'changed') voidRef.current = true
  }, [ownerId, guardStatus])

  /**
   * 지금 이 판이 기록 가능한가 — 주인을 알고, 바뀜을 보지 않았고, **지금 긍정 확인(same)** 이다(동기 판정: guard.status 를 직접 읽는다).
   * checking(첫 확인 전 · BFCache 복원 뒤 재확인 중)은 기록하지 않는다 — 확인 중을 같은 사람으로 치지 않는다(Codex 반례 2026-10-27:
   * pageshow 재확인 중 붙잡힌 옛 onClick · 언마운트 flush 가 기록됐다). checking 은 영구 무효가 아니다 — 같은 A 로 다시 확인되면 이어 간다.
   */
  const usable = () => {
    if (ownerId === undefined) return false
    if (guard.status === 'changed') voidRef.current = true
    return !voidRef.current && guard.status === 'same'
  }

  // 최신 값을 보는 flush — 언마운트 cleanup 이 stale closure 를 잡지 않도록 ref 로 유지.
  const flushRef = useRef<() => void>(() => {})
  flushRef.current = () => {
    const correct = correctRef.current
    const wrong = wrongRef.current
    const captured = correct + wrong
    if (scoredRef.current || captured === 0) return
    scoredRef.current = true
    // 주인과 다른 계정으로 바뀐 판 · 주인을 모르는 판은 적재하지 않는다(저장 완료로 치지 않는다 · XP 도 없음)
    if (!usable()) return
    const owner = ownerId as string | null
    const accuracy = Math.round((correct / captured) * 100)
    // **학습자가 결과 화면에서 본 그 수**를 저장한다.
    //
    // 우선순위: 결과 화면이 보고한 점수 → 호출부가 준 산식 → 정답×100.
    // 마지막 값이 기본이던 동안 18/19 게임이 화면과 다른 수로 적재됐고,
    // `/arcade/ranking` 은 학습자가 본 적 없는 숫자로 줄을 세웠다
    // (근거와 설계 이유: `lib/game/session-score.ts` 머리 주석).
    const reported = readSessionScore()
    const durationSeconds = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : undefined
    {
      void (recordScoreImpl ?? recordGameScore)({
      expectedUserId: owner,
      module,
      score: reported ?? (computeScore ? computeScore(correct, wrong) : correct * 100),
      totalQuestions: captured,
      correctCount: correct,
      accuracy,
      durationSeconds,
      ...(scope.text ? { textId: scope.text } : {}),
      // 아케이드 19종이 이 한 줄로 콘텐츠 귀속을 얻는다 — 스코프는 이미 여기 있었고
      // 적재만 그것을 버리고 있었다(scope.set 은 어디에도 안 남았다).
      // 맛보기 폴백(demo)은 내 단어도 자료도 아니므로 귀속시키지 않는다.
      //
      // v08.6 — `book` 을 빠뜨리고 있었다. `useGameWordScope` 는 처음부터 `?book=` 을 읽는데
      // 여기서만 그것을 버려서, 도서로 들어와 논 세션의 scores.content_type 이 'mine' 으로
      // 적재됐다("어떤 도서를 학습했나" 를 못 답하게 하는, ContentRef 가 애초에 없애려던 결함).
      // 도서 코스(lib/game/sets.ts)가 이 경로를 정식 진입으로 만들면서 실제로 흐르기 시작했다.
      ...(scope.demo
        ? {}
        : {
            content: contentRefFromScope({
              set: scope.set,
              text: scope.text,
              book: scope.book,
              chapter: scope.chapter,
            }),
          }),
      metadata: { captured, wrong, scope: scope.kind, demo: scope.demo },
      })
      awardArcadeXp(accuracy)
    }
  }

  // 세션을 떠나는 모든 경로(셸 X · Esc · 브라우저 뒤로 · 게임 내부 종료)를 덮는다.
  useEffect(() => () => flushRef.current(), [])

  return {
    // 무효가 된 판의 입력은 세지 않는다(옛 화면의 키보드 · 콜백)
    countCorrect: () => {
      if (usable()) correctRef.current += 1
    },
    countWrong: () => {
      if (usable()) wrongRef.current += 1
    },
    flush: () => flushRef.current(),
    active: usable,
    status,
    owner: () => ownerId,
    result: async (input) => {
      if (!usable()) return IDENTITY_CHANGED
      return (recordResultImpl ?? recordGameResult)({ ...input, expectedUserId: ownerId as string | null })
    },
  }
}
