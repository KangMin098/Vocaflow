// apps/web/src/components/csat/LocusBar.tsx
//
// **「정답 근거는 어디 있나」를 세어서 보여 준다.**
//
// 이 자리는 원래 산문 평균 1,763자(최대 5,931자)였다. 산문은 학습자가 검증할 수 없다 —
// 읽고 믿거나 말거나다. 여기서는 **이 유형의 기출을 실제로 세어** 분포를 그린다.
// 학습자가 직접 확인할 수 있고, 기출이 늘면 수치도 따라 움직인다.
//
// ── 색만으로 말하지 않는다 ────────────────────────────────────────────
// 구간마다 **이름과 수를 함께** 적는다. 막대 길이는 보조 신호일 뿐이고, 색약 학습자에게는
// 글자가 본체다. 가장 큰 구간에는 기호(▲)를 더해 셋(기호·글자·색)으로 말한다.
//
// 서버 컴포넌트다 — 상호작용이 없다.

import type { LocusSummary } from '@/lib/csat/locus-model'
import { locusSentence } from '@/lib/csat/locus-model'

/** 강조색 — 지도의 정답 근거와 같은 초록이라 두 화면이 같은 것을 가리킨다고 읽힌다. */
const GREEN = '#2E7D5A'

export function LocusBar({ summary }: { summary: LocusSummary }) {
  const sentence = locusSentence(summary)
  // `locusSentence` 는 `**…**` 로 한 곳만 강조한다(100% 일 때의 «전부»).
  const parts = sentence.split(/\*\*(.+?)\*\*/)

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4">
      <p className="break-keep text-sm leading-relaxed text-[var(--t1)]">
        {parts.map((t, i) =>
          i % 2 === 1 ? (
            <strong key={i} className="font-bold">
              {t}
            </strong>
          ) : (
            <span key={i}>{t}</span>
          ),
        )}
      </p>

      <ol className="mt-3 flex items-end gap-1" aria-label="근거 위치 분포">
        {summary.bands.map((b) => {
          const on = b.key === summary.top.key && b.count > 0
          // 0 인 구간도 자리를 지킨다 — 빠지면 «그 자리엔 없다» 가 아니라 «그런 자리가 없다» 로 읽힌다.
          const h = Math.max(4, Math.round(b.share * 40))
          return (
            <li
              key={b.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              aria-label={`${b.label} ${b.count}문항`}
            >
              <span
                aria-hidden
                className="w-full rounded-[2px]"
                style={{ height: `${h}px`, background: on ? GREEN : 'var(--bd)' }}
              />
              <span className="break-keep text-center text-[10px] leading-tight text-[var(--t3)]">
                {on ? <span aria-hidden>▲ </span> : null}
                {b.label}
                <br />
                <span className="tabular-nums">{b.count}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mt-2 break-keep text-[11px] leading-relaxed text-[var(--t3)]">
        이 유형의 기출 {summary.n}문항에서 정답 근거가 지문의 어디에 있었는지 센 것입니다 —
        주장이 아니라 관측이고, 기출이 늘면 이 수치도 따라 바뀝니다.
      </p>
    </div>
  )
}
