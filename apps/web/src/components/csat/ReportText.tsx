// apps/web/src/components/csat/ReportText.tsx
//
// **유형 리포트의 산문을 읽을 수 있게 그린다.**
//
// 이 화면의 글은 이미 문단·강조·문항 인용을 갖고 쓰여 있었는데, 화면이 `whitespace-pre-line`
// 한 `<p>` 하나로 쏟으면서 셋을 다 버리고 있었다(실측: 근거 위치 한 덩어리 **최대 5,931자** ·
// 별표가 그대로 보임 22/26유형 · 죽은 문항 인용 1,182개).
//
// 여기서 지어내는 것은 없다 — `lib/csat/report-markup.ts` 가 **데이터에 있는 구조만** 살리고,
// 이 파일은 그것을 그린다. 판단(무엇이 링크가 되는가)은 파서에 있고 화면에는 없다.
//
// 서버 컴포넌트다. 상호작용이 없으므로 클라이언트로 내릴 이유가 없다.

import Link from 'next/link'

import { parseReportText } from '@/lib/csat/report-markup'
// ⚠️ **`learner.ts` 에서 가져오지 않는다.** 한 줄짜리 함수 때문에 그 파일이 딸려 오고,
// 그게 `lib/supabase/server` 를 끌고 온다 — 서버 밖에서 렌더하는 순간 터진다(실측).
import { toItemSlug } from '@/lib/csat/item-slug'

export interface ReportTextProps {
  text: string | null | undefined
  /** 링크로 만들어도 되는 문항 id — 화면이 이미 불러온 그 유형의 목록. */
  known?: Set<string>
  className?: string
}

export function ReportText({ text, known, className }: ReportTextProps) {
  const blocks = parseReportText(text, known)
  if (!blocks.length) return null

  return (
    <div className={className}>
      {blocks.map((b, i) => (
        <p
          key={i}
          className={[
            'break-keep text-sm leading-relaxed text-[var(--t2)]',
            i > 0 ? 'mt-3' : '',
          ].join(' ')}
        >
          {b.segments.map((s, k) => {
            if (s.kind === 'strong') {
              return (
                <strong key={k} className="font-bold text-[var(--t1)]">
                  {s.text}
                </strong>
              )
            }
            if (s.kind === 'item') {
              return (
                <Link
                  key={k}
                  href={`/csat/item/${toItemSlug(s.itemId)}`}
                  // 인라인 링크라 44px 을 줄 수 없다 — 대신 아래·위 여백을 넉넉히 주고
                  // 밑줄로 «누를 수 있다» 를 색 말고도 말한다(색약 대응).
                  className="mx-0.5 inline-block rounded-[var(--r-sm)] px-1 py-0.5 font-display tabular-nums text-[var(--t1)] underline decoration-[var(--bd)] decoration-2 underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:decoration-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
                >
                  {s.text}
                </Link>
              )
            }
            return <span key={k}>{s.text}</span>
          })}
        </p>
      ))}
    </div>
  )
}
