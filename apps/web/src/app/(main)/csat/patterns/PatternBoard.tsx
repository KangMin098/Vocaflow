'use client'

// apps/web/src/app/(main)/csat/patterns/PatternBoard.tsx
//
// **주인공: 함정 묶기 보드.** 왼쪽 더미에서 고르면 오른쪽 내 묶음으로 간다.
//
// ── 왜 드래그가 아니라 누르기인가 ────────────────────────────────────
// 브리프는 드래그 앤 드롭을 말했지만, 드래그는 **키보드로 안 된다**(브리프 G4 는 모든
// 주인공 객체가 키보드로 조작되기를 요구한다). 누르기로 하면 마우스·키보드·터치가 같은
// 조작이 되고, 모바일에서 스크롤과 싸우지도 않는다. 드래그는 얹을 수 있는 장식이지
// 기능이 아니다 — 그래서 안 얹는다.
//
// ⚠️ **저장은 이 브라우저에만 남는다**(`localStorage`). 계정에 붙이려면 테이블이 필요한데,
//   지금 이 화면의 사용자는 로그인 없이 들어온다(D1 — 가치 확인 앞에 로그인을 두지 않는다).
//   읽기·쓰기를 전부 try/catch 로 감싼다 — 사생활 보호 모드에서 접근자 자체가 던진다.
//
// ⚠️ 모션 없음. 항목이 옮겨 가는 것은 자리 변화로 충분하다.

import { useCallback, useEffect, useState } from 'react'

import type { TrapEntry } from '@/lib/csat/trap-atlas'

const STORE = 'vocaflow.csat.myTraps.v1'

/** 저장된 묶음을 읽는다. 못 읽으면 빈 묶음 — 화면은 그대로 선다. */
function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(STORE)
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function PatternBoard({ traps }: { traps: TrapEntry[] }) {
  // ⚠️ **빈 상태를 로딩 뒤로 숨기지 않는다.** 처음엔 `ready` 플래그를 두고 그 전에는
  //   «불러오는 중» 을 그렸는데, 그러면 **서버 HTML 에 안내가 한 글자도 안 남는다**(실측 2026-09-15:
  //   회귀가 잡았다). 크롤러도 첫 페인트도 빈손이 된다(CLAUDE.md I6).
  //   기본값이 곧 빈 묶음이므로 서버와 하이드레이션 첫 그림이 같고, 저장된 것은 그 뒤에 붙는다.
  const [mine, setMine] = useState<string[]>([])

  useEffect(() => {
    setMine(readSaved())
  }, [])

  const save = useCallback((next: string[]) => {
    setMine(next)
    try {
      window.localStorage.setItem(STORE, JSON.stringify(next))
    } catch {
      /* 저장 못 해도 이번 세션에서는 쓸 수 있다 — 화면을 멈추지 않는다. */
    }
  }, [])

  const toggle = useCallback(
    (key: string) => save(mine.includes(key) ? mine.filter((k) => k !== key) : [...mine, key]),
    [mine, save],
  )

  const picked = traps.filter((t) => mine.includes(t.key))
  const pile = traps.filter((t) => !mine.includes(t.key))
  const pickedN = picked.reduce((s, t) => s + t.n, 0)
  const allN = traps.reduce((s, t) => s + t.n, 0)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      {/* ── 더미 ─────────────────────────────────────────────────── */}
      <section aria-labelledby="pile-h">
        <h2 id="pile-h" className="font-display text-sm font-bold text-[var(--t1)]">
          함정 더미
          <span className="ml-2 font-body text-xs font-normal text-[var(--t3)]">
            누르면 오른쪽으로 갑니다
          </span>
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {pile.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => toggle(t.key)}
                aria-label={`${t.key} 내 묶음에 넣기. 오답 ${t.n}개, ${t.types}개 유형에서 나옴`}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] px-3 py-2 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
              >
                <span aria-hidden className="text-[10px] text-[var(--t3)]">
                  {t.types >= 10 ? '◆' : '◇'}
                </span>
                <span className="min-w-0 flex-1 break-keep text-[13px] text-[var(--t1)]">{t.key}</span>
                <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                  {t.n}개 · {t.types}유형
                </span>
                <span aria-hidden className="shrink-0 text-[var(--t3)]">
                  +
                </span>
              </button>
            </li>
          ))}
          {!pile.length ? (
            <li className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] p-4 text-center text-sm text-[var(--t3)]">
              전부 담으셨어요.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ── 내 묶음 (⑤ 단권화) ───────────────────────────────────── */}
      <section aria-labelledby="mine-h" className="lg:sticky lg:top-4 lg:self-start">
        <h2 id="mine-h" className="font-display text-sm font-bold text-[var(--t1)]">
          내 묶음
          {picked.length ? (
            <span className="ml-2 font-body text-xs font-normal tabular-nums text-[var(--t3)]">
              {picked.length}종 · 오답 {pickedN}/{allN}
            </span>
          ) : null}
        </h2>

        <div className="mt-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-3">
          {picked.length === 0 ? (
            // 빈 상태 = 다음 한 걸음(D5). 설명하지 않고 무엇을 하면 되는지 적는다.
            <p className="break-keep text-center text-[13px] leading-relaxed text-[var(--t3)]">
              아직 비어 있어요.
              <br />
              왼쪽에서 <strong className="text-[var(--t2)]">자주 걸리는 함정</strong>을 눌러
              담아 보세요.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {picked.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => toggle(t.key)}
                      aria-label={`${t.key} 내 묶음에서 빼기`}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] px-3 py-2 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
                    >
                      <span className="min-w-0 flex-1 break-keep text-[13px] text-[var(--t1)]">
                        {t.key}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">{t.n}</span>
                      <span aria-hidden className="shrink-0 text-[var(--t3)]">
                        −
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p
                aria-live="polite"
                className="mt-3 break-keep text-xs leading-snug text-[var(--t3)]"
              >
                고른 함정이 전체 오답의{' '}
                <strong className="tabular-nums text-[var(--t2)]">
                  {Math.round((pickedN / allN) * 100)}%
                </strong>
                예요 ({pickedN}/{allN}).
              </p>
            </>
          )}
        </div>

        <p className="mt-2 break-keep text-[11px] leading-snug text-[var(--t3)]">
          이 묶음은 이 브라우저에만 저장돼요. 계정에 남기려면 로그인이 필요한데, 그건 아직
          만들지 않았어요.
        </p>
      </section>
    </div>
  )
}
