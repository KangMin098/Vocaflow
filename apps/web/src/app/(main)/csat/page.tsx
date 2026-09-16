// apps/web/src/app/(main)/csat/page.tsx
//
// 기출 허브 — **도착하자마자 센 것이 칠해져 있다.**
//
// ── 무엇을 바꿨나 (2026-09-15) ────────────────────────────────────────
// 전에는 이 화면이 유형 카드 26장이었고, 카드마다 분석 산문 두 줄이 `line-clamp-2` 로 잘려
// 들어 있었다. 실측하면 보이는 글자 4,030자 · **조작 가능한 것 0개 · 그래픽 0개**.
// 학습자가 도착해서 얻는 것은 「읽을거리 26개」였다 — 무엇부터 할지는 말해 주지 않는 목록.
//
// 그런데 3,208개 오답 선지를 전부 세어 보면 이 화면이 할 말이 있다:
// **아홉 가지가 60%이고, 그 아홉은 26유형 중 13~17유형에 걸쳐 나온다.** 곧 유형을 26벌
// 외우기 전에 「오답 만드는 법 아홉 가지」가 먼저다. 그 말을 산문으로 쓰지 않고 막대로 낸다
// (CLAUDE.md I1 — 첫 화면에 **실제로 수행한 결과**가 있어야 한다).
//
// 유형 카드는 없애지 않는다. 다만 **2급 시민**으로 내리고, 잘린 산문 대신 그 유형에서
// **유난히 잦은 함정**(전체 분포 대비 배수로 고른 것)을 단다 — 카드가 스스로 정보가 된다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { ModePicker } from '@/components/csat/ModePicker'
import { TrapAtlas } from '@/components/csat/TrapAtlas'
import { loadCsatTypeCards } from '@/lib/csat/learner'
import { loadMyTraps } from '@/lib/csat/my-traps'
import { createClient } from '@/lib/supabase/server'
import { ATLAS_TYPES, CORPUS, standoutFor } from '@/lib/csat/trap-atlas'

export const metadata: Metadata = {
  title: '기출 유형 분석',
  description:
    '평가원 수능·모의평가 독해 기출 802문항의 오답 선지 3,208개를 하나씩 뜯어, 오답이 만들어지는 방법을 세어 두었습니다.',
}

export const dynamic = 'force-dynamic'

/** 칩에 올릴 유형 — 최근 출제가 많은 순 8개. 26개를 다 올리면 칩 줄이 화면을 먹는다. */
const CHIP_COUNT = 8

export default async function CsatHubPage() {
  // 내 훈련 기록 — 있으면 지도에 「내 기록」 칩이 생겨 **같은 막대를 내 오답으로 다시 센다.**
  // 못 읽어도 화면은 그대로 뜬다(칩만 없다) — 지도는 로그인과 무관하게 볼 수 있어야 한다.
  const [{ cards, error }, mine] = await Promise.all([
    loadCsatTypeCards(),
    createClient().then((db) => loadMyTraps(db)),
  ])
  const ready = cards.filter((c) => c.ready).length
  const chips = ATLAS_TYPES.filter((t) => t.status !== 'retired' && t.recent > 0).slice(0, CHIP_COUNT)

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── 증명이 먼저다 ──────────────────────────────────────────────
          클릭 0 · 입력 0 으로 「우리가 실제로 한 일」이 보인다(I1·I2). 칩을 누르면
          네트워크 왕복 없이 그 유형의 분포로 다시 세어진다(I3). */}
      <TrapAtlas chips={chips} as="h1" mine={mine} />

      {/* ⚠️ 오버레이 링크가 **여기 있어야 한다.** 2026-09-13 에 `/csat/overlay` 를 만들고
          진입 링크를 안 달아, 주소를 직접 쳐야만 닿는 화면이 됐다. 도달성 감사
          (`scripts/audit/learner-linkgraph.mjs`)도 못 잡았다 — 이 화면의 유형 링크가
          정적 형제까지 「링크됨」으로 보증했기 때문이다. */}
      {/* ── 오늘 뭘 하러 왔나 ─────────────────────────────────────────
          증명(TrapAtlas) 다음이 **다음 문**이다. 브리프 §B 의 네 모드를 화면 하나에
          네 갈래로 편다 — 「읽을거리 목록」이 아니라 「할 일」로 들어오게 한다. */}
      <ModePicker />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="기출로 하는 다른 일">
        {/* **훈련이 첫 자리에 온다.** 지도를 읽는 것만으로는 인출이 일어나지 않는다
            (원칙 1) — 여기가 「읽었다」에서 「알아본다」로 넘어가는 유일한 문이다. */}
        <Link
          href="/csat/drill"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--ju)] px-4 text-sm text-[var(--on-ju)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          오답 감별 훈련 8문항 →
        </Link>
        <Link
          href="/csat/plan"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
        >
          한 회차 주파 계획 보기 →
        </Link>
        <Link
          href="/csat/overlay"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
        >
          문제지 열고 해설 얹기 →
        </Link>
      </nav>

      <section className="mt-10" aria-labelledby="csat-types-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="csat-types-h" className="text-base font-bold text-[var(--t1)]">
            유형별로 보기
          </h2>
          <p className="text-xs text-[var(--t3)]">
            {CORPUS.exams}회차 {CORPUS.items.toLocaleString()}문항 · 분석 {ready}/{cards.length} 유형 · 듣기는 다루지
            않습니다
          </p>
        </div>

        {error ? (
          <p className="mt-2 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
            지금은 유형 목록을 불러오지 못했어요. 위의 오답 분포는 그대로 보실 수 있어요.
          </p>
        ) : null}

        {!error && !cards.length ? (
          <p className="mt-2 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
            아직 준비된 유형이 없어요.
          </p>
        ) : null}

        {/* ⚠️ 모바일에 열을 명시한다 — `grid` 만 두면 암시적 트랙이 `auto` 라 **max-content 로
            부풀어 컨테이너를 넘는다.** 실측 2026-09-06 · 390px 에서 ul 358px 인데 카드가 425px,
            화면이 51px 옆으로 밀렸다(라이트·다크 둘 다). Tailwind 의 `grid-cols-1` 은
            `minmax(0,1fr)` 이라 트랙이 컨테이너에 클램프된다. */}
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((c) => {
            // **잘린 산문 대신 센 것을 단다.** 전체 분포보다 유난히 잦은 함정만 고르므로
            // 어느 카드를 봐도 「어휘 함정 · 부분 사실」이 반복되지 않는다.
            const standout = standoutFor(c.type_id).slice(0, 3)
            return (
              <li key={c.type_id}>
                <Link
                  href={`/csat/${c.type_id}`}
                  className="group flex h-full min-h-[44px] flex-col rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--t1)]">{c.name}</h3>
                    <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                      {c.recent > 0 ? `최근 4개년 ${c.recent}문항` : `기출 ${c.items}문항`}
                    </span>
                  </div>

                  {c.status === 'retired' ? (
                    <span className="mt-1 self-start rounded bg-[var(--bg3)] px-1.5 py-0.5 text-[10px] text-[var(--t3)]">
                      2023학년도 이후 출제 없음
                    </span>
                  ) : null}

                  {standout.length ? (
                    <div className="mt-2">
                      <p className="text-xs text-[var(--t3)]">여기서 유난히 잦은 함정</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {standout.map((s) => (
                          <li
                            key={s.key}
                            className="inline-flex items-center gap-1 break-keep rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--t2)]"
                          >
                            <span aria-hidden className="text-[10px] leading-none text-[var(--t3)]">
                              {s.universal ? '◆' : '◇'}
                            </span>
                            {s.key}
                            <span className="tabular-nums text-[10px] text-[var(--t3)]">{s.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : c.ready ? (
                    // 유난히 잦은 것이 없다 = 이 유형의 오답 구성이 전체와 비슷하다. 그것도 정보다.
                    <p className="mt-2 break-keep text-sm text-[var(--t3)]">
                      오답 구성이 전체 평균과 비슷한 유형이에요.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--t3)]">분석 준비 중이에요.</p>
                  )}

                  {c.time_budget_sec ? (
                    <p className="mt-auto pt-3 text-xs text-[var(--t3)]">권장 풀이 시간 {c.time_budget_sec}초</p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-8 break-keep text-xs leading-relaxed text-[var(--t3)]">
        문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은 그 문항을 분석해
        우리가 쓴 글입니다. 원문은 평가원 공개자료에서 보실 수 있어요.
      </p>
    </div>
  )
}
