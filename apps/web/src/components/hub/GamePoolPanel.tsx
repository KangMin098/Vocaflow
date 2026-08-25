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

import Link from 'next/link'

export interface GamePoolWord {
  en: string
  ko: string
}

export function GamePoolPanel({
  words,
  ownedTotal,
  /** 이 게임이 한 판에 쓰는 최소 단어 수 — 못 채우면 그 사실을 말한다 */
  minWords,
}: {
  words: GamePoolWord[]
  /**
   * 학습자가 **가진** 단어 총수. `fetchDueGameWords().total` 이 아니다 — 그건 상한(40)으로
   * 잘린 풀 크기라서, 그대로 쓰면 252단어 학습자에게 "내 단어 40개" 라고 말하게 된다(실측).
   */
  ownedTotal: number
  minWords: number
}) {
  const enough = words.length >= minWords

  return (
    <section
      aria-label="이번 판 단어"
      data-game-pool=""
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-1 md:px-6 md:py-5"
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">이번 판 단어</h2>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          내 단어 {ownedTotal.toLocaleString()}개 중 {words.length}개 · 복습 임박순
        </span>
      </header>

      {enough ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
            {words.slice(0, 6).map((w) => (
              <li
                key={w.en}
                className="inline-flex items-baseline gap-2 rounded-ios-pill bg-[var(--bg2)] px-3 py-1"
                title={w.ko}
              >
                <span className="font-editorial text-[14px] font-[500] text-[var(--t1)]">
                  {w.en}
                </span>
                <span className="max-w-[12ch] truncate font-body text-[11px] text-[var(--t3)]">
                  {w.ko}
                </span>
              </li>
            ))}
          </ul>
          {words.length > 6 && (
            <p className="mt-2 font-mono text-[11px] tabular-nums text-[var(--t3)]">
              외 {words.length - 6}개가 이번 풀에 들어 있어요
            </p>
          )}
        </>
      ) : (
        // 부족하면 부족하다고 말한다 — 시작 버튼만 두면 눌러 보고서야 알게 된다.
        <p className="mt-3 max-w-[46ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          한 판을 만들려면 단어가 {minWords}개 이상 필요해요. 지금은 {words.length}개예요 —{' '}
          <Link
            href="/library/books"
            className="font-[700] text-[var(--p)] no-underline hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            읽으면서 모으면
          </Link>{' '}
          바로 열려요.
        </p>
      )}
    </section>
  )
}
