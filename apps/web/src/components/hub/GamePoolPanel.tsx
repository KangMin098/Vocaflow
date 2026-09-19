// apps/web/src/components/hub/GamePoolPanel.tsx
//
// 게임 허브가 "**내 어떤 단어로 노는지**" 를 말하는 패널.
//
// 왜 필요했나(2026-08-15 실측): PRACTICE 그룹 5형제가 두 계보로 갈려 있었다.
//   · Flashcard · SpellForge — `ModuleHero` 가 실 큐(이번 세션 N장 · 기억 4버킷)를 보여준다
//   · WordBlitz · PairFlip   — 화면의 30~60% 가 "학습 효과 / 게임 규칙" **설명서**이고,
//                              252단어를 가진 학습자에게 **단어 정보가 0** 이었다
// 어휘 학습 플랫폼의 연습 화면이 무엇으로 연습하는지 말하지 않는 것은 /hub 이 갖고 있던
// 결함과 같은 것이다(개수만 있고 단어가 없다).
//
// **드리프트 방지**: 여기 뜨는 단어는 게임이 실제로 쓰는 `fetchDueGameWords` 결과 그대로다.
// 허브가 별도 쿼리로 "N개" 를 세면 시작 버튼을 눌렀을 때 나오는 것과 어긋나고, 그러면
// 목업을 지우고 **새 거짓말**을 만든 셈이 된다(session-queue-query.ts 가 같은 이유로
// play 라우트와 쿼리를 공유한다).

// 2026-09-19 (DD-35 · docs/design/compare/game-hubs.md 발산 A 「이번 판 낱말」):
//   흰 상자(큰 모서리 · 그림자) 안 알약 칩 6개 → **괘선 두 단 목록**(영어 낱말 — 뜻). 한 판에 들어가는 앞 N개에
//   권점(`marked` — PairFlip 난이도의 쌍 수) — 모듈 허브(`QueueLine`)·`/hub` 와 같은 몸짓(200ms 색만).

import Link from 'next/link'

import styles from './queue-line.module.css'

/** 목록에 세우는 최대 수 — 두 단 여섯 줄 */
const SHOW_MAX = 12
/**
 * 좁은 화면(한 단)에서는 여섯 줄 — 다만 한 판의 쌍 수보다 적게는 자르지 않는다(권점이 가려지면 서명이 사라진다).
 * 열두 줄을 다 세우면 390px 에서 시작 버튼이 첫 화면 밖이었다(2026-09-19 · 수정 1회차 1063/844).
 */
const MOBILE_MIN = 6

export interface GamePoolWord {
  en: string
  ko: string
}

export function GamePoolPanel({
  words,
  ownedTotal,
  /** 이 게임이 한 판에 쓰는 최소 단어 수 — 못 채우면 그 사실을 말한다 */
  minWords,
  marked,
}: {
  words: GamePoolWord[]
  /**
   * 학습자가 **가진** 단어 총수. `fetchDueGameWords().total` 이 아니다 — 그건 상한(40)으로
   * 잘린 풀 크기라서, 그대로 쓰면 252단어 학습자에게 "내 단어 40개" 라고 말하게 된다(실측).
   */
  ownedTotal: number
  minWords: number
  /** 한 판에 실제로 들어가는 수 — 앞에서부터 권점. 없으면 권점 없이 목록만 */
  marked?: number
}) {
  const enough = words.length >= minWords
  const shown = words.slice(0, SHOW_MAX)
  const mobileRows = Math.max(MOBILE_MIN, marked ?? 0)
  const overflowMobile = words.length - Math.min(words.length, mobileRows)

  return (
    <section aria-label="이번 판 단어" data-game-pool="" className="flex flex-col">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">이번 판 낱말</h2>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          내 단어 {ownedTotal.toLocaleString()}개 중 {words.length}개 · 복습 임박순
        </span>
      </header>

      {enough ? (
        <>
          <ul className="m-0 mt-2 list-none gap-x-8 border-t border-[var(--bd)] p-0 sm:columns-2">
            {shown.map((w, i) => {
              const on = marked != null && i < marked
              return (
                <li
                  key={w.en}
                  data-pool-word=""
                  className={`flex min-w-0 break-inside-avoid items-baseline gap-3 border-b border-[var(--bd)] py-1.5 sm:py-2 ${i >= mobileRows ? 'max-sm:hidden' : ''}`}
                >
                  <span
                    lang="en"
                    className={`${styles.word} font-english text-[16px] ${marked != null && !on ? 'text-[var(--t2)]' : 'text-[var(--t1)]'}`}
                    data-on={on}
                  >
                    {w.en}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">{w.ko}</span>
                </li>
              )
            })}
          </ul>
          {overflowMobile > 0 && (
            <p className="m-0 mt-2 font-mono text-[11px] tabular-nums text-[var(--t2)] sm:hidden">
              외 {overflowMobile}개가 이번 풀에 들어 있어요
            </p>
          )}
          {words.length > shown.length && (
            <p className="m-0 mt-2 hidden font-mono text-[11px] tabular-nums text-[var(--t2)] sm:block">
              외 {words.length - shown.length}개가 이번 풀에 들어 있어요
            </p>
          )}
          {marked != null && (
            <p className="m-0 mt-1 font-body text-[12px] text-[var(--t2)] [word-break:keep-all]">
              <span className={styles.word} data-on="true" aria-hidden>
                점
              </span>{' '}
              찍힌 {Math.min(marked, words.length)}개가 이번 판에 들어가요 — 난이도를 바꾸면 따라 옮겨져요.
            </p>
          )}
        </>
      ) : (
        <p className="m-0 mt-2 max-w-[46ch] border-t border-[var(--bd)] pt-2 font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          한 판을 만들려면 단어가 {minWords}개 이상 필요해요. 지금은 {words.length}개예요 —{' '}
          <Link
            href="/library/books"
            className="inline-flex min-h-[44px] items-center font-[700] text-[var(--p)] no-underline hover:text-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          >
            읽으면서 모으면
          </Link>{' '}
          바로 열려요.
        </p>
      )}
    </section>
  )
}
