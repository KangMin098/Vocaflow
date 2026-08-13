// apps/web/src/components/text-extract/TokenizationSummary.tsx
//
// 추출 전처리 내역 — "무엇을 어떻게 읽었는지" 를 학습자에게 되돌려준다.
//
// 왜 이 화면이 필요한가: 단어 추출은 학습자가 결과를 검증할 수 없는 블랙박스다.
// 축약형·하이픈·숫자·화자 라벨을 어떻게 처리했는지 보이지 않으면, 빠뜨렸는지 지어냈는지
// 아무도 모른다. 그래서 처리 내역을 노출한다 — 다만 Progressive Disclosure 로,
// 평소엔 한 줄만 보이고 원할 때만 펼친다 (Calm UI).

'use client'

import { ChevronDown, ChevronUp, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import type { TokenizationDiagnostics } from '@/lib/text-extract/tokenize'

interface TokenizationSummaryProps {
  totalWords: number
  uniqueRaw: number
  uniqueFinal: number
  diagnostics: TokenizationDiagnostics
}

/** 진단 키 → 사람 말투 라벨 + 왜 그렇게 했는지 */
const DIAGNOSTIC_LABELS: {
  key: keyof TokenizationDiagnostics
  label: string
  detail: string
}[] = [
  {
    key: 'contractionsResolved',
    label: '축약형 복원',
    detail: '"didn\'t" 를 "did" 로 되돌렸어요. 예전엔 "didn" 같은 없는 단어가 만들어졌어요.',
  },
  {
    key: 'hyphenCompounds',
    label: '하이픈 복합어',
    detail: '"machine-learning" 은 부분과 전체를 모두 후보로 올려요.',
  },
  {
    key: 'numericDropped',
    label: '숫자 결합 제외',
    detail: '"CO2" · "173,000" 처럼 숫자가 섞인 토큰은 통째로 뺐어요. 앞글자만 남기면 없는 단어가 돼요.',
  },
  {
    key: 'diacriticsFolded',
    label: '발음기호 정규화',
    detail: '"Jørgensen" 같은 이름이 조각나지 않도록 ASCII 로 폈어요.',
  },
  {
    key: 'bracketMarkers',
    label: '전사 마커 제거',
    detail: '[Laughter] 같은 대본 표기는 어휘가 아니라서 뺐어요.',
  },
  {
    key: 'speakerLabels',
    label: '화자 라벨 제거',
    detail: '"Chris Anderson:" 처럼 줄머리 화자 이름은 어휘에서 뺐어요.',
  },
  {
    key: 'stopwordsRemoved',
    label: '기능어 제외',
    detail: 'the · of · and 처럼 배울 것이 없는 단어는 후보에서 뺐어요.',
  },
]

export function TokenizationSummary({
  totalWords,
  uniqueRaw,
  uniqueFinal,
  diagnostics,
}: TokenizationSummaryProps) {
  const [open, setOpen] = useState(false)

  const active = DIAGNOSTIC_LABELS.filter((d) => diagnostics[d.key] > 0)
  const truncated = diagnostics.truncated

  return (
    <div className="mt-1">
      <p className="font-body text-[12px] text-[var(--t2)]">
        본문 <strong className="text-[var(--t1)]">{totalWords.toLocaleString()}어</strong> · 서로 다른 단어{' '}
        {uniqueRaw.toLocaleString()}개 · 분석 후보{' '}
        <strong className="text-[var(--t1)]">{uniqueFinal.toLocaleString()}개</strong>
      </p>

      {truncated > 0 && (
        <p
          role="alert"
          className="mt-2 inline-flex items-start gap-1.5 rounded-[var(--r-md)] border border-[var(--warning)]/30 bg-[var(--warning-light)] px-2.5 py-2 font-body text-[11px] text-[var(--warning-ink)]"
        >
          <TriangleAlert size={12} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
          <span>
            글이 길어 <strong>{truncated.toLocaleString()}개</strong> 단어를 후보에서 덜어냈어요. 본문을 나눠서 넣으면
            빠짐없이 볼 수 있어요.
          </span>
        </p>
      )}

      {active.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-sm)] px-1 font-body text-[11px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:scale-[0.98] disabled:opacity-50"
          >
            <Info size={11} aria-hidden />
            <span>본문을 어떻게 읽었는지 보기</span>
            {open ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
          </button>

          {open && (
            <ul className="mt-1 flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              {active.map((d) => (
                <li key={d.key} className="flex items-baseline gap-2 font-body text-[11px]">
                  <span className="min-w-[86px] shrink-0 font-display font-[700] text-[var(--t1)]">
                    {d.label}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-[var(--p)]">
                    {diagnostics[d.key].toLocaleString()}
                  </span>
                  <span className="text-[var(--t2)]">{d.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
