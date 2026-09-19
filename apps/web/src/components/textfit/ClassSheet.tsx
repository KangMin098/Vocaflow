// apps/web/src/components/textfit/ClassSheet.tsx
//
// **학급에 나눠 줄 한 장** — `/fit` 결과의 출력 면(2026-09-19 발산 B, `docs/design/compare/fit.md`).
//
// 별도 화면이 아니다. 「학급에 나눠 줄 한 장으로」 를 누르면 결과 아래에 펼쳐지고,
// 같은 판면이 인쇄의 첫 장이 된다(`Worksheet` → `PrintSheet` 의 `prelude`).
//
// 형태 — 시험지 사물(vocaflow-design §G1):
//   · 왼쪽 단: 원문(Lora). 이 반에서 처음 만나는 낱말에 **권점(○)** — CSS `text-emphasis`,
//     동아시아 조판의 강조점 그 자체다. 색이 아니라 **점의 모양**이 뜻을 나른다(흑백 인쇄에서도 산다).
//   · 오른쪽 난외: 번호 붙은 뜻 풀이. 원문의 첫 등장 자리에 같은 번호를 위 첨자로 단다.
//   · 머리: 적정 학년 **도장** — 주묵 테두리 안의 Hahmlet.
//
// 정직성: 이 종이는 **학년 기준**이다(개인 기록 아님). 발에 그렇게 적는다.
// 뜻은 서버가 가장 어려운 낱말에만 붙인다(`hardestWords[].meaningKo`) — 뜻이 없는 낱말은
// 권점만 찍고 난외에 올리지 않는다(지어낸 뜻을 싣지 않는다).

import { LEVEL_LABEL, type LevelProfile, type ProfileLevel } from '@/lib/textfit/profile'
import { isUnknownAt, type PaintToken } from '@/lib/textfit/paint'

/** 난외에 올리는 최대 낱말 수 — 한 장에 들어가야 한다. */
export const SHEET_GLOSS_MAX = 12

export interface SheetGloss {
  n: number
  word: string
  meaning: string
  vLevel: number | null
}

/**
 * 난외 풀이 목록 — 이 반에서 처음 만나는 낱말 중 **뜻이 있는 것**을 원문 등장 순서로.
 * 원문이 없으면(공유 링크) 어려운 낱말 순서 그대로.
 */
export function buildGloss(
  profile: LevelProfile,
  tokens: PaintToken[] | null,
  level: ProfileLevel,
): SheetGloss[] {
  const meaningOf = new Map<string, { word: string; meaning: string; vLevel: number | null }>()
  for (const w of profile.hardestWords) {
    const m = (w.meaningKo ?? '').trim()
    if (!m || w.vLevel === null || w.vLevel <= level) continue
    meaningOf.set(w.surface.toLowerCase(), { word: w.surface, meaning: m, vLevel: w.vLevel })
  }

  const order: string[] = []
  if (tokens) {
    for (const tok of tokens) {
      const key = tok.t.toLowerCase()
      if (isUnknownAt(tok, level) && meaningOf.has(key) && !order.includes(key)) order.push(key)
    }
  }
  for (const key of meaningOf.keys()) if (!order.includes(key)) order.push(key)

  return order.slice(0, SHEET_GLOSS_MAX).map((key, i) => ({ n: i + 1, ...meaningOf.get(key)! }))
}

interface Props {
  profile: LevelProfile
  /** 칠해진 원문 — 공유 링크로 들어와 원문이 없으면 `null`. */
  tokens: PaintToken[] | null
  /** 이 반의 학년 — 권점의 기준. */
  level: ProfileLevel
  /** 화면 판면인가, 인쇄 장인가. 인쇄는 색을 쓰지 않는다(흑백 인쇄기). */
  variant: 'screen' | 'print'
}

export function ClassSheet({ profile, tokens, level, variant }: Props) {
  const gloss = buildGloss(profile, tokens, level)
  const numberOf = new Map(gloss.map((g) => [g.word.toLowerCase(), g.n]))
  const seen = new Set<string>()
  const fit = profile.fitLevel as ProfileLevel | null
  const unknownTypes = tokens
    ? new Set(tokens.filter((t) => isUnknownAt(t, level)).map((t) => t.t.toLowerCase())).size
    : null

  const print = variant === 'print'
  const ink = print ? '#000' : 'var(--ju)'
  const emphasis = {
    textEmphasis: `open circle ${ink}`,
    WebkitTextEmphasis: `open circle ${ink}`,
    textEmphasisPosition: 'over right',
    WebkitTextEmphasisPosition: 'over right',
  } as const

  return (
    <article
      aria-label="학급에 나눠 줄 한 장"
      className={
        print
          ? 'p-[14mm] text-black'
          : 'rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 text-[var(--t1)] md:p-8'
      }
    >
      {/* ── 머리 — 무엇의 종이인가 + 적정 학년 도장 ── */}
      <header
        className={`flex items-start justify-between gap-4 border-b pb-4 ${print ? 'border-black' : 'border-[var(--t1)]'}`}
      >
        <div className="min-w-0">
          <p className={`m-0 font-display text-[11px] font-[700] tracking-[0.04em] ${print ? '' : 'text-[var(--t2)]'}`}>
            영어 지문 · {LEVEL_LABEL[level]} 반 기준
          </p>
          <h3 className="m-0 mt-1 break-keep font-ko-display text-[20px] font-[600] leading-[1.35] md:text-[22px]">
            오늘 읽을 글
          </h3>
          <p className={`m-0 mt-1 font-mono text-[11px] tabular-nums ${print ? '' : 'text-[var(--t2)]'}`}>
            러닝 워드 {profile.totalTokens.toLocaleString()}
            {unknownTypes !== null && <> · 처음 만나는 낱말 {unknownTypes}</>}
            {gloss.length > 0 && <> · 난외 풀이 {gloss.length}</>}
          </p>
        </div>
        <p
          aria-label={fit ? `적정 학년 ${LEVEL_LABEL[fit]}` : '적정 학년 판정 없음'}
          className="m-0 shrink-0 break-keep border-2 px-3 py-2 text-center font-ko-display text-[15px] font-[600] leading-[1.25]"
          style={{ borderColor: ink, color: ink }}
        >
          {fit ? (
            <>
              {LEVEL_LABEL[fit]}
              <span className="block text-[12px]">적정</span>
            </>
          ) : (
            <>적정 학년<span className="block text-[12px]">없음</span></>
          )}
        </p>
      </header>

      {/* ── 본문 2단 — 원문 · 난외 ── */}
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:gap-8">
        <div className="min-w-0 flex-1">
          {tokens ? (
            <p className="m-0 font-english text-[15px] leading-[2.15] md:text-[16px]">
              {tokens.map((tok, i) => {
                if (!isUnknownAt(tok, level)) return <span key={i}>{tok.t}</span>
                const key = tok.t.toLowerCase()
                const n = numberOf.get(key)
                const first = n !== undefined && !seen.has(key)
                if (first) seen.add(key)
                return (
                  <span key={i}>
                    <span style={emphasis}>{tok.t}</span>
                    {first && (
                      <sup className="ml-px font-mono text-[9px]" style={{ color: ink }}>
                        {n}
                      </sup>
                    )}
                  </span>
                )
              })}
            </p>
          ) : (
            <p className={`m-0 break-keep font-body text-[13px] leading-[1.7] ${print ? '' : 'text-[var(--t2)]'}`}>
              공유된 결과에는 지문이 담기지 않아요. 위에 같은 지문을 붙여 넣으면 이 자리에 원문과
              권점이 함께 찍힙니다.
            </p>
          )}
        </div>

        {gloss.length > 0 && (
          <aside
            aria-label="난외 풀이"
            className={`md:w-[15rem] md:shrink-0 md:border-l md:pl-6 ${print ? 'border-black' : 'border-[var(--bd)]'}`}
          >
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {gloss.map((g) => (
                <li key={g.n} className="flex gap-2 text-[13px] leading-[1.5]">
                  <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums" style={{ color: ink }}>
                    {g.n}
                  </span>
                  <span className="min-w-0">
                    <span className="font-english text-[14px]">{g.word}</span>
                    <span className="break-keep font-body"> — {g.meaning}</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      {/* ── 발 — 이 종이의 기준을 밝힌다 ── */}
      <footer
        className={`mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 font-body text-[11px] ${print ? 'border-black' : 'border-[var(--bd)] text-[var(--t2)]'}`}
      >
        <span>
          <span className="font-english" style={emphasis}>Aa</span> 이 반에서 처음 만나는 낱말 · 숫자는 난외 풀이
        </span>
        <span>학년 기준 판정 — 개인 기록이 아닙니다 · Vocaflow 지문 난이도 진단</span>
      </footer>
    </article>
  )
}
