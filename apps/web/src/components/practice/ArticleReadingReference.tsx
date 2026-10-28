// apps/web/src/components/practice/ArticleReadingReference.tsx
//
// T-0207 — 기사 연습 채점 뒤 「읽은 글 참고」(접힘 · 사용자가 직접 연다). 본문은 loader 가 관문에서 해시로 검증한 본인 글 그대로다.
// - 연습 발췌와 같은 글이지만 문장이 다를 수 있다 — 자동으로 문장을 대응시키거나 정답을 표시하지 않는다(현재 문항과 구분해 보인다).
// - 일반 텍스트로만 그린다(문단 = 줄바꿈 기준 · HTML 해석 없음). 여닫기는 화면 메모리뿐 — 조회 · 채점 · 기록 · 이벤트 없음.
// - 닫으면 초점은 같은 토글 단추에 남는다(단추가 사라지지 않는다). 문항이 바뀌면 부모가 key 로 새로 그려 닫힌 채 시작한다.

'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function ArticleReadingReference({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const paragraphs = text
    .split(/\n\s*\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return null
  return (
    <section aria-label="읽은 글 참고" className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3" data-testid="reading-reference">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        data-testid="reading-reference-toggle"
        className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[var(--r-md)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <ChevronDown size={14} aria-hidden className={open ? 'rotate-180' : undefined} />
        {open ? '읽은 글 참고 접기' : '읽은 글 참고 펼치기 (선택)'}
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-2" data-testid="reading-reference-panel">
          <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
            읽은 글 전체예요. 위 문항의 발췌와 표현이 다를 수 있어요 — 같은 자리를 찾아 견주어 보세요.
          </p>
          <div
            className="max-h-[360px] overflow-y-auto overscroll-contain rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            lang="en"
            // 길면 안에서 스크롤 — 키보드로도 스크롤할 수 있게 초점을 받는다
            tabIndex={0}
            role="region"
            aria-label="읽은 글 본문"
            data-testid="reading-reference-body"
          >
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-2 font-english text-[13.5px] leading-relaxed text-[var(--t1)] last:mb-0">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
