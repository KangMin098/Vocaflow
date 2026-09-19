// apps/web/src/components/dictation/DailySheet.tsx
//
// **오늘의 받아쓰기 문제지** — `/dictate` 의 골격(2026-09-19 화면 재설계 DD-36 · docs/design/compare/dictate.md 발산 A).
//
// 예전 「오늘의 받아쓰기」 는 하늘→파랑 그라디언트 상자 + 알약 칩 3개 + 그라디언트 CTA 였다(감사 평균 — 판면 밖 SaaS 파랑이
// 첫 화면의 주인). 이 화면이 실제로 내주는 것은 **받아쓸 문장 다섯 줄**이다. 그래서 첫 시선이 그 문제지다:
//   · 번호 붙은 줄마다 낱말 수만큼 빈칸 — 빈칸 폭 = 낱말 길이. **글자는 보이지 않는다**(보이면 받아쓰기가 아니다)
//   · 이번에 훈련할 내 낱말(`targetWords`) 자리는 주묵 빈칸 — 무엇을 들으러 가는지는 보인다
//   · 줄 끝에 왜 이 문장인지(새 문장 · 복습 임박 · 재도전 + 지난 정확도)
// 모션 0.

import { ArrowRight, Loader2 } from 'lucide-react'

import type { DailyDictation } from '@/lib/dictation/daily'

const REASON_KO: Record<string, string> = {
  fresh: '읽던 자료에서',
  due: '복습 임박',
  retry: '재도전',
}

/** 문장 → 빈칸 조각. 문장부호는 그대로 남긴다(빈칸 사이의 쉼표·마침표는 듣기 단서가 아니다). */
export function blanksOf(text: string, targets: string[]): Array<{ len: number; target: boolean } | { punct: string }> {
  const set = new Set(targets.map((t) => t.toLowerCase()))
  const out: Array<{ len: number; target: boolean } | { punct: string }> = []
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([^A-Za-z0-9']*)([A-Za-z0-9'’-]+)([^A-Za-z0-9']*)$/)
    if (!m) {
      out.push({ punct: tok })
      continue
    }
    const [, pre, word, post] = m
    if (pre) out.push({ punct: pre })
    const lower = word.toLowerCase()
    // 굴절형도 타깃으로 본다 — 원형이 앞부분에 있으면(walked ⊃ walk)
    const target = set.has(lower) || [...set].some((t) => t.length >= 3 && lower.startsWith(t))
    out.push({ len: word.length, target })
    if (post) out.push({ punct: post })
  }
  return out
}

export function DailySheet({
  daily,
  starting,
  onStart,
}: {
  daily: DailyDictation
  starting: boolean
  onStart: () => void
}) {
  const minutes = Math.max(1, Math.round(daily.sentences.length * 0.8))
  const targetCount = daily.sentences.reduce((n, s) => n + s.targetWords.length, 0)

  return (
    <section aria-labelledby="daily-dictation-title" data-daily-sheet="" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="daily-dictation-title" className="font-display text-[15px] font-[700] text-[var(--t1)]">
            오늘의 받아쓰기 · {daily.sentences.length}문장 · 약 {minutes}분
          </h2>
          <p className="m-0 mt-0.5 font-body text-[12px] text-[var(--t2)] [word-break:keep-all]">
            빈칸 하나가 낱말 하나 — 주묵 빈칸 {targetCount}곳이 이번에 들을 내 낱말이에요. 글자는 들으면서 채워요.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-6 font-display text-[14px] font-[700] text-[var(--on-ju)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden />
              준비 중
            </>
          ) : (
            <>
              받아쓰기 시작하기
              <ArrowRight size={15} aria-hidden />
            </>
          )}
        </button>
      </header>

      <ol className="m-0 list-none border-t-2 border-[var(--t1)] p-0" aria-label="받아쓸 문장 — 빈칸만">
        {daily.sentences.map((s, i) => (
          <li
            key={i}
            data-daily-line=""
            className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-[var(--bd)] py-3 sm:grid-cols-[24px_minmax(0,1fr)_auto]"
          >
            <span className="pt-1 font-mono text-[13px] font-[700] tabular-nums text-[var(--t2)]">{i + 1}.</span>
            <p className="m-0 flex flex-wrap items-end gap-x-1.5 gap-y-2 leading-none">
              {/* 빈칸은 장식이다 — 읽는 이에게는 몇 낱말 문장인지만(aria-label 은 p 에 금지 속성이라 sr-only 로) */}
              <span className="sr-only">
                {`${s.text.split(/\s+/).filter(Boolean).length}낱말 문장${s.targetWords.length ? ` — 내 낱말 ${s.targetWords.length}개` : ''}`}
              </span>
              {blanksOf(s.text, s.targetWords).map((b, j) =>
                'punct' in b ? (
                  <span key={j} aria-hidden className="font-english text-[16px] text-[var(--t2)]">
                    {b.punct}
                  </span>
                ) : (
                  <span
                    key={j}
                    aria-hidden
                    data-blank={b.target ? 'target' : 'word'}
                    className={`inline-block h-[18px] border-b-2 ${b.target ? 'border-[var(--ju)]' : 'border-[var(--t3)]'}`}
                    style={{ width: `${Math.max(1.2, b.len * 0.62)}em` }}
                  />
                ),
              )}
            </p>
            <span className="col-start-2 font-body text-[11.5px] text-[var(--t2)] sm:col-start-3 sm:self-center sm:text-right">
              {REASON_KO[s.reason ?? ''] ?? ''}
              {s.reason === 'retry' && s.previousAccuracy != null && ` · 지난번 ${Math.round(s.previousAccuracy)}%`}
              {/* 출처 라벨이 이유를 되풀이하면 뺀다(「복습 임박 · 복습 임박 단어」 — 2026-09-19 수정 1회차) */}
              {s.contextLabel && !s.contextLabel.includes(REASON_KO[s.reason ?? ''] ?? '\u0000') ? ` · ${s.contextLabel}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
