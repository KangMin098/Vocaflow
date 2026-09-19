// apps/web/src/app/admin/csat/press/LadderFill.tsx
//
// **사다리 7단 채움 띠 — 「조판된 계단 N / 7」을 숫자 대신 계단으로.**
//
// ── 왜 그림인가 ──────────────────────────────────────────────────────
// 「7/7」이라는 수는 다 찼다는 것만 말하고 **어느 계단이 비었는지**는 말하지 않는다. 브랜드는
// 이름이 아니라 채울 수 있는 계단이다 — 한 계단이 비면 학습자는 그 학년에서 다른 출판사로 간다
// (`series.ts`). 그래서 계단마다 칸을 그리고, 빈 칸이 어느 학령인지 바로 보이게 한다.
// 철학 4 Implicit Progress — 성장은 게이지가 아니라 **차오르는 서가**로 보인다.
//
// ── 색만으로 말하지 않는다 ───────────────────────────────────────────
// 칸의 상태는 셋이다 — 조판됨 · 옛 규격으로 조판됨 · 비어 있음. 색(초록/주황/없음)에 더해
// 채움(칠함/테두리만/점선)과 글자(학령·「옛 규격」·「비어 있음」)를 함께 싣는다.
// 해설이 안 붙은 권은 빨간 점을 얹는다 — 그 책은 그대로 나가면 해설 빠진 책이다.

import type { PressView } from '@/lib/csat/factory-line-model'

type Volume = PressView['volumes'][number]

export function LadderFill({ volumes, rungs }: { volumes: Volume[]; rungs: number }) {
  // 한 계단에 여러 번 조판됐으면 **가장 최근 것**을 그 계단의 상태로 본다.
  const byStep = new Map<number, Volume>()
  for (const v of volumes) {
    if (v.step == null) continue
    const cur = byStep.get(v.step)
    if (!cur || (v.renderedAt ?? '') > (cur.renderedAt ?? '')) byStep.set(v.step, v)
  }
  const steps = Array.from({ length: rungs }, (_, i) => i + 1)
  const filled = steps.filter((s) => byStep.has(s)).length

  return (
    <div className="flex flex-col gap-2">
      <ol
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${rungs}, minmax(0, 1fr))` }}
        aria-label={`학령 사다리 ${rungs}단 중 ${filled}단 조판됨`}
      >
        {steps.map((s) => {
          const v = byStep.get(s)
          const stale = v ? !v.brandCurrent : false
          const missing = v ? v.missingExplanations > 0 : false
          const label = v ? (stale ? '옛 규격' : '조판됨') : '비어 있음'
          const border = !v
            ? 'border-dashed border-[var(--bd)]'
            : stale
              ? 'border-[#B5803A]'
              : 'border-[#2E7D5A]'
          const fill = !v ? 'transparent' : stale ? 'rgba(181,128,58,0.12)' : 'rgba(46,125,90,0.18)'
          return (
            <li
              key={s}
              title={
                v
                  ? `${s}단 ${v.schoolBand ?? ''} — ${v.volumeTitle} · ${label}${missing ? ` · 해설 없음 ${v.missingExplanations}` : ''}`
                  : `${s}단 — 아직 조판된 권이 없다. 이 학년의 학습자는 갈 곳이 없다`
              }
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] border px-1 py-1.5 text-center transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] ${border}`}
              style={{ background: fill }}
            >
              {missing ? (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#9C3A30]"
                />
              ) : null}
              <span className="font-mono text-[10px] text-[var(--t3)]">{s}</span>
              <span className="w-full truncate break-keep font-display text-[10.5px] font-[600] text-[var(--t1)]">
                {v?.schoolBand ?? '—'}
              </span>
              <span
                className="font-body text-[9.5px]"
                style={{ color: !v ? 'var(--t3)' : stale ? '#B5803A' : '#2E7D5A' }}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
      {/*
        범례는 **글자가 없는 기호**에만 붙인다. 칸의 세 상태(조판됨 · 옛 규격 · 비어 있음)는
        칸 안에 이미 글자로 적혀 있어 범례를 또 두면 같은 말을 두 번 하는 것이다 — 밀집도 예산이
        그 중복을 잡았다(덩어리 110). 빨간 점만 글자가 없으므로 여기서 뜻을 말한다.
      */}
      <p className="inline-flex items-center gap-1 font-body text-[10.5px] text-[var(--t3)]">
        <span className="inline-block h-2 w-2 rounded-full bg-[#9C3A30]" aria-hidden />
        해설 안 붙은 문항이 있는 권 — 그대로 나가면 해설 빠진 책이다
      </p>
    </div>
  )
}
